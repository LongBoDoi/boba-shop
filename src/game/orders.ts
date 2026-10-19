import {
  BUILD_ORDER,
  CategoryId,
  CUP_SIZES,
  DEFAULT_ID,
  Drink,
  effectiveId,
  EMPTY_DRINK,
  getIngredient,
  selectedIds,
} from './ingredients';
import { DayConfig } from './levels';
import { Rng } from './random';

export type ServeQuality = 'perfect' | 'close' | 'wrong';

/**
 * How often an order mentions a category at all, rolled for each one on its own. Tea is not on the
 * list because every order names a tea; everything else is only there if this customer felt like
 * asking for it, which is what keeps one order from reading like the next. Standing the shelf's
 * whole menu in front of the player (see "What the day changes") is what made this matter: with
 * every category available, an order that named all six named all six every time.
 */
const MENTION_CHANCE: Partial<Record<CategoryId, number>> = {
  toppings: 0.8,
  ice: 0.7,
  milk: 0.7,
  sweetness: 0.65,
  foam: 0.4,
};

/**
 * What a customer asks for. The size and a tea are the only certainties; each other category is
 * mentioned or left out on its own roll, so a plain cup of tea and a seven-thing drink are both
 * orders this can produce.
 *
 * A category that is left out is left **unset**, not set to its none/0 option: "không sữa" is not
 * something a customer says, it is what is true when they say nothing about milk. The two mean the
 * same thing to the cup (`effectiveId` reads an unset category as the none/0 option, so an unasked
 * ingredient still has to arrive absent), and the difference is what the order panel shows — it
 * lists what was asked for and nothing else.
 */
export function generateOrder(config: DayConfig, rng: Rng): Drink {
  const order: Drink = { ...EMPTY_DRINK, size: rng.pick([...CUP_SIZES]), toppings: [] };
  for (const category of config.categories) {
    if (category === 'toppings') {
      const ids = askable(category, config.options.toppings);
      if (ids.length > 0 && rng.next() < chance(category)) {
        order.toppings = pickToppings(ids, config.maxToppings, rng);
      }
      continue;
    }
    const ids = askable(category, config.options[category]);
    if (ids.length === 0) continue;
    // Every order names a tea: a cup with nothing in it is not an order.
    if (category === 'tea') {
      order.tea = rng.pick(ids);
      continue;
    }
    if (rng.next() < chance(category)) order[category] = rng.pick(ids);
  }
  return order;
}

const chance = (category: CategoryId): number => MENTION_CHANCE[category] ?? 0;

/**
 * The options a customer can ask for: whatever the day offers, less the one that means "none".
 * Picking that one would be asking for the absence of the thing, which an order expresses by not
 * mentioning the category at all.
 */
function askable(category: CategoryId, ids: string[]): string[] {
  const absent = DEFAULT_ID[category];
  return ids.filter((id) => id !== absent && !getIngredient(category, id)?.isNone);
}

/** One topping, or two once the day allows it. Nought is "no toppings mentioned", handled above. */
function pickToppings(ids: string[], max: number, rng: Rng): string[] {
  const count = max > 1 && rng.next() < 0.4 ? 2 : 1;
  const pool = [...ids];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  }
  return picked;
}

export function drinkPrice(drink: Drink): number {
  let total = 0;
  for (const category of BUILD_ORDER) {
    for (const id of selectedIds(drink, category)) {
      total += getIngredient(category, id)?.price ?? 0;
    }
  }
  return total;
}

export function categoryMatches(cup: Drink, order: Drink, category: CategoryId): boolean {
  if (category === 'toppings') {
    return (
      cup.toppings.length === order.toppings.length &&
      order.toppings.every((id) => cup.toppings.includes(id))
    );
  }
  // "Never added" counts as the none/0 option, so not scooping ice *is* "không đá".
  return effectiveId(cup, category) === effectiveId(order, category);
}

/** Size is a recipe requirement, with the same penalty as an incorrect ingredient. */
export function evaluateDrink(cup: Drink, order: Drink, categories: CategoryId[]) {
  const mistakes: (CategoryId | 'size')[] = categories.filter((category) => !categoryMatches(cup, order, category));
  if (!cup.size || cup.size !== order.size) mistakes.unshift('size');
  const quality: ServeQuality =
    mistakes.length === 0 ? 'perfect' : mistakes.length === 1 ? 'close' : 'wrong';
  return { quality, mistakes };
}
