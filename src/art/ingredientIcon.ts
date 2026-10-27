/** Order illustrations reuse the actual kitchen art, silhouettes and pictorial emblems. */
import { CategoryId, getIngredient, ICE_LEVELS } from '../game/ingredients';
import {
  PIECE, ROOM_BG_TEA_SHELF, ROOM_BG_TOPPING_SHELF, SUGAR_SCOOP, TEA_DISPENSER_ART, TEA_DISPENSERS,
} from './kitchenArt';
import { kitchenCreamCanSvg, kitchenMilkCartonSvg, milkIngredientSvg } from './kitchenEquipment';
import { ingredientMarkSvg } from './ingredientMarks';
import { paintedEquipmentDetailSvg } from './equipmentArt';
import { TOPPING_SCOOP_ART, TOPPING_SCOOPS } from './toppingArt';
import { el, svgDoc, uid } from './svg';
import { referencePartSvg, CUP_DISPLAY_HEIGHT } from './referenceCupArt';

export interface IngredientIconOptions {
  /** Inline this URL before rasterising an SVG through an Image; inline HTML loads it directly. */
  iceHref?: string;
}

export function iceIconHref(): string { return String(PIECE.ice); }

/** A cropped atlas frame, preserving exactly the colors and ingredient shapes on the counter. */
function crop(href: string, atlasWidth: number, atlasHeight: number, x: number, y: number, width: number, height: number,
  outX: number, outY: number, outW: number, outH: number): string {
  return el('svg', { x: outX, y: outY, width: outW, height: outH, overflow: 'hidden', preserveAspectRatio: 'none', viewBox: `${x} ${y} ${width} ${height}` },
    el('image', { href, width: atlasWidth, height: atlasHeight }));
}

export function ingredientIconSvg(category: CategoryId, id: string, size: number, opts: IngredientIconOptions = {}): string {
  const option = getIngredient(category, id);
  if (!option) return '';
  let body = '';
  if (category === 'tea') {
    const art = TEA_DISPENSER_ART, cell = art.cells[id];
    if (!cell) return '';
    const w = 40, h = w * art.height / art.width, x = 4, y = 1;
    body = crop(String(TEA_DISPENSERS), art.imageWidth, art.imageHeight, cell.x, cell.y, art.width, art.height, x, y, w, h);
    const lw = w * art.label.width, lh = h * art.label.height, ly = y + h * art.label.top;
    body += el('rect', {x: x + (w-lw)/2+1, y: ly+1, width: lw-2, height: lh-2, rx: w*.025, fill: '#FFF0CC'});
    const mark = Math.min(lw-3, lh-2);
    body += el('svg', {x:x+(w-mark)/2,y:ly+(lh-mark)/2,width:mark,height:mark}, ingredientMarkSvg('tea',id,mark));
  }
  if (category === 'toppings') {
    const a = TOPPING_SCOOP_ART, cell = a.cells[id];
    if (!cell) return '';
    body = crop(String(TOPPING_SCOOPS),a.width,a.height,cell.x,cell.y,cell.width,cell.height,1,3,46,42);
    if (id === 'redbean' || id === 'pandan') {
      // These atlas cells include a sliver of the neighbouring scoop below the handle.
      const clip = uid('scoop-crop');
      body = `<defs><clipPath id="${clip}"><path d="M0 0H48V24H44V48H0Z"/></clipPath></defs><g clip-path="url(#${clip})">${body}</g>`;
    }
  }
  if (category === 'milk' || category === 'foam') {
    const milk = category === 'milk', kind = id === 'oat' ? 'oat' : 'whole';
    body = el('svg', {x:1,y:1,width:24,height:46}, milk ? kitchenMilkCartonSvg(24,46,kind) : kitchenCreamCanSvg(24,46,id));
    // Enlarge the printed ingredient alongside its package: the flavor stays legible at phone size.
    body += '<circle cx="32" cy="31" r="14.5" fill="#FFF9E5" stroke="#D8BC87" stroke-width=".8"/>';
    const detailClip = uid('equipment-detail');
    body += `<defs><clipPath id="${detailClip}"><circle cx="32.5" cy="31.5" r="13.5"/></clipPath></defs>`;
    body += el('g', {'clip-path': `url(#${detailClip})`}, el('svg', {x:19,y:18,width:27,height:27},
      milk ? milkIngredientSvg(kind,27) : paintedEquipmentDetailSvg(id === 'brulee' ? 'brulee' : 'cheese',27)));
  }
  if (category === 'sweetness') {
    body = el('image', {href:String(SUGAR_SCOOP),x:1,y:9,width:46,height:28});
  }
  if (category === 'ice') {
    const many = (ICE_LEVELS.find(level => level.id === id)?.cubes ?? 0) > 3;
    for (const [x,y] of many ? [[5,18],[19,6],[23,24]] : [[9,12],[23,22]]) {
      body += el('image',{href:opts.iceHref ?? iceIconHref(),x,y,width:23,height:23});
    }
  }
  if (option.isNone) body += '<path d="M8 40L40 8" stroke="#BA6554" stroke-width="3.5" stroke-linecap="round"/>';
  return svgDoc(size,size,body,'0 0 48 48');
}

/** The same clear cup, with a stronger wall wash for small pale cards. */
export function cupSizeIconSvg(id: string, size: number): string {
  const height = id === 'S' ? 36 : id === 'M' ? 40 : 44;
  const width = height * 113 / CUP_DISPLAY_HEIGHT;
  const body = '<ellipse cx="24" cy="46" rx="12" ry="1.6" fill="#9E8260" opacity=".18"/>' +
    `<g transform="translate(${(48-width)/2} ${47-height}) scale(${width/113} ${height/174})">` +
    referencePartSvg('cup') + '</g>';
  return svgDoc(size,size,body,'0 0 48 48');
}

/** A tiny shelf/tray diagram locates visually similar ingredients without a written name. */
export function ingredientLocatorSvg(category: CategoryId | 'size', id: string, size = 18): string {
  if (category !== 'tea' && category !== 'toppings') return '';
  const slots = category === 'tea' ? ROOM_BG_TEA_SHELF.slots : ROOM_BG_TOPPING_SHELF.slots;
  const rows = category === 'tea' ? 2 : 3, selected = slots.indexOf(id);
  if (selected < 0) return '';
  let body = '<rect width="20" height="20" rx="4" fill="#FFF8E5" stroke="#B99364" stroke-width="1"/>';
  for (let i = 0; i < rows*3; i++) {
    body += el('rect',{x:3+(i%3)*5,y:(20-rows*5)/2+Math.floor(i/3)*5,width:4,height:4,rx:1,
      fill:i===selected?'#79532D':'#E6D4B5'});
  }
  return svgDoc(size,size,body,'0 0 20 20');
}
