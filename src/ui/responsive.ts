/**
 * The one place that decides the shop is being played sideways — `src/responsive.ts`, ported.
 *
 * Portrait is the shape the game is drawn for: the HUD, the tabs, the order panel and the action
 * buttons stack down the screen and the kitchen takes what is left. Sideways the kitchen band
 * would come out wider than the painting can be cropped to, so the prep page either compacts that
 * arrangement (`band`) or stands the order and the buttons beside the kitchen (`column`). See
 * "Turning it on its side" in CLAUDE.md.
 */
import { ROOM_BG_KEEP, ROOM_BG_REACH, ROOM_BG_SIZE } from '../art/kitchenArt';

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
 * `fitBackground` covers the box with the plate centred **on itself**, and neither band is centred
 * there — the shelf has more painting above it than the work top has below. So what a short room
 * can hold is twice the band's farther edge from the middle of the plate, not the band's own
 * height: measured the other way, a room exactly at the limit still loses the front of the cup's
 * mat.
 */
function roomAspect(band: { top: number; bottom: number }) {
  const middle = ROOM_BG_SIZE.height / 2;
  return ROOM_BG_SIZE.width / (2 * Math.max(middle - band.top, band.bottom - middle));
}

export const ROOM_KEEP_ASPECT = roomAspect(ROOM_BG_KEEP);
export const ROOM_REACH_ASPECT = roomAspect(ROOM_BG_REACH);

/**
 * How wide the side column is in the `column` layout: **as narrow as the card can be read at**,
 * because every pixel of it is a pixel of room.
 *
 * The card shrinks to fit whatever it is given — its tiles are sized from the width it has
 * (`fitTiles`) and its two lines of text ellipsise — so the floor here is reading comfort and
 * nothing else. The one thing that can push it back out is the room itself: if a room this wide
 * would be squatter than its *workable* band (`ROOM_REACH_ASPECT`, the tanks' name tags down to
 * the line the cup stands on) the painting is cropped through the part of it the shift needs, and
 * taking the width off the room is what buys that band back. It never takes more than two fifths
 * of the screen doing it — past that the cure is worse.
 */
export function panelWidthFor(width: number, height = 0) {
  const card = Math.min(340, Math.max(248, width * 0.24));
  const workable = height > 0 ? width - height * ROOM_REACH_ASPECT : 0;
  return Math.round(Math.max(card, Math.min(workable, width * 0.4)));
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
