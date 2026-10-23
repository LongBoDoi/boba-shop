import alignedTraysRoom from '../assets/kitchen/kitchen-room-aligned-trays.png';
import originalRoom from '../assets/kitchen/kitchen-room-counter-cups.png';
import originalCounter from '../assets/kitchen/kitchen-overhead.png';
import clearIceCounter from '../assets/kitchen/kitchen-room-clear-ice.png';
import clearBoardsCounter from '../assets/kitchen/kitchen-counter-clear-boards.png';
import overheadDairy from '../assets/kitchen/dairy-boards-overhead.png';

/** Preserve the room before the repeated whole-image edits softened its details. */
export const KITCHEN_ROOM_RENDER = originalRoom;
export const KITCHEN_ROOM_ART = { width: 1452, height: 1083 };
/** Untouched first design: native-resolution counter, including both wooden boards. */
export const KITCHEN_ORIGINAL_COUNTER = originalCounter;
export const KITCHEN_ORIGINAL_COUNTER_ART = { width: 1672, height: 941, top: 343 };
export const KITCHEN_CLEAR_BOARDS = clearBoardsCounter;
export const KITCHEN_CLEAR_BOARDS_PATCH = { x: 0, y: 340, width: 1228, height: 250 };
/** Logical room coordinates. Both boards clear the raised ice/sugar rims. */
export const KITCHEN_BOARD_ART = overheadDairy;
export const KITCHEN_BOARD_ATLAS = { width: 1254, height: 1254 };
export const KITCHEN_BOARDS = [
  { source: { x: 25, y: 1006, width: 619, height: 213 }, x: 440, y: 800, width: 420, height: 420 * 213 / 619 },
  { source: { x: 682, y: 1006, width: 541, height: 213 }, x: 882, y: 800, width: 366, height: 366 * 213 / 541 },
];
/** Only this small edited region supplies the aligned ice/sugar trays. Everything else is original. */
export const KITCHEN_ROOM_TRAYS = alignedTraysRoom;
export const KITCHEN_ROOM_TRAY_PATCH = { x: 16, y: 734, width: 222, height: 298, feather: 6 };
export const KITCHEN_ROOM_TRAY_CELLS = [
  { x: 30, y: 740, width: 201, height: 139 },
  { x: 30, y: 884, width: 201, height: 140 },
];
/** Move the unchanged tray artwork and its interaction anchors up by the same source pixels. */
export const KITCHEN_ROOM_TRAY_RAISE = 160;
export const KITCHEN_ROOM_CLEAR_ICE = clearIceCounter;
export const KITCHEN_ROOM_CLEAR_ICE_PATCH = { x: 0, y: 738, width: 258, height: 178, feather: 16, topFeather: 2 };
