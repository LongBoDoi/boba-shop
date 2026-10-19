/**
 * One calm motion style for the whole game, as `src/motion.ts`: short, eased moves that settle
 * once — no bounce, no shaking, no looping movement near the play area.
 */
export const DURATION = { fast: 150, base: 250, slow: 450 };

/** `Easing.out(Easing.cubic)`. */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** `Easing.inOut(Easing.cubic)`. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Phaser's name for the same curve, for its tweens. */
export const EASE = 'Cubic.easeOut';
