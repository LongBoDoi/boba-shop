/**
 * Shop-style pictograms for every ingredient, drawn in a 40×40 box. Ported from
 * `src/components/art/IngredientIcon.tsx`.
 *
 * The ice icon places the painted `PIECE.ice` sprite with `<image href>`. In this build the
 * shared `require('…png')` is rewritten to an imported URL (see `metroAssets` in
 * `vite.config.ts`), so `String(PIECE.ice)` is that URL. Note that an SVG drawn through an
 * `Image` (a data-URL texture) may not load external images — rasterise the ice icon inline, or
 * pass `iconImage` an already-inlined href (`data:` URL) if it must become a texture.
 */
import { CategoryId, getIngredient, ICE_LEVELS, Tea, TOPPINGS } from '../../../src/game/ingredients';
import { PIECE } from '../../../src/components/art/kitchenArt';
import { el, shade, svgDoc } from './svg';
import { colors } from './theme';

export interface IngredientIconOptions {
  /** Replace the href of the painted ice piece (for example with a `data:` URL). */
  iceHref?: string;
}

/** The ice piece's own URL, as the shared code names it. */
export function iceIconHref(): string {
  return String(PIECE.ice);
}

export function ingredientIconSvg(category: CategoryId, id: string, size: number, opts: IngredientIconOptions = {}): string {
  const option = getIngredient(category, id);
  if (!option) return '';
  let body = '';
  if (category === 'tea') body += teaTin(option as Tea);
  if (category === 'toppings') body += toppingBowl(id);
  if (category === 'ice') body += iceCubes(ICE_LEVELS.find((level) => level.id === id)?.cubes ?? 0, opts.iceHref ?? iceIconHref());
  if (category === 'milk') body += milkCarton(id);
  if (category === 'sweetness') body += sugarJar(Number(id));
  if (category === 'foam') body += foamDollop(option.isNone ? '#EDEDED' : option.color);
  if (option.isNone) body += `<path d="M9 31 L31 9" stroke="${colors.bad}" stroke-width="3.5" stroke-linecap="round"/>`;
  return svgDoc(size, size, body, '0 0 40 40');
}

function teaTin(tea: Tea): string {
  return (
    '<g>' +
    `<rect x="10" y="10" width="20" height="26" rx="4" fill="${tea.color}"/>` +
    `<rect x="9" y="5" width="22" height="7" rx="2.5" fill="${shade(tea.color, -30)}"/>` +
    '<rect x="13" y="17" width="14" height="11" rx="3" fill="#FFFFFF" opacity="0.9"/>' +
    `<path d="M16 26 C16 20 21 19 25 19 C25 23 21 26 16 26 Z" fill="${tea.color}"/>` +
    '<rect x="11.5" y="12" width="2.5" height="22" rx="1.2" fill="#FFFFFF" opacity="0.25"/>' +
    '</g>'
  );
}

function toppingBowl(id: string): string {
  const topping = TOPPINGS.find((t) => t.id === id);
  const color = topping?.color ?? '#000';
  const spots = [
    [13, 19],
    [20, 17],
    [27, 19],
    [16.5, 14],
    [23.5, 14],
  ];
  let out = '<g>';
  for (const [x, y] of spots) {
    out += topping?.shape === 'pearl'
      ? el('circle', { cx: x, cy: y, r: 3.6, fill: color, stroke: 'rgba(0,0,0,0.2)', 'stroke-width': 0.8 })
      : el('rect', { x: x - 3.3, y: y - 3.3, width: 6.6, height: 6.6, rx: 1.6, fill: color, stroke: 'rgba(0,0,0,0.2)', 'stroke-width': 0.8 });
  }
  out +=
    '<path d="M5 21 H35 C35 30 28 35 20 35 C12 35 5 30 5 21 Z" fill="#FFFFFF" stroke="#E7D5C5" stroke-width="1.5"/>' +
    `<path d="M7.5 25.5 H32.5" stroke="${colors.primary}" stroke-width="2.2"/>`;
  return `${out}</g>`;
}

function iceCubes(cubes: number, href: string): string {
  const positions = cubes === 0 ? [[13, 13]] : cubes <= 2 ? [[7, 15], [19, 12]] : [[5, 18], [16, 9], [20, 20]];
  let out = '<g>';
  for (const [x, y] of positions) out += el('image', { href, x, y, width: 18, height: 18 });
  return `${out}</g>`;
}

function milkCarton(id: string): string {
  const body = id === 'oat' ? '#F1E3C8' : id === 'whole' ? '#FFFFFF' : '#EEEEEE';
  const stripe = id === 'oat' ? '#C08E4F' : id === 'whole' ? '#5AA9E6' : '#C9C9C9';
  return (
    '<g>' +
    `<path d="M12 15 L20 6 L28 15 V35 H12 Z" fill="${body}" stroke="#DCCFC2" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M12 15 L20 6 L28 15 Z" fill="${stripe}"/>` +
    `<rect x="12" y="21" width="16" height="7" fill="${stripe}"/>` +
    `<rect x="18" y="3" width="4" height="4" rx="1" fill="${stripe}"/>` +
    '</g>'
  );
}

function sugarJar(percent: number): string {
  const fill = (percent / 100) * 18;
  return (
    '<g>' +
    '<rect x="9" y="12" width="22" height="23" rx="6" fill="#FFFFFF" stroke="#E7D5C5" stroke-width="1.5"/>' +
    (fill > 0 ? el('rect', { x: 11, y: 33 - fill, width: 18, height: fill, rx: 4, fill: '#F5B82E' }) : '') +
    `<rect x="11" y="6" width="18" height="7" rx="2.5" fill="${colors.primary}"/>` +
    '<rect x="12.5" y="14.5" width="2.5" height="16" rx="1.2" fill="#FFFFFF" opacity="0.6"/>' +
    '</g>'
  );
}

function foamDollop(color: string): string {
  return (
    '<g>' +
    '<rect x="8" y="29" width="24" height="6" rx="2" fill="#C9A27E"/>' +
    `<path d="M8 30 C4 30 4 23 9 22 C8 16 15 13 18 17 C20 11 29 12 29 18 C35 18 36 26 32 30 Z" fill="${color}" stroke="${shade(color, -18)}" stroke-width="1.2"/>` +
    '<circle cx="16" cy="21" r="1.8" fill="#FFFFFF" opacity="0.8"/>' +
    '</g>'
  );
}
