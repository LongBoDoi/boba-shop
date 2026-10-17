/**
 * The one place that decides the shop is being played sideways.
 *
 * Portrait is the shape the game is drawn for: the HUD, the tabs, the order panel and the action
 * buttons stack down the screen and the kitchen takes what is left. Turn a tablet on its side and
 * that stack eats the room — the kitchen band is left shorter than it is wide, and because the
 * painting is drawn `cover` (see `fitBackground`), a band that wide crops the plate top and
 * bottom: the dispensers lose their lids and the work top, the cup's coaster with it, falls off
 * the bottom edge. The height has to come from somewhere, and sideways there is width to spare.
 *
 * There are two ways to spend that width, and `prepLayoutFor` picks between them by measuring the
 * room rather than by naming devices: stand the buttons *next to* the order so that both fit in
 * one band across the top, or stand the whole lot *beside* the kitchen in a column. The band is
 * preferred — it is where the order has always been — and the column is what is left when even
 * one band is more height than the painting can spare.
 *
 * The threshold is deliberately not "is it a tablet": a phone held sideways has the same problem.
 */
import { ORDER_BAND_HEIGHT } from './components/OrderBubble';
import { ROOM_BG_KEEP, ROOM_BG_REACH, ROOM_BG_SIZE } from './components/art/kitchenArt';

export function isWideLayout(width: number, height: number) {
  return width >= 760 && width > height * 1.15;
}

/**
 * How wide that side column is. Wide enough for a full order's tiles to wrap into a couple of
 * rows, and capped so a very wide window spends its extra pixels on the kitchen rather than on a
 * card with nothing more to say.
 *
 * What is left over is the kitchen's, and the room's own plate is 1.5 times as wide as it is
 * tall: while the kitchen stays narrower than that it keeps the whole painting, top to bottom.
 */
export function panelWidthFor(width: number) {
  return Math.round(Math.min(420, Math.max(280, width * 0.3)));
}

/**
 * The widest the kitchen may be, as a multiple of its own height, before the painting starts
 * losing the band it cannot do without. Read off the plate itself — see `ROOM_BG_KEEP`.
 */
export const ROOM_KEEP_ASPECT = ROOM_BG_SIZE.width / (ROOM_BG_KEEP.bottom - ROOM_BG_KEEP.top);

/**
 * The widest the kitchen may be before the room stops being *workable* — the softer of the two
 * lines, measured off `ROOM_BG_REACH`. Past this one the tanks lose their name tags.
 */
export const ROOM_REACH_ASPECT = ROOM_BG_SIZE.width / (ROOM_BG_REACH.bottom - ROOM_BG_REACH.top);

/**
 * What the sideways chrome costs the room: the order card's height plus the air and the rule
 * around it, and the button bar plus its own. Every pixel of both comes off the kitchen, so they
 * are counted exactly — two pixels of border unaccounted for is a tank lid clipped.
 */
export const PREP_BAND_HEIGHT = ORDER_BAND_HEIGHT + 7 + 8 + 2;
export const PREP_ACTIONS_HEIGHT = 48 + 6 + 6 + 2;

/** How the prep page arranges itself: see each branch of `PrepPage` for what they look like. */
export type PrepLayout = 'stacked' | 'band' | 'column';

/**
 * Where the order and the buttons go.
 *
 * Upright they stack above and below the kitchen (`stacked`), which is what the game is drawn
 * for. Sideways they would leave the kitchen a band wider than the painting can be cropped to,
 * so there are two answers and the room decides between them:
 *
 * - **`band`** is the upright arrangement, compacted: the order across the top where it has
 *   always been, the buttons along the bottom where they have always been, and the kitchen
 *   between them with the full width to itself.
 * - **`column`** stands the order and the buttons beside the kitchen instead, which costs width
 *   rather than height. This is what a phone on its side gets — there, the two bands leave the
 *   room a strip a couple of hundred pixels tall, which is no room at all.
 *
 * **`band` is measured against `ROOM_REACH_ASPECT`, not `ROOM_KEEP_ASPECT`**, and that is the
 * trade this layout is. Keeping both bands costs about 180px of a sideways screen, and on every
 * tablet but the largest that is more height than the painting can give up whole — so above a
 * 12.9" iPad nothing is lost, and below it the tanks are cropped to the top of their name tags
 * and the cup's mat to the front of where the cup stands. The alternative was the column, and
 * the order and the buttons belong where the player already knows to look for them.
 *
 * `pageHeight` is the pager's measured height — what is left under the HUD and the tabs — and is
 * 0 until it has been measured. The prep page is off-screen behind the counter until it is swiped
 * to, so the one render that happens before then is never seen.
 */
export function prepLayoutFor(width: number, height: number, pageHeight: number): PrepLayout {
  if (!isWideLayout(width, height)) return 'stacked';
  const kitchen = pageHeight - PREP_BAND_HEIGHT - PREP_ACTIONS_HEIGHT;
  return kitchen > 0 && width / kitchen <= ROOM_REACH_ASPECT ? 'band' : 'column';
}
