/** Silhouettes of the raised counter painting, in source-image pixels. */
import { counterRoomPlacement } from './roomLayout';

type Point = readonly [number, number];
/** Gold queue barriers must cover cats passing behind them on the way to the door. */
export const AISLE_FOREGROUND: Record<'portrait' | 'landscape', readonly string[]> = {
  portrait: [
    'M301 588C280 588 280 616 292 620V724C265 725 268 748 299 750C333 752 343 727 313 723V620C327 608 318 588 301 588Z',
    'M357 520C340 520 341 541 348 546V654C324 656 326 674 355 676C387 676 394 656 368 653V546C377 537 373 520 357 520Z',
    'M314 615Q336 589 348 549L355 552Q341 604 315 628Z',
    'M683 588C662 588 662 616 674 620V724C647 725 650 748 681 750C715 752 725 727 695 723V620C709 608 700 588 683 588Z',
    'M627 520C610 520 611 541 618 546V654C594 656 596 674 625 676C657 676 664 656 638 653V546C647 537 643 520 627 520Z',
    'M670 615Q648 589 636 549L629 552Q643 604 669 628Z',
  ],
  landscape: [
    'M548 311C531 311 530 331 538 337V397C512 399 513 414 548 414C582 414 586 399 560 397V337C570 325 563 311 548 311Z',
    'M737 311C720 311 719 331 727 337V397C701 399 702 414 737 414C771 414 775 399 749 397V337C759 325 752 311 737 311Z',
    'M560 338Q641 401 720 338L727 346Q643 415 555 346Z',
    'M1208 311C1191 311 1190 331 1198 337V397C1172 399 1173 414 1208 414C1242 414 1246 399 1220 397V337C1230 325 1223 311 1208 311Z',
    'M1397 311C1380 311 1379 331 1387 337V397C1361 399 1362 414 1397 414C1431 414 1435 399 1409 397V337C1419 325 1412 311 1397 311Z',
    'M1220 338Q1301 401 1380 338L1387 346Q1303 415 1215 346Z',
  ],
};

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
