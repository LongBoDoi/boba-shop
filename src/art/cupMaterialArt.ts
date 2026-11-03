import material from '../assets/kitchen/cup-painted-v2.png';
import { el } from './svg';

/** New painted PET shell. Finishing parts and the holder retain their original atlas. */
export const CUP_MATERIAL = material;
export const CUP_MATERIAL_ART = { width: 1024, height: 1536 };
export const CUP_MATERIAL_CROP = { x: 78, y: 138, width: 870, height: 1236 };
// One projection across the entire mouth preserves the painted ellipse. Splitting
// it at its center compressed the far half and made the side curves kink.
const ROWS = [[138, 2], [373, 32], [1180, 143], [1270, 157.5], [1374, 170]];
let embedded: string | undefined;

export function paintCupMaterial(c: CanvasRenderingContext2D, source: CanvasImageSource) {
  const s = CUP_MATERIAL_CROP;
  // Register the painted rim and foot to the existing lid, liquid well and holder.
  for (let i = 1; i < ROWS.length; i++) {
    const [sy, y] = ROWS[i - 1], [ey, bottom] = ROWS[i];
    c.drawImage(source, s.x, sy, s.width, ey - sy, 3, y, 107, bottom - y);
  }
}

export function prepareCupMaterial(source: CanvasImageSource) {
  if (embedded) return;
  const canvas = document.createElement('canvas');
  canvas.width = 678; canvas.height = 1044;
  const c = canvas.getContext('2d')!;
  c.scale(6, 6);
  paintCupMaterial(c, source);
  embedded = canvas.toDataURL();
}

export function cupMaterialSvg() {
  if (embedded) return el('image', { href: embedded, x: 0, y: 0, width: 113, height: 174 });
  const s = CUP_MATERIAL_CROP;
  return ROWS.slice(1).map(([ey, bottom], i) => {
    const [sy, y] = ROWS[i];
    return el('svg', { x: 3, y, width: 107, height: bottom - y,
      viewBox: `${s.x} ${sy} ${s.width} ${ey - sy}`, preserveAspectRatio: 'none', overflow: 'hidden' },
    el('image', { href: CUP_MATERIAL, ...CUP_MATERIAL_ART }));
  }).join('');
}
