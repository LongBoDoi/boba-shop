/**
 * The cup sprite's own box. Every ingredient and Canvas 2D clip uses these same coordinates.
 */
export const CUP_ART = { w: 113, h: 174 };
/** The measured outer base ellipse of the continuous cup painting. */
export const CUP_BASE = { x: 56.5, y: 157.5, rx: 35, ry: 12.5 };
/**
 * The middle of the cup's painted base ring, in those units — where the glass actually meets what
 * it is standing on. The bottom of the sprite's box is the *front* of that ring, so a cup stood on
 * a surface by its box sits forward of it by half the ring.
 */
export const CUP_FOOT = CUP_BASE.y;
/** The fill and ingredients meet the inside of the bottom rim, just above its painted outline. */
export const CUP_SURFACE_BOTTOM = CUP_BASE.y;
/**
 * Where the tea stands in a cup the game calls full — the line the pour meter's "Đầy" promises,
 * and the line past which a pour spills.
 *
 * It is deliberately not where the design's full cup paints its tea (y 48). That is a drink made to
 * be carried, with a fifth of the glass left clear for the lid, and taking it as the brim meant the
 * meter ran to the end of its track, and then warned of tea going over the side, while the glass
 * plainly still had room in it. The full surface shares the mouth's centerline and width,
 * reaching just under the painted lip. Cream rises above it without lowering the tea.
 */
export const CUP_SURFACE_TOP = 28;
export const CUP_SURFACE_RUN = CUP_SURFACE_BOTTOM - CUP_SURFACE_TOP;
/**
 * The inside of the tapered glass, as half-widths at the two ends of that run. The walls are
 * straight between them, so everything in the cup — the surface oval, the ice that has to stay off
 * the walls — takes its width off the same line.
 */
const CUP_RX_BOTTOM = 33.5;
const CUP_RX_TOP = 42.9;
/** How deep the surface oval is for its width: the perspective the painted rim is drawn in. */
export const CUP_SURFACE_RATIO = 0.235;
const FLOOR_RY = 9.5;
export const CUP_FLOOR_FRONT = CUP_SURFACE_BOTTOM + FLOOR_RY;
const CUP_FLOOR = `L90 ${CUP_SURFACE_BOTTOM} A${CUP_RX_BOTTOM} ${FLOOR_RY} 0 0 1 23 ${CUP_SURFACE_BOTTOM} Z`;
export const CUP_FLOOR_EDGE = `M23 ${CUP_SURFACE_BOTTOM} A${CUP_RX_BOTTOM} ${FLOOR_RY} 0 0 0 90 ${CUP_SURFACE_BOTTOM}`;
/** Inner glass traced from cup-design.png, carried up its own taper to that brim. */
export const CUP_WELL = `M${56.5 - CUP_RX_TOP} ${CUP_SURFACE_TOP} A${CUP_RX_TOP} ${(CUP_RX_TOP * CUP_SURFACE_RATIO).toFixed(2)} 0 0 1 ${56.5 + CUP_RX_TOP} ${CUP_SURFACE_TOP} ${CUP_FLOOR}`;
const MOUTH_Y = 28;
const MOUTH_RX = 42.9;
const MOUTH_RY = 10.1;
/** All contents stay behind the inner mouth, tapered walls and curved floor of the painted glass. */
export const CUP_CONTENTS = `M13.6 ${MOUTH_Y} A${MOUTH_RX} ${MOUTH_RY} 0 0 1 99.4 ${MOUTH_Y} ${CUP_FLOOR}`;
/** The inner floor painting is behind the ingredients; its front edge and wall glints are in front. */
export const CUP_REAR_FLOOR_GLASS = `M21.3 132H91.7 ${CUP_FLOOR}`;
/**
 * Near glass traced from cup.png's painted lip, independently of the liquid well.
 * The actual front lip crosses the centre at y29–31; the old y35.5 split missed it.
 */
export const CUP_NEAR_GLASS = 'M0 14H5 A51.5 12.7 0 0 0 108 14H113V174H0Z';
/** The actual rim band, excluding the front wall below it. */
export const CUP_NEAR_LIP_BAND = 'M4 14 A52.5 18 0 0 0 109 14 L105 14 A48.5 12 0 0 1 8 14Z';

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

/** The upper and lower inside edges of the glass at a given horizontal coordinate. */
export function cupInteriorAt(x: number) {
  const dx = Math.abs(x - CUP_ART.w / 2);
  const top = MOUTH_Y - MOUTH_RY * Math.sqrt(Math.max(0, 1 - (dx / MOUTH_RX) ** 2));
  const bottom = dx <= CUP_RX_BOTTOM
    ? CUP_SURFACE_BOTTOM + FLOOR_RY * Math.sqrt(Math.max(0, 1 - (dx / CUP_RX_BOTTOM) ** 2))
    : MOUTH_Y + (MOUTH_RX - dx) * (CUP_SURFACE_BOTTOM - MOUTH_Y) / (MOUTH_RX - CUP_RX_BOTTOM);
  return { top, bottom };
}

/** Fit the whole rotated, stroked cube inside the glass, including the mouth and curved base. */
function fitIceInsideCup(x: number, y: number, r: number, angle: number) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const points = ICE_OUTLINE.map(([px, py]) => ({
    x: (px * cos - py * sin) * r / 24,
    y: (px * sin + py * cos) * r / 24,
  }));
  const margin = 0.8 * r / 24 + 0.4;
  let cx = x, cy = y;
  // Resolve wall clearance, then ceiling/floor clearance; a second pass handles the tapered sides.
  for (let pass = 0; pass < 2; pass++) {
    let left = -Infinity, right = Infinity;
    for (const p of points) {
      const wallY = Math.max(MOUTH_Y, Math.min(CUP_SURFACE_BOTTOM, cy + p.y));
      const halfWidth = MOUTH_RX - (wallY - MOUTH_Y) *
        (MOUTH_RX - CUP_RX_BOTTOM) / (CUP_SURFACE_BOTTOM - MOUTH_Y);
      left = Math.max(left, 56.5 - halfWidth - p.x + margin);
      right = Math.min(right, 56.5 + halfWidth - p.x - margin);
    }
    cx = Math.max(left, Math.min(right, cx));
    let top = -Infinity, bottom = Infinity;
    for (const p of points) {
      const inside = cupInteriorAt(cx + p.x);
      top = Math.max(top, inside.top - p.y + margin);
      bottom = Math.min(bottom, inside.bottom - p.y - margin);
    }
    cy = Math.max(top, Math.min(bottom, cy));
  }
  return { cx, cy };
}

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
  const ry = FLOOR_RY + fill * (CUP_RX_TOP * CUP_SURFACE_RATIO - FLOOR_RY);
  return { y, rx, ry, opacity: raw > 0 ? 1 : 0 };
}

/** Seat cubes at the near side of the shared oval, so their crowns sit in front of its rear edge. */
export function cupIcePosition(raw: number, x: number, r: number, angle: number, depth: number,
  dryX: number, dryY: number, dryAngle = angle, immersion = 0.42) {
  'worklet';
  const surface = cupSurface(raw);
  const across = Math.max(-1, Math.min(1, (x - 56.5) / surface.rx));
  const waterY = surface.y + surface.ry * Math.sqrt(1 - across * across);
  const seating = r * (0.22 + immersion * 0.35) + surface.ry * depth * 0.15;
  const cy = Math.min(dryY, waterY + seating);
  const rise = Math.max(0, Math.min(1, (dryY - cy) / (r * 1.5)));
  const tilt = dryAngle + (angle - dryAngle) * rise;
  if (!rise) return { cx: dryX, cy: dryY, angle: dryAngle, waterY, floating: false, rise: 0 };
  const targetX = dryX + (x - dryX) * rise;
  const fitted = fitIceInsideCup(targetX, cy, r, tilt);
  return { ...fitted, angle: tilt, waterY, floating: raw > 0 && fitted.cy < dryY - 0.1, rise };
}

/** Submerged ice stays in a shallow band below the surface, limited by the available tea. */
export function cupIceSpreadPosition(raw: number, x: number, r: number, angle: number, liquidDepth: number,
  dryX?: number, dryY?: number, dryAngle = angle) {
  const surface = cupSurface(raw);
  const surfaceFront = surface.y + surface.ry;
  const band = Math.max(0, Math.min(40, CUP_FLOOR_FRONT - surfaceFront));
  const y = surfaceFront + band * liquidDepth;
  if (dryX === undefined || dryY === undefined) return { ...fitIceInsideCup(x, y, r, angle), angle, rise: 1 };
  // Release the dry pile as the water reaches each body, rather than switching poses at raw > 0.
  const contact = Math.max(0, Math.min(1, (dryY + r * 0.75 - surfaceFront) / (r * 1.5)));
  const rise = contact * contact * (3 - 2 * contact);
  if (!rise) return { cx: dryX, cy: dryY, angle: dryAngle, rise: 0 };
  const target = fitIceInsideCup(x, y, r, angle);
  const cy = dryY + (target.cy - dryY) * rise;
  const tilt = dryAngle + (angle - dryAngle) * rise;
  const cx = dryX + (target.cx - dryX) * rise;
  return { ...fitIceInsideCup(cx, cy, r, tilt), angle: tilt, rise };
}

/**
 * The cube silhouette in cup coordinates, for the meniscus and containment checks. Rounded-corner
 * control points conservatively enclose the art; the fit also leaves clearance for its stroke.
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
