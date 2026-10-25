import cupGlass from '../assets/kitchen/cup-glass-natural-front.png';
import { CUP_BASE } from './cupGeometry';

/** High-resolution PET plastic, kept separate from the live drink and printed cat. */
export const CUP_GLASS = cupGlass;
export const CUP_GLASS_ART = {
  width: 987, height: 1593,
  x: 61, widthInSource: 866,
  // Keep the wall and rounded base continuous; a separate compressed foot clips the bottom curve.
  bands: [
    { y: 78, height: 272, targetY: 2, targetHeight: 30 },
    { y: 350, height: 1113, targetY: 32, targetHeight: 138 },
  ],
};

const registered = new WeakMap<object, HTMLCanvasElement>();
/** Smooth outer silhouette measured from the painted rim, straight tapered wall, and curved foot. */
const OUTLINE = 'M56.5 2.3 C27 2.3 4.4 7.5 4.4 15.5 Q4.4 21 10.6 27 '
  + `L${CUP_BASE.x - CUP_BASE.rx} ${CUP_BASE.y} A${CUP_BASE.rx} ${CUP_BASE.ry} 0 0 0 ${CUP_BASE.x + CUP_BASE.rx} ${CUP_BASE.y} L102.4 27 `
  + 'Q108.6 21 108.6 15.5 C108.6 7.5 86 2.3 56.5 2.3Z';

/** Keep high-resolution material detail, with a gently antialiased outer edge instead of its noisy fringe. */
export function frontalCupGlass(source: CanvasImageSource): HTMLCanvasElement {
  const cached = registered.get(source);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 113 * 6;
  canvas.height = 174 * 6;
  const c = canvas.getContext('2d')!;
  c.scale(6, 6);
  c.imageSmoothingQuality = 'high';
  for (const band of CUP_GLASS_ART.bands) {
    c.drawImage(source, CUP_GLASS_ART.x, band.y, CUP_GLASS_ART.widthInSource, band.height,
      3, band.targetY, 107, band.targetHeight);
  }
  // Only the silhouette is softened. Blurring the glass itself would lose its fine reflections.
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const edge = mask.getContext('2d')!;
  edge.scale(6, 6);
  const outline = new Path2D(OUTLINE);
  edge.fillStyle = '#fff';
  edge.fill(outline);
  // Lighten the narrow dark contour without changing the clear interior or rolled-rim detail.
  edge.globalCompositeOperation = 'destination-out';
  edge.strokeStyle = 'rgba(0,0,0,0.28)';
  edge.lineWidth = 1.6;
  edge.lineJoin = 'round';
  edge.stroke(outline);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.filter = 'blur(1.5px)';
  c.drawImage(mask, 0, 0);
  registered.set(source, canvas);
  return canvas;
}
