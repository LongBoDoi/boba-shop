/*
 * A shop over time, for run5.cjs and tune.cjs. A shift dropped onto a new shop has met nobody and owns
 * nothing, so it is not the shop a player has on day 30: this chains one up to the day and keeps the
 * morning, and every policy can then play the same mornings on the same seeds.
 */
const { src } = require('./load.cjs');
const { shift, R, createInitialState } = require('./bot.cjs');
const { GEAR } = src('game/gear.ts');

const CHEAPEST = GEAR.map((item) => item.id);
/** The two that do something first, for a player who does not care about a plant. */
const USEFUL = ['bench', 'board', 'plant', 'lantern'];
/** The player who builds the mornings: FIFO, and presses when the counter is calm. */
const REFERENCE = { queue: 'fifo', overtime: { hearts: 0.5, most: 2 } };

/** `saving` holds out for the first thing on the list, rather than buying whatever the till covers today. */
function buy(state, wishes, saving) {
  let s = state;
  for (const id of wishes) {
    if (s.gear.includes(id)) continue;
    const next = R(s, { type: 'BUY_GEAR', id });
    if (next === s && saving) break;
    s = next;
  }
  return s;
}

/**
 * One shop, day after day. `wishes` is what it looks to buy at each day's end, in that order. `at` is
 * told each morning's state before the shift plays out.
 */
function chain(run, { days = 30, wishes = CHEAPEST, saving = false, at = null, ...player }) {
  const seed = 1000 + run * 7919;
  const log = [];
  let morning = R(createInitialState(seed), { type: 'START_DAY', day: 1 });
  for (let day = 1; day <= days; day++) {
    at?.(day, morning);
    const r = shift({ ...player, day, seed: seed + day * 104729, start: morning });
    const closed = buy(r.state, wishes, saving);
    log.push({ ...r, till: closed.money, gear: closed.gear, regulars: closed.regulars, bought: closed.gear.filter((id) => !r.state.gear.includes(id)) });
    morning = R(closed, { type: 'START_DAY', day: day + 1 });
  }
  return log;
}

/** The mornings `n` shops have reached on each of `days`. */
function mornings(n, days, player) {
  const shops = Object.fromEntries(days.map((day) => [day, []]));
  for (let run = 0; run < n; run++) {
    chain(run, { ...REFERENCE, ...player, days: Math.max(...days), at: (day, s) => { if (shops[day]) shops[day].push(s); } });
  }
  return shops;
}

/** Each morning played by the same player on the same seed. `seed` is the human's own dice. */
const play = (shops, day, o) => shops[day].map((start, i) => shift({ queue: 'fifo', ...o, day, start, seed: 7 + i * 7919 + day }));

module.exports = { USEFUL, REFERENCE, chain, mornings, play };
