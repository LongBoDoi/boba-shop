/**
 * The counter's own small drawings — the ones `CustomerStage.tsx` and `FloatingText.tsx` build out
 * of styled `View`s rather than SVG, so `art/` has no string for them: the speech bubble with its
 * tail, the cup-size tag, and the feedback chip. Borders sit inside the box, as a `View` draws them.
 */
import { borderedRect, n, svgDoc } from '../art/svg';
import { colors } from '../art/theme';

export type BubbleTone = 'plain' | 'selected' | 'ask';

/** `styles.bubble` / `bubbleSelected` / `bubbleAsk`, and the tail's matching border. */
export const BUBBLE_TONE: Record<BubbleTone, { fill: string; border: string }> = {
  plain: { fill: '#FFFFFF', border: colors.line },
  selected: { fill: '#FFFFFF', border: colors.primary },
  ask: { fill: '#FFFDF2', border: colors.gold },
};

/**
 * How far the tail hangs below the bubble. The tail is a 10×10 white square with a right and a
 * bottom border, pulled up 6px into the bubble and turned 45°: its centre is 1px above the
 * bubble's bottom edge and its point a half-diagonal under that.
 */
export const TAIL_DROP = 7;

/** The bubble (`width`×`height`) with its tail, in a `width`×`height + TAIL_DROP` drawing. */
export function bubbleSvg(width: number, height: number, tone: BubbleTone): string {
  const { fill, border } = BUBBLE_TONE[tone];
  const cx = width / 2;
  const cy = height - 1;
  const tail =
    `<g transform="rotate(45 ${n(cx)} ${n(cy)})">` +
    `<rect x="${n(cx - 5)}" y="${n(cy - 5)}" width="10" height="10" fill="#FFFFFF"/>` +
    `<rect x="${n(cx + 3)}" y="${n(cy - 5)}" width="2" height="10" fill="${border}"/>` +
    `<rect x="${n(cx - 5)}" y="${n(cy + 3)}" width="10" height="2" fill="${border}"/>` +
    '</g>';
  return svgDoc(width, height + TAIL_DROP, borderedRect(0, 0, width, height, 14, fill, 2, border) + tail);
}

/**
 * `styles.orderSize`: the S / M / L tag on the bubble's cup. `minWidth: 19` always wins for one
 * letter; the height is Baloo 2's line at 12px (1.6em) and the 1px border.
 */
export const SIZE_TAG = { width: 19, height: 21 };

export function sizeTagSvg(): string {
  return svgDoc(SIZE_TAG.width, SIZE_TAG.height,
    borderedRect(0, 0, SIZE_TAG.width, SIZE_TAG.height, 5, '#FFF4DC', 1, '#C99F6A'));
}

/** `FloatingText`'s chip: white, 12px corners, a 2px border in the message's tone. 25 tall for one line. */
export const CHIP_HEIGHT = 25;

export function chipSvg(width: number, color: string, height: number): string {
  return svgDoc(width, height, borderedRect(0, 0, width, height, 12, '#FFFFFF', 2, color));
}
