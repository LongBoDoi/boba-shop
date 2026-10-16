/** Normalized horizontal corners of one pan, in its enclosing layout box. */
export interface ToppingPanShape {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

export interface ToppingTrayEdge { x0: number; x1: number; y: number }

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
