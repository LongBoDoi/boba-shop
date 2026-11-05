/** Silhouettes of the raised counter painting, in source-image pixels. */
import { counterRoomPlacement } from './roomLayout';

type Point = readonly [number, number];
export const COUNTER_FOREGROUND: Record<'portrait' | 'landscape', readonly (readonly Point[])[]> = {
  portrait: [
    // Raised tabletop; all silhouettes are measured from cafe-cats-raised-portrait.png.
    [[0, 844], [982, 844], [982, 1602], [0, 1602]],
    [[542, 750], [685, 750], [688, 844], [541, 844]],
    [[88, 754], [177, 754], [178, 783], [210, 786], [213, 844], [52, 844], [59, 786], [88, 783]],
    [[291, 824], [305, 824], [307, 844], [291, 844]],
    [[322, 824], [333, 824], [330, 844], [317, 844]],
    [[762, 813], [774, 815], [769, 839], [784, 844], [746, 844]],
    [[827, 814], [838, 816], [833, 840], [846, 844], [812, 844]],
    [[890, 814], [901, 816], [897, 841], [911, 844], [877, 844]],
  ],
  landscape: [
    [[0, 412], [1945, 412], [1945, 809], [0, 809]],
    [[1371, 357], [1536, 357], [1538, 412], [1368, 412]],
    [[312, 351], [401, 351], [402, 376], [443, 378], [445, 412], [267, 412], [273, 378], [312, 376]],
    [[1629, 390], [1641, 392], [1636, 412], [1624, 412]],
    [[1704, 390], [1717, 392], [1712, 412], [1699, 412]],
    [[1771, 391], [1783, 393], [1779, 412], [1767, 412]],
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
