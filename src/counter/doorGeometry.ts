import type { CounterLayout } from './layout';

/** Inner edges of the original painted door; the surrounding wooden frame stays untouched. */
export const DOOR_ART = {
  portrait: { x: 326, y: 330, width: 372, height: 403,
    glass: { x: 14, y: 14, width: 161, height: 373 },
    handle: { x: 157, y: 193, width: 14, height: 84 },
    pawClear: { x: 98, y: 180, rx: 31, ry: 28 },
    foregroundLeft: { x: 65, y: 326 },
    paw: [[98, 188, 17, 13], [80, 177, 6, 8], [90, 166, 6, 8],
      [104, 166, 6, 8], [116, 177, 6, 8]] },
  landscape: { x: 833, y: 125, width: 276, height: 265,
    glass: { x: 12, y: 12, width: 118, height: 242 },
    handle: { x: 116, y: 129, width: 13, height: 62 },
    pawClear: { x: 69, y: 110, rx: 27, ry: 23 },
    foregroundLeft: { x: 0, y: 265 },
    paw: [[69, 117, 16, 12], [53, 107, 6, 7], [63, 98, 6, 7],
      [76, 98, 6, 7], [86, 107, 6, 7]] },
} as const;

export function doorPlacement(layout: CounterLayout) {
  const art = DOOR_ART[layout.room.orientation], s = layout.room.scale;
  const x = layout.room.x + art.x * s, y = layout.room.y + art.y * s;
  const width = art.width * s, height = art.height * s;
  return { x, y, width, height, passageX: x + width * .25, handleX: x + width * .43,
    outsideY: y + height - 18 * s, thresholdY: layout.room.doorY,
    hiddenX: x - layout.metrics.charWidth, scale: layout.wide ? .52 : .42 };
}
