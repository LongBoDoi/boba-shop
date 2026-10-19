import { createInitialState, GameState } from './game/reducer';
import { parseGame, serializeGame } from './game/save';
import { store } from './store';

/**
 * Keeping the shop between visits in `localStorage`. `src/game/save.ts` decides what a save is
 * and whether it can be trusted; this is only the storage and its timing, and the three rules it
 * keeps are the ones that cost a player their week:
 *
 * - a read that *fails* is not a shop that isn't there, and is never written over;
 * - a save that cannot be parsed is set aside under `.broken`, not deleted;
 * - writes are slow (every 2 s) and flushed when the page is hidden or closed.
 */
const KEY = 'boba-shop.save.v1';
const BROKEN_KEY = 'boba-shop.save.v1.broken';
const WRITE_EVERY_MS = 2_000;
const READ_TRIES = 3;

let writable = true;
let written: string | null = null;

function warn(what: string, error: unknown) {
  console.warn(`[save] the shop ${what}:`, error);
}

/** Read the saved shop, or a new one. Synchronous: on the web the store underneath is. */
export function readSavedGame(): GameState {
  let json: string | null = null;
  let read = false;
  for (let attempt = 1; attempt <= READ_TRIES && !read; attempt++) {
    try {
      json = localStorage.getItem(KEY);
      read = true;
    } catch (error: unknown) {
      if (attempt === READ_TRIES) warn('could not be read', error);
    }
  }
  if (!read) {
    // Play a new shop, but keep the store's hands off the old one: it is very likely still there.
    writable = false;
    return createInitialState(Date.now());
  }
  const saved = parseGame(json);
  if (!saved && json !== null) {
    try {
      localStorage.setItem(BROKEN_KEY, json);
      warn('could not be restored and was set aside', `${json.length} bytes under ${BROKEN_KEY}`);
    } catch (error: unknown) {
      warn('could not be set aside', error);
    }
  }
  written = json;
  return saved ?? createInitialState(Date.now());
}

export function flushSave() {
  if (!writable) return;
  const json = serializeGame(store.state);
  if (json === written) return;
  try {
    localStorage.setItem(KEY, json);
    written = json;
  } catch (error: unknown) {
    written = null;
    warn('could not be written', error);
  }
}

/** Start the slow writer and the flushes on the way out. */
export function startSaving() {
  setInterval(flushSave, WRITE_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  // Closing a tab does not reliably raise a visibility change; `pagehide` does.
  window.addEventListener('pagehide', flushSave);
}
