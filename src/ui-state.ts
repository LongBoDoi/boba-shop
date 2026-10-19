/**
 * What the screen is doing that is not the shop: which page is up, which cards are open, what the
 * kitchen is saying, how full the cup under a tap is. None of it is saved and none of it belongs in
 * `GameState`.
 *
 * It is a plain observable object rather than a framework's state so the Phaser scenes can read and
 * write it as easily as the HTML can.
 */
export interface PourMeter {
  /** Live fill of the docked cup, 0 and up (over 1 is spilling). */
  level: number;
  color: string;
  running: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiState {
  /** Fonts, the save and the artwork, 0–1, until the shop can open. */
  loading: number;
  ready: boolean;
  /** 0 = counter, 1 = kitchen. Where the pager is resting. */
  page: 0 | 1;
  /** Where the pager is drawn right now, 0–1, including mid-swipe and mid-animation. */
  pageOffset: number;
  /** The day's sign is up; the clock does not run behind it. */
  opening: boolean;
  settings: boolean;
  /** A short message from the kitchen, over its usual hint. */
  nudge: string;
  /** The kitchen's standing hint, as the kitchen scene works it out. */
  hint: string;
  /** Set while the cup stands under a tap. */
  meter: PourMeter | null;
  /** The part of the pager the kitchen is drawn in, in CSS pixels relative to the pager. */
  kitchenRect: Rect;
  /** The pager's own size, in CSS pixels. */
  pager: { width: number; height: number };
  /**
   * Where the cup stands on screen (page coordinates: its centre and drawn width), kept up to date
   * by the kitchen scene, for the effects that start at the cup — the coins of a serve, the toss of a
   * discarded drink. Null while there is no cup on the mat.
   */
  cupScreen: { x: number; y: number; width: number } | null;
}

type Listener = (ui: UiState, previous: UiState) => void;

let ui: UiState = {
  loading: 0,
  ready: false,
  page: 0,
  pageOffset: 0,
  opening: false,
  settings: false,
  nudge: '',
  hint: '',
  meter: null,
  kitchenRect: { x: 0, y: 0, width: 0, height: 0 },
  pager: { width: 0, height: 0 },
  cupScreen: null,
};
const listeners = new Set<Listener>();

export const uiState = {
  get value(): UiState {
    return ui;
  },
  set(patch: Partial<UiState>) {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof UiState)[]) {
      if (!Object.is(ui[key], patch[key])) { changed = true; break; }
    }
    if (!changed) return;
    const previous = ui;
    ui = { ...ui, ...patch };
    for (const listener of [...listeners]) listener(ui, previous);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let nudgeTimer: ReturnType<typeof setTimeout> | undefined;
/** A message that fades back to the kitchen's usual hint after a moment. */
export function nudge(message: string) {
  clearTimeout(nudgeTimer);
  uiState.set({ nudge: message });
  nudgeTimer = setTimeout(() => uiState.set({ nudge: '' }), 2200);
}
