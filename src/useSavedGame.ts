import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
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
 * How often the shop is written down. A day ticks ten times a second and must not be saved at that
 * rate, so the writer is on a slow timer and flushes when the game goes away instead; the most a
 * crash can cost is the last couple of seconds of a shift.
 */
const WRITE_EVERY_MS = 2_000;

/**
 * Read the saved shop once, on the first render. `null` means the read is still going — the caller
 * should hold the splash until it lands, because the restored state has to *be* the reducer's
 * initial state, not something applied over a day that has already started.
 */
export function useSavedGame(): GameState | null {
  const [initial, setInitial] = useState<GameState | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A fresh shop is seeded off the clock; a restored one brings its own seed with it.
    const restore = (json: string | null) => {
      if (!cancelled) setInitial(parseGame(json) ?? createInitialState(Date.now()));
    };
    AsyncStorage.getItem(KEY)
      .then(restore)
      .catch(() => restore(null));
    return () => {
      cancelled = true;
    };
  }, []);

  return initial;
}

/** Write the shop down as it changes, slowly, and at once whenever the game is put away. */
export function useSaveGame(state: GameState) {
  const latest = useRef(state);
  const written = useRef<string | null>(null);

  // Runs after every render, so the flush below always has the state on screen to hand.
  useEffect(() => {
    latest.current = state;
  });

  useEffect(() => {
    const flush = () => {
      const json = serializeGame(latest.current);
      if (json === written.current) return;
      written.current = json;
      // Nothing useful to do about a full or blocked store: the game is still playable, it just
      // won't come back. Letting it reject would take the whole app down instead.
      AsyncStorage.setItem(KEY, json).catch(() => {});
    };

    const timer = setInterval(flush, WRITE_EVERY_MS);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') flush();
    });
    // Closing a tab doesn't reliably raise a visibility change, which is all AppState has on the
    // web. `pagehide` does, and on the web the store underneath is synchronous, so a write here
    // lands.
    const page = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    page?.addEventListener('pagehide', flush);

    return () => {
      clearInterval(timer);
      subscription.remove();
      page?.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
