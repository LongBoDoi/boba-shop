/** Silhouettes of the existing counter painting, in source-image pixels. No replacement artwork. */
import { counterRoomPlacement } from './roomLayout';

type Point = readonly [number, number];
export const COUNTER_FOREGROUND: Record<'portrait' | 'landscape', readonly (readonly Point[])[]> = {
  portrait: [
    // Tabletop and cabinetry; the customer stands on the far side of this edge.
    [[0, 1080], [982, 1080], [982, 1602], [0, 1602]],
    // Menu stand, register, pen cup, receipt holder and drinks rising above the tabletop.
    [[402, 809], [581, 809], [586, 1038], [595, 1067], [387, 1067], [387, 1042], [401, 1042]],
    [[70, 805], [191, 805], [192, 842], [242, 844], [239, 1047], [304, 1047], [304, 1080], [0, 1080], [0, 844], [69, 842]],
    [[304, 938], [361, 938], [372, 982], [372, 1080], [302, 1080]],
    [[609, 986], [655, 986], [667, 1025], [667, 1080], [599, 1080], [599, 1025]],
    [[733, 927], [746, 927], [747, 960], [772, 960], [791, 985], [812, 960], [822, 928], [832, 929], [831, 960], [855, 965], [870, 985], [891, 960], [902, 929], [911, 931], [910, 961], [938, 980], [953, 1080], [674, 1080], [691, 980], [720, 962]],
  ],
  landscape: [
    [[0, 623], [1944, 623], [1944, 809], [0, 809]],
    [[1370, 470], [1533, 470], [1539, 623], [1365, 623]],
    [[327, 460], [424, 460], [424, 486], [466, 489], [471, 623], [268, 623], [279, 489], [325, 489]],
    [[570, 538], [623, 538], [632, 623], [563, 623]],
    [[648, 572], [683, 572], [700, 592], [700, 623], [638, 623]],
    [[1635, 511], [1645, 514], [1638, 540], [1660, 551], [1682, 535], [1721, 511], [1731, 514], [1724, 540], [1748, 553], [1766, 538], [1808, 512], [1818, 515], [1810, 543], [1834, 565], [1848, 623], [1558, 623], [1585, 554], [1627, 540]],
  ],
};

/** Shared by rendering and hit testing: props on the counter cannot act as customers. */
export function behindCounterForeground(room: ReturnType<typeof counterRoomPlacement>, x: number, y: number) {
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
