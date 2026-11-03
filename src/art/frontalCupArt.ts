import { REFERENCE_CUP, REFERENCE_CUP_ATLAS } from './referenceCupArt';
import { paintCupMaterial } from './cupMaterialArt';

export const CUP_GLASS = REFERENCE_CUP;
export const CUP_GLASS_ART = REFERENCE_CUP_ATLAS;
const registered = new WeakMap<object, HTMLCanvasElement>();

/** Register CUP_MATERIAL, separately from the original finishing-parts atlas. */
export function frontalCupGlass(source: CanvasImageSource): HTMLCanvasElement {
  const cached = registered.get(source);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 678; canvas.height = 1044;
  const c = canvas.getContext('2d')!;
  c.scale(6, 6);
  c.imageSmoothingQuality = 'high';
  paintCupMaterial(c, source);
  registered.set(source, canvas);
  return canvas;
}
