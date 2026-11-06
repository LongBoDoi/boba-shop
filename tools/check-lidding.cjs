const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
for (const ext of ['.png', '.jpg', '.webp', '.svg']) require.extensions[ext] = (m) => { m.exports = 'asset'; };
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);

const { createInitialState, gameReducer: rawReducer, canCarryOut, canServe } = require('../src/game/reducer.ts');
const reduce = require('./sim/arrivals.cjs').withInstantArrivals(rawReducer);
const { parseGame, serializeGame } = require('../src/game/save.ts');
const { layoutKitchen, findStation } = require('../src/kitchen/layout.ts');
let state = reduce(createInitialState(441), { type: 'START_DAY', day: 1 });
state = reduce(state, { type: 'TICK', dt: 5000 });
state = reduce(state, { type: 'TAKE_ORDER', slot: state.slots.findIndex(Boolean) });
for (const action of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW']) assert.equal(reduce(state, { type: action }), state);
state = reduce(state, { type: 'PICK_CUP', size: 'M' });
assert.equal(reduce(state, { type: 'LID_CUP' }), state, 'An empty cup cannot be lidded');
state = reduce(state, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.6 });
assert.equal(canServe(state), false);
assert.equal(reduce(state, { type: 'SERVE' }), state, 'Tea alone cannot be served');
assert.equal(reduce(state, { type: 'ADD_STRAW' }), state, 'The lid must go on first');
for (const action of ['LOAD_LIDDER', 'LID_CUP', 'ADD_STRAW']) {
  const paused = reduce(state, { type: 'SET_PAUSED', paused: true });
  assert.equal(reduce(paused, { type: action }), paused, 'Finishing is blocked while paused');
}
const legacy = JSON.parse(serializeGame(state));
delete legacy.build.lidded; delete legacy.build.straw; delete legacy.build.inLidder;
assert.equal(parseGame(JSON.stringify(legacy)).build.lidded, false, 'Old saves keep their unfinished cup');
assert.equal(parseGame(JSON.stringify(legacy)).build.straw, false);
assert.equal(parseGame(JSON.stringify(legacy)).build.inLidder, false);
const oldMachineSave = JSON.parse(serializeGame(state));
oldMachineSave.build.inLidder = true;
const restored = parseGame(JSON.stringify(oldMachineSave));
assert.equal(restored.build.inLidder, false, 'Old machine saves return to the holder');
assert.equal(restored.build.lidded, false, 'Restoring does not silently finish a drink');
assert.deepEqual(restored.cup, state.cup, 'Migration preserves every ingredient');
const resumed = reduce(restored, { type: 'SET_PAUSED', paused: false });
assert.equal(reduce(resumed, { type: 'LID_CUP' }).build.lidded, true, 'A restored drink lids with one tap');
for (const mutate of [raw => raw.build.lidded = true, raw => raw.cup.tea = null]) {
  const invalid = structuredClone(oldMachineSave); mutate(invalid);
  assert.equal(parseGame(JSON.stringify(invalid)), null, 'Invalid legacy machine states are still rejected');
}
state = reduce(state, { type: 'LID_CUP' });
assert.equal(state.build.lidded, true, 'One action lids the cup without loading or waiting');
assert.equal(state.build.inLidder, false, 'The cup stays on its holder');
assert.equal(reduce(state, { type: 'LID_CUP' }), state, 'A cup takes one lid');
assert.equal(reduce(state, { type: 'SERVE' }), state, 'A lidded cup still needs a straw');
assert.equal(parseGame(serializeGame(state)).build.lidded, true, 'Lid-only progress survives reload');
for (const action of [
  { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.2 },
  { type: 'POUR', category: 'milk', optionId: 'whole', amount: 0.18 },
  { type: 'SCOOP', category: 'toppings', optionId: 'pearls' },
  { type: 'SCOOP', category: 'foam', optionId: 'cheese' },
  { type: 'ICE_SCOOP' }, { type: 'SUGAR_PUMP' },
]) assert.equal(reduce(state, action), state, 'Ingredients cannot pass through the lid');
state = reduce(state, { type: 'ADD_STRAW' });
assert.equal(reduce(state, { type: 'ADD_STRAW' }), state, 'A cup takes one straw');
// Finished, so it can leave the kitchen — but it is served at the counter, once it is there.
assert.equal(canCarryOut(state), true);
assert.equal(canServe(state), false);
assert.equal(parseGame(serializeGame(state)).build.straw, true, 'Finished cups survive reload');
for (const mutate of [s => s.build.straw = 'yes', s => s.build.lidded = false, s => s.cup.tea = null]) {
  const raw = JSON.parse(serializeGame(state)); mutate(raw);
  assert.equal(parseGame(JSON.stringify(raw)), null, 'Impossible finishing states are refused');
}
state = reduce(state, { type: 'CARRY_OUT' });
assert.equal(canServe(state), true, 'Out at the counter, the till can hand it over');
assert.equal(parseGame(serializeGame(state)).build.atCounter, true, 'And a reload leaves it standing there');
for (const type of ['SERVE', 'CLEAR_CUP', 'START_DAY']) {
  const cleared = reduce(state, { type, day: 2 });
  assert.equal(cleared.cup.size, null);
  assert.equal(cleared.build.lidded, false);
  assert.equal(cleared.build.inLidder, false);
  assert.equal(cleared.build.straw, false, 'A new cup never inherits its predecessor’s straw');
}
for (const [width, height] of [[390, 480], [375, 330], [620, 315], [740, 400]]) {
  const layout = layoutKitchen(state.config, width, height);
  const ice = layout.stations.find(s => s.kind === 'ice');
  const lid = layout.stations.find(s => s.kind === 'lid');
  const straw = layout.stations.find(s => s.kind === 'straw');
  assert(lid.x > ice.x + ice.w && straw.x > lid.x + lid.w, 'Finishing follows ice from left to right');
  const pan = layout.room.maxPan;
  const cupX = lid.cx - pan - layout.cupW / 2;
  const cupY = lid.y + lid.h * 0.7 - layout.cupH / 2;
  assert.equal(findStation(layout.stations, cupX, cupY, layout.cupW, layout.cupH, pan, width)?.kind,
    'lid', 'Dropping a cup onto the lid stack selects lids');
  for (const station of [lid, straw]) {
    assert(station.x + station.w <= layout.room.width, 'The station fits in the expanded room');
    assert(station.cx - layout.room.maxPan < width, 'Panning reaches the station');
    assert(station.y >= 0 && station.y + station.h <= height, 'The station stays visible vertically');
  }
}
console.log('Passed: instant lidding, pause/empty/duplicate gates, straw/serve gates, legacy save migration, lid drops and station reach.');
