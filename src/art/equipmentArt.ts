import paintedEquipment from '../assets/kitchen/dairy-boards-overhead-v2.png';
import forwardMilk from '../assets/kitchen/milk-overhead-forward.png';
import { el, svgDoc } from './svg';

export const PAINTED_EQUIPMENT = paintedEquipment;
export const PAINTED_MILK = forwardMilk;
export type PaintedEquipmentId = 'whole' | 'oat' | 'cheese' | 'brulee';
interface Crop { x: number; y: number; width: number; height: number }
/** Tight upright frames for strongly foreshortened overhead packaging. */
export const EQUIPMENT_FRAMES = {
  milk: { width: 72, height: 110, foot: 106 },
  cream: { width: 64, height: 100, foot: 100 },
};

/** Alpha bounds and printed ingredient details, measured on the refined transparent atlas. */
export const EQUIPMENT_ATLAS = {
  width: 1254, height: 1254,
  cells: {
    cheese: { x: 288, y: 577, width: 236, height: 351 },
    brulee: { x: 777, y: 576, width: 242, height: 353 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
  details: {
    cheese: { x: 334, y: 790, width: 134, height: 90 },
    brulee: { x: 812, y: 791, width: 170, height: 99 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
};

/** Squarely forward-facing fronts retain the steep camera and large exposed roofs. */
export const MILK_ATLAS = {
  width: 1536, height: 1024,
  cells: {
    whole: { x: 252, y: 147, width: 444, height: 697 },
    oat: { x: 840, y: 145, width: 445, height: 699 },
  } satisfies Record<'whole' | 'oat', Crop>,
  details: {
    whole: { x: 285, y: 555, width: 386, height: 235 },
    oat: { x: 875, y: 532, width: 374, height: 303 },
  } satisfies Record<'whole' | 'oat', Crop>,
};

function equipmentSource(id: PaintedEquipmentId) {
  const milk = id === 'whole' || id === 'oat';
  return milk
    ? { image: PAINTED_MILK, ...MILK_ATLAS, source: MILK_ATLAS.cells[id], detail: MILK_ATLAS.details[id] }
    : { image: PAINTED_EQUIPMENT, ...EQUIPMENT_ATLAS, source: EQUIPMENT_ATLAS.cells[id], detail: EQUIPMENT_ATLAS.details[id] };
}

/** Keep the painted proportions and place the actual foot on the counter's measured base. */
export function equipmentFrame(id: PaintedEquipmentId) {
  const milk = id === 'whole' || id === 'oat';
  const { width, height, foot } = milk ? EQUIPMENT_FRAMES.milk : EQUIPMENT_FRAMES.cream;
  const atlas = equipmentSource(id), source = atlas.source;
  const scale = Math.min((width - 8) / source.width, (foot - 3) / source.height);
  const w = source.width * scale, h = source.height * scale;
  return { atlas, source, width, height, foot, target: { x: (width - w) / 2, y: foot - h, width: w, height: h } };
}

/** Canvas and HTML use exactly the same crop and proportions. No runtime image editing. */
export function paintEquipment(c: CanvasRenderingContext2D, image: CanvasImageSource, id: PaintedEquipmentId) {
  const { source: s, target: t } = equipmentFrame(id);
  c.drawImage(image, s.x, s.y, s.width, s.height, t.x, t.y, t.width, t.height);
}

function atlasImage(id: PaintedEquipmentId) {
  const atlas = equipmentSource(id);
  return el('image', { href: String(atlas.image), width: atlas.width, height: atlas.height });
}

export function paintedEquipmentSvg(id: PaintedEquipmentId, width: number, height: number): string {
  const frame = equipmentFrame(id), s = frame.source, t = frame.target;
  return svgDoc(width, height,
    el('svg', { ...t, overflow: 'hidden', viewBox: `${s.x} ${s.y} ${s.width} ${s.height}` }, atlasImage(id)),
    `0 0 ${frame.width} ${frame.height}`);
}

/** Magnify the printed cow, oats, cheese or caramel instead of introducing a different icon style. */
export function paintedEquipmentDetailSvg(id: PaintedEquipmentId, size: number): string {
  const s = equipmentSource(id).detail;
  return svgDoc(size, size, atlasImage(id), `${s.x} ${s.y} ${s.width} ${s.height}`, { overflow: 'hidden' });
}
