'use strict';
// Orders must depict the ingredient actually found at the pictured station, without name captions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
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
const { TOPPING_PAN_ART, TOPPING_PANS, TOPPING_SCOOP_ART, TOPPING_SCOOPS } = require('../src/art/toppingArt.ts');
const { equipmentFrame } = require('../src/art/equipmentArt.ts');
const { PRELOAD, ROOM_BG, ROOM_BG_ICE_MACHINE, ROOM_BG_EXTRAS } = require('../src/art/kitchenArt.ts');
const {
  KITCHEN_ROOM_ART, KITCHEN_ROOM_RENDER, KITCHEN_ROOM_TRAYS, KITCHEN_ROOM_TRAY_PATCH,
  KITCHEN_ORIGINAL_COUNTER, KITCHEN_ORIGINAL_COUNTER_ART, KITCHEN_ROOM_TRAY_CELLS,
  KITCHEN_BOARDS, KITCHEN_BOARD_ART, KITCHEN_BOARD_ATLAS, KITCHEN_CLEAR_BOARDS, KITCHEN_CLEAR_BOARDS_PATCH,
  KITCHEN_ROOM_TRAY_RAISE, KITCHEN_ROOM_CLEAR_ICE, KITCHEN_ROOM_CLEAR_ICE_PATCH,
} = require('../src/art/kitchenRoomArt.ts');
const { ORIGINAL_TEA_WIDTH, ORIGINAL_ROOM_SIZE } = require('../src/art/roomGeometry.ts');
const { layoutKitchen, findDairyStation } = require('../src/kitchen/layout.ts');
const { getDayConfig } = require('../src/game/levels.ts');

// Shelf additions must preserve the original overhead painting byte for byte.
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ROOM_BG)).digest('hex'),
  '337ef3b9e618cd8eed1686a9bf88f0283f7a2f28a57bf9520d47b3acdaaafdfe',
  'Keep the original room plate available as an untouched design reference');

const roomPng = fs.readFileSync(KITCHEN_ROOM_RENDER);
assert.equal(roomPng.readUInt32BE(16), KITCHEN_ROOM_ART.width);
assert.equal(roomPng.readUInt32BE(20), KITCHEN_ROOM_ART.height);
assert(PRELOAD.includes(KITCHEN_ROOM_RENDER), 'The continuous room must load before play');
assert.equal(crypto.createHash('sha256').update(roomPng).digest('hex'),
  'b00a0387aafe06ddb56a187c2b212edae5c12ec15e2e96e6723b977979b7bd5a',
  'Use the original room pixels instead of the repeatedly regenerated room');
assert(PRELOAD.includes(KITCHEN_ROOM_TRAYS), 'The local tray edit loads before play');
const patch = KITCHEN_ROOM_TRAY_PATCH;
assert(patch.x >= 0 && patch.y >= 0 && patch.x + patch.width <= KITCHEN_ROOM_ART.width
  && patch.y + patch.height <= KITCHEN_ROOM_ART.height, 'The tray crop fits its source');
assert(patch.width * patch.height < KITCHEN_ROOM_ART.width * KITCHEN_ROOM_ART.height * 0.05,
  'Tray edits cannot replace or soften the rest of the room');
assert(PRELOAD.includes(KITCHEN_ROOM_CLEAR_ICE));
const clearedCounter = fs.readFileSync(KITCHEN_ROOM_CLEAR_ICE);
assert.equal(clearedCounter.readUInt32BE(16), KITCHEN_ROOM_ART.width);
assert.equal(clearedCounter.readUInt32BE(20), KITCHEN_ROOM_ART.height);
const clear = KITCHEN_ROOM_CLEAR_ICE_PATCH;
assert(clear.x + clear.width <= KITCHEN_ROOM_ART.width && clear.y + clear.height <= KITCHEN_ROOM_ART.height);
assert(clear.y >= 734, 'Clearing the old ice cannot overwrite the restored boards');
assert(clear.width * clear.height < KITCHEN_ROOM_ART.width * KITCHEN_ROOM_ART.height * 0.04,
  'Clearing the old ice footprint preserves the surrounding stations');
assert(Math.abs(ROOM_BG_ICE_MACHINE.y - ROOM_BG_TOPPING_SHELF.edges[0].y) < 16,
  'The ice tray starts at the same counter level as the topping station');
assert(Math.abs((979 - ROOM_BG_ICE_MACHINE.y) / 1430 * 1083 - KITCHEN_ROOM_TRAY_RAISE) < 0.001,
  'Ice touch bounds move with the painted tray');
assert.equal(ROOM_BG_EXTRAS.sugar.y, ROOM_BG_ICE_MACHINE.y + ROOM_BG_ICE_MACHINE.height + 8);
assert.equal(KITCHEN_ORIGINAL_COUNTER, ROOM_BG, 'Restore the boards directly from the untouched first design');
assert(PRELOAD.includes(KITCHEN_ORIGINAL_COUNTER));
const counterPng = fs.readFileSync(KITCHEN_ORIGINAL_COUNTER);
assert.equal(counterPng.readUInt32BE(16), KITCHEN_ORIGINAL_COUNTER_ART.width);
assert.equal(counterPng.readUInt32BE(20), KITCHEN_ORIGINAL_COUNTER_ART.height);
assert(KITCHEN_ORIGINAL_COUNTER_ART.top < 350, 'The original counter crop includes both complete boards');
assert(PRELOAD.includes(KITCHEN_CLEAR_BOARDS));
assert(KITCHEN_CLEAR_BOARDS_PATCH.x + KITCHEN_CLEAR_BOARDS_PATCH.width < 1230,
  'The board removal source stops before the topping station');
assert(KITCHEN_CLEAR_BOARDS_PATCH.y + KITCHEN_CLEAR_BOARDS_PATCH.height <= 590,
  'Only a short marble blend extends below the old board shadows');
assert(KITCHEN_BOARDS[0].x > (KITCHEN_ROOM_TRAY_CELLS[0].x + KITCHEN_ROOM_TRAY_CELLS[0].width)
  / KITCHEN_ROOM_ART.width * 1920 + 80, 'The compact boards clear the raised trays');
assert(KITCHEN_BOARDS[1].x > KITCHEN_BOARDS[0].x + KITCHEN_BOARDS[0].width + 12,
  'Both boards have a visible marble gap');
assert(PRELOAD.includes(KITCHEN_BOARD_ART), 'The boards load with the matching package atlas');
const boardPng = fs.readFileSync(KITCHEN_BOARD_ART);
assert.equal(boardPng.readUInt32BE(16), KITCHEN_BOARD_ATLAS.width);
assert.equal(boardPng.readUInt32BE(20), KITCHEN_BOARD_ATLAS.height);
for (const board of KITCHEN_BOARDS) {
  const s = board.source;
  assert(s.x >= 0 && s.y >= 0 && s.x + s.width <= KITCHEN_BOARD_ATLAS.width
    && s.y + s.height <= KITCHEN_BOARD_ATLAS.height, 'Board crops stay in the transparent atlas');
  assert(board.surfaceHeight > board.height * 0.9 && board.height - board.surfaceHeight <= 16,
    'The overhead board keeps its top plane and a complete rounded front edge');
}
for (const pan of KITCHEN_ROOM_TRAY_CELLS) {
  assert(pan.x >= 0 && pan.y >= 0 && pan.x + pan.width <= KITCHEN_ROOM_ART.width
    && pan.y + pan.height <= KITCHEN_ROOM_ART.height, 'Each isolated pan fits its source');
}

// A taller room must not shrink the tanks back below the first top-down design's apparent size.
for (const [width, height] of [[390, 541], [375, 364], [450, 315], [500, 355], [715, 532]]) {
  const layout = layoutKitchen(getDayConfig(1), width, height);
  const tanks = layout.stations.filter(s => s.kind === 'tea');
  const originalScale = Math.max(width / ORIGINAL_ROOM_SIZE.width, height / ORIGINAL_ROOM_SIZE.height);
  assert.equal(tanks.length, 6);
  for (const tank of tanks) {
    assert(tank.w >= ORIGINAL_TEA_WIDTH * originalScale - 0.1,
      `${width}×${height}: ${tank.id} keeps the first design's apparent size`);
  }
  assert(Math.max(...tanks.slice(0, 3).map(s => s.y + s.h))
    < Math.min(...tanks.slice(3).map(s => s.y)), 'The tall rack gives both rows their own clearance');
}

// Painted atlases must be present before play; their independent crops must neither bleed
// into neighbouring products nor distort their packaging proportions between UI and Canvas.
for (const id of ['whole', 'oat', 'cheese', 'brulee']) {
  const { source: s, target: t, width, height, atlas } = equipmentFrame(id);
  const png = fs.readFileSync(atlas.image);
  assert.equal(png.readUInt32BE(16), atlas.width);
  assert.equal(png.readUInt32BE(20), atlas.height);
  assert(PRELOAD.includes(atlas.image), 'Painted packages must load before the kitchen opens');
  const d = atlas.detail;
  for (const crop of [s, d]) {
    assert(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= atlas.width
      && crop.y + crop.height <= atlas.height, `${id}: artwork crop stays inside the atlas`);
  }
  assert(d.x >= s.x && d.y >= s.y && d.x + d.width <= s.x + s.width
    && d.y + d.height <= s.y + s.height, `${id}: detail shows this product only`);
  assert(t.x >= 0 && t.y >= 0 && t.x + t.width <= width && t.y + t.height <= height,
    `${id}: painted silhouette fits its equipment frame`);
  assert(Math.abs(t.width / t.height - s.width / s.height) < 1e-8, `${id}: preserve painted proportions`);
}

// Each pair fits its compact board, including room behind the front edge for cast shadows.
for (const [width, height] of [[390, 541], [375, 364], [450, 315], [715, 532]]) {
  const layout = layoutKitchen(getDayConfig(1), width, height);
  const { scale, top } = layout.room;
  const milkHeights = [], creamHeights = [];
  const footprints = [];
  for (const station of layout.stations.filter(s => s.kind === 'milk' || s.kind === 'foam')) {
    const milk = station.kind === 'milk';
    const frame = equipmentFrame(station.id);
    const foot = station.y + station.h * frame.foot / frame.height;
    const x = station.cx / scale;
    const y = (foot - top) / scale;
    const halfWidth = station.w * frame.target.width / frame.width / scale / 2;
    const board = KITCHEN_BOARDS[milk ? 0 : 1];
    assert(y > board.y + board.height * 0.25 && y < board.y + board.height * 0.68,
      `${station.id}: its foot leaves room for the shadow on the wooden top`);
    assert(x - halfWidth > board.x + 20 && x + halfWidth < board.x + board.width - 20,
      `${station.id}: the whole package fits the wooden board`);
    for (const fraction of [0.3, 0.5, 0.7]) {
      assert.equal(findDairyStation(layout.stations, station.x + station.w * fraction,
        station.y + station.h * 0.48)?.key, station.key,
      'Touching a container selects it even where the expanded touch areas overlap');
    }
    footprints.push({ left: x - halfWidth, right: x + halfWidth, y, milk });
    (milk ? milkHeights : creamHeights).push(station.h * frame.target.height / frame.height);
  }
  assert(Math.min(...milkHeights) > Math.max(...creamHeights), 'Milk cartons remain larger than cream dispensers');
  footprints.sort((a, b) => a.left - b.left);
  assert.equal(footprints.length, 4);
  for (let i = 1; i < footprints.length; i++) {
    const gap = footprints[i].left - footprints[i - 1].right;
    assert(gap > 15, 'Packages never overlap');
    if (footprints[i].milk === footprints[i - 1].milk) {
      assert(gap < 65, 'Each pair stays together on its own board');
      assert(Math.abs(footprints[i].y - footprints[i - 1].y) <= 8,
        'A small depth stagger keeps both feet on the same surface');
    }
  }
}

// The overhead pan sheet has its own dimensions and row ordering.
const panPng = fs.readFileSync(TOPPING_PANS);
assert.equal(panPng.readUInt32BE(16), TOPPING_PAN_ART.width);
assert.equal(panPng.readUInt32BE(20), TOPPING_PAN_ART.height);
assert(PRELOAD.includes(TOPPING_PANS));
for (const [id, cell] of Object.entries(TOPPING_PAN_ART.cells)) {
  assert(cell.x >= 0 && cell.y >= 0 && cell.x + cell.width <= TOPPING_PAN_ART.width
    && cell.y + cell.height <= TOPPING_PAN_ART.height, `${id}: overhead pan crop stays in its atlas`);
}

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
