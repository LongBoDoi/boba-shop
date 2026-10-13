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
    return state;
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
