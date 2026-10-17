import { BUILD_ORDER, CategoryId, CUP_SIZES, Drink, effectiveId, EMPTY_DRINK, getIngredient, selectedIds } from './ingredients';
import { DayConfig } from './levels';
import { Rng } from './random';

export type ServeQuality = 'perfect' | 'close' | 'wrong';

export function generateOrder(config: DayConfig, rng: Rng): Drink {
  const order: Drink = { ...EMPTY_DRINK, size: rng.pick([...CUP_SIZES]), toppings: [] };
  for (const category of config.categories) {
    const ids = config.options[category];
    switch (category) {
      case 'toppings':
        order.toppings = pickToppings(ids, config.maxToppings, rng);
        break;
      case 'milk':
        order.milk = rng.next() < 0.3 ? 'none' : rng.pick(ids.filter((id) => id !== 'none'));
        break;
      case 'foam':
        order.foam = rng.next() < 0.5 ? 'none' : rng.pick(ids.filter((id) => id !== 'none'));
        break;
      default:
        order[category] = rng.pick(ids);
    }
  }
  return order;
}

function pickToppings(ids: string[], max: number, rng: Rng): string[] {
  const roll = rng.next();
  const count = max === 1 ? (roll < 0.15 ? 0 : 1) : roll < 0.1 ? 0 : roll < 0.65 ? 1 : 2;
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
