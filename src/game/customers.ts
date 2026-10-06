import { Rng } from './random';

export type HairStyle = 'short' | 'bob' | 'bun' | 'spiky' | 'long' | 'cap' | 'balding';
export type Accessory = 'none' | 'glasses' | 'bow';

export interface CustomerLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  accessory: Accessory;
}

const SKINS = ['#FFDCC2', '#F6C8A4', '#E9B48E', '#CC9268', '#A8704E'];
const HAIRS = ['#2B1B17', '#4A2C20', '#6B4423', '#B9824A', '#9A9A9A', '#D2593B'];
const SHIRTS = ['#7EC8E3', '#F7A9C4', '#B7E07A', '#FFCF6E', '#B79CF2', '#FF9A76', '#7FD6C2'];
const HAIR_STYLES: HairStyle[] = ['short', 'bob', 'bun', 'spiky', 'long', 'cap', 'balding'];

export function generateLook(rng: Rng): CustomerLook {
  const hairStyle = rng.pick(HAIR_STYLES);
  const roll = rng.next();
  return {
    skin: rng.pick(SKINS),
    // Balding customers are the older regulars, so they get grey hair.
    hair: hairStyle === 'balding' ? '#A8A8A8' : rng.pick(HAIRS),
    hairStyle,
    shirt: rng.pick(SHIRTS),
    accessory: roll < 0.25 ? 'glasses' : roll < 0.4 && hairStyle !== 'cap' ? 'bow' : 'none',
  };
}

export const NAMES = [
  'Mai', 'Lan', 'Hùng', 'Minh', 'Linh', 'Tuấn', 'Hoa', 'Nam',
  'Thảo', 'Quân', 'Vy', 'Huy', 'Ngọc', 'Phúc', 'Trang', 'Khoa',
];
