import { uiState, Rect } from '../ui-state';
import { getGame } from './game';

/**
 * The seam between the HTML and the canvas. The UI owns the page's layout; it tells the game where
 * the pager is (the canvas is positioned over it) and which part of the pager the kitchen may draw
 * in (between the order card and the buttons). `null` hides the canvas — on the title and day-end
 * screens there is nothing for it to draw.
 */
/** Where the canvas is on the page, kept here so nothing has to read it back out of the DOM. */
let area: Rect = { x: 0, y: 0, width: 0, height: 0 };
export function gameArea(): Rect {
  return area;
}

export function setGameArea(rect: Rect | null) {
  const host = document.getElementById('game');
  if (!host) return;
  if (rect) area = rect;
  if (!rect) {
    host.style.visibility = 'hidden';
    return;
  }
  host.style.visibility = 'visible';
  host.style.left = `${rect.x}px`;
  host.style.top = `${rect.y}px`;
  host.style.width = `${rect.width}px`;
  host.style.height = `${rect.height}px`;
  // Phaser maps a touch to the canvas through bounds it measured at the last resize. Moving the
  // canvas without resizing it left every touch offset by the move — near enough for a big target,
  // a miss for the cup.
  getGame()?.scale.updateBounds();
}

/** The kitchen's part of the pager, in CSS pixels relative to the pager's top-left. */
export function setKitchenRect(rect: Rect) {
  const was = uiState.value.kitchenRect;
  if (was.x === rect.x && was.y === rect.y && was.width === rect.width && was.height === rect.height) return;
  uiState.set({ kitchenRect: rect });
}
