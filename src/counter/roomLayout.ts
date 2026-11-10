/** Measurements of the cream cafe paintings in source pixels. */
const ROOMS = {
  portrait: { width: 1024, height: 1536, counterY: 1121, queueY: 1240, doorY: 733,
    register: { x: 91, y: 1033, width: 146, height: 80 },
    handoff: { y: 1215, width: 100 } },
  landscape: { width: 2172, height: 724, counterY: 476, queueY: 548, doorY: 370,
    register: { x: 315, y: 397, width: 165, height: 75 },
    handoff: { y: 563, width: 112 } },
};

export function counterRoomPlacement(width: number, height: number, wide: boolean) {
  const orientation = wide ? 'landscape' : 'portrait';
  const art = ROOMS[orientation];
  // The panorama is deliberately wider than the viewport. Keep its painted proportions intact;
  // a finger pans the camera to the shelves at either end.
  const scale = wide ? Math.max(width / art.width * 1.36, height / art.height * 0.87)
    : width / art.width * 1.20;
  const x = 0;
  const y = Math.min(0, height * 0.5 - art.counterY * scale);
  const centerX = art.width * scale / 2;
  const roomWidth = art.width * scale;
  const maxPan = Math.max(0, roomWidth - width);
  return { orientation, x, y, scale, width: roomWidth, viewportWidth: width,
    maxPan, initialPan: maxPan / 2, height: art.height * scale,
    counterY: y + art.counterY * scale,
    cabinetExtension: Math.max(0, height - (y + art.height * scale)),
    queueY: y + art.queueY * scale, queueX: centerX,
    doorX: centerX, doorY: y + art.doorY * scale,
    register: { x: x + art.register.x * scale, y: y + art.register.y * scale,
      width: art.register.width * scale, height: art.register.height * scale,
      transform: undefined },
    // The painted serving mat beside the till, where a cup carried out of the kitchen stands until
    // the register hands it over: `x` is its centre, `y` the line the cup's base rests on, and
    // `width` how wide the cup is drawn, measured off the mat so it keeps the painting's own scale.
    handoff: { x: centerX, y: y + art.handoff.y * scale, width: art.handoff.width * scale } } as const;
}
