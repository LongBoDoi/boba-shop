import unifiedRoom from '../assets/kitchen/kitchen-unified.png';

/** One continuous painting includes every stationary ingredient, container and its shadow. */
export const KITCHEN_ROOM_RENDER = unifiedRoom;
export const KITCHEN_ROOM_ART = { width: 1453, height: 1083 };
/** Logical footprints retained for aligning the dairy touch targets with the painted boards. */
export const KITCHEN_BOARDS = [
  { x: 440, y: 760, width: 420, height: 206 },
  { x: 882, y: 760, width: 366, height: 206 },
];
/** The ice/sugar interaction anchors retain their raised position in the unified painting. */
export const KITCHEN_ROOM_TRAY_RAISE = 160;
