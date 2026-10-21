import alignedTraysRoom from '../assets/kitchen/kitchen-room-aligned-trays.png';
import originalRoom from '../assets/kitchen/kitchen-room-counter-cups.png';

/** Preserve the room before the repeated whole-image edits softened its details. */
export const KITCHEN_ROOM_RENDER = originalRoom;
export const KITCHEN_ROOM_ART = { width: 1452, height: 1083 };
/** Only this small edited region supplies the aligned ice/sugar trays. Everything else is original. */
export const KITCHEN_ROOM_TRAYS = alignedTraysRoom;
export const KITCHEN_ROOM_TRAY_PATCH = { x: 16, y: 734, width: 222, height: 298 };
