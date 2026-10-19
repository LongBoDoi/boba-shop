import { BUILD_ORDER, CATEGORIES, CategoryId } from './ingredients';

export interface DayConfig {
  day: number;
  /** Categories customers care about, in build order. Every one of them, from day one. */
  categories: CategoryId[];
  /** Ingredient ids available per category. */
  options: Record<CategoryId, string[]>;
  maxToppings: number;
  slots: number;
  durationMs: number;
  /** How long a customer waits for the player to take their order. */
  orderPatienceMs: number;
  /** How long a customer waits for the finished drink after ordering. */
  patienceMs: number;
  spawnMinMs: number;
  spawnMaxMs: number;
}

/**
 * The shop opens with its whole menu. Nothing about *what* can go in a cup depends on the day —
 * every category, every tea and every topping is on the shelf from day one — so a save made on
 * any day can name any ingredient, and the rack and the topping stand are never drawn with an
 * empty slot waiting for a later day. What the day still moves is the pace: how many customers
 * stand at the counter, how long they wait, how often they arrive, and how many toppings one
 * drink may ask for.
 */
export function getDayConfig(day: number): DayConfig {
  const categories = [...BUILD_ORDER];
  const options = Object.fromEntries(
    BUILD_ORDER.map((category) => [category, CATEGORIES[category].options.map((o) => o.id)]),
  ) as Record<CategoryId, string[]>;

  const spawnMinMs = Math.max(4_000, 9_000 - day * 600);
  return {
    day,
    categories,
    options,
    maxToppings: day >= 5 ? 2 : 1,
    slots: day === 1 ? 2 : 3,
    // A shift you can settle into: four minutes, not a minute and a half.
    durationMs: 240_000,
    // Taking the order is quick, so this window is the shorter of the two; it tightens by the day.
    orderPatienceMs: Math.max(20_000, 30_000 - (day - 1) * 1_000),
    // A full menu means a full build from day one, so the drink window starts at its widest.
    patienceMs: Math.max(60_000, 90_000 + categories.length * 4_000 - (day - 1) * 5_000),
    spawnMinMs,
    spawnMaxMs: spawnMinMs + 5_000,
  };
}

/**
 * Human-readable list of what's new on `day` compared to the day before. No ingredient is ever on
 * it — they are all there from the start — so what is left is how busy the shop gets.
 */
export function describeUnlocks(day: number): string[] {
  if (day <= 1) return [];
  const before = getDayConfig(day - 1);
  const now = getDayConfig(day);
  const lines: string[] = [];

  if (now.maxToppings > before.maxToppings) lines.push(`✨ Tối đa ${now.maxToppings} topping`);
  if (now.slots > before.slots) lines.push('🧍 Thêm một chỗ cho khách');
  return lines;
}
