import { CustomerLook } from './customers';
import { Drink, EMPTY_DRINK } from './ingredients';
import { DayConfig } from './levels';
import { generateOrder, orderTiles } from './orders';
import { Rng } from './random';
import type { Customer, GameState } from './reducer';
import { REGULAR_AT, REGULAR_AT_FIRST_DAY, USUAL_MAX_TILES } from './rules';

/**
 * The people who keep coming back. Everyone else at the counter is a stranger made up on the spot and
 * gone by closing; these four have a face that never changes and a drink that is theirs, and on a
 * second visit they say "Như cũ nhé!" and leave the player to remember what that was.
 *
 * What the shop knows about them lives in `GameState.regulars`, keyed by id, because `Customer.id`
 * starts again every day. Each look is `plain` on purpose: a kind's patience and tip are a rule of
 * the face, and the streak is the only thing a regular's pay should be read for.
 */
export interface Regular {
  id: string;
  name: string;
  /** Said on arrival, in place of a stranger's line. */
  line: string;
  look: CustomerLook;
}

export const REGULARS: Regular[] = [
  { id: 'thu', name: 'Chị Thư', line: 'Nay chị mệt quá!', look: { skin: '#F6C8A4', hair: '#4A2C20', hairStyle: 'bun', shirt: '#B79CF2', accessory: 'none' } },
  { id: 'bao', name: 'Anh Bảo', line: 'Tan ca là ghé liền!', look: { skin: '#CC9268', hair: '#2B1B17', hairStyle: 'spiky', shirt: '#FF9A76', accessory: 'none' } },
  { id: 'na', name: 'Bé Na', line: 'Con vừa tan học!', look: { skin: '#FFDCC2', hair: '#D2593B', hairStyle: 'bob', shirt: '#FFCF6E', accessory: 'bow' } },
  { id: 'tu', name: 'Chú Tư', line: 'Ly quen thuộc nhé!', look: { skin: '#E9B48E', hair: '#9A9A9A', hairStyle: 'short', shirt: '#7FD6C2', accessory: 'none' } },
];

/** Every id a shop can remember. A save naming anything else named someone this build has not met. */
export const REGULAR_IDS = REGULARS.map((regular) => regular.id);

export function regularById(id: string | undefined): Regular | undefined {
  return REGULARS.find((regular) => regular.id === id);
}

export interface RegularMemory {
  /** What they have, always. Rolled once, the first time they come in. */
  usual: Drink;
  /** How many times they have been handed a drink, which is not how many times they have come in. */
  visits: number;
  /** Their run of drinks got right. See `payoutFor`. */
  streak: number;
  /** The last day they came in, written as they do. */
  lastDay: number;
}

/**
 * How a hidden order stands: `blank` is a usual the player has to remember, `asked` is one they gave
 * up on and asked for again. A stranger, and a regular nobody has served yet, has neither.
 */
export type Recall = 'blank' | 'asked';

/**
 * Whether the screen may show what this customer wants. **Everything that draws a customer's order
 * goes through this**: the answer used to be readable from the counter's bubble, the card's title,
 * its count, its progress and a queue pin's ready dot, and any one of those is the whole of it.
 */
export function orderVisible(customer: Pick<Customer, 'recall'>): boolean {
  return customer.recall !== 'blank';
}

type Schedule = Pick<GameState, 'day' | 'overtime' | 'regulars'>;

/**
 * Whether Sổ khách has to keep a usual to itself: its owner is at the counter right now, waiting on
 * the player's memory, or a shift is waiting at the menu and they are still to come. The book is kept
 * off the pause card for this reason, and the same stopped clock can be had by way of the menu. A day
 * that has not started is the exception: between shifts the book is there to be read. The counter is
 * the only place to look for who has come, because a regular only ever comes in to a free spot.
 */
export function usualHidden(state: Schedule & Pick<GameState, 'clock' | 'phase' | 'slots'>, id: string): boolean {
  const { clock, phase, slots } = state;
  if (slots.some((customer) => customer?.regularId === id && !orderVisible(customer))) return true;
  return phase === 'title' && clock > 0 && regularToCome(state)?.id === id;
}

/** Far more tries than it takes: about one order in five is short enough. */
const USUAL_TRIES = 200;

/**
 * Whether a drink can be someone's usual: short enough to hold in the head, and one this shop can
 * actually hand over, since a cup takes a topping once and only as many as the day allows. A memory
 * outlives every visit, so a usual that could not be made would be a regular nobody can ever get right.
 */
export function fitsUsual(drink: Drink, { maxToppings }: Pick<DayConfig, 'maxToppings'>): boolean {
  const { size, tea, toppings } = drink;
  if (!size || !tea || toppings.length > maxToppings || new Set(toppings).size < toppings.length) return false;
  return orderTiles(drink) <= USUAL_MAX_TILES;
}

/**
 * A regular's usual. It is an order like any other, from the same independent rolls, cut to what a
 * person could hold in their head. The fallback is for a generator that will not give one up, which
 * the state's own never does.
 */
export function rollUsual(config: DayConfig, rng: Rng): Drink {
  for (let i = 0; i < USUAL_TRIES; i++) {
    const order = generateOrder(config, rng);
    if (fitsUsual(order, config)) return order;
  }
  return { ...EMPTY_DRINK, size: 'M', toppings: [], tea: config.options.tea[0] };
}

/**
 * Who the next customer through the door would be, if they are anyone: at most one regular a shift,
 * and only once the day is far enough on.
 */
export function regularDue(state: Schedule & Pick<GameState, 'config'>, clock: number): Regular | null {
  const from = state.day === 1 ? REGULAR_AT_FIRST_DAY : REGULAR_AT;
  return clock < from * state.config.durationMs ? null : regularToCome(state);
}

/**
 * Whose day it is, if nobody has been yet. No dice, so that day 1's stranger is day 2's "Như cũ nhé!".
 * Odd days bring someone new while there is anyone left to meet and even days bring back whoever has
 * been away longest, which is what gives a player a second visit before a third face.
 *
 * Nobody comes once the shop has stayed open: a late customer never reaches the stats, and a visit
 * should always count.
 */
function regularToCome({ day, overtime, regulars }: Schedule): Regular | null {
  if (overtime.rounds > 0) return null;
  if (Object.values(regulars).some((memory) => memory.lastDay === day)) return null;
  const unmet = REGULARS.filter(({ id }) => !regulars[id]);
  const met = REGULARS.filter(({ id }) => regulars[id]).sort((a, b) => regulars[a.id].lastDay - regulars[b.id].lastDay);
  return (day % 2 === 1 ? [...unmet, ...met] : [...met, ...unmet])[0] ?? null;
}
