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

/**
 * The stand the pans are set into, painted whole — frame, back wall, deck and its own `Topping`
 * sign, which is why no sign is drawn over this one the way it is over the tea shelf. Cut off
 * `tools/sheets/topping-stand.png` by `tools/cut-topping-stand.ps1`.
 */
export const TOPPING_STAND = require('../../assets/kitchen/topping-stand.png');

/** Where that stand takes its pans, in fractions of its own sprite. */
export const STAND = {
  /**
   * The two bands of deck a row of pans stands on, back then front. `feet` is the line their feet
   * are on and `x0`/`x1` the run of deck they divide — wider at the front than at the back,
   * because the deck is painted going away from you. The deck is shallower than two pans are
   * tall, so the front band overlaps the back one by about a fifth and is drawn over it, which is
   * what a second row behind a first one looks like anyway.
   */
  rows: [
    { feet: 0.52, x0: 0.13, x1: 0.8 },
    { feet: 0.768, x0: 0.104, x1: 0.828 },
  ],
  /** The back of the deck, which is as deep as a single row of pans may get. */
  deck: 0.346,
  /** How many pans a band holds before the day's range needs a wider one. */
  across: 3,
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
/**
 * The prep room itself, painted whole. It used to be built out of fittings — a tiled wall, a
 * shelf plank, a stainless bar, a run of cabinet fronts — each stretched across the room and
 * each needing its own line computed; now it is one plate and the fittings are simply in it.
 */
export const ROOM_BG = require('../../assets/kitchen/room-bg.png');

/**
 * Where that plate draws its surfaces, in its own 940x1674 pixels. Nothing in the room is
 * measured in fractions of the phone any more: a station stands on the line the painting puts
 * under it, projected through `fitRoom`. Re-cut the plate and these are what to re-measure.
 */
export const ROOM = {
  width: 940,
  height: 1674,
  /**
   * The open shelf across the top: `board` is where its own top board begins — the face a sign
   * is mounted on — `top` the ceiling of the recess under it, and `base` the board things stand
   * on.
   */
  shelf: { x0: 48, x1: 586, board: 309, top: 376, base: 512 },
  /** The tiled recess under it, and the ledge in front of the fridge at the same height. */
  alcove: { top: 566, base: 744 },
  ledge: { x0: 617, top: 560, base: 740 },
  /** The work top through the middle: where a cup stands on it, and the edge it turns down at. */
  table: { top: 820, stand: 900, base: 918 },
  /** The lower counter in front of that, a step down and nearer the viewer. */
  bench: { top: 1040, base: 1072 },
  /** The pink units at the foot of the room, and the tiled floor in front of them. */
  cabinets: 1376,
  floor: 1510,
};

/**
 * The tea station, opened: its frame, the board its sign is painted on, the three shelves and
 * the work top under them, all in one plate. Cut off `tools/sheets/tea-room.png` by
 * `cut-sheets.py`, which lifts it off the black it is painted on so its rounded corners and the
 * vines hanging past them read against the room behind.
 */
export const TEA_BG = require('../../assets/kitchen/tea-room.png');

/**
 * The greenery down either side of that window, cut back out of it by `tools/cut-tea-front.ps1`
 * so it can be drawn a second time *over* the jars. The vines and the potted plant hang in front
 * of the shelves, and a jar swiped out to either end of the shelf was climbing over them; these
 * are the plate's own pixels, so laid back over the plate they cannot be seen at all.
 */
export const TEA_FRONT = {
  left: require('../../assets/kitchen/tea-front-left.png'),
  right: require('../../assets/kitchen/tea-front-right.png'),
};

/**
 * Where that plate draws its surfaces, in its own 1156x1286 pixels — the same arrangement as
 * `ROOM` above, and re-measure these if the plate is re-cut. The sprite is the window *and* what
 * hangs past it, so the frame itself is `panel`.
 */
export const TEA_ROOM = {
  width: 1156,
  height: 1286,
  /** The frame, inside the sprite: the sign board stands above its top edge and the vines past
   *  its corners. */
  panel: { x0: 2, x1: 1153, top: 30, base: 1283 },
  /** The face of that sign board, which the station's name is written across. */
  sign: { x0: 325, x1: 835, top: 14, base: 120 },
  /**
   * The three boards, top to bottom. A board's top face is painted as a lit strip seen from a
   * little above — 567 to 589 on the middle one — and `stand` is the *front* of that strip, where
   * a thing standing on the board has its feet. Standing it on the back edge, against the wall,
   * reads as floating behind the board rather than on it. `base` is the foot of the board, which
   * is what the shelf above has to clear.
   */
  shelves: [
    { stand: 313, base: 353 },
    { stand: 586, base: 625 },
    { stand: 842, base: 876 },
  ],
  /** The work top: its back edge, the line a cup stands on, and the edge it turns down at. */
  table: { top: 960, stand: 1080, front: 1116 },
  /**
   * The cup, in the middle of the work top. It is taller than the gap above that top because it
   * stands in *front* of the shelves rather than under them, which is also why it is drawn after
   * them.
   */
  cup: { cx: 578, stand: 1080, height: 280 },
  /** The face of the card on the right, which the measure is drawn on. */
  board: { x0: 900, x1: 1115, top: 755, base: 960 },
  /** The button that shuts the window, over the frame's top right corner. */
  shut: { cx: 1070, cy: 110, d: 111 },
  /** Where each `TEA_FRONT` sprite came off the plate, which is where it goes back. */
  front: {
    left: { x: 10, y: 22, w: 296, h: 878 },
    right: { x: 853, y: 22, w: 292, h: 669 },
  },
};

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
  stand: 760 / 454,
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

