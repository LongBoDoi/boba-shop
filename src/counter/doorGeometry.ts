import type { CounterLayout } from './layout';

/** Inner edges of the original painted door; the surrounding wooden frame stays untouched. */
export const DOOR_ART = {
  portrait: { x: 326, y: 330, width: 372, height: 403,
    columns: [[14, 160]], panes: [[14, 373]] },
  landscape: { x: 833, y: 125, width: 276, height: 265,
    columns: [[12, 112]], panes: [[12, 242]] },
} as const;

export function doorPlacement(layout: CounterLayout) {
  const art = DOOR_ART[layout.room.orientation], s = layout.room.scale;
  const x = layout.room.x + art.x * s, y = layout.room.y + art.y * s;
  const width = art.width * s, height = art.height * s;
  return { x, y, width, height, passageX: x + width * .25, handleX: x + width * .43,
    outsideY: y + height - 18 * s, thresholdY: layout.room.doorY,
    hiddenX: x - layout.metrics.charWidth, scale: layout.wide ? .52 : .42 };
}
