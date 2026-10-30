/* Run with node tools/check-overtime.cjs. Uses the project's TypeScript compiler for pure game code. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

try {
  const { canAfford, canExtend, createInitialState, gameReducer, NO_OVERTIME, suspendedShift } = require(path.join(__dirname, '../src/game/reducer.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { BOARD_SLOT, GEAR, GEAR_IDS, gearItem } = require(path.join(__dirname, '../src/game/gear.ts'));
  const { getDayConfig } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { drinkPrice } = require(path.join(__dirname, '../src/game/orders.ts'));
  const {
    burnJar, closesAt, dayNews, inOvertime, jarPayout, MAX_NEWS, ORDER_PATIENCE_FLOOR_MS, OVERTIME_BONUS_PER_ROUND, OVERTIME_BURN_KEEPS,
    OVERTIME_FROM_DAY, OVERTIME_MAX_ROUNDS, OVERTIME_PATIENCE, OVERTIME_ROUND_MS, OVERTIME_WINDOW_MS, patienceFor, SERVE_PATIENCE_FLOOR_MS,
  } = require(path.join(__dirname, '../src/game/rules.ts'));
  const { shopBackdropSvg, wallGear } = require(path.join(__dirname, '../src/art/shopBackdrop.ts'));

  const look = (hairStyle, accessory = 'none') => ({ skin: '#FFDCC2', hair: '#2B1B17', hairStyle, shirt: '#7EC8E3', accessory });
  const FACES = { plain: look('bun'), shipper: look('cap'), elder: look('balding'), office: look('short', 'glasses') };
  const TEA = { size: 'M', toppings: [], sweetness: null, ice: null, tea: 'black', milk: null, foam: null };
  const CLOSE = getDayConfig(OVERTIME_FROM_DAY).durationMs;
  const WINDOW_OPENS = CLOSE - OVERTIME_WINDOW_MS;
  const FIRST_ROUND_ENDS = CLOSE + OVERTIME_ROUND_MS;
  /** Later than any clock, and a number a save can hold, as Infinity is not. */
  const NOBODY_COMING = Number.MAX_SAFE_INTEGER;

  /** A day at `clock` with nobody at the counter and nobody coming, so each case seats its own people. */
  function shop({ day = OVERTIME_FROM_DAY, clock = WINDOW_OPENS, mode = 'standard', overtime = NO_OVERTIME, gear = [], money = 0 } = {}) {
    let state = gameReducer(createInitialState(4242), { type: 'START_DAY', day });
    if (mode !== 'standard') state = gameReducer(state, { type: 'SET_MODE', mode });
    return { ...state, clock, nextSpawnAt: NOBODY_COMING, overtime, gear, money };
  }

  /** Stand someone at the counter. `late` is a customer who came in after a press. */
  function seat(state, kind = 'plain', { slot = 0, status = 'ordered', late = false, rounds = 0 } = {}) {
    const slots = [...state.slots];
    slots[slot] = {
      id: 100 + slot, look: FACES[kind], name: 'Lan', order: TEA, status, arrivedAt: state.clock,
      orderedAt: status === 'ordered' ? state.clock : null, ...patienceFor(state, FACES[kind], { rounds }),
      ...(late ? { lateRound: rounds } : {}),
    };
    return { ...state, slots, selectedSlot: status === 'ordered' ? slot : state.selectedSlot };
  }

  const tick = (state, dt) => gameReducer(state, { type: 'TICK', dt });
  const press = (state) => gameReducer(state, { type: 'EXTEND_SHIFT' });

  /** Make the selected customer a cup and hand it over: theirs by default, the wrong one on request. */
  function hand(state, { tea = 'black', size = 'M', amount = 0.6 } = {}) {
    let cup = gameReducer(state, { type: 'PICK_CUP', size });
    cup = gameReducer(cup, { type: 'POUR', category: 'tea', optionId: tea, amount });
    for (const type of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW', 'SERVE']) cup = gameReducer(cup, { type });
    return cup;
  }

  /** Run a day out to its end, however many ticks that takes. */
  function closeUp(state) {
    let closing = state;
    for (let i = 0; i < 20_000 && closing.phase === 'playing'; i++) closing = tick(closing, 250);
    assert.equal(closing.phase, 'dayEnd', 'The day ends');
    return closing;
  }

  // ------------------------------------------------------------------ when the shop may stay open
  assert.equal(closesAt(shop()), CLOSE, 'A day that has not stayed open closes when it always did');
  for (let rounds = 1; rounds <= OVERTIME_MAX_ROUNDS; rounds++) {
    assert.equal(closesAt(shop({ overtime: { ...NO_OVERTIME, rounds } })), CLOSE + rounds * OVERTIME_ROUND_MS, 'Each round moves closing back');
  }
  assert.equal(canExtend(shop({ clock: WINDOW_OPENS - 1 })), false, 'Not a moment before the window');
  assert.equal(canExtend(shop({ clock: WINDOW_OPENS })), true, 'From the moment it opens');
  assert.equal(canExtend(shop({ clock: CLOSE - 1 })), true, 'Until the last moment');
  assert.equal(canExtend(shop({ clock: CLOSE })), false, 'A shop that has closed cannot change its mind');
  assert.equal(canExtend(shop({ day: OVERTIME_FROM_DAY - 1 })), false, 'Not before the first day it is allowed');
  assert.equal(canExtend(shop({ day: 40 })), true, 'And on every day after that');
  assert.equal(canExtend(shop({ mode: 'relaxed' })), false, 'Never in a relaxed shop, whose promise is no pressure');
  assert.equal(canExtend({ ...shop(), paused: true }), false, 'Not while paused');
  assert.equal(canExtend({ ...shop(), phase: 'title' }), false, 'Not at the menu');
  assert.equal(canExtend({ ...shop(), phase: 'dayEnd' }), false, 'Not once the day is over');
  assert.equal(canExtend(shop({ overtime: { ...NO_OVERTIME, rounds: 1, lost: true }, clock: FIRST_ROUND_ENDS - 1 })), false, 'Not after losing the jar');
  assert.equal(canExtend(shop({ overtime: { ...NO_OVERTIME, rounds: OVERTIME_MAX_ROUNDS }, clock: CLOSE + OVERTIME_MAX_ROUNDS * OVERTIME_ROUND_MS - 1 })), false, 'Not past the last round');
  assert.equal(typeof canExtend(shop()), 'boolean', 'A plain boolean, so that the pill only renders when it flips');
  for (const refused of [shop({ clock: WINDOW_OPENS - 1 }), shop({ mode: 'relaxed' }), shop({ day: 2 }), { ...shop(), paused: true }]) {
    assert.equal(press(refused), refused, 'The reducer refuses whatever the pill would not have offered');
  }

  const pressed = press(shop());
  assert.equal(pressed.overtime.rounds, 1, 'A press is a round');
  assert.equal(closesAt(pressed), FIRST_ROUND_ENDS, 'And it moves closing');
  assert.equal(press(pressed), pressed, 'The next window has not opened yet');
  const nextWindow = { ...pressed, clock: FIRST_ROUND_ENDS - OVERTIME_WINDOW_MS };
  assert.equal(canExtend({ ...nextWindow, clock: nextWindow.clock - 1 }), false, 'The next window hangs off the new closing time');
  assert.equal(canExtend(nextWindow), true, 'And opens at the same distance from it');
  let allIn = shop();
  for (let round = 0; round < OVERTIME_MAX_ROUNDS; round++) {
    allIn = press({ ...allIn, clock: closesAt(allIn) - 1_000 });
  }
  assert.equal(allIn.overtime.rounds, OVERTIME_MAX_ROUNDS, 'The rounds run up to the limit');
  assert.equal(press({ ...allIn, clock: closesAt(allIn) - 1_000 }).overtime.rounds, OVERTIME_MAX_ROUNDS, 'And stop there');

  // ------------------------------------------------------------------ customers keep coming
  const arrivals = (start) => {
    let state = start;
    const late = [];
    const known = new Set();
    for (let i = 0; i < 2_000 && state.phase === 'playing'; i++) {
      state = tick(state, 250);
      for (const customer of state.slots) {
        if (!customer || known.has(customer.id)) continue;
        known.add(customer.id);
        late.push({ customer, at: state.clock });
      }
      // Sent straight home, so that the whole of the run is arrivals.
      state = { ...state, slots: state.slots.map(() => null) };
    }
    return { state, seen: late };
  };
  // A press brings a group of its own and nothing else: no other wave starts once it has been pressed.
  const unpressed = arrivals({ ...shop({ clock: CLOSE - 2_000 }), nextSpawnAt: CLOSE - 2_000, nextId: 50 });
  assert.equal(unpressed.seen.length, 0, 'Without a press, a group with its quiet still to run at closing never comes');
  const stayedOpen = arrivals(press({ ...shop({ clock: CLOSE - 2_000 }), nextSpawnAt: CLOSE + 5_000 }));
  assert.equal(stayedOpen.seen.length, getDayConfig(OVERTIME_FROM_DAY).waveSize, 'With one, a whole group comes, and nobody after them');
  assert.ok(stayedOpen.seen.some(({ at }) => at >= CLOSE), 'Past the old closing time');
  assert.ok(stayedOpen.seen.every(({ at }) => at < FIRST_ROUND_ENDS), 'And well before the new one');
  assert.ok(stayedOpen.seen[0].at < CLOSE - 1_000, 'At once, whenever the door was next due');
  for (const { customer } of stayedOpen.seen) {
    assert.equal(customer.lateRound, 1, 'Anyone who arrives after the press is a late customer, and knows which round they came in on');
    const { orderPatienceMs, patienceMs } = customer;
    assert.deepEqual({ orderPatienceMs, patienceMs }, patienceFor(pressed, customer.look, { rounds: 1 }), 'With a round\'s worth less patience');
  }
  const dayArrivals = arrivals({ ...shop({ clock: 60_000 }), nextSpawnAt: 60_000, nextId: 50 });
  assert.ok(dayArrivals.seen.length > 0 && dayArrivals.seen.every(({ customer }) => !('overtime' in customer)), 'Anyone on a day with no press is not');
  // From the press on and not from closing: this is the one stretch where those two differ.
  const lastSeconds = stayedOpen.seen[0];
  assert.ok(lastSeconds.at < CLOSE, 'Someone can come in between the press and closing');
  assert.equal(lastSeconds.customer.lateRound, 1, 'And they are a late customer, though the day proper is not over');

  // ------------------------------------------------------------------ late customers have less patience
  const config = getDayConfig(30);
  for (const kind of Object.keys(FACES)) {
    for (let rounds = 0; rounds <= OVERTIME_MAX_ROUNDS; rounds++) {
      const base = patienceFor({ config, mode: 'standard' }, FACES[kind]);
      const scale = OVERTIME_PATIENCE ** rounds;
      const late = patienceFor({ config, mode: 'standard' }, FACES[kind], { rounds });
      assert.equal(late.patienceMs, Math.max(SERVE_PATIENCE_FLOOR_MS, Math.round(base.patienceMs * scale)), `A ${kind} customer's serve patience at round ${rounds}`);
      assert.ok(late.orderPatienceMs >= ORDER_PATIENCE_FLOOR_MS, 'Order patience keeps its floor');
      assert.deepEqual(patienceFor({ config, mode: 'relaxed' }, FACES[kind], { rounds }), { orderPatienceMs: config.orderPatienceMs, patienceMs: config.patienceMs },
        'A relaxed shop ignores overtime as it ignores kinds');
    }
  }
  assert.equal(patienceFor({ config, mode: 'standard' }, FACES.plain, { rounds: 3 }).patienceMs, SERVE_PATIENCE_FLOOR_MS, 'The last day has reached the floor by the third round');
  assert.ok(patienceFor({ config: getDayConfig(OVERTIME_FROM_DAY), mode: 'standard' }, FACES.plain, { rounds: 3 }).patienceMs > SERVE_PATIENCE_FLOOR_MS, 'While an early day, with more to give, has not');
  assert.equal(patienceFor({ config, mode: 'standard' }, FACES.shipper, { rounds: 3 }).patienceMs, SERVE_PATIENCE_FLOOR_MS, 'A late shipper is held at the floor');

  // Whoever was there before the press keeps what they arrived with.
  const waiting = seat(shop(), 'plain');
  assert.deepEqual(press(waiting).slots[0], waiting.slots[0], 'A press changes nobody already at the counter');

  // ------------------------------------------------------------------ where the money goes
  const jarred = (customer = {}) => {
    let state = seat(shop(), 'plain', customer);
    state = press(state);
    return tick(state, CLOSE - state.clock);
  };
  const before = jarred();
  assert.ok(inOvertime(before), 'The day proper is over and the shop is still going');
  const sold = hand(before);
  const sale = sold.departures.at(-1);
  assert.ok(sale.earned > 0, 'The sale is a sale');
  assert.equal(sold.overtime.jar, sale.earned, 'It goes in the jar');
  assert.deepEqual([sold.coins, sold.money], [before.coins, before.money], 'Not the till');
  assert.equal(sale.toJar, true, 'And the coins know where to fly');
  assert.equal(sold.stats.tips, before.stats.tips, 'The tip stays in the jar with the rest of it');
  assert.ok(sale.earned > drinkPrice(TEA), 'And there was one');
  assert.deepEqual([sold.stats.served, sold.stats.perfect], [before.stats.served + 1, before.stats.perfect + 1],
    'But someone who came in before the press counts in the day\'s stats whenever they are served');

  // Between the press and the original closing time it is still the day proper.
  const early = hand(press(seat(shop(), 'plain')));
  assert.equal(early.overtime.jar, 0, 'A sale before closing does not go in the jar, press or no press');
  assert.equal(early.money, early.departures.at(-1).earned, 'It goes in the till');
  assert.ok(!('toJar' in early.departures.at(-1)), 'And the coins fly there');
  assert.ok(early.stats.tips > 0, 'And so does its tip');

  // After closing with no press is the end of every ordinary day, and there is no jar to go to.
  const closingUp = tick(seat(shop({ clock: CLOSE - 100 }), 'plain'), 200);
  assert.ok(closingUp.clock >= CLOSE && !inOvertime(closingUp), 'A shop that has closed and never pressed is not in overtime');
  const lastSale = hand(closingUp);
  assert.ok(lastSale.departures.at(-1).earned > 0, 'The last customer of the day pays');
  assert.equal(lastSale.money, lastSale.departures.at(-1).earned, 'Into the till');
  assert.equal(lastSale.coins, lastSale.departures.at(-1).earned, 'And today\'s takings');
  assert.equal(lastSale.overtime.jar, 0, 'And not into a jar');
  assert.ok(!('toJar' in lastSale.departures.at(-1)), 'So the coins fly to the till');
  assert.ok(lastSale.stats.tips > 0, 'And the tip counts as the day\'s');

  // ------------------------------------------------------------------ the normal day's stars are never touched
  const zero = { served: 0, perfect: 0, missed: 0, tips: 0 };
  const lateSale = hand(jarred({ late: true, rounds: 1 }));
  assert.deepEqual(lateSale.stats, zero, 'A late customer served perfectly is nothing to the stats');
  assert.ok(lateSale.overtime.jar > 0, 'Only to the jar');
  const lateWrong = hand(jarred({ late: true, rounds: 1 }), { tea: 'green', size: 'L' });
  assert.deepEqual(lateWrong.stats, zero, 'A late customer handed the wrong drink is nothing to the stats either');
  const lateClose = hand(jarred({ late: true, rounds: 1 }), { size: 'L' });
  assert.equal(lateClose.departures.at(-1).outcome, 'close', 'One thing wrong is nearly right');
  assert.deepEqual(lateClose.stats, zero, 'A late customer handed nearly the right drink is nothing to the stats');
  const lateSpill = hand(jarred({ late: true, rounds: 1 }), { amount: 1.2 });
  assert.equal(lateSpill.departures.at(-1).outcome, 'perfect', 'The right drink');
  assert.ok(lateSpill.departures.at(-1).earned < lateSale.departures.at(-1).earned, 'Poured over the brim');
  assert.deepEqual(lateSpill.stats, zero, 'A late customer handed a spilled drink is nothing to the stats');
  const lateGone = tick(jarred({ late: true, rounds: 1 }), 500_000);
  assert.deepEqual(lateGone.stats, zero, 'Nor one who walks out');
  assert.deepEqual(tick(press(seat(shop(), 'shipper', { late: true, rounds: 1 })), 500_000).stats, zero, 'Nor a shipper');

  // ------------------------------------------------------------------ the jar burns
  const running = (kind, options) => seat(shop({ overtime: { ...NO_OVERTIME, rounds: 1, jar: 41 }, clock: CLOSE + 1_000 }), kind, options);
  for (const kind of ['plain', 'elder', 'office']) {
    for (const status of ['ordered', 'requesting']) {
      const gone = tick(running(kind, { status }), 500_000);
      assert.equal(gone.overtime.lost, true, `A ${kind} customer walking out burns the jar`);
      assert.equal(gone.overtime.jar, Math.floor(41 * OVERTIME_BURN_KEEPS), 'Half of it, rounded down');
      assert.equal(gone.stats.missed, 1, 'And they count against the day, having come in before the press');
    }
  }
  const shipperGone = tick(running('shipper'), 500_000);
  assert.equal(shipperGone.overtime.lost, false, 'A shipper leaving does not burn the jar');
  assert.equal(shipperGone.overtime.jar, 41, 'And costs none of it');
  const lateBurn = tick(running('plain', { late: true, rounds: 1 }), 500_000);
  assert.equal(lateBurn.overtime.lost, true, 'Being late themselves does not stop a customer burning it');
  const wrongCup = hand(running('plain'), { tea: 'green', size: 'L' });
  assert.equal(wrongCup.overtime.lost, false, 'A wrong drink does not burn it');
  assert.equal(wrongCup.stats.missed, 1, 'Though it is held against the day as ever');

  const two = seat(running('plain'), 'elder', { slot: 1 });
  const bothGone = tick(two, 500_000);
  assert.equal(bothGone.overtime.jar, Math.floor(41 * OVERTIME_BURN_KEEPS), 'Two walkouts in one tick halve it once');
  const again = seat({ ...shipperGone, overtime: { ...NO_OVERTIME, rounds: 1, jar: 20, lost: true }, slots: shipperGone.slots.map(() => null) }, 'plain');
  assert.equal(tick(again, 500_000).overtime.jar, 20, 'And a later walkout takes nothing more');
  assert.deepEqual(burnJar(NO_OVERTIME), NO_OVERTIME, 'There is nothing to burn before a press');
  const unpressedWalkout = tick(seat(shop(), 'plain'), 500_000);
  assert.deepEqual(unpressedWalkout.overtime, NO_OVERTIME, 'And a walkout before one touches nothing');
  const outOfTime = seat(shop({ clock: CLOSE - 10_000 }), 'plain');
  const beforeClosing = tick(press({ ...outOfTime, slots: outOfTime.slots.map((customer) => customer && { ...customer, patienceMs: 1_000 }) }), 2_000);
  assert.ok(beforeClosing.clock < CLOSE, 'This one is out of patience with the day proper still going');
  assert.ok(!beforeClosing.slots.some((customer) => customer?.id === outOfTime.slots[0].id), 'And gone, with the round\'s group coming in behind them');
  assert.equal(beforeClosing.overtime.lost, true, 'A walkout burns it from the press on, closing time or not');

  // A relaxed shop promised no pressure, and going relaxed keeps the jar: nothing there can burn it.
  const calmWalkout = tick(gameReducer(running('plain'), { type: 'SET_MODE', mode: 'relaxed' }), 500_000);
  assert.ok(calmWalkout.departures.some(({ outcome }) => outcome === 'timeout'), 'A customer can still give up in a relaxed shop');
  assert.deepEqual([calmWalkout.overtime.lost, calmWalkout.overtime.jar], [false, 41], 'Without costing it the jar');
  assert.equal(calmWalkout.stats.missed, 1, 'Though it counts against the day as it would anywhere');
  assert.equal(closeUp(calmWalkout).overtime.paid, 41, 'And the jar pays at closing, whole and with no bonus: going relaxed gave the bonus up');

  // After a burn the night pays normally, and the player has lost the right to press.
  const burnt = shop({ overtime: { ...NO_OVERTIME, rounds: 1, jar: 20, lost: true }, clock: FIRST_ROUND_ENDS - 5_000 });
  assert.equal(canExtend(burnt), false, 'No more rounds');
  const burntReread = gameReducer(parseGame(serializeGame(burnt)), { type: 'SET_PAUSED', paused: false });
  assert.deepEqual(burntReread.overtime, burnt.overtime, 'A reload does not undo a burn');
  assert.equal(canExtend({ ...burntReread, overtime: { ...burntReread.overtime, lost: false } }), true, 'That is what is keeping this shop from pressing');
  assert.equal(canExtend(burntReread), false, 'And it still cannot');
  assert.equal(jarPayout(burntReread.overtime), burnt.overtime.jar, 'Or get the bonus back');
  const afterBurn = hand(seat(burnt, 'plain'));
  assert.equal(afterBurn.overtime.jar, 20, 'The jar takes nothing more');
  assert.equal(afterBurn.coins, afterBurn.departures.at(-1).earned, 'Later sales pay the till');
  assert.equal(afterBurn.money, afterBurn.departures.at(-1).earned, 'Both halves of it');
  assert.ok(!('toJar' in afterBurn.departures.at(-1)), 'And the coins fly there');
  assert.ok(afterBurn.stats.tips > 0, 'Someone from before the press still tips into the day');
  const lateAfterBurn = hand(seat(burnt, 'plain', { late: true, rounds: 1 }));
  assert.ok(lateAfterBurn.money > 0, 'A late customer pays the till too');
  assert.deepEqual(lateAfterBurn.stats, zero, 'But they are still nothing to the stats');

  // ------------------------------------------------------------------ closing
  for (let rounds = 1; rounds <= OVERTIME_MAX_ROUNDS; rounds++) {
    for (const jar of [20, 40, 100, 140, 1_000]) {
      // The rate gives whole bonuses on these jars. Multiplied in binary, several come up a hair short.
      assert.equal(jarPayout({ rounds, jar, lost: false, paid: 0 }), jar + Math.round(jar * OVERTIME_BONUS_PER_ROUND * rounds), `${jar} at round ${rounds} pays its whole bonus`);
    }
  }
  assert.equal(jarPayout({ rounds: 1, jar: 7, lost: false, paid: 0 }), Math.floor(7 * (1 + OVERTIME_BONUS_PER_ROUND)), 'A fraction of a unit is rounded down');
  assert.equal(jarPayout({ rounds: 3, jar: 20, lost: true, paid: 0 }), 20, 'A burnt jar pays what is left of it, with no multiplier');
  assert.equal(jarPayout(NO_OVERTIME), 0, 'No jar pays nothing');

  const clean = shop({ overtime: { ...NO_OVERTIME, rounds: 2, jar: 100 }, clock: CLOSE + 2 * OVERTIME_ROUND_MS - 500, money: 900 });
  const closed = closeUp({ ...clean, coins: 300 });
  const bonus = jarPayout(clean.overtime);
  assert.equal(closed.overtime.paid, bonus, 'A clean close pays the jar and its bonus');
  assert.equal(closed.coins, 300 + bonus, 'Into today\'s takings');
  assert.equal(closed.money, 900 + bonus, 'And the till');
  assert.equal(closed.overtime.jar, 100, 'And the jar is left as it was, for the day-end screen to show');
  const burntClose = closeUp({ ...clean, overtime: { ...clean.overtime, jar: 30, lost: true } });
  assert.deepEqual([burntClose.overtime.paid, burntClose.money], [30, 930], 'A burnt jar pays what is left');
  const reread = parseGame(serializeGame(closed));
  assert.equal(reread.money, closed.money, 'A shop saved at the day-end screen has been paid');
  assert.deepEqual(reread.overtime, closed.overtime, 'And remembers what by');
  assert.equal(tick(reread, 1_000).money, closed.money, 'It is not paid twice on the way back');
  assert.equal(closeUp(shop({ clock: CLOSE - 500 })).overtime, NO_OVERTIME, 'A day that never stayed open has nothing to settle');
  assert.equal(closeUp(shop({ clock: CLOSE - 500, money: 50 })).money, 50, 'And pays nothing');

  const quiet = seat({ ...clean, clock: CLOSE + 1_000 }, 'plain');
  assert.equal(tick(quiet, 100).overtime, quiet.overtime, 'A tick that moves nothing hands back the same overtime, so nothing redraws');

  // ------------------------------------------------------------------ the menu, and the next day
  // Someone served and someone still waiting, so that there is money to lose and a shift to resume.
  const filled = () => hand(seat(jarred(), 'plain', { slot: 1 }));
  const midOvertime = filled();
  assert.ok(midOvertime.overtime.jar > 0, 'There is money in the jar');
  const putDown = gameReducer(midOvertime, { type: 'GO_TO_TITLE' });
  assert.ok(suspendedShift(putDown), 'Going to the menu in overtime suspends the shift');
  assert.deepEqual(putDown.overtime, midOvertime.overtime, 'With its overtime');
  assert.deepEqual(gameReducer(putDown, { type: 'RESUME_DAY' }).overtime, midOvertime.overtime, 'Which comes straight back');
  const nextDay = gameReducer(closed, { type: 'START_DAY', day: closed.day + 1 });
  assert.deepEqual(nextDay.overtime, NO_OVERTIME, 'A new day starts with no overtime');
  assert.equal(nextDay.money, closed.money, 'And keeps what the last one paid');
  const viaMenu = gameReducer(closed, { type: 'GO_TO_TITLE' });
  assert.deepEqual(viaMenu.overtime, NO_OVERTIME, 'So does the day built for the menu');
  assert.deepEqual(gameReducer(viaMenu, { type: 'START_DAY', day: viaMenu.day }), nextDay, 'And it is the same day either way');

  // ------------------------------------------------------------------ going relaxed with a jar running
  const calm = gameReducer(filled(), { type: 'SET_MODE', mode: 'relaxed' });
  assert.deepEqual(calm.overtime, { ...filled().overtime, forfeited: true }, 'The round stands, and the jar with it, and the bonus is gone');
  assert.equal(canExtend({ ...calm, clock: FIRST_ROUND_ENDS - 1_000 }), false, 'But no more are offered');
  assert.equal(press({ ...calm, clock: FIRST_ROUND_ENDS - 1_000 }).overtime.rounds, 1, 'Or taken');
  const calmSale = hand(calm);
  assert.ok(calmSale.overtime.jar > calm.overtime.jar, 'The jar keeps filling');
  const calmClosed = closeUp({ ...calmSale, nextSpawnAt: NOBODY_COMING });
  assert.equal(calmClosed.overtime.paid, jarPayout(calmSale.overtime), 'And pays at close');
  // Without the latch this is the safe way to the bonus: press three times, go relaxed from the pause
  // card so that nothing can burn, and come back before closing.
  const risked = { ...shop({ clock: CLOSE }), overtime: { ...NO_OVERTIME, rounds: OVERTIME_MAX_ROUNDS - 1, jar: 100 } };
  const allThree = press({ ...risked, clock: closesAt(risked) - 1_000 });
  assert.equal(allThree.overtime.rounds, OVERTIME_MAX_ROUNDS, 'Three rounds pressed');
  const roundTheBack = gameReducer(gameReducer(allThree, { type: 'SET_MODE', mode: 'relaxed' }), { type: 'SET_MODE', mode: 'standard' });
  assert.equal(roundTheBack.mode, 'standard', 'And back to standard before closing');
  assert.equal(roundTheBack.overtime.forfeited, true, 'The latch is in the overtime, and the trip back does not lift it');
  assert.equal(jarPayout(roundTheBack.overtime), 100, 'So the jar pays what is in it and no bonus');
  assert.ok(jarPayout(allThree.overtime) > 100, 'Which it would have had');
  const oneRoundIn = gameReducer(gameReducer(pressed, { type: 'SET_MODE', mode: 'relaxed' }), { type: 'SET_MODE', mode: 'standard' });
  const nextOffer = { ...oneRoundIn, clock: FIRST_ROUND_ENDS - 1_000 };
  assert.equal(canExtend(nextOffer), false, 'And there are no further rounds, even back in standard');
  assert.equal(press(nextOffer), nextOffer, 'The reducer refuses one as the pill does not offer it');
  assert.equal(canExtend({ ...nextOffer, overtime: { ...nextOffer.overtime, forfeited: undefined } }), true, 'That is the only thing keeping this shop from pressing');
  // The jar stays whole: it was the risk that was given up, so nothing can come for it afterwards.
  const forfeited = { ...running('plain'), overtime: { ...NO_OVERTIME, rounds: 1, jar: 41, forfeited: true } };
  const walkedOut = tick(forfeited, 500_000);
  assert.equal(walkedOut.overtime.lost, false, 'A walkout back in standard does not burn a forfeited jar');
  assert.equal(walkedOut.overtime.jar, 41, 'And takes none of it');
  assert.equal(walkedOut.overtime.forfeited, true, 'Which stays forfeited');
  const forfeitedSale = hand(forfeited);
  assert.ok(forfeitedSale.overtime.jar > 41, 'Later sales still go in the jar');
  assert.equal(forfeitedSale.departures.at(-1).toJar, true, 'With the coins flying to it');
  const forfeitedClose = closeUp({ ...forfeitedSale, nextSpawnAt: NOBODY_COMING, money: 500 });
  assert.equal(forfeitedClose.overtime.paid, forfeitedSale.overtime.jar, 'And it pays at closing with nothing on top');
  assert.equal(forfeitedClose.money, 500 + forfeitedSale.overtime.jar, 'Into the till');
  assert.equal(forfeitedClose.overtime.lost, false, 'Which is not a burn, so nothing on screen may call it one');
  // A press is the end of arrivals here too. Without this, one press and a trip to the settings kept a
  // full-patience customer in every free spot until the extended closing, which paid more than the
  // bonus it forfeited, and more than the jar played straight.
  const stoppedComing = gameReducer(pressed, { type: 'SET_MODE', mode: 'relaxed' });
  assert.equal(stoppedComing.waveLeft, 0, 'Going relaxed calls off the group the press brought, as it does any group');
  let emptyRound = stoppedComing;
  for (let i = 0; i < 60; i++) emptyRound = tick(emptyRound, 500);
  assert.ok(emptyRound.clock < closesAt(emptyRound), 'With the extended closing still to come');
  assert.deepEqual(emptyRound.slots, stoppedComing.slots, 'Nobody else comes in');
  assert.equal(emptyRound.nextId, stoppedComing.nextId, 'Nobody is even rolled');
  assert.equal(closeUp(emptyRound).stats.served, stoppedComing.stats.served, 'And the shop closes on what it had');
  const backAfterPress = gameReducer(stoppedComing, { type: 'SET_MODE', mode: 'standard' });
  assert.deepEqual(tick(backAfterPress, 5_000).slots, stoppedComing.slots, 'Nor does going back to standard bring anyone');
  const outside = seat(stoppedComing, 'shipper').slots[0];
  const stepsUp = tick({ ...stoppedComing, line: [outside] }, 500);
  assert.equal(stepsUp.slots.filter(Boolean).length, 1, 'Whoever was already outside still steps up');
  assert.equal(stepsUp.slots.find(Boolean).status, 'ordered', 'With their order taken');
  const noPress = tick(gameReducer(shop(), { type: 'SET_MODE', mode: 'relaxed' }), 500);
  assert.equal(noPress.slots.filter(Boolean).length, 1, 'A relaxed shop that never pressed goes on filling its spots');
  // Nothing latches with no round running: a shop may go relaxed and back on any ordinary day.
  const plainTrip = gameReducer(gameReducer(shop(), { type: 'SET_MODE', mode: 'relaxed' }), { type: 'SET_MODE', mode: 'standard' });
  assert.equal(plainTrip.overtime, NO_OVERTIME, 'A shop with no round running gives up nothing');
  assert.equal(canExtend(plainTrip), true, 'And can still press');
  const reloadedTrip = parseGame(serializeGame(roundTheBack));
  assert.equal(reloadedTrip.overtime.forfeited, true, 'A reload does not lift it');
  assert.equal(jarPayout(reloadedTrip.overtime), 100, 'Or bring the bonus back');
  const dayAfter = gameReducer(forfeitedClose, { type: 'START_DAY', day: forfeitedClose.day + 1 });
  assert.deepEqual(dayAfter.overtime, NO_OVERTIME, 'And it lasts the day and no longer');
  // The settings must not change who has overtime patience: there is one rule for arriving and one
  // for coming back from relaxed, and they have to agree.
  const crowd = (() => {
    let state = seat(shop(), 'plain');
    state = press(state);
    state = seat(state, 'plain', { slot: 1, late: true, rounds: 1 });
    return gameReducer(state, { type: 'SET_MODE', mode: 'relaxed' });
  })();
  const relaxedPatience = patienceFor(crowd, FACES.plain).patienceMs;
  assert.deepEqual(crowd.slots.map((customer) => customer && customer.patienceMs).slice(0, 2), [relaxedPatience, relaxedPatience], 'A relaxed shop ignores overtime patience for those already there');
  const crowdBack = gameReducer(crowd, { type: 'SET_MODE', mode: 'standard' });
  assert.equal(crowdBack.slots[0].patienceMs, patienceFor(crowdBack, FACES.plain).patienceMs, 'Back in standard, someone from before the press has the day\'s patience');
  assert.equal(crowdBack.slots[1].patienceMs, patienceFor(crowdBack, FACES.plain, { rounds: 1 }).patienceMs, 'And a late customer has a late customer\'s');
  // And the round they came in on, not the one the shop has reached since.
  const firstRound = seat(press(shop()), 'plain', { late: true, rounds: 1 });
  const secondRound = press({ ...firstRound, clock: closesAt(firstRound) - 1_000 });
  assert.equal(secondRound.overtime.rounds, 2, 'The shop has pressed again');
  const andBack = gameReducer(gameReducer(secondRound, { type: 'SET_MODE', mode: 'relaxed' }), { type: 'SET_MODE', mode: 'standard' });
  assert.equal(andBack.slots[0].patienceMs, firstRound.slots[0].patienceMs, 'A trip through the settings leaves a late customer the patience they arrived with');

  // ------------------------------------------------------------------ the sign
  const sign = (day, { mode = 'standard', seen = [] } = {}) => dayNews({ day, mode, seen }).map((news) => news.id);
  const told = ['kinds', 'regulars', 'waves'];
  assert.deepEqual(sign(OVERTIME_FROM_DAY - 1, { seen: told }), [], 'The day before it can be used, nothing is said about it');
  assert.deepEqual(sign(OVERTIME_FROM_DAY, { seen: told }), ['overtime'], 'From the first day it can be, it is');
  assert.deepEqual(sign(OVERTIME_FROM_DAY, { seen: ['kinds', 'regulars'] }), ['waves', 'overtime'], 'After whatever else has not been met');
  assert.deepEqual(sign(OVERTIME_FROM_DAY), ['kinds', 'regulars'], 'Which comes first, up to the limit of a sign');
  assert.deepEqual(sign(OVERTIME_FROM_DAY, { seen: [...told, 'overtime'] }), [], 'And only once');
  assert.deepEqual(sign(OVERTIME_FROM_DAY, { mode: 'relaxed' }), ['kinds', 'regulars'], 'A relaxed shop is not told about something it cannot do');
  assert.deepEqual(sign(OVERTIME_FROM_DAY + 1, { mode: 'relaxed', seen: ['kinds', 'regulars'] }), [], 'However late it is');
  assert.deepEqual(sign(OVERTIME_FROM_DAY + 5, { seen: told }), ['overtime'], 'Which leaves it to be told on any later day, once it is run by hand');
  assert.ok(dayNews({ day: 30, mode: 'standard', seen: [] }).length <= MAX_NEWS, 'Within the sign\'s limit');
  assert.equal(dayNews({ day: 3, mode: 'standard', seen: told })[0].line,
    `🌙 Cuối ngày có thể mở thêm ${OVERTIME_ROUND_MS / 1000} giây. Tiền tăng ca vào hũ, đóng cửa êm thì có thưởng.`, 'In the shop\'s words, and the round\'s real length');

  // ------------------------------------------------------------------ the shop's shopping
  assert.deepEqual(GEAR_IDS, ['plant', 'lantern', 'bench', 'board'], 'The catalogue, each at the price the brief set');
  assert.deepEqual(GEAR.map((item) => item.price), [200, 400, 800, 1_500], 'Cheapest first');
  for (const item of GEAR) {
    assert.ok(Number.isInteger(item.price) && item.price > 0, `${item.id} has a whole price`);
    assert.ok(item.name.length > 0 && item.blurb.length > 0, `${item.id} says what it is`);
    assert.equal(gearItem(item.id), item, 'And can be looked up');
  }

  const endOfDay = (money, gear = []) => ({ ...closeUp(shop({ clock: CLOSE - 500 })), money, gear });
  const plant = gearItem('plant');
  const lantern = gearItem('lantern');
  const buy = (state, id) => gameReducer(state, { type: 'BUY_GEAR', id });
  const bought = buy(endOfDay(plant.price + 7), 'plant');
  assert.deepEqual(bought.gear, ['plant'], 'A purchase is kept');
  assert.equal(bought.money, 7, 'And paid for out of the till');
  assert.equal(bought.coins, endOfDay(0).coins, 'Today\'s takings are what they were');
  assert.deepEqual(buy(endOfDay(plant.price), 'plant').money, 0, 'The whole till can go on it');
  assert.deepEqual(buy(bought, 'lantern').gear, bought.gear, 'A refused purchase changes nothing');
  const flush = endOfDay(plant.price * 5, ['plant']);
  assert.equal(buy(flush, 'plant'), flush, 'A thing is bought once');
  const poor = endOfDay(lantern.price - 1);
  assert.ok(!canAfford(poor, lantern.price), 'The till is a unit short');
  assert.equal(buy(poor, 'lantern'), poor, 'So it is refused');
  const rich = endOfDay(100_000);
  assert.equal(buy(rich, 'a-later-build'), rich, 'Something not in the catalogue is refused');
  assert.equal(buy(rich, 'toString'), rich, 'Whatever it is called');
  const playing = { ...shop({ money: 100_000 }) };
  assert.equal(buy(playing, 'plant'), playing, 'Nothing can be bought in the middle of a shift');
  const atMenu = { ...playing, phase: 'title' };
  assert.equal(buy(atMenu, 'plant'), atMenu, 'Or at the menu');

  const owning = buy(rich, 'plant');
  for (const [name, next] of [
    ['the next day', gameReducer(owning, { type: 'START_DAY', day: owning.day + 1 })],
    ['the menu', gameReducer(owning, { type: 'GO_TO_TITLE' })],
    ['a day opened from the menu', gameReducer(gameReducer(owning, { type: 'GO_TO_TITLE' }), { type: 'START_DAY', day: owning.day + 1 })],
    ['a reload', parseGame(serializeGame(owning))],
  ]) {
    assert.deepEqual(next.gear, ['plant'], `What the shop owns survives ${name}`);
  }
  assert.deepEqual(createInitialState(1).gear, [], 'A new shop owns nothing');

  // The order board: one spot, standard mode, and the customer starts on the serve timer.
  const arrive = (state) => {
    for (let i = 0; i < 40; i++) {
      const next = tick(state, 250);
      const customer = next.slots.find((candidate, slot) => candidate && !state.slots[slot]);
      if (customer) return { customer, state: next };
      state = next;
    }
    throw new Error('Nobody came');
  };
  const onlySpot = (free, gear, mode = 'standard') => {
    const state = seat(seat(seat({ ...shop({ clock: 5_000, gear, mode }), nextSpawnAt: 5_000, waveLeft: mode === 'standard' ? 1 : 0 }, 'plain', { slot: 0 }), 'plain', { slot: 1 }), 'plain', { slot: 2 });
    return { ...state, slots: state.slots.map((customer, slot) => (slot === free ? null : customer)) };
  };
  const atBoard = arrive(onlySpot(BOARD_SLOT, ['board']));
  assert.equal(atBoard.customer.status, 'ordered', 'A customer arriving at the board has ordered');
  assert.equal(atBoard.customer.orderedAt, atBoard.state.clock, 'And their serve timer starts as they arrive');
  assert.equal(BOARD_SLOT, 0, 'It stands at the first spot');
  const lateBoard = arrive({ ...onlySpot(BOARD_SLOT, ['board']), overtime: { ...NO_OVERTIME, rounds: 1 } });
  assert.equal(lateBoard.customer.status, 'ordered', 'And it works just the same past a press');
  const elsewhere = arrive(onlySpot(BOARD_SLOT + 1, ['board']));
  assert.equal(elsewhere.customer.status, 'requesting', 'Any other spot is taken by hand');
  assert.equal(elsewhere.customer.orderedAt, null, 'As ever');
  const noBoard = arrive(onlySpot(BOARD_SLOT, []));
  assert.equal(noBoard.customer.status, 'requesting', 'And without the board so is that one');
  const relaxedBoard = arrive(onlySpot(BOARD_SLOT + 1, ['board'], 'relaxed'));
  assert.equal(relaxedBoard.customer.status, 'ordered', 'A relaxed shop takes every order with or without it');
  assert.equal(gameReducer(atBoard.state, { type: 'TAKE_ORDER', slot: BOARD_SLOT }), atBoard.state, 'And there is no order at the board left to take');

  // What the wall shows, and what its texture is keyed by.
  assert.equal(wallGear([]), '', 'An unfurnished wall');
  assert.equal(wallGear(['board']), '', 'The board changes a verb and not the picture, so buying it redraws nothing');
  assert.equal(wallGear(['lantern', 'plant']), wallGear(['plant', 'lantern']), 'The order things were bought in makes no second picture');
  assert.equal(wallGear(['plant', 'board']), wallGear(['plant']), 'Whatever else is owned');
  const bare = shopBackdropSvg(390, 340, 'front');
  assert.equal(shopBackdropSvg(390, 340, 'front', ['board']), bare, 'The board draws nothing');
  assert.notEqual(shopBackdropSvg(390, 340, 'front', ['plant']), bare, 'The plant does');
  assert.notEqual(shopBackdropSvg(390, 340, 'front', ['lantern']), bare, 'And the lantern');
  assert.notEqual(shopBackdropSvg(390, 340, 'front', ['plant']), shopBackdropSvg(390, 340, 'front', ['lantern']), 'Two different things');
  const potted = shopBackdropSvg(932, 352, 'front', ['plant']);
  assert.ok(potted.indexOf('height="7"') > 0 && potted.indexOf('#9FDCCB') > potted.indexOf('height="7"'), 'The plant stands in front of the window\'s sill, and not behind it');

  console.log('check-overtime: closing time, the window, late customers, the jar and its burn, closing clean, relaxed, the sign, buying, the board and the wall.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
