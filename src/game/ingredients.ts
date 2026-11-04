export type CategoryId = 'toppings' | 'sweetness' | 'ice' | 'tea' | 'milk' | 'foam';

export const CUP_SIZES = ['S', 'M', 'L'] as const;
export type CupSize = typeof CUP_SIZES[number];
/** The same painted glass, sized relative to the counter's medium cup. */
export const CUP_SIZE_SCALE: Record<CupSize, number> = { S: 0.84, M: 1, L: 1.16 };

export function isCupSize(value: unknown): value is CupSize {
  return CUP_SIZES.some((size) => size === value);
}

export interface Ingredient {
  id: string;
  name: string;
  color: string;
  price: number;
  /** "Không sữa", "Không đá"… — drawn as an empty swatch. */
  isNone?: boolean;
}

export interface Tea extends Ingredient {
  milkyColor: string;
}

export interface Topping extends Ingredient {
  shape: 'pearl' | 'cube';
}

export interface IceLevel extends Ingredient {
  cubes: number;
}

/** A cup of boba: what the customer ordered, or what the player is building. */
export interface Drink {
  /** Null means there is no cup on the preparation mat yet. Orders always name a size. */
  size: CupSize | null;
  toppings: string[];
  sweetness: string | null;
  ice: string | null;
  tea: string | null;
  milk: string | null;
  foam: string | null;
}

export const EMPTY_DRINK: Drink = {
  size: null,
  toppings: [],
  sweetness: null,
  ice: null,
  tea: null,
  milk: null,
  foam: null,
};

// Array order is slot order: teas fill the rack and toppings fill their stand in the order they
// are listed here. Nothing waits for a later day — every one of them is on the shelf from day one.
export const TEAS: Tea[] = [
  // Hồng trà, Trà lài and Trà Thái are the bodies of the three dispensers on
  // `tools/sheets/kitchen.png`, read between their highlight and shadow sides; Hồng trà's milky
  // colour is that sheet's milk-tea cup. The other three are not drawn anywhere, so they are the
  // old colours moved by the average shift the measured three needed (lighter and a little more
  // saturated), each keeping its own relationship to its milky colour.
  { id: 'black', name: 'Hồng trà', color: '#B26337', milkyColor: '#CE8B5E', price: 4 },
  { id: 'green', name: 'Trà lài', color: '#91C23C', milkyColor: '#CCE3A3', price: 4 },
  { id: 'thai', name: 'Trà Thái', color: '#FE7220', milkyColor: '#FFB081', price: 4 },
  { id: 'oolong', name: 'Ô long', color: '#D48B40', milkyColor: '#E9C8A7', price: 4 },
  { id: 'taro', name: 'Khoai môn', color: '#B8A0DB', milkyColor: '#E0D4F1', price: 5 },
  { id: 'matcha', name: 'Matcha', color: '#72AD3B', milkyColor: '#C0DAA8', price: 5 },
];

export const TOPPINGS: Topping[] = [
  { id: 'pearls', name: 'Trân châu đen', color: '#3A2318', shape: 'pearl', price: 1 },
  { id: 'popping', name: 'Trân châu nổ', color: '#EBA324', shape: 'pearl', price: 1 },
  { id: 'lychee', name: 'Thạch vải', color: '#F4EEDC', shape: 'pearl', price: 1 },
  { id: 'pudding', name: 'Pudding trứng', color: '#F5C84C', shape: 'cube', price: 1 },
  { id: 'grass', name: 'Sương sáo', color: '#302C25', shape: 'cube', price: 1 },
  { id: 'pandan', name: 'Thạch lá dứa', color: '#7C8C32', shape: 'cube', price: 1 },
  { id: 'redbean', name: 'Đậu đỏ', color: '#8E4530', shape: 'pearl', price: 1 },
  { id: 'aloe', name: 'Thạch nha đam', color: '#F1E5C8', shape: 'cube', price: 1 },
  { id: 'crystal', name: 'Trân châu trắng', color: '#EEE5D0', shape: 'pearl', price: 1 },
];

export const ICE_LEVELS: IceLevel[] = [
  { id: 'none', name: 'Không đá', color: '#E8F6FF', cubes: 0, price: 0, isNone: true },
  { id: 'less', name: 'Ít đá', color: '#D2EEFF', cubes: 3, price: 0 },
  { id: 'regular', name: 'Đá thường', color: '#B5E2FF', cubes: 12, price: 0 },
];

export const MILKS: Ingredient[] = [
  { id: 'none', name: 'Không sữa', color: '#FFFFFF', price: 0, isNone: true },
  { id: 'whole', name: 'Sữa tươi', color: '#FFFFFF', price: 1 },
  { id: 'oat', name: 'Sữa yến mạch', color: '#F1E3C8', price: 1 },
];

export const SWEETNESS_LEVELS: Ingredient[] = [
  { id: '0', name: '0%', color: '#FFF6D6', price: 0 },
  { id: '30', name: '30%', color: '#FBE3A0', price: 0 },
  { id: '50', name: '50%', color: '#F5CC63', price: 0 },
  { id: '100', name: '100%', color: '#E8A92C', price: 0 },
];

export const FOAMS: Ingredient[] = [
  { id: 'none', name: 'Không kem', color: '#FFFFFF', price: 0, isNone: true },
  { id: 'cheese', name: 'Kem phô mai', color: '#FFF0C9', price: 2 },
  { id: 'brulee', name: 'Kem brûlée', color: '#E8B877', price: 2 },
];

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  icon: string;
  options: Ingredient[];
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  toppings: { id: 'toppings', label: 'Topping', icon: '⚫', options: TOPPINGS },
  sweetness: { id: 'sweetness', label: 'Đường', icon: '🍯', options: SWEETNESS_LEVELS },
  ice: { id: 'ice', label: 'Đá', icon: '🧊', options: ICE_LEVELS },
  tea: { id: 'tea', label: 'Trà', icon: '🍵', options: TEAS },
  milk: { id: 'milk', label: 'Sữa', icon: '🥛', options: MILKS },
  foam: { id: 'foam', label: 'Kem', icon: '☁️', options: FOAMS },
};

/** Bottom of the cup to the top — also the order of the ingredient tabs. */
export const BUILD_ORDER: CategoryId[] = ['toppings', 'sweetness', 'ice', 'tea', 'milk', 'foam'];

export function getIngredient(category: CategoryId, id: string): Ingredient | undefined {
  return CATEGORIES[category].options.find((option) => option.id === id);
}

export function selectedIds(drink: Drink, category: CategoryId): string[] {
  if (category === 'toppings') return drink.toppings;
  const id = drink[category];
  return id === null ? [] : [id];
}

export function describeSelection(drink: Drink, category: CategoryId): string {
  const names = selectedIds(drink, category).map((id) => getIngredient(category, id)?.name ?? id);
  if (names.length > 0) return names.join(' + ');
  return category === 'toppings' ? 'Không topping' : '—';
}

// --------------------------------------------------------------------------- building a cup by hand

/**
 * What a category means when nothing was ever added. The player only ever *adds* to the cup —
 * a cup nobody scooped ice into simply is "không đá" — so matching compares these values.
 */
export const DEFAULT_ID: Partial<Record<CategoryId, string>> = {
  ice: 'none',
  milk: 'none',
  foam: 'none',
  sweetness: '0',
};

/** The id a cup effectively has in a category, treating "never added" as the none/0 option. */
export function effectiveId(drink: Drink, category: CategoryId): string | null {
  if (category === 'toppings') return null;
  return drink[category] ?? DEFAULT_ID[category] ?? null;
}

/**
 * Whether a drink names anything at all in a category. An order mentions only what the customer
 * actually asked for and leaves the rest unset, so this is what the order panel lists: the none/0
 * options are the same answer spelled out and count as not asking, and tea is the one category
 * every order names. An unasked-for category still has to arrive empty — not asking for foam is
 * asking for no foam — which is `effectiveId`'s job, not this one's.
 */
export function asksFor(drink: Drink, category: CategoryId): boolean {
  if (category === 'toppings') return drink.toppings.length > 0;
  const id = effectiveId(drink, category);
  return id !== null && id !== (DEFAULT_ID[category] ?? null);
}

/** How much of the cup one second of holding a spigot pours. */
export const POUR_RATE = 0.55;
/**
 * How long the tea stands at the brim before it goes over.
 *
 * Without it a full cup is unpourable, and the arithmetic says so: a cup fills in 1.8 s, the meter
 * calls it `Đầy` for its last eighth, and it spills 36 ms after reaching the rim — shorter than
 * anyone's reaction to *seeing* it reach the rim, so aiming for a full cup meant letting go before
 * it looked full and guessing by how much. Reported as exactly that: "really difficult to pour tea
 * to full level as most of the time I would make it overflow." So the pour pauses at the rim: let
 * go inside this window and the cup is exactly full, keep holding and it spills as it always did.
 */
export const BRIM_HOLD_MS = 520;
/** Holding this long past the brim is pure waste; the tea keeps running over until then. */
export const MAX_POUR = 2.2;

/**
 * What a tap held for `heldMs` over a cup holding `fill` has poured into it: the rate, with the
 * pause at the brim, and never more than the cup can waste. The kitchen draws the level from this
 * and hands the same number to `POUR`, so what the cup shows and what the shop is told agree —
 * which is also what keeps the hold out of the reducer: holding through it pours exactly the room
 * that was left, so `pour` sees a cup filled to the brim and nothing spilt.
 */
export function pouredAmount(fill: number, heldMs: number): number {
  const room = Math.max(0, 1 - fill);
  const poured = Math.max(0, heldMs / 1000) * POUR_RATE;
  if (poured <= room) return poured;
  const over = poured - room - (BRIM_HOLD_MS / 1000) * POUR_RATE;
  return Math.min(Math.max(0, MAX_POUR - fill), room + Math.max(0, over));
}

/** Tipping a carton of milk into the cup adds this much — leave it room, or it goes over. */
export const MILK_SPLASH = 0.18;

/** One scoop = ít đá; a second scoop fills out the visible ice cluster for đá thường. */
export const MAX_ICE_SCOOPS = 2;
export function iceLevelForScoops(scoops: number): string | null {
  if (scoops <= 0) return null;
  return scoops === 1 ? 'less' : 'regular';
}

/** Each pump of syrup is one step sweeter. */
export const SUGAR_STEPS = ['30', '50', '100'];
export function sweetnessForPumps(pumps: number): string | null {
  if (pumps <= 0) return null;
  return SUGAR_STEPS[Math.min(pumps, SUGAR_STEPS.length) - 1];
}
