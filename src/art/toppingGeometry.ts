/** Normalized horizontal corners of one pan, in its enclosing layout box. */
export interface ToppingPanShape {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

export interface ToppingTrayEdge { x0: number; x1: number; y: number }

/** Calibrate the tray's two ends; every divider between them stays on the same straight line. */
const TRAY_BACK: ToppingTrayEdge = { x0: 1234, x1: 1504, y: 366 };
const TRAY_FRONT: ToppingTrayEdge = { x0: 1213, x1: 1523, y: 509 };
export const TOPPING_TRAY_EDGES: ToppingTrayEdge[] = [0, 1 / 3, 2 / 3, 1].map(t => ({
  x0: TRAY_BACK.x0 + (TRAY_FRONT.x0 - TRAY_BACK.x0) * t,
  x1: TRAY_BACK.x1 + (TRAY_FRONT.x1 - TRAY_BACK.x1) * t,
  y: TRAY_BACK.y + (TRAY_FRONT.y - TRAY_BACK.y) * t,
}));

/** Divide one tray plane into cells with shared edges, rather than nine separate tapers. */
export function toppingPanBounds(back: ToppingTrayEdge, front: ToppingTrayEdge, column: number) {
  const left = column / 3;
  const right = (column + 1) / 3;
  // A small rim overlap covers rounded corners and subpixel seams at every screen scale.
  const tl = back.x0 + (back.x1 - back.x0) * left - 1;
  const tr = back.x0 + (back.x1 - back.x0) * right + 1;
  const bl = front.x0 + (front.x1 - front.x0) * left - 1;
  const br = front.x0 + (front.x1 - front.x0) * right + 1;
  const x = Math.min(tl, bl);
  const w = Math.max(tr, br) - x;
  return {
    x, y: back.y - 1, w, h: front.y - back.y + 2,
    shape: {
      topLeft: (tl - x) / w, topRight: (tr - x) / w,
      bottomLeft: (bl - x) / w, bottomRight: (br - x) / w,
    },
  };
}

/** One horizontal band of a pan, with the slice of the painted cell it shows. */
export interface ToppingPanBand {
  /** Where the band goes in the pan's own box. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The fractions of the cell's cropped height this band is cut from. */
  top: number;
  bottom: number;
}

/**
 * The pan's cell as a stack of horizontal bands, each with the exact scale and offset of its own
 * middle row — the same trapezoid {@link toppingPanMatrix} describes, drawn with plain rectangles
 * instead of a transform.
 *
 * It has to be plain rectangles. A 4x4 matrix is a projective transform, and a renderer that
 * cannot perform one quietly reduces it to a translate, a rotate and a scale: the pan then comes
 * out too small and in the wrong place, which on a tray reads as a gap between every pan and the
 * next. That is what happened on Android when this was drawn as vector nodes, and the lesson is
 * kept because the fit is still read off the matrix. Bands are numbers and
 * rectangles, so all three renderers draw the same tray.
 *
 * The count comes from the fit itself rather than the pan's size: however far the rims travel
 * between the back of the cell and the front, each band covers at most a point of it, so the step
 * from one band to the next stays under half a point however large the room is drawn.
 */
export function toppingPanBands(
  width: number, height: number, shape: ToppingPanShape,
): ToppingPanBand[] {
  const m = toppingPanMatrix(width, height, shape);
  const [a, , , , b, denominator, , q] = m;
  const c = m[12];
  // The matrix's own two mappings, read straight off it: where a row lands, and where that row's
  // left and right rims sit once the tray's perspective has had its say.
  const rowY = (y: number) => denominator * y / (q * y + 1);
  const left = (y: number) => (b * y + c) / (q * y + 1);
  const right = (y: number) => (a * width + b * y + c) / (q * y + 1);
  const travel = Math.max(Math.abs(left(height) - left(0)), Math.abs(right(height) - right(0)));
  // Almost-parallel target edges can cancel the atlas taper in this measure. Keep enough bands
  // to resolve the curved painted rim even when its enclosing rectangle barely moves.
  const count = Math.max(16, Math.min(64, Math.ceil(travel * 2)));

  const bands: ToppingPanBand[] = [];
  for (let i = 0; i < count; i++) {
    const y0 = height * i / count;
    const y1 = height * (i + 1) / count;
    const middle = q * (y0 + y1) / 2 + 1;
    const top = rowY(y0);
    bands.push({
      x: (b * (y0 + y1) / 2 + c) / middle,
      y: top,
      w: a * width / middle,
      h: rowY(y1) - top,
      top: y0 / height,
      bottom: y1 / height,
    });
  }
  return bands;
}

/** Project the atlas's individual trapezoid onto its cell in the continuous tray plane. */
export function toppingPanMatrix(width: number, height: number, shape: ToppingPanShape) {
  // Intersections of the painted side rims, measured after trimming the atlas's vertical gutter.
  const sourceTopLeft = 0.078;
  const sourceTopRight = 0.926;
  const sourceBottomLeft = -0.004;
  const sourceBottomRight = 1.002;
  const a = (shape.topRight - shape.topLeft) / (sourceTopRight - sourceTopLeft);
  const bottomDenominator = a * (sourceBottomRight - sourceBottomLeft) /
    (shape.bottomRight - shape.bottomLeft);
  const c = (shape.topLeft - a * sourceTopLeft) * width;
  const b = (shape.bottomLeft * width * bottomDenominator - a * sourceBottomLeft * width - c) / height;
  const q = (bottomDenominator - 1) / height;
  // Native and web transforms both use a column-major 4×4 matrix.
  return [a, 0, 0, 0, b, bottomDenominator, 0, q, 0, 0, 1, 0, c, 0, 0, 1];
}
