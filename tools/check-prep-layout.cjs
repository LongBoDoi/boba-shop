'use strict';
/*
 * The sideways prep page: whichever arrangement a screen gets, the room it leaves must still show
 * the whole of the painting's working band — the crowns of the tea tanks down to the front of the
 * cup's mat. Cropping that band is what put the order panel over the tanks' lids, which is the
 * bug this pins. Run with node tools/check-prep-layout.cjs.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// kitchenArt.ts names its sprites by importing them; the measurements are all this needs.
for (const ext of ['.png', '.jpg', '.webp', '.svg', '.woff2', '.wav', '.mp3']) {
  require.extensions[ext] = (module) => module._compile('module.exports = "asset";', 'asset');
}
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const { ROOM_BG_KEEP, ROOM_BG_REACH, ROOM_BG_SIZE, ROOM_BG_FOCUS_Y, ROOM_BG_TABLE, ROOM_BG_EXTRAS } = require(path.join(__dirname, '../src/art/kitchenArt.ts'));
const { CUP_SEAT_DEPTH, HOLDER_SEAT } = require('../src/art/referenceCupArt.ts');
const { layoutKitchen } = require('../src/kitchen/layout.ts');
const { getDayConfig } = require('../src/game/levels.ts');
const { CUP_ART, CUP_FOOT } = require('../src/art/cupGeometry.ts');
const {
  ASK_HEIGHT, ASK_MIN_HEIGHT, askHeightFor, isWideLayout, ORDER_CARD_PAD, ORDER_TRACK_HEIGHT, overtimeDockRight, panelWidthFor,
  prepLayoutFor, PREP_BAND_HEIGHT, PREP_ACTIONS_HEIGHT, SHORT_CARD, SIDEWAYS_MIN_WIDTH,
} = require(path.join(__dirname, '../src/ui/responsive.ts'));
const { isWideLayout: counterIsWide } = require('../src/counter/layout.ts');

/** The box the kitchen canvas gets, in each arrangement — `PrepPage.tsx`'s own boxes. */
function roomFor(width, pageHeight) {
  const layout = prepLayoutFor(width, width / 2, pageHeight); // sideways: the height only gates `stacked`
  if (layout === 'band') return { layout, width, height: pageHeight - PREP_BAND_HEIGHT - PREP_ACTIONS_HEIGHT };
  const panel = panelWidthFor(width, pageHeight);
  // Past half of the screen the card stops buying the room back; see `panelWidthFor`.
  return { layout, panel, capped: panel >= Math.round(width * 0.5), width: width - panel, height: pageHeight };
}

/** What of the plate is on screen, by `fitBackground`'s own arithmetic: cover, working band centred. */
function visiblePlate(width, height) {
  const scale = Math.max(width / ROOM_BG_SIZE.width, height / ROOM_BG_SIZE.height);
  const top = Math.min(0, Math.max(height - ROOM_BG_SIZE.height * scale, height / 2 - ROOM_BG_FOCUS_Y * scale));
  return { top: -top / scale, bottom: (height - top) / scale };
}

const holds = (band, seen) => seen.top <= band.top + 0.5 && seen.bottom >= band.bottom - 0.5;

// ------------------------------------------------------- every shape the game is actually played at
// Width and the pager's height (the screen less the HUD and the tabs, ~75px).
const SHAPES = [
  ['the shortest phone on its side', 568, 245],
  ['a small phone on its side', 667, 297],
  ['a Galaxy S8 on its side', 740, 285],
  ['a Plus phone on its side', 736, 339],
  ['a phone on its side', 844, 315],
  ['a big phone on its side', 932, 355],
  ['the window this was reported from', 1284, 535],
  ['an iPad mini', 1133, 669],
  ['an 11" iPad', 1194, 759],
  ['a 12.9" iPad', 1366, 949],
  ['a desktop window', 1512, 780],
];
for (const [what, width, pageHeight] of SHAPES) {
  const room = roomFor(width, pageHeight);
  const seen = visiblePlate(room.width, room.height);
  assert.ok(room.height > 0, `${what}: the room has height`);
  assert.ok(holds(ROOM_BG_KEEP, seen),
    `${what} (${room.layout}, room ${Math.round(room.width)}x${Math.round(room.height)}) keeps the whole painting: `
    + `${seen.top.toFixed(0)}..${seen.bottom.toFixed(0)} of ${ROOM_BG_KEEP.top.toFixed(0)}..${ROOM_BG_KEEP.bottom}`);
}

// ------------------------------------------------------- and every shape at all, down to the workable band
// A squat enough window cannot hold the whole painting however the chrome is arranged; what it may
// never lose is the band the shift is worked in — the name tags down to the line the cup stands on.
for (let width = SIDEWAYS_MIN_WIDTH; width <= 2400; width += 20) {
  for (let pageHeight = 200; pageHeight <= 1200; pageHeight += 20) {
    if (!isWideLayout(width, pageHeight + 75)) continue;
    const room = roomFor(width, pageHeight);
    const seen = visiblePlate(room.width, room.height);
    const where = `${width}x${pageHeight} (${room.layout}, room ${Math.round(room.width)}x${Math.round(room.height)})`;
    assert.ok(room.width >= width * 0.5 - 1, `${where}: the card never takes the room over`);
    // A window squat enough to need more than half of its width given to the card is past
    // helping — there the rule is only that the card has taken everything the cap allows.
    if (room.capped) assert.ok(room.panel === Math.round(width * 0.5), `${where}: the card is at its ceiling`);
    else assert.ok(holds(ROOM_BG_REACH, seen), `${where} keeps the workable band`);
    // The band is only taken when it costs the painting nothing.
    if (room.layout === 'band') assert.ok(holds(ROOM_BG_KEEP, seen), `${where} keeps the whole painting`);
  }
}

// ------------------------------------------------------- a phone on its side is laid out on its side
// A window under the old 760 stayed `stacked` however short it was: the card and the buttons took the
// height, and an iPhone 8 sideways was left a room 72px tall with its tanks above the top of it.
for (const [width, height] of [[568, 320], [640, 360], [667, 375], [736, 414], [740, 360], [760, 360]]) {
  assert.equal(prepLayoutFor(width, height, height - 75), 'column', `${width}x${height} stands the order beside the room`);
  const room = roomFor(width, height - 75);
  assert.ok(room.width >= 320 && room.height >= 240, `${width}x${height} keeps a room to work in, ${room.width}x${room.height}`);
}
assert.equal(prepLayoutFor(375, 667, 590), 'stacked', 'A phone held upright is still upright');
assert.equal(prepLayoutFor(558, 300, 225), 'stacked', 'Anything narrower has no width to stand a card beside the room');
// The counter keeps its own copy of this test, so that a scene need not import the interface's module.
for (let width = 400; width <= 1000; width += 4) {
  for (const height of [320, 375, 430, 600, 900]) {
    assert.equal(counterIsWide(width, height), isWideLayout(width, height), `The two pages agree on ${width}x${height}`);
  }
}

// ------------------------------------------------------- the overtime dock leaves the order alone
// The column's card grows into all the height the column has, so a dock standing in it stands on the
// order: at 932x430 it hid the last tile of a long one. Its right edge is in the room, in every shape.
for (const [what, width, pageHeight] of [...SHAPES, ['the reported phone', 932, 352]]) {
  const room = roomFor(width, pageHeight);
  const right = overtimeDockRight(room.layout, width, pageHeight);
  if (room.layout === 'column') assert.ok(right > room.panel, `${what}: the dock stands beside the column, not in it`);
  assert.ok(right < width / 2 + 20, `${what}: and has the room to stand in`);
}
assert.ok(overtimeDockRight('stacked', 390, 700) < 20, 'Upright it stands at the edge of the screen');

// ------------------------------------------------------- the card is as narrow as it can be read at
assert.equal(prepLayoutFor(390, 844, 700), 'stacked', 'upright is upright');
assert.ok(panelWidthFor(932, 355) <= 932 * 0.5, 'the taller overhead worktop fits within the column ceiling');
assert.ok(panelWidthFor(1284, 535) <= 1284 * 0.5, 'the tall rack fits while the kitchen keeps at least half the screen');
for (const width of [760, 900, 1284, 1600, 2400]) {
  const panel = panelWidthFor(width, width / 3);
  assert.ok(panel >= 248, `${width}: the card is still readable (${panel})`);
  assert.ok(panel <= Math.max(248, width * 0.5) + 1, `${width}: the card is still a card (${panel})`);
}

// One cup mat fits on the free marble, clear of the syrup tray and counter's front edge.
for (const [width, height] of [[390, 540], [375, 330], [450, 315], [500, 355], [974, 724]]) {
  for (const size of ['S', 'M', 'L']) {
    const layout = layoutKitchen(getDayConfig(1), width, height, size);
    const { holder, room } = layout;
    assert(!('finishHolder' in layout), 'Preparation and finishing share one mat');
    assert(holder.left > (ROOM_BG_EXTRAS.sugar.x + ROOM_BG_EXTRAS.sugar.width) * room.scale,
      'The mat leaves the sugar tray clear');
    assert(holder.left >= 0 && holder.left + holder.width <= width, 'The entire mat stays on screen');
    assert(holder.top >= room.top + ROOM_BG_TABLE.top * room.scale, 'The mat rests on clear worktop');
    assert(holder.top + holder.height < Math.min(height, room.top + ROOM_BG_TABLE.base * room.scale),
      'The mat leaves space before the counter front');
    assert(holder.width > layout.cupW, `${size}: the mat has space around the cup`);
    assert(Math.abs(layout.homeX + layout.cupW / 2 - holder.left - holder.width * HOLDER_SEAT.x) < 1e-7);
    assert(Math.abs(layout.homeY + layout.cupH * (CUP_FOOT - CUP_SEAT_DEPTH) / CUP_ART.h - holder.top - holder.height * HOLDER_SEAT.y) < 1e-7,
      'The cup settles into the measured silicone seat, behind its near lip');
  }
}

// ------------------------------------------------------- Hỏi lại in a short side column
// The tiles' row a column of `space` leaves a card with a queue, which has the tallest head there is.
const QUEUE_HEAD = 48;
const tileRoomIn = (space) => space - ORDER_CARD_PAD * 2 - 4 - QUEUE_HEAD - ORDER_TRACK_HEIGHT;
const SHORT_FLOOR = 2 + SHORT_CARD.top + QUEUE_HEAD + SHORT_CARD.gap + ASK_MIN_HEIGHT + SHORT_CARD.bottom + 2;
assert.equal(ASK_HEIGHT, Number(fs.readFileSync(path.join(__dirname, '../src/ui/ui.css'), 'utf8').match(/\.ask-again \{[^}]*?\n\s*height: (\d+)px/)[1]), 'The stylesheet and the arithmetic agree on the button');
assert.equal(askHeightFor(tileRoomIn(134)), null, 'A column with the room keeps the card as it stands');
assert.equal(askHeightFor(tileRoomIn(133)), ASK_HEIGHT, 'One pixel short gives up the empty bar and keeps the button whole');
for (let space = SHORT_FLOOR; space < 134; space++) {
  const height = askHeightFor(tileRoomIn(space));
  assert(height >= ASK_MIN_HEIGHT && height <= ASK_HEIGHT, 'It is a button you can read and press');
  assert(2 + SHORT_CARD.top + QUEUE_HEAD + SHORT_CARD.gap + height + SHORT_CARD.bottom + 2 <= space,
    `All of it is on the card in a column ${space}px tall, which is what clipped it`);
}
// A window that short is the screen's height less 224px: 320 tall leaves 96, on a phone with its browser's bars up.
assert(SHORT_FLOOR <= 96, `A 320px window still has the whole button (${SHORT_FLOOR})`);
assert.equal(askHeightFor(tileRoomIn(40)), ASK_MIN_HEIGHT, 'Past that it stops at what can be read, which is the column being past helping');
console.log('check-prep-layout: the painting stays visible, the card fits, and one shared mat holds S/M/L on the clear worktop.');
