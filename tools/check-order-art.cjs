'use strict';
// Orders must depict the ingredient actually found at the pictured station, without name captions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
for (const ext of ['.png', '.jpg', '.webp', '.svg', '.woff2', '.wav', '.mp3']) {
  require.extensions[ext] = (module, filename) => { module.exports = filename; };
}
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};
const { ingredientIconSvg, ingredientLocatorSvg } = require('../src/art/ingredientIcon.ts');
const { CATEGORIES } = require('../src/game/ingredients.ts');
const { TEA_DISPENSER_ART, ROOM_BG_TEA_SHELF, ROOM_BG_TOPPING_SHELF } = require('../src/art/kitchenArt.ts');
const { TOPPING_SCOOP_ART, TOPPING_SCOOPS } = require('../src/art/toppingArt.ts');

for (const category of Object.values(CATEGORIES)) {
  const icons = category.options.filter(o => !o.isNone && o.id !== '0').map(option => {
    const icon = ingredientIconSvg(category.id, option.id, 36);
    assert(icon.startsWith('<svg'), `${category.id}/${option.id} has artwork`);
    assert(!icon.includes('<text'), 'Ingredient artwork never needs a rendered name or an installed font');
    return icon.replace(/ba-[\w-]+-\d+/g, 'art-id');
  });
  // Sugar levels intentionally share a spoon, with their quantity drawn by OrderBubble.
  if (category.id !== 'sweetness') assert.equal(new Set(icons).size, icons.length,
    `${category.id}: every choice has a distinct picture`);
}

for (const id of ROOM_BG_TOPPING_SHELF.slots) {
  const cell = TOPPING_SCOOP_ART.cells[id];
  const icon = ingredientIconSvg('toppings', id, 36);
  assert(icon.includes(`href="${TOPPING_SCOOPS}"`), `${id}: use the actual kitchen scoop atlas`);
  assert(icon.includes(`viewBox="${cell.x} ${cell.y} ${cell.width} ${cell.height}"`), `${id}: correct ingredient crop`);
  assert(cell.x >= 0 && cell.y >= 0 && cell.x + cell.width <= TOPPING_SCOOP_ART.width
    && cell.y + cell.height <= TOPPING_SCOOP_ART.height, `${id}: crop stays in the atlas`);
}
for (const id of ROOM_BG_TEA_SHELF.slots) {
  const cell = TEA_DISPENSER_ART.cells[id];
  const icon = ingredientIconSvg('tea', id, 36);
  assert(icon.includes(`viewBox="${cell.x} ${cell.y} ${TEA_DISPENSER_ART.width} ${TEA_DISPENSER_ART.height}"`), `${id}: correct tank`);
}
for (const [category, slots, rows] of [
  ['tea', ROOM_BG_TEA_SHELF.slots, 2], ['toppings', ROOM_BG_TOPPING_SHELF.slots, 3],
]) {
  slots.forEach((id, index) => {
    const selected = ingredientLocatorSvg(category, id).match(/<rect[^>]+fill="#79532D"[^>]*\/>/g);
    assert.equal(selected?.length, 1, `${category}/${id}: exactly one station is indicated`);
    assert(selected[0].includes(`x="${3 + index % 3 * 5}"`)
      && selected[0].includes(`y="${(20 - rows * 5) / 2 + Math.floor(index / 3) * 5}"`),
    `${category}/${id}: diagram agrees with the station's row and column`);
  });
}
assert.notEqual(ingredientIconSvg('toppings', 'lychee', 36), ingredientIconSvg('toppings', 'crystal', 36),
  'The two pale pearl toppings must not collapse into one generic icon');
console.log('check-order-art: matching kitchen artwork, distinct ingredient variants, correct crops and shelf/tray diagrams.');
