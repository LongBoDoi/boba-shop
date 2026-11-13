/** Silhouettes of the raised counter painting, in source-image pixels. */
import { counterRoomPlacement } from './roomLayout';

type Point = readonly [number, number];
/** Measured silhouettes of the cream cafe panorama, including props above the rear table edge. */
export const COUNTER_FOREGROUND: Record<'portrait' | 'landscape', readonly (readonly Point[])[]> = {
  portrait: [
    [[0, 476], [2172, 476], [2172, 724], [0, 724]],
    [[296, 476], [296, 406], [304, 382], [324, 363], [446, 363],
      [472, 383], [495, 414], [495, 476]],
    [[510, 476], [518, 507], [576, 507], [589, 476]],
    [[1370, 476], [1386, 412], [1413, 376], [1445, 355], [1688, 355],
      [1722, 372], [1752, 421], [1764, 476]],
  ],
  landscape: [
    [[0, 476], [2172, 476], [2172, 724], [0, 724]],
    [[296, 476], [296, 406], [304, 382], [324, 363], [446, 363],
      [472, 383], [495, 414], [495, 476]],
    [[510, 476], [518, 507], [576, 507], [589, 476]],
    [[1370, 476], [1386, 412], [1413, 376], [1445, 355], [1688, 355],
      [1722, 372], [1752, 421], [1764, 476]],
  ],
};

/** Shared by rendering and hit testing: props on the counter cannot act as customers. */
export function behindCounterForeground(room: ReturnType<typeof counterRoomPlacement>, x: number, y: number) {
  if (y >= room.counterY) return true;
  const px = (x - room.x) / room.scale, py = (y - room.y) / room.scale;
  return COUNTER_FOREGROUND[room.orientation].some(polygon => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[j];
      if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  });
}
