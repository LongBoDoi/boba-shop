/**
 * The one place that decides the shop is being played sideways — `src/responsive.ts`, ported.
 *
 * Portrait is the shape the game is drawn for: the HUD, the tabs, the order panel and the action
 * buttons stack down the screen and the kitchen takes what is left. Sideways the kitchen band
 * would come out wider than the painting can be cropped to, so the prep page either compacts that
 * arrangement (`band`) or stands the order and the buttons beside the kitchen (`column`). See
 * "Turning it on its side" in CLAUDE.md. The numbers are the original's; only the import of the
 * order card's heights moved, because that module is React Native.
 */
import { ROOM_BG_KEEP, ROOM_BG_REACH, ROOM_BG_SIZE } from '../../../src/components/art/kitchenArt';

/** The order card's fixed height upright (`ORDER_PANEL_HEIGHT` in `OrderBubble.tsx`). */
export const ORDER_PANEL_HEIGHT = 132;
/** …and laid across the top of a landscape screen, where the tiles move up beside the name. */
export const ORDER_BAND_HEIGHT = 100;

export function isWideLayout(width: number, height: number) {
  return width >= 760 && width > height * 1.15;
}

/** How wide the side column is in the `column` layout. */
export function panelWidthFor(width: number) {
  return Math.round(Math.min(420, Math.max(280, width * 0.3)));
}

export const ROOM_KEEP_ASPECT = ROOM_BG_SIZE.width / (ROOM_BG_KEEP.bottom - ROOM_BG_KEEP.top);
export const ROOM_REACH_ASPECT = ROOM_BG_SIZE.width / (ROOM_BG_REACH.bottom - ROOM_BG_REACH.top);

/**
 * What the sideways chrome costs the room, counted exactly: the card plus the air and the rule
 * around it, and the button bar plus its own.
 */
export const PREP_BAND_HEIGHT = ORDER_BAND_HEIGHT + 7 + 8 + 2;
export const PREP_ACTIONS_HEIGHT = 48 + 6 + 6 + 2;

export type PrepLayout = 'stacked' | 'band' | 'column';

/** Where the order and the buttons go. `pageHeight` is the pager's measured height (0 until measured). */
export function prepLayoutFor(width: number, height: number, pageHeight: number): PrepLayout {
  if (!isWideLayout(width, height)) return 'stacked';
  const kitchen = pageHeight - PREP_BAND_HEIGHT - PREP_ACTIONS_HEIGHT;
  return kitchen > 0 && width / kitchen <= ROOM_REACH_ASPECT ? 'band' : 'column';
}
