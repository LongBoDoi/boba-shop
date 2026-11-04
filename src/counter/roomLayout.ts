/** Measurements of the two cafe paintings; pure data so layout checks need no image loader. */
const ROOMS = {
  portrait: { width: 982, height: 1602, queueY: 1080, doorY: 439,
    register: { x: 28, y: 880, width: 188, height: 130 },
    handoff: { y: 1158, width: 96 } },
  landscape: { width: 1944, height: 809, queueY: 744, doorY: 328,
    register: { x: 287, y: 525, width: 163, height: 77 },
    handoff: { y: 662, width: 112 } },
};

export function counterRoomPlacement(width: number, height: number, wide: boolean) {
  const orientation = wide ? 'landscape' : 'portrait';
  const art = ROOMS[orientation];
  const scale = Math.max(width / art.width, height / art.height);
  const x = (width - art.width * scale) / 2;
  const y = (height - art.height * scale) / 2;
  // The doorway, both mats and queue share the painting's vertical centerline. Using the
  // viewport's center directly keeps cover-cropping symmetric and avoids independent x offsets.
  const centerX = width / 2;
  return { orientation, x, y, scale, width: art.width * scale, height: art.height * scale,
    queueY: y + art.queueY * scale, queueX: centerX,
    doorX: centerX, doorY: y + art.doorY * scale,
    register: { x: x + art.register.x * scale, y: y + art.register.y * scale,
      width: art.register.width * scale, height: art.register.height * scale },
    // The painted serving mat beside the till, where a cup carried out of the kitchen stands until
    // the register hands it over: `x` is its centre, `y` the line the cup's base rests on, and
    // `width` how wide the cup is drawn, measured off the mat so it keeps the painting's own scale.
    handoff: { x: centerX, y: y + art.handoff.y * scale, width: art.handoff.width * scale } } as const;
}
