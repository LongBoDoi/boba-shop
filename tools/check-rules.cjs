/* Run with node tools/check-rules.cjs. Uses the project's TypeScript compiler for pure game code. */
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
  const { createInitialState, gameReducer, patienceLeft } = require(path.join(__dirname, '../src/game/reducer.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { ACCESSORIES, ARRIVAL_LINES, HAIR_STYLES, KIND_MARK, kindOf } = require(path.join(__dirname, '../src/game/customers.ts'));
  const { getDayConfig } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { formatMoney } = require(path.join(__dirname, '../src/game/money.ts'));
  const {
    dayNews, KIND_PATIENCE, KIND_TIP, leftContent, MAX_TIP, MIN_TIP, OFFICE_BONUS, ORDER_PATIENCE_FLOOR_MS,
    PARTIAL_PAY, patienceFor, payoutFor, SAY_MS, SERVE_PATIENCE_FLOOR_MS, starsFor, THREE_STAR_HAPPY, THREE_STAR_PERFECT,
    TWO_STAR_HAPPY, walkoutFor,
  } = require(path.join(__dirname, '../src/game/rules.ts'));

  const look = (hairStyle, accessory = 'none') => ({ skin: '#FFDCC2', hair: '#2B1B17', hairStyle, shirt: '#7EC8E3', accessory });
  const FACES = { plain: look('bun'), shipper: look('cap'), elder: look('balding'), office: look('short', 'glasses') };
  const KINDS = Object.keys(FACES);
  const TEA = { size: 'M', toppings: [], sweetness: null, ice: null, tea: 'black', milk: null, foam: null };

  /** Stand one customer of a kind in a slot of a day that is under way, as if they had just ordered. */
  function counter(kind, { day = 3, clock = 10_000, mode = 'standard', status = 'ordered', slot = 0 } = {}) {
    let state = gameReducer(createInitialState(4242), { type: 'START_DAY', day });
    if (mode !== 'standard') state = gameReducer(state, { type: 'SET_MODE', mode });
    state = { ...state, clock, nextSpawnAt: Infinity, feedback: [], departures: [] };
    return place(state, kind, { status, slot });
  }

  function place(state, kind, { status = 'ordered', slot = 0, orderedAt = state.clock } = {}) {
    const slots = [...state.slots];
    slots[slot] = {
      id: 100 + slot, look: FACES[kind], name: 'Lan', order: TEA, status, arrivedAt: state.clock,
      orderedAt: status === 'ordered' ? orderedAt : null, ...patienceFor(state, FACES[kind]),
    };
    return { ...state, slots, selectedSlot: status === 'ordered' ? slot : state.selectedSlot };
  }

  /** Make the customer in `selectedSlot` a cup of `tea` and hand it over. */
  function hand(state, { tea = 'black', amount = 0.6, size = 'M' } = {}) {
    let cup = gameReducer(state, { type: 'PICK_CUP', size });
    cup = gameReducer(cup, { type: 'POUR', category: 'tea', optionId: tea, amount });
    for (const type of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW', 'SERVE']) cup = gameReducer(cup, { type });
    return cup;
  }

  // ------------------------------------------------------------------ a face means one thing
  assert.equal(kindOf(look('cap')), 'shipper', 'A cap is a shipper');
  assert.equal(kindOf(look('balding')), 'elder', 'A bald head is an elder');
  assert.equal(kindOf(look('long', 'glasses')), 'office', 'Glasses are an office worker');
  assert.equal(kindOf(look('bob', 'bow')), 'plain', 'Anyone else is just a customer');
  assert.equal(kindOf(look('cap', 'glasses')), 'shipper', 'First match wins: the cap beats the glasses');
  assert.equal(kindOf(look('balding', 'glasses')), 'elder', 'And so does the bald head');
  const met = new Set(HAIR_STYLES.flatMap((hair) => ACCESSORIES.map((accessory) => kindOf(look(hair, accessory)))));
  assert.deepEqual([...met].sort(), [...KINDS].sort(), 'Every face is one of the four kinds, and every kind has faces');
  for (const kind of KINDS) {
    assert.equal(Boolean(KIND_MARK[kind]), kind !== 'plain', 'Every kind but plain has a mark');
    assert.ok(ARRIVAL_LINES[kind].length > 0, `A ${kind} customer has something to say`);
  }

  // ------------------------------------------------------------------ what a customer will put up with
  for (let day = 1; day <= 40; day++) {
    const config = getDayConfig(day);
    for (const kind of KINDS) {
      const scale = KIND_PATIENCE[kind];
      assert.deepEqual(patienceFor({ config, mode: 'standard' }, FACES[kind]), {
        orderPatienceMs: Math.max(ORDER_PATIENCE_FLOOR_MS, Math.round(config.orderPatienceMs * scale)),
        patienceMs: Math.max(SERVE_PATIENCE_FLOOR_MS, Math.round(config.patienceMs * scale)),
      }, `A ${kind} customer's patience on day ${day}`);
      assert.deepEqual(patienceFor({ config, mode: 'relaxed' }, FACES[kind]),
        { orderPatienceMs: config.orderPatienceMs, patienceMs: config.patienceMs },
        `Nobody in a relaxed shop has less time than anybody else (${kind}, day ${day})`);
    }
  }
  const standard = { config: getDayConfig(3), mode: 'standard' };
  assert.ok(patienceFor(standard, FACES.shipper).patienceMs < patienceFor(standard, FACES.office).patienceMs, 'A shipper is in the most hurry');
  assert.ok(patienceFor(standard, FACES.office).patienceMs < patienceFor(standard, FACES.plain).patienceMs, 'Then an office worker');
  assert.ok(patienceFor(standard, FACES.plain).patienceMs < patienceFor(standard, FACES.elder).patienceMs, 'And an elder is in none');
  // The floors go on after every modifier, which is what the whole of `patienceFor` is for.
  const brutal = { config: { orderPatienceMs: 4_000, patienceMs: 7_000 }, mode: 'standard' };
  assert.deepEqual(patienceFor(brutal, FACES.shipper), { orderPatienceMs: ORDER_PATIENCE_FLOOR_MS, patienceMs: SERVE_PATIENCE_FLOOR_MS },
    'However far the modifiers multiply down, the floors hold');
  const lateShipper = patienceFor({ config: getDayConfig(30), mode: 'standard' }, FACES.shipper);
  assert.equal(lateShipper.orderPatienceMs, Math.max(ORDER_PATIENCE_FLOOR_MS, 10_000), 'A late shipper is held at the floor');
  assert.deepEqual(patienceFor(standard, FACES.shipper, { mode: 'relaxed' }), patienceFor({ ...standard, mode: 'relaxed' }, FACES.shipper),
    'It can be asked about a shop that is about to change how it runs');

  // ------------------------------------------------------------------ what a served cup pays
  const sale = (kind, quality, { neat = true, patience = 0.9, price = 8 } = {}) =>
    payoutFor({ quality, neat, price, patienceLeft: patience, look: FACES[kind] });
  assert.equal(sale('plain', 'perfect', { patience: 1 }).tip, MAX_TIP, 'The fastest perfect cup earns the top tip');
  assert.equal(sale('plain', 'perfect', { patience: 0 }).tip, MIN_TIP, 'And the slowest still earns one');
  for (const patience of [1, 0.6, 0.2, 0]) {
    const base = sale('plain', 'perfect', { patience }).tip;
    assert.equal(sale('shipper', 'perfect', { patience }).tip, base * KIND_TIP.shipper, 'A shipper multiplies the tip');
    assert.equal(sale('elder', 'perfect', { patience }).tip, 0, 'An elder does not tip at all');
    assert.equal(sale('office', 'perfect', { patience }).tip, base + OFFICE_BONUS, 'An office worker adds a bonus');
  }
  for (const kind of KINDS) {
    const perfect = sale(kind, 'perfect');
    assert.equal(perfect.earned, 8 + perfect.tip, 'A perfect cup pays the price and the tip');
    assert.equal(perfect.tone, 'good');
    assert.ok(perfect.text.includes(formatMoney(perfect.earned)), 'And says what it paid');
    const spilled = sale(kind, 'perfect', { neat: false });
    assert.deepEqual([spilled.earned, spilled.tip], [4, 0], `A spilled cup is half price from a ${kind} customer, with nothing on top`);
    const wrong = sale(kind, 'wrong');
    assert.deepEqual([wrong.earned, wrong.tip, wrong.tone], [0, 0, 'bad'], `A wrong cup pays nothing, from a ${kind} customer too`);
    assert.equal(sale(kind, 'close').tip, 0, 'Nearly right earns no tip');
  }
  assert.equal(sale('plain', 'close').earned, 4, 'Nearly right is half price');
  assert.equal(sale('plain', 'close', { price: 9 }).earned, Math.ceil(9 * PARTIAL_PAY), 'Rounded up: there is no half a unit');
  assert.equal(sale('plain', 'perfect', { neat: false, price: 9 }).earned, Math.ceil(9 * PARTIAL_PAY), 'And so is a spill');
  assert.equal(sale('shipper', 'close').earned, 4, 'To a shipper');
  assert.equal(sale('elder', 'close').earned, 4, 'And to an elder');
  assert.equal(sale('office', 'close').earned, 0, 'But nearly right is not what an office worker ordered');
  assert.ok(!sale('office', 'close').text.includes('+'), 'And the counter does not claim otherwise');

  // Spawning and serving take these numbers as they stand.
  for (const seed of [1, 22, 333]) {
    for (const mode of ['standard', 'relaxed']) {
      let state = gameReducer(createInitialState(seed), { type: 'START_DAY', day: 6 });
      state = gameReducer(state, { type: 'SET_MODE', mode });
      let arrivals = 0;
      for (let i = 0; i < 400; i++) {
        state = gameReducer(state, { type: 'TICK', dt: 250 });
        for (const customer of state.slots) {
          if (!customer) continue;
          arrivals += 1;
          const { orderPatienceMs, patienceMs } = customer;
          assert.deepEqual({ orderPatienceMs, patienceMs }, patienceFor(state, customer.look), 'A customer arrives with the patience the rules give them');
        }
        // Sent straight home, so that the whole of the run is arrivals.
        state = { ...state, slots: state.slots.map(() => null) };
      }
      assert.ok(arrivals > 5, 'Enough customers came through to mean something');
    }
  }
  const tipped = hand(counter('shipper'));
  assert.equal(tipped.stats.tips % KIND_TIP.shipper, 0, 'A served shipper tips through the rules');
  assert.equal(hand(counter('elder')).stats.tips, 0, 'A served elder does not');
  assert.equal(hand(counter('elder', { mode: 'relaxed' })).stats.tips, 0, 'Tips stay as they are in a relaxed shop');
  assert.equal(hand(counter('shipper', { mode: 'relaxed' })).stats.tips % KIND_TIP.shipper, 0, 'For the shipper too');
  const late = counter('office');
  const officeSpilled = hand(late, { amount: 1.2 });
  assert.equal(officeSpilled.stats.tips, 0, 'A spill costs the office bonus');
  assert.equal(officeSpilled.stats.perfect, 0, 'And the perfect mark');

  // ------------------------------------------------------------------ a wrong drink is a customer lost
  const wrongCup = hand(counter('plain'), { tea: 'green', size: 'L' });
  assert.deepEqual(wrongCup.stats, { served: 0, perfect: 0, missed: 1, tips: 0 }, 'A wrong drink is not served, and it is held against the shop');
  assert.equal(wrongCup.coins, 0, 'It pays nothing');
  assert.equal(wrongCup.slots[0], null, 'The customer takes it and goes');
  assert.equal(wrongCup.departures[0].outcome, 'wrong', 'Unhappily');
  const closeCup = hand(counter('plain'), { size: 'L' });
  assert.equal(closeCup.departures[0].outcome, 'close', 'A cup of the wrong size is close');
  assert.deepEqual([closeCup.stats.served, closeCup.stats.missed], [1, 0], 'And close is still a drink sold');
  // The doc's own version of this rule stopped counting a wrong drink as served and went no further,
  // which left one good cup and twenty-five bad ones with nothing against them.
  assert.equal(starsFor({ served: 1, perfect: 1, missed: 25 }), 1, 'One right cup and twenty-five wrong ones is not a good day');
  assert.equal(starsFor({ served: 0, perfect: 0, missed: 26 }), 0, 'And all wrong is no day at all');
  assert.equal(starsFor({ served: 25, perfect: 25, missed: 1 }), 3, 'While one slip in a clean day costs nothing');
  // Tuning moves these, so each is read at its own edge rather than through one case that clears them.
  assert.deepEqual([THREE_STAR_HAPPY, THREE_STAR_PERFECT, TWO_STAR_HAPPY], [0.9, 0.6, 0.7], 'The stars have the thresholds below');
  assert.equal(starsFor({ served: 90, perfect: 54, missed: 10 }), 3, 'Three stars are reached exactly at both thresholds');
  assert.equal(starsFor({ served: 90, perfect: 53, missed: 10 }), 2, 'A cup short of perfect share is two');
  assert.equal(starsFor({ served: 89, perfect: 89, missed: 11 }), 2, 'And a customer short of happy share is two');
  assert.equal(starsFor({ served: 70, perfect: 70, missed: 30 }), 2, 'Two stars are reached exactly at theirs');
  assert.equal(starsFor({ served: 69, perfect: 69, missed: 31 }), 1, 'And one customer short is one');

  // Nearly right is a sale from anyone who pays for it, and the counter shows it as one. An office
  // worker who will not pay has not been pleased, whatever the row it lands in.
  const officeClose = hand(counter('office'), { size: 'L' });
  assert.deepEqual([officeClose.departures[0].outcome, officeClose.departures[0].earned], ['close', 0], 'An office worker takes nearly right and pays nothing');
  assert.equal(leftContent(officeClose.departures[0]), false, 'And does not go off looking pleased about it');
  assert.equal(leftContent(closeCup.departures[0]), true, 'Anyone who paid for nearly right does');
  assert.equal(leftContent(hand(counter('plain')).departures[0]), true, 'As does anyone handed what they asked for');
  assert.equal(leftContent(hand(counter('office')).departures[0]), true, 'Office workers included');
  assert.equal(leftContent(wrongCup.departures[0]), false, 'A wrong drink pleases nobody');
  assert.equal(leftContent({ outcome: 'timeout', earned: 0 }), false, 'And nor does no drink');

  // ------------------------------------------------------------------ out of patience
  for (const status of ['requesting', 'ordered']) {
    for (const kind of KINDS) {
      const standing = counter(kind, { status });
      const limit = status === 'requesting' ? standing.slots[0].orderPatienceMs : standing.slots[0].patienceMs;
      const gone = gameReducer(standing, { type: 'TICK', dt: limit });
      assert.equal(gone.slots[0], null, 'They leave');
      assert.equal(gone.departures.at(-1).outcome, 'timeout', 'And are seen to');
      assert.equal(gone.stats.missed, kind === 'shipper' ? 0 : 1, `A ${kind} customer leaving ${kind === 'shipper' ? 'is not' : 'is'} held against the shop`);
      const said = gone.feedback.at(-1);
      assert.ok(said.text.length > 0, 'The counter says so');
      assert.equal(said.text.includes('😤'), kind !== 'shipper', 'Without scolding a shipper for having somewhere to be');
      assert.notEqual(said.tone, kind === 'shipper' ? 'bad' : 'say');
    }
  }
  assert.equal(walkoutFor(FACES.shipper, true).missed, false, 'The rule is one rule, whichever wait ran out');

  // ------------------------------------------------------------------ relaxed, mid-day
  const clock = 40_000;
  const mixed = (() => {
    let state = counter('shipper', { clock, slot: 0 });
    state = place(state, 'elder', { slot: 1, orderedAt: 0 });
    state = place(state, 'office', { slot: 2, status: 'requesting' });
    const slots = [...state.slots];
    slots[0] = { ...slots[0], orderedAt: clock - 10_000 };
    return { ...state, slots };
  })();
  // Everyone at the counter gets the relaxed shop's patience, not only those still to order.
  const calmed = gameReducer(mixed, { type: 'SET_MODE', mode: 'relaxed' });
  const baseline = patienceFor(calmed, FACES.plain);
  for (const customer of calmed.slots) {
    assert.deepEqual({ orderPatienceMs: customer.orderPatienceMs, patienceMs: customer.patienceMs }, baseline, 'No patience difference survives the switch');
    assert.equal(customer.status, 'ordered', 'And every order is taken');
  }
  assert.equal(calmed.slots[0].patienceMs / mixed.slots[0].patienceMs, 1 / KIND_PATIENCE.shipper, 'The half-patience shipper is gone');
  // An elder's wait is the one that gets shorter, so one who has already outwaited the new limit
  // must not be walked out of the shop by the settings card.
  let elderly = counter('elder', { clock: 200_000 });
  elderly = { ...elderly, slots: elderly.slots.map((customer) => customer && { ...customer, orderedAt: 200_000 - customer.patienceMs * 0.9 }) };
  const moved = gameReducer(elderly, { type: 'SET_MODE', mode: 'relaxed' });
  assert.equal(patienceLeft(moved.slots[0], moved.clock), patienceLeft(elderly.slots[0], elderly.clock), 'Their share of patience does not jump');
  assert.ok(gameReducer(moved, { type: 'TICK', dt: 250 }).slots[0], 'And they are still there on the next tick');
  // A shipper's wait grows, which moves his start back, and a shift only just opened has nowhere to
  // move it to. A time before opening is a save the validator refuses, whole.
  let early = counter('shipper', { clock: 9_000 });
  early = { ...early, slots: early.slots.map((customer) => customer && { ...customer, orderedAt: 500 }) };
  const earlyRelaxed = gameReducer(early, { type: 'SET_MODE', mode: 'relaxed' });
  assert.ok(earlyRelaxed.slots[0].orderedAt >= 0, 'The wait never starts before the day does');
  assert.ok(parseGame(serializeGame(earlyRelaxed)), 'So the shop can still be saved');
  const plain = counter('plain', { clock });
  assert.deepEqual(gameReducer(plain, { type: 'SET_MODE', mode: 'relaxed' }).slots[0], plain.slots[0], 'A plain customer has nothing to change');
  // And back again. Patience belongs to the shop as it is run now, or a pause, the settings and
  // straight back would take the pressure off the whole counter for nothing, for good.
  const back = gameReducer(calmed, { type: 'SET_MODE', mode: 'standard' });
  for (const customer of back.slots) {
    assert.deepEqual({ orderPatienceMs: customer.orderPatienceMs, patienceMs: customer.patienceMs }, patienceFor(back, customer.look),
      'Going back to standard gives everyone their own kind\'s patience again');
  }
  assert.equal(Math.round(back.slots[0].orderedAt), mixed.slots[0].orderedAt, 'A round trip leaves a shipper\'s wait where it was');
  assert.equal(Math.round(back.slots[1].orderedAt), mixed.slots[1].orderedAt, 'And an elder\'s');
  let rushed = counter('shipper', { day: 30, clock, status: 'requesting' });
  for (const mode of ['relaxed', 'standard']) rushed = gameReducer(rushed, { type: 'SET_MODE', mode });
  const shipperWait = patienceFor({ config: getDayConfig(30), mode: 'standard' }, FACES.shipper).patienceMs;
  assert.equal(rushed.slots[0].patienceMs, shipperWait, 'The settings do not buy a shipper more time');
  assert.equal(parseGame(serializeGame(rushed)).slots[0].patienceMs, shipperWait, 'Not even past a reload');
  let unhurried = counter('plain', { clock });
  for (const mode of ['relaxed', 'standard']) unhurried = gameReducer(unhurried, { type: 'SET_MODE', mode });
  assert.deepEqual(unhurried.slots[0], plain.slots[0], 'A plain customer has nothing to change that way either');
  // The wait that shrinks on the way back is the shipper's, and the same rule holds him: no walking
  // out on the spot because the player opened the settings.
  let tired = counter('shipper', { clock: 200_000, mode: 'relaxed' });
  tired = { ...tired, slots: tired.slots.map((customer) => customer && { ...customer, orderedAt: 200_000 - customer.patienceMs * 0.9 }) };
  const hurried = gameReducer(tired, { type: 'SET_MODE', mode: 'standard' });
  assert.equal(hurried.slots[0].patienceMs, patienceFor(hurried, FACES.shipper).patienceMs, 'He is back to his own patience');
  assert.equal(patienceLeft(hurried.slots[0], hurried.clock), patienceLeft(tired.slots[0], tired.clock), 'With the same share of it left');
  assert.ok(gameReducer(hurried, { type: 'TICK', dt: 250 }).slots[0], 'And he is still there on the next tick');
  // Nobody may sort this: which ticket comes next is the decision kinds exist to create.
  let queue = counter('elder', { clock });
  queue = { ...queue, clock: clock + 5_000 };
  queue = place(queue, 'shipper', { slot: 1 });
  const unpicked = gameReducer({ ...queue, selectedSlot: null }, { type: 'TICK', dt: 100 });
  assert.equal(unpicked.selectedSlot, 0, 'The ticket that comes up by itself is the oldest, not the most urgent');
  // A change of mode moves `orderedAt` to hold everyone's share of patience. That must not do the
  // sorting by the back door: the shipper's start moves back past the elder's here.
  let ahead = place(counter('plain', { clock }), 'plain', { orderedAt: 5_000 });
  ahead = place(ahead, 'elder', { slot: 1, orderedAt: 10_000 });
  ahead = place(ahead, 'shipper', { slot: 2, orderedAt: 20_000 });
  const elderFirst = { ...ahead, slots: [null, ahead.slots[1], ahead.slots[2]], selectedSlot: null };
  const switched = gameReducer(elderFirst, { type: 'SET_MODE', mode: 'relaxed' });
  assert.ok(switched.slots[2].orderedAt < switched.slots[1].orderedAt, 'The switch does carry the two clocks past each other');
  assert.equal(switched.selectedSlot, 1, 'Going relaxed does not bring the most urgent ticket to the front');
  const roundTrip = gameReducer({ ...switched, selectedSlot: null }, { type: 'SET_MODE', mode: 'standard' });
  assert.equal(roundTrip.selectedSlot, 1, 'And nor does coming back');
  const reloaded = gameReducer(parseGame(serializeGame({ ...switched, selectedSlot: null })), { type: 'SET_PAUSED', paused: false });
  assert.equal(gameReducer(reloaded, { type: 'TICK', dt: 100 }).selectedSlot, 1, 'Nor a reload after it');
  const relaxedQueue = gameReducer({ ...ahead, selectedSlot: 0 }, { type: 'SET_MODE', mode: 'relaxed' });
  assert.equal(hand(relaxedQueue).selectedSlot, 1, 'And the next up after a served cup is still the oldest');

  // ------------------------------------------------------------------ a word as they arrive
  let arriving = gameReducer(createInitialState(99), { type: 'START_DAY', day: 2 });
  let spoken = 0;
  const heard = new Set();
  for (let i = 0; i < 2_000 && heard.size < 2; i++) {
    const before = arriving;
    arriving = gameReducer(arriving, { type: 'TICK', dt: 100 });
    arriving.slots.forEach((customer, slot) => {
      if (!customer || before.slots[slot]?.id === customer.id) return;
      const line = arriving.feedback.find((item) => item.tone === 'say' && item.slot === slot);
      assert.ok(line, 'Everyone says something as they walk up');
      assert.ok(ARRIVAL_LINES[kindOf(customer.look)].includes(line.text), 'In the words of their own kind');
      assert.equal(line.expiresAt, arriving.clock + SAY_MS, 'For longer than a price stays up');
      spoken += 1;
      heard.add(customer.id);
    });
  }
  assert.ok(spoken >= 2, 'More than one customer came and spoke');
  const firstSlot = arriving.slots.findIndex(Boolean);
  const otherSlot = arriving.slots.findIndex((customer, slot) => customer && slot !== firstSlot);
  assert.ok(firstSlot >= 0 && otherSlot >= 0, 'Two are at the counter together');
  const talking = {
    ...arriving,
    feedback: [{ id: 901, slot: firstSlot, text: 'Chào quán!', tone: 'say', expiresAt: arriving.clock + 2_000 },
      { id: 902, slot: otherSlot, text: 'Quán xinh ghê!', tone: 'say', expiresAt: arriving.clock + 2_000 }],
    slots: arriving.slots.map((customer) => customer && { ...customer, status: 'requesting', orderedAt: null }),
  };
  const taken = gameReducer(talking, { type: 'TAKE_ORDER', slot: firstSlot });
  assert.deepEqual(taken.feedback.filter((item) => item.slot === firstSlot).map((item) => item.text), ['Đã nhận order ✓'],
    'Taking the order hushes that customer, rather than stacking two chips in one place');
  assert.equal(taken.feedback.filter((item) => item.slot === otherSlot).length, 1, 'And nobody else');
  const chipped = { ...talking, feedback: [...talking.feedback, { id: 903, slot: firstSlot, text: 'Chậm quá! 😤', tone: 'bad', expiresAt: arriving.clock + 1_000 }] };
  assert.deepEqual(gameReducer(chipped, { type: 'TAKE_ORDER', slot: firstSlot }).feedback.filter((item) => item.slot === firstSlot).map((item) => item.text),
    ['Chậm quá! 😤', 'Đã nhận order ✓'], 'Only a customer\'s own words give way, not what the shop last said at that spot');
  // A relaxed customer arrives with the order taken, so a cup already made can reach them mid-sentence.
  let cupWaiting = gameReducer(gameReducer(createInitialState(11), { type: 'START_DAY', day: 2 }), { type: 'SET_MODE', mode: 'relaxed' });
  cupWaiting = gameReducer(cupWaiting, { type: 'PICK_CUP', size: 'M' });
  cupWaiting = gameReducer(cupWaiting, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.5 });
  for (const type of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW']) cupWaiting = gameReducer(cupWaiting, { type });
  for (let i = 0; i < 2; i++) cupWaiting = gameReducer(cupWaiting, { type: 'TICK', dt: 100 });
  const servedSlot = cupWaiting.selectedSlot;
  assert.equal(cupWaiting.feedback.filter((item) => item.tone === 'say').length, 2, 'Two are still mid-sentence');
  assert.ok(cupWaiting.feedback.some((item) => item.tone === 'say' && item.slot === servedSlot), 'One of them the customer next up');
  const midSentence = gameReducer(cupWaiting, { type: 'SERVE' });
  assert.deepEqual(midSentence.feedback.filter((item) => item.slot === servedSlot).map((item) => item.tone).filter((tone) => tone === 'say'), [],
    'The cup hushes them, rather than leaving their line up beside what it paid');
  assert.equal(midSentence.feedback.filter((item) => item.slot === servedSlot).length, 1, 'One chip at that spot');
  assert.ok(midSentence.feedback.some((item) => item.tone === 'say' && item.slot !== servedSlot), 'And the other customer carries on');
  const quietTick = gameReducer(taken, { type: 'TICK', dt: 100 });
  assert.equal(quietTick.feedback, taken.feedback, 'A tick that changes nothing hands back the same list');
  assert.deepEqual(parseGame(serializeGame(talking)).feedback, [], 'What was said is not saved');
  // Why a walkout has nobody to hush: the shortest wait in the game is far longer than a line stays up.
  assert.ok(SAY_MS < ORDER_PATIENCE_FLOOR_MS, 'A line is over before anyone can run out of patience');
  // Being a chip on the counter must not keep the day open or the counter full.
  let closing = gameReducer(createInitialState(5), { type: 'START_DAY', day: 1 });
  while (closing.phase === 'playing') closing = gameReducer(closing, { type: 'TICK', dt: 1_000 });
  assert.equal(closing.phase, 'dayEnd', 'The day still ends');

  // ------------------------------------------------------------------ the state's dice, and nobody else's
  // Which line is said comes off the state's own RNG, like everything else in a shift: the reducer is
  // pure, and a reloaded shop has to go on to play out the same day it would have.
  const roll = Math.random;
  Math.random = () => { throw new Error('The reducer rolled dice of its own'); };
  const said = new Map(KINDS.map((kind) => [kind, new Set()]));
  try {
    let talkative = gameReducer(gameReducer(createInitialState(31), { type: 'START_DAY', day: 3 }), { type: 'SET_MODE', mode: 'relaxed' });
    for (let i = 0; i < 2_000; i++) {
      talkative = gameReducer(talkative, { type: 'TICK', dt: 10 });
      for (const item of talkative.feedback) {
        if (item.tone === 'say' && item.expiresAt === talkative.clock + SAY_MS) said.get(kindOf(talkative.slots[item.slot].look)).add(item.text);
      }
      // Sent straight home, so that the whole of the run is arrivals.
      talkative = { ...talkative, slots: talkative.slots.map(() => null) };
    }
    for (const kind of KINDS) {
      assert.deepEqual([...said.get(kind)].sort(), [...ARRIVAL_LINES[kind]].sort(), `A ${kind} customer has all their lines, not one of them`);
    }
    let played = gameReducer(createInitialState(2024), { type: 'START_DAY', day: 4 });
    while (played.clock < 20_000 || played.departures.length > 0) played = gameReducer(played, { type: 'TICK', dt: 250 });
    let replayed = gameReducer(parseGame(serializeGame(played)), { type: 'SET_PAUSED', paused: false });
    for (let i = 0; i < 240; i++) {
      played = gameReducer(played, { type: 'TICK', dt: 250 });
      replayed = gameReducer(replayed, { type: 'TICK', dt: 250 });
    }
    assert.ok(played.stats.missed > 0 && played.slots.some(Boolean), 'A minute of the day went by, with people coming and going');
    assert.deepEqual(replayed, played, 'A reloaded shop plays out the same day, down to what was said');
  } finally {
    Math.random = roll;
  }

  // ------------------------------------------------------------------ what the sign has to say
  // Keyed to what the shop has seen, not to the day: the shops that exist are already past day 1.
  const opened = (day, seen = []) => ({ ...gameReducer(createInitialState(1), { type: 'START_DAY', day }), seen });
  assert.deepEqual(dayNews(opened(1)), [], 'Day 1 has the how-to-play to get through');
  assert.deepEqual(dayNews(opened(2)).map((news) => news.id), ['kinds', 'regulars'], 'Day 2 opens with the kinds, and the regulars, who start saying "Như cũ nhé!" that day');
  assert.ok(dayNews(opened(2))[0].line.includes('🛵'), 'In the shop\'s own words');
  assert.deepEqual(dayNews(opened(20)).map((news) => news.id), ['kinds', 'regulars'], 'A shop on day 20 meets them too');
  assert.deepEqual(dayNews(opened(20, ['kinds', 'regulars'])).map((news) => news.id), ['waves', 'overtime'], 'With what else it has missed coming on the next sign');
  assert.deepEqual(dayNews(opened(2, ['kinds', 'waves', 'regulars'])), [], 'And nobody is told twice');
  const ids = (list) => list.map((news) => news.id);
  // Everything above sets `seen` by hand. This is where a real shop starts from.
  const brandNew = createInitialState(1);
  assert.deepEqual(brandNew.seen, [], 'A brand new shop has been told nothing');
  assert.deepEqual(ids(dayNews(gameReducer(brandNew, { type: 'START_DAY', day: 1 }))), [], 'Its first day has the how-to-play instead');
  assert.deepEqual(ids(dayNews(gameReducer(brandNew, { type: 'START_DAY', day: 2 }))), ['kinds', 'regulars'], 'And its second opens with the kinds');
  const nextMorning = gameReducer(closing, { type: 'GO_TO_TITLE' });
  assert.deepEqual([nextMorning.day, ids(dayNews(nextMorning))], [2, ['kinds', 'regulars']], 'However the second day is reached');
  // The week a new shop actually has. Overtime is told on the day it first opens, not a day or more after.
  const thirdMorning = gameReducer(gameReducer(nextMorning, { type: 'NOTE_NEWS', ids: ['kinds', 'regulars'] }), { type: 'START_DAY', day: 3 });
  assert.deepEqual(ids(dayNews(thirdMorning)), ['waves', 'overtime'], 'Its third day has the rest');
  const newsDay = opened(4);
  const read = gameReducer(newsDay, { type: 'NOTE_NEWS', ids: ['kinds'] });
  assert.deepEqual(read.seen, ['kinds'], 'Reading the sign marks it');
  assert.equal(gameReducer(read, { type: 'NOTE_NEWS', ids: ['kinds'] }), read, 'Reading it twice changes nothing');
  assert.equal(gameReducer(newsDay, { type: 'NOTE_NEWS', ids: [] }), newsDay, 'And nor does a sign with no news');
  for (const [name, next] of [
    ['the next day', gameReducer(read, { type: 'START_DAY', day: 5 })],
    ['the menu', gameReducer(read, { type: 'GO_TO_TITLE' })],
    ['a day opened from the menu', gameReducer(gameReducer(read, { type: 'GO_TO_TITLE' }), { type: 'START_DAY', day: 5 })],
    ['a reload', parseGame(serializeGame(read))],
  ]) {
    assert.deepEqual(next.seen, ['kinds'], `What has been read survives ${name}`);
  }

  console.log('check-rules: patience and its floors, kinds, what a cup pays, wrong drinks, relaxed mid-day, arrival lines and the opening sign\'s news.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
