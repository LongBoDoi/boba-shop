import { CustomerLook, generateLook, NAMES } from './customers';
import { CategoryId, Drink, EMPTY_DRINK } from './ingredients';
import { DayConfig, getDayConfig } from './levels';
import { formatMoney } from './money';
import { drinkPrice, evaluateDrink, generateOrder } from './orders';
import { createRng } from './random';

export type Phase = 'title' | 'playing' | 'dayEnd';
export type Tone = 'good' | 'ok' | 'bad';
export type Outcome = 'perfect' | 'close' | 'wrong' | 'timeout';

export interface Customer {
  id: number;
  look: CustomerLook;
  name: string;
  order: Drink;
  arrivedAt: number;
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

export interface DayStats {
  served: number;
  perfect: number;
  missed: number;
  tips: number;
}

export interface GameState {
  phase: Phase;
  paused: boolean;
  day: number;
  config: DayConfig;
  /** Game time in ms since the day started; only advances while playing. */
  clock: number;
  coins: number;
  slots: (Customer | null)[];
  selectedSlot: number | null;
  cup: Drink;
  /** Changes whenever the cup leaves the station (served or thrown away), so the UI can bring in a fresh one. */
  cupId: number;
  /** The last cup thrown in the bin, for the toss animation. */
  discarded: { id: number; drink: Drink } | null;
  activeCategory: CategoryId;
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
  | { type: 'TICK'; dt: number }
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'SET_CATEGORY'; category: CategoryId }
  | { type: 'PICK'; category: CategoryId; optionId: string }
  | { type: 'CLEAR_CUP' }
  | { type: 'SERVE' };

const FIRST_CUSTOMER_AT_MS = 1_200;
const RETRY_SPAWN_MS = 1_500;
const FEEDBACK_MS = 1_400;
const MAX_TIP = 3;
/** How long a leaving customer keeps their spot while walking off. */
const DEPARTURE_MS = 1_300;

export function createInitialState(seed: number): GameState {
  return { ...buildDay(1, seed), phase: 'title' };
}

function buildDay(day: number, seed: number): GameState {
  const config = getDayConfig(day);
  return {
    phase: 'playing',
    paused: false,
    day,
    config,
    clock: 0,
    coins: 0,
    slots: Array.from({ length: config.slots }, () => null),
    selectedSlot: null,
    cup: EMPTY_DRINK,
    cupId: 1,
    discarded: null,
    activeCategory: config.categories[0],
    nextSpawnAt: FIRST_CUSTOMER_AT_MS,
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
      return buildDay(action.day, state.seed);
    case 'GO_TO_TITLE':
      return { ...state, phase: 'title', paused: false };
    case 'SET_PAUSED':
      return state.phase === 'playing' ? { ...state, paused: action.paused } : state;
    case 'TICK':
      return tick(state, action.dt);
    case 'SELECT_SLOT':
      return isActive(state) && state.slots[action.slot]
        ? { ...state, selectedSlot: action.slot }
        : state;
    case 'SET_CATEGORY':
      return isActive(state) ? { ...state, activeCategory: action.category } : state;
    case 'PICK':
      return isActive(state) ? pick(state, action.category, action.optionId) : state;
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
  const clock = state.clock + dt;
  const rng = createRng(state.seed);
  const slots = [...state.slots];
  const feedback = state.feedback.filter((item) => item.expiresAt > clock);
  const departures = state.departures.filter((item) => clock - item.at < DEPARTURE_MS);
  let { nextId, nextSpawnAt } = state;
  let missed = 0;

  slots.forEach((customer, slot) => {
    if (customer && clock - customer.arrivedAt >= customer.patienceMs) {
      slots[slot] = null;
      missed += 1;
      feedback.push({ id: nextId++, slot, text: 'Chậm quá! 😤', tone: 'bad', expiresAt: clock + FEEDBACK_MS });
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
        arrivedAt: clock,
        patienceMs: config.patienceMs,
      };
      nextSpawnAt = clock + rng.int(config.spawnMinMs, config.spawnMaxMs);
    } else {
      nextSpawnAt = clock + RETRY_SPAWN_MS;
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

/** Keep the current selection if that customer is still there, else pick whoever has waited longest. */
function resolveSelection(slots: (Customer | null)[], current: number | null): number | null {
  if (current !== null && slots[current]) return current;
  let best: number | null = null;
  let bestArrival = Infinity;
  for (let slot = 0; slot < slots.length; slot++) {
    const customer = slots[slot];
    if (customer && customer.arrivedAt < bestArrival) {
      best = slot;
      bestArrival = customer.arrivedAt;
    }
  }
  return best;
}

function isFilled(cup: Drink, category: CategoryId) {
  return category === 'toppings' ? cup.toppings.length > 0 : cup[category] !== null;
}

function nextCategory(categories: CategoryId[], current: CategoryId, cup: Drink): CategoryId {
  const start = categories.indexOf(current);
  for (let step = 1; step < categories.length; step++) {
    const candidate = categories[(start + step) % categories.length];
    if (!isFilled(cup, candidate)) return candidate;
  }
  return current;
}

function pick(state: GameState, category: CategoryId, optionId: string): GameState {
  const { config } = state;
  let cup: Drink;
  let categoryDone = true;

  if (category === 'toppings') {
    const alreadyIn = state.cup.toppings.includes(optionId);
    // Tapping a topping toggles it; going over the limit drops the oldest one.
    const toppings = alreadyIn
      ? state.cup.toppings.filter((id) => id !== optionId)
      : [...state.cup.toppings, optionId].slice(-config.maxToppings);
    cup = { ...state.cup, toppings };
    categoryDone = !alreadyIn && toppings.length >= config.maxToppings;
  } else {
    cup = { ...state.cup, [category]: optionId };
  }

  return {
    ...state,
    cup,
    activeCategory: categoryDone ? nextCategory(config.categories, category, cup) : category,
  };
}

function isCupEmpty(cup: Drink) {
  return cup.toppings.length === 0 && Object.values(cup).every((value) => !value || Array.isArray(value));
}

function clearCup(state: GameState): GameState {
  if (isCupEmpty(state.cup)) return state;
  return {
    ...state,
    cup: EMPTY_DRINK,
    cupId: state.cupId + 1,
    discarded: { id: state.nextId, drink: state.cup },
    nextId: state.nextId + 1,
    activeCategory: state.config.categories[0],
  };
}

function serve(state: GameState): GameState {
  const slot = state.selectedSlot;
  const customer = slot === null ? null : state.slots[slot];
  if (slot === null || !customer || !state.cup.tea) return state;

  const { quality } = evaluateDrink(state.cup, customer.order, state.config.categories);
  const price = drinkPrice(customer.order);
  const patienceLeft = Math.max(0, 1 - (state.clock - customer.arrivedAt) / customer.patienceMs);

  let earned = 0;
  let tip = 0;
  let text: string;
  let tone: Tone;
  if (quality === 'perfect') {
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
    cupId: state.cupId + 1,
    activeCategory: state.config.categories[0],
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
      perfect: state.stats.perfect + (quality === 'perfect' ? 1 : 0),
      tips: state.stats.tips + tip,
    },
  };
}
