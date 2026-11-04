/** Measurements of the two cafe paintings; pure data so layout checks need no image loader. */
const ROOMS = {
  portrait: { width: 941, height: 1672, queueY: 792, doorX: 486, doorY: 460, queueX: 470,
    register: { x: 28, y: 920, width: 204, height: 145 },
    handoff: { x: 440, y: 1200, width: 96 } },
  landscape: { width: 1942, height: 809, queueY: 530, doorX: 971, doorY: 328, queueX: 940,
    register: { x: 287, y: 525, width: 163, height: 77 },
    handoff: { x: 975, y: 662, width: 112 } },
};

export function counterRoomPlacement(width: number, height: number, wide: boolean) {
  const orientation = wide ? 'landscape' : 'portrait';
  const art = ROOMS[orientation];
  const scale = Math.max(width / art.width, height / art.height);
  const x = (width - art.width * scale) / 2;
  const y = (height - art.height * scale) / 2;
  return { orientation, x, y, scale, width: art.width * scale, height: art.height * scale,
    queueY: y + art.queueY * scale, queueX: x + art.queueX * scale,
    doorX: x + art.doorX * scale, doorY: y + art.doorY * scale,
    register: { x: x + art.register.x * scale, y: y + art.register.y * scale,
      width: art.register.width * scale, height: art.register.height * scale },
    // The painted serving mat beside the till, where a cup carried out of the kitchen stands until
    // the register hands it over: `x` is its centre, `y` the line the cup's base rests on, and
    // `width` how wide the cup is drawn, measured off the mat so it keeps the painting's own scale.
    handoff: { x: x + art.handoff.x * scale, y: y + art.handoff.y * scale, width: art.handoff.width * scale } } as const;
}
