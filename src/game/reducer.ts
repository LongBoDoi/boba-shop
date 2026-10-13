import { CustomerLook, generateLook, NAMES } from './customers';
import {
  Drink,
  EMPTY_DRINK,
  iceLevelForScoops,
  MAX_ICE_SCOOPS,
  SUGAR_STEPS,
  sweetnessForPumps,
} from './ingredients';
import { DayConfig, getDayConfig } from './levels';
import { formatMoney } from './money';
import { drinkPrice, evaluateDrink, generateOrder } from './orders';
import { createRng } from './random';

export type Phase = 'title' | 'playing' | 'dayEnd';
export type Tone = 'good' | 'ok' | 'bad';
export type Outcome = 'perfect' | 'close' | 'wrong' | 'timeout';
/** `requesting` = waiting for the player to take the order; `ordered` = waiting for the drink. */
export type CustomerStatus = 'requesting' | 'ordered';
/**
 * How the shop is run. `standard` is the whole job: every order is taken by hand at the counter and
 * the next customer takes a while to walk in. `relaxed` takes the orders for you and keeps someone
 * standing in every free spot, so the day is nothing but preparation.
 */
export type GameMode = 'standard' | 'relaxed';

export interface Customer {
  id: number;
  look: CustomerLook;
  name: string;
  order: Drink;
  status: CustomerStatus;
  /** When they walked up; drives the order-taking patience. */
  arrivedAt: number;
  /** How long they'll wait for their order to be taken. */
  orderPatienceMs: number;
  /** When the order was taken; null until then. Drives the serve patience. */
  orderedAt: number | null;
  /** How long they'll wait for the finished drink after ordering. */
  patienceMs: number;
}

export interface Feedback {
  id: number;
  slot: number;
  text: string;
  tone: Tone;
  expiresAt: number;
}

/** A customer walking away; kept briefly so the UI can animate the exit and payment. */
export interface Departure {
  id: number;
  customer: Customer;
  slot: number;
  outcome: Outcome;
  earned: number;
  /** The cup they were handed, or null if they gave up waiting. */
  drink: Drink | null;
  at: number;
}

/**
 * How the cup on the table was physically built: the drink is poured and scooped by hand, so the
 * cup tracks how full it is and how many scoops/pumps went in — not just which options were picked.
 */
export interface CupBuild {
  /** How much of the cup holds liquid, 0–1; used for rendering and overflow. */
  fill: number;
  /** Poured past the brim at some point, so the drink is messy: no tip. */
  spilled: boolean;
  iceScoops: number;
  sugarPumps: number;
}

const EMPTY_BUILD: CupBuild = { fill: 0, spilled: false, iceScoops: 0, sugarPumps: 0 };

export interface DayStats {
  served: number;
  perfect: number;
  missed: number;
  tips: number;
}

export interface GameState {
  phase: Phase;
  paused: boolean;
  mode: GameMode;
  day: number;
  config: DayConfig;
  /** Game time in ms since the day started; only advances while playing. */
  clock: number;
  coins: number;
  slots: (Customer | null)[];
  selectedSlot: number | null;
  cup: Drink;
  /** The physical state of that cup: how full it is, scoops, pumps, spills. */
  build: CupBuild;
  /** Changes whenever the cup leaves the station (served or thrown away), so the UI can bring in a fresh one. */
  cupId: number;
  /** The last cup thrown in the bin, for the toss animation. */
  discarded: { id: number; drink: Drink } | null;
  nextSpawnAt: number;
  nextId: number;
  stats: DayStats;
  feedback: Feedback[];
  departures: Departure[];
  seed: number;
}

export type GameAction =
  | { type: 'START_DAY'; day: number }
  | { type: 'GO_TO_TITLE' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'TICK'; dt: number }
  | { type: 'TAKE_ORDER'; slot: number }
  | { type: 'SELECT_SLOT'; slot: number }
  /** Held a spigot open over the cup: `amount` is the fraction of the cup that ran in. */
  | { type: 'POUR'; category: 'tea' | 'milk'; optionId: string; amount: number }
  /** One scoop/spoon of a solid straight into the cup. */
  | { type: 'SCOOP'; category: 'toppings' | 'foam'; optionId: string }
  | { type: 'ICE_SCOOP' }
  | { type: 'SUGAR_PUMP' }
  | { type: 'CLEAR_CUP' }
  | { type: 'SERVE' };

const FIRST_CUSTOMER_AT_MS = 1_200;
const RETRY_SPAWN_MS = 1_500;
const FEEDBACK_MS = 1_400;
const MAX_TIP = 3;
/** How long a leaving customer keeps their spot while walking off. */
const DEPARTURE_MS = 1_300;

export function createInitialState(seed: number): GameState {
  return { ...buildDay(1, seed, 'standard'), phase: 'title' };
}

function buildDay(day: number, seed: number, mode: GameMode): GameState {
  const config = getDayConfig(day);
  return {
    phase: 'playing',
    paused: false,
    mode,
    day,
    config,
    clock: 0,
    coins: 0,
    slots: Array.from({ length: config.slots }, () => null),
    selectedSlot: null,
    cup: EMPTY_DRINK,
    build: EMPTY_BUILD,
    cupId: 1,
    discarded: null,
    // In the relaxed mode nobody is kept waiting for a customer, not even at opening.
    nextSpawnAt: mode === 'relaxed' ? 0 : FIRST_CUSTOMER_AT_MS,
    nextId: 1,
    stats: { served: 0, perfect: 0, missed: 0, tips: 0 },
    feedback: [],
    departures: [],
    seed,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_DAY':
      return buildDay(action.day, state.seed, state.mode);
    case 'GO_TO_TITLE':
      return { ...state, phase: 'title', paused: false };
    case 'SET_PAUSED':
      return state.phase === 'playing' ? { ...state, paused: action.paused } : state;
    case 'SET_MODE':
      return setMode(state, action.mode);
    case 'TICK':
      return tick(state, action.dt);
    case 'TAKE_ORDER':
      return isActive(state) ? takeOrder(state, action.slot) : state;
    case 'SELECT_SLOT':
      return isActive(state) && state.slots[action.slot]?.status === 'ordered'
        ? { ...state, selectedSlot: action.slot }
        : state;
    case 'POUR':
      return isActive(state) ? pour(state, action.category, action.optionId, action.amount) : state;
    case 'SCOOP':
      return isActive(state) ? scoop(state, action.category, action.optionId) : state;
    case 'ICE_SCOOP':
      return isActive(state) ? iceScoop(state) : state;
    case 'SUGAR_PUMP':
      return isActive(state) ? sugarPump(state) : state;
    case 'CLEAR_CUP':
      return isActive(state) ? clearCup(state) : state;
    case 'SERVE':
      return isActive(state) ? serve(state) : state;
  }
}

function isActive(state: GameState) {
  return state.phase === 'playing' && !state.paused;
}

function tick(state: GameState, dt: number): GameState {
  if (!isActive(state)) return state;
  const { config } = state;
  // Relaxed: the order is taken the moment they arrive, and the next one is already at the door.
  const auto = state.mode === 'relaxed';
  const clock = state.clock + dt;
  const rng = createRng(state.seed);
  const slots = [...state.slots];
  const feedback = state.feedback.filter((item) => item.expiresAt > clock);
  const departures = state.departures.filter((item) => clock - item.at < DEPARTURE_MS);
  let { nextId, nextSpawnAt } = state;
  let missed = 0;

  slots.forEach((customer, slot) => {
    if (!customer) return;
    const waited =
      customer.status === 'requesting'
        ? clock - customer.arrivedAt
        : clock - (customer.orderedAt ?? customer.arrivedAt);
    const limit = customer.status === 'requesting' ? customer.orderPatienceMs : customer.patienceMs;
    if (waited >= limit) {
      slots[slot] = null;
      missed += 1;
      const text = customer.status === 'requesting' ? 'Chưa kịp nhận! 😤' : 'Chậm quá! 😤';
      feedback.push({ id: nextId++, slot, text, tone: 'bad', expiresAt: clock + FEEDBACK_MS });
      departures.push({ id: nextId++, customer, slot, outcome: 'timeout', earned: 0, drink: null, at: clock });
    }
  });

  // After closing time no one new comes in, but waiting customers can still be served.
  const isOpen = clock < config.durationMs;
  if (isOpen && clock >= nextSpawnAt) {
    const leaving = new Set(departures.map((item) => item.slot));
    const free = slots.flatMap((customer, slot) => (customer || leaving.has(slot) ? [] : [slot]));
    if (free.length > 0) {
      slots[rng.pick(free)] = {
        id: nextId++,
        look: generateLook(rng),
        name: rng.pick(NAMES),
        order: generateOrder(config, rng),
        status: auto ? 'ordered' : 'requesting',
        arrivedAt: clock,
        orderPatienceMs: config.orderPatienceMs,
        orderedAt: auto ? clock : null,
        patienceMs: config.patienceMs,
      };
      nextSpawnAt = auto ? clock : clock + rng.int(config.spawnMinMs, config.spawnMaxMs);
    } else {
      // Every spot is taken (or being vacated): look again next tick, or after a short beat.
      nextSpawnAt = auto ? clock : clock + RETRY_SPAWN_MS;
    }
  }

  const dayOver =
    !isOpen && departures.length === 0 && slots.every((customer) => customer === null);
  return {
    ...state,
    phase: dayOver ? 'dayEnd' : state.phase,
    clock,
    slots,
    feedback,
    departures,
    nextId,
    nextSpawnAt,
    seed: rng.seed,
    selectedSlot: resolveSelection(slots, state.selectedSlot),
    stats: missed > 0 ? { ...state.stats, missed: state.stats.missed + missed } : state.stats,
  };
}

/**
 * Keep the current selection if that customer still has an open order, else pick whoever
 * has been waiting longest for their drink. Only `ordered` customers can be selected.
 */
function resolveSelection(slots: (Customer | null)[], current: number | null): number | null {
  if (current !== null && slots[current]?.status === 'ordered') return current;
  let best: number | null = null;
  let bestOrderedAt = Infinity;
  for (let slot = 0; slot < slots.length; slot++) {
    const customer = slots[slot];
    if (customer?.status === 'ordered' && (customer.orderedAt ?? 0) < bestOrderedAt) {
      best = slot;
      bestOrderedAt = customer.orderedAt ?? 0;
    }
  }
  return best;
}

/**
 * Change how the shop is run, mid-day if need be. Switching to `relaxed` also takes the order of
 * everyone still waiting at the counter — nobody is coming to take it by hand any more — and brings
 * the next arrival forward to now.
 */
function setMode(state: GameState, mode: GameMode): GameState {
  if (mode === state.mode) return state;
  if (mode !== 'relaxed') return { ...state, mode };
  const slots = state.slots.map((customer) =>
    customer?.status === 'requesting'
      ? { ...customer, status: 'ordered' as const, orderedAt: state.clock }
      : customer,
  );
  return {
    ...state,
    mode,
    slots,
    nextSpawnAt: Math.min(state.nextSpawnAt, state.clock),
    selectedSlot: resolveSelection(slots, state.selectedSlot),
  };
}

/** Take a waiting customer's order: reveal the recipe as a ticket and start the serve timer. */
function takeOrder(state: GameState, slot: number): GameState {
  const customer = state.slots[slot];
  if (!customer || customer.status !== 'requesting') return state;
  const slots = [...state.slots];
  slots[slot] = { ...customer, status: 'ordered', orderedAt: state.clock };
  return {
    ...state,
    slots,
    selectedSlot: state.selectedSlot ?? slot,
    nextId: state.nextId + 1,
    feedback: [
      ...state.feedback,
      { id: state.nextId, slot, text: 'Đã nhận order ✓', tone: 'good', expiresAt: state.clock + FEEDBACK_MS },
    ],
  };
}

/**
 * Run a spigot into the cup. Only one kind of tea (or milk) fits in a cup: once something is
 * poured, the rest of that container's taps are locked until the cup is emptied. Holding past the
 * brim spills — the extra is lost and the drink loses its tip.
 */
function pour(state: GameState, category: 'tea' | 'milk', optionId: string, amount: number): GameState {
  if (amount <= 0) return state;
  const poured = state.cup[category];
  if (poured !== null && poured !== optionId) return state;
  const raw = state.build.fill + amount;
  return {
    ...state,
    cup: { ...state.cup, [category]: optionId },
    build: {
      ...state.build,
      fill: Math.min(1, raw),
      spilled: state.build.spilled || raw > 1.02,
    },
  };
}

/** A scoop of topping or a spoon of foam. Nothing comes back out of a cup — empty it to restart. */
function scoop(state: GameState, category: 'toppings' | 'foam', optionId: string): GameState {
  if (category === 'foam') {
    if (state.cup.foam !== null) return state;
    return { ...state, cup: { ...state.cup, foam: optionId } };
  }
  const { toppings } = state.cup;
  if (toppings.includes(optionId) || toppings.length >= state.config.maxToppings) return state;
  return { ...state, cup: { ...state.cup, toppings: [...toppings, optionId] } };
}

function iceScoop(state: GameState): GameState {
  if (state.build.iceScoops >= MAX_ICE_SCOOPS) return state;
  const iceScoops = state.build.iceScoops + 1;
  return { ...state, build: { ...state.build, iceScoops }, cup: { ...state.cup, ice: iceLevelForScoops(iceScoops) } };
}

function sugarPump(state: GameState): GameState {
  if (state.build.sugarPumps >= SUGAR_STEPS.length) return state;
  const sugarPumps = state.build.sugarPumps + 1;
  return {
    ...state,
    build: { ...state.build, sugarPumps },
    cup: { ...state.cup, sweetness: sweetnessForPumps(sugarPumps) },
  };
}

function isCupEmpty(state: GameState) {
  const { cup } = state;
  return (
    state.build.fill === 0 &&
    cup.toppings.length === 0 &&
    Object.values(cup).every((value) => !value || Array.isArray(value))
  );
}

function clearCup(state: GameState): GameState {
  if (isCupEmpty(state)) return state;
  return {
    ...state,
    cup: EMPTY_DRINK,
    build: EMPTY_BUILD,
    cupId: state.cupId + 1,
    discarded: { id: state.nextId, drink: state.cup },
    nextId: state.nextId + 1,
  };
}

function serve(state: GameState): GameState {
  const slot = state.selectedSlot;
  const customer = slot === null ? null : state.slots[slot];
  if (slot === null || !customer || !state.cup.tea) return state;

  const { quality } = evaluateDrink(state.cup, customer.order, state.config.categories);
  const price = drinkPrice(customer.order);
  const orderedAt = customer.orderedAt ?? customer.arrivedAt;
  const patienceLeft = Math.max(0, 1 - (state.clock - orderedAt) / customer.patienceMs);
  const neat = !state.build.spilled;

  let earned = 0;
  let tip = 0;
  let text: string;
  let tone: Tone;
  if (quality === 'perfect' && !neat) {
    // Right drink, but it was poured over the brim: half price, no tip.
    earned = Math.ceil(price / 2);
    text = `Tràn ly… +${formatMoney(earned)}`;
    tone = 'ok';
  } else if (quality === 'perfect') {
    tip = Math.max(1, Math.round(patienceLeft * MAX_TIP));
    earned = price + tip;
    text = `Hoàn hảo! +${formatMoney(earned)}`;
    tone = 'good';
  } else if (quality === 'close') {
    earned = Math.ceil(price / 2);
    text = `Tạm được +${formatMoney(earned)}`;
    tone = 'ok';
  } else {
    text = 'Sai món rồi! 😡';
    tone = 'bad';
  }

  const slots = [...state.slots];
  slots[slot] = null;
  return {
    ...state,
    slots,
    coins: state.coins + earned,
    cup: EMPTY_DRINK,
    build: EMPTY_BUILD,
    cupId: state.cupId + 1,
    selectedSlot: resolveSelection(slots, null),
    nextId: state.nextId + 2,
    feedback: [
      ...state.feedback,
      { id: state.nextId, slot, text, tone, expiresAt: state.clock + FEEDBACK_MS },
    ],
    departures: [
      ...state.departures,
      { id: state.nextId + 1, customer, slot, outcome: quality, earned, drink: state.cup, at: state.clock },
    ],
    stats: {
      ...state.stats,
      served: state.stats.served + 1,
      perfect: state.stats.perfect + (quality === 'perfect' && neat ? 1 : 0),
      tips: state.stats.tips + tip,
    },
  };
}
