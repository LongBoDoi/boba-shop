const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);

try {
  const { CUP_SIZES, EMPTY_DRINK } = require('../src/game/ingredients.ts');
  const { createInitialState, gameReducer } = require('../src/game/reducer.ts');
  const { getDayConfig } = require('../src/game/levels.ts');
  const { generateOrder, evaluateDrink, drinkPrice } = require('../src/game/orders.ts');
  const { createRng } = require('../src/game/random.ts');
  const { parseGame, serializeGame } = require('../src/game/save.ts');
  const start = () => gameReducer(createInitialState(441), { type: 'START_DAY', day: 1 });
  const bench = start();
  assert.equal(bench.cup.size, null, 'A new day has no cup');
  for (const action of [
    { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.5 },
    { type: 'POUR', category: 'milk', optionId: 'whole', amount: 0.18 },
    { type: 'SCOOP', category: 'toppings', optionId: 'pearls' },
    { type: 'SCOOP', category: 'foam', optionId: 'cheese' },
    { type: 'ICE_SCOOP' }, { type: 'SUGAR_PUMP' }, { type: 'SERVE' }, { type: 'CLEAR_CUP' },
  ]) assert.equal(gameReducer(bench, action), bench, `${action.type} cannot act on an absent cup`);
  for (const size of ['XL', '', null, undefined]) {
    assert.equal(gameReducer(bench, { type: 'PICK_CUP', size }), bench, 'Only S, M and L cups can be picked');
  }
  const paused = gameReducer(bench, { type: 'SET_PAUSED', paused: true });
  assert.equal(gameReducer(paused, { type: 'PICK_CUP', size: 'S' }), paused, 'No picking while paused');

  for (const size of CUP_SIZES) {
    const picked = gameReducer(bench, { type: 'PICK_CUP', size });
    assert.deepEqual(picked.cup, { ...EMPTY_DRINK, size }, 'Picking creates an empty cup in the requested size');
    assert(picked.cupId > bench.cupId, 'Picking resets the previous cup gestures');
    for (const replacement of CUP_SIZES) {
      assert.equal(gameReducer(picked, { type: 'PICK_CUP', size: replacement }), picked, 'A second cup cannot replace an existing one');
    }
    const restored = parseGame(serializeGame(picked));
    assert.equal(restored.cup.size, size, 'An empty selected cup survives reload');
    const poured = gameReducer(picked, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.5 });
    assert.equal(poured.build.fill, 0.5, 'A picked cup takes tea');
    assert.equal(parseGame(serializeGame(poured)).cup.size, size, 'A filled cup retains its size');
    for (const current of [picked, poured]) {
      const cleared = gameReducer(current, { type: 'CLEAR_CUP' });
      assert.equal(cleared.cup.size, null, 'Discarding leaves an empty mat, including an unused cup');
      assert.equal(cleared.discarded.drink.size, size, 'The tossed cup retains its size');
      assert.equal(parseGame(serializeGame(cleared)).cup.size, null, 'An empty mat survives reload');
      assert.equal(gameReducer(cleared, { type: 'PICK_CUP', size: 'M' }).cup.size, 'M', 'Another cup must be taken from the rack');
    }
  }

  const rng = createRng(199);
  for (const day of [1, 5, 9]) {
    const sizes = new Set(Array.from({ length: 100 }, () => generateOrder(getDayConfig(day), rng).size));
    assert.deepEqual([...sizes].sort(), [...CUP_SIZES].sort(), 'Customers can request all three sizes from day one');
  }
  const config = getDayConfig(1);
  for (const size of CUP_SIZES) {
    const order = { ...EMPTY_DRINK, size, tea: 'black', ice: 'none' };
    assert.equal(evaluateDrink(order, order, config.categories).quality, 'perfect');
    const other = CUP_SIZES.find(candidate => candidate !== size);
    const wrongSize = { ...order, size: other };
    assert.deepEqual(evaluateDrink(wrongSize, order, config.categories).mistakes, ['size']);
    assert.equal(evaluateDrink(wrongSize, order, config.categories).quality, 'close', 'A wrong size loses perfect quality');
    assert.equal(evaluateDrink({ ...wrongSize, tea: 'green' }, order, config.categories).quality, 'wrong');
    assert.notEqual(evaluateDrink({ ...order, size: null }, order, config.categories).quality, 'perfect');

    let customerState = gameReducer(start(), { type: 'TICK', dt: 5000 });
    const slot = customerState.slots.findIndex(Boolean);
    customerState = gameReducer(customerState, { type: 'TAKE_ORDER', slot });
    customerState = { ...customerState, slots: customerState.slots.map((customer, i) =>
      i === slot ? { ...customer, order } : customer) };
    for (const chosen of [size, other]) {
      let state = gameReducer(customerState, { type: 'PICK_CUP', size: chosen });
      state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: 'black', amount: 0.6 });
      const served = gameReducer(state, { type: 'SERVE' });
      assert.equal(served.cup.size, null, 'Serving does not spawn a replacement');
      assert.equal(served.stats.perfect, chosen === size ? 1 : 0);
      if (chosen !== size) {
        assert.equal(served.stats.tips, 0, 'Wrong size earns no tip');
        assert.equal(served.coins, Math.ceil(drinkPrice(order) / 2), 'Wrong size earns the existing close-recipe payment');
      }
    }

    const save = JSON.parse(serializeGame(customerState));
    delete save.slots[slot].order.size;
    delete save.cup.size;
    const migrated = parseGame(JSON.stringify(save));
    assert(migrated, 'Legacy saves are preserved');
    assert.equal(migrated.slots[slot].order.size, 'M', 'Legacy customer orders use medium');
    assert.equal(migrated.cup.size, null, 'An untouched legacy bench waits for a cup');
    save.cup.tea = 'black'; save.build.fill = 0.6;
    assert.equal(parseGame(JSON.stringify(save)).cup.size, 'M', 'Legacy in-progress drinks keep their medium cup');
    save.cup.size = null;
    assert.equal(parseGame(JSON.stringify(save)), null, 'Ingredients cannot be saved without a cup');
    save.cup.size = 'XL';
    assert.equal(parseGame(JSON.stringify(save)), null, 'Unknown saved cup sizes are rejected');
    save.cup.size = 'M'; save.slots[slot].order.size = null;
    assert.equal(parseGame(JSON.stringify(save)), null, 'Customer orders must require a valid cup size');
  }
  console.log('Passed: S/M/L pickup, absent-cup guards, replacement protection, size scoring, serve/discard, saves and legacy migration.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
