/* A bot that plays whole shifts through the shipped gameReducer. Rules are the game's; only the
 * human's timing and slips are modelled, and every such number is in PROFILES / MACHINE below. */
const { src } = require('./load.cjs');
const { canExtend, canServe, createInitialState, gameReducer: R, patienceLeft } = src('game/reducer.ts');
const { kindOf } = src('game/customers.ts');
const { patienceFor, payoutFor, starsFor } = src('game/rules.ts');
const { drinkPrice, evaluateDrink } = src('game/orders.ts');
const ING = src('game/ingredients.ts');
const { getDayConfig } = src('game/levels.ts');
const { asksFor, TEAS, TOPPINGS, MILKS, FOAMS, POUR_RATE, SUGAR_STEPS, MILK_SPLASH } = ING;
const { orderVisible, REGULARS, rollUsual } = src('game/regulars.ts');
const { createRng } = src('game/random.ts');

/** Taken from the code, not assumed. */
const MACHINE = {
  lidLoad: 600,   // DURATION.slow, KitchenScene.ts:934 (lidderLoading until the cup tween ends)
  lidPress: 1100, // KitchenScene.ts:1400
  slide: 320,     // SLIDE_MS, pager.ts:13
};

/**
 * ASSUMED human timing. `speed` multiplies all of these; MACHINE is never scaled.
 *
 * ASSUMED human memory, for a regular's usual, and nobody has measured a word of it:
 * - `recallBase`: the chance of having it right after one served visit.
 * - `recallGain`: what each further served visit adds. Asking counts: the card was read.
 * - `recallMax`: where that stops, because nobody is ever certain.
 * - `recallMs`: the time spent bringing it to mind, in place of reading the tiles.
 * - `doubt`: the chance of having it right and not trusting it.
 * - `blindSpot`: the chance of having it wrong and feeling sure.
 * - `forgetTiles`: how many things a wrong memory gets wrong. One is a `close` cup and two is `wrong`.
 * Time away is not modelled: a regular not seen for a week is remembered as well as one seen yesterday.
 */
const PROFILES = {
  skilled: { tap: 400, repeat: 250, swipe: 350, tabTap: 300, react: 300, readBase: 250, readTile: 120, pressHold: 150,
    fill: 0.70, fillSd: 0.04, slip: 0.01, detect: 1.0, panicMs: 5000, route: 'smart',
    recallBase: 0.60, recallGain: 0.12, recallMax: 0.95, recallMs: 500, doubt: 0.10, blindSpot: 0.15, forgetTiles: 2 },
  sloppy:  { tap: 800, repeat: 450, swipe: 700, tabTap: 600, react: 800, readBase: 500, readTile: 350, pressHold: 300,
    fill: 0.80, fillSd: 0.10, slip: 0.05, detect: 0.6, panicMs: 8000, route: 'natural',
    recallBase: 0.35, recallGain: 0.12, recallMax: 0.85, recallMs: 1000, doubt: 0.20, blindSpot: 0.30, forgetTiles: 2 },
};

/** How the upright 390-wide room divides up (probe-layout.cjs): pan 0 vs full pan. Landscape: no pan. */
function zoneOf(kind, size) {
  if (kind === 'cup') return size === 'S' ? 'L' : 'R';
  return ['sugar', 'ice', 'milk', 'tea'].includes(kind) ? 'L' : 'R';
}

/** A look with no kind in it, for a customer known only as a number on a badge. */
const ANYONE = { hairStyle: 'bun', accessory: 'none' };

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

/**
 * Whether this bot stays open another round, once the pill is on offer. `overtime` is 'never',
 * 'always', or a number: press only if every heart on the counter is above it, 0 to 1, which is the
 * judgement the pill asks a player to make. An empty counter has no heart to worry about. An object
 * is the same judgement made by someone who knows the rule: `{ hearts, most }` leaves shippers out of
 * it, since one leaving does not burn the jar, and wants nobody outside and at most `most` at the counter.
 * Either way it is made from what is on screen: `sight` says whose heart can be read and whose kind is known.
 */
function wantsRound(overtime, s, sight) {
  if (overtime === 'never') return false;
  if (overtime === 'always') return true;
  if (typeof overtime === 'object') {
    const stake = s.slots.filter((c) => c && !(sight.face(c) && kindOf(c.look) === 'shipper'));
    return s.line.length === 0 && stake.length <= overtime.most && stake.every((c) => !sight.ring(c) || patienceLeft(c, s.clock) > overtime.hearts);
  }
  if (typeof overtime !== 'number') throw new Error(`overtime: ${overtime}`);
  return s.slots.every((c) => !c || !sight.ring(c) || patienceLeft(c, s.clock) > overtime);
}

function other(list, id, rnd) {
  const pool = list.filter((o) => o.id !== id && !o.isNone).map((o) => o.id);
  return pool[Math.floor(rnd() * pool.length)];
}

/** The usual as a tired memory has it: `tiles` things about it wrong, each a slip the card would have caught. */
function misremember(order, tiles, rnd) {
  const memory = { ...order, toppings: [...order.toppings] };
  const slips = [
    () => { memory.size = ['S', 'M', 'L'].filter((size) => size !== order.size)[Math.floor(rnd() * 2)]; },
    () => { memory.tea = other(TEAS, order.tea, rnd); },
    () => { memory.toppings = order.toppings.length ? [] : [other(TOPPINGS, null, rnd)]; },
    () => { memory.milk = asksFor(order, 'milk') ? null : other(MILKS, null, rnd); },
    () => { memory.foam = asksFor(order, 'foam') ? null : other(FOAMS, null, rnd); },
    () => { memory.ice = order.ice === 'less' ? 'regular' : 'less'; },
    () => { memory.sweetness = order.sweetness === '30' ? '50' : '30'; },
  ];
  for (let left = tiles; left > 0; left--) slips.splice(Math.floor(rnd() * slips.length), 1)[0]();
  return memory;
}

/**
 * The shop as it would be after `visits` served visits from all four regulars, for a shift dropped into
 * the middle of a shop's life. A shift chained from the last one through `start` needs none of this.
 */
function knownRegulars({ visits, streak = 0 }, day, seed) {
  const rng = createRng(seed ^ 0x2f6e2b1);
  const config = getDayConfig(day);
  return Object.fromEntries(REGULARS.map(({ id }, i) => [id, { usual: rollUsual(config, rng), visits, streak, lastDay: Math.max(1, day - 1 - i) }]));
}

function shift(opts) {
  const { day, seed, profile = 'skilled', queue = 'fifo', take = 'eager', pour = 'normal', fix = 'remake',
    layout = 'portrait', speed = 1, panicOff = false, noticeMs = 0, lidHop = false, routeOverride = null, garbage = false, configPatch = null, slipOverride = null, dt = 50, start = null, overtime = 'never', overtimeRounds = Infinity, gear = null, usual = 'sure', known = null } = opts;
  const P = { ...PROFILES[profile] };
  if (slipOverride !== null) P.slip = slipOverride;
  if (routeOverride) P.route = routeOverride;
  const rnd = mulberry(seed ^ 0x51ed270b);
  let s = start ?? R(createInitialState(seed), { type: 'START_DAY', day });
  if (gear) s = { ...s, gear };
  if (known) s = { ...s, regulars: knownRegulars(known, day, seed) };
  if (configPatch) {
    const config = { ...s.config, ...configPatch };
    s = { ...s, config, slots: Array.from({ length: config.slots }, () => null) };
  }
  const time = { idle: 0, hands: 0, read: 0, travel: 0, machine: 0 };
  const log = { serves: [], takes: [], orders: [], builds: [], missedReq: 0, missedOrd: 0, asks: 0, guesses: 0, shippersGone: 0, lateGone: 0, lineMax: 0, lulls: 0, remakes: 0, slips: 0, spills: 0, pans: 0, trips: 0, fullMs: 0, occ: [] };
  const human = (ms) => ms * speed * Math.exp((rnd() - 0.5) * 0.4); // +-20%, log-uniform
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

  let busyUntil = 0, onDone = null, page = 'counter', zone = 'L', wasIdle = true;
  let cur = null; // { id, plan, at, order, spoiled }
  let picked = false;
  const seen = new Set();
  // What the player has to go on. From the kitchen, someone not asked yet is one more on the Quầy tab's
  // badge: no ring and no face. A taken order has both, on the card or in the queue. A face seen at the
  // counter is remembered. One never seen could be anybody, so it gets a plain customer's patience, for
  // the round it came in on: the player pressed, and knows the badge went up after that.
  const met = new Set();
  const sight = {
    ring: (c) => page === 'counter' || c.status === 'ordered',
    face: (c) => sight.ring(c) || met.has(c.id),
  };

  const spend = (ms, category, fn) => {
    if (ms <= 0) { wasIdle = false; if (fn) fn(); return; }
    busyUntil = Math.max(busyUntil, s.clock - dt) + ms;
    time[category] += ms;
    onDone = fn ?? null;
    wasIdle = false;
  };
  const customers = () => s.slots.map((c, slot) => (c ? { c, slot } : null)).filter(Boolean);

  /**
   * What the player has in their head about a usual on a blank card, settled once a visit, the first
   * time they think about it. `usual` is the policy: 'ask' every time, 'guess' every time, 'sure' to
   * guess only on a usual that feels right, or a number to guess whenever the chance of having it
   * right is at least that, which is a player who knows how well they know this regular.
   */
  const minds = new Map();
  function mindOf(c) {
    if (minds.has(c.id)) return minds.get(c.id);
    const visits = s.regulars[c.regularId]?.visits ?? 0;
    const chance = Math.min(P.recallMax, P.recallBase + P.recallGain * Math.max(0, visits - 1));
    const right = rnd() < chance;
    const sure = right ? rnd() >= P.doubt : rnd() < P.blindSpot;
    if (!['ask', 'guess', 'sure'].includes(usual) && typeof usual !== 'number') throw new Error(`usual: ${usual}`);
    const ask = usual === 'ask' || (usual === 'sure' && !sure) || (typeof usual === 'number' && chance < usual);
    const mind = { ask, order: right ? c.order : misremember(c.order, P.forgetTiles, rnd) };
    minds.set(c.id, mind);
    return mind;
  }
  /** The order as the player believes it: the bot may not read what the card is not showing. */
  const believed = (c) => (orderVisible(c) ? c.order : mindOf(c).order);

  function chooseTicket(tickets) {
    if (queue === 'fifo') return null; // never touch it: resolveSelection does this for you
    const by = (f) => [...tickets].sort((a, b) => f(a) - f(b))[0];
    if (queue === 'lifo') return by((t) => -t.c.orderedAt);
    if (queue === 'price') return by((t) => -drinkPrice(believed(t.c)) + t.c.orderedAt * 1e-9);
    if (queue === 'short') return by((t) => stepsOf(believed(t.c)) + t.c.orderedAt * 1e-9);
    if (queue === 'long') return by((t) => -stepsOf(believed(t.c)) + t.c.orderedAt * 1e-9);
    if (queue === 'random') return tickets[Math.floor(rnd() * tickets.length)];
    const remaining = (t) => t.c.patienceMs - (s.clock - t.c.orderedAt);
    const est = log.builds.length ? log.builds.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, log.builds.length) : 10000 * speed;
    // A hybrid a thinking player would use: chase value, but rescue anyone about to walk.
    if (queue === 'smartprice' || queue === 'smartshort') {
      const urgent = tickets.filter((t) => remaining(t) < est * 2.2);
      if (urgent.length) return by((t) => remaining(t));
      return queue === 'smartprice' ? by((t) => -drinkPrice(believed(t.c)) + t.c.orderedAt * 1e-9) : by((t) => stepsOf(believed(t.c)) + t.c.orderedAt * 1e-9);
    }
    // Triage: give up on anyone who cannot be reached in time, then oldest first.
    if (queue === 'triage') {
      const viable = tickets.filter((t) => remaining(t) > est * 1.1);
      return viable.length ? by((t) => remaining(t)) : by((t) => -remaining(t));
    }
    // What a player does who reads faces. Rescue whoever is about to go, the ones who cost a star
    // before a shipper, who costs none; with nobody in danger, make the best tip on the counter.
    // `line` adds the decision a rush asks for: with someone outside, a quick drink frees a spot.
    if (queue === 'kinds' || queue === 'line') {
      const isShipper = (t) => (kindOf(t.c.look) === 'shipper' ? 1 : 0);
      const viable = tickets.filter((t) => remaining(t) > est * 1.1);
      const urgent = viable.filter((t) => remaining(t) < est * 2.2);
      if (urgent.length) return by((t) => isShipper(t) * 1e7 + remaining(t));
      if (queue === 'line' && s.line.length > 0 && viable.length) return by((t) => stepsOf(believed(t.c)) * 1e7 + t.c.orderedAt);
      if (viable.length) return by((t) => -tipIfMadeNow(t) * 1e7 + t.c.orderedAt);
      return by((t) => isShipper(t) * 1e7 + remaining(t));
    }
    throw new Error(queue);
  }

  /** The tip this ticket would pay if the next drink is theirs and takes as long as the last few. */
  function tipIfMadeNow(t) {
    const est = log.builds.length ? log.builds.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, log.builds.length) : 10000 * speed;
    const left = Math.max(0, 1 - (s.clock + est - t.c.orderedAt) / t.c.patienceMs);
    const memory = t.c.regularId ? s.regulars[t.c.regularId] : undefined;
    return payoutFor({ quality: 'perfect', neat: true, price: 0, patienceLeft: left, look: t.c.look, regular: memory && { recall: t.c.recall, streak: memory.streak } }).tip;
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
    const hidden = !garbage && !orderVisible(target);
    if (hidden && mindOf(target).ask) {
      // A tap, and the next look at this ticket reads the tiles like any other.
      log.asks += 1;
      const slot = s.selectedSlot;
      return spend(human(P.tap), 'hands', () => { s = R(s, { type: 'ASK_AGAIN', slot }); });
    }
    if (hidden) log.guesses += 1;
    const order = believed(target);
    let plan;
    if (garbage) {
      plan = [{ kind: 'cup', id: 'S', fixed: true }, { kind: 'tea', id: 'black', fixed: true }, { kind: 'lid' }, { kind: 'straw' }, { kind: 'serve' }];
    } else plan = ingredientSteps(order, P.route);
    cur = { id: target.id, slot: s.selectedSlot, plan, at: s.clock, order, spoiled: false };
    if (garbage) return;
    spend(human(P.readBase + (hidden ? P.recallMs : P.readTile * tilesOf(order))), 'read');
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
          const before = { money: s.money, jar: s.overtime.jar, spilled: s.build.spilled };
          act({ type: 'SERVE' });
          // A late sale goes in the jar, so what it earned is whichever of the two moved, and a tip
          // has to be read off the sale: `stats.tips` does not hear about those.
          const earned = s.money - before.money + s.overtime.jar - before.jar;
          const price = drinkPrice(c.order);
          log.serves.push({ at: s.clock, quality, mistakes: mistakes.length, left, spilled: before.spilled, earned, tip: quality === 'perfect' && !before.spilled ? earned - price : 0,
            price, tiles: tilesOf(c.order), steps: stepsOf(c.order), buildMs: s.clock - cur.at, waitedMs: s.clock - c.arrivedAt, late: c.lateRound !== undefined, regular: Boolean(c.regularId), recall: c.recall ?? null });
          log.builds.push(s.clock - cur.at);
          cur = null;
        });
      default: throw new Error(step.kind);
    }
  }

  function decide() {
    // A press is a tap like any other: it waits for free hands, as a real thumb on a pour would.
    // The tap can land too late, and then the reducer refuses it, so `overtime.rounds` is the count.
    if (canExtend(s) && s.overtime.rounds < overtimeRounds && wantsRound(overtime, s, sight)) return spend(human(P.tap), 'hands', () => { s = R(s, { type: 'EXTEND_SHIFT' }); });
    const all = customers();
    const requesting = all.filter((t) => t.c.status === 'requesting').sort((a, b) => a.c.arrivedAt - b.c.arrivedAt);
    const ordered = all.filter((t) => t.c.status === 'ordered');
    const orderLimit = (c) => (sight.face(c) ? c.orderPatienceMs : patienceFor(s, ANYONE, { rounds: c.lateRound ?? 0 }).orderPatienceMs);
    const leftOf = (t) => orderLimit(t.c) - (s.clock - t.c.arrivedAt);
    // `noticeMs` swaps the sum for a habit: from the kitchen, go and look once the badge is that old.
    const inTrouble = (t) => (noticeMs && page !== 'counter' ? s.clock - t.c.arrivedAt > noticeMs : leftOf(t) < P.panicMs * Math.max(1, speed * 0.8));
    const panic = panicOff ? [] : requesting.filter(inTrouble);
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

  let guard = 0, lastLull = 0;
  while (s.phase === 'playing') {
    if (++guard > 400000) throw new Error('shift did not end');
    s = R(s, { type: 'TICK', dt });
    if (page === 'counter') for (const c of s.slots) if (c) met.add(c.id);
    // A shipper's walkout is the one that `stats.missed` does not hear about, and a late customer's
    // is nothing to the stats at all.
    for (const d of s.departures) if (d.outcome === 'timeout' && d.at === s.clock) {
      if (d.customer.lateRound !== undefined) log.lateGone += 1;
      else if (kindOf(d.customer.look) === 'shipper') log.shippersGone += 1;
      else if (d.customer.status === 'requesting') log.missedReq += 1;
      else log.missedOrd += 1;
    }
    for (const c of s.slots) if (c && !seen.has(c.id)) { seen.add(c.id); log.orders.push(c.order); }
    log.lineMax = Math.max(log.lineMax, s.line.length);
    if (s.lullUntil > s.clock && s.lullUntil !== lastLull) { lastLull = s.lullUntil; log.lulls += 1; }
    if (s.slots.every(Boolean)) log.fullMs += dt;
    { const b = Math.floor(s.clock / 30000); (log.occ[b] ||= { sum: 0, n: 0 }); log.occ[b].sum += s.slots.filter(Boolean).length; log.occ[b].n += 1; }
    if (s.clock >= busyUntil) {
      if (onDone) { const f = onDone; onDone = null; f(); }
      if (s.phase === 'playing' && s.clock >= busyUntil) decide();
    }
  }
  const { served, perfect, missed, tips } = s.stats;
  return { state: s, day, served, perfect, missed, tips, coins: s.coins, overtime: s.overtime, lost: s.lost, regulars: s.regulars, total: s.clock, time, log, stars: starsFor(s.stats) };
}

module.exports = { shift, PROFILES, tilesOf, stepsOf, R, createInitialState, getDayConfig };
