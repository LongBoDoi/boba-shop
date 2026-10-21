/** Original counter coordinates are retained below an added band of upper wall. */
export const ORIGINAL_ROOM_SIZE = { width: 1920, height: 1080 };
export const ROOM_EXTRA_HEIGHT = 350;
export const EXTENDED_ROOM_SIZE = {
  width: ORIGINAL_ROOM_SIZE.width,
  height: ORIGINAL_ROOM_SIZE.height + ROOM_EXTRA_HEIGHT,
};

/** Preserve the first top-down tanks' apparent size when the taller room fits the viewport. */
export const ORIGINAL_TEA_WIDTH = 180;
export const EXTENDED_TEA_WIDTH = ORIGINAL_TEA_WIDTH
  * EXTENDED_ROOM_SIZE.height / ORIGINAL_ROOM_SIZE.height;
