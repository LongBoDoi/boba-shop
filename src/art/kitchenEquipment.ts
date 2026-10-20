/** Vector kitchen fittings: milk cartons and serving tools. */
import { svgDoc, uid } from './svg';
import { ingredientMarkSvg } from './ingredientMarks';

/** A syrup bottle in a 60×150 box, its body tinted `color`. */
export function kitchenBottleSvg(width: number, height: number, color: string): string {
  const id = uid('bottle');
  return svgDoc(width, height,
    '<defs>' +
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#C49A68"/><stop offset="0.18" stop-color="${color}"/><stop offset="0.7" stop-color="${color}"/><stop offset="1" stop-color="#C49A68"/>` +
    '</linearGradient>' +
    '</defs>' +
    '<path d="M27 19 L28 4 Q30 0 32 4 L34 19" fill="#EDC08B" stroke="#A37342" stroke-width="1.5"/>' +
    '<rect x="19" y="18" width="23" height="12" rx="3" fill="#EDC08B" stroke="#A37342" stroke-width="1.5"/>' +
    `<path d="M21 30 Q20 38 10 47 Q6 51 6 63 V139 Q6 146 14 146 H47 Q54 146 54 139 V63 Q54 51 49 47 Q40 38 40 30 Z" fill="url(#${id})" stroke="#AD7947" stroke-width="2"/>` +
    '<path d="M12 65 V132 M16 48 L23 37 M13 58 V54" stroke="#FFF8E4" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>' +
    '<rect x="13" y="79" width="35" height="29" rx="4" fill="#FFF2D2" stroke="#E6C08A" stroke-width="1"/>' +
    '<path d="M25 88 Q20 83 21 88 Q22 93 29 93 Q33 84 39 87 Q38 93 30 94 M30 91 V101" fill="#AAB16B"/>' +
    '<path d="M12 141 Q30 144 48 141" stroke="#FFF2C8" stroke-width="1.5" opacity="0.7"/>',
    '0 0 60 150');
}

export const MILK_CARTON_ART = { width: 72, height: 154, foot: 150 };

/** The cow/oat illustration, shared by carton packaging and the enlarged order detail. */
export function milkIngredientSvg(kind: 'whole' | 'oat', size = 40): string {
  const oat = kind === 'oat';
  const illustration = oat
    ? '<g stroke="#AD853F" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M28 135Q35 119 37 101 M36 125Q43 114 44 104 M30 128Q26 118 26 111" fill="none"/>' +
      '<g fill="#E4BF68"><path d="M36 111Q28 110 30 103Q36 103 36 111Z M36 117Q28 116 29 110Q35 110 36 117Z M34 124Q27 124 28 118Q33 118 34 124Z M38 110Q44 107 42 101Q37 102 38 110Z M37 117Q44 115 43 109Q37 110 37 117Z M35 124Q42 122 41 116Q35 118 35 124Z"/>' +
      '<path d="M41 117Q48 114 47 108Q42 109 41 117Z M39 124Q46 122 46 116Q41 117 39 124Z"/></g>' +
      '<path d="M29 133Q17 130 20 122Q29 123 29 133Z" fill="#9BAD62" stroke="#83954E"/>' +
      '<path d="M24 126L29 133" fill="none" stroke="#D9DEAA"/></g>'
    : '<g stroke="#A77758" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 104Q19 98 23 95L27 102 M40 102Q43 96 46 98L43 106" fill="#EACDA0"/>' +
      '<ellipse cx="20" cy="107" rx="5.5" ry="3.8" fill="#D6B28A" transform="rotate(-25 20 107)"/>' +
      '<ellipse cx="45" cy="107" rx="5.5" ry="3.8" fill="#D6B28A" transform="rotate(25 45 107)"/>' +
      '<path d="M20 111Q19 100 32 101Q45 101 45 112L43 124Q32 133 22 123Z" fill="#FFF6E1"/>' +
      '<path d="M23 103Q29 100 30 104L28 111Q23 113 22 108Z M37 102Q44 101 44 108Q39 111 37 107Z" fill="#9B775C" stroke="none"/>' +
      '<ellipse cx="32.5" cy="121" rx="11.5" ry="7" fill="#F1B5A5" stroke="#D69B87"/>' +
      '<g fill="#76533C" stroke="none"><circle cx="27" cy="113" r="1.2"/><circle cx="38" cy="113" r="1.2"/>' +
      '<ellipse cx="28.5" cy="120" rx="1" ry="1.2"/><ellipse cx="36.5" cy="120" rx="1" ry="1.2"/></g>' +
      '<path d="M30 124Q32.5 126 35 124" fill="none" stroke="#B87768"/></g>';
  return svgDoc(size, size, '<g transform="translate(-12 -95)">' + illustration + '</g>', '0 0 40 40');
}

/** Pastel paperboard cartons with folded gables, white screw caps and ingredient drawings. */
export function kitchenMilkCartonSvg(width: number, height: number, kind: 'whole' | 'oat'): string {
  const oat = kind === 'oat';
  const body = oat ? '#BDD18C' : '#F5B3A7';
  const light = oat ? '#DAE8AF' : '#FFDDD1';
  const dark = oat ? '#91A45E' : '#D58C80';
  const edge = oat ? '#8C9154' : '#B77D65';
  const ink = '#986C47';
  const id = uid('carton');
  return svgDoc(width, height,
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">` +
    `<stop stop-color="${light}"/><stop offset="0.25" stop-color="${body}"/><stop offset="1" stop-color="${body}"/></linearGradient></defs>` +
    // Slightly visible side face gives the box the reference's counter perspective.
    `<path d="M58 33L66 30V145Q66 149 61 150L58 148Z" fill="${dark}" stroke="${edge}" stroke-width="1.3"/>` +
    `<path d="M6 34H58V148Q32 151 6 148Z" fill="url(#${id})" stroke="${edge}" stroke-width="1.4"/>` +
    `<path d="M6 34L13 10H58L66 30L58 34Z" fill="${light}" stroke="${edge}" stroke-width="1.3"/>` +
    `<path d="M13 10H58L58 34H6Z" fill="${body}" stroke="${edge}" stroke-width="1.1"/>` +
    `<rect x="13" y="3" width="45" height="7" rx="1.6" fill="${light}" stroke="${edge}" stroke-width="1.2"/>` +
    '<path d="M16 6H55 M10 32H55 M9 38V144" fill="none" stroke="#FFF7DE" stroke-width="1.3" opacity="0.75"/>' +
    '<ellipse cx="34" cy="23" rx="7.5" ry="3.4" fill="#D9C9A7" opacity="0.45"/>' +
    '<path d="M27 20V25C28 29 40 29 41 25V20Z" fill="#F7F0DA" stroke="#D6C6A3" stroke-width="0.7"/>' +
    '<ellipse cx="34" cy="20" rx="7" ry="3" fill="#FFFDF0" stroke="#DBCDAF" stroke-width="0.7"/>' +
    '<path d="M29 23V25M32 24V26M35 24V26M38 23V25" stroke="#E2D6BB" stroke-width="0.7"/>' +
    // Cream label has the gently irregular silhouette of printed paper art.
    '<path d="M7 46Q22 40 32 45Q45 50 57 43V134Q45 143 34 139Q19 135 10 141Z" fill="#FFF4D6" opacity="0.98"/>' +
    '<svg x="6" y="64" width="52" height="52">' + milkIngredientSvg(kind, 52) + '</svg>' +
    `<path d="M61 42V141" fill="none" stroke="${ink}" opacity="0.12"/>` +
    '<path d="M9 146Q31 149 56 146" fill="none" stroke="#FFF4D6" stroke-width="1" opacity="0.8"/>',
    '0 0 72 154');
}

/** The same illustrated whipping-cream bottle appears on the counter, in hand and on orders. */
export function kitchenCreamCanSvg(width: number, height: number, kind: string): string {
  const toasted = kind === 'brulee';
  const metal = uid('cream-metal'), label = uid('cream-label');
  const edge = '#9D8465';
  return svgDoc(width, height,
    `<defs><linearGradient id="${metal}"><stop stop-color="#D9C9AF"/><stop offset=".2" stop-color="#FFF9E9"/><stop offset=".45" stop-color="#FFFDF2"/><stop offset="1" stop-color="#C9B593"/></linearGradient>` +
    `<linearGradient id="${label}"><stop stop-color="${toasted ? '#CF9658' : '#88AA95'}"/><stop offset=".3" stop-color="${toasted ? '#F2CD91' : '#D3E3CD'}"/><stop offset="1" stop-color="${toasted ? '#D5A269' : '#9BBC9E'}"/></linearGradient></defs>` +
    `<path d="M18 36Q12 38 10 45L8 54V144Q8 150 32 150Q56 150 56 144V54L54 45Q52 38 46 36Z" fill="url(#${metal})" stroke="${edge}" stroke-width="1.2"/>` +
    `<path d="M8 64Q32 68 56 64V132Q32 139 8 132Z" fill="url(#${label})" stroke="${toasted ? '#BA854A' : '#7E9F8B'}" stroke-width=".8"/>` +
    '<ellipse cx="32" cy="98" rx="22" ry="27" fill="#FFF9E5" fill-opacity=".85"/>' +
    `<svg x="10" y="76" width="44" height="44">${ingredientMarkSvg('foam', kind, 44)}</svg>` +
    '<path d="M12 55V141 M12 144Q32 151 53 144" fill="none" stroke="#FFFDF0" stroke-width="1.6" opacity=".8"/>' +
    `<path d="M17 35V29Q32 26 47 29V35Q32 40 17 35Z" fill="#D7CEBA" stroke="${edge}"/>` +
    `<path d="M24 29V10Q24 4 30 4H48Q53 4 53 9V13H44V11H34V29Z" fill="#FFFDF0" stroke="${edge}" stroke-width="1.2"/>` +
    '<path d="M28 10H47 M28 13V27" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    `<path d="M44 10H54V15H44Z" fill="#F4E8D1" stroke="${edge}" stroke-width=".8"/>`,
    '0 0 64 150');
}

/** The old ice box (`KitchenIceBox`), in a 160×80 box. Nothing in the current room draws it. */
export function kitchenIceBoxSvg(width: number, height: number): string {
  let cubes = '';
  for (let i = 0; i < 8; i++) {
    cubes +=
      `<g transform="translate(${30 + (i % 4) * 25} ${18 + Math.floor(i / 4) * 15})">` +
      '<rect width="20" height="17" rx="4" fill="#F6FAE9" fill-opacity="0.8" stroke="#FFFDF0" stroke-width="1.5"/>' +
      '<path d="M4 4 H13 M4 5 V11" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>' +
      '</g>';
  }
  return svgDoc(width, height,
    '<path d="M9 15 H151 L143 72 H17 Z" fill="#C4B7A1" stroke="#8E795D" stroke-width="2"/>' +
    '<path d="M9 15 L21 3 H141 L151 15 L140 58 H20 Z" fill="#EFE5D2" stroke="#8E795D" stroke-width="2"/>' +
    '<path d="M19 16 H141 L133 50 H27 Z" fill="#B6C8BC" stroke="#9D9278" stroke-width="2"/>' +
    cubes +
    '<rect x="58" y="56" width="44" height="18" rx="4" fill="#FFF1CE" stroke="#BD925C" stroke-width="1.5"/>' +
    '<circle cx="80" cy="65" r="4" fill="#9DAD8D"/>',
    '0 0 160 80');
}

/**
 * The serve (cup) and clear (trash) button icons. The original is fixed at 20×24 over a 24×28
 * viewBox; `width` scales it, keeping that 20:24 box.
 */
export function kitchenActionIconSvg(kind: 'cup' | 'trash', width = 20): string {
  const body = kind === 'trash'
    ? '<g fill="none" stroke="#987044" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 8 L7.5 24 H17 L19 8 M4 7 H21 M9 6 V3 H16 V6 M10 12 V20 M15 12 V20"/>' +
      '<path d="M8 10 L9 22 H16 L17 10" fill="#DDBD87" fill-opacity="0.4" stroke="none"/>' +
      '</g>'
    : '<g fill="none" stroke="#FFF4D6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 7 H20 L17.5 24 H8 Z M4 6 H21 M14 3 L12 15"/>' +
      '<path d="M8 16 H17 L16 23 H9 Z" fill="#E6D0A0" stroke="none"/>' +
      '<circle cx="10" cy="21" r="1.3" fill="#827244" stroke="none"/>' +
      '<circle cx="14" cy="21" r="1.3" fill="#827244" stroke="none"/>' +
      '</g>';
  return svgDoc(width, width * 1.2, body, '0 0 24 28');
}
