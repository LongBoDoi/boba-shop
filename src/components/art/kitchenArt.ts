/**
 * The painted kitchen, sprite by sprite, plus the geometry the code needs to line up with it.
 * Everything here is cut from `tools/sheets/` by `tools/cut-sheets.py` — read that script before
 * adding to this one. Sprites that something is drawn *through* (a dispenser's glass, the cup) have
 * a window cleared out of them; the fractions for those are at the bottom of this file.
 */


// ------------------------------------------------------------------ what you work with
/**
 * A dispenser, full, one sprite per tea — the whole thing, glass and tea together, cut off the
 * design sheet by `tools/cut-tea-jars.ps1`. The tea is not drawn in code: its oval surface, its
 * even body and the way it runs to the foot behind the tap are all painted, and every attempt to
 * reproduce them with a gradient came out wrong.
 */
/**
 * The drink standing in a cup, cut off `tools/sheets/cup-design.png` by `tools/cut-cup-design.ps1`.
 * As with the dispensers, none of it is drawn in code — these are the design's own *full* cup,
 * glass and all, which is why the cup is drawn first and the drink laid over it rather than behind.
 *
 * It comes in two pieces because the level moves: `DRINK` is the glass filled to the brim and cut
 * to the shape of the well, which the cup reveals from the bottom up, and `DRINK_TOP` is the oval
 * surface alone, which the cup stands on that reveal line and stretches to however wide the glass
 * is there. Revealing a sprite with the oval already in it would slice the oval off flat at every
 * level but full. The cat is left out of both, because the cup underneath has its own.
 */
export const DRINK: Record<string, number> = {
  black: require('../../assets/kitchen/drink-black.png'),
  green: require('../../assets/kitchen/drink-green.png'),
  thai: require('../../assets/kitchen/drink-thai.png'),
  oolong: require('../../assets/kitchen/drink-oolong.png'),
  taro: require('../../assets/kitchen/drink-taro.png'),
  matcha: require('../../assets/kitchen/drink-matcha.png'),
};
export const DRINK_MILKY: Record<string, number> = {
  black: require('../../assets/kitchen/drink-black-milky.png'),
  green: require('../../assets/kitchen/drink-green-milky.png'),
  thai: require('../../assets/kitchen/drink-thai-milky.png'),
  oolong: require('../../assets/kitchen/drink-oolong-milky.png'),
  taro: require('../../assets/kitchen/drink-taro-milky.png'),
  matcha: require('../../assets/kitchen/drink-matcha-milky.png'),
};

export const DRINK_TOP: Record<string, number> = {
  black: require('../../assets/kitchen/drink-black-top.png'),
  green: require('../../assets/kitchen/drink-green-top.png'),
  thai: require('../../assets/kitchen/drink-thai-top.png'),
  oolong: require('../../assets/kitchen/drink-oolong-top.png'),
  taro: require('../../assets/kitchen/drink-taro-top.png'),
  matcha: require('../../assets/kitchen/drink-matcha-top.png'),
};
export const DRINK_MILKY_TOP: Record<string, number> = {
  black: require('../../assets/kitchen/drink-black-milky-top.png'),
  green: require('../../assets/kitchen/drink-green-milky-top.png'),
  thai: require('../../assets/kitchen/drink-thai-milky-top.png'),
  oolong: require('../../assets/kitchen/drink-oolong-milky-top.png'),
  taro: require('../../assets/kitchen/drink-taro-milky-top.png'),
  matcha: require('../../assets/kitchen/drink-matcha-milky-top.png'),
};

export const JAR_TEA: Record<string, number> = {
  black: require('../../assets/kitchen/jar-black.png'),
  green: require('../../assets/kitchen/jar-green.png'),
  thai: require('../../assets/kitchen/jar-thai.png'),
  oolong: require('../../assets/kitchen/jar-oolong.png'),
  taro: require('../../assets/kitchen/jar-taro.png'),
  matcha: require('../../assets/kitchen/jar-matcha.png'),
};
export const CUP_SPRITE = require('../../assets/kitchen/cup.png');
export const CUP_BASE = require('../../assets/kitchen/cup-base.png');
/**
 * The cat printed on the *front* of the cup, cut out of the glass so it can be laid over the
 * drink. Left in the glass it sits behind, and the drink pours straight over it.
 */
/**
 * The cup's dark linework, cut out so it can be laid over the drink. The drink runs down to the
 * foot of the glass and crosses the outline round the base; with the outline only underneath, the
 * drink covers some of it and not the rest, which reads as stray marks down there.
 */
export const CUP_EDGE = require('../../assets/kitchen/cup-edge.png');
export const CUP_DECAL = require('../../assets/kitchen/cup-decal.png');
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
export const SHELF_PLANK = require('../../assets/kitchen/shelf-plank.png');
export const PLANK_TOP = require('../../assets/kitchen/plank-top.png');
export const SHELF_FOOT = require('../../assets/kitchen/shelf-foot.png');
/** The pack's stainless counter, sliced across: its raised back, its deck, its front edge. */
export const BAR_SPLASH = require('../../assets/kitchen/bar-splash.png');
export const BAR_DECK = require('../../assets/kitchen/bar-deck.png');
export const BAR_FRONT = require('../../assets/kitchen/bar-front.png');
/** The pink units along the floor: a single at each end, a double in the middle. Their fronts
 *  alone — the steel top each ships with would stand under the counter's front as a second
 *  ledge. */
export const DRAWER = require('../../assets/kitchen/drawer-front.png');
export const CABINET = require('../../assets/kitchen/cabinet-front.png');
export const RAIL_CAP = require('../../assets/kitchen/rail-cap.png');
export const RAIL_BAR = require('../../assets/kitchen/rail-bar.png');
export const RAIL_CLIP = require('../../assets/kitchen/rail-clip.png');
export const COASTER = require('../../assets/kitchen/coaster.png');
export const PLANT = require('../../assets/kitchen/plant.png');
export const POSTER = require('../../assets/kitchen/poster.png');
export const CUP_STACK = require('../../assets/kitchen/cup-stack.png');
/** The straw tin, the plant and the chalkboard together, cut off the design as one group. */
export const TABLE_PROPS = require('../../assets/kitchen/table-props.png');
export const TOWEL = require('../../assets/kitchen/towel.png');
export const CARD = require('../../assets/kitchen/card.png');
export const CARD_BLANK = require('../../assets/kitchen/card-blank.png');
export const ICON_TRASH = require('../../assets/kitchen/icon-trash.png');
export const ICON_CUP = require('../../assets/kitchen/icon-cup.png');

/** Width ÷ height of every sprite, so nothing gets squashed by accident. */
export const ART = {
  jar: 116 / 205,
  cup: 113 / 174,
  pan: 235 / 239,
  scoop: 102 / 64,
  milk: 99 / 157,
  syrup: 77 / 167,
  foam: 150 / 149,
  card: 130 / 229,
  wall: 176 / 145,
  lamp: 112 / 173,
  plank: 70 / 34,
  foot: 32 / 22,
  railCap: 36 / 53,
  railClip: 56 / 53,
  drawer: 153 / 72,
  cabinet: 246 / 72,
  coaster: 151 / 77,
  plant: 144 / 215,
  poster: 116 / 168,
  cupStack: 124 / 225,
  tableProps: 241 / 264,
  towel: 154 / 142,
};

// ------------------------------------------------------------------ where things line up
/** How far down a dispenser its tap lets go of the tea. */
export const JAR_SPOUT = 0.87;
/**
 * How far down a pan sprite its own rim starts: the top of the sprite is the scoop standing in
 * it, which reaches well above the counter.
 */
export const PAN_BODY = 40 / 239;
/** The bowl of the carried scoop — what you picked up is heaped here. */
export const SCOOP_BOWL = { cx: 0.34, cy: 0.57, r: 0.17 };

