import type { CounterLayout } from './layout';

/** Inner edges of the original painted door; the surrounding wooden frame stays untouched. */
export const DOOR_ART = {
  portrait: { x: 369, y: 197, width: 244, height: 308,
    columns: [[16, 42], [64, 43]], panes: [[15, 62], [83, 111], [200, 82]] },
  landscape: { x: 850, y: 112, width: 245, height: 213,
    columns: [[14, 40], [61, 43]], panes: [[14, 38], [59, 43], [107, 38], [151, 45]] },
} as const;

export function doorPlacement(layout: CounterLayout) {
  const art = DOOR_ART[layout.room.orientation], s = layout.room.scale;
  const x = layout.room.x + art.x * s, y = layout.room.y + art.y * s;
  const width = art.width * s, height = art.height * s;
  return { x, y, width, height, passageX: x + width * .25, handleX: x + width * .43,
    outsideY: y + height - 18 * s, thresholdY: layout.room.doorY,
    hiddenX: x - layout.metrics.charWidth, scale: layout.wide ? .52 : .42 };
}
