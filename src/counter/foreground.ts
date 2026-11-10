/** Silhouettes of the raised counter painting, in source-image pixels. */
import { counterRoomPlacement } from './roomLayout';

type Point = readonly [number, number];
/** Measured silhouettes of the peach cafe plates, including props above the rear table edge. */
export const COUNTER_FOREGROUND: Record<'portrait' | 'landscape', readonly (readonly Point[])[]> = {
  portrait: [
    [[0, 1121], [1024, 1121], [1024, 1536], [0, 1536]],
    // Cat-ear register and the covered cookie box; lower stands are already under the table mask.
    [[65, 1098], [69, 1041], [81, 995], [94, 972], [111, 975], [144, 999],
      [190, 999], [225, 973], [243, 975], [259, 1002], [268, 1060], [265, 1121], [65, 1121]],
    [[299, 1121], [302, 1082], [309, 1060], [324, 1047], [345, 1040],
      [385, 1040], [406, 1046], [420, 1061], [430, 1084], [432, 1121]],
    // Curved pastry-case top. Follow its arc so original floor does not hide a moving customer.
    [[698, 1121], [703, 1068], [714, 1021], [731, 982], [751, 964], [774, 959],
      [906, 959], [932, 968], [952, 990], [965, 1031], [972, 1075], [975, 1121]],
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
