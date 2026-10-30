import { ARRIVAL_LINES, CustomerKind, CustomerLook, generateLook, generateLookOf, kindOf, NAMES } from './customers';
import { BOARD_SLOT, gearItem } from './gear';
import {
  Drink,
  CupSize,
  EMPTY_DRINK,
  iceLevelForScoops,
  isCupSize,
  MAX_ICE_SCOOPS,
  SUGAR_STEPS,
  sweetnessForPumps,
} from './ingredients';
import { DayConfig, getDayConfig } from './levels';
import { drinkPrice, evaluateDrink, generateOrder } from './orders';
import { createRng } from './random';
import { Recall, Regular, RegularMemory, regularById, regularDue, rollUsual } from './regulars';
import {
  burnJar,
  closesAt,
  forfeitJar,
  inOvertime,
  jarPayout,
  lineWaitMs,
  OVERTIME_FROM_DAY,
  OVERTIME_MAX_ROUNDS,
  OVERTIME_WINDOW_MS,
  patienceFor,
  payoutFor,
  SAY_MS,
  walkoutFor,
  WAVE_GAP_MAX_MS,
  WAVE_GAP_MIN_MS,
} from './rules';

export type Phase = 'title' | 'playing' | 'dayEnd';
/** `say` is a customer talking rather than the shop keeping score. */
export type Tone = 'good' | 'ok' | 'bad' | 'say';
export type Outcome = 'perfect' | 'close' | 'wrong' | 'timeout';
/** `requesting` = waiting for the player to take the order; `ordered` = waiting for the drink. */
export type CustomerStatus = 'requesting' | 'ordered';
/**
 * How the shop is run. `standard` is the whole job: every order is taken by hand at the counter and
 * customers come in groups, with a quiet between them. `relaxed` takes the orders for you and keeps
 * someone standing in every free spot, so the day is nothing but preparation.
 */
export type GameMode = 'standard' | 'relaxed';

/**
 * How loud the shop is, as two independent halves of the mix, each 0–1.
 *
 * This lives in game state for the same reasons `mode` does: `SET_AUDIO` can be sent from any
 * screen, `START_DAY` carries it to the next day, and it rides along in the save, so the volume a
 * shop was last played at is the one it reopens at. It is kept here rather than in
 * `src/audio/` because this file must stay free of anything a browser provides —
 * `tools/check-save.cjs` and `check-serving.cjs` load the reducer in plain Node, and an import
 * that reaches for an `AudioContext` would end that.
 */
export interface AudioSettings {
  /** The looping music under the screen. */
  music: number;
  /** Everything else: taps, the kitchen, the till. */
  sfx: number;
}

/** Music a little under the effects: it plays continuously, and they do not. */
export const DEFAULT_AUDIO: AudioSettings = { music: 0.7, sfx: 1 };

/** Volumes arrive from a save that can be hand-edited, so this is the one gate on them. */
export function clampAudio(audio: AudioSettings): AudioSettings {
  const level = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
  return { music: level(audio.music), sfx: level(audio.sfx) };
}

export interface Customer {
  id: number;
  look: CustomerLook;
  name: string;
  order: Drink;
  status: CustomerStatus;
  /**
   * When they walked up; drives the order-taking patience. For someone in the line outside it is when
   * they joined it, and it starts again when they reach the counter, because that is when anyone there
   * can see them.
   */
  arrivedAt: number;
  /** How long they'll wait for their order to be taken. */
  orderPatienceMs: number;
  /** When the order was taken; null until then. Drives the serve patience. */
  orderedAt: number | null;
  /**
   * When the order was really taken, once a change of mode has moved `orderedAt` to keep their share
   * of patience. `orderedAt` then measures how long they have left and no longer says who came first.
   */
  queuedAt?: number;
  /** How long they'll wait for the finished drink after ordering. */
  patienceMs: number;
  /**
   * Which round they came in on, if they came in after the player pressed to stay open. Nothing such
   * a customer does reaches the day's stats, which is how the day proper keeps its stars whatever
   * happens late; only the jar has a stake in them. It is also what their patience was worked out
   * from, and it is theirs: a later press does not touch them, so a change of mode has to find it
   * here and not on the shop.
   */
  lateRound?: number;
  /** One of the shop's regulars. `id` starts again every day, so this is what finds their memory. */
  regularId?: string;
  /** Set when this customer's order is a usual the player has to remember. See `orderVisible`. */
  recall?: Recall;
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
  /** What they paid went into the overtime jar, so the coins fly there and not to the till. */
  toJar?: true;
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
  lidded: boolean;
  straw: boolean;
  /** The cup is inside the lidding machine until its cycle finishes or it is pulled out. */
  inLidder: boolean;
}

const EMPTY_BUILD: CupBuild = { fill: 0, spilled: false, iceScoops: 0, sugarPumps: 0, lidded: false, straw: false, inLidder: false };

export interface DayStats {
  served: number;
  perfect: number;
  missed: number;
  tips: number;
}

/**
 * Staying open past closing, one day's worth. The rules that read it are in `rules.ts`; this is what
 * they keep. It is reset with the day, and it is saved, because a day can be put down in the middle.
 */
export interface Overtime {
  /** How many times the player has pressed today. */
  rounds: number;
  /** What the late sales have made, held apart from the till until closing. */
  jar: number;
  /** A customer walked out on it: half of it and the bonus are gone, and there are no more rounds. */
  lost: boolean;
  /** What the jar put in the till at closing, bonus included. 0 until then, and it keeps `jar` as it was. */
  paid: number;
  /**
   * The shop went relaxed with a round running. That was its way out of the risk, so it costs what the
   * risk was for: the bonus and any further round, for the rest of the day, even if it switches back.
   * Only ever true, and kept here rather than read off `mode`, because the mode can be changed back.
   */
  forfeited?: true;
}

export const NO_OVERTIME: Overtime = { rounds: 0, jar: 0, lost: false, paid: 0 };

export interface GameState {
  phase: Phase;
  paused: boolean;
  mode: GameMode;
  /** How loud the shop is. Set from the settings card, carried across days, saved. */
  audio: AudioSettings;
  /** Which introductions the opening sign has already given this shop. See `dayNews`. */
  seen: string[];
  /** What the shop has bought. See `gear.ts`: each item's effect reads this where it happens. */
  gear: string[];
  /** Everyone the shop has met that it will see again, by `Regular.id`. See `regulars.ts`. */
  regulars: Record<string, RegularMemory>;
  day: number;
  config: DayConfig;
  /** Game time in ms since the day started; only advances while playing. */
  clock: number;
  /** Taken at the counter *today*, and reset by `START_DAY`. The day-end tally reports this. */
  coins: number;
  /**
   * Everything the shop has ever earned and not spent — see "The shop's money" in CLAUDE.md. It
   * carries across days and survives going back to the menu, because it is the player's, not the
   * run's; `spend` is the only thing that takes any out.
   */
  money: number;
  slots: (Customer | null)[];
  selectedSlot: number | null;
  cup: Drink;
  /** The physical state of that cup: how full it is, scoops, pumps, spills. */
  build: CupBuild;
  /** Changes when a cup is picked, served or discarded, resetting transient gestures. */
  cupId: number;
  /** The last cup thrown in the bin, for the toss animation. */
  discarded: { id: number; drink: Drink } | null;
  nextSpawnAt: number;
  nextId: number;
  stats: DayStats;
  feedback: Feedback[];
  departures: Departure[];
  overtime: Overtime;
  /** How many of the current group have yet to come in. */
  waveLeft: number;
  /** When the quiet ends and the next group comes in. Behind the clock while there is no quiet. */
  lullUntil: number;
  /** Who is on the way, as far as has been announced. A round's group comes unannounced, so `waveLeft` can be more. */
  incoming: CustomerKind[];
  /** Whoever came in with no spot free, oldest first. They reach the counter as spots come free. */
  line: Customer[];
  /** How many gave up in the line today. Nothing holds it against the shop: they never reached the counter. */
  lost: number;
  seed: number;
}

export type GameAction =
  | { type: 'START_DAY'; day: number }
  | { type: 'GO_TO_TITLE' }
  | { type: 'RESUME_DAY' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_MODE'; mode: GameMode }
  /** Change one or both volumes. An out-of-range value is clamped, not refused. */
  | { type: 'SET_AUDIO'; audio: Partial<AudioSettings> }
  /** The opening sign has been read: don't introduce these again. */
  | { type: 'NOTE_NEWS'; ids: string[] }
  /**
   * Put a whole shop back, from a backup code the player pasted in. `state` has already been
   * through `parseGame`, which is the only thing that is allowed to build one out of text — so
   * this takes it as it stands rather than validating it a second time in a second place.
   */
  | { type: 'RESTORE'; state: GameState }
  | { type: 'TICK'; dt: number }
  | { type: 'TAKE_ORDER'; slot: number }
  /** "Hỏi lại": show this usual after all, for the price of the tip. */
  | { type: 'ASK_AGAIN'; slot: number }
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'PICK_CUP'; size: CupSize }
  /** Held a spigot open over the cup: `amount` is the fraction of the cup that ran in. */
  | { type: 'POUR'; category: 'tea' | 'milk'; optionId: string; amount: number }
  /** One scoop/spoon of a solid straight into the cup. */
  | { type: 'SCOOP'; category: 'toppings' | 'foam'; optionId: string }
  | { type: 'ICE_SCOOP' }
  | { type: 'SUGAR_PUMP' }
  | { type: 'LID_CUP' }
  | { type: 'LOAD_LIDDER' }
  | { type: 'UNLOAD_LIDDER' }
  | { type: 'ADD_STRAW' }
  | { type: 'CLEAR_CUP' }
  | { type: 'SERVE' }
  /** Stay open another round. Refused unless `canExtend`. */
  | { type: 'EXTEND_SHIFT' }
  /** Buy something for the shop, off the day-end card: refused outright if it cannot afford it. */
  | { type: 'BUY_GEAR'; id: string };

const FIRST_CUSTOMER_AT_MS = 1_200;
const FEEDBACK_MS = 1_400;
/** How long a leaving customer keeps their spot while walking off. */
const DEPARTURE_MS = 1_300;

/**
 * Whether the shop has a shift waiting at the menu to be taken up again. Everything a day is made
 * of survives `GO_TO_TITLE`, so this is what tells the menu to offer that day back rather than
 * build it over the top: a day is under way once its clock has moved, and — for the shift that is
 * only a few frames old — once there is a cup out or a customer at the counter.
 */
export function suspendedShift(state: GameState): boolean {
  return state.phase === 'title'
    && (state.clock > 0 || state.cup.size !== null || state.slots.some(Boolean));
}

export function createInitialState(seed: number): GameState {
  return { ...buildDay(1, seed, { mode: 'standard', money: 0, audio: DEFAULT_AUDIO, seen: [], gear: [], regulars: {} }), phase: 'title' };
}

/** What belongs to the shop rather than to one day, and so outlives `buildDay`. */
type Carried = Pick<GameState, 'mode' | 'money' | 'audio' | 'seen' | 'gear' | 'regulars'>;

/** The one reading of it, so that `START_DAY` and leaving a finished day cannot disagree. */
function carried({ mode, money, audio, seen, gear, regulars }: GameState): Carried {
  return { mode, money, audio, seen, gear, regulars };
}

/**
 * A day, ready to open. **This does not run once a day**: leaving a finished day builds the next
 * one for the menu, and the menu's button builds it again. So nothing in here may roll, charge or
 * decay anything.
 */
function buildDay(day: number, seed: number, keep: Carried): GameState {
  const config = getDayConfig(day);
  return {
    ...keep,
    phase: 'playing',
    paused: false,
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
    nextSpawnAt: keep.mode === 'relaxed' ? 0 : FIRST_CUSTOMER_AT_MS,
    nextId: 1,
    stats: { served: 0, perfect: 0, missed: 0, tips: 0 },
    feedback: [],
    departures: [],
    overtime: NO_OVERTIME,
    waveLeft: 0,
    lullUntil: 0,
    incoming: [],
    line: [],
    lost: 0,
    seed,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_DAY':
      return buildDay(action.day, state.seed, carried(state));
    case 'GO_TO_TITLE':
      // Going to the menu **puts the shift down, it does not end it**: the clock, the counter, the
      // cup and the day's takings all stay in the state, so `RESUME_DAY` can hand them back. A day
      // that is already *finished* has nothing to come back to, so leaving one builds the next day
      // instead — un-started, ready for the menu to open.
      return state.phase === 'dayEnd'
        ? { ...buildDay(state.day + 1, state.seed, carried(state)), phase: 'title' }
        : { ...state, phase: 'title', paused: false };
    case 'RESUME_DAY':
      // Straight back to the minute the player left, and running: the clock cannot tick at the
      // menu (`tickable` is false there), so nothing ran down while they were away, and they have
      // just pressed a button that says carry on. That is the difference between this and a shop
      // reopened from a save, which comes back behind the pause card.
      return suspendedShift(state) ? { ...state, phase: 'playing', paused: false } : state;
    case 'SET_PAUSED':
      return state.phase === 'playing' ? { ...state, paused: action.paused } : state;
    case 'SET_MODE':
      return setMode(state, action.mode);
    case 'SET_AUDIO':
      return { ...state, audio: clampAudio({ ...state.audio, ...action.audio }) };
    case 'NOTE_NEWS':
      return noteNews(state, action.ids);
    case 'RESTORE':
      // Everything, including the phase: a code holding a half-built cup comes back to that cup.
      // `parseGame` has already made a restored shift paused, so this cannot drop the player into
      // three patience timers they did not ask for.
      return action.state;
    case 'TICK':
      return tick(state, action.dt);
    case 'TAKE_ORDER':
      return isActive(state) ? takeOrder(state, action.slot) : state;
    case 'ASK_AGAIN':
      return isActive(state) ? askAgain(state, action.slot) : state;
    case 'SELECT_SLOT':
      return isActive(state) && state.slots[action.slot]?.status === 'ordered'
        ? { ...state, selectedSlot: action.slot }
        : state;
    case 'PICK_CUP':
      return isActive(state) && !state.cup.size && isCupSize(action.size)
        ? { ...state, cup: { ...EMPTY_DRINK, size: action.size, toppings: [] }, build: EMPTY_BUILD, cupId: state.cupId + 1 }
        : state;
    case 'POUR':
      return canAddIngredients(state) ? pour(state, action.category, action.optionId, action.amount) : state;
    case 'SCOOP':
      return canAddIngredients(state) ? scoop(state, action.category, action.optionId) : state;
    case 'ICE_SCOOP':
      return canAddIngredients(state) ? iceScoop(state) : state;
    case 'SUGAR_PUMP':
      return canAddIngredients(state) ? sugarPump(state) : state;
    case 'LOAD_LIDDER':
      return isActive(state) && state.cup.size && state.cup.tea && !state.build.lidded
        && !state.build.inLidder
        ? { ...state, build: { ...state.build, inLidder: true } } : state;
    case 'UNLOAD_LIDDER':
      return isActive(state) && state.build.inLidder
        ? { ...state, build: { ...state.build, inLidder: false } } : state;
    case 'LID_CUP':
      return isActive(state) && state.cup.size && state.cup.tea && state.build.inLidder && !state.build.lidded
        ? { ...state, build: { ...state.build, lidded: true, inLidder: false } } : state;
    case 'ADD_STRAW':
      return isActive(state) && state.cup.size && state.build.lidded && !state.build.inLidder && !state.build.straw
        ? { ...state, build: { ...state.build, straw: true } } : state;
    case 'CLEAR_CUP':
      return isActive(state) ? clearCup(state) : state;
    case 'SERVE':
      return isActive(state) ? serve(state) : state;
    case 'EXTEND_SHIFT':
      return canExtend(state) ? extendShift(state) : state;
    case 'BUY_GEAR':
      return buyGear(state, action.id);
  }
}

/**
 * Whether the shop can pay `price`. The shop never goes into debt, so this is the one gate — and
 * prices are whole units of money (`formatMoney` is what turns them into đồng), so half of one is
 * not a price.
 */
export function canAfford(state: GameState, price: number): boolean {
  return Number.isInteger(price) && price >= 0 && price <= state.money;
}

/**
 * Take money out of the till. Every purchase goes through here, so that the balance has exactly one
 * way down. `canAfford` is the refusal, asked first, so that it is in the game's logic rather than
 * in whichever screen asked.
 */
function spend(state: GameState, amount: number): GameState {
  return { ...state, money: state.money - amount };
}

/**
 * Buy something for the shop. Only on the day-end card, where it cannot be done with a customer
 * waiting. Each item is bought once and kept: there is nothing to sell it back to.
 */
function buyGear(state: GameState, id: string): GameState {
  const item = gearItem(id);
  if (state.phase !== 'dayEnd' || !item || state.gear.includes(id) || !canAfford(state, item.price)) return state;
  return { ...spend(state, item.price), gear: [...state.gear, id] };
}

function noteNews(state: GameState, ids: string[]): GameState {
  const fresh = ids.filter((id) => !state.seen.includes(id));
  return fresh.length > 0 ? { ...state, seen: [...state.seen, ...fresh] } : state;
}

function isActive(state: GameState) {
  return state.phase === 'playing' && !state.paused;
}

function canAddIngredients(state: GameState): boolean {
  return isActive(state) && Boolean(state.cup.size) && !state.build.lidded && !state.build.inLidder;
}

/** Shared by the serve button and reducer so unfinished cups cannot bypass the station. */
export function canServe(state: GameState): boolean {
  const customer = state.selectedSlot === null ? null : state.slots[state.selectedSlot];
  return Boolean(customer?.status === 'ordered' && state.cup.size && state.cup.tea
    && state.build.lidded && state.build.straw && !state.build.inLidder);
}

/**
 * Whether the player may keep the shop open another round: late in the day, late enough, and not
 * after a walkout has cost them the jar or a trip through relaxed has cost them the bonus. The relaxed
 * shop promised no pressure, so it is never asked.
 * Shared by the pill and the reducer, like `canServe`.
 */
export function canExtend(state: GameState): boolean {
  const { clock, day, mode, overtime } = state;
  const closes = closesAt(state);
  return isActive(state) && mode === 'standard' && day >= OVERTIME_FROM_DAY && !overtime.lost && !overtime.forfeited
    && overtime.rounds < OVERTIME_MAX_ROUNDS && clock < closes && closes - clock <= OVERTIME_WINDOW_MS;
}

/**
 * One more round, and one more group, at once. A group already waiting behind a quiet is that group:
 * it comes now, rather than a second one coming over the top of it. No other wave starts after this,
 * so what the player pressed for is all that is coming, and it can be judged.
 */
function extendShift(state: GameState): GameState {
  const { clock, lullUntil, nextSpawnAt, overtime, waveLeft } = state;
  return {
    ...state,
    overtime: { ...overtime, rounds: overtime.rounds + 1 },
    waveLeft: clock < lullUntil ? waveLeft : waveLeft + state.config.waveSize,
    lullUntil: 0,
    nextSpawnAt: Math.min(nextSpawnAt, clock),
  };
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
  let { incoming, lost, lullUntil, nextId, nextSpawnAt, overtime, regulars, waveLeft } = state;
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
      const walkout = walkoutFor(customer.look, customer.status === 'requesting');
      if (walkout.missed && customer.lateRound === undefined) missed += 1;
      if (walkout.burns) overtime = burnJar(overtime);
      feedback.push({ id: nextId++, slot, text: walkout.text, tone: walkout.tone, expiresAt: clock + FEEDBACK_MS });
      departures.push({ id: nextId++, customer, slot, outcome: 'timeout', earned: 0, drink: null, at: clock });
    }
  });

  // Whoever has waited outside long enough goes home, quietly: they never reached the counter, so
  // nothing about it reaches the stars, the jar or the player's ears.
  const patienceOutside = lineWaitMs(state);
  const line = state.line.filter((customer) => clock - customer.arrivedAt < patienceOutside);
  lost += state.line.length - line.length;

  /**
   * Someone new, not yet anywhere. Real patience, because the line is saved and a save checks it. The
   * keys are in the order `parseCustomer` writes them: a backup code is the very bytes of the save.
   */
  const stranger = (look: CustomerLook, name = rng.pick(NAMES), order = generateOrder(config, rng)): Customer => {
    const { orderPatienceMs, patienceMs } = patienceFor(state, look, { rounds: overtime.rounds });
    return {
      id: nextId++,
      look,
      name,
      order,
      status: 'requesting',
      arrivedAt: clock,
      orderPatienceMs,
      orderedAt: null,
      patienceMs,
      ...(overtime.rounds > 0 ? { lateRound: overtime.rounds } : {}),
    };
  };

  /**
   * One of the regulars, in for the day. Only someone who has been handed a drink before has a usual
   * to ask for: one who gave up before ever getting theirs is still ordering it for the first time.
   */
  const returning = ({ id, look, name }: Regular): Customer => {
    const memory = regulars[id];
    const usual = memory?.usual ?? rollUsual(config, rng);
    regulars = { ...regulars, [id]: { usual, visits: memory?.visits ?? 0, streak: memory?.streak ?? 0, lastDay: state.day } };
    return { ...stranger(look, name, usual), regularId: id, ...(memory?.visits ? { recall: 'blank' as const } : {}) };
  };

  /**
   * Whoever comes through the door next. The day's regular takes the place if it can be theirs. A
   * spot has to be free, because someone who gave up in the line would be a visit nobody saw, and the
   * place cannot have been announced as anything else, because the quiet said who was coming.
   */
  const comingIn = (spotFree: boolean, kind?: CustomerKind): Customer => {
    const regular = spotFree && (!kind || kind === 'plain') ? regularDue(state, clock) : null;
    return regular ? returning(regular) : stranger(kind ? generateLookOf(rng, kind) : generateLook(rng));
  };

  /**
   * Bring someone to a spot. This is where they start waiting and where they say hello, and their
   * patience is worked out again because the shop may have changed how it runs while they were outside.
   */
  const toCounter = (customer: Customer, spot: number) => {
    // Nobody has to come over for this one: the relaxed shop takes every order, the board one spot's.
    const ordered = auto || (spot === BOARD_SLOT && state.gear.includes('board'));
    slots[spot] = {
      ...customer,
      ...patienceFor(state, customer.look, { rounds: customer.lateRound ?? 0 }),
      status: ordered ? 'ordered' : 'requesting',
      arrivedAt: clock,
      orderedAt: ordered ? clock : null,
    };
    const line = regularById(customer.regularId)?.line ?? rng.pick(ARRIVAL_LINES[kindOf(customer.look)]);
    feedback.push({ id: nextId++, slot: spot, text: line, tone: 'say', expiresAt: clock + SAY_MS });
  };

  // A spot someone is walking away from is not free yet, for the line or for anyone else.
  const leaving = new Set(departures.map((item) => item.slot));
  const freeSpots = () => slots.flatMap((customer, slot) => (customer || leaving.has(slot) ? [] : [slot]));
  for (let free = freeSpots(); line.length > 0 && free.length > 0; free = freeSpots()) {
    toCounter(line.shift()!, rng.pick(free));
  }

  // After closing time no one new comes in, but waiting customers can still be served. A group that
  // had not yet come through the door stays away; one already coming in finishes coming in. Read off
  // the clock this tick started from, or one that steps over closing and the end of the quiet together
  // would find the quiet already over and let the whole group in after closing.
  const isOpen = clock < closesAt(state);
  if (!isOpen && state.clock < lullUntil) {
    waveLeft = 0;
    lullUntil = 0;
    incoming = [];
  }

  if (auto) {
    const free = freeSpots();
    // A press is the end of arrivals in this shop too. What the player pressed for is all that is coming
    // in either mode, or going relaxed after a press would fill every spot until the extended closing.
    if (isOpen && overtime.rounds === 0 && clock >= nextSpawnAt && free.length > 0) toCounter(comingIn(true), rng.pick(free));
    if (clock >= nextSpawnAt) nextSpawnAt = clock;
  } else if (clock >= nextSpawnAt) {
    // **The counter clearing is the trigger**, and a clock is not: a slower player gets fewer groups
    // rather than more pressure. Tried on a fixed clock, the shop's output stayed flat and a slow
    // player lost thirteen customers.
    const clear = waveLeft === 0 && line.length === 0 && slots.every((customer) => customer === null);
    if (clear && overtime.rounds === 0 && clock < config.durationMs) {
      waveLeft = config.waveSize;
      // The day's first group is the shop opening, which is no quiet and has nothing to preview. An
      // id is only ever spent on a customer or on something one of them caused.
      if (state.nextId > 1) {
        lullUntil = clock + rng.int(config.lullMinMs, config.lullMaxMs);
        incoming = Array.from({ length: waveLeft }, () => kindOf(generateLook(rng)));
        // A regular can only take a place announced as plain, so a group without one would turn a due
        // visit away. It has to be one of those who will find a spot: this group has an empty counter.
        if (regularDue(state, clock) && !incoming.slice(0, config.slots).includes('plain')) incoming[0] = 'plain';
      }
    }
    if (waveLeft > 0 && clock >= lullUntil) {
      const [kind, ...rest] = incoming;
      const free = freeSpots();
      const customer = comingIn(free.length > 0, kind);
      if (free.length > 0) toCounter(customer, rng.pick(free));
      else line.push(customer);
      waveLeft -= 1;
      incoming = rest;
      nextSpawnAt = clock + rng.int(WAVE_GAP_MIN_MS, WAVE_GAP_MAX_MS);
    }
  }

  const dayOver = !isOpen && departures.length === 0 && waveLeft === 0 && line.length === 0
    && slots.every((customer) => customer === null);
  // This tick is the only one that ends the day, so the jar cannot be paid twice.
  const paid = dayOver ? jarPayout(overtime) : 0;
  return {
    ...state,
    phase: dayOver ? 'dayEnd' : state.phase,
    clock,
    coins: state.coins + paid,
    money: state.money + paid,
    // Handed back as the very same arrays when nothing in them moved. A tick is ten times a
    // second and almost every one of them changes nothing but the clock, so a fresh copy each
    // time told every list on both screens that it had new contents to draw — and on a phone
    // that is the difference between a drag that follows the finger and one that catches up with
    // it afterwards. The copies above are still made, because this one does the pushing.
    slots: unchanged(state.slots, slots),
    feedback: unchanged(state.feedback, feedback),
    departures: unchanged(state.departures, departures),
    line: unchanged(state.line, line),
    incoming,
    lost,
    lullUntil,
    nextId,
    nextSpawnAt,
    overtime: paid > 0 ? { ...overtime, paid } : overtime,
    regulars,
    waveLeft,
    seed: rng.seed,
    selectedSlot: resolveSelection(slots, state.selectedSlot),
    stats: missed > 0 ? { ...state.stats, missed: state.stats.missed + missed } : state.stats,
  };
}

/**
 * How much patience a customer has left for whichever stage they are waiting in, 1 to 0. It reads
 * the same two clocks the timeout above does, so the ring beside a customer empties exactly as
 * their limit runs out.
 *
 * **It is rounded to a fiftieth, and that is the point.** This number is drawn as a ring 20px
 * across and a heart of 26, where a fiftieth is half a pixel; handed the raw fraction, both of
 * them were rebuilt ten times a second, for every customer on the counter, all day, to move
 * something nobody can see. Rounding it lets `memo` do its job.
 */
export function patienceLeft(customer: Customer, clock: number): number {
  const requesting = customer.status === 'requesting';
  const since = requesting ? customer.arrivedAt : customer.orderedAt ?? customer.arrivedAt;
  const limit = requesting ? customer.orderPatienceMs : customer.patienceMs;
  return Math.round(Math.max(0, 1 - (clock - since) / limit) * 50) / 50;
}

/** The original list if the copy holds exactly the same things in the same order, else the copy. */
function unchanged<T>(before: readonly T[], after: T[]): T[] {
  return before.length === after.length && before.every((item, i) => item === after[i])
    ? (before as T[])
    : after;
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
    const orderedAt = customer?.queuedAt ?? customer?.orderedAt ?? 0;
    if (customer?.status === 'ordered' && orderedAt < bestOrderedAt) {
      best = slot;
      bestOrderedAt = orderedAt;
    }
  }
  return best;
}

/**
 * Change how the shop is run, mid-day if need be. Everyone at the counter takes the patience the
 * new shop gives them, in both directions: going relaxed leaves no half-patience shipper in a shop
 * that promised no pressure, and coming back leaves no relaxed customer in a standard one, or a trip
 * through the settings would take the pressure off a whole counter for nothing. Switching to
 * `relaxed` also takes the order of everyone still waiting — nobody is coming to take it by hand any
 * more — and brings the next arrival forward to now, in place of any group still to come. Whoever is
 * already outside comes in as spots free up, and that shop takes their order as they do.
 */
function setMode(state: GameState, mode: GameMode): GameState {
  if (mode === state.mode) return state;
  const slots = state.slots.map((customer) => customer && changeShop(state, customer, mode));
  return {
    ...state,
    mode,
    slots,
    overtime: mode === 'relaxed' ? forfeitJar(state.overtime) : state.overtime,
    ...(mode === 'relaxed' ? { waveLeft: 0, lullUntil: 0, incoming: [] } : {}),
    nextSpawnAt: mode === 'relaxed' ? Math.min(state.nextSpawnAt, state.clock) : state.nextSpawnAt,
    selectedSlot: resolveSelection(slots, state.selectedSlot),
  };
}

/**
 * Someone at the counter as the shop changes how it runs. One whose wait gets *shorter* and who has
 * already waited past the new limit must not walk out on the spot because the player opened the
 * settings. So the time already waited is scaled with the limit, which holds their share of patience
 * where it was, ring and face and tip included. That moves `orderedAt`, so `queuedAt` keeps their
 * place in the queue: going relaxed must not bring the most urgent ticket to the front, which is
 * the choice kinds exist to leave to the player. The clamp is not tidiness: a wait that grows moves
 * its start back, and a time before opening is a save `parseCustomer` refuses.
 */
function changeShop(state: GameState, customer: Customer, mode: GameMode): Customer {
  const { clock } = state;
  const patience = patienceFor(state, customer.look, { mode, rounds: customer.lateRound ?? 0 });
  // Only going relaxed finds anyone here: a relaxed shop has nobody waiting to order.
  if (customer.status === 'requesting') return { ...customer, ...patience, status: 'ordered', orderedAt: clock };
  if (patience.patienceMs === customer.patienceMs) return { ...customer, ...patience };
  const since = customer.orderedAt ?? customer.arrivedAt;
  const orderedAt = Math.max(0, since + (clock - since) * (1 - patience.patienceMs / customer.patienceMs));
  return { ...customer, ...patience, orderedAt, queuedAt: customer.queuedAt ?? since };
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
      ...hushed(state.feedback, slot),
      { id: state.nextId, slot, text: 'Đã nhận order ✓', tone: 'good', expiresAt: state.clock + FEEDBACK_MS },
    ],
  };
}

/**
 * Give up on remembering. What that costs is settled when the cup is handed over, in `payoutFor`. The
 * order has to have been taken: it is a thing the player asks at the ticket, not at the door.
 */
function askAgain(state: GameState, slot: number): GameState {
  const customer = state.slots[slot];
  if (customer?.status !== 'ordered' || customer.recall !== 'blank') return state;
  const slots = [...state.slots];
  slots[slot] = { ...customer, recall: 'asked' };
  return { ...state, slots };
}

/**
 * A customer's arrival line gives way to whatever the shop has to say at that spot. The two share
 * the space over the customer, and the line lasts long enough to still be up when a quick player
 * takes the order.
 */
function hushed(feedback: Feedback[], slot: number): Feedback[] {
  return feedback.filter((item) => item.tone !== 'say' || item.slot !== slot);
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

function clearCup(state: GameState): GameState {
  if (!state.cup.size) return state;
  return {
    ...state,
    cup: EMPTY_DRINK,
    build: EMPTY_BUILD,
    cupId: state.cupId + 1,
    discarded: { id: state.cupId + 1, drink: state.cup },
  };
}

function serve(state: GameState): GameState {
  const slot = state.selectedSlot;
  const customer = slot === null ? null : state.slots[slot];
  if (!canServe(state) || slot === null || !customer) return state;

  const { quality } = evaluateDrink(state.cup, customer.order, state.config.categories);
  const price = drinkPrice(customer.order);
  const orderedAt = customer.orderedAt ?? customer.arrivedAt;
  const patienceLeft = Math.max(0, 1 - (state.clock - orderedAt) / customer.patienceMs);
  const neat = !state.build.spilled;
  const memory = customer.regularId ? state.regulars[customer.regularId] : undefined;
  const regular = memory && { recall: customer.recall, streak: memory.streak };
  const { earned, tip, text, tone, streak } = payoutFor({ quality, neat, price, patienceLeft, look: customer.look, regular });
  // A wrong drink is not a drink sold, it is a customer let down, and it counts as one. Leaving it
  // out of `served` was not enough: nothing would be held against the shop, and one good cup and
  // twenty-five wrong ones would still come to three stars.
  const wrong = quality === 'wrong';
  // A sale after closing is held in the jar, tip and all, until the shop has closed clean. A burnt jar
  // takes nothing more: the rest of the night pays the till.
  const toJar = inOvertime(state) && !state.overtime.lost;
  const till = toJar ? 0 : earned;

  const slots = [...state.slots];
  slots[slot] = null;
  return {
    ...state,
    slots,
    coins: state.coins + till,
    money: state.money + till,
    overtime: toJar ? { ...state.overtime, jar: state.overtime.jar + earned } : state.overtime,
    // Any cup counts as a visit, whatever became of the streak: they were served.
    regulars: memory && customer.regularId
      ? { ...state.regulars, [customer.regularId]: { ...memory, visits: memory.visits + 1, streak: streak ?? memory.streak } }
      : state.regulars,
    cup: EMPTY_DRINK,
    build: EMPTY_BUILD,
    cupId: state.cupId + 1,
    selectedSlot: resolveSelection(slots, null),
    nextId: state.nextId + 2,
    feedback: [
      ...hushed(state.feedback, slot),
      { id: state.nextId, slot, text, tone, expiresAt: state.clock + FEEDBACK_MS },
    ],
    departures: [
      ...state.departures,
      {
        id: state.nextId + 1, customer, slot, outcome: quality, earned, drink: state.cup, at: state.clock,
        ...(toJar ? { toJar: true as const } : {}),
      },
    ],
    stats: customer.lateRound !== undefined ? state.stats : {
      ...state.stats,
      served: state.stats.served + (wrong ? 0 : 1),
      missed: state.stats.missed + (wrong ? 1 : 0),
      perfect: state.stats.perfect + (quality === 'perfect' && neat ? 1 : 0),
      tips: state.stats.tips + (toJar ? 0 : tip),
    },
  };
}
