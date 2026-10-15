/**
 * The cup sprite's own box. Everything in the glass is drawn in these units, and a mask that has to
 * cover the whole drink is measured in them — see "Drawing on a phone" in CLAUDE.md for why the
 * live boundaries in here are masks and not clips.
 */
export const CUP_ART = { w: 113, h: 174 };
/**
 * The middle of the cup's painted base ring, in those units — where the glass actually meets what
 * it is standing on. The bottom of the sprite's box is the *front* of that ring, so a cup stood on
 * a surface by its box sits forward of it by half the ring.
 */
export const CUP_FOOT = 158;
/** The fill and ingredients meet the inside of the bottom rim, just above its painted outline. */
export const CUP_SURFACE_BOTTOM = 155;
/**
 * Where the tea stands in a cup the game calls full — the line the pour meter's "Đầy" promises,
 * and the line past which a pour spills.
 *
 * It is deliberately not where the design's full cup paints its tea (y 48). That is a drink made to
 * be carried, with a fifth of the glass left clear for the lid, and taking it as the brim meant the
 * meter ran to the end of its track, and then warned of tea going over the side, while the glass
 * plainly still had room in it. The surface sits as high as the painted rim allows instead: its far
 * edge reaches into the mouth of the cup, just under the lip.
 */
export const CUP_SURFACE_TOP = 36;
export const CUP_SURFACE_RUN = CUP_SURFACE_BOTTOM - CUP_SURFACE_TOP;
/**
 * The inside of the tapered glass, as half-widths at the two ends of that run. The walls are
 * straight between them, so everything in the cup — the surface oval, the ice that has to stay off
 * the walls — takes its width off the same line.
 */
const CUP_RX_BOTTOM = 33.5;
const CUP_RX_TOP = 42.4;
const CUP_TAPER = (CUP_RX_TOP - CUP_RX_BOTTOM) / CUP_SURFACE_RUN;
/** How deep the surface oval is for its width: the perspective the painted rim is drawn in. */
const SURFACE_RATIO = 0.235;
const FLOOR_RY = 9;
export const CUP_FLOOR_FRONT = CUP_SURFACE_BOTTOM + FLOOR_RY;
const CUP_FLOOR = `L90 ${CUP_SURFACE_BOTTOM} A${CUP_RX_BOTTOM} ${FLOOR_RY} 0 0 1 23 ${CUP_SURFACE_BOTTOM} Z`;
export const CUP_FLOOR_EDGE = `M23 ${CUP_SURFACE_BOTTOM} A${CUP_RX_BOTTOM} ${FLOOR_RY} 0 0 0 90 ${CUP_SURFACE_BOTTOM}`;
/** Inner glass traced from cup-design.png, carried up its own taper to that brim. */
export const CUP_WELL = `M${56.5 - CUP_RX_TOP} ${CUP_SURFACE_TOP} A${CUP_RX_TOP} ${(CUP_RX_TOP * SURFACE_RATIO).toFixed(2)} 0 0 1 ${56.5 + CUP_RX_TOP} ${CUP_SURFACE_TOP} ${CUP_FLOOR}`;
/** Floating crowns can rise into the clear air beneath the lip; liquid keeps its own lower well. */
export const CUP_ICE_WELL = `M13.6 28 A42.9 10.1 0 0 1 99.4 28 ${CUP_FLOOR}`;
/** The inner floor painting is behind the ingredients; its front edge and wall glints are in front. */
export const CUP_REAR_FLOOR_GLASS = `M21.3 132H91.7 ${CUP_FLOOR}`;
/** Original vertical highlights on the near wall, continuing across the ingredient pile. */
export const CUP_FRONT_GLINTS = 'M29 132L35 132L39 160Q36 162 33 160Z M76 132L81 132L78 158Q76 161 73 161Z';

/** Spread pieces to the inner walls; fit whole rotated sprites above the same floor as the tea. */
export function cupToppingPosition(x: number, rx: number, ry: number, angle: number, lift: number) {
  const radians = angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfWidth = rx * cos + ry * sin;
  const halfHeight = rx * sin + ry * cos;
  const padding = 0.8;
  const cx = Math.max(23 + padding + halfWidth, Math.min(90 - padding - halfWidth, x));
  const farEdge = Math.abs(cx - 56.5) + halfWidth;
  const floor = CUP_SURFACE_BOTTOM + FLOOR_RY * Math.sqrt(Math.max(0, 1 - (farEdge / CUP_RX_BOTTOM) ** 2));
  return { cx, cy: floor - halfHeight - padding - lift };
}

/** Outline and curve controls of the rounded ice art, including its stroke, in its 48-unit box. */
const ICE_OUTLINE = [
  [-20, -11], [-7, -20], [-5, -21], [-3, -20], [19, -14], [22, -13], [21, -10],
  [18, 14], [18, 16], [16, 17], [9, 22], [8, 23], [6, 22], [-19, 15],
  [-22, 14], [-22, 11], [-22, -8], [-22, -10],
];

/** Fit the actual rotated ice outline onto the curved floor, rather than its oversized image box. */
export function cupIceRestPosition(x: number, r: number, angle: number, lift: number) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = ICE_OUTLINE.map(([px, py]) => ({
    x: (px * cos - py * sin) * r / 24,
    y: (px * sin + py * cos) * r / 24,
  }));
  const margin = 0.8 * r / 24 + 0.4;
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const cx = Math.max(23 + margin - left, Math.min(90 - margin - right, x));
  let cy = Infinity;
  let contact = points[0];
  for (const point of points) {
    const dx = (cx + point.x - 56.5) / CUP_RX_BOTTOM;
    const floor = CUP_SURFACE_BOTTOM + FLOOR_RY * Math.sqrt(Math.max(0, 1 - dx * dx));
    const support = floor - point.y - margin;
    if (support < cy) { cy = support; contact = point; }
  }
  cy -= lift;
  return { cx, cy, contactX: cx + contact.x, contactY: cy + contact.y + margin * 0.5 };
}

/** Actual fill drives the liquid, foam and stream, with no minimum or artificial starting fill. */
export function pourLevel(raw: number) {
  'worklet';
  return Math.max(0, Math.min(1, raw));
}

/** The liquid shares the rim's elliptical perspective and narrows with the tapered walls. */
export function cupSurface(raw: number) {
  'worklet';
  const fill = pourLevel(raw);
  const y = CUP_SURFACE_BOTTOM - fill * CUP_SURFACE_RUN;
  const rx = CUP_RX_BOTTOM + fill * (CUP_RX_TOP - CUP_RX_BOTTOM);
  return { y, rx, ry: rx * SURFACE_RATIO, opacity: raw > 0 ? 1 : 0 };
}

/** Seat cubes at the near side of the shared oval, so their crowns sit in front of its rear edge. */
export function cupIcePosition(raw: number, x: number, r: number, angle: number, depth: number,
  dryX: number, dryY: number, dryAngle = angle, submergedDepth = 0, immersion = 0.42) {
  'worklet';
  const surface = cupSurface(raw);
  const across = Math.max(-1, Math.min(1, (x - 56.5) / surface.rx));
  const waterY = surface.y + surface.ry * Math.sqrt(1 - across * across);
  const seating = r * (0.22 + immersion * 0.35) + surface.ry * depth * 0.15;
  const cy = Math.min(dryY, waterY + seating + submergedDepth);
  const rise = Math.max(0, Math.min(1, (dryY - cy) / (r * 1.5)));
  const tilt = dryAngle + (angle - dryAngle) * rise;
  if (!rise) return { cx: dryX, cy: dryY, angle: dryAngle, waterY, floating: false, rise: 0 };
  const radians = tilt * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const margin = 0.8 * r / 24 + 0.4;
  let left = -Infinity;
  let right = Infinity;
  // Fit the painted outline, not a rotated square that pushes chunky cubes into the center.
  for (const point of ICE_OUTLINE) {
    const px = (point[0] * cos - point[1] * sin) * r / 24;
    const py = (point[0] * sin + point[1] * cos) * r / 24;
    const halfWidth = CUP_RX_BOTTOM
      + (CUP_SURFACE_BOTTOM - Math.max(CUP_SURFACE_TOP, Math.min(CUP_SURFACE_BOTTOM, cy + py))) * CUP_TAPER;
    left = Math.max(left, 56.5 - halfWidth - px + margin);
    right = Math.min(right, 56.5 + halfWidth - px - margin);
  }
  const targetX = dryX + (x - dryX) * rise;
  const cx = Math.max(left, Math.min(right, targetX));
  return { cx, cy, angle: tilt, waterY, floating: raw > 0 && cy < dryY - 0.1, rise };
}

/**
 * The cube's own silhouette where it stands, as a path of its own.
 *
 * The art is drawn in the cube's local space and carried into the cup by a transform, but a clip
 * cannot be carried that way on a phone: `transform` is turned into a `matrix` by JavaScript, which
 * an animated prop never passes through. So anything that has to follow a cube every frame — the
 * meniscus that anchors it to the surface — is given the outline already standing where the cube
 * stands. The rounded corners are taken as their control points, which is a hair wide of the
 * painted shape and nothing to a hairline clipped by it.
 */
export function cupIceOutlinePath(cx: number, cy: number, angle: number, r: number) {
  'worklet';
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scale = r / 24;
  let d = '';
  for (let i = 0; i < ICE_OUTLINE.length; i++) {
    const point = ICE_OUTLINE[i];
    const x = cx + (point[0] * cos - point[1] * sin) * scale;
    const y = cy + (point[0] * sin + point[1] * cos) * scale;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Draw the body itself with the curved floor; rectangular layers cannot flatten its lower edge. */
export function cupLiquidPath(y: number, rx: number, ry: number) {
  'worklet';
  return `M${56.5 - rx} ${y} A${rx} ${ry} 0 0 1 ${56.5 + rx} ${y} ${CUP_FLOOR}`;
}

/** The filled well, including the top oval and curved floor, in cup sprite coordinates. */
export function cupFillPath(raw: number) {
  'worklet';
  if (raw <= 0) return '';
  const { y, rx, ry } = cupSurface(raw);
  return cupLiquidPath(y, rx, ry);
}

/** Water in front of the ice begins at the oval's near arc; the top surface stays behind its crowns. */
export function cupIceFillPath(raw: number) {
  'worklet';
  if (raw <= 0) return '';
  const { y, rx, ry } = cupSurface(raw);
  return `M${56.5 - rx} ${y} A${rx} ${ry} 0 0 0 ${56.5 + rx} ${y} ${CUP_FLOOR}`;
}
