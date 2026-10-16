import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { createInitialState, GameState } from './game/reducer';
import { parseGame, serializeGame } from './game/save';

/**
 * Keeping the shop between sessions. `src/game/save.ts` decides *what* a save is and whether one
 * can be trusted; this is only the storage and the timing of it.
 *
 * Async Storage is the store because the game ships on the web: there it is `localStorage` and
 * needs no configuration, and it is bundled into Expo Go, so a phone can still run the game
 * without a development build. `expo-sqlite/kv-store` is the Expo-made alternative and is a
 * drop-in, but its web support is alpha and wants a wasm Metro config plus COEP/COOP headers on
 * the host — a lot of setup for a few kilobytes of JSON.
 */
const KEY = 'boba-shop.save.v1';

/**
 * Where a save that could not be read back is put instead of being written over. Nothing reads it;
 * it is there so that losing a shop is recoverable rather than final, and so that a save the
 * validator turns down can be looked at afterwards instead of only guessed about.
 */
const BROKEN_KEY = 'boba-shop.save.v1.broken';

/**
 * How often the shop is written down. A day ticks ten times a second and must not be saved at that
 * rate, so the writer is on a slow timer and flushes when the game goes away instead; the most a
 * crash can cost is the last couple of seconds of a shift.
 */
const WRITE_EVERY_MS = 2_000;

/**
 * A read that *fails* is not the same thing as a shop that isn't there, and on a phone it is
 * usually a moment rather than a fact: the store is SQLite, and it can be busy or still coming up
 * while the app launches. So the read is tried again before the shop is given up for new.
 */
const READ_TRIES = 3;
const RETRY_AFTER_MS = 150;

/** Storage failures are survivable, so they are reported rather than thrown — but never hidden. */
function warn(what: string, error: unknown) {
  console.warn(`[save] the shop ${what}:`, error);
}

const wait = (ms: number) => new Promise((resume) => setTimeout(resume, ms));

export interface RestoredGame {
  /** The shop to open: the saved one if there was one, otherwise a new one. */
  state: GameState;
  /**
   * False when the store could not be read at all. The real save may still be sitting there
   * perfectly intact, so the new shop standing in for it must **not** be written down — see
   * `useSaveGame`.
   */
  writable: boolean;
}

/**
 * Read the saved shop once, on the first render. `null` means the read is still going — the caller
 * should hold the splash until it lands, because the restored state has to *be* the reducer's
 * initial state, not something applied over a day that has already started.
 */
export function useSavedGame(): RestoredGame | null {
  const [restored, setRestored] = useState<RestoredGame | null>(null);

  useEffect(() => {
    let cancelled = false;

    const open = async () => {
      let json: string | null = null;
      let read = false;
      for (let attempt = 1; attempt <= READ_TRIES && !read; attempt++) {
        try {
          json = await AsyncStorage.getItem(KEY);
          read = true;
        } catch (error: unknown) {
          if (attempt === READ_TRIES) warn('could not be read', error);
          else await wait(RETRY_AFTER_MS * attempt);
        }
      }
      if (cancelled) return;

      if (!read) {
        // A fresh shop is the right thing to *play*, and the wrong thing to keep. A store that
        // cannot be read is indistinguishable from a first launch, so the old code opened a new
        // shop and the slow writer then committed it over a save that was very likely still there
        // — a moment's storage trouble, and the week was gone. Open it, and leave the store alone.
        setRestored({ state: createInitialState(Date.now()), writable: false });
        return;
      }

      // A save that doesn't check out is still thrown away rather than patched — a fresh shop is a
      // better failure than a half-restored one — but the bytes are put aside first, because the
      // alternative is destroying the only copy of something a validator merely disagreed with.
      const saved = parseGame(json);
      if (!saved && json !== null) await setAside(json);
      if (cancelled) return;
      // A fresh shop is seeded off the clock; a restored one brings its own seed with it.
      setRestored({ state: saved ?? createInitialState(Date.now()), writable: true });
    };

    void open();
    return () => {
      cancelled = true;
    };
  }, []);

  return restored;
}

async function setAside(json: string) {
  try {
    await AsyncStorage.setItem(BROKEN_KEY, json);
    warn('could not be restored and was set aside', `${json.length} bytes under ${BROKEN_KEY}`);
  } catch (error: unknown) {
    warn('could not be set aside', error);
  }
}

/**
 * Write the shop down as it changes, slowly, and at once whenever the game is put away.
 *
 * Returns that flush, because one caller has to be able to *wait* for it: applying an update
 * restarts the app, and a write that is still in flight when the process goes is a lost shift.
 *
 * @param writable false when the shop on screen is standing in for a save that could not be read.
 */
export function useSaveGame(state: GameState, writable = true): () => Promise<void> {
  const latest = useRef(state);
  const allowed = useRef(writable);
  const written = useRef<string | null>(null);

  // Runs after every render, so the flush below always has the state on screen to hand.
  useEffect(() => {
    latest.current = state;
    allowed.current = writable;
  });

  /**
   * Writes go one after another. Two of them overlap easily — the slow timer and the flush on the
   * way out are a couple of milliseconds apart — and `setItem` makes no promise about which lands
   * last. An older shift settling on top of a newer one is indistinguishable, from the player's
   * side, from the game having thrown away their afternoon.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    const next = queue.current.then(async () => {
      if (!allowed.current) return;
      const json = serializeGame(latest.current);
      if (json === written.current) return;
      try {
        await AsyncStorage.setItem(KEY, json);
        written.current = json;
      } catch (error: unknown) {
        // The game is still playable if the store is full or blocked, so this must not take the app
        // down — but it must not be invisible either, or the shop quietly stops coming back.
        written.current = null;
        warn('could not be written', error);
      }
    });
    queue.current = next;
    return next;
  }, []);

  useEffect(() => {
    const save = () => {
      void flush();
    };

    const timer = setInterval(save, WRITE_EVERY_MS);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') save();
    });
    // Closing a tab doesn't reliably raise a visibility change, which is all AppState has on the
    // web. `pagehide` does, and on the web the store underneath is synchronous, so a write here
    // lands.
    const page = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    page?.addEventListener('pagehide', save);

    return () => {
      clearInterval(timer);
      subscription.remove();
      page?.removeEventListener('pagehide', save);
      save();
    };
  }, [flush]);

  return flush;
}
