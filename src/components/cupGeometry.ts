/** Cup sprite coordinates, including its curved inner floor and opening. */
export const CUP_WELL = 'M12 33 Q56.5 12 101 33 L89 155 Q89 166 56.5 166 Q23 166 23 155 Z';
export const CUP_SURFACE_BOTTOM = 155;
export const CUP_SURFACE_RUN = 112;

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
  const rx = 33.5 + fill * 10;
  return { y, rx, ry: rx * 0.235, opacity: raw > 0 ? 1 : 0 };
}
