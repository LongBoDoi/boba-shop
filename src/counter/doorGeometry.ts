import type { CounterLayout } from './layout';

/** Inner edges of the original painted door; the surrounding wooden frame stays untouched. */
export const DOOR_ART = {
  portrait: { x: 957, y: 146, width: 253, height: 245,
    glass: { x: 14, y: 13, width: 105, height: 219 },
    handle: { x: 107, y: 122, width: 11, height: 59 },
    pawClear: { x: 65, y: 107, rx: 27, ry: 24 },
    foregroundLeft: { x: 0, y: 245 },
    paw: [[65, 114, 16, 12], [49, 104, 6, 7], [59, 95, 6, 7],
      [72, 95, 6, 7], [82, 104, 6, 7]] },
  landscape: { x: 957, y: 146, width: 253, height: 245,
    glass: { x: 14, y: 13, width: 105, height: 219 },
    handle: { x: 107, y: 122, width: 11, height: 59 },
    pawClear: { x: 65, y: 107, rx: 27, ry: 24 },
    foregroundLeft: { x: 0, y: 245 },
    paw: [[65, 114, 16, 12], [49, 104, 6, 7], [59, 95, 6, 7],
      [72, 95, 6, 7], [82, 104, 6, 7]] },
} as const;

export function doorPlacement(layout: CounterLayout) {
  const art = DOOR_ART[layout.room.orientation], s = layout.room.scale;
  const x = layout.room.x + art.x * s, y = layout.room.y + art.y * s;
  const width = art.width * s, height = art.height * s;
  return { x, y, width, height, passageX: x + width * .25, handleX: x + width * .43,
    outsideY: y + height - 18 * s, thresholdY: layout.room.doorY,
    hiddenX: x - layout.metrics.charWidth, scale: .52 };
}
