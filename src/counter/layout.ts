/**
 * Where everything on the counter page goes — the arithmetic of `GameScreen.tsx` (how tall the
 * stage is), `CounterPage.tsx` (the stage, then the counter top under it) and `CustomerStage.tsx`
 * (the slots, the figures and their bubbles), kept as plain numbers so the scene only places.
 *
 * All in CSS pixels, from the page's top-left.
 */

/** The counter's rim along the bottom of the stage, which the customers stand behind. */
export const COUNTER_HEIGHT = 44;
/** Customers stand raised so the counter hides their waist, not their shoulders. */
export const FIGURE_LIFT = 14;
/** The cup drawn in an ordered customer's bubble. */
export const BUBBLE_CUP = 26;

/**
 * Sideways: the same test as `ui/responsive.ts`'s `isWideLayout`, kept here so that a scene does
 * not have to import the interface's layout module for one comparison.
 */
export function isWideLayout(width: number, height: number) {
  return width >= 560 && width > height * 1.15;
}

/**
 * The stage's height (`GameScreen.tsx`). Upright it is a share of the window; sideways it is
 * measured off the page, because a share of a short window leaves the customers crowded under the
 * ceiling with half the page bare counter below them.
 */
export function stageHeightFor(windowHeight: number, pageHeight: number, wide: boolean) {
  return wide && pageHeight > 0
    ? Math.round(Math.max(260, pageHeight * 0.58))
    : Math.round(Math.min(360, Math.max(240, windowHeight * 0.44)));
}

/**
 * Character size for a stage (`stageMetrics` in `CustomerStage.tsx`). The 108 is a phone's; a
 * wide stage sizes its figures off its own height instead, and the slot width and the stage's
 * headroom still have the last word.
 */
export function stageMetrics(width: number, height: number, slotCount: number, wide = false) {
  const slotWidth = width / slotCount;
  const cap = wide ? Math.min(170, Math.max(108, height * 0.42)) : 108;
  const charWidth = Math.min(cap, slotWidth * 0.8, (height - 76) / 1.2);
  const charHeight = charWidth * 1.2;
  const bubbleBottom = charHeight * 0.86 + FIGURE_LIFT;
  const bubbleCenterY = height - bubbleBottom - 26;
  return { slotWidth, charWidth, charHeight, bubbleBottom, bubbleCenterY };
}

export type StageMetrics = ReturnType<typeof stageMetrics>;

export interface CounterLayout {
  /** The page. */
  width: number;
  height: number;
  wide: boolean;
  /** The stage: backdrop, customers and the counter's rim, from the top of the page. */
  stageHeight: number;
  /** The counter top fills the rest of the page under the stage. */
  floorHeight: number;
  metrics: StageMetrics;
  /** Each slot's left edge and width; a slot is the whole height of the stage, and its tap target. */
  slots: { left: number; width: number; centre: number }[];
}

export function layoutCounter(width: number, height: number, windowWidth: number, windowHeight: number, slotCount: number): CounterLayout {
  const wide = isWideLayout(windowWidth, windowHeight);
  const stageHeight = stageHeightFor(windowHeight, height, wide);
  const count = Math.max(1, slotCount);
  const metrics = stageMetrics(width, stageHeight, count, wide);
  // Sideways the customers keep a slot's worth of elbow room and queue in the middle, rather than
  // standing a room apart at either end of an empty counter.
  const slotWidth = wide ? Math.min(width / count, metrics.charWidth * 1.6) : width / count;
  const start = wide ? (width - slotWidth * count) / 2 : 0;
  const slots = Array.from({ length: count }, (_, i) => {
    const left = start + i * slotWidth;
    return { left, width: slotWidth, centre: left + slotWidth / 2 };
  });
  return { width, height, wide, stageHeight, floorHeight: Math.max(0, height - stageHeight), metrics, slots };
}

/** The least room between a floating chip and the edge of the stage. */
const CHIP_MARGIN = 4;

/**
 * How far a chip of this width has to stand off its slot's centre to stay on the stage: nothing, most
 * of the time. A spot on a phone's three is about 125px wide, and what a counter has to say is not
 * always that short.
 */
export function chipShift(centre: number, width: number, stageWidth: number) {
  const overLeft = CHIP_MARGIN - (centre - width / 2);
  const overRight = centre + width / 2 - (stageWidth - CHIP_MARGIN);
  return overLeft > 0 ? overLeft : overRight > 0 ? -overRight : 0;
}

// ------------------------------------------------------------------ the bubble

/** `styles.bubble`: 2px border, 9px either side, 4px under the content, none above it. */
export const BUBBLE = { border: 2, padX: 9, padBottom: 4, radius: 14 };
/** The order pad's size, and the bubble cup's layout box (`Cup` at 26 wide with a straw). */
export const PAD_SIZE = { width: 26, height: 30 };

export function bubbleSize(content: { width: number; height: number }) {
  return {
    width: content.width + (BUBBLE.border + BUBBLE.padX) * 2,
    height: content.height + BUBBLE.border * 2 + BUBBLE.padBottom,
  };
}

/**
 * The bubble's column (`styles.bubbleWrap`), bottom-anchored at `bubbleBottom` above the stage's
 * floor: the 16×10 pointer and its 2px margin, the bubble, and the 10px tail pulled up 6px into it.
 * Returns offsets from the column's bottom edge.
 */
export function bubbleStack(bubbleHeight: number) {
  const bubbleBottom = -4;
  const bubbleTop = bubbleBottom - bubbleHeight;
  return { bubbleTop, bubbleBottom, pointerTop: bubbleTop - 12 };
}
