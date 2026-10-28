import reference from '../assets/kitchen/cup-reference-painted.png';
import { el } from './svg';

/** Isolated painted parts derived from the user's reference; untouched RGBA atlas. */
export const REFERENCE_CUP = reference;
export const REFERENCE_CUP_ATLAS = { width: 1536, height: 1024 };
export const CUP_DISPLAY_HEIGHT = 154;
/** Expand the top plane and shorten the front wall, with a smooth change in slope. */
export function holderSurfaceY(y: number) {
  const start = 105, end = 150, topScale = 1.48, frontScale = 0.56;
  if (y <= start) return y * topScale;
  const span = end - start;
  const t = Math.min(y, end) - start;
  const bend = (frontScale - topScale) / (2 * span);
  return start * topScale + t * topScale + bend * t * t + Math.max(0, y - end) * frontScale;
}
export const HOLDER_HEIGHT = holderSurfaceY(211);
/** Measured inner seat ellipse, in the holder crop's source coordinates. */
export const HOLDER_RECESS = { x: 375, y: 83, rx: 145, ry: 30 };
export const HOLDER_SEAT = { x: HOLDER_RECESS.x / 598, y: holderSurfaceY(HOLDER_RECESS.y) / HOLDER_HEIGHT };
/** A cup settles slightly into the silicone recess, behind its near lip. */
export const CUP_SEAT_DEPTH = 3;
export const REFERENCE_CUP_PARTS = {
  cup: { source: { x: 74, y: 106, width: 552, height: 763 }, target: { x: 3, y: 2, width: 107, height: 168 } },
  lid: { source: { x: 691, y: 162, width: 565, height: 386 }, target: { x: 3, y: -53, width: 107, height: 84 } },
  straw: { source: { x: 1390, y: 140, width: 72, height: 759 }, target: { x: 50, y: -90, width: 13, height: 190 } },
  holder: { source: { x: 644, y: 715, width: 598, height: 211 }, target: { x: 0, y: 0, width: 598, height: 211 } },
};
type Part = keyof typeof REFERENCE_CUP_PARTS;
const embedded = new Map<Part, string>();

/** SVGs used as Image textures need embedded pixels; inline SVGs can use the source URL. */
export function prepareReferenceCup(source: CanvasImageSource) {
  for (const part of Object.keys(REFERENCE_CUP_PARTS) as Part[]) {
    if (embedded.has(part)) continue;
    const s = REFERENCE_CUP_PARTS[part].source;
    const canvas = document.createElement('canvas');
    canvas.width = s.width; canvas.height = s.height;
    canvas.getContext('2d')!.drawImage(source, s.x, s.y, s.width, s.height, 0, 0, s.width, s.height);
    embedded.set(part, canvas.toDataURL());
  }
}

export function paintReferencePart(c: CanvasRenderingContext2D, source: CanvasImageSource, part: Part) {
  const { source: s, target: t } = REFERENCE_CUP_PARTS[part];
  c.drawImage(source, s.x, s.y, s.width, s.height, t.x, t.y, t.width, t.height);
}

export function referencePartSvg(part: Part): string {
  const { source: s, target: t } = REFERENCE_CUP_PARTS[part];
  const href = embedded.get(part);
  if (href) return el('image', { href, ...t, preserveAspectRatio: 'none' });
  return el('svg', { ...t, viewBox: `${s.x} ${s.y} ${s.width} ${s.height}`, preserveAspectRatio: 'none', overflow: 'hidden' },
    el('image', { href: REFERENCE_CUP, ...REFERENCE_CUP_ATLAS }));
}
