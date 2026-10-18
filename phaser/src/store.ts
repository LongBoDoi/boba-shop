import { createInitialState, GameAction, gameReducer, GameState } from '../../src/game/reducer';

/**
 * The shop, as one value with one way to change it — the same `gameReducer` the Expo build runs,
 * so the rules are not rebuilt here, only wired up.
 *
 * Nothing draws from React state any more. The Phaser scenes and the HTML around them both
 * subscribe and update what they own when the slice they care about changes, which is what keeps
 * the day's clock (several renders a second) from redrawing anything that did not move.
 */
type Listener = (state: GameState, previous: GameState) => void;

let state: GameState = createInitialState(Date.now());
const listeners = new Set<Listener>();

export const store = {
  get state(): GameState {
    return state;
  },
  dispatch(action: GameAction) {
    const previous = state;
    const next = gameReducer(previous, action);
    if (next === previous) return;
    state = next;
    for (const listener of [...listeners]) listener(next, previous);
  },
  /** Replace the whole shop, for the save read at launch. Listeners hear it as a change. */
  reset(next: GameState) {
    const previous = state;
    state = next;
    for (const listener of [...listeners]) listener(next, previous);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const dispatch = (action: GameAction) => store.dispatch(action);
