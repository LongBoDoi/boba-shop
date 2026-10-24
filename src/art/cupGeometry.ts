/** The preparation cup seen from above, in the counter's elevated perspective. */
export const CUP_ART = { w: 113, h: 125 };
export const CUP_FOOT = 92;
export const CUP_MOUTH = { x: 56.5, y: 42, rx: 48, ry: 33 };
export const CUP_SURFACE_BOTTOM = 86;
export const CUP_SURFACE_TOP = CUP_MOUTH.y;
export const CUP_SURFACE_RUN = CUP_SURFACE_BOTTOM - CUP_SURFACE_TOP;
export const CUP_SURFACE_RATIO = CUP_MOUTH.ry / CUP_MOUTH.rx;

export function pourLevel(raw: number) {
  return Math.max(0, Math.min(1, raw));
}

/** The liquid rises and widens inside the tapered glass; its footprint is always an ellipse. */
export function cupSurface(raw: number) {
  const fill = pourLevel(raw);
  const rx = 34 + fill * (CUP_MOUTH.rx - 34);
  return { x: CUP_MOUTH.x, y: CUP_SURFACE_BOTTOM - fill * CUP_SURFACE_RUN,
    rx, ry: rx * CUP_SURFACE_RATIO };
}

/** Normalized positions project onto the same plane as the liquid, ice, and cream. */
export function cupPlanePosition(raw: number, u: number, v: number, radius = 0) {
  const surface = cupSurface(raw);
  // A bounding circle encloses the whole rotated piece, leaving a little wall clearance.
  const length = Math.hypot(u, v);
  const fit = length ? Math.min(1, Math.max(0, 0.96 - radius) / length) : 1;
  return { x: surface.x + u * fit * surface.rx, y: surface.y + v * fit * surface.ry };
}
