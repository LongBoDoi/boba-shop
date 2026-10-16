/* Run with node tools/check-save.cjs. Uses the project's TypeScript compiler for pure game code. */
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
  const { createInitialState, gameReducer } = require(path.join(__dirname, '../src/game/reducer.ts'));
  const { parseGame, serializeGame, SAVE_VERSION } = require(path.join(__dirname, '../src/game/save.ts'));
  const { getDayConfig } = require(path.join(__dirname, '../src/game/levels.ts'));

  // ------------------------------------------------------------------ a shift, saved mid-build
  let state = gameReducer(createInitialState(4242), { type: 'START_DAY', day: 3 });
  state = gameReducer(state, { type: 'TICK', dt: 5_000 });
  const slot = state.slots.findIndex(Boolean);
  assert.ok(slot >= 0, 'A customer arrives');
  state = gameReducer(state, { type: 'TAKE_ORDER', slot });
  const recipe = state.slots[slot].order;
  state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: recipe.tea, amount: 0.6 });
  state = gameReducer(state, { type: 'ICE_SCOOP' });
  state = gameReducer(state, { type: 'SUGAR_PUMP' });
  state = gameReducer(state, { type: 'TICK', dt: 3_000 });

  const restored = parseGame(serializeGame(state));
  assert.ok(restored, 'A mid-shift save comes back');
  assert.equal(restored.phase, 'playing', 'Still in the shift');
  assert.equal(restored.paused, true, 'A restored shift is paused, not already running down');
  assert.equal(restored.day, state.day, 'Same day');
  assert.equal(restored.clock, state.clock, 'Same point in the day');
  assert.equal(restored.coins, state.coins, "Same takings");
  assert.equal(restored.money, state.money, 'Same money in the till');
  assert.equal(restored.seed, state.seed, 'The RNG carries on where it left off');
  assert.equal(restored.mode, state.mode, 'Same mode');
  assert.equal(restored.cupId, state.cupId, 'Same cup');
  assert.deepEqual(restored.cup, state.cup, 'The half-built cup comes back');
  assert.deepEqual(restored.build, state.build, 'With its fill, scoops and pumps');
  assert.deepEqual(restored.stats, state.stats, 'And the day stats');
  assert.deepEqual(restored.config, getDayConfig(state.day), 'The config is re-derived, not stored');
  assert.deepEqual(restored.slots[slot].order, recipe, 'The waiting order is intact');
  assert.equal(restored.slots[slot].status, 'ordered', 'Their order is still taken');
  assert.equal(restored.selectedSlot, slot, 'Their ticket is still the selected one');
  assert.deepEqual(restored.feedback, [], 'Transient feedback is dropped');
  assert.deepEqual(restored.departures, [], 'Transient departures are dropped');
  assert.equal(restored.discarded, null, 'The toss animation is dropped');

  // The restored cup is still worth exactly what it was worth before: finish it the same way on
  // both and the customer pays the same.
  const finish = (from) => {
    let cup = gameReducer(from, { type: 'SET_PAUSED', paused: false });
    for (const optionId of recipe.toppings) {
      const scooped = gameReducer(cup, { type: 'SCOOP', category: 'toppings', optionId });
      assert.ok(scooped !== cup, 'The cup still takes its toppings');
      cup = scooped;
    }
    return gameReducer(cup, { type: 'SERVE' });
  };
  const servedBefore = finish(state);
  const servedAfter = finish(restored);
  assert.equal(servedAfter.stats.served, 1, 'The restored cup can still be served');
  assert.equal(servedAfter.coins, servedBefore.coins, 'Serving the restored cup pays the same');
  assert.deepEqual(servedAfter.stats, servedBefore.stats, 'And scores the same');

  const broken2 = (mutate) => {
    const copy = JSON.parse(serializeGame(state));
    mutate(copy);
    return JSON.stringify(copy);
  };

  // ------------------------------------------------------------------ the other two phases
  // Seeded the way the app seeds it. A small literal here once hid a real bug: the shop is seeded
  // off the clock, which is far larger than the 32-bit state the RNG keeps once it has been used,
  // and the validator used to throw away every save that still held the original.
  const title = parseGame(serializeGame(createInitialState(Date.now())));
  assert.ok(title, 'A save made at the menu comes back at all');
  assert.equal(title.phase, 'title', 'A save made at the menu comes back at the menu');
  assert.equal(title.paused, false, 'Nothing to pause at the menu');

  // The opening sign holds the tick loop, so a day can be saved before its clock has ever moved
  // and before the RNG has reduced the seed to its own 32-bit state.
  const opening = gameReducer(createInitialState(Date.now()), { type: 'START_DAY', day: 2 });
  assert.equal(opening.clock, 0, 'The day has not started ticking');
  const reopened = parseGame(serializeGame(opening));
  assert.ok(reopened, 'A day saved under its opening sign comes back');
  assert.equal(reopened.day, 2, 'On the right day');
  assert.equal(reopened.seed, opening.seed, 'Carrying the seed it was opened with');
  // Its sign is the gate, so it must not also be paused: the player would dismiss the sign and
  // find the day stopped behind a second card.
  assert.equal(reopened.paused, false, 'A day that has not started ticking is not paused as well');
  const begun = gameReducer(reopened, { type: 'TICK', dt: 250 });
  assert.ok(begun.clock > 0, 'And it starts ticking as soon as the sign is dismissed');
  for (const seed of [Date.now(), -1, 0, 7, 2 ** 31, -(2 ** 31) - 1, 1e15]) {
    const held = { ...createInitialState(1), seed };
    assert.ok(parseGame(serializeGame(held)), `A seed of ${seed} is a seed`);
  }
  assert.equal(parseGame(broken2((s) => (s.seed = 1.5))), null, 'A fractional seed is not');
  assert.equal(parseGame(broken2((s) => (s.seed = 'lucky'))), null, 'Nor is a word');

  let ending = gameReducer(createInitialState(9), { type: 'START_DAY', day: 1 });
  while (ending.phase === 'playing') ending = gameReducer(ending, { type: 'TICK', dt: 250 });
  assert.equal(ending.phase, 'dayEnd', 'The day can end');
  const atEnd = parseGame(serializeGame(ending));
  assert.equal(atEnd.phase, 'dayEnd', 'The day-end screen comes back');
  assert.deepEqual(atEnd.stats, ending.stats, 'With the numbers it is reporting');

  // ------------------------------------------------------------------ saves that must be refused
  const good = JSON.parse(serializeGame(state));
  const broken = (mutate) => {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    return JSON.stringify(copy);
  };

  assert.equal(parseGame(null), null, 'No save at all');
  assert.equal(parseGame(''), null, 'An empty save');
  assert.equal(parseGame('not json'), null, 'A save that is not JSON');
  assert.equal(parseGame('[1,2,3]'), null, 'A save that is not an object');
  assert.equal(parseGame(broken((s) => (s.v = SAVE_VERSION + 1))), null, 'A newer format');
  assert.equal(parseGame(broken((s) => delete s.v)), null, 'No version at all');
  assert.equal(parseGame(broken((s) => (s.phase = 'shopping'))), null, 'An unknown phase');
  assert.equal(parseGame(broken((s) => (s.mode = 'hard'))), null, 'An unknown mode');
  assert.equal(parseGame(broken((s) => (s.day = 0))), null, 'Day zero');
  assert.equal(parseGame(broken((s) => (s.day = 2.5))), null, 'Half a day');
  assert.equal(parseGame(broken((s) => (s.clock = -1))), null, 'A clock before opening');
  assert.equal(parseGame(broken((s) => (s.clock = 'soon'))), null, 'A clock that is not a number');
  assert.equal(parseGame(broken((s) => (s.coins = Infinity))), null, 'Infinite takings');
  assert.equal(parseGame(broken((s) => (s.money = -1))), null, 'A till in debt');
  assert.equal(parseGame(broken((s) => (s.money = 12.5))), null, 'Half a unit of money');
  assert.equal(parseGame(broken((s) => (s.money = 'lots'))), null, 'A till that is not a number');
  assert.equal(parseGame(broken((s) => (s.seed = 1e40))), null, 'A seed that is not a 32-bit int');
  assert.equal(parseGame(broken((s) => (s.slots = {}))), null, 'A counter that is not a list');
  assert.equal(parseGame(broken((s) => (s.stats = null))), null, 'Missing stats');
  assert.equal(parseGame(broken((s) => (s.stats.served = -1))), null, 'Negative stats');
  assert.equal(parseGame(broken((s) => (s.build.fill = 2))), null, 'A cup fuller than itself');
  assert.equal(parseGame(broken((s) => (s.build.spilled = 'yes'))), null, 'A spill that is not a flag');
  assert.equal(parseGame(broken((s) => (s.build.iceScoops = 99))), null, 'More ice than a cup takes');
  assert.equal(parseGame(broken((s) => (s.cup.tea = 'earl-grey'))), null, 'A tea the shop never had');
  assert.equal(parseGame(broken((s) => (s.cup.toppings = ['sprinkles']))), null, 'A topping that does not exist');
  assert.equal(parseGame(broken((s) => (s.cup.toppings = 'pearls'))), null, 'Toppings that are not a list');
  assert.equal(parseGame(broken((s) => (s.slots[slot].order.tea = 'earl-grey'))), null, 'An order for a dead tea');
  assert.equal(parseGame(broken((s) => (s.slots[slot].order.tea = null))), null, 'An order with no tea');
  assert.equal(parseGame(broken((s) => (s.slots[slot].look.hairStyle = 'mohawk'))), null, 'A look the art cannot draw');
  assert.equal(parseGame(broken((s) => (s.slots[slot].look.accessory = 'monocle'))), null, 'An accessory that does not exist');
  assert.equal(parseGame(broken((s) => (s.slots[slot].status = 'leaving'))), null, 'An unknown status');
  assert.equal(parseGame(broken((s) => (s.slots[slot].name = ''))), null, 'A customer with no name');
  assert.equal(parseGame(broken((s) => (s.slots[slot].orderedAt = 'now'))), null, 'An order taken at no time');

  // ------------------------------------------------------------------ saves that are tidied up
  // The till was added after the game shipped. A save from before it has to come back — losing a
  // run to gain a tidier format is the one failure this file exists to prevent — carrying today's
  // takings, which is the only money in such a save that can be accounted for.
  const earlier = parseGame(broken((s) => delete s.money));
  assert.ok(earlier, 'A save written before the till still loads');
  assert.equal(earlier.money, earlier.coins, "It opens with today's takings in the till");
  assert.equal(earlier.day, state.day, 'On the day it was saved on');
  assert.deepEqual(earlier.cup, parseGame(serializeGame(state)).cup, 'With the cup it was building');

  const narrower = parseGame(broken((s) => s.slots.push(s.slots[slot])));
  assert.ok(narrower, 'A save from a day with more spots than today still loads');
  assert.equal(narrower.slots.length, getDayConfig(state.day).slots, "Fitted to today's counter");

  const unselected = parseGame(broken((s) => (s.selectedSlot = 99)));
  assert.ok(unselected, 'A selection off the end of the counter still loads');
  assert.equal(unselected.selectedSlot, null, 'With nothing selected, for the next tick to settle');

  const untaken = parseGame(broken((s) => (s.slots[slot].status = 'requesting')));
  assert.equal(untaken.selectedSlot, null, 'A customer whose order is not taken cannot be selected');

  // Ice and sweetness are read off the scoops and pumps, so they are re-derived rather than trusted.
  const lying = parseGame(broken((s) => {
    s.cup.ice = 'none';
    s.cup.sweetness = '100';
  }));
  assert.equal(lying.cup.ice, state.cup.ice, 'Ice follows the scoops that went in');
  assert.equal(lying.cup.sweetness, state.cup.sweetness, 'Sweetness follows the pumps that went in');

  console.log('check-save: the shop is saved and restored correctly');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
