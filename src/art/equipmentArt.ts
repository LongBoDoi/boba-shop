import paintedEquipment from '../assets/kitchen/milk-cream-natural.png';
import { el, svgDoc } from './svg';

export const PAINTED_EQUIPMENT = paintedEquipment;
export const PAINTED_MILK = paintedEquipment;
export type PaintedEquipmentId = 'whole' | 'oat' | 'cheese' | 'brulee';
interface Crop { x: number; y: number; width: number; height: number }

/** Alpha bounds and printed ingredient details, measured on the original transparent atlas. */
export const EQUIPMENT_ATLAS = {
  width: 1536, height: 1024,
  cells: {
    cheese: { x: 316, y: 520, width: 240, height: 464 },
    brulee: { x: 986, y: 520, width: 241, height: 464 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
  details: {
    cheese: { x: 351, y: 771, width: 190, height: 169 },
    brulee: { x: 1013, y: 778, width: 184, height: 154 },
  } satisfies Record<'cheese' | 'brulee', Crop>,
};

/** Elevated cartons reveal their folded tops and illustrated ingredient panels. */
export const MILK_ATLAS = {
  width: 1536, height: 1024,
  cells: {
    whole: { x: 277, y: 7, width: 317, height: 493 },
    oat: { x: 945, y: 19, width: 307, height: 481 },
  } satisfies Record<'whole' | 'oat', Crop>,
  details: {
    whole: { x: 295, y: 250, width: 210, height: 200 },
    oat: { x: 961, y: 244, width: 198, height: 232 },
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
