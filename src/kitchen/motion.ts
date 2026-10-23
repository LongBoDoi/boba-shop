/**
 * One calm motion style for the whole game, as `src/motion.ts`: short, eased moves that settle
 * once — no bounce, no shaking, no looping movement near the play area.
 *
 * These three are the only speeds the game moves at, on the canvas and in the HTML alike, and
 * everything else is measured against them: a carry's own clock is clamped between `fast` and
 * `slow`, a cup glides home in `slow`, the HUD and the cards transition in `base`. They were
 * lengthened by about a third from 150/250/450, by request — change them here rather than
 * reaching for a number at the call site, or the game stops moving at one pace.
 */
export const DURATION = { fast: 200, base: 340, slow: 600 };

/** `Easing.out(Easing.cubic)`. */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** `Easing.inOut(Easing.cubic)`. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Phaser's name for the same curve, for its tweens. */
export const EASE = 'Cubic.easeOut';
