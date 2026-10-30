import { Accessory, ACCESSORIES, CustomerKind, CustomerLook, HAIR_STYLES, HairStyle } from './customers';
import { GEAR_IDS } from './gear';
import {
  CategoryId,
  Drink,
  EMPTY_DRINK,
  getIngredient,
  iceLevelForScoops,
  isCupSize,
  MAX_ICE_SCOOPS,
  SUGAR_STEPS,
  sweetnessForPumps,
} from './ingredients';
import { DayConfig, getDayConfig } from './levels';
import {
  AudioSettings,
  clampAudio,
  Customer,
  CupBuild,
  DayStats,
  DEFAULT_AUDIO,
  GameMode,
  GameState,
  NO_OVERTIME,
  Overtime,
  Phase,
} from './reducer';
import { fitsUsual, Recall, REGULAR_IDS, RegularMemory } from './regulars';
import { NEWS_IDS, OVERTIME_MAX_ROUNDS, WAVE_GAP_MAX_MS } from './rules';

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
 * better failure than a half-restored one. Ingredient *names* are checked against the catalogue, so
 * a cup or a customer naming one since taken out of it refuses the save. Whether the day in question
 * still offers a name is not checked, so a retuned menu leaves a customer asking for a tea that isn't
 * on the shelf today rather than wiping the save — they time out, and the shop carries on.
 */
export const SAVE_VERSION = 1;

/**
 * Bump `SAVE_VERSION` when this shape changes **incompatibly**; an older save is then discarded on
 * sight. A field that is merely *new* is migrated instead, as `money` is below — discarding costs
 * the player their shop, so it is for saves that genuinely cannot be read, not for ones this build
 * knows how to finish reading.
 */
interface SavedGame {
  v: number;
  phase: Phase;
  mode: GameMode;
  /** Added after launch, like `money`: a save without it opens at the defaults. */
  audio?: AudioSettings;
  /** Added after launch, like `money`: a save without it has been told nothing yet. */
  seen?: string[];
  /** Added after launch, like `money`: a save without it has bought nothing. */
  gear?: string[];
  /** Added after launch, like `money`: a save without it has met nobody yet. */
  regulars?: Record<string, RegularMemory>;
  day: number;
  clock: number;
  coins: number;
  /** Added after launch; a save without it is migrated rather than thrown away. See `parseGame`. */
  money?: number;
  slots: (Customer | null)[];
  selectedSlot: number | null;
  cup: Drink;
  build: CupBuild;
  cupId: number;
  nextSpawnAt: number;
  nextId: number;
  stats: DayStats;
  /** Added after launch, like `money`: a save without it has not stayed open today. */
  overtime?: Overtime;
  /** The rest are all added after launch, like `money`: a save without them has no group on the way. */
  waveLeft?: number;
  lullUntil?: number;
  incoming?: CustomerKind[];
  line?: Customer[];
  lost?: number;
  seed: number;
}

const KINDS: readonly unknown[] = ['plain', 'shipper', 'elder', 'office'] satisfies CustomerKind[];

/** The ids a cup holds one of, as opposed to the list of toppings. */
const SINGLE: Exclude<CategoryId, 'toppings'>[] = ['sweetness', 'ice', 'tea', 'milk', 'foam'];

export function serializeGame(state: GameState): string {
  const save: SavedGame = {
    v: SAVE_VERSION,
    phase: state.phase,
    mode: state.mode,
    audio: state.audio,
    seen: state.seen,
    gear: state.gear,
    regulars: state.regulars,
    day: state.day,
    clock: state.clock,
    coins: state.coins,
    money: state.money,
    slots: state.slots,
    selectedSlot: state.selectedSlot,
    cup: state.cup,
    build: state.build,
    cupId: state.cupId,
    nextSpawnAt: state.nextSpawnAt,
    nextId: state.nextId,
    stats: state.stats,
    overtime: state.overtime,
    waveLeft: state.waveLeft,
    lullUntil: state.lullUntil,
    incoming: state.incoming,
    line: state.line,
    lost: state.lost,
    seed: state.seed,
  };
  return JSON.stringify(save);
}

/**
 * Read a save back, or `null` if there isn't one or it doesn't check out.
 *
 * A restored shift comes back **paused**, whatever it was saved as: reopening the game should put
 * the pause card in front of you, not drop you into a shift with three patience timers already
 * running down. A day whose clock has never moved is the exception — it is still behind its opening
 * sign, nobody is waiting yet, and that sign is the gate. Pausing it as well would stack two cards
 * and leave the day stopped after the sign was dismissed.
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
  const audio = parseAudio(save.audio);
  const seen = parseSeen(save.seen);
  const gear = parseGear(save.gear);
  const day = int(save.day, 1, 9_999);
  const clock = num(save.clock, 0);
  const coins = int(save.coins, 0);
  // The till was added after the game shipped, so a save from before it has no record of what the
  // shop had put by — and today's takings are the only money in it we can account for. Starting
  // such a player on what they earned today is the honest read; the alternative, refusing the
  // save, costs them the whole run to gain a tidier format.
  const money = save.money === undefined ? coins : int(save.money, 0);
  const cupId = int(save.cupId, 1);
  const nextId = int(save.nextId, 1);
  const nextSpawnAt = num(save.nextSpawnAt, 0);
  // Any integer: a shop that has been played carries the RNG's own 32-bit state, but a brand new
  // one is seeded off the clock and `START_DAY` hands that straight on, so a save written before
  // the first tick holds a number the size of `Date.now()`. Bounding this to an int32 threw those
  // away — the whole opening of a run, up to and including the day's sign.
  const seed = int(save.seed, Number.MIN_SAFE_INTEGER);
  if (!phase || !mode || day === null || clock === null || coins === null || money === null) return null;
  if (cupId === null || nextId === null || nextSpawnAt === null || seed === null) return null;

  const config = getDayConfig(day);
  const regulars = parseRegulars(save.regulars, config);
  const slots = parseSlots(save.slots, config.slots, regulars);
  const build = parseBuild(save.build);
  const cup = parseDrink(save.cup);
  const stats = parseStats(save.stats);
  const overtime = parseOvertime(save.overtime);
  const line = parseLine(save.line, regulars);
  const waveLeft = save.waveLeft === undefined ? 0 : int(save.waveLeft, 0);
  const lullUntil = save.lullUntil === undefined ? 0 : num(save.lullUntil, 0);
  const lost = save.lost === undefined ? 0 : int(save.lost, 0);
  if (!slots || !build || !cup || !stats || !overtime) return null;
  if (!line || waveLeft === null || lullUntil === null || lost === null) return null;
  // Whoever is still to come holds the day open, and only the next arrival can let go of it, so these
  // are held to what a shop can really be in: a relaxed one has no group, one is never further off than
  // the stagger, and the largest there can be is a group with every round's on top. Tidied rather than
  // refused, like the rounds: both limits are numbers tuning will move. Unchecked, a code could carry a
  // day that never ends, and the menu's only button goes straight back to it.
  const coming = mode === 'relaxed' ? 0 : Math.min(waveLeft, config.waveSize * (OVERTIME_MAX_ROUNDS + 1));
  // Older saves had an automatically supplied medium cup. Keep a drink in progress, but let
  // an untouched bench adopt the new pick-a-cup flow. An explicit null is the new empty bench.
  const contents = cup.toppings.length > 0 || SINGLE.some((category) => cup[category] !== null)
    || build.fill > 0 || build.spilled || build.iceScoops > 0 || build.sugarPumps > 0 || build.lidded || build.straw || build.inLidder;
  if (!cup.size && contents) {
    if (asObject(save.cup)?.size !== undefined) return null;
    cup.size = 'M';
  }
  if ((build.lidded && !cup.tea) || (build.straw && !build.lidded)) return null;
  if (build.inLidder && (!cup.tea || build.lidded || build.straw)) return null;

  // Only a customer whose order has been taken can be the selected one. If that customer has since
  // gone, the next tick picks whoever has been waiting longest for their drink.
  const selected = int(save.selectedSlot, 0, slots.length - 1);
  const selectedSlot = selected !== null && slots[selected]?.status === 'ordered' ? selected : null;

  return {
    phase,
    // Come back to the pause card rather than to a running clock — unless the day has not started
    // ticking, in which case its opening sign is the gate and there is nothing to pause.
    paused: phase === 'playing' && clock > 0,
    mode,
    audio,
    seen,
    gear,
    regulars,
    day,
    config,
    clock,
    coins,
    money,
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
    nextSpawnAt: Math.min(nextSpawnAt, clock + WAVE_GAP_MAX_MS),
    nextId,
    stats,
    feedback: [],
    departures: [],
    overtime,
    waveLeft: coming,
    lullUntil,
    incoming: parseIncoming(save.incoming, coming),
    line,
    lost,
    seed,
  };
}

/**
 * How loud the shop was last played. Added after the game shipped, so a save from before it
 * opens at the defaults rather than being thrown away — and unlike an ingredient name, a volume
 * that does not check out is *clamped* rather than refused: the loudness of a shop is not worth
 * losing a week of that shop over, and `clampAudio` can always produce a usable answer.
 */
function parseAudio(raw: unknown): AudioSettings {
  const value = asObject(raw);
  if (!value) return DEFAULT_AUDIO;
  const level = (candidate: unknown, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
  return clampAudio({
    music: level(value.music, DEFAULT_AUDIO.music),
    sfx: level(value.sfx, DEFAULT_AUDIO.sfx),
  });
}

/**
 * Which introductions this shop has had. Like the volumes, a bad one is tidied and not refused: the
 * worst it can cost is a line on a sign read twice, which is not worth a week of the shop. An id
 * this build does not know is dropped, so a code from a newer page simply has that told again.
 */
function parseSeen(raw: unknown): string[] {
  return knownIds(raw, NEWS_IDS);
}

/**
 * What the shop owns. Tidied the way `seen` is: an id this build does not know is dropped, so a code
 * from a newer page opens here without that item rather than not at all.
 */
function parseGear(raw: unknown): string[] {
  return knownIds(raw, GEAR_IDS);
}

/**
 * Those of a list's entries this build knows, each once. They stay in the order they came, which is
 * the order they happened: a backup code is the very bytes of the save, so a reload must not sort them.
 */
function knownIds(raw: unknown, known: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id, at) => known.includes(id) && raw.indexOf(id) === at);
}

/**
 * Who the shop knows. Tidied the way `gear` is, one regular at a time: a memory that does not check
 * out, or a usual that names a tea since taken off the shelf or could never be served, costs that
 * regular's acquaintance and not the shop, and they are simply met again. That is the memory only: a
 * regular standing at the counter holds a copy of the usual as their order, and an order naming a
 * lost ingredient refuses the save, exactly as a stranger's does. An id this build does not know is
 * dropped. The keys stay in the order they came, which is the order they were met: a backup code is
 * the very bytes of the save.
 */
function parseRegulars(raw: unknown, config: DayConfig): Record<string, RegularMemory> {
  const regulars: Record<string, RegularMemory> = {};
  for (const [id, entry] of Object.entries(asObject(raw) ?? {})) {
    const memory = REGULAR_IDS.includes(id) ? parseMemory(entry, config) : null;
    if (memory) regulars[id] = memory;
  }
  return regulars;
}

function parseMemory(raw: unknown, config: DayConfig): RegularMemory | null {
  const value = asObject(raw);
  const usual = value && parseDrink(value.usual);
  if (!value || !usual || !fitsUsual(usual, config)) return null;
  const visits = int(value.visits, 0);
  const streak = int(value.streak, 0);
  const lastDay = int(value.lastDay, 1);
  return visits === null || streak === null || lastDay === null ? null : { usual, visits, streak, lastDay };
}

/**
 * Today's overtime. It holds money, so like the till a bad one is refused rather than guessed at —
 * all but the count of rounds, which is held to today's limit instead. That limit is a number tuning
 * will move, and a shift saved under a higher one is not worth a shop.
 */
function parseOvertime(raw: unknown): Overtime | null {
  if (raw === undefined) return NO_OVERTIME;
  const value = asObject(raw);
  if (!value || typeof value.lost !== 'boolean') return null;
  const rounds = int(value.rounds, 0);
  const jar = int(value.jar, 0);
  const paid = int(value.paid, 0);
  if (rounds === null || jar === null || paid === null) return null;
  // Only ever true: a shop that has not gone relaxed mid-round is simply without it.
  if (value.forfeited !== undefined && value.forfeited !== true) return null;
  return {
    rounds: Math.min(rounds, OVERTIME_MAX_ROUNDS),
    jar,
    lost: value.lost,
    paid,
    ...(value.forfeited ? { forfeited: true as const } : {}),
  };
}

/** Whoever was outside. They are customers like any other, and the same gate decides whether they are. */
function parseLine(raw: unknown, regulars: GameState['regulars']): Customer[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const line: Customer[] = [];
  for (const entry of raw) {
    const customer = parseCustomer(entry, regulars);
    if (!customer) return null;
    line.push(customer);
  }
  return line;
}

/**
 * Who was announced. Tidied the way `seen` is, because all it can cost is a preview: a kind this build
 * does not know is dropped, and the one who comes in place of it is whoever comes. Never longer than
 * the group, whose number is the one that decides how many arrive.
 */
function parseIncoming(raw: unknown, waveLeft: number): CustomerKind[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((kind): kind is CustomerKind => KINDS.includes(kind)).slice(0, waveLeft);
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
function parseSlots(raw: unknown, length: number, regulars: GameState['regulars']): (Customer | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const slots: (Customer | null)[] = Array.from({ length }, () => null);
  for (let slot = 0; slot < Math.min(length, raw.length); slot++) {
    if (raw[slot] === null || raw[slot] === undefined) continue;
    const customer = parseCustomer(raw[slot], regulars);
    if (!customer) return null;
    slots[slot] = customer;
  }
  return slots;
}

function parseCustomer(raw: unknown, regulars: GameState['regulars']): Customer | null {
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
  // Only there once a change of mode has moved `orderedAt`.
  const queuedAt = value.queuedAt === undefined ? undefined : num(value.queuedAt, 0);
  if (queuedAt === null) return null;
  // Only there for a late customer, and a round that happened: the first one is 1.
  const lateRound = value.lateRound === undefined ? undefined : int(value.lateRound, 1);
  if (lateRound === null) return null;
  if (value.regularId !== undefined && typeof value.regularId !== 'string') return null;
  const recall = value.recall === undefined ? undefined : pick<Recall>(value.recall, ['blank', 'asked']);
  if (recall === null) return null;
  // Someone the shop has no memory of, from a newer build or a memory that did not check out, is
  // just someone at the counter. Their hidden card goes too: nothing could settle up for it.
  const regularId = typeof value.regularId === 'string' && Object.hasOwn(regulars, value.regularId) ? value.regularId : undefined;
  if (id === null || arrivedAt === null || orderPatienceMs === null || patienceMs === null) return null;
  if (!status || !look || !order || typeof value.name !== 'string' || value.name === '') return null;
  // A cup nobody ordered can't be served, so an order has to name a tea.
  if (!order.tea || !order.size) return null;
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
    ...(lateRound === undefined ? {} : { lateRound }),
    ...(regularId === undefined ? {} : { regularId, ...(recall === undefined ? {} : { recall }) }),
    // Last, because a change of mode is what adds it: this is the order the reducer's copy has them in.
    ...(queuedAt === undefined ? {} : { queuedAt }),
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
  if (value.size !== undefined && value.size !== null && !isCupSize(value.size)) return null;
  drink.size = isCupSize(value.size) ? value.size : null;
  for (const category of SINGLE) {
    const id = value[category];
    if (id === null || id === undefined) continue;
    if (typeof id !== 'string' || !getIngredient(category, id)) return null;
    drink[category] = id;
  }
  if (value.size === undefined && (drink.toppings.length > 0 || SINGLE.some((category) => drink[category] !== null))) {
    drink.size = 'M';
  }
  return drink;
}

function parseBuild(raw: unknown): CupBuild | null {
  const value = asObject(raw);
  if (!value || typeof value.spilled !== 'boolean') return null;
  const fill = num(value.fill, 0, 1);
  const iceScoops = int(value.iceScoops, 0, MAX_ICE_SCOOPS);
  const sugarPumps = int(value.sugarPumps, 0, SUGAR_STEPS.length);
  // Existing cups predate the finishing station and return ready to be lidded by the player.
  const lidded = value.lidded === undefined ? false : value.lidded;
  const straw = value.straw === undefined ? false : value.straw;
  const inLidder = value.inLidder === undefined ? false : value.inLidder;
  if (typeof lidded !== 'boolean' || typeof straw !== 'boolean' || typeof inLidder !== 'boolean') return null;
  if (fill === null || iceScoops === null || sugarPumps === null) return null;
  return { fill, spilled: value.spilled, iceScoops, sugarPumps, lidded, straw, inLidder };
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
