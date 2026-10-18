import { store } from './store';
import { uiState } from './ui-state';

/**
 * The day's clock. As in the Expo build, nothing rides on how often this fires — every rule in the
 * reducer is written against the measured `dt` — so it is only how often the shop's state moves.
 */
const TICK_MS = 150;
/** Cap one step, so coming back from a background tab doesn't skip the day ahead. */
const MAX_STEP_MS = 250;

let timer: ReturnType<typeof setInterval> | null = null;
let last = 0;

function running() {
  const { phase, paused } = store.state;
  return phase === 'playing' && !paused && !uiState.value.opening && uiState.value.ready;
}

function sync() {
  if (running() && !timer) {
    last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, MAX_STEP_MS);
      last = now;
      store.dispatch({ type: 'TICK', dt });
    }, TICK_MS);
  } else if (!running() && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startClock() {
  store.subscribe(sync);
  uiState.subscribe(sync);
  // A hidden page pauses the shift, as the app did when it was backgrounded.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && store.state.phase === 'playing') {
      store.dispatch({ type: 'SET_PAUSED', paused: true });
    }
  });
  sync();
}
