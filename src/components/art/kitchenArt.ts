/**
 * The painted kitchen, sprite by sprite, plus the geometry the code needs to line up with it.
 * Everything here is cut from `tools/sheets/` by `tools/cut-sheets.py` — read that script before
 * adding to this one. Sprites that something is drawn *through* (a dispenser's glass, the cup) have
 * a window cleared out of them; the fractions for those are at the bottom of this file.
 */

// ------------------------------------------------------------------ what you work with
export const JAR = require('../../assets/kitchen/jar.png');
export const CUP_SPRITE = require('../../assets/kitchen/cup.png');
export const CUP_BASE = require('../../assets/kitchen/cup-base.png');
export const SCOOP = require('../../assets/kitchen/scoop.png');
export const SYRUP = require('../../assets/kitchen/syrup.png');

export const MILK: Record<string, number> = {
  whole: require('../../assets/kitchen/milk-whole.png'),
  oat: require('../../assets/kitchen/milk-oat.png'),
};

export const FOAM: Record<string, number> = {
  cheese: require('../../assets/kitchen/foam-cheese.png'),
  brulee: require('../../assets/kitchen/foam-brulee.png'),
};

export const PAN: Record<string, number> = {
  pearls: require('../../assets/kitchen/pan-pearls.png'),
  popping: require('../../assets/kitchen/pan-popping.png'),
  lychee: require('../../assets/kitchen/pan-lychee.png'),
  pudding: require('../../assets/kitchen/pan-pudding.png'),
  grass: require('../../assets/kitchen/pan-grass.png'),
  redbean: require('../../assets/kitchen/pan-redbean.png'),
  ice: require('../../assets/kitchen/pan-ice.png'),
};

/** One of whatever is in a pan — for the scoop you carry and the pile in the cup. */
export const PIECE: Record<string, number> = {
  pearls: require('../../assets/kitchen/piece-pearl.png'),
  popping: require('../../assets/kitchen/piece-popping.png'),
  lychee: require('../../assets/kitchen/piece-ice.png'),
  pudding: require('../../assets/kitchen/piece-cube.png'),
  grass: require('../../assets/kitchen/piece-grass.png'),
  redbean: require('../../assets/kitchen/piece-redbean.png'),
  ice: require('../../assets/kitchen/piece-ice.png'),
};

/** Each piece's own proportions, so a pearl stays round and a cube stays square. */
export const PIECE_ART: Record<string, number> = {
  pearls: 37 / 36,
  popping: 39 / 38,
  lychee: 31 / 35,
  pudding: 35 / 41,
  grass: 35 / 41,
  redbean: 37 / 36,
  ice: 31 / 35,
};

// ------------------------------------------------------------------ the room around it
export const WALL = require('../../assets/kitchen/wall.png');
export const LAMP = require('../../assets/kitchen/lamp.png');
export const SHELF = require('../../assets/kitchen/shelf.png');
export const COUNTER_STEEL = require('../../assets/kitchen/counter-steel.png');
export const CABINET = require('../../assets/kitchen/cabinet.png');
export const DRAWER = require('../../assets/kitchen/drawer.png');
export const RAIL = require('../../assets/kitchen/rail.png');
export const COASTER = require('../../assets/kitchen/coaster.png');
export const PLANT = require('../../assets/kitchen/plant.png');
export const POSTER = require('../../assets/kitchen/poster.png');
export const CHALKBOARD = require('../../assets/kitchen/chalkboard.png');
export const SUCCULENT = require('../../assets/kitchen/succulent.png');
export const CUP_STACK = require('../../assets/kitchen/cup-stack.png');
export const STRAWS = require('../../assets/kitchen/straws.png');
export const TOWEL = require('../../assets/kitchen/towel.png');
export const CARD = require('../../assets/kitchen/card.png');
export const ICON_TRASH = require('../../assets/kitchen/icon-trash.png');
export const ICON_CUP = require('../../assets/kitchen/icon-cup.png');

/** Width ÷ height of every sprite, so nothing gets squashed by accident. */
export const ART = {
  jar: 191 / 321,
  cup: 133 / 199,
  pan: 228 / 232,
  scoop: 102 / 64,
  milk: 99 / 157,
  syrup: 77 / 167,
  foam: 150 / 149,
  card: 130 / 229,
  wall: 176 / 145,
  lamp: 108 / 161,
  shelf: 194 / 55,
  counter: 211 / 104,
  cabinet: 246 / 112,
  rail: 286 / 53,
  coaster: 151 / 77,
  plant: 144 / 215,
  poster: 116 / 168,
  chalkboard: 146 / 165,
  succulent: 66 / 129,
  cupStack: 124 / 225,
  straws: 129 / 154,
  towel: 154 / 142,
};

// ------------------------------------------------------------------ where things line up
/** The cleared glass of a dispenser, as fractions of its sprite. */
export const JAR_WINDOW = { x: 24 / 191, y: 88 / 321, w: 157 / 191, h: 175 / 321 };
/** How full a dispenser looks on the shelf, and how far down it lets go of the tea. */
export const JAR_LEVEL = 0.86;
export const JAR_SPOUT = 0.87;
/** The bowl of the carried scoop — what you picked up is heaped here. */
export const SCOOP_BOWL = { cx: 0.34, cy: 0.57, r: 0.17 };
