/* Run with node tools/check-waves.cjs. Uses the project's TypeScript compiler for pure game code. */
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
  const { canExtend, createInitialState, gameReducer, NO_OVERTIME } = require(path.join(__dirname, '../src/game/reducer.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { ARRIVAL_LINES, generateLookOf, kindOf } = require(path.join(__dirname, '../src/game/customers.ts'));
  const { BOARD_SLOT, GEAR_IDS, gearItem } = require(path.join(__dirname, '../src/game/gear.ts'));
  const { describeUnlocks, getDayConfig } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { createRng } = require(path.join(__dirname, '../src/game/random.ts'));
  const {
    BENCH_LINE_PATIENCE, closesAt, dayNews, FIRST_WAVE, LINE_MS, lineWaitMs, LULL_MAX_MS, LULL_MIN_MS, lullGroup, lullPreview, MAX_NEWS, MAX_WAVE,
    OVERTIME_FROM_DAY, OVERTIME_MAX_ROUNDS, OVERTIME_ROUND_MS, patienceFor, SAY_MS, WAVE_GAP_MAX_MS, WAVE_GAP_MIN_MS,
  } = require(path.join(__dirname, '../src/game/rules.ts'));

  const look = (hairStyle, accessory = 'none') => ({ skin: '#FFDCC2', hair: '#2B1B17', hairStyle, shirt: '#7EC8E3', accessory });
  const FACES = { plain: look('bun'), shipper: look('cap'), elder: look('balding'), office: look('short', 'glasses') };
  const TEA = { size: 'M', toppings: [], sweetness: null, ice: null, tea: 'black', milk: null, foam: null };

  const tick = (state, dt = 100) => gameReducer(state, { type: 'TICK', dt });
  const press = (state) => gameReducer(state, { type: 'EXTEND_SHIFT' });
  const opened = (day = 5, seed = 4242) => gameReducer(createInitialState(seed), { type: 'START_DAY', day });
  const run = (state, ms, dt = 100) => {
    let next = state;
    for (let t = 0; t < ms && next.phase === 'playing'; t += dt) next = tick(next, dt);
    return next;
  };
  /** Tick until `done` says so, for things that happen on a roll of the state's dice. */
  const until = (state, done, limit = 600_000) => {
    let next = state;
    for (let t = 0; t < limit && !done(next); t += 100) next = tick(next);
    assert.ok(done(next), 'It came to pass');
    return next;
  };
  const person = (id, kind = 'plain', { arrivedAt = 0, ...rest } = {}) => ({
    id, look: FACES[kind], name: 'Lan', order: TEA, status: 'requesting', arrivedAt, orderedAt: null, orderPatienceMs: 25_000, patienceMs: 80_000, ...rest,
  });
  /** A shift at `clock` with a full counter that will not leave, so that only the line moves. */
  const fullHouse = (day = 5, clock = 30_000, extra = {}) => {
    const state = opened(day);
    return {
      ...state, clock, nextSpawnAt: clock,
      slots: state.slots.map((_, slot) => person(900 + slot, 'plain', { arrivedAt: clock, orderPatienceMs: 1e7, patienceMs: 1e7 })),
      ...extra,
    };
  };
  const hand = (state, slot) => {
    let cup = gameReducer(state, { type: 'TAKE_ORDER', slot });
    cup = gameReducer({ ...cup, selectedSlot: slot }, { type: 'PICK_CUP', size: 'M' });
    cup = gameReducer(cup, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.6 });
    for (const type of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW', 'SERVE']) cup = gameReducer(cup, { type });
    return cup;
  };
  /** The counter emptied, and it is not the opening of the day: someone has already been through the door. */
  const nobody = (state) => ({ ...state, slots: state.slots.map(() => null), nextId: Math.max(state.nextId, 50) });

  // ------------------------------------------------------------------ what a day asks for
  assert.equal(getDayConfig(1).waveSize, FIRST_WAVE, 'A shop opens on a small group');
  for (let day = 1; day <= 200; day++) {
    const config = getDayConfig(day);
    assert.ok(config.waveSize >= FIRST_WAVE && config.waveSize <= MAX_WAVE, `Day ${day}'s group is within its limits`);
    if (day > 1) assert.ok(config.waveSize >= getDayConfig(day - 1).waveSize, 'And never shrinks');
    assert.ok(config.lullMinMs > 0 && config.lullMinMs <= config.lullMaxMs, 'A quiet has a length');
    assert.equal(config.lineMs, LINE_MS, 'And so does the wait outside');
    assert.equal(config.spawnMinMs, undefined, 'Nothing is left of the old trickle');
  }
  assert.ok(getDayConfig(13).waveSize > getDayConfig(12).waveSize || getDayConfig(30).waveSize > getDayConfig(12).waveSize, 'The group goes on growing past day 12, where every other dial stops');
  assert.equal(getDayConfig(200).waveSize, MAX_WAVE, 'Up to its limit');
  assert.notDeepEqual({ ...getDayConfig(12), day: 0 }, { ...getDayConfig(30), day: 0 }, 'So day 12 and day 30 are no longer the same day');
  assert.deepEqual(describeUnlocks(3), [], 'The group is not announced as an unlock: the day is a dial, not a menu');

  // ------------------------------------------------------------------ the door
  // The shop opening is not a quiet: nothing has gone quiet, and nobody has been told who is coming.
  const first = until(opened(5), (state) => state.slots.some(Boolean));
  assert.ok(first.clock < 2_000, 'The first group of the day comes in soon after opening');
  assert.equal(first.waveLeft, getDayConfig(5).waveSize - 1, 'One of them through the door');
  assert.deepEqual([first.lullUntil, first.incoming], [0, []], 'With no quiet before them and nothing to preview');
  assert.deepEqual(lullGroup(tick(opened(5))), [], 'Not for a moment');
  // A cup binned before the doors open is not someone having been through them.
  const binned = gameReducer(gameReducer(opened(5), { type: 'PICK_CUP', size: 'M' }), { type: 'CLEAR_CUP' });
  const openedAfterBin = until(binned, (state) => state.waveLeft > 0);
  assert.deepEqual([openedAfterBin.lullUntil, openedAfterBin.incoming], [0, []], 'The opening is still the opening with a cup in the bin');
  const binnedAgain = gameReducer(gameReducer(binned, { type: 'PICK_CUP', size: 'L' }), { type: 'CLEAR_CUP' });
  assert.ok(binnedAgain.discarded.id > binned.discarded.id, 'And every cup binned still gets a toss of its own');

  // One by one, a beat apart.
  const times = [];
  let arriving = opened(1);
  const known = new Set();
  for (let t = 0; t < 30_000 && times.length < getDayConfig(1).waveSize; t += 50) {
    arriving = tick(arriving, 50);
    for (const customer of [...arriving.slots, ...arriving.line]) {
      if (customer && !known.has(customer.id)) {
        known.add(customer.id);
        times.push(arriving.clock);
      }
    }
  }
  assert.equal(times.length, FIRST_WAVE, 'A whole group came in');
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    assert.ok(gap >= WAVE_GAP_MIN_MS && gap <= WAVE_GAP_MAX_MS + 50, `Staggered, not together (${gap} ms)`);
  }

  // ------------------------------------------------------------------ the line
  // Day 1 has two spots and a group of three: the third has nowhere to stand.
  assert.ok(FIRST_WAVE > getDayConfig(1).slots, 'The first day is where a player first meets the line');
  assert.equal(arriving.line.length, 1, 'Whoever has no spot joins the line');
  assert.equal(arriving.slots.filter(Boolean).length, 2, 'And the counter holds what it holds');
  assert.ok(arriving.feedback.every((item) => item.expiresAt < arriving.clock + SAY_MS), 'They say nothing as they join it: there is nowhere over their head to say it');

  // First come, first up, into any free spot, the moment one is free.
  const queued = fullHouse(5, 30_000, { line: [person(1, 'plain', { arrivedAt: 20_000 }), person(2, 'elder', { arrivedAt: 25_000 })] });
  const stillFull = tick(queued);
  assert.equal(stillFull.line, queued.line, 'A tick that moves nobody hands back the same line, so nothing redraws');
  assert.equal(stillFull.slots, queued.slots, 'And the same counter');
  assert.equal(stillFull.feedback, queued.feedback, 'And the same feedback');
  assert.equal(stillFull.departures, queued.departures, 'And the same departures');
  const spotFree = { ...queued, slots: queued.slots.map((customer, slot) => (slot === 1 ? null : customer)) };
  const steppedUp = tick(spotFree);
  assert.equal(steppedUp.slots[1].id, 1, 'The one who has waited longest takes it');
  assert.deepEqual(steppedUp.line.map((customer) => customer.id), [2], 'And the other moves up the line');
  assert.equal(steppedUp.slots[1].arrivedAt, steppedUp.clock, 'Their order-taking clock starts when they reach the counter');
  assert.equal(steppedUp.slots[1].status, 'requesting', 'And they wait to be asked like anyone else');
  assert.deepEqual(
    { orderPatienceMs: steppedUp.slots[1].orderPatienceMs, patienceMs: steppedUp.slots[1].patienceMs },
    patienceFor(steppedUp, FACES.plain), 'With a whole day\'s patience, not what was left of the wait outside');
  const hello = steppedUp.feedback.find((item) => item.slot === 1 && item.tone === 'say');
  assert.ok(ARRIVAL_LINES.plain.includes(hello.text), 'And they say hello as they get there');
  assert.equal(hello.expiresAt, steppedUp.clock + SAY_MS, 'For as long as anyone does');
  const leavingSpot = { ...spotFree, departures: [{ id: 50, customer: person(50), slot: 1, outcome: 'perfect', earned: 8, drink: TEA, at: spotFree.clock }] };
  assert.equal(tick(leavingSpot).slots[1], null, 'A spot someone is still walking away from is not free yet');
  assert.equal(tick(leavingSpot).line.length, 2, 'So the line waits for it');
  const allAtOnce = tick(nobody(queued));
  assert.equal(allAtOnce.line.length, 0, 'Everyone outside comes in at once if there is room');
  assert.equal(allAtOnce.slots.filter(Boolean).length, 2, 'Into any spot that is free');

  // Giving up is quiet: no star, no scolding, no sound, no jar.
  const wait = lineWaitMs(queued);
  assert.equal(wait, getDayConfig(5).lineMs, 'Nothing has bought them more time');
  const outside = (state, arrivedAt) => ({ ...state, line: [person(7, 'plain', { arrivedAt })] });
  const justBefore = tick(outside(queued, queued.clock + 100 - wait + 1));
  assert.equal(justBefore.line.length, 1, 'A moment short of the limit, they are still there');
  const gaveUp = tick(outside(queued, queued.clock + 100 - wait));
  assert.equal(gaveUp.line.length, 0, 'At the limit, they go');
  assert.equal(gaveUp.lost, 1, 'And are counted');
  assert.deepEqual(gaveUp.stats, queued.stats, 'But not against the shop: they never reached the counter');
  assert.deepEqual(gaveUp.feedback, [], 'Nothing is said');
  assert.deepEqual(gaveUp.departures, [], 'Nobody walks off, so nothing plays');
  const jarGoing = { ...queued, overtime: { ...NO_OVERTIME, rounds: 1, jar: 41 } };
  const jarSafe = tick(outside(jarGoing, jarGoing.clock + 100 - wait));
  assert.equal(jarSafe.lost, 1, 'Someone gives up in the line of a running jar');
  assert.deepEqual(jarSafe.overtime, jarGoing.overtime, 'And it does not burn: only a walkout from the counter does');
  for (const kind of ['shipper', 'elder', 'office']) {
    const kindGone = tick({ ...queued, line: [person(8, kind, { arrivedAt: queued.clock + 100 - wait })] });
    assert.equal(kindGone.lost, 1, `A ${kind} waits outside as long as anyone: kinds are for the counter`);
  }

  // The bench. Read where it is used, so it is not in the config, and a save needs nothing new.
  const benched = { ...queued, gear: ['bench'] };
  assert.equal(lineWaitMs(benched), wait * BENCH_LINE_PATIENCE, 'The bench lets them wait longer');
  assert.equal(benched.config.lineMs, queued.config.lineMs, 'Without touching the day\'s config');
  assert.equal(tick(outside(benched, benched.clock + 100 - wait)).line.length, 1, 'Someone who would have gone stays');
  assert.equal(tick(outside(benched, benched.clock + 100 - wait * BENCH_LINE_PATIENCE)).line.length, 0, 'Until the longer wait runs out');
  assert.ok(GEAR_IDS.includes('bench') && gearItem('bench').price === 800, 'It is on sale');
  const closed = { ...run(nobody({ ...opened(2), clock: 239_900, nextSpawnAt: Number.MAX_SAFE_INTEGER }), 1_000), money: 800 };
  assert.equal(closed.phase, 'dayEnd', 'At the end of a day');
  const bought = gameReducer(closed, { type: 'BUY_GEAR', id: 'bench' });
  assert.deepEqual([bought.gear, bought.money], [['bench'], 0], 'And can be bought');
  assert.equal(lineWaitMs(gameReducer(bought, { type: 'START_DAY', day: 3 })), getDayConfig(3).lineMs * BENCH_LINE_PATIENCE, 'And it stays bought');

  // The order board is a spot and not a door: it works on whoever reaches that spot.
  const boardFree = { ...queued, gear: ['board'], slots: queued.slots.map((customer, slot) => (slot === BOARD_SLOT ? null : customer)) };
  const atBoard = tick(boardFree).slots[BOARD_SLOT];
  assert.equal(atBoard.status, 'ordered', 'Someone stepping up to the board has ordered');
  assert.equal(atBoard.orderedAt, atBoard.arrivedAt, 'And their serve timer starts there');

  // ------------------------------------------------------------------ the next group
  // Nobody comes until the counter and the line are both clear. That is the rule the whole mechanic
  // rests on: a slower player gets fewer groups rather than more pressure.
  const busy = (over) => ({ ...fullHouse(5, 30_000, over), nextSpawnAt: 0 });
  const held = run(busy(), 20_000);
  assert.deepEqual([held.waveLeft, held.lullUntil], [0, 0], 'A full counter holds the next group back');
  const stillLined = run({ ...nobody(busy()), line: [person(1, 'elder', { arrivedAt: 30_000 })], slots: [null, null, person(5, 'plain', { arrivedAt: 30_000, orderPatienceMs: 1e7 })] }, 200);
  assert.equal(stillLined.waveLeft, 0, 'So does anyone at the counter at all');
  const lineOnly = run({ ...fullHouse(5, 30_000), slots: [person(5, 'plain', { arrivedAt: 30_000, orderPatienceMs: 1e7 }), person(6, 'plain', { arrivedAt: 30_000, orderPatienceMs: 1e7 }), person(7, 'plain', { arrivedAt: 30_000, orderPatienceMs: 1e7 })], line: [person(1, 'plain', { arrivedAt: 30_000 })] }, 1_000);
  assert.equal(lineOnly.waveLeft, 0, 'And so does a line');
  // The line on its own: every spot being walked away from, so that it is still outside and the counter is empty.
  const allLeaving = nobody(busy({ line: [person(1, 'plain', { arrivedAt: 30_000 })] }));
  const heldByLine = tick({ ...allLeaving, departures: allLeaving.slots.map((_, slot) => ({ id: 60 + slot, customer: person(60 + slot), slot, outcome: 'perfect', earned: 8, drink: TEA, at: allLeaving.clock })) });
  assert.deepEqual([heldByLine.slots.filter(Boolean).length, heldByLine.line.length], [0, 1], 'Nobody at the counter, and someone outside');
  assert.deepEqual([heldByLine.waveLeft, heldByLine.lullUntil, heldByLine.incoming], [0, 0, []], 'Which holds the next group back by itself');
  const midGroup = run({ ...nobody(busy()), waveLeft: 2, nextSpawnAt: 90_000 }, 200);
  assert.deepEqual([midGroup.waveLeft, midGroup.incoming], [2, []], 'And a group still coming in is the current group, not a reason for another');

  const cleared = (seed = 7, day = 5) => ({ ...nobody(opened(day, seed)), clock: 60_000, nextSpawnAt: 60_000 });
  const quiet = tick(cleared());
  const size = quiet.config.waveSize;
  assert.equal(quiet.waveLeft, size, 'Once it is all clear the next group is rolled at that moment');
  assert.equal(quiet.incoming.length, size, 'And announced, every one of them');
  assert.ok(quiet.lullUntil >= quiet.clock + LULL_MIN_MS && quiet.lullUntil <= quiet.clock + LULL_MAX_MS, 'A short quiet comes first');
  assert.equal(lullGroup(quiet), quiet.incoming, 'Which is what the pill reads');
  const lullLengths = new Set(Array.from({ length: 200 }, (_, seed) => tick(cleared(seed)).lullUntil - 60_100));
  assert.ok(lullLengths.size > 3, 'The quiet is not always the same length');
  const halfway = run(quiet, 3_000);
  assert.equal(halfway.slots.filter(Boolean).length, 0, 'Nobody comes through the door during it');
  assert.equal(halfway.incoming, quiet.incoming, 'And the list does not move, so the pill is a stable slice');
  assert.equal(lullGroup(halfway), lullGroup(quiet), 'Tick after tick');
  const lullEnd = until(quiet, (state) => state.slots.some(Boolean));
  assert.ok(lullEnd.clock >= quiet.lullUntil, 'They come when it has passed');
  assert.deepEqual(lullGroup(lullEnd), [], 'And the pill goes');
  assert.equal(lullGroup({ clock: 10, lullUntil: 5, incoming: ['plain'] }), lullGroup({ clock: 10, lullUntil: 0, incoming: [] }), 'To the same empty list, so that it stays gone');

  // The preview is a promise, kept in the order it was made.
  for (let seed = 1; seed <= 40; seed++) {
    let state = tick(cleared(seed));
    const promised = [...state.incoming];
    const came = [];
    const met = new Set();
    for (let t = 0; t < 40_000 && came.length < promised.length; t += 100) {
      state = tick(state);
      for (const customer of [...state.slots, ...state.line]) {
        if (customer && !met.has(customer.id)) {
          met.add(customer.id);
          came.push(kindOf(customer.look));
        }
      }
    }
    assert.deepEqual(came, promised, `Who was announced is who comes (seed ${seed})`);
    assert.equal(state.incoming.length, 0, 'And the list runs out as they do');
  }
  assert.equal(lullPreview(['plain', 'shipper', 'elder']), 'Sắp có 3 khách · 🛵 1 · 🧓 1', 'The pill says how many and of what kind');
  assert.equal(lullPreview(['office', 'office', 'plain', 'shipper']), 'Sắp có 4 khách · 🛵 1 · 💼 2', 'A kind\'s number, in the same order every time');
  assert.equal(lullPreview(['plain', 'plain']), 'Sắp có 2 khách', 'Plain customers have no mark to count');
  // Looks are rolled by the same dice until they fit, and the fallback is what ends the loop.
  const rng = createRng(11);
  for (const kind of Object.keys(FACES)) {
    for (let i = 0; i < 200; i++) assert.equal(kindOf(generateLookOf(rng, kind)), kind, `A ${kind} looks like one`);
    const stuck = { next: () => 0.99, int: (min) => min, pick: (items) => items[items.length - 1] };
    assert.equal(kindOf(generateLookOf(stuck, kind)), kind, `Even from dice that will not cooperate (${kind})`);
  }

  // ------------------------------------------------------------------ closing
  const CLOSE = getDayConfig(5).durationMs;
  // A group behind a quiet at closing time has not begun, so it stays away.
  const lateQuiet = tick({ ...nobody(opened(5)), clock: CLOSE - 3_000, nextSpawnAt: CLOSE - 3_000 });
  assert.equal(lateQuiet.waveLeft, getDayConfig(5).waveSize, 'A group is rolled just before closing');
  const notBegun = until(lateQuiet, (state) => state.phase === 'dayEnd');
  assert.deepEqual([notBegun.waveLeft, notBegun.incoming], [0, []], 'Closing cancels it');
  assert.equal(notBegun.stats.served + notBegun.stats.missed, 0, 'And nobody came');
  assert.deepEqual(lullGroup(notBegun), [], 'So the pill does not outlive it');
  // No group starts once closing has come.
  const tooLate = tick({ ...nobody(opened(5)), clock: CLOSE, nextSpawnAt: 0 });
  assert.equal(tooLate.phase, 'dayEnd', 'A clear counter at closing ends the day');
  assert.equal(tooLate.waveLeft, 0, 'With no group rolled');
  // A tick is about 150 ms, so one can step over closing and the end of a quiet together. That quiet
  // was still running when the tick began, so the group behind it had not begun either.
  const lastQuiet = { ...nobody(opened(5)), clock: CLOSE - 20, nextSpawnAt: 0, lullUntil: CLOSE + 83, waveLeft: 3, incoming: ['plain', 'plain', 'plain'] };
  const steppedOver = tick(lastQuiet, 150);
  assert.ok(steppedOver.clock > lastQuiet.lullUntil, 'The tick ends past both');
  assert.deepEqual([steppedOver.phase, steppedOver.waveLeft, steppedOver.incoming, steppedOver.slots.filter(Boolean).length], ['dayEnd', 0, [], 0], 'Closing cancels that group too, and the day ends on time');
  const quietOver = tick({ ...lastQuiet, lullUntil: CLOSE - 30 }, 150);
  assert.deepEqual([quietOver.phase, quietOver.waveLeft, quietOver.slots.filter(Boolean).length], ['playing', 2, 1], 'While one whose quiet was already over has begun, and comes in');
  // One already coming in finishes coming in, and the day waits for them.
  const coming = { ...nobody(opened(5)), clock: CLOSE - 200, nextSpawnAt: CLOSE - 200, waveLeft: 2 };
  const pastClose = run(coming, 400);
  assert.ok(pastClose.clock >= CLOSE, 'Closing time comes');
  assert.equal(pastClose.phase, 'playing', 'And the day is not over with someone still coming in');
  assert.ok(pastClose.waveLeft > 0, 'Not cancelled, because they had begun');
  const drained = until(coming, (state) => state.waveLeft === 0);
  assert.equal(drained.phase, 'playing', 'They all arrive');
  const oneToCome = tick({ ...nobody(opened(5)), clock: CLOSE + 100, nextSpawnAt: CLOSE + 1_000, waveLeft: 1 });
  assert.deepEqual([oneToCome.phase, oneToCome.waveLeft], ['playing', 1], 'An empty shop is not a finished day with someone still on their way in');
  // The line holds the day open too, until it reaches the counter or gives up.
  const stragglers = { ...nobody(opened(5)), clock: CLOSE + 100, nextSpawnAt: Number.MAX_SAFE_INTEGER, slots: [person(1, 'plain', { arrivedAt: CLOSE, orderPatienceMs: 1e7 }), person(2, 'plain', { arrivedAt: CLOSE, orderPatienceMs: 1e7 }), person(3, 'plain', { arrivedAt: CLOSE, orderPatienceMs: 1e7 })], line: [person(4, 'plain', { arrivedAt: CLOSE })] };
  assert.equal(tick(stragglers).phase, 'playing', 'A line keeps the day open');
  const lineGone = run(stragglers, wait + 1_000);
  assert.deepEqual([lineGone.line.length, lineGone.lost], [0, 1], 'Until it gives up');
  assert.equal(run({ ...stragglers, slots: stragglers.slots.map(() => null), line: [] }, 200).phase, 'dayEnd', 'With nobody left the day ends');
  // A day nobody serves has to end as well, however many are outside.
  for (const day of [1, 5, 30]) {
    const unattended = until(opened(day), (state) => state.phase === 'dayEnd', 1_000_000);
    assert.ok(unattended.stats.missed > 0, `Nobody served on day ${day}, and it shows`);
    assert.deepEqual([unattended.line.length, unattended.waveLeft], [0, 0], 'And nothing is left over');
    const saved = parseGame(serializeGame(unattended));
    assert.equal(saved.lost, unattended.lost, 'The count of those who gave up comes back with the day-end screen');
    const next = gameReducer(saved, { type: 'START_DAY', day: day + 1 });
    assert.deepEqual([next.lost, next.waveLeft, next.lullUntil, next.line, next.incoming], [0, 0, 0, [], []], 'And none of it carries to the next day');
  }
  // Nobody above gave up outside: unattended, the counter's patience runs out before the line's. So here someone does.
  assert.equal(parseGame(serializeGame(lineGone)).lost, 1, 'Someone who gave up is still counted after a reload mid-shift');
  const closedOut = run({ ...lineGone, slots: lineGone.slots.map(() => null) }, 200);
  assert.deepEqual([closedOut.phase, closedOut.lost], ['dayEnd', 1], 'And at the end of the day');
  const closedSaved = parseGame(serializeGame(closedOut));
  assert.equal(closedSaved.lost, 1, 'Which is what the day-end screen reads after a reload');
  assert.equal(gameReducer(closedSaved, { type: 'START_DAY', day: 6 }).lost, 0, 'The next day starts from nobody');
  assert.equal(gameReducer(gameReducer(closedOut, { type: 'GO_TO_TITLE' }), { type: 'START_DAY', day: 6 }).lost, 0, 'By way of the menu as well');

  // ------------------------------------------------------------------ a press
  const DAY = OVERTIME_FROM_DAY + 2;
  const WINDOW = getDayConfig(DAY).durationMs - 5_000;
  const windowOpen = { ...nobody(opened(DAY)), clock: WINDOW, nextSpawnAt: Number.MAX_SAFE_INTEGER, slots: [person(1, 'plain', { arrivedAt: WINDOW, orderPatienceMs: 1e7 }), null, null] };
  const pressedNow = press(windowOpen);
  const GROUP = getDayConfig(DAY).waveSize;
  assert.equal(pressedNow.waveLeft, GROUP, 'A press brings one more group');
  assert.equal(pressedNow.nextSpawnAt, windowOpen.clock, 'At once');
  assert.ok(tick(pressedNow).slots.filter(Boolean).length === 2, 'Starting on the next tick');
  const secondRound = press({ ...pressedNow, clock: closesAt(pressedNow) - 1_000, nextSpawnAt: Number.MAX_SAFE_INTEGER });
  assert.equal(secondRound.waveLeft, GROUP * 2, 'A press on top of a group still coming in adds a group of its own');

  // Cancelling a quiet: the group behind it is the group that comes, not one more on top.
  const waitingQuiet = { ...tick({ ...nobody(opened(DAY)), clock: WINDOW, nextSpawnAt: WINDOW }) };
  assert.ok(waitingQuiet.clock < waitingQuiet.lullUntil, 'A quiet is running');
  assert.ok(canExtend(waitingQuiet), 'And the pill is on offer during it');
  const noMoreQuiet = press(waitingQuiet);
  assert.equal(noMoreQuiet.waveLeft, waitingQuiet.waveLeft, 'One group, the one already announced');
  assert.deepEqual(lullGroup(noMoreQuiet), [], 'The quiet is over');
  assert.equal(noMoreQuiet.incoming, waitingQuiet.incoming, 'They are still who was announced');
  assert.ok(tick(noMoreQuiet).slots.some(Boolean), 'And they come at once');
  assert.equal(kindOf(tick(noMoreQuiet).slots.find(Boolean).look), waitingQuiet.incoming[0], 'In the order they were promised');
  assert.equal(tick(noMoreQuiet).slots.find(Boolean).lateRound, 1, 'As late customers, because they came in after the press');

  // No other wave starts once a press has been made: the counter clearing means the night is done.
  const lastOfThem = { ...pressedNow, waveLeft: 0, clock: closesAt(pressedNow) - 25_000, nextSpawnAt: 0, slots: pressedNow.slots.map(() => null) };
  assert.ok(lastOfThem.clock < closesAt(lastOfThem), 'The round is still open');
  const nobodyNew = run(lastOfThem, 2_000);
  assert.deepEqual([nobodyNew.waveLeft, nobodyNew.slots.filter(Boolean).length], [0, 0], 'A clear counter brings nobody new');
  const closedRound = until(lastOfThem, (state) => state.phase === 'dayEnd');
  assert.ok(closedRound.clock >= closesAt(lastOfThem), 'And the day ends when the round does');
  assert.equal(closedRound.clock - lastOfThem.clock <= OVERTIME_ROUND_MS, true, 'Not later');
  // Above, the day proper is over and no group could start anyway. The rule is for the seconds before that.
  const pressedEarly = { ...pressedNow, waveLeft: 0, clock: pressedNow.config.durationMs - 3_000, nextSpawnAt: 0, slots: pressedNow.slots.map(() => null) };
  const noneBeforeClosing = tick(pressedEarly);
  assert.ok(noneBeforeClosing.clock < noneBeforeClosing.config.durationMs, 'The day proper is still running');
  assert.deepEqual([noneBeforeClosing.waveLeft, noneBeforeClosing.lullUntil, noneBeforeClosing.incoming], [0, 0, []], 'And still no group starts after a press');

  // Line members from before the press are the day's; those after it are the night's.
  const beforePress = { ...fullHouse(DAY, WINDOW), nextSpawnAt: Number.MAX_SAFE_INTEGER, line: [person(1, 'plain', { arrivedAt: WINDOW - 1_000 })] };
  const afterPress = run({ ...press(beforePress), nextSpawnAt: 0 }, 300);
  assert.equal(afterPress.line[0].lateRound, undefined, 'Someone outside before the press is a customer of the day');
  assert.ok(afterPress.line.length > 1, 'Someone joins the line after the press');
  assert.equal(afterPress.line.at(-1).lateRound, 1, 'As a late customer of that round');
  const lateOutside = { ...afterPress, line: [afterPress.line.at(-1)], slots: afterPress.slots.map((customer, slot) => (slot === 2 ? null : customer)) };
  const lateUp = tick(lateOutside).slots[2];
  assert.equal(lateUp.lateRound, 1, 'And still is when they reach the counter, of the round they came in on');
  assert.equal(lateUp.patienceMs, patienceFor(lateOutside, lateUp.look, { rounds: 1 }).patienceMs, 'With a late customer\'s patience');
  const dayUp = tick({ ...afterPress, line: [afterPress.line[0]], slots: afterPress.slots.map((customer, slot) => (slot === 2 ? null : customer)) }).slots[2];
  assert.equal(dayUp.patienceMs, patienceFor(afterPress, dayUp.look).patienceMs, 'While someone from before it keeps the day\'s');
  const servedLate = hand(tick(lateOutside), 2);
  assert.equal(servedLate.stats.served, lateOutside.stats.served, 'And a late customer from the line is nothing to the stats');

  // ------------------------------------------------------------------ relaxed
  // Today's path, unchanged: nobody outside, no groups, no quiet, a customer at every spot.
  let calm = gameReducer(opened(5), { type: 'SET_MODE', mode: 'relaxed' });
  calm = run(calm, 2_000);
  assert.equal(calm.slots.filter(Boolean).length, calm.slots.length, 'A relaxed shop fills every spot straight away');
  assert.ok(calm.slots.every((customer) => customer.status === 'ordered'), 'With every order taken');
  assert.deepEqual([calm.waveLeft, calm.line.length, calm.lullUntil, calm.incoming.length], [0, 0, 0, 0], 'And none of the machinery of a rush');
  const refilled = run(nobody(calm), 300);
  assert.equal(refilled.slots.filter(Boolean).length, refilled.slots.length, 'One a tick, however fast they are served');
  assert.equal(refilled.waveLeft, 0, 'Nobody is rolled up behind them');
  assert.equal(dayNews({ day: 2, mode: 'relaxed', seen: [] }).some((news) => news.id === 'waves'), false, 'And it is not told about groups it will never see');

  // Going relaxed in the middle of a rush.
  const rush = { ...fullHouse(5, 40_000), waveLeft: 2, incoming: ['shipper'], lullUntil: 50_000, line: [person(1, 'shipper', { arrivedAt: 39_000 }), person(2, 'elder', { arrivedAt: 39_500 })] };
  const relaxedRush = gameReducer(rush, { type: 'SET_MODE', mode: 'relaxed' });
  assert.deepEqual([relaxedRush.waveLeft, relaxedRush.incoming, relaxedRush.lullUntil], [0, [], 0], 'The group still to come is called off');
  assert.equal(relaxedRush.line.length, 2, 'Those already outside are still outside');
  const relaxedSpot = tick({ ...relaxedRush, slots: relaxedRush.slots.map((customer, slot) => (slot === 0 ? null : customer)) });
  assert.equal(relaxedSpot.slots[0].id, 1, 'They step up as spots free, oldest first');
  assert.equal(relaxedSpot.slots[0].status, 'ordered', 'With their order taken as they get there');
  assert.equal(relaxedSpot.slots[0].orderedAt, relaxedSpot.clock, 'And the serve clock started');
  assert.equal(relaxedSpot.slots[0].patienceMs, patienceFor(relaxedSpot, FACES.plain).patienceMs, 'On the relaxed shop\'s patience: no half-patience shipper leaks in from outside');
  assert.equal(relaxedSpot.line.length, 1, 'And the next is still waiting');
  assert.ok(relaxedSpot.slots.every(Boolean) && relaxedSpot.line.length === 1, 'A new arrival does not jump the queue');
  // The one line a relaxed shop can have is one it inherited, and it can still give up: only here can
  // a relaxed day's card report `lost`, and it is why nobody says this shop keeps no one out.
  const heldOutside = tick(relaxedRush, lineWaitMs(relaxedRush) + 1);
  assert.equal(heldOutside.line.length, 0, 'Someone outside with every spot held still goes home');
  assert.equal(heldOutside.lost, relaxedRush.lost + 2, 'And is counted');
  assert.equal(heldOutside.stats.missed, relaxedRush.stats.missed, 'But not held against the shop, in this mode either');
  // And back: the wave logic picks up from wherever the shop is.
  const standardAgain = gameReducer(calm, { type: 'SET_MODE', mode: 'standard' });
  assert.equal(standardAgain.waveLeft, 0, 'Back in standard, no group is rolled for a counter that is still full');
  const standardClear = tick(nobody(standardAgain));
  assert.equal(standardClear.waveLeft, standardClear.config.waveSize, 'The next one comes once it has cleared');

  // ------------------------------------------------------------------ the news
  assert.equal(dayNews({ day: 2, mode: 'standard', seen: ['kinds', 'regulars'] })[0].line, '👥 Khách tới từng đợt — ai chưa có chỗ sẽ đợi ngoài cửa.', 'The sign says it in the shop\'s own words');
  assert.deepEqual(dayNews({ day: 30, mode: 'standard', seen: ['kinds', 'regulars'] }).map((news) => news.id), ['waves', 'overtime'], 'After the kinds and the regulars, in the order a shop meets them');
  assert.ok(dayNews({ day: 30, mode: 'standard', seen: [] }).length <= MAX_NEWS, 'Within a sign\'s limit');

  // ------------------------------------------------------------------ saving a rush
  // A real one, with someone outside, because the line's patience has to survive `parseCustomer`.
  let rushing = opened(1, 2026);
  rushing = until(rushing, (state) => state.line.length > 0);
  const savedRush = parseGame(serializeGame(rushing));
  assert.ok(savedRush, 'A shift with someone in the line can be saved');
  assert.deepEqual(savedRush.line, rushing.line, 'And they come back as they were');
  assert.equal(savedRush.paused, true, 'Behind the pause card');
  const quietSaved = parseGame(serializeGame(run(tick(cleared(9)), 500)));
  assert.equal(quietSaved.incoming.length, getDayConfig(5).waveSize, 'A quiet comes back with who it was leading up to');
  assert.ok(quietSaved.lullUntil > quietSaved.clock, 'And what was left of it');
  // The same day plays out either way, down to who was outside and who gave up.
  const resume = (state) => gameReducer(parseGame(serializeGame(state)), { type: 'SET_PAUSED', paused: false });
  let played = until(opened(9, 77), (state) => state.line.length > 0);
  played = run(played, 500);
  let replayed = resume(played);
  played = { ...played, feedback: [], departures: [] };
  for (let i = 0; i < 1_200; i++) {
    played = tick(played, 250);
    replayed = tick(replayed, 250);
  }
  assert.ok(played.lost > 0 || played.stats.missed > 0, 'Five minutes went by');
  assert.deepEqual(replayed, played, 'A shop reloaded mid-rush plays out the same day');

  const good = JSON.parse(serializeGame(rushing));
  const edited = (mutate) => {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    return JSON.stringify(copy);
  };
  assert.equal(parseGame(edited((s) => (s.line = 'outside'))), null, 'A line that is not a list');
  assert.equal(parseGame(edited((s) => (s.line = [null]))), null, 'Nobody at all in the line');
  assert.equal(parseGame(edited((s) => (s.line[0].order.tea = 'earl-grey'))), null, 'Someone outside for a dead tea');
  assert.equal(parseGame(edited((s) => (s.line[0].orderPatienceMs = 0))), null, 'Someone outside with no patience, which only a bug writes');
  assert.equal(parseGame(edited((s) => (s.waveLeft = -1))), null, 'A group of less than nobody');
  assert.equal(parseGame(edited((s) => (s.waveLeft = 1.5))), null, 'Half a customer');
  assert.equal(parseGame(edited((s) => (s.lullUntil = -1))), null, 'A quiet that ended before opening');
  assert.equal(parseGame(edited((s) => (s.lullUntil = 'soon'))), null, 'A quiet with no end');
  assert.equal(parseGame(edited((s) => (s.lost = -1))), null, 'Fewer than nobody gone home');
  assert.equal(parseGame(edited((s) => (s.lost = 1.5))), null, 'Half a customer gone home');
  // Who is coming can only cost a preview, so it is tidied and not refused.
  assert.deepEqual(parseGame(edited((s) => { s.waveLeft = 3; s.incoming = ['shipper', 'ghost', 7, 'elder']; })).incoming, ['shipper', 'elder'], 'A kind this build does not know is dropped');
  assert.deepEqual(parseGame(edited((s) => { s.waveLeft = 1; s.incoming = ['shipper', 'elder']; })).incoming, ['shipper'], 'And nobody is announced who is not coming');
  assert.deepEqual(parseGame(edited((s) => (s.incoming = 'all of them'))).incoming, [], 'A list that is not a list is no list');
  // Whoever is still to come holds the day open, and a code can say anything, so what it says is held to
  // what a shop can be in. Tidied and not refused: the limits are numbers tuning will move.
  const pastClosing = JSON.parse(serializeGame({ ...nobody(opened(5)), clock: CLOSE + 1_000 }));
  const endsAnyway = (patch) => {
    const state = parseGame(JSON.stringify({ ...pastClosing, ...patch }));
    assert.ok(state, 'An impossible group is not worth a shop');
    assert.equal(until(gameReducer(state, { type: 'SET_PAUSED', paused: false }), (next) => next.phase === 'dayEnd', 300_000).phase, 'dayEnd', 'And the day still ends');
    return state;
  };
  assert.equal(endsAnyway({ mode: 'relaxed', waveLeft: 3 }).waveLeft, 0, 'A relaxed shop has no group, and nothing in it would ever bring one in');
  assert.deepEqual(parseGame(JSON.stringify({ ...pastClosing, mode: 'relaxed', waveLeft: 3, incoming: ['plain'] })).incoming, [], 'Or announce one');
  const farOff = endsAnyway({ waveLeft: 2, nextSpawnAt: 9e15 });
  assert.ok(farOff.nextSpawnAt <= farOff.clock + WAVE_GAP_MAX_MS, 'Nobody is further off than the stagger');
  const crowd = endsAnyway({ waveLeft: 9e15 });
  assert.equal(crowd.waveLeft, getDayConfig(5).waveSize * (OVERTIME_MAX_ROUNDS + 1), 'And no group is bigger than a group with every round on top');
  // That limit is the real one: this is the most a shop can be owed, reached by pressing.
  const pressedOut = (state, times) => (times === 0 ? state : pressedOut(press({ ...state, clock: closesAt(state) - 1_000 }), times - 1));
  const mostOwed = pressedOut({ ...windowOpen, waveLeft: GROUP }, OVERTIME_MAX_ROUNDS);
  assert.equal(mostOwed.waveLeft, GROUP * (OVERTIME_MAX_ROUNDS + 1), 'Every press on top of a group');
  assert.equal(parseGame(serializeGame(mostOwed)).waveLeft, mostOwed.waveLeft, 'Comes back whole');
  // A save from before any of this, mid-shift, with no group on the way.
  const older = parseGame(edited((s) => {
    delete s.waveLeft;
    delete s.lullUntil;
    delete s.incoming;
    delete s.line;
    delete s.lost;
  }));
  assert.ok(older, 'A save from before the waves still loads');
  assert.deepEqual([older.waveLeft, older.lullUntil, older.incoming, older.line, older.lost], [0, 0, [], [], 0], 'With nobody on the way and nobody outside');
  const carriesOn = tick(gameReducer(older, { type: 'SET_PAUSED', paused: false }));
  assert.equal(carriesOn.phase, 'playing', 'And it plays on');
  const olderClear = run({ ...gameReducer(older, { type: 'SET_PAUSED', paused: false }), slots: older.slots.map(() => null) }, 3_000);
  assert.equal(olderClear.waveLeft, olderClear.config.waveSize, 'Its next group comes when the counter clears, as anyone\'s does');

  // ------------------------------------------------------------------ nothing here rolls in the wrong place
  const roll = Math.random;
  Math.random = () => { throw new Error('The reducer rolled dice of its own'); };
  try {
    until(opened(30, 5), (state) => state.phase === 'dayEnd', 1_000_000);
  } finally {
    Math.random = roll;
  }
  // `buildDay` runs twice between days. Nothing it does may roll, or the two ways there would differ.
  const ended = until(opened(4, 3), (state) => state.phase === 'dayEnd', 1_000_000);
  assert.deepEqual(gameReducer(gameReducer(ended, { type: 'GO_TO_TITLE' }), { type: 'START_DAY', day: 5 }), gameReducer(ended, { type: 'START_DAY', day: 5 }), 'The next day is the same by way of the menu');

  console.log('check-waves: groups and the quiet, the line and its bench, closing, what a press brings, relaxed, and a rush saved and played on.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
