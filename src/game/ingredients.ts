export type CategoryId = 'toppings' | 'sweetness' | 'ice' | 'tea' | 'milk' | 'foam';

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
  toppings: string[];
  sweetness: string | null;
  ice: string | null;
  tea: string | null;
  milk: string | null;
  foam: string | null;
}

export const EMPTY_DRINK: Drink = {
  toppings: [],
  sweetness: null,
  ice: null,
  tea: null,
  milk: null,
  foam: null,
};

// Teas and toppings unlock in array order as the days go on.
export const TEAS: Tea[] = [
  { id: 'black', name: 'Hồng trà', color: '#6B3410', milkyColor: '#B8875F', price: 4 },
  { id: 'green', name: 'Trà lài', color: '#B5BF4A', milkyColor: '#DDE3AE', price: 4 },
  { id: 'thai', name: 'Trà Thái', color: '#E37B2C', milkyColor: '#F3B47E', price: 4 },
  { id: 'oolong', name: 'Ô long', color: '#C0782E', milkyColor: '#E0B98A', price: 4 },
  { id: 'taro', name: 'Khoai môn', color: '#A486CF', milkyColor: '#CDB9E6', price: 5 },
  { id: 'matcha', name: 'Matcha', color: '#5F8F33', milkyColor: '#AECD8F', price: 5 },
];

export const TOPPINGS: Topping[] = [
  { id: 'pearls', name: 'Trân châu đen', color: '#3A2318', shape: 'pearl', price: 1 },
  { id: 'popping', name: 'Trân châu nổ', color: '#F0506E', shape: 'pearl', price: 1 },
  { id: 'lychee', name: 'Thạch vải', color: '#F4EEDC', shape: 'cube', price: 1 },
  { id: 'pudding', name: 'Pudding trứng', color: '#F5C84C', shape: 'cube', price: 1 },
  { id: 'grass', name: 'Sương sáo', color: '#2F3A2A', shape: 'cube', price: 1 },
  { id: 'redbean', name: 'Đậu đỏ', color: '#8A2E2E', shape: 'pearl', price: 1 },
];

export const ICE_LEVELS: IceLevel[] = [
  { id: 'none', name: 'Không đá', color: '#E8F6FF', cubes: 0, price: 0, isNone: true },
  { id: 'less', name: 'Ít đá', color: '#D2EEFF', cubes: 2, price: 0 },
  { id: 'regular', name: 'Đá thường', color: '#B5E2FF', cubes: 4, price: 0 },
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
