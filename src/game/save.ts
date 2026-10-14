import { Accessory, ACCESSORIES, CustomerLook, HAIR_STYLES, HairStyle } from './customers';
import {
  CategoryId,
  Drink,
  EMPTY_DRINK,
  getIngredient,
  iceLevelForScoops,
  MAX_ICE_SCOOPS,
  SUGAR_STEPS,
  sweetnessForPumps,
} from './ingredients';
import { getDayConfig } from './levels';
import { Customer, CupBuild, DayStats, GameMode, GameState, Phase } from './reducer';

/**
 * The shop, written down between sessions.
 *
 * `GameState` is already a plain serializable value, so a save is close to `JSON.stringify(state)`
 * — with two deliberate differences:
 *
 * - **`config` is not saved.** It is `getDayConfig(day)`, so re-deriving it on load costs nothing
 *   and means a save made before the levels were retuned comes back on the current numbers.
 * - **the transient UI state is dropped** (`feedback`, `departures`, `discarded`). Those exist for
 *   animations measured in a second or two; restoring a walk-off that started last week would hold
 *   a counter spot for nothing and replay a payment that already happened.
 *
 * Everything read back is validated, because on the web the save sits in `localStorage` where it
 * can be edited, and a save written by an older build can name an ingredient that no longer
 * exists. A save that doesn't check out is thrown away rather than patched: a fresh shop is a
 * better failure than a half-restored one. Ingredient *names* are checked against the catalogue;
 * whether the day in question still offers them is not, so a retuned unlock schedule leaves a
 * customer asking for a tea that isn't on the shelf today rather than wiping the save — they time
 * out, and the shop carries on.
 */
export const SAVE_VERSION = 1;

/** Bump `SAVE_VERSION` when this shape changes; an older save is then discarded on sight. */
interface SavedGame {
  v: number;
  phase: Phase;
  mode: GameMode;
  day: number;
  clock: number;
  coins: number;
  slots: (Customer | null)[];
  selectedSlot: number | null;
  cup: Drink;
  build: CupBuild;
  cupId: number;
  nextSpawnAt: number;
  nextId: number;
  stats: DayStats;
  seed: number;
}

/** The ids a cup holds one of, as opposed to the list of toppings. */
const SINGLE: Exclude<CategoryId, 'toppings'>[] = ['sweetness', 'ice', 'tea', 'milk', 'foam'];
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export function serializeGame(state: GameState): string {
  const save: SavedGame = {
    v: SAVE_VERSION,
    phase: state.phase,
    mode: state.mode,
    day: state.day,
    clock: state.clock,
    coins: state.coins,
    slots: state.slots,
    selectedSlot: state.selectedSlot,
    cup: state.cup,
    build: state.build,
    cupId: state.cupId,
    nextSpawnAt: state.nextSpawnAt,
    nextId: state.nextId,
    stats: state.stats,
    seed: state.seed,
  };
  return JSON.stringify(save);
}

/**
 * Read a save back, or `null` if there isn't one or it doesn't check out.
 *
 * A restored day always comes back **paused**, whatever it was saved as: reopening the game should
 * put the pause card in front of you, not drop you into a shift with three patience timers already
 * running down.
 */
export function parseGame(json: string | null | undefined): GameState | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const save = asObject(raw);
  if (!save || save.v !== SAVE_VERSION) return null;

  const phase = pick<Phase>(save.phase, ['title', 'playing', 'dayEnd']);
  const mode = pick<GameMode>(save.mode, ['standard', 'relaxed']);
  const day = int(save.day, 1, 9_999);
  const clock = num(save.clock, 0);
  const coins = int(save.coins, 0);
  const cupId = int(save.cupId, 1);
  const nextId = int(save.nextId, 1);
  const nextSpawnAt = num(save.nextSpawnAt, 0);
  const seed = int(save.seed, INT32_MIN, INT32_MAX);
  if (!phase || !mode || day === null || clock === null || coins === null) return null;
  if (cupId === null || nextId === null || nextSpawnAt === null || seed === null) return null;

  const config = getDayConfig(day);
  const slots = parseSlots(save.slots, config.slots);
  const build = parseBuild(save.build);
  const cup = parseDrink(save.cup);
  const stats = parseStats(save.stats);
  if (!slots || !build || !cup || !stats) return null;

  // Only a customer whose order has been taken can be the selected one. If that customer has since
  // gone, the next tick picks whoever has been waiting longest for their drink.
  const selected = int(save.selectedSlot, 0, slots.length - 1);
  const selectedSlot = selected !== null && slots[selected]?.status === 'ordered' ? selected : null;

  return {
    phase,
    // Come back to the pause card rather than to a running clock.
    paused: phase === 'playing',
    mode,
    day,
    config,
    clock,
    coins,
    slots,
    selectedSlot,
    cup: {
      ...cup,
      // The scoops and pumps are the physical truth and the reducer reads these two off them, so
      // derive them here as well instead of trusting two copies of one fact to agree.
      ice: iceLevelForScoops(build.iceScoops),
      sweetness: sweetnessForPumps(build.sugarPumps),
    },
    build,
    cupId,
    discarded: null,
    nextSpawnAt,
    nextId,
    stats,
    feedback: [],
    departures: [],
    seed,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function int(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number | null {
  const parsed = num(value, min, max);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * The day's counter, with whoever was standing at it. A save from a day that had more spots than
 * today's (the level's `slots` was retuned down) keeps the customers that still fit.
 */
function parseSlots(raw: unknown, length: number): (Customer | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const slots: (Customer | null)[] = Array.from({ length }, () => null);
  for (let slot = 0; slot < Math.min(length, raw.length); slot++) {
    if (raw[slot] === null || raw[slot] === undefined) continue;
    const customer = parseCustomer(raw[slot]);
    if (!customer) return null;
    slots[slot] = customer;
  }
  return slots;
}

function parseCustomer(raw: unknown): Customer | null {
  const value = asObject(raw);
  if (!value) return null;
  const id = int(value.id, 1);
  const arrivedAt = num(value.arrivedAt, 0);
  const orderPatienceMs = num(value.orderPatienceMs, 1);
  const patienceMs = num(value.patienceMs, 1);
  const status = pick(value.status, ['requesting', 'ordered'] as const);
  const look = parseLook(value.look);
  const order = parseDrink(value.order);
  // Null until the order is taken, so an absent one is correct rather than missing.
  const orderedAt = value.orderedAt === null || value.orderedAt === undefined ? null : num(value.orderedAt, 0);
  if (value.orderedAt !== null && value.orderedAt !== undefined && orderedAt === null) return null;
  if (id === null || arrivedAt === null || orderPatienceMs === null || patienceMs === null) return null;
  if (!status || !look || !order || typeof value.name !== 'string' || value.name === '') return null;
  // A cup nobody ordered can't be served, so an order has to name a tea.
  if (!order.tea) return null;
  return {
    id,
    look,
    name: value.name,
    order,
    status,
    arrivedAt,
    orderPatienceMs,
    orderedAt,
    patienceMs,
  };
}

function parseLook(raw: unknown): CustomerLook | null {
  const value = asObject(raw);
  if (!value) return null;
  const hairStyle = pick<HairStyle>(value.hairStyle, HAIR_STYLES);
  const accessory = pick<Accessory>(value.accessory, ACCESSORIES);
  const { skin, hair, shirt } = value;
  if (!hairStyle || !accessory) return null;
  if (typeof skin !== 'string' || typeof hair !== 'string' || typeof shirt !== 'string') return null;
  return { skin, hair, hairStyle, shirt, accessory };
}

/** A cup, or an order for one: every id has to still be an ingredient the game has. */
function parseDrink(raw: unknown): Drink | null {
  const value = asObject(raw);
  if (!value || !Array.isArray(value.toppings)) return null;
  if (value.toppings.some((id) => typeof id !== 'string' || !getIngredient('toppings', id))) return null;
  const drink: Drink = { ...EMPTY_DRINK, toppings: value.toppings as string[] };
  for (const category of SINGLE) {
    const id = value[category];
    if (id === null || id === undefined) continue;
    if (typeof id !== 'string' || !getIngredient(category, id)) return null;
    drink[category] = id;
  }
  return drink;
}

function parseBuild(raw: unknown): CupBuild | null {
  const value = asObject(raw);
  if (!value || typeof value.spilled !== 'boolean') return null;
  const fill = num(value.fill, 0, 1);
  const iceScoops = int(value.iceScoops, 0, MAX_ICE_SCOOPS);
  const sugarPumps = int(value.sugarPumps, 0, SUGAR_STEPS.length);
  if (fill === null || iceScoops === null || sugarPumps === null) return null;
  return { fill, spilled: value.spilled, iceScoops, sugarPumps };
}

function parseStats(raw: unknown): DayStats | null {
  const value = asObject(raw);
  if (!value) return null;
  const served = int(value.served, 0);
  const perfect = int(value.perfect, 0);
  const missed = int(value.missed, 0);
  const tips = int(value.tips, 0);
  if (served === null || perfect === null || missed === null || tips === null) return null;
  return { served, perfect, missed, tips };
}
