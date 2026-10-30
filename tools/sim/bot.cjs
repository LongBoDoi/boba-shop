/* A bot that plays whole shifts through the shipped gameReducer. Rules are the game's; only the
 * human's timing and slips are modelled, and every such number is in PROFILES / MACHINE below. */
const { src } = require('./load.cjs');
const { createInitialState, gameReducer: R, canServe } = src('game/reducer.ts');
const { drinkPrice, evaluateDrink } = src('game/orders.ts');
const ING = src('game/ingredients.ts');
const { getDayConfig } = src('game/levels.ts');
const { asksFor, TEAS, TOPPINGS, MILKS, FOAMS, POUR_RATE, SUGAR_STEPS, MILK_SPLASH } = ING;

/** Taken from the code, not assumed. */
const MACHINE = {
  lidLoad: 600,   // DURATION.slow, KitchenScene.ts:934 (lidderLoading until the cup tween ends)
  lidPress: 1100, // KitchenScene.ts:1400
  slide: 320,     // SLIDE_MS, pager.ts:13
};

/** ASSUMED human timing. `speed` multiplies all of these; MACHINE is never scaled. */
const PROFILES = {
  skilled: { tap: 400, repeat: 250, swipe: 350, tabTap: 300, react: 300, readBase: 250, readTile: 120, pressHold: 150,
    fill: 0.70, fillSd: 0.04, slip: 0.01, detect: 1.0, panicMs: 5000, route: 'smart' },
  sloppy:  { tap: 800, repeat: 450, swipe: 700, tabTap: 600, react: 800, readBase: 500, readTile: 350, pressHold: 300,
    fill: 0.80, fillSd: 0.10, slip: 0.05, detect: 0.6, panicMs: 8000, route: 'natural' },
};

/** How the upright 390-wide room divides up (probe-layout.cjs): pan 0 vs full pan. Landscape: no pan. */
function zoneOf(kind, size) {
  if (kind === 'cup') return size === 'S' ? 'L' : 'R';
  return ['sugar', 'ice', 'milk', 'tea'].includes(kind) ? 'L' : 'R';
}

function mulberry(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tilesOf = (order) => 1 + ING.BUILD_ORDER.reduce((n, c) => n + (c === 'toppings' ? order.toppings.length : asksFor(order, c) ? 1 : 0), 0);
const sugarPumpsFor = (order) => SUGAR_STEPS.indexOf(order.sweetness) + 1;
const iceScoopsFor = (order) => (order.ice === 'regular' ? 2 : order.ice === 'less' ? 1 : 0);
/** Taps it takes to build this order from an empty bench to the serve button, upright. */
const stepsOf = (order) => 1 + order.toppings.length + sugarPumpsFor(order) + iceScoopsFor(order)
  + (asksFor(order, 'milk') ? 1 : 0) + (asksFor(order, 'foam') ? 1 : 0) + 2 /* dock, hold */ + 3 /* lid, straw, serve */;

function ingredientSteps(order, route) {
  const size = { kind: 'cup', id: order.size };
  const tops = order.toppings.map((id) => ({ kind: 'topping', id }));
  const foam = asksFor(order, 'foam') ? [{ kind: 'foam', id: order.foam }] : [];
  const sugar = Array.from({ length: sugarPumpsFor(order) }, () => ({ kind: 'sugar' }));
  const ice = Array.from({ length: iceScoopsFor(order) }, () => ({ kind: 'ice' }));
  const milk = asksFor(order, 'milk') ? [{ kind: 'milk', id: order.milk }] : [];
  const tea = [{ kind: 'tea', id: order.tea }];
  const finish = [{ kind: 'lid' }, { kind: 'straw' }, { kind: 'serve' }];
  if (route === 'smart') {
    return order.size === 'S'
      ? [size, ...sugar, ...ice, ...milk, ...tea, ...tops, ...foam, ...finish]
      : [size, ...tops, ...foam, ...sugar, ...ice, ...milk, ...tea, ...finish];
  }
  // The order the opening sign and the card read in: bottom of the cup upwards.
  return [size, ...tops, ...sugar, ...ice, ...tea, ...milk, ...foam, ...finish];
}

function other(list, id, rnd) {
  const pool = list.filter((o) => o.id !== id && !o.isNone).map((o) => o.id);
  return pool[Math.floor(rnd() * pool.length)];
}

function shift(opts) {
  const { day, seed, profile = 'skilled', queue = 'fifo', take = 'eager', pour = 'normal', fix = 'remake',
    layout = 'portrait', speed = 1, panicOff = false, lidHop = false, routeOverride = null, garbage = false, configPatch = null, slipOverride = null, dt = 50, start = null } = opts;
  const P = { ...PROFILES[profile] };
  if (slipOverride !== null) P.slip = slipOverride;
  if (routeOverride) P.route = routeOverride;
  const rnd = mulberry(seed ^ 0x51ed270b);
  let s = start ?? R(createInitialState(seed), { type: 'START_DAY', day });
  if (configPatch) {
    const config = { ...s.config, ...configPatch };
    s = { ...s, config, slots: Array.from({ length: config.slots }, () => null) };
  }
  const time = { idle: 0, hands: 0, read: 0, travel: 0, machine: 0 };
  const log = { serves: [], takes: [], orders: [], builds: [], missedReq: 0, missedOrd: 0, remakes: 0, slips: 0, spills: 0, pans: 0, trips: 0, fullMs: 0, occ: [] };
  const human = (ms) => ms * speed * Math.exp((rnd() - 0.5) * 0.4); // +-20%, log-uniform
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

  let busyUntil = 0, onDone = null, page = 'counter', zone = 'L', wasIdle = true;
  let cur = null; // { id, plan, at, order, spoiled }
  let picked = false;
  const seen = new Set();

  const spend = (ms, category, fn) => {
    if (ms <= 0) { wasIdle = false; if (fn) fn(); return; }
    busyUntil = Math.max(busyUntil, s.clock - dt) + ms;
    time[category] += ms;
    onDone = fn ?? null;
    wasIdle = false;
  };
  const customers = () => s.slots.map((c, slot) => (c ? { c, slot } : null)).filter(Boolean);

  function chooseTicket(tickets) {
    if (queue === 'fifo') return null; // never touch it: resolveSelection does this for you
    const by = (f) => [...tickets].sort((a, b) => f(a) - f(b))[0];
    if (queue === 'lifo') return by((t) => -t.c.orderedAt);
    if (queue === 'price') return by((t) => -drinkPrice(t.c.order) + t.c.orderedAt * 1e-9);
    if (queue === 'short') return by((t) => stepsOf(t.c.order) + t.c.orderedAt * 1e-9);
    if (queue === 'long') return by((t) => -stepsOf(t.c.order) + t.c.orderedAt * 1e-9);
    if (queue === 'random') return tickets[Math.floor(rnd() * tickets.length)];
    const remaining = (t) => t.c.patienceMs - (s.clock - t.c.orderedAt);
    const est = log.builds.length ? log.builds.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, log.builds.length) : 10000 * speed;
    // A hybrid a thinking player would use: chase value, but rescue anyone about to walk.
    if (queue === 'smartprice' || queue === 'smartshort') {
      const urgent = tickets.filter((t) => remaining(t) < est * 2.2);
      if (urgent.length) return by((t) => remaining(t));
      return queue === 'smartprice' ? by((t) => -drinkPrice(t.c.order) + t.c.orderedAt * 1e-9) : by((t) => stepsOf(t.c.order) + t.c.orderedAt * 1e-9);
    }
    // Triage: give up on anyone who cannot be reached in time, then oldest first.
    if (queue === 'triage') {
      const viable = tickets.filter((t) => remaining(t) > est * 1.1);
      return viable.length ? by((t) => remaining(t)) : by((t) => -remaining(t));
    }
    throw new Error(queue);
  }

  function travel(to) {
    log.trips += 1;
    spend(human(P.tabTap) + MACHINE.slide, 'travel', () => { page = to; });
  }

  function startBuild() {
    const tickets = customers().filter((t) => t.c.status === 'ordered');
    const chosen = picked ? null : chooseTicket(tickets);
    picked = false;
    if (chosen && s.selectedSlot !== chosen.slot) {
      picked = true;
      return spend(human(P.tap), 'hands', () => { s = R(s, { type: 'SELECT_SLOT', slot: chosen.slot }); });
    }
    const target = s.slots[s.selectedSlot];
    if (!target) return;
    const order = target.order;
    let plan;
    if (garbage) {
      plan = [{ kind: 'cup', id: 'S', fixed: true }, { kind: 'tea', id: 'black', fixed: true }, { kind: 'lid' }, { kind: 'straw' }, { kind: 'serve' }];
    } else plan = ingredientSteps(order, P.route);
    cur = { id: target.id, slot: s.selectedSlot, plan, at: s.clock, order, spoiled: false };
    if (garbage) return;
    spend(human(P.readBase + P.readTile * tilesOf(order)), 'read');
  }

  function bin(thenPlan) {
    log.remakes += 1;
    spend(human(P.tap), 'hands', () => {
      s = R(s, { type: 'CLEAR_CUP' });
      if (thenPlan) { cur.spoiled = false; cur.plan = ingredientSteps(cur.order, P.route); } else cur = null;
    });
  }

  function nextStep() {
    const stillThere = s.slots[cur.slot]?.id === cur.id;
    if (!stillThere) {
      // Their customer walked out mid-build. Nothing in the cup is any use now.
      if (s.cup.size) return bin(false);
      cur = null;
      return;
    }
    if (cur.spoiled && fix === 'remake') return bin(true);
    const step = cur.plan[0];
    const need = zoneOf(step.kind, step.id);
    if (layout === 'portrait' && need !== zone) {
      log.pans += 1;
      return spend(human(P.swipe), 'hands', () => { zone = need; });
    }
    cur.plan.shift();
    const slip = !step.fixed && rnd() < P.slip && ['cup', 'topping', 'foam', 'milk', 'tea', 'sugar', 'ice'].includes(step.kind);
    if (slip) { log.slips += 1; if (rnd() < P.detect) cur.spoiled = true; }
    const act = (a) => { s = R(s, a); };
    switch (step.kind) {
      case 'cup': {
        const size = slip ? ['S', 'M', 'L'].filter((x) => x !== step.id)[Math.floor(rnd() * 2)] : step.id;
        return spend(human(P.tap), 'hands', () => act({ type: 'PICK_CUP', size }));
      }
      case 'topping': {
        const id = slip ? other(TOPPINGS, step.id, rnd) : step.id;
        return spend(human(P.tap), 'hands', () => act({ type: 'SCOOP', category: 'toppings', optionId: id }));
      }
      case 'foam': {
        const id = slip ? other(FOAMS, step.id, rnd) : step.id;
        return spend(human(P.tap), 'hands', () => act({ type: 'SCOOP', category: 'foam', optionId: id }));
      }
      case 'milk': {
        const id = slip ? other(MILKS, step.id, rnd) : step.id;
        return spend(human(P.tap), 'hands', () => act({ type: 'POUR', category: 'milk', optionId: id, amount: MILK_SPLASH }));
      }
      case 'sugar': {
        const extra = slip && s.build.sugarPumps + 2 <= SUGAR_STEPS.length;
        return spend(human(s.build.sugarPumps ? P.repeat : P.tap), 'hands', () => { act({ type: 'SUGAR_PUMP' }); if (extra) act({ type: 'SUGAR_PUMP' }); });
      }
      case 'ice': {
        const extra = slip && s.build.iceScoops === 0;
        return spend(human(s.build.iceScoops ? P.repeat : P.tap), 'hands', () => { act({ type: 'ICE_SCOOP' }); if (extra) act({ type: 'ICE_SCOOP' }); });
      }
      case 'tea': {
        const id = slip ? other(TEAS, step.id, rnd) : step.id;
        const milkAfter = P.route === 'natural' && !garbage && asksFor(cur.order, 'milk');
        // Fill means the level in the cup: milk already in counts, milk still to come is left room for.
        const aim = milkAfter ? P.fill - 0.10 : P.fill;
        const amount = pour === 'tiny' ? 0.066
          : Math.max(0.02, aim - s.build.fill + gauss() * P.fillSd);
        const hold = (amount / POUR_RATE) * 1000;
        // Dock, then press and hold. The hold is the wall clock in the real game, so it never scales.
        return spend(human(P.tap) + human(P.pressHold) + hold, 'hands', () => {
          act({ type: 'POUR', category: 'tea', optionId: id, amount });
          if (s.build.spilled) { log.spills += 1; if (fix === 'remake') cur.spoiled = true; }
        });
      }
      case 'lid':
        act({ type: 'LOAD_LIDDER' });
        return spend(human(P.tap), 'hands', () => {
          const waiting = customers().filter((t) => t.c.status === 'requesting');
          const LID = MACHINE.lidLoad + MACHINE.lidPress;
          if (lidHop && waiting.length) {
            // The one overlap the game allows: the press runs on while the player is at the counter.
            const go = human(P.tabTap) + MACHINE.slide, back = human(P.tabTap) + MACHINE.slide;
            const taps = waiting.reduce((n) => n + human(P.tap), 0);
            log.trips += 2;
            return spend(go, 'travel', () => {
              for (const w of customers().filter((t) => t.c.status === 'requesting')) {
                log.takes.push({ left: (w.c.orderPatienceMs - (s.clock - w.c.arrivedAt)) / w.c.orderPatienceMs });
                act({ type: 'TAKE_ORDER', slot: w.slot });
              }
              spend(taps, 'hands', () => spend(back, 'travel', () =>
                spend(Math.max(0, LID - go - taps - back), 'machine', () => act({ type: 'LID_CUP' }))));
            });
          }
          spend(LID, 'machine', () => act({ type: 'LID_CUP' }));
        });
      case 'straw':
        return spend(human(P.tap), 'hands', () => act({ type: 'ADD_STRAW' }));
      case 'serve':
        return spend(human(P.tap), 'hands', () => {
          if (cur.spoiled && fix === 'remake') { cur.plan = [{ kind: 'serve' }]; return; }
          const c = s.slots[s.selectedSlot];
          if (!c || !canServe(s)) { cur = null; return; }
          const { quality, mistakes } = evaluateDrink(s.cup, c.order, s.config.categories);
          const left = 1 - (s.clock - c.orderedAt) / c.patienceMs;
          const before = { money: s.money, tips: s.stats.tips, spilled: s.build.spilled };
          act({ type: 'SERVE' });
          log.serves.push({ at: s.clock, quality, mistakes: mistakes.length, left, spilled: before.spilled, earned: s.money - before.money, tip: s.stats.tips - before.tips,
            price: drinkPrice(c.order), tiles: tilesOf(c.order), steps: stepsOf(c.order), buildMs: s.clock - cur.at, waitedMs: s.clock - c.arrivedAt });
          log.builds.push(s.clock - cur.at);
          cur = null;
        });
      default: throw new Error(step.kind);
    }
  }

  function decide() {
    const all = customers();
    const requesting = all.filter((t) => t.c.status === 'requesting').sort((a, b) => a.c.arrivedAt - b.c.arrivedAt);
    const ordered = all.filter((t) => t.c.status === 'ordered');
    const leftOf = (t) => t.c.orderPatienceMs - (s.clock - t.c.arrivedAt);
    const panic = panicOff ? [] : requesting.filter((t) => leftOf(t) < P.panicMs * Math.max(1, speed * 0.8));
    const busy = Boolean(cur);
    // Never walk away from the lid press mid-step: `plan` boundaries are where the bot may look up.
    let want = null;
    if (panic.length) want = panic[0];
    else if (take === 'eager' && !busy) want = requesting[0] ?? null;
    else if (take === 'lazy' && !busy && ordered.length === 0) want = requesting[0] ?? null;
    // Batch: only walk over once the tickets are finished, but take everyone while standing there.
    else if (take === 'batch' && !busy && (ordered.length === 0 || page === 'counter')) want = requesting[0] ?? null;
    if (want) {
      if (page !== 'counter') return travel('counter');
      const slot = want.slot;
      const extra = wasIdle ? human(P.react) : 0;
      return spend(extra + human(P.tap), 'hands', () => {
        const c = s.slots[slot];
        if (c?.status === 'requesting') {
          log.takes.push({ left: (c.orderPatienceMs - (s.clock - c.arrivedAt)) / c.orderPatienceMs });
          s = R(s, { type: 'TAKE_ORDER', slot });
        }
      });
    }
    if (cur || ordered.length) {
      if (page !== 'kitchen') return travel('kitchen');
      if (!cur) { startBuild(); if (s.clock >= busyUntil && !cur) { /* nothing selected yet */ } return; }
      return nextStep();
    }
    if (page !== 'counter') return travel('counter');
    // Nothing to do: the shop is waiting on a customer.
    time.idle += dt;
    busyUntil = s.clock + dt;
    wasIdle = true;
  }

  let guard = 0;
  while (s.phase === 'playing') {
    if (++guard > 400000) throw new Error('shift did not end');
    const before = s;
    s = R(s, { type: 'TICK', dt });
    if (s.stats.missed > before.stats.missed) {
      for (const d of s.departures) if (d.outcome === 'timeout' && d.at === s.clock) {
        if (d.customer.status === 'requesting') log.missedReq += 1; else log.missedOrd += 1;
      }
    }
    for (const c of s.slots) if (c && !seen.has(c.id)) { seen.add(c.id); log.orders.push(c.order); }
    if (s.slots.every(Boolean)) log.fullMs += dt;
    { const b = Math.floor(s.clock / 30000); (log.occ[b] ||= { sum: 0, n: 0 }); log.occ[b].sum += s.slots.filter(Boolean).length; log.occ[b].n += 1; }
    if (s.clock >= busyUntil) {
      if (onDone) { const f = onDone; onDone = null; f(); }
      if (s.phase === 'playing' && s.clock >= busyUntil) decide();
    }
  }
  const { served, perfect, missed, tips } = s.stats;
  return { state: s, day, served, perfect, missed, tips, coins: s.coins, total: s.clock, time, log, stars: starsFor(s.stats) };
}

/** Copied verbatim from src/ui/DayEndScreen.tsx:18-24 (that file pulls in Preact and art). */
function starsFor({ served, perfect, missed }) {
  if (served === 0) return 0;
  const happy = served / (served + missed);
  if (happy >= 0.9 && perfect >= served * 0.6) return 3;
  if (happy >= 0.7) return 2;
  return 1;
}

module.exports = { shift, PROFILES, MACHINE, tilesOf, stepsOf, R, createInitialState, getDayConfig, starsFor };
