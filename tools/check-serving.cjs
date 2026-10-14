/* Run with node tools/check-serving.cjs. Uses the project's TypeScript compiler for pure game code. */
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
  const { drinkPrice } = require(path.join(__dirname, '../src/game/orders.ts'));
  const { getDayConfig, describeUnlocks } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { cupIceFillPath, cupFillPath, cupIcePosition, cupIceRestPosition, cupSurface } = require(path.join(__dirname, '../src/components/cupGeometry.ts'));
  const { createIceLayout, ICE_LAYOUT } = require(path.join(__dirname, '../src/components/iceLayout.ts'));
  const { ICE_LEVELS } = require(path.join(__dirname, '../src/game/ingredients.ts'));
  assert.ok(ICE_LEVELS.find((level) => level.id === 'regular').cubes >
    ICE_LEVELS.find((level) => level.id === 'less').cubes * 2, 'The second scoop visibly fills out the ice cluster');
  assert.equal(ICE_LEVELS.find((level) => level.id === 'regular').cubes, ICE_LAYOUT.length,
    'The full ice level has a placement for every requested cube');
  const scattered = createIceLayout(12);
  assert.deepEqual(scattered, createIceLayout(12), 'A cup keeps the same layout across renders and reloads');
  assert.deepEqual(scattered.slice(0, 3).map(({ restX, restAngle, restLift, r }) => ({ restX, restAngle, restLift, r })),
    ICE_LAYOUT.slice(0, 3).map(({ restX, restAngle, restLift, r }) => ({ restX, restAngle, restLift, r })),
    'Scattering preserves the first scoop\'s fitted dry-floor placements and chunky sizes');
  assert.notDeepEqual(scattered.slice(3), createIceLayout(13).slice(3), 'New cups have different second-scoop arrangements');
  assert.equal(scattered.length, ICE_LAYOUT.length, 'Scattering retains every cube from both scoops');
  // A later top-up must keep lifting floating ice, including the last part of a nearly full cup.
  const fills = [0.35, 0.55, 0.75, 0.9, 1];
  const floating = fills.map((fill) => cupIcePosition(fill, 34, 12, -13, -0.35, 39, 132));
  for (let i = 0; i < floating.length; i++) {
    const ice = floating[i];
    assert.ok(ice.floating, 'Ice floats once tea is deep enough');
    assert.ok(ice.cy > ice.waterY && ice.cy < ice.waterY + 12, 'A floating cube has body below the surface and a visible crown');
    const surface = cupSurface(fills[i]);
    const ellipse = ((34 - 56.5) / surface.rx) ** 2 + ((ice.waterY - surface.y) / surface.ry) ** 2;
    assert.ok(Math.abs(ellipse - 1) < 1e-8 && ice.waterY >= surface.y,
      'Every cube seats at the front of the shared oval rather than behind its rear curve');
    assert.equal(cupIceFillPath(fills[i]).replace(' 0 0 0 ', ' 0 0 1 '), cupFillPath(fills[i]),
      'Ice uses the near arc of the same oval and floor as the tea, at every fill');
    if (i) assert.ok(ice.cy < floating[i - 1].cy - 5, 'Every subsequent top-up raises the ice, with no upper height plateau');
  }
  assert.equal(cupIcePosition(0, 34, 12, -13, -0.35, 39, 132).cy, 132, 'Dry ice rests on the cup floor');
  assert.equal(cupIceFillPath(0), '', 'The front-water mask stays empty until tea is added');
  for (const cube of ICE_LAYOUT.slice(0, 3)) {
    const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift);
    const floorDepth = 9 * Math.sqrt(1 - ((dry.contactX - 56.5) / 33.5) ** 2);
    assert.ok(dry.contactY >= 155 - floorDepth && dry.contactY <= 155 + floorDepth,
      'Each first-scoop cube rests within the elliptical floor instead of hovering above it');
    const rest = cupIcePosition(0, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle);
    assert.equal(rest.angle, cube.restAngle, 'Dry cubes retain their resting tilt');
    assert.equal(rest.cx, dry.cx, 'Dry ice keeps its fitted floor position');
  }
  assert.ok(getDayConfig(1).categories.includes('ice'), 'Ice is available on the first day');
  assert.ok(!describeUnlocks(2).some((line) => line.includes('Chọn đá')), 'Day two does not announce ice again');
  let ordered = gameReducer(createInitialState(123), { type: 'START_DAY', day: 1 });
  ordered = gameReducer(ordered, { type: 'TICK', dt: 5000 });
  const slot = ordered.slots.findIndex(Boolean);
  assert.ok(slot >= 0, 'A customer arrives');
  ordered = gameReducer(ordered, { type: 'TAKE_ORDER', slot });
  const recipe = ordered.slots[slot].order;

  function makeCup(amount) {
    let state = gameReducer(ordered, { type: 'POUR', category: 'tea', optionId: recipe.tea, amount });
    for (const optionId of recipe.toppings) {
      state = gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId });
    }
    const scoops = recipe.ice === 'regular' ? 2 : recipe.ice === 'less' ? 1 : 0;
    for (let i = 0; i < scoops; i++) state = gameReducer(state, { type: 'ICE_SCOOP' });
    return state;
  }

  // First-day orders can request every ice level, and the station can satisfy all of them.
  for (const [level, scoops] of [['none', 0], ['less', 1], ['regular', 2]]) {
    let state = { ...ordered, slots: ordered.slots.map((customer, i) =>
      i === slot ? { ...customer, order: { ...recipe, ice: level } } : customer) };
    state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: recipe.tea, amount: 0.5 });
    for (const optionId of recipe.toppings) state = gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId });
    for (let i = 0; i < scoops; i++) state = gameReducer(state, { type: 'ICE_SCOOP' });
    const restored = parseGame(serializeGame(state));
    assert.ok(restored.config.categories.includes('ice'), 'A restored first-day shop has ice');
    assert.equal(restored.build.iceScoops, scoops, 'Ice scoops survive a reload');
    if (scoops === 2) assert.equal(gameReducer(state, { type: 'ICE_SCOOP' }), state, 'The ice limit is still two scoops');
    const served = gameReducer(state, { type: 'SERVE' });
    assert.equal(served.stats.perfect, 1, `A first-day ${level} ice order can be served perfectly`);
    assert.equal(served.build.iceScoops, 0, 'The new cup starts without ice');
  }

  const full = gameReducer(makeCup(0.99), { type: 'SERVE' });
  for (const amount of [0.0001, 0.03, 0.69, 0.7, 0.85, 0.99]) {
    const before = makeCup(amount);
    const served = gameReducer(before, { type: 'SERVE' });
    assert.equal(served.stats.served, 1, `A ${amount * 100}% cup can be served`);
    assert.equal(served.stats.perfect, 1, 'Recipe quality is independent of fill');
    assert.equal(served.slots[slot], null, 'Customer receives the drink');
    assert.equal(served.cupId, before.cupId + 1, 'Serving supplies a fresh cup');
    assert.equal(served.coins, full.coins, 'Payment has no hidden fill threshold');
    assert.equal(served.stats.tips, full.stats.tips, 'Tips have no hidden fill threshold');
  }
  assert.equal(gameReducer(ordered, { type: 'SERVE' }), ordered, 'Tea is still required');
  const noCustomer = { ...makeCup(0.03), selectedSlot: null };
  assert.equal(gameReducer(noCustomer, { type: 'SERVE' }), noCustomer, 'An order is still required');
  const overflow = gameReducer(makeCup(1.1), { type: 'SERVE' });
  assert.equal(overflow.stats.served, 1, 'An overflowing cup can be served');
  assert.equal(overflow.stats.tips, 0, 'Overflow still loses its tip');
  assert.equal(overflow.coins, Math.ceil(drinkPrice(recipe) / 2), 'Overflow retains the existing spill penalty');
  console.log('Passed: tiny pours serve; fill-independent payment and tips; tea/order guards; overflow behavior.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
