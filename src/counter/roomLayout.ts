/** Measurements of the two cafe paintings; pure data so layout checks need no image loader. */
const ROOMS = {
  portrait: { width: 982, height: 1602, counterY: 844, queueY: 950, doorY: 505,
    register: { x: 69, y: 800, width: 130, height: 97 },
    handoff: { y: 984, width: 100 } },
  landscape: { width: 1945, height: 809, counterY: 412, queueY: 520, doorY: 325,
    register: { x: 282, y: 390, width: 148, height: 85 },
    handoff: { y: 542, width: 112 } },
};

export function counterRoomPlacement(width: number, height: number, wide: boolean) {
  const orientation = wide ? 'landscape' : 'portrait';
  const art = ROOMS[orientation];
  // Fit the entire width: tall phones must not crop the register or the drinks at the sides.
  // Anchor the table near halfway down; only surplus ceiling is cropped on shorter displays.
  // Tall displays continue the plain lower cabinet instead of zooming into the whole room.
  const scale = width / art.width;
  const x = 0;
  const y = Math.min(0, height * 0.5 - art.counterY * scale);
  // The doorway, both mats and queue share the painting's vertical centerline. Using the
  // viewport's center directly avoids independent x offsets.
  const centerX = width / 2;
  return { orientation, x, y, scale, width, height: art.height * scale,
    counterY: y + art.counterY * scale,
    cabinetExtension: Math.max(0, height - (y + art.height * scale)),
    queueY: y + art.queueY * scale, queueX: centerX,
    doorX: centerX, doorY: y + art.doorY * scale,
    register: { x: x + art.register.x * scale, y: y + art.register.y * scale,
      width: art.register.width * scale, height: art.register.height * scale },
    // The painted serving mat beside the till, where a cup carried out of the kitchen stands until
    // the register hands it over: `x` is its centre, `y` the line the cup's base rests on, and
    // `width` how wide the cup is drawn, measured off the mat so it keeps the painting's own scale.
    handoff: { x: centerX, y: y + art.handoff.y * scale, width: art.handoff.width * scale } } as const;
}
