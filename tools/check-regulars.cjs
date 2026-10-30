/* Run with node tools/check-regulars.cjs. Uses the project's TypeScript compiler for pure game code. */
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
  const { canServe, createInitialState, gameReducer, patienceLeft } = require(path.join(__dirname, '../src/game/reducer.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { decodeSaveCode, encodeSaveCode } = require(path.join(__dirname, '../src/game/saveCode.ts'));
  const { ARRIVAL_LINES, kindOf } = require(path.join(__dirname, '../src/game/customers.ts'));
  const { asksFor, BUILD_ORDER } = require(path.join(__dirname, '../src/game/ingredients.ts'));
  const { getDayConfig } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { formatMoney } = require(path.join(__dirname, '../src/game/money.ts'));
  const { generateOrder, orderTiles } = require(path.join(__dirname, '../src/game/orders.ts'));
  const { createRng } = require(path.join(__dirname, '../src/game/random.ts'));
  const { fitsUsual, orderVisible, regularById, regularDue, REGULARS, rollUsual, usualHidden } = require(path.join(__dirname, '../src/game/regulars.ts'));
  const { chipShift } = require(path.join(__dirname, '../src/counter/layout.ts'));
  const {
    closesAt, dayNews, MAX_TIP, OVERTIME_FROM_DAY, patienceFor, payoutFor, REGULAR_AT, REGULAR_AT_FIRST_DAY, STREAK_CAP, USUAL_MAX_TILES,
  } = require(path.join(__dirname, '../src/game/rules.ts'));

  const USUAL = { size: 'M', toppings: [], sweetness: null, ice: null, tea: 'black', milk: null, foam: null };
  const PLAIN = { skin: '#FFDCC2', hair: '#2B1B17', hairStyle: 'bun', shirt: '#7EC8E3', accessory: 'none' };

  const tick = (state, dt = 100) => gameReducer(state, { type: 'TICK', dt });
  const opened = (day = 2, seed = 4242) => gameReducer(createInitialState(seed), { type: 'START_DAY', day });
  const memory = (extra = {}) => ({ usual: USUAL, visits: 1, streak: 0, lastDay: 1, ...extra });
  const everyone = (state) => [...state.slots, ...state.line].filter(Boolean);
  const theRegular = (state) => everyone(state).find((customer) => customer.regularId);
  /** Tick until `done` says so, for things that come off the state's dice. */
  const until = (state, done, limit = 400_000) => {
    let next = state;
    for (let t = 0; t < limit && !done(next); t += 100) next = tick(next);
    assert.ok(done(next), 'It came to pass');
    return next;
  };

  /** A regular already standing at spot 0 of a shift under way, with the order taken. */
  function atCounter({ recall, visits = recall ? 1 : 0, streak = 0, day = 3, clock = 100_000, order = USUAL, status = 'ordered' } = {}) {
    const state = opened(day);
    const { look, name } = REGULARS[0];
    const slots = [...state.slots];
    const { orderPatienceMs, patienceMs } = patienceFor(state, look);
    slots[0] = {
      id: 7, look, name, order, status, arrivedAt: clock, orderPatienceMs, orderedAt: status === 'ordered' ? clock : null, patienceMs,
      regularId: 'thu', ...(recall ? { recall } : {}),
    };
    return {
      ...state, clock, slots, nextSpawnAt: Infinity, selectedSlot: status === 'ordered' ? 0 : null,
      regulars: { thu: memory({ usual: order, visits, streak, lastDay: day }) },
    };
  }

  /** Build a cup and hand it over. `amount` past the brim is a spill; a wrong size or tea is a slip. */
  function hand(state, { size = 'M', tea = 'black', amount = 0.6 } = {}) {
    let cup = gameReducer(state, { type: 'PICK_CUP', size });
    cup = gameReducer(cup, { type: 'POUR', category: 'tea', optionId: tea, amount });
    for (const type of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW']) cup = gameReducer(cup, { type });
    assert.ok(canServe(cup), 'The cup is ready');
    return gameReducer(cup, { type: 'SERVE' });
  }
  const asked = (state, slot = 0) => gameReducer(state, { type: 'ASK_AGAIN', slot });

  // ------------------------------------------------------------------ the four of them
  assert.equal(REGULARS.length, 4, 'Four regulars');
  assert.deepEqual(REGULARS.map((regular) => regular.id), ['thu', 'bao', 'na', 'tu'], 'In the order they are met');
  assert.deepEqual(REGULARS.map((regular) => regular.name), ['Chị Thư', 'Anh Bảo', 'Bé Na', 'Chú Tư'], 'Each by name');
  assert.deepEqual(REGULARS.map((regular) => regular.line), ['Nay chị mệt quá!', 'Tan ca là ghé liền!', 'Con vừa tan học!', 'Ly quen thuộc nhé!'], 'With a line of their own');
  for (const regular of REGULARS) {
    assert.equal(kindOf(regular.look), 'plain', `${regular.name} has no kind: the streak is what their pay is read for`);
    assert.equal(regularById(regular.id), regular, 'And can be looked up');
  }
  assert.equal(new Set(REGULARS.map(({ look }) => `${look.hairStyle}|${look.accessory}`)).size, 4, 'No two share a head, which is what is read at 40px');
  assert.equal(new Set(REGULARS.map(({ look }) => look.shirt)).size, 4, 'Or a shirt');
  assert.equal(regularById(undefined), undefined, 'A stranger is nobody');
  assert.deepEqual([REGULARS[0].look.hairStyle, REGULARS[1].look.hairStyle, REGULARS[2].look.hairStyle, REGULARS[2].look.accessory, REGULARS[3].look.hairStyle, REGULARS[3].look.hair],
    ['bun', 'spiky', 'bob', 'bow', 'short', '#9A9A9A'], 'The looks the brief set');

  // ------------------------------------------------------------------ the usual
  const size = (order) => 1 + BUILD_ORDER.reduce((tiles, category) => tiles + (category === 'toppings' ? order.toppings.length : asksFor(order, category) ? 1 : 0), 0);
  const config = getDayConfig(9);
  const stream = createRng(77);
  let short = 0;
  for (let i = 0; i < 4_000; i++) {
    const order = generateOrder(config, stream);
    assert.equal(orderTiles(order), size(order), 'The count of tiles is what the card lays out');
    if (orderTiles(order) <= USUAL_MAX_TILES) short += 1;
  }
  assert.ok(short / 4_000 > 0.1, `Short orders are common enough for the bound to mean something (${short / 40}%)`);
  const seenUsual = new Set();
  for (let seed = 1; seed <= 400; seed++) {
    const usual = rollUsual(config, createRng(seed));
    assert.ok(orderTiles(usual) <= USUAL_MAX_TILES, 'A usual is short enough to remember');
    assert.ok(usual.tea && usual.size, 'And is a real order');
    seenUsual.add(JSON.stringify(usual));
  }
  assert.ok(seenUsual.size > 50, 'And they are not all the same drink');
  assert.ok([...seenUsual].some((usual) => orderTiles(JSON.parse(usual)) === USUAL_MAX_TILES), 'And the bound is the bound: the longest a usual may be is a length they come in');
  const stubborn = { next: () => 0, int: (min) => min, pick: (items) => items[0], seed: 1 };
  assert.ok(orderTiles(generateOrder(config, stubborn)) > USUAL_MAX_TILES, 'A generator that only ever asks for everything');
  const fallback = rollUsual(config, stubborn);
  assert.equal(orderTiles(fallback), 2, 'Gets the plainest cup there is rather than a loop that never ends');
  assert.deepEqual([fallback.size, fallback.tea], ['M', config.options.tea[0]], 'And the same one every time');

  // What can be someone's usual, which a save is held to as well as the dice.
  const oneTopping = { maxToppings: 1 };
  const twoToppings = { maxToppings: 2 };
  assert.ok(fitsUsual(USUAL, oneTopping), 'A plain cup of tea is a usual');
  assert.ok(fitsUsual({ ...USUAL, toppings: ['pearls'], ice: 'less' }, oneTopping), 'And so is one at the bound');
  assert.ok(!fitsUsual({ ...USUAL, toppings: ['pearls'], ice: 'less', milk: 'whole' }, oneTopping), 'One tile past it is not');
  assert.ok(!fitsUsual({ ...USUAL, toppings: ['pearls', 'pudding'] }, oneTopping), 'Nor is more toppings than the day lets into a cup');
  assert.ok(fitsUsual({ ...USUAL, toppings: ['pearls', 'pudding'] }, twoToppings), 'Which the day decides');
  assert.ok(!fitsUsual({ ...USUAL, toppings: ['pearls', 'pearls'] }, twoToppings), 'Nor the same topping twice, which a cup refuses');
  assert.ok(!fitsUsual({ ...USUAL, tea: null }, oneTopping) && !fitsUsual({ ...USUAL, size: null }, oneTopping), 'And it has to be an order at all');
  for (let seed = 1; seed <= 400; seed++) assert.ok(fitsUsual(rollUsual(config, createRng(seed)), config), 'Everything the game rolls is one');

  // ------------------------------------------------------------------ who comes, and when
  const schedule = (day, regulars = {}) => ({ config: getDayConfig(day), day, overtime: { rounds: 0 }, regulars });
  const late = (day) => getDayConfig(day).durationMs;
  assert.equal(REGULAR_AT_FIRST_DAY, 0.6, 'Late on the first day');
  assert.equal(REGULAR_AT, 0.2, 'Early on the rest');
  assert.equal(regularDue(schedule(1), REGULAR_AT_FIRST_DAY * late(1) - 1), null, 'Nobody before the first day is far enough on');
  assert.equal(regularDue(schedule(1), REGULAR_AT_FIRST_DAY * late(1)).id, 'thu', 'Then the first of them');
  assert.equal(regularDue(schedule(2), REGULAR_AT * late(2) - 1), null, 'Any other day, the same with a smaller share');
  assert.equal(regularDue(schedule(2), REGULAR_AT * late(2)).id, 'thu', 'With nobody met, even an even day meets someone');
  // Written out by hand across twelve days, which is the rotation the brief describes.
  const rotation = [];
  let book = {};
  for (let day = 1; day <= 12; day++) {
    const next = regularDue(schedule(day, book), late(day));
    rotation.push(next.id);
    book = { ...book, [next.id]: memory({ lastDay: day }) };
  }
  assert.deepEqual(rotation, ['thu', 'thu', 'bao', 'thu', 'na', 'bao', 'tu', 'thu', 'na', 'bao', 'tu', 'thu'],
    'Odd days bring the next new face, even days whoever has been away longest, and once all are met it is whoever has been away longest');
  assert.equal(regularDue(schedule(4, { na: memory({ lastDay: 4 }) }), late(4)), null, 'One regular a shift');
  assert.equal(regularDue(schedule(4, { bao: memory({ lastDay: 2 }), thu: memory({ lastDay: 2 }) }), late(4)).id, 'thu', 'Level on days, the list decides, so there are no dice in it');
  assert.equal(regularDue({ ...schedule(4), overtime: { rounds: 1 } }, late(4)), null, 'And nobody once the shop has stayed open');
  assert.equal(regularDue({ ...schedule(4), overtime: { rounds: 0 } }, late(4)).id, 'thu', 'Which is the only thing about overtime that matters');

  // Day 1 meets one and day 2 brings that one back.
  const firstDay = until(opened(1), theRegular);
  const first = theRegular(firstDay);
  assert.ok(firstDay.clock >= REGULAR_AT_FIRST_DAY * firstDay.config.durationMs, 'The first regular comes late on the first day');
  assert.equal(first.regularId, 'thu', 'And it is Chị Thư');
  assert.equal(first.name, 'Chị Thư', 'By name');
  assert.deepEqual(first.look, REGULARS[0].look, 'With her own face');
  assert.ok(!('recall' in first), 'And her order on the card: there is nothing to remember yet');
  assert.ok(orderVisible(first), 'Which is what that means');
  assert.ok(orderTiles(first.order) <= USUAL_MAX_TILES, 'She has one of the short orders');
  const met = firstDay.regulars.thu;
  assert.deepEqual([met.usual, met.visits, met.streak, met.lastDay], [first.order, 0, 0, 1], 'Her usual is rolled on arrival, and the visit is written down there too');
  const said = firstDay.feedback.find((item) => item.tone === 'say' && firstDay.slots[item.slot]?.regularId);
  assert.equal(said?.text, 'Nay chị mệt quá!', 'She says her own line, not a stranger\'s');
  assert.ok(!ARRIVAL_LINES.plain.includes(said.text), 'Which is not on anyone else\'s list');
  assert.equal(first.patienceMs, patienceFor(firstDay, first.look).patienceMs, 'Her patience is the day\'s');

  // One visit a shift, however long the shift runs on.
  const wholeDay = (() => {
    let state = opened(3);
    const ids = new Set();
    while (state.phase === 'playing') {
      state = tick(state, 250);
      for (const customer of everyone(state)) if (customer.regularId) ids.add(customer.id);
      state = { ...state, slots: state.slots.map((customer) => (customer?.regularId ? null : customer)) };
    }
    return { state, ids };
  })();
  assert.equal(wholeDay.ids.size, 1, 'Exactly one regular comes in a shift');

  // The next day. Her visit only counts if she was handed something.
  const servedHer = { ...firstDay, regulars: { thu: { ...firstDay.regulars.thu, visits: 1, streak: 1 } }, slots: firstDay.slots.map(() => null), line: [] };
  const nextDay = until(gameReducer(servedHer, { type: 'START_DAY', day: 2 }), theRegular);
  assert.equal(theRegular(nextDay).regularId, 'thu', 'Day 2 brings her back');
  assert.equal(theRegular(nextDay).recall, 'blank', 'And this time it is "Như cũ nhé!"');
  assert.deepEqual(theRegular(nextDay).order, first.order, 'For the same drink');
  assert.equal(orderVisible(theRegular(nextDay)), false, 'Which the screen may not show');
  assert.equal(nextDay.regulars.thu.lastDay, 2, 'The visit is written down');
  assert.deepEqual([nextDay.regulars.thu.visits, nextDay.regulars.thu.streak], [1, 1], 'And coming in forgets nothing: this is the only place a streak is carried from one visit to the next');
  // Her usual is settled the first time she comes in, whether or not anyone ever makes it for her.
  const walkedOut = { ...servedHer, regulars: { thu: { ...servedHer.regulars.thu, visits: 0, streak: 0 } } };
  const backAgain = until(gameReducer(walkedOut, { type: 'START_DAY', day: 2 }), theRegular);
  assert.equal(theRegular(backAgain).recall, undefined, 'One who walked out before ever being served still shows her tiles');
  assert.deepEqual(theRegular(backAgain).order, first.order, 'Though her usual was settled the first time');
  assert.deepEqual([backAgain.regulars.thu.visits, backAgain.regulars.thu.streak], [0, 0], 'And coming in is not a visit: that takes a drink');
  const longStanding = { ...servedHer, regulars: { thu: memory({ usual: first.order, visits: 6, streak: 4, lastDay: 1 }) } };
  const sixthVisit = until(gameReducer(longStanding, { type: 'START_DAY', day: 2 }), theRegular);
  assert.deepEqual([sixthVisit.regulars.thu.visits, sixthVisit.regulars.thu.streak], [6, 4], 'However long it has run');
  assert.equal(hand({ ...sixthVisit, nextSpawnAt: Infinity, slots: sixthVisit.slots.map((customer) => (customer?.regularId ? { ...customer, status: 'ordered', orderedAt: sixthVisit.clock, order: USUAL } : null)),
    selectedSlot: sixthVisit.slots.findIndex((customer) => customer?.regularId) }).regulars.thu.streak, 5, 'So the run goes on from where it stood');

  // A shift that ends with nobody having come leaves nothing behind.
  const noShow = opened(5);
  const nobodyCame = { ...noShow, regulars: { thu: memory({ lastDay: 3 }) } };
  let empty = { ...nobodyCame, clock: late(5) + 1, slots: nobodyCame.slots.map(() => null) };
  empty = tick(empty);
  assert.equal(empty.phase, 'dayEnd', 'The day closes');
  assert.equal(empty.regulars.thu.lastDay, 3, 'And `lastDay` is only written on arrival');

  // ------------------------------------------------------------------ with the groups
  const quiet = (day, kinds, regulars = {}) => {
    const state = opened(day);
    const clock = late(day) * 0.5;
    return { ...state, clock, nextId: 40, nextSpawnAt: clock, regulars, waveLeft: kinds.length, incoming: kinds, lullUntil: clock };
  };
  const honest = tick(quiet(3, ['shipper', 'elder', 'office']));
  assert.equal(everyone(honest).length, 1, 'One of them comes in');
  assert.equal(theRegular(honest), undefined, 'And an announced shipper does not turn out to be a regular');
  assert.equal(kindOf(everyone(honest)[0].look), 'shipper', 'He is the shipper the quiet said was coming');
  const seat = tick(quiet(3, ['plain', 'elder', 'office']));
  assert.equal(theRegular(seat)?.regularId, 'thu', 'A place announced as plain can be hers');
  const unannounced = tick({ ...quiet(3, []), waveLeft: 3 });
  assert.equal(theRegular(unannounced)?.regularId, 'thu', 'And so can one nobody announced');
  assert.equal(theRegular(tick(quiet(3, ['plain'], { thu: memory({ lastDay: 3 }) }))), undefined, 'But not twice in a day');

  // A due visit must not starve on a group with no plain place in it.
  const roll = (seed, day = 3, regulars = {}) => {
    const state = opened(day, seed);
    const clock = late(day) * 0.5;
    return tick({ ...state, clock, nextId: 40, nextSpawnAt: clock, regulars });
  };
  // Day 11's group is larger than its counter, so a plain place at the back of it would be outside.
  assert.ok(getDayConfig(11).waveSize > getDayConfig(11).slots, 'Some groups do not all find a spot');
  let forced = 0;
  for (const day of [3, 11]) {
    for (let seed = 1; seed <= 400; seed++) {
      const rolled = roll(seed, day);
      assert.equal(rolled.incoming.length, rolled.config.waveSize, 'A group is rolled');
      assert.ok(rolled.incoming.slice(0, rolled.config.slots).includes('plain'), 'With a plain place among those who will find a spot, whenever a regular is due');
      if (rolled.incoming.filter((kind) => kind === 'plain').length === 1 && rolled.incoming[0] === 'plain') forced += 1;
    }
  }
  assert.ok(forced > 0, 'Which some groups needed');
  const notDue = (seed) => roll(seed, 3, { thu: memory({ lastDay: 3 }) });
  assert.ok(Array.from({ length: 400 }, (_, i) => notDue(i + 1)).some((state) => !state.incoming.includes('plain')), 'With nobody due, a group is left as it fell');
  const honoured = (seed) => {
    let state = roll(seed);
    const announced = state.incoming;
    state = { ...state, slots: state.slots.map(() => null) };
    state = until(state, (s) => s.waveLeft === 0);
    return { announced, kinds: everyone(state).map((customer) => kindOf(customer.look)), state };
  };
  for (let seed = 1; seed <= 60; seed++) {
    const { announced, kinds, state } = honoured(seed);
    assert.deepEqual(kinds.sort(), [...announced].sort(), 'The preview is what came in, regular included');
    assert.equal(theRegular(state)?.regularId, 'thu', 'And the visit happened');
  }
  // A visit nobody saw is no visit: she does not wait outside, where she could go home unnoticed.
  const fullCounter = quiet(3, ['plain', 'plain']);
  const packed = { ...fullCounter, slots: fullCounter.slots.map((_, slot) => ({ id: 900 + slot, look: PLAIN, name: 'Lan', order: USUAL, status: 'requesting', arrivedAt: fullCounter.clock, orderPatienceMs: 1e7, orderedAt: null, patienceMs: 1e7 })) };
  const outside = tick(packed);
  assert.equal(outside.line.length, 1, 'With every spot taken, the next through the door waits outside');
  assert.equal(outside.line[0].regularId, undefined, 'And it is not her');
  assert.equal(outside.regulars.thu, undefined, 'Nor has the visit been spent');

  // Overtime.
  const staying = (() => {
    const state = opened(OVERTIME_FROM_DAY + 1);
    const clock = closesAt(state) - 1_000;
    return { ...state, clock, nextId: 40, nextSpawnAt: clock, regulars: {} };
  })();
  const pressed = gameReducer(staying, { type: 'EXTEND_SHIFT' });
  assert.equal(pressed.overtime.rounds, 1, 'The shop stays open');
  const lateGroup = until(pressed, (state) => state.waveLeft === 0 || state.phase !== 'playing');
  assert.equal(everyone(lateGroup).filter((customer) => customer.lateRound !== undefined).length, everyone(lateGroup).length, 'Everyone who comes in is late');
  assert.equal(theRegular(lateGroup), undefined, 'And no regular comes in with them: a late customer never reaches the stats, and a visit should count');
  assert.deepEqual(lateGroup.regulars, {}, 'Nothing is written down');
  const beforeThePress = (() => {
    const state = atCounter({ day: OVERTIME_FROM_DAY + 1, clock: 200_000 });
    const near = { ...state, clock: closesAt(state) - 1_000 };
    const ranOn = gameReducer(near, { type: 'EXTEND_SHIFT' });
    return { ...ranOn, clock: closesAt(near) + 1_000, slots: ranOn.slots.map((customer) => customer && { ...customer, orderedAt: closesAt(near), arrivedAt: closesAt(near) }) };
  })();
  const lateSale = hand(beforeThePress);
  assert.equal(lateSale.overtime.jar > 0, true, 'Someone who came in before the press, served after it, pays the jar');
  assert.equal(lateSale.stats.served, 1, 'And counts as a customer of the day');
  assert.deepEqual([lateSale.regulars.thu.visits, lateSale.regulars.thu.streak], [1, 1], 'And as a visit');

  // ------------------------------------------------------------------ the relaxed shop
  let easy = gameReducer(opened(3), { type: 'SET_MODE', mode: 'relaxed' });
  easy = until(easy, theRegular);
  assert.equal(theRegular(easy).regularId, 'thu', 'A relaxed shop has regulars too');
  assert.equal(theRegular(easy).status, 'ordered', 'With the order taken for them');
  assert.ok(easy.clock >= REGULAR_AT * late(3), 'At the same point in the day');
  let easyAgain = gameReducer({ ...opened(4), regulars: { thu: memory({ usual: USUAL, visits: 2, lastDay: 1 }) } }, { type: 'SET_MODE', mode: 'relaxed' });
  easyAgain = until(easyAgain, theRegular);
  assert.equal(theRegular(easyAgain).recall, 'blank', 'And they still say "Như cũ nhé!"');
  assert.equal(theRegular(gameReducer(atCounter({ recall: 'blank', status: 'requesting' }), { type: 'SET_MODE', mode: 'relaxed' })).recall, 'blank',
    'Going relaxed takes a usual\'s order without showing it');

  // ------------------------------------------------------------------ Hỏi lại
  assert.equal(orderVisible({}), true, 'Anyone else\'s order can be seen');
  assert.equal(orderVisible({ recall: 'asked' }), true, 'And so can one asked for');
  assert.equal(orderVisible({ recall: 'blank' }), false, 'And a usual cannot');
  const blank = atCounter({ recall: 'blank' });
  const revealed = asked(blank);
  assert.equal(revealed.slots[0].recall, 'asked', 'Asking shows it');
  assert.ok(orderVisible(revealed.slots[0]), 'For the rest of the visit');
  assert.equal(asked(revealed), revealed, 'Asking twice changes nothing');
  const firstTime = atCounter();
  assert.equal(asked(firstTime), firstTime, 'A first visit has nothing to ask');
  const stranger = { ...blank, slots: [{ ...blank.slots[0], regularId: undefined, recall: undefined }, null, null] };
  assert.equal(asked(stranger), stranger, 'Nor does a stranger');
  assert.equal(asked(blank, 2), blank, 'Nor an empty spot');
  const requesting = atCounter({ recall: 'blank', status: 'requesting' });
  assert.equal(asked(requesting), requesting, 'It is asked at the ticket, once the order has been taken');
  const paused = gameReducer(blank, { type: 'SET_PAUSED', paused: true });
  assert.equal(asked(paused), paused, 'And not from behind the pause card, where the clock is stopped');
  const atMenu = gameReducer(blank, { type: 'GO_TO_TITLE' });
  assert.equal(asked(atMenu), atMenu, 'Or from the menu');
  assert.equal(revealed.clock, blank.clock, 'It takes no time of itself');
  assert.equal(patienceLeft(revealed.slots[0], revealed.clock), patienceLeft(blank.slots[0], blank.clock), 'And no patience');

  // ------------------------------------------------------------------ what it pays
  const sale = (regular, { quality = 'perfect', neat = true, patience = 1, price = 8 } = {}) =>
    payoutFor({ quality, neat, price, patienceLeft: patience, look: PLAIN, regular });
  assert.equal(sale(undefined).streak, undefined, 'A stranger has no streak to report');
  assert.equal(sale({ streak: 0 }).tip, MAX_TIP, 'A first visit tips like anyone');
  assert.equal(sale({ streak: 0 }).streak, 1, 'And starts a streak');
  assert.equal(sale({ streak: 3 }).tip, MAX_TIP, 'The bonus is for remembering, and there was nothing to remember');
  for (let streak = 0; streak <= STREAK_CAP + 3; streak++) {
    const remembered = sale({ recall: 'blank', streak });
    assert.equal(remembered.tip, MAX_TIP + Math.min(streak, STREAK_CAP), `A streak of ${streak} adds to the tip, up to its cap`);
    assert.equal(remembered.earned, 8 + remembered.tip, 'And that is what it pays');
    assert.equal(remembered.streak, streak + 1, 'And it goes on growing past the cap');
    assert.ok(remembered.text.includes(formatMoney(remembered.earned)), 'The counter says what it paid');
    assert.equal(remembered.tone, 'good');
    const question = sale({ recall: 'asked', streak });
    assert.deepEqual([question.tip, question.earned, question.streak], [0, 8, streak], 'Asking costs the whole tip and leaves the streak where it stood');
    const spill = sale({ recall: 'blank', streak }, { neat: false });
    assert.deepEqual([spill.tip, spill.earned, spill.streak], [0, 4, streak], 'A spill is half price from a regular too, and the streak stands');
    assert.equal(sale({ recall: 'asked', streak }, { neat: false }).earned, 4, 'Asked or not');
    for (const quality of ['close', 'wrong']) {
      for (const recall of ['blank', 'asked', undefined]) {
        assert.equal(sale({ recall, streak }, { quality }).streak, 0, `A ${quality} cup ends the streak (${recall ?? 'first visit'})`);
      }
    }
  }
  assert.equal(sale({ recall: 'blank', streak: 0 }, { patience: 0 }).tip, 1, 'A slow cup still earns the least tip');
  assert.equal(sale({ recall: 'blank', streak: 2 }, { patience: 0 }).tip, 1 + 2, 'With the streak on top');

  // The same, through a real cup.
  const remembered = hand(atCounter({ recall: 'blank', visits: 3, streak: 2 }));
  assert.deepEqual([remembered.regulars.thu.visits, remembered.regulars.thu.streak], [4, 3], 'A remembered cup is a visit, and the streak grows');
  assert.equal(remembered.stats.tips, MAX_TIP + 2, 'The bonus is in the day\'s tips');
  assert.equal(remembered.coins - 4, MAX_TIP + 2, 'And in the till');
  assert.equal(remembered.stats.perfect, 1, 'And it is a perfect cup');
  const first1 = hand(atCounter());
  assert.deepEqual([first1.regulars.thu.visits, first1.regulars.thu.streak], [1, 1], 'A first perfect visit starts the streak');
  const askedCup = hand(asked(atCounter({ recall: 'blank', visits: 3, streak: 4 })));
  assert.deepEqual([askedCup.regulars.thu.visits, askedCup.regulars.thu.streak], [4, 4], 'An asked cup is a visit, and the streak stands');
  assert.equal(askedCup.stats.tips, 0, 'No tip');
  assert.equal(askedCup.stats.perfect, 1, 'But it is still the right drink');
  const spilt = hand(atCounter({ recall: 'blank', visits: 3, streak: 4 }), { amount: 1.2 });
  assert.deepEqual([spilt.regulars.thu.visits, spilt.regulars.thu.streak], [4, 4], 'A spilled cup is a visit, and the streak stands');
  assert.equal(spilt.coins, 2, 'At half price');
  const nearly = hand(atCounter({ recall: 'blank', visits: 3, streak: 4 }), { size: 'L' });
  assert.deepEqual([nearly.departures.at(-1).outcome, nearly.regulars.thu.visits, nearly.regulars.thu.streak], ['close', 4, 0], 'Nearly right is a visit, and the streak is over');
  const wrongly = hand(atCounter({ recall: 'blank', visits: 3, streak: 4 }), { size: 'L', tea: 'green' });
  assert.deepEqual([wrongly.departures.at(-1).outcome, wrongly.regulars.thu.visits, wrongly.regulars.thu.streak], ['wrong', 4, 0], 'So is a wrong guess');
  assert.equal(wrongly.stats.missed, 1, 'Which is a customer let down, like any other');
  const unmoved = (state) => until(state, (s) => !s.slots[0] || s.slots[0].regularId === undefined);
  const walked = unmoved(atCounter({ recall: 'blank', visits: 3, streak: 4 }));
  assert.deepEqual([walked.regulars.thu.visits, walked.regulars.thu.streak], [3, 4], 'A timeout only pauses the streak, and is not a visit');
  assert.ok(walked.stats.missed >= 1, 'It is still a customer lost');
  const stillFirst = unmoved(atCounter());
  assert.deepEqual([stillFirst.regulars.thu.visits, stillFirst.regulars.thu.streak], [0, 0], 'Nobody has been served yet');
  // A stranger's cup touches nothing, and the same list comes back for the subscribers.
  const plainState = atCounter();
  const strangerCup = hand({ ...plainState, slots: plainState.slots.map((customer) => customer && { ...customer, regularId: undefined }) });
  assert.equal(strangerCup.regulars, plainState.regulars, 'A stranger\'s cup leaves the book alone');
  assert.equal(tick(plainState).regulars, plainState.regulars, 'And a tick hands back the same record');

  // ------------------------------------------------------------------ what the counter says about it
  // A spot on a phone's three is 125px, and `Đúng như cũ! +160k` comes to 154 with its chip around it.
  const spot = 375 / 3;
  assert.equal(chipShift(spot * 1.5, 154, 375), 0, 'The middle spot has room either side');
  assert.equal(chipShift(spot / 2, 100, 375), 0, 'And a chip that fits is left centred over its customer');
  assert.equal(chipShift(spot / 2, 154, 375), 18.5, 'The left spot\'s is moved in off the edge');
  assert.equal(chipShift(spot * 2.5, 154, 375), -18.5, 'And the right spot\'s, the other way');
  for (const slot of [0, 1, 2]) {
    for (const width of [40, 90, 120, 154, 180, 200]) {
      const centre = spot * (slot + 0.5);
      const left = centre + chipShift(centre, width, 375) - width / 2;
      assert.ok(left >= 0 && left + width <= 375, 'No chip leaves the stage');
    }
  }

  // ------------------------------------------------------------------ a day comes and goes
  const shop = { thu: memory({ visits: 4, streak: 3, lastDay: 6 }) };
  const ended = { ...opened(6), phase: 'dayEnd', regulars: shop };
  assert.equal(gameReducer(ended, { type: 'START_DAY', day: 7 }).regulars, shop, 'The next day knows them');
  const onTheMenu = gameReducer(ended, { type: 'GO_TO_TITLE' });
  assert.equal(onTheMenu.regulars, shop, 'And so does the menu');
  assert.equal(gameReducer(onTheMenu, { type: 'START_DAY', day: 7 }).regulars, shop, 'And the day opened from it');
  assert.deepEqual(gameReducer(onTheMenu, { type: 'START_DAY', day: 7 }), gameReducer(ended, { type: 'START_DAY', day: 7 }), 'Both ways build the same day: nothing is rolled in building one');
  assert.deepEqual(createInitialState(1).regulars, {}, 'A new shop knows nobody');

  // ------------------------------------------------------------------ the sign
  const sign = (day, seen = [], mode = 'standard') => dayNews({ day, mode, seen }).map((news) => news.id);
  assert.deepEqual(sign(1), [], 'Day 1 has the how-to-play');
  assert.deepEqual(sign(2), ['kinds', 'regulars'], 'Regulars are told on day 2, the day the first "Như cũ nhé!" comes in');
  assert.deepEqual(sign(3, ['kinds']), ['regulars', 'waves'], 'They come straight after the kinds');
  assert.deepEqual(sign(2, ['kinds', 'waves']), ['regulars'], 'And are not held back for anything');
  assert.deepEqual(sign(9, ['kinds', 'waves', 'overtime', 'regulars']), [], 'And are told once');
  assert.deepEqual(sign(9, ['kinds'], 'relaxed'), ['regulars'], 'A relaxed shop has them too');
  assert.equal(dayNews({ day: 2, mode: 'standard', seen: ['kinds', 'waves'] })[0].line,
    '🤝 Khách quen nói “Như cũ nhé!” — nhớ món thì pha, quên thì hỏi lại và mất tip.', 'In the shop\'s own words');

  // ------------------------------------------------------------------ Sổ khách
  const waiting = atCounter({ recall: 'blank' });
  assert.equal(usualHidden(waiting, 'thu'), true, 'The book keeps quiet about someone standing there on a blank card');
  assert.equal(usualHidden(asked(waiting), 'thu'), false, 'Until they have been asked');
  assert.equal(usualHidden(waiting, 'bao'), false, 'And it is only that one');
  assert.equal(usualHidden(gameReducer(waiting, { type: 'GO_TO_TITLE' }), 'thu'), true, 'The menu is no way round it: the shift is still there');
  assert.equal(usualHidden(hand(waiting), 'thu'), false, 'Once they have gone, it is the shop\'s to read');
  // The same stopped clock before the day's regular has walked in, with a resume between it and them.
  const shiftOn = { ...opened(2), clock: 20_000, regulars: { thu: memory({ lastDay: 1 }), bao: memory({ lastDay: 0 }) } };
  const putDown = gameReducer(shiftOn, { type: 'GO_TO_TITLE' });
  const dueNext = regularDue(putDown, 1e6).id;
  const stayingAway = dueNext === 'thu' ? 'bao' : 'thu';
  assert.equal(usualHidden(putDown, dueNext), true, 'The book keeps quiet about whoever is still to come in a shift put down at the menu');
  assert.equal(usualHidden(putDown, stayingAway), false, 'And only them: nobody else is coming today');
  assert.equal(usualHidden({ ...putDown, clock: 0 }, dueNext), false, 'Between days it is the shop\'s to read');
  assert.equal(usualHidden({ ...shiftOn, phase: 'dayEnd' }, dueNext), false, 'And on the day-end card');
  assert.equal(usualHidden({ ...putDown, regulars: { ...putDown.regulars, [dueNext]: memory({ lastDay: 2 }) } }, dueNext), false,
    'Once the day has had its visit, there is nothing left to peek at');
  assert.equal(usualHidden({ ...putDown, overtime: { ...putDown.overtime, rounds: 1 } }, dueNext), false, 'And none comes after a press');

  // ------------------------------------------------------------------ saved
  const midVisit = { ...atCounter({ recall: 'blank', visits: 3, streak: 2 }), nextSpawnAt: 100_000 };
  const reloaded = parseGame(serializeGame(midVisit));
  assert.deepEqual(reloaded.regulars, midVisit.regulars, 'What the shop knows comes back');
  assert.equal(reloaded.slots[0].regularId, 'thu', 'Who she is comes back');
  assert.equal(reloaded.slots[0].recall, 'blank', 'And that the card is hidden: without this a reload is a free look');
  assert.equal(parseGame(serializeGame(asked(midVisit))).slots[0].recall, 'asked', 'A reload is no way out of having asked');
  assert.equal(parseGame(serializeGame(gameReducer(midVisit, { type: 'GO_TO_TITLE' }))).slots[0].recall, 'blank', 'Nor is the menu');
  assert.deepEqual(serializeGame(reloaded), serializeGame(midVisit), 'And the bytes are the same bytes');
  const out = { ...midVisit, line: [{ ...midVisit.slots[0], id: 8 }], slots: [null, null, null] };
  assert.equal(parseGame(serializeGame(out)).line[0].recall, 'blank', 'Whoever saves someone outside keeps them who they are');
  assert.equal(parseGame(serializeGame(out)).line[0].regularId, 'thu', 'Name and all');
  const paid = gameReducer(reloaded, { type: 'SET_PAUSED', paused: false });
  assert.deepEqual(hand(paid).regulars.thu, hand(midVisit).regulars.thu, 'A reloaded visit is settled exactly as it would have been');
  assert.equal(hand(paid).coins, hand(midVisit).coins, 'For the same money');
  const code = encodeSaveCode(midVisit);
  assert.equal(serializeGame(decodeSaveCode(code)), serializeGame(midVisit), 'A backup code carries them, byte for byte');
  // Neither the catalogue's order nor the alphabet's, because the reducer's copy has them as they were met.
  const outOfOrder = { ...midVisit, regulars: { tu: memory({ lastDay: 5 }), thu: midVisit.regulars.thu, na: memory({ lastDay: 4 }) } };
  assert.equal(serializeGame(parseGame(serializeGame(outOfOrder))), serializeGame(outOfOrder), 'Whatever order they were met in');
  // A whole played day, saved halfway through and played on: the dice and the visit come out the same.
  let played = opened(3, 31);
  while (!theRegular(played)) played = tick(played, 250);
  let replayed = gameReducer(parseGame(serializeGame(played)), { type: 'SET_PAUSED', paused: false });
  for (let i = 0; i < 200; i++) {
    played = tick(played, 250);
    replayed = tick(replayed, 250);
  }
  assert.deepEqual(replayed, played, 'A reloaded shop plays out the same day');

  const good = JSON.parse(serializeGame(midVisit));
  const tamper = (mutate) => {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    return JSON.stringify(copy);
  };
  const noRegulars = parseGame(tamper((s) => {
    delete s.regulars;
    s.slots[0] = { ...s.slots[0], regularId: undefined, recall: undefined };
  }));
  assert.deepEqual(noRegulars.regulars, {}, 'A save from before regulars knows nobody');
  assert.equal(regularDue({ ...noRegulars, day: 20 }, 1e6).id, 'thu', 'And a shop on day 20 meets the first of them');
  // Everything in here is tidied rather than refused: it is one acquaintance, against a whole shop.
  assert.deepEqual(parseGame(tamper((s) => (s.regulars = 'lots'))).regulars, {}, 'A record that is not one is nobody');
  assert.deepEqual(Object.keys(parseGame(tamper((s) => (s.regulars.ghost = s.regulars.thu))).regulars), ['thu'], 'An id this build has not met is dropped');
  assert.deepEqual(Object.keys(parseGame(tamper((s) => (s.regulars.constructor = s.regulars.thu))).regulars), ['thu'], 'Whatever it is called');
  for (const [name, mutate] of [
    ['a usual for a tea since taken off the shelf', (s) => (s.regulars.thu.usual.tea = 'earl-grey')],
    ['a usual with no tea', (s) => (s.regulars.thu.usual.tea = null)],
    ['a usual with no size', (s) => (s.regulars.thu.usual.size = null)],
    ['a usual past the bound', (s) => Object.assign(s.regulars.thu.usual, { toppings: ['pearls'], sweetness: '50', ice: 'less', milk: 'whole', foam: 'cheese' })],
    ['a usual with more toppings than a cup takes', (s) => (s.regulars.thu.usual.toppings = ['pearls', 'pudding'])],
    ['a usual with one topping twice', (s) => (s.regulars.thu.usual.toppings = ['pearls', 'pearls'])],
    ['a usual that is not a drink', (s) => (s.regulars.thu.usual = 'trà')],
    ['visits below nothing', (s) => (s.regulars.thu.visits = -1)],
    ['half a visit', (s) => (s.regulars.thu.visits = 1.5)],
    ['a streak that is a word', (s) => (s.regulars.thu.streak = 'long')],
    ['a day before the first', (s) => (s.regulars.thu.lastDay = 0)],
    ['a memory that is not one', (s) => (s.regulars.thu = 3)],
  ]) {
    const kept = parseGame(tamper((s) => {
      s.regulars.bao = JSON.parse(JSON.stringify(s.regulars.thu));
      mutate(s);
    }));
    assert.ok(kept, `${name} does not cost the shop`);
    assert.deepEqual(Object.keys(kept.regulars), ['bao'], `It costs that one acquaintance (${name})`);
    assert.equal(kept.slots[0].regularId, undefined, 'And whoever stood there is now just someone at the counter');
    assert.equal(kept.slots[0].recall, undefined, 'With their order showing, since nothing could settle a hidden one');
  }
  // The memory is one acquaintance. The customer standing there is a copy of it, and an order is held to
  // the catalogue like anyone else's, so a lost ingredient on the counter is a shop this build cannot open.
  const stillThere = tamper((s) => {
    s.regulars.thu.usual.tea = 'earl-grey';
    s.slots[0].order.tea = 'earl-grey';
  });
  assert.equal(parseGame(stillThere), null, 'A usual with a lost tea, being waited for right now, is refused with the save');
  assert.equal(parseGame(tamper((s) => {
    s.slots[0] = { ...s.slots[0], regularId: undefined, recall: undefined, order: { ...s.slots[0].order, tea: 'earl-grey' } };
  })), null, 'As a stranger\'s order is');
  // A usual that is too long names nothing lost, so whoever is holding one stays, as a stranger.
  const overlong = parseGame(tamper((s) => {
    const usual = { ...s.regulars.thu.usual, toppings: ['pearls'], sweetness: '50', ice: 'less', milk: 'whole', foam: 'cheese' };
    s.regulars.thu.usual = usual;
    s.slots[0].order = usual;
  }));
  assert.ok(overlong, 'A usual past the bound, being waited for, does not cost the shop');
  assert.deepEqual(overlong.regulars, {}, 'Only the acquaintance');
  assert.deepEqual([overlong.slots[0].regularId, overlong.slots[0].recall], [undefined, undefined], 'And nobody is left on a card that can never be got right');
  // Two toppings is a real usual from the day a cup takes two, and every day after it.
  const fifth = { ...atCounter({ day: 5, order: { ...USUAL, toppings: ['pearls', 'pudding'] } }), nextSpawnAt: 100_000 };
  assert.deepEqual(parseGame(serializeGame(fifth)).regulars, fifth.regulars, 'Whatever a shop could really have rolled comes back');

  const newerFace = parseGame(tamper((s) => (s.slots[0].regularId = 'ghost')));
  assert.ok(newerFace, 'A customer this build does not know does not cost the shop');
  assert.ok(!('regularId' in newerFace.slots[0]) && !('recall' in newerFace.slots[0]), 'They are simply a stranger');
  assert.ok(orderVisible(newerFace.slots[0]), 'Whose order can be read');
  assert.equal(parseGame(tamper((s) => (s.slots[0].regularId = 'constructor'))).slots[0].regularId, undefined, 'And an id is not whatever an object happens to inherit');
  assert.equal(parseGame(tamper((s) => (s.slots[0].regularId = 7))), null, 'A regular that is a number is not a customer at all');
  assert.equal(parseGame(tamper((s) => (s.slots[0].recall = 'maybe'))), null, 'Nor is a card in a state that does not exist');
  assert.equal(parseGame(tamper((s) => (s.slots[0].recall = true))), null, 'Or one that is not a word');
  const strangerSave = hand(atCounter()).slots;
  assert.ok(strangerSave.every((customer) => customer === null), 'She has gone, and left no one behind');

  // ------------------------------------------------------------------ nothing reads an order past the gate
  // The answer has already got out through a bubble, a title, a count, a progress bar, a ready dot and
  // an aria label. These are all HTML or canvas, which a regression script cannot run, so this reads
  // them. Any read of an order outside the rules counts, whatever it is called and whatever it came
  // through, and every one the screen has is named below along with the gate it stands behind: a file
  // saying `orderVisible` somewhere is not the same thing as a read being behind it.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(entry.name) ? [file] : [];
  });
  const src = path.join(__dirname, '../src');
  const read = (file) => fs.readFileSync(path.join(src, file), 'utf8');
  // `.order` and `['order']`, off anything, and `order` taken out of anything. Not `.order-card`.
  const ORDER_READ = /\.order\b(?![-\w])|\[\s*['"`]order['"`]\s*\]|\{[^{}]*\border\b[^{}]*\}\s*(?:=[^=>]|\)\s*=>|:)/g;
  const screen = walk(src).filter((file) => !file.includes(`${path.sep}game${path.sep}`) && !file.includes(`${path.sep}art${path.sep}`));
  const orderReads = Object.fromEntries(screen.flatMap((file) => {
    const found = fs.readFileSync(file, 'utf8').match(ORDER_READ);
    return found ? [[path.basename(file), found.length]] : [];
  }));
  assert.deepEqual(orderReads, { 'CustomerView.ts': 2, 'OrderBubble.tsx': 3 }, 'Only the bubble and the card read an order, this many times each: a new read here has to be given a gate below');
  // The bubble: a drawn cup is the whole of the answer, and the size tag beside it half of it.
  const view = read('counter/CustomerView.ts');
  assert.match(view, /if \(orderVisible\(customer\)\) \{\s+void ctx\.bank\.get\([^\n]*\n\s*\(\) => cupSvg\(customer\.order,/, 'The bubble\'s cup is not drawn ahead of being asked for');
  assert.match(view, /const pad = requesting \|\| !orderVisible\(customer\);/, 'The bubble stays a pad until it is');
  assert.match(view, /this\.buildContent\(pad\);/, 'That is what decides what goes in it');
  assert.match(view, /if \(showPad\) \{[\s\S]*\} else \{\s+const owner = ownerOf\(this\.customer\);\s+const order = this\.customer\.order;/, 'And the order is only read on the way to a cup');
  // The card reads it on three lines, and each of them has to say why it may.
  const card = read('ui/OrderBubble.tsx');
  const reads = card.split(/\r?\n/).filter((line) => /\.order\b(?![-\w])/.test(line));
  assert.equal(reads.length, 3, 'The card reads an order in three places');
  for (const line of reads) assert.match(line, /orderVisible\(customer\)|\bvisible\b/, `Behind the gate: ${line.trim()}`);
  assert.match(card, /const visible = orderVisible\(customer\);/, 'And the queue pin\'s gate is the real one');

  // ------------------------------------------------------------------ the rest of the card and the book
  // Rules of a screen that nothing runs, each of which fails with nothing to show for it.
  assert.match(card, /class="ask-again live"/, 'Hỏi lại takes touches: the HTML over the room lets them through unless it says so');
  assert.match(card, /dispatch\(\{ type: 'ASK_AGAIN', slot \}\)/, 'And it asks');
  assert.match(card, /<div class="order-chips-inline">\{tiles\}<\/div>/, 'It stands where the tiles stand laid across the top');
  assert.match(card, /<div\s+class=\{`order-chips \$\{tall \? 'wrap' : ''\}`\}[\s\S]{0,200}?\{tiles\}\s*<\/div>/, 'And anywhere else');
  assert.match(card, /!\(compactQueue && hidden\)/, 'A hidden card keeps its subtitle out of the part a queue hides');
  assert.match(card, /hidden \? <div class="order-subtitle">\{`Cho \$\{customer\?\.name\}`\}<\/div>/, 'And says who it is for beside the queue, since nothing else on it does');
  assert.match(card, /fitTiles\(usual \? USUAL_MAX_TILES : chips\.length, room, tileRoom\)/, 'A usual\'s card in a column is the same height whatever is in it, or the height is a clue');
  assert.match(card, /usual \? \{ minHeight: Math\.max\(grid\.height, ASK_HEIGHT\) \}/, 'Before asking and after');
  const openers = screen.filter((file) => /book: true/.test(fs.readFileSync(file, 'utf8'))).map((file) => path.basename(file)).sort();
  assert.deepEqual(openers, ['DayEndScreen.tsx', 'TitleScreen.tsx'], 'Sổ khách opens from the menu and the day\'s end, and not from the pause card, where the clock is stopped');
  assert.doesNotMatch(read('ui/GameScreen.tsx'), /Sổ khách|RegularBook|book:/, 'The pause card has no way into it');
  const bookPage = read('ui/RegularBook.tsx');
  assert.match(bookPage, /const waiting = useGame\(\(state\) => usualHidden\(state, regular\.id\)\);/, 'The book asks who is waiting on a usual');
  assert.match(bookPage, /\{waiting \? \(\s+<div class="book-note">[\s\S]*\) : \(\s+<div class="book-usual">/, 'And keeps that one back');
  assert.match(read('ui/App.tsx'), /uiState\.set\(\{ settings: false, book: false \}\);/, 'It does not follow the player to another screen');
  // A restored shop can hand an id to another face, and sharing a figure with one froze the canvas for good.
  assert.match(read('counter/Stage.ts'), /if \(view && ownerOf\(view\.customer\) === ownerOf\(customer\)\) \{/, 'A figure is only reused for the same face');
  assert.match(read('counter/FloatingText.ts'), /chipShift\(layout\.slots\[feedback\.slot\]\?\.centre \?\? 0, width, layout\.width\)/, 'A chip knows where the edge of the stage is');
  assert.match(read('counter/FloatingText.ts'), /scene\.add\.container\(shift, top, \[chip, text\]\)/, 'And stands by it');

  console.log('check-regulars: who comes and when, the usual, seats and groups, Hỏi lại, the streak, the sign, the book, and a visit saved and played on.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
