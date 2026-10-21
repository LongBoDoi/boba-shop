import paintedEquipment from '../assets/kitchen/counter-props-overhead.png';
import paintedMilk from '../assets/kitchen/counter-props-overhead.png';
import { el, svgDoc } from './svg';

export const PAINTED_EQUIPMENT = paintedEquipment;
export const PAINTED_MILK = paintedMilk;
export type PaintedEquipmentId = 'whole' | 'oat' | 'cheese' | 'brulee';
interface Crop { x: number; y: number; width: number; height: number }

/** Alpha bounds and printed ingredient details, measured on the original transparent atlas. */
export const EQUIPMENT_ATLAS = {
  width: 1536, height: 1024,
  cells: {
    cheese: { x: 1154, y: 53, width: 245, height: 451 },
    brulee: { x: 183, y: 517, width: 248, height: 458 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
  details: {
    cheese: { x: 1200, y: 320, width: 160, height: 160 },
    brulee: { x: 208, y: 780, width: 170, height: 170 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
};

/** Elevated cartons reveal their folded tops and illustrated ingredient panels. */
export const MILK_ATLAS = {
  width: 1536, height: 1024,
  cells: {
    whole: { x: 152, y: 21, width: 318, height: 481 },
    oat: { x: 635, y: 24, width: 320, height: 485 },
  } satisfies Record<'whole' | 'oat', Crop>,
  details: {
    whole: { x: 176, y: 275, width: 205, height: 205 },
    oat: { x: 660, y: 273, width: 190, height: 190 },
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
  const width = milk ? 72 : 64, height = milk ? 154 : 150;
  const atlas = equipmentSource(id), source = atlas.source;
  const scale = Math.min((milk ? 64 : 56) / source.width, (milk ? 147 : 146) / source.height);
  const w = source.width * scale, h = source.height * scale;
  return { atlas, source, width, height, target: { x: (width - w) / 2, y: 150 - h, width: w, height: h } };
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
