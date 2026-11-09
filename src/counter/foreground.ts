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
    [[0, 494], [1942, 494], [1942, 809], [0, 809]],
    [[113, 494], [114, 441], [119, 430], [124, 426], [125, 407], [136, 388],
      [150, 380], [165, 381], [190, 399], [207, 416], [261, 416], [279, 396],
      [299, 382], [315, 381], [331, 391], [342, 414], [347, 431], [358, 441], [362, 494]],
    [[471, 494], [478, 475], [493, 460], [517, 452], [605, 452], [628, 460], [646, 478], [651, 494]],
    [[1389, 494], [1406, 447], [1426, 405], [1451, 381], [1482, 371],
      [1783, 371], [1814, 383], [1837, 409], [1855, 451], [1864, 494]],
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
