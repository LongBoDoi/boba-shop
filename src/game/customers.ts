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

/**
 * Who a customer is, and what they want from the shop. `rules.ts` says what each kind means; here
 * it is only read off the face.
 */
export type CustomerKind = 'plain' | 'shipper' | 'elder' | 'office';

/**
 * The look decides the kind, so it needs no state and no save of its own, and a face always means
 * the same thing. First match wins, because a cap and glasses can share a head: the cap is the one
 * that reads at the size a customer is drawn.
 */
export function kindOf(look: CustomerLook): CustomerKind {
  if (look.hairStyle === 'cap') return 'shipper';
  if (look.hairStyle === 'balding') return 'elder';
  if (look.accessory === 'glasses') return 'office';
  return 'plain';
}

/** A cap does not read on a 24px head, so the card marks the kind as well. A plain customer has none. */
export const KIND_MARK: Record<CustomerKind, string> = { plain: '', shipper: '🛵', elder: '🧓', office: '💼' };

/** What a customer says as they walk up. It is how the player meets the kind before the card says so. */
export const ARRIVAL_LINES: Record<CustomerKind, readonly string[]> = {
  plain: ['Chào quán!', 'Cho mình gọi món nhé!', 'Hôm nay nóng ghê!', 'Thèm trà sữa quá!', 'Quán xinh ghê!'],
  shipper: ['Nhanh giúp anh nhé!', 'Anh đang giao đơn!', 'Làm lẹ giúp anh nha!'],
  elder: ['Cứ từ từ nhé cháu.', 'Bác không vội đâu.', 'Bác đợi được mà.'],
  office: ['Làm đúng món giúp mình nha!', 'Mình sắp họp rồi!', 'Đúng món là được nha!'],
};

const SKINS = ['#FFDCC2', '#F6C8A4', '#E9B48E', '#CC9268', '#A8704E'];
const HAIRS = ['#2B1B17', '#4A2C20', '#6B4423', '#B9824A', '#9A9A9A', '#D2593B'];
const SHIRTS = ['#7EC8E3', '#F7A9C4', '#B7E07A', '#FFCF6E', '#B79CF2', '#FF9A76', '#7FD6C2'];
export const HAIR_STYLES: HairStyle[] = ['short', 'bob', 'bun', 'spiky', 'long', 'cap', 'balding'];
export const ACCESSORIES: Accessory[] = ['none', 'glasses', 'bow'];

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

/** Far more tries than any kind needs: the rarest is one face in seven. */
const LOOK_TRIES = 200;

/** Only for a generator that will not give up the kind asked for, which the state's own never does. */
const KIND_FACE: Record<CustomerKind, Pick<CustomerLook, 'hairStyle' | 'accessory'>> = {
  plain: { hairStyle: 'short', accessory: 'none' },
  shipper: { hairStyle: 'cap', accessory: 'none' },
  elder: { hairStyle: 'balding', accessory: 'none' },
  office: { hairStyle: 'short', accessory: 'glasses' },
};

/**
 * A face of a kind already announced. A group's kinds are rolled when the quiet starts, because the
 * preview says who is coming, and only the kinds are kept until they do. Rolling the look by the same
 * dice until it fits means an announced shipper is drawn from the same faces as any other.
 */
export function generateLookOf(rng: Rng, kind: CustomerKind): CustomerLook {
  for (let i = 0; i < LOOK_TRIES; i++) {
    const look = generateLook(rng);
    if (kindOf(look) === kind) return look;
  }
  return { ...generateLook(rng), ...KIND_FACE[kind] };
}

export const NAMES = [
  'Mai', 'Lan', 'Hùng', 'Minh', 'Linh', 'Tuấn', 'Hoa', 'Nam',
  'Thảo', 'Quân', 'Vy', 'Huy', 'Ngọc', 'Phúc', 'Trang', 'Khoa',
];
