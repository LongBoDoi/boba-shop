/** Inner glass measured from cup-design.png, inset from the painted walls and base ring. */
export const CUP_WELL = 'M15 48 A41.5 9.7525 0 0 1 98 48 L90 153 A33.5 7.8725 0 0 1 23 153 Z';
export const CUP_SURFACE_BOTTOM = 153;
export const CUP_SURFACE_RUN = 105;
export const CUP_FLOOR_FRONT = 161;

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
  const rx = 33.5 + fill * 8;
  return { y, rx, ry: rx * 0.235, opacity: raw > 0 ? 1 : 0 };
}
