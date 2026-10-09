import { BUILD_ORDER, CATEGORIES, CategoryId, TEAS, TOPPINGS } from './ingredients';

const CATEGORY_UNLOCK_DAY: Record<CategoryId, number> = {
  tea: 1,
  toppings: 1,
  ice: 2,
  milk: 3,
  sweetness: 4,
  foam: 5,
};

export interface DayConfig {
  day: number;
  /** Categories customers care about today, in build order. */
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
  goal: number;
}

export function getDayConfig(day: number): DayConfig {
  const categories = BUILD_ORDER.filter((category) => CATEGORY_UNLOCK_DAY[category] <= day);
  const options = Object.fromEntries(
    BUILD_ORDER.map((category) => [category, CATEGORIES[category].options.map((o) => o.id)]),
  ) as Record<CategoryId, string[]>;
  options.tea = TEAS.slice(0, Math.min(TEAS.length, 2 + day)).map((tea) => tea.id);
  options.toppings = TOPPINGS.slice(0, Math.min(TOPPINGS.length, 1 + day)).map((t) => t.id);

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
    // More categories take longer to build, so they buy extra patience.
    patienceMs: Math.max(60_000, 90_000 + categories.length * 4_000 - (day - 1) * 5_000),
    spawnMinMs,
    spawnMaxMs: spawnMinMs + 5_000,
    // Scaled with the longer day, so a target still means the same day's work.
    goal: Math.min(65 + (day - 1) * 20, 240),
  };
}

/** Human-readable list of what's new on `day` compared to the day before. */
export function describeUnlocks(day: number): string[] {
  if (day <= 1) return [];
  const before = getDayConfig(day - 1);
  const now = getDayConfig(day);
  const lines: string[] = [];

  for (const category of now.categories) {
    if (!before.categories.includes(category)) {
      const info = CATEGORIES[category];
      lines.push(`${info.icon} Chọn ${info.label.toLowerCase()}`);
    }
  }
  for (const id of now.options.tea) {
    if (!before.options.tea.includes(id)) lines.push(`🍵 ${TEAS.find((t) => t.id === id)?.name}`);
  }
  for (const id of now.options.toppings) {
    if (!before.options.toppings.includes(id)) {
      lines.push(`⚫ ${TOPPINGS.find((t) => t.id === id)?.name}`);
    }
  }
  if (now.maxToppings > before.maxToppings) lines.push(`✨ Tối đa ${now.maxToppings} topping`);
  if (now.slots > before.slots) lines.push('🧍 Thêm một chỗ cho khách');
  return lines;
}
