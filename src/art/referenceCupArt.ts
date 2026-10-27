import reference from '../assets/kitchen/cup-reference-painted.png';
import { el } from './svg';

/** Isolated painted parts derived from the user's reference; untouched RGBA atlas. */
export const REFERENCE_CUP = reference;
export const REFERENCE_CUP_ATLAS = { width: 1536, height: 1024 };
export const CUP_DISPLAY_HEIGHT = 154;
export const HOLDER_SEAT = { x: 0.615, y: 0.39 };
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
