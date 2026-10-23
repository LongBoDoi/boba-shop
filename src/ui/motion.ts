/**
 * The game's one calm motion style (`src/motion.ts`), for the HTML: short, eased moves that settle
 * once — no bounce, no shaking, no looping movement near the play area.
 *
 * CSS gets the curves as `cubic-bezier`s; anything whose path is not a straight line (a coin's arc,
 * a piece of confetti falling) is sampled into keyframes and run by the Web Animations API, so the
 * whole flight is handed to the compositor at once instead of being stepped from JavaScript.
 */
export const DURATION = { fast: 200, base: 340, slow: 600 } as const;

/** `Easing.out(Easing.cubic)` and `Easing.inOut(Easing.cubic)`, as CSS. */
export const CSS_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

export interface SampledOptions {
  delay?: number;
  /** Applied to time before `frame` is asked for the picture at that progress. */
  ease?: (t: number) => number;
  steps?: number;
}

/**
 * Run `frame(progress)` as a keyframe animation: `steps + 1` samples, linear between them. The
 * element holds the first frame through the delay and the last one after (`fill: both`).
 */
export function animateSampled(
  element: Element,
  duration: number,
  frame: (p: number) => Keyframe,
  { delay = 0, ease = (t) => t, steps = 20 }: SampledOptions = {},
): Animation {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    frames.push({ ...frame(ease(t)), offset: t });
  }
  return element.animate(frames, { duration, delay, fill: 'both', easing: 'linear' });
}

/** Deterministic 0–1 pseudo-random value (`noise` in `Effects.tsx`), so confetti is the same every time. */
export function noise(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

