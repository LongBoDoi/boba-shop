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
  const { drinkPrice, evaluateDrink, generateOrder } = require(path.join(__dirname, '../src/game/orders.ts'));
  const { createRng } = require(path.join(__dirname, '../src/game/random.ts'));
  const { getDayConfig, describeUnlocks } = require(path.join(__dirname, '../src/game/levels.ts'));
  const { parseGame, serializeGame } = require(path.join(__dirname, '../src/game/save.ts'));
  const { cupIceFillPath, cupFillPath, cupIcePosition, cupIceRestPosition, cupSurface, CUP_SURFACE_BOTTOM, CUP_FLOOR_FRONT } = require(path.join(__dirname, '../src/art/cupGeometry.ts'));
  const { createIceLayout, ICE_LAYOUT } = require(path.join(__dirname, '../src/art/iceLayout.ts'));
  const { asksFor, BUILD_ORDER, CATEGORIES, DEFAULT_ID, ICE_LEVELS, SUGAR_STEPS, TEAS, TOPPINGS } =
    require(path.join(__dirname, '../src/game/ingredients.ts'));
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
    const floorDepth = (CUP_FLOOR_FRONT - CUP_SURFACE_BOTTOM) * Math.sqrt(1 - ((dry.contactX - 56.5) / 33.5) ** 2);
    assert.ok(dry.contactY >= CUP_SURFACE_BOTTOM - floorDepth && dry.contactY <= CUP_SURFACE_BOTTOM + floorDepth,
      'Each first-scoop cube rests within the elliptical floor instead of hovering above it');
    const rest = cupIcePosition(0, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle);
    assert.equal(rest.angle, cube.restAngle, 'Dry cubes retain their resting tilt');
    assert.equal(rest.cx, dry.cx, 'Dry ice keeps its fitted floor position');
  }
  // ------------------------------------------------------------------ the whole menu, from day one
  // Nothing about what can go in a cup depends on the day any more: no category, no tea and no
  // topping waits for a later shift, so day 1 is the same shelf as day 30.
  const first = getDayConfig(1);
  assert.deepEqual(first.categories, BUILD_ORDER, 'Day one cares about every category, in build order');
  assert.deepEqual(first.options.tea, TEAS.map((tea) => tea.id), 'Every tea is on the rack on day one');
  assert.deepEqual(first.options.toppings, TOPPINGS.map((topping) => topping.id), 'Every topping is in the stand on day one');
  for (const category of BUILD_ORDER) {
    assert.deepEqual(first.options[category], CATEGORIES[category].options.map((option) => option.id),
      `Day one offers the whole ${category} catalogue`);
  }
  for (const day of [2, 3, 4, 5, 6, 10, 30]) {
    const later = getDayConfig(day);
    assert.deepEqual(later.categories, first.categories, `Day ${day} adds no category`);
    assert.deepEqual(later.options, first.options, `Day ${day} adds no ingredient`);
  }
  // So the sign and the day-end screen can only ever announce the pace, never an ingredient.
  const names = [...TEAS, ...TOPPINGS].map((option) => option.name)
    .concat(BUILD_ORDER.map((category) => `Chọn ${CATEGORIES[category].label.toLowerCase()}`));
  for (let day = 1; day <= 30; day++) {
    for (const line of describeUnlocks(day)) {
      assert.ok(!names.some((name) => line.includes(name)), `Day ${day} does not announce "${line}"`);
    }
  }
  assert.deepEqual(describeUnlocks(2), ['🧍 Thêm một chỗ cho khách'], 'Day two still gains its third counter spot');
  assert.deepEqual(describeUnlocks(5), ['✨ Tối đa 2 topping'], 'Day five still gains its second topping per drink');
  assert.deepEqual(describeUnlocks(3), [], 'A day that changes nothing announces nothing');

  // ------------------------------------------------------------------ what a customer asks for
  // An order names a size and a tea, and then only what this customer felt like asking for. A
  // category they said nothing about is left *unset* rather than set to its none/0 option: the two
  // mean the same thing to the cup, and the difference is that the panel has nothing to list.
  const OPTIONAL = ['toppings', 'sweetness', 'ice', 'milk', 'foam'];
  const asked = Object.fromEntries(OPTIONAL.map((category) => [category, { named: 0, silent: 0 }]));
  const shapes = new Set();
  const orderRng = createRng(20261019);
  for (let i = 0; i < 20_000; i++) {
    const order = generateOrder(first, orderRng);
    assert.ok(order.size, 'Every order names a cup size');
    assert.ok(order.tea && asksFor(order, 'tea'), 'Every order names a tea');
    for (const category of OPTIONAL) {
      const names = asksFor(order, category);
      asked[category][names ? 'named' : 'silent']++;
      if (category === 'toppings') {
        assert.equal(order.toppings.length > 0, names, 'Toppings are asked for by being listed');
      } else if (names) {
        assert.notEqual(order[category], DEFAULT_ID[category], `A named ${category} is never the none/0 option`);
      } else {
        assert.equal(order[category], null, `An order that says nothing about ${category} leaves it unset`);
      }
    }
    shapes.add(OPTIONAL.filter((category) => asksFor(order, category)).join('+'));
  }
  for (const category of OPTIONAL) {
    assert.ok(asked[category].named > 0, `${category} is sometimes asked for`);
    assert.ok(asked[category].silent > 0, `${category} is sometimes left out altogether`);
  }
  assert.equal(shapes.size, 2 ** OPTIONAL.length, 'Every combination of the optional categories turns up');
  assert.ok(shapes.has(''), 'A plain cup of tea is an order a customer can place');
  let ordered = gameReducer(createInitialState(123), { type: 'START_DAY', day: 1 });
  ordered = gameReducer(ordered, { type: 'TICK', dt: 5000 });
  const slot = ordered.slots.findIndex(Boolean);
  assert.ok(slot >= 0, 'A customer arrives');
  ordered = gameReducer(ordered, { type: 'TAKE_ORDER', slot });
  const recipe = ordered.slots[slot].order;

  /**
   * Build the cup `order` asks for, pouring `amount` of tea. Every category is on the menu from day
   * one now, so a first-day order can want milk, sugar and foam as well — a cup holding only tea,
   * toppings and ice stopped being a perfect drink when the unlock schedule went. The milk is a
   * splash, so the tea's own amount is still what decides whether the cup overflowed.
   */
  function buildCup(state, order, amount) {
    state = gameReducer(state, { type: 'PICK_CUP', size: order.size });
    for (const optionId of order.toppings) {
      state = gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId });
    }
    for (let i = SUGAR_STEPS.indexOf(order.sweetness) + 1; i > 0; i--) {
      state = gameReducer(state, { type: 'SUGAR_PUMP' });
    }
    const scoops = order.ice === 'regular' ? 2 : order.ice === 'less' ? 1 : 0;
    for (let i = 0; i < scoops; i++) state = gameReducer(state, { type: 'ICE_SCOOP' });
    state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: order.tea, amount });
    if (order.milk && order.milk !== 'none') {
      state = gameReducer(state, { type: 'POUR', category: 'milk', optionId: order.milk, amount: 0.001 });
    }
    if (order.foam && order.foam !== 'none') {
      state = gameReducer(state, { type: 'SCOOP', category: 'foam', optionId: order.foam });
    }
    return state;
  }

  const finishCup = (state) => gameReducer(gameReducer(gameReducer(state, { type: 'LOAD_LIDDER' }), { type: 'LID_CUP' }), { type: 'ADD_STRAW' });

  const makeCup = (amount) => buildCup(ordered, recipe, amount);

  // First-day orders can request every ice level, and the station can satisfy all of them.
  for (const [level, scoops] of [['none', 0], ['less', 1], ['regular', 2]]) {
    const order = { ...recipe, ice: level };
    let state = { ...ordered, slots: ordered.slots.map((customer, i) =>
      i === slot ? { ...customer, order } : customer) };
    state = buildCup(state, order, 0.5);
    const restored = parseGame(serializeGame(state));
    assert.ok(restored.config.categories.includes('ice'), 'A restored first-day shop has ice');
    assert.equal(restored.build.iceScoops, scoops, 'Ice scoops survive a reload');
    if (scoops === 2) assert.equal(gameReducer(state, { type: 'ICE_SCOOP' }), state, 'The ice limit is still two scoops');
    const served = gameReducer(finishCup(state), { type: 'SERVE' });
    assert.equal(served.stats.perfect, 1, `A first-day ${level} ice order can be served perfectly`);
    assert.equal(served.build.iceScoops, 0, 'The new cup starts without ice');
  }

  // Saying nothing about a category is still asking for none of it: the panel has no tile for it,
  // but an ingredient nobody wanted spoils the drink exactly as a wrong one does.
  const plain = { size: 'M', toppings: [], sweetness: null, ice: null, tea: 'black', milk: null, foam: null };
  const plainOrdered = { ...ordered, slots: ordered.slots.map((customer, i) =>
    i === slot ? { ...customer, order: plain } : customer) };
  const asOrdered = buildCup(plainOrdered, plain, 0.6);
  assert.equal(gameReducer(finishCup(asOrdered), { type: 'SERVE' }).stats.perfect, 1, 'A plain cup of tea is served perfectly');
  const unwanted = gameReducer(asOrdered, { type: 'SCOOP', category: 'foam', optionId: 'cheese' });
  assert.deepEqual(evaluateDrink(unwanted.cup, plain, first.categories).mistakes, ['foam'],
    'Foam nobody asked for is counted as a mistake');
  assert.equal(gameReducer(finishCup(unwanted), { type: 'SERVE' }).stats.perfect, 0, 'And costs the drink its perfect mark');

  const full = gameReducer(finishCup(makeCup(0.99)), { type: 'SERVE' });
  for (const amount of [0.0001, 0.03, 0.69, 0.7, 0.85, 0.99]) {
    const before = makeCup(amount);
    const served = gameReducer(finishCup(before), { type: 'SERVE' });
    assert.equal(served.stats.served, 1, `A ${amount * 100}% cup can be served`);
    assert.equal(served.stats.perfect, 1, 'Recipe quality is independent of fill');
    assert.equal(served.slots[slot], null, 'Customer receives the drink');
    assert.equal(served.cupId, before.cupId + 1, 'Serving retires the current cup');
    assert.equal(served.cup.size, null, 'Serving leaves the mat empty');
    assert.equal(served.coins, full.coins, 'Payment has no hidden fill threshold');
    assert.equal(served.stats.tips, full.stats.tips, 'Tips have no hidden fill threshold');
  }
  assert.equal(gameReducer(ordered, { type: 'SERVE' }), ordered, 'Tea is still required');
  const noCustomer = { ...makeCup(0.03), selectedSlot: null };
  assert.equal(gameReducer(noCustomer, { type: 'SERVE' }), noCustomer, 'An order is still required');
  const overflow = gameReducer(finishCup(makeCup(1.1)), { type: 'SERVE' });
  assert.equal(overflow.stats.served, 1, 'An overflowing cup can be served');
  assert.equal(overflow.stats.tips, 0, 'Overflow still loses its tip');
  assert.equal(overflow.coins, Math.ceil(drinkPrice(recipe) / 2), 'Overflow retains the existing spill penalty');
  // The three newest toppings, played through on a day whose orders may hold two of them.
  for (const [optionId, day] of [['redbean', 6], ['aloe', 7], ['crystal', 8]]) {
    assert.ok(getDayConfig(1).options.toppings.includes(optionId), 'Every topping is available from day one');
    let state = gameReducer(createInitialState(4242), { type: 'START_DAY', day });
    state = gameReducer(state, { type: 'TICK', dt: 5000 });
    const slot = state.slots.findIndex(Boolean);
    state = gameReducer(state, { type: 'TAKE_ORDER', slot });
    state.slots[slot].order = { size: 'M', tea: 'black', toppings: [optionId, 'pearls'], milk: null, ice: null, sweetness: null, foam: null };
    state = gameReducer(state, { type: 'PICK_CUP', size: 'M' });
    state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.5 });
    state = gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId });
    assert.equal(gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId }), state, 'A new topping cannot be added twice');
    state = gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId: 'pearls' });
    assert.equal(gameReducer(state, { type: 'SCOOP', category: 'toppings', optionId: 'pudding' }), state, 'New toppings respect the two-portion limit');
    const restored = parseGame(serializeGame(state));
    assert.ok(restored, 'A drink with the new topping restores correctly');
    assert.deepEqual(restored.cup.toppings, [optionId, 'pearls']);
    const served = gameReducer(finishCup(gameReducer(restored, { type: 'SET_PAUSED', paused: false })), { type: 'SERVE' });
    assert.equal(served.stats.perfect, 1, 'A recipe with the new topping can be served perfectly after reload');
  }
  // ------------------------------------------------------------------ the shop's money
  // A till that keeps everything earned reaches numbers a price never did, and a wall of digits is
  // not a number anyone can read at a glance.
  const { formatMoney } = require(path.join(__dirname, '../src/game/money.ts'));
  assert.equal(formatMoney(0), '0k', 'An empty till');
  assert.equal(formatMoney(8), '80k', 'A price is unchanged');
  assert.equal(formatMoney(99), '990k', 'Right up to the last three digits');
  assert.equal(formatMoney(100), '1.000k', 'And groups from there');
  assert.equal(formatMoney(318), '3.180k', "A week's trade");
  assert.equal(formatMoney(123456), '1.234.560k', 'However long a run gets');

  // No day can be failed any more, so nothing hangs on a target: the takings are simply kept, and
  // the till is what carries from one day to the next.
  assert.equal(getDayConfig(1).goal, undefined, 'A day no longer sets a money target');
  const paid = gameReducer(finishCup(makeCup(0.8)), { type: 'SERVE' });
  assert.ok(paid.coins > 0, 'Serving a drink pays');
  assert.equal(paid.money, paid.coins, "A new shop's till is exactly what it has taken");

  const nextDay = gameReducer(paid, { type: 'START_DAY', day: 2 });
  assert.equal(nextDay.coins, 0, "A new day's takings start at nothing");
  assert.equal(nextDay.money, paid.money, 'The till carries over');
  assert.deepEqual(nextDay.stats, { served: 0, perfect: 0, missed: 0, tips: 0 }, 'And the stats do not');
  // The money is the player's, not the run's: abandoning a run at the menu must not empty the till,
  // or anything bought with it would be a punishment for quitting.
  const quit = gameReducer(nextDay, { type: 'GO_TO_TITLE' });
  assert.equal(quit.money, paid.money, 'Going back to the menu keeps the money');
  assert.equal(gameReducer(quit, { type: 'START_DAY', day: 1 }).money, paid.money, 'And so does starting over');
  assert.equal(parseGame(serializeGame(nextDay)).money, paid.money, 'The till is written down with the shop');

  const till = nextDay.money;
  assert.equal(gameReducer(nextDay, { type: 'SPEND', amount: till }).money, 0, 'The shop can spend what it has');
  assert.equal(gameReducer(nextDay, { type: 'SPEND', amount: 2 }).money, till - 2, 'And part of it');
  for (const amount of [till + 1, -5, 1.5, NaN, Infinity]) {
    assert.equal(gameReducer(nextDay, { type: 'SPEND', amount }), nextDay, `${amount} is not a price the till pays`);
  }
  assert.equal(gameReducer(nextDay, { type: 'SPEND', amount: 1 }).coins, nextDay.coins,
    "Spending comes out of the till, not out of the day's takings");

  console.log('Passed: tiny pours serve; fill-independent payment and tips; tea/order guards; overflow behavior; the whole menu open on day one; what an order asks for and leaves out; toppings saved and served; money earned, carried and spent.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
