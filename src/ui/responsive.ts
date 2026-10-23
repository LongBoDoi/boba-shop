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

export function isWideLayout(width: number, height: number) {
  return width >= 760 && width > height * 1.15;
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
