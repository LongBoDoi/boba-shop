/**
 * The one place that decides the shop is being played sideways — `src/responsive.ts`, ported.
 *
 * Portrait is the shape the game is drawn for: the HUD, the tabs, the order panel and the action
 * buttons stack down the screen and the kitchen takes what is left. Sideways the kitchen band
 * would come out wider than the painting can be cropped to, so the prep page either compacts that
 * arrangement (`band`) or stands the order and the buttons beside the kitchen (`column`). See
 * "Turning it on its side" in CLAUDE.md.
 */
import { ROOM_BG_FOCUS_Y, ROOM_BG_KEEP, ROOM_BG_SIZE } from '../art/kitchenArt';

/** The order card's fixed height upright (`ORDER_PANEL_HEIGHT` in `OrderBubble.tsx`). */
export const ORDER_PANEL_HEIGHT = 132;
/** …and laid across the top of a landscape screen, where the tiles move up beside the name. */
export const ORDER_BAND_HEIGHT = 100;

/** The order card's padding, and the room its progress bar takes with the air around it. */
export const ORDER_CARD_PAD = 10;
export const ORDER_TRACK_HEIGHT = 18;

/** Hỏi lại where it stands in for a row of tiles, and the least it can be read and pressed at. */
export const ASK_HEIGHT = 44;
export const ASK_MIN_HEIGHT = 28;
/** A short card's padding above and below, and the air between its head and the button. */
export const SHORT_CARD = { top: 6, gap: 4, bottom: 4 };

/**
 * How tall Hỏi lại stands in a side column too short for it, or null where it fits. `tileRoom` is
 * what the card has left for its tiles. A tile can shrink and a clipped one costs a look, but this
 * button is the one thing on a hidden card to press. So what the card can do without goes first: the
 * progress bar, which is empty on this card, then most of the padding, then the button's own height.
 */
export function askHeightFor(tileRoom: number): number | null {
  if (tileRoom >= ASK_HEIGHT) return null;
  const given = ORDER_TRACK_HEIGHT + ORDER_CARD_PAD * 2 - SHORT_CARD.top - SHORT_CARD.gap - SHORT_CARD.bottom;
  return Math.min(ASK_HEIGHT, Math.max(ASK_MIN_HEIGHT, tileRoom + given));
}

/**
 * The narrowest window that counts as sideways: just under the shortest phone there is on its side,
 * which is 568. It was 760, and a phone narrower than that (667, 736, 740) was laid out upright, with
 * the order card and the buttons stacked into its height. That left the room 17 to 111px tall, with
 * the tanks above the top of it and the cup's mat below the bottom.
 */
export const SIDEWAYS_MIN_WIDTH = 560;

export function isWideLayout(width: number, height: number) {
  return width >= SIDEWAYS_MIN_WIDTH && width > height * 1.15;
}

/**
 * How wide the room may be against its own height before the painting is cropped through a band.
 *
 * `fitBackground` centers the active working band. Measure each required band around that same
 * focus so the taller shelf and the foreground mats stay in view together.
 */
function roomAspect(band: { top: number; bottom: number }) {
  const middle = ROOM_BG_FOCUS_Y;
  return ROOM_BG_SIZE.width / (2 * Math.max(middle - band.top, band.bottom - middle));
}

export const ROOM_KEEP_ASPECT = roomAspect(ROOM_BG_KEEP);

/**
 * How wide the side column is in the `column` layout: **as narrow as the card can be read at**,
 * because every pixel of it is a pixel of room.
 *
 * The overhead worktop needs its full vertical band, including the foreground mats.
 * The card can grow up to half
 * of the screen to preserve it; windows beyond that limit still retain the reachable band.
 */
export function panelWidthFor(width: number, height = 0) {
  const card = Math.min(340, Math.max(248, width * 0.24));
  const workable = height > 0 ? width - height * ROOM_KEEP_ASPECT : 0;
  return Math.ceil(Math.max(card, Math.min(workable, width * 0.5)));
}

/**
 * What the sideways chrome costs the room, counted exactly: the card plus the air and the rule
 * around it, and the button bar plus its own.
 */
export const PREP_BAND_HEIGHT = ORDER_BAND_HEIGHT + 7 + 8 + 2;
export const PREP_ACTIONS_HEIGHT = 48 + 6 + 6 + 2;

export type PrepLayout = 'stacked' | 'band' | 'column';

/** The gap between the overtime dock and the edge it stands against. */
const DOCK_GUTTER = 6;

/**
 * How far the overtime dock stands from the pager's right edge. In the column that is the width of
 * the column and then some: the column has no space of its own to lend, because `fitTiles` grows the
 * card into all of it, and a pill over the order hides what the customer asked for.
 */
export function overtimeDockRight(layout: PrepLayout, width: number, height: number) {
  return (layout === 'column' ? panelWidthFor(width, height) : 0) + DOCK_GUTTER;
}

/**
 * Where the order and the buttons go. `pageHeight` is the pager's measured height (0 until
 * measured).
 *
 * **The band is only worth having while the room under it is still whole.** Two bands cost about
 * 180px of height, and what a room that short loses is taken off the top and the bottom of the
 * painting at once — the crowns of the tea tanks and the front of the cup's mat. A tablet has the
 * height to spare and keeps the arrangement the game is drawn for; a short landscape window does
 * not, and there the order stands beside the room instead, where it costs width the wall can pan
 * back and no height at all.
 */
export function prepLayoutFor(width: number, height: number, pageHeight: number): PrepLayout {
  if (!isWideLayout(width, height)) return 'stacked';
  const kitchen = pageHeight - PREP_BAND_HEIGHT - PREP_ACTIONS_HEIGHT;
  return kitchen > 0 && width / kitchen <= ROOM_KEEP_ASPECT ? 'band' : 'column';
}
