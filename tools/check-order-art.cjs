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
const { KITCHEN_ROOM_ART, KITCHEN_ROOM_RENDER, KITCHEN_BOARDS } = require('../src/art/kitchenRoomArt.ts');
const { ORIGINAL_TEA_WIDTH, ORIGINAL_ROOM_SIZE } = require('../src/art/roomGeometry.ts');
const { layoutKitchen, findDairyStation } = require('../src/kitchen/layout.ts');
const { getDayConfig } = require('../src/game/levels.ts');
const { CUP_GLASS, CUP_GLASS_ART } = require('../src/art/frontalCupArt.ts');
const { CUP_CREAM } = require('../src/art/kitchenArt.ts');
const { CUP_CREAM_ART } = require('../src/kitchen/creamPainter.ts');
const { CUP_ART, CUP_BASE, CUP_FOOT, CUP_FLOOR_FRONT } = require('../src/art/cupGeometry.ts');

// Refined materials must remain high-resolution transparent sources with correctly registered bands.
assert(CUP_ART.h / CUP_ART.w > 1.5, 'The playable cup keeps its tall frontal silhouette');
for (const [asset, art] of [[CUP_CREAM, CUP_CREAM_ART]]) {
  const png = fs.readFileSync(asset);
  assert.equal(png.readUInt32BE(16), art.width);
  assert.equal(png.readUInt32BE(20), art.height);
  assert.equal(png[25], 6, 'Glass and cream retain their original RGBA transparency');
  assert(art.width >= CUP_ART.w * 4, 'Material detail comes from high-resolution art');
  assert(PRELOAD.includes(asset), 'The cup material is loaded before play');
}
const glassPng = fs.readFileSync(CUP_GLASS);
assert.equal(glassPng.readUInt32BE(16), CUP_GLASS_ART.width);
assert.equal(glassPng.readUInt32BE(20), CUP_GLASS_ART.height);
assert.equal(glassPng[25], 6, 'The reference parts keep their painted RGBA transparency');
assert(PRELOAD.includes(CUP_GLASS), 'The reference cup is loaded before play');
assert.equal(CUP_FOOT, CUP_BASE.y, 'The cup stands at the center of its base footprint');
const baseGap = CUP_BASE.y + CUP_BASE.ry - CUP_FLOOR_FRONT;
assert(baseGap >= 2.5 && baseGap <= 3.5,
  'A small clear plastic base remains below the tea');
assert(CUP_CREAM_ART.left >= 0 && CUP_CREAM_ART.right <= CUP_CREAM_ART.width);
assert(CUP_CREAM_ART.top < CUP_CREAM_ART.contact && CUP_CREAM_ART.contact < CUP_CREAM_ART.bottom
  && CUP_CREAM_ART.bottom <= CUP_CREAM_ART.height, 'The complete cream silhouette and wet contact fit the source');

// Shelf additions must preserve the original overhead painting byte for byte.
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ROOM_BG)).digest('hex'),
  '337ef3b9e618cd8eed1686a9bf88f0283f7a2f28a57bf9520d47b3acdaaafdfe',
  'Keep the original room plate available as an untouched design reference');

const roomPng = fs.readFileSync(KITCHEN_ROOM_RENDER);
assert.equal(roomPng.readUInt32BE(16), KITCHEN_ROOM_ART.width);
assert.equal(roomPng.readUInt32BE(20), KITCHEN_ROOM_ART.height);
assert(PRELOAD.includes(KITCHEN_ROOM_RENDER), 'The continuous room must load before play');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../src/assets/kitchen/kitchen-room-counter-cups.png'))).digest('hex'),
  'b00a0387aafe06ddb56a187c2b212edae5c12ec15e2e96e6723b977979b7bd5a',
  'The previous painting remains available as an untouched source');
assert(KITCHEN_ROOM_RENDER.endsWith('kitchen-unified.png'), 'The room uses the complete repaint');
for (const file of ['cat-lid-stack.png', 'cat-cup-rack.png', 'cat-straw-box.png',
  'kitchen-room-aligned-trays.png', 'kitchen-room-clear-ice.png', 'kitchen-counter-clear-boards.png', 'kitchen-overhead.png']) {
  assert(!PRELOAD.some(asset => asset.endsWith(file)), `${file}: obsolete room patches must not be loaded`);
}
assert(Math.abs(ROOM_BG_ICE_MACHINE.y - ROOM_BG_TOPPING_SHELF.edges[0].y) < 16,
  'Ice and toppings remain at the same level of the painted counter');
assert.equal(ROOM_BG_EXTRAS.sugar.y, ROOM_BG_ICE_MACHINE.y + ROOM_BG_ICE_MACHINE.height + 8);
assert(KITCHEN_BOARDS[0].x > ROOM_BG_ICE_MACHINE.x + ROOM_BG_ICE_MACHINE.width + 80,
  'The boards clear the ice/sugar station');
assert(KITCHEN_BOARDS[1].x > KITCHEN_BOARDS[0].x + KITCHEN_BOARDS[0].width + 12,
  'Both boards have a visible marble gap');

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
