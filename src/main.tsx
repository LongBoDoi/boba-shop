import './styles.css';

import { render } from 'preact';

import { startClock } from './clock';
import { createGame } from './game/game';
import { readSavedGame, startSaving } from './persist';
import { startSound } from './sound';
import { store } from './store';
import { App } from './ui/App';
import { uiState } from './ui-state';

/**
 * Opening the shop. The loading screen is up from the first frame; behind it come the fonts (so
 * no label is drawn in the wrong face and jumps), the saved shop (which has to *be* the starting
 * state, not something laid over a day that has already opened), and the artwork.
 */
const FONT_SHARE = 0.1;
const SAVE_SHARE = 0.05;
const FONT_TIMEOUT_MS = 4_000;

async function loadFonts() {
  const faces = [500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px "Baloo 2"`, 'Tiệm Trà Sữa'));
  await Promise.race([
    Promise.all(faces),
    new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
  ]).catch((error: unknown) => console.warn('[fonts] Baloo 2 could not be loaded', error));
}

async function boot() {
  render(<App />, document.getElementById('ui')!);

  await loadFonts();
  uiState.set({ loading: FONT_SHARE });

  const saved = readSavedGame();
  store.reset(saved);
  // The day's sign announces a day as it opens; a day resumed mid-shift has already opened.
  uiState.set({ loading: FONT_SHARE + SAVE_SHARE, opening: saved.phase === 'playing' && saved.clock === 0 });

  startSaving();
  startClock();
  startSound();
  createGame(document.getElementById('game')!);

  // Tests drive the shop through this: always in development, and in a build only when the page is
  // opened with `?test` (it only reaches the player's own shop in their own browser).
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    const { goToPage } = await import('./game/pager');
    const { parseGame } = await import('./game/save');
    /** Put a saved shop on screen, exactly as a launch would read it. */
    const load = (json: string) => {
      const state = parseGame(json);
      if (!state) throw new Error('save refused by parseGame');
      store.reset(state);
      uiState.set({ opening: state.phase === 'playing' && state.clock === 0 });
    };
    const { getGame } = await import('./game/game');
    Object.assign(window, { __shop: { store, uiState, goToPage, load, game: getGame } });
  }
}

void boot();

// The shop is kept on the phone (see public/sw.js). Registered after load so it never competes with
// the artwork the loading screen is waiting on; never in development, where it would cache the dev
// server's modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => console.warn('Không đăng ký được service worker:', error));
  });
}
