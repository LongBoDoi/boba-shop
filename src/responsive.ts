/**
 * The one place that decides the shop is being played sideways.
 *
 * Portrait is the shape the game is drawn for: the HUD, the tabs, the order panel and the action
 * buttons stack down the screen and the kitchen takes what is left. Turn a tablet on its side and
 * that stack eats the room — the kitchen band is left shorter than it is wide, and because the
 * painting is drawn `cover` (see `fitBackground`), a band that wide crops the plate top and
 * bottom: the dispensers lose their lids and the work top, the cup's coaster with it, falls off
 * the bottom edge. The height has to come from somewhere, and sideways there is width to spare,
 * so the order panel and the buttons stand *beside* the kitchen instead of above and below it.
 *
 * The threshold is deliberately not "is it a tablet": a phone held sideways has the same problem
 * and the same cure.
 */
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
