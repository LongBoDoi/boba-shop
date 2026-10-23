import paintedEquipment from '../assets/kitchen/dairy-boards-overhead.png';
import { el, svgDoc } from './svg';

export const PAINTED_EQUIPMENT = paintedEquipment;
export const PAINTED_MILK = paintedEquipment;
export type PaintedEquipmentId = 'whole' | 'oat' | 'cheese' | 'brulee';
interface Crop { x: number; y: number; width: number; height: number }

/** Alpha bounds and printed ingredient details, measured on the refined transparent atlas. */
export const EQUIPMENT_ATLAS = {
  width: 1254, height: 1254,
  cells: {
    cheese: { x: 305, y: 531, width: 195, height: 430 },
    brulee: { x: 775, y: 531, width: 198, height: 430 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
  details: {
    cheese: { x: 331, y: 749, width: 136, height: 117 },
    brulee: { x: 793, y: 761, width: 157, height: 112 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
};

/** Folded roofs, side planes and sloped bases share the boards' elevated camera. */
export const MILK_ATLAS = {
  width: 1254, height: 1254,
  cells: {
    whole: { x: 278, y: 28, width: 242, height: 465 },
    oat: { x: 745, y: 31, width: 243, height: 469 },
  } satisfies Record<'whole' | 'oat', Crop>,
  details: {
    whole: { x: 288, y: 226, width: 166, height: 164 },
    oat: { x: 752, y: 228, width: 174, height: 235 },
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
