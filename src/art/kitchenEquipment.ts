/** Painted milk/cream packages and vector serving tools. */
import { svgDoc, uid } from './svg';
import { paintedEquipmentDetailSvg, paintedEquipmentSvg } from './equipmentArt';

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

/** Ingredient insets crop the same hand-painted packaging shown on the counter. */
export function milkIngredientSvg(kind: 'whole' | 'oat', size = 40): string {
  return paintedEquipmentDetailSvg(kind, size);
}

export function kitchenMilkCartonSvg(width: number, height: number, kind: 'whole' | 'oat'): string {
  return paintedEquipmentSvg(kind, width, height);
}

export function kitchenCreamCanSvg(width: number, height: number, kind: string): string {
  return paintedEquipmentSvg(kind === 'brulee' ? 'brulee' : 'cheese', width, height);
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
