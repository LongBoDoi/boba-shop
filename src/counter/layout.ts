/**
 * Customers, bubbles and register measured against the cafe painting.
 * All positions are CSS pixels from the page's top-left.
 */

import { counterRoomPlacement } from './roomLayout';
/** Space below the figures' feet within the logical customer stage. */
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

/** Standing figures leave headroom for their order bubbles, even on short phones. */
export function stageMetrics(width: number, height: number, slotCount: number, wide = false) {
  const slotWidth = width / slotCount;
  const cap = wide ? 112 : 92;
  const charWidth = Math.min(cap, slotWidth * 0.78, Math.max(40, (height - 94) / 1.76));
  const charHeight = charWidth * 1.76;
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
  /** Logical customer stage ending just below the queue mat. */
  stageHeight: number;
  /** Foreground room below the customers. */
  floorHeight: number;
  room: ReturnType<typeof counterRoomPlacement>;
  metrics: StageMetrics;
  /** Each customer's horizontal tap range. Stage.slotAt limits it to figure/bubble height. */
  slots: { left: number; width: number; centre: number }[];
}

export function layoutCounter(width: number, height: number, windowWidth: number, windowHeight: number, slotCount: number): CounterLayout {
  const wide = isWideLayout(windowWidth, windowHeight);
  const room = counterRoomPlacement(width, height, wide);
  const stageHeight = room.queueY + FIGURE_LIFT;
  const count = Math.max(1, slotCount);
  const queueWidth = Math.min(width * 0.74, wide ? 300 : 230);
  const metrics = stageMetrics(queueWidth, stageHeight, 1, wide);
  // Scale the standing figure with the painted room; never stretch it with queue length.
  metrics.charWidth = Math.min(wide ? 96 : 90, (wide ? 186 : 178) * room.scale);
  metrics.charHeight = metrics.charWidth * 1.76;
  metrics.bubbleBottom = metrics.charHeight * 0.86 + FIGURE_LIFT;
  metrics.bubbleCenterY = stageHeight - metrics.bubbleBottom - 26;
  const slots = Array.from({ length: count }, () => ({
    left: room.queueX - queueWidth / 2, width: queueWidth, centre: room.queueX,
  }));
  return { width, height, wide, stageHeight, floorHeight: Math.max(0, height - stageHeight), room, metrics, slots };
}

/** Feet follow the same straight aisle; perspective compresses each successive place. */
export function queuePosition(layout: CounterLayout, rank: number) {
  const distance = Math.pow(0.63, rank);
  const scale = 0.43 + 0.57 * distance;
  const { room } = layout;
  return { x: room.doorX + (room.queueX - room.doorX) * distance,
    feet: room.doorY + (room.queueY - room.doorY) * distance, scale };
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
