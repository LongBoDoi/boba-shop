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

/**
 * A topping, three ways. `BIN` is the **whole bin** — steel tray, what is in it and the scoop
 * standing in it — cut off `tools/sheets/topping-bins.png` by `bins()` in `tools/cut-sheets.py`,
 * and laid over one of the six empty bins the room's own plate paints. `SCOOPFUL` is the scoop of
 * it you carry to the cup and `PIECE` one piece for the pile that lands in the drink; both come
 * off `tools/sheets/toppings.png`. None of it is drawn in code — the bin used to be a loose heap
 * tiled across the opening and clipped to it, and the scoop the bare `SCOOP` sprite with pieces
 * laid into its bowl by hand; the design draws both better than any arrangement of parts did.
 */
export const BIN: Record<string, number> = {
  pearls: require('../../assets/kitchen/bin-pearls.png'),
  popping: require('../../assets/kitchen/bin-popping.png'),
  pudding: require('../../assets/kitchen/bin-pudding.png'),
  pandan: require('../../assets/kitchen/bin-pandan.png'),
  lychee: require('../../assets/kitchen/bin-lychee.png'),
  grass: require('../../assets/kitchen/bin-grass.png'),
};

/** A bin with nothing in it, for a place on the tray the week has not reached yet. It is cut into
 *  the same box as the full ones, so every bin on the tray is exactly the same size. */
export const BIN_EMPTY = require('../../assets/kitchen/bin-empty.png');

export const SCOOPFUL: Record<string, number> = {
  pearls: require('../../assets/kitchen/scoop-pearls.png'),
  popping: require('../../assets/kitchen/scoop-popping.png'),
  pudding: require('../../assets/kitchen/scoop-pudding.png'),
  pandan: require('../../assets/kitchen/scoop-pandan.png'),
  lychee: require('../../assets/kitchen/scoop-lychee.png'),
  grass: require('../../assets/kitchen/scoop-grass.png'),
};

export const PIECE: Record<string, number> = {
  pearls: require('../../assets/kitchen/piece-pearls.png'),
  popping: require('../../assets/kitchen/piece-popping.png'),
  pudding: require('../../assets/kitchen/piece-pudding.png'),
  pandan: require('../../assets/kitchen/piece-pandan.png'),
  lychee: require('../../assets/kitchen/piece-lychee.png'),
  grass: require('../../assets/kitchen/piece-grass.png'),
  ice: require('../../assets/kitchen/piece-ice.png'),
};

/** Each piece's own proportions, so a pearl stays round and a cube stays square. */
export const PIECE_ART: Record<string, number> = {
  pearls: 96 / 93,
  popping: 96 / 95,
  pudding: 87 / 96,
  pandan: 88 / 96,
  lychee: 96 / 95,
  grass: 89 / 96,
  ice: 31 / 35,
};

/** And each scoopful's, since what is heaped over the bowl differs from topping to topping. */
export const SCOOP_ART: Record<string, number> = {
  pearls: 262 / 307,
  popping: 269 / 307,
  pudding: 265 / 307,
  pandan: 268 / 307,
  lychee: 264 / 307,
  grass: 245 / 306,
};

/**
 * How far down a bin sprite the tray's own rim begins — above it is the scoop standing in the
 * bin, which reaches well over the back of it. The station lines *this* line up with the painted
 * bin's rim, not the top of the sprite.
 */
export const BIN_HEAD = 0.1713;

/** The ice pan, which is the last of the old pans the room still stands on its bench. */
export const ICE_PAN = require('../../assets/kitchen/pan-ice.png');

// ------------------------------------------------------------------ the room around it
/**
 * The prep room itself, painted whole. It used to be built out of fittings — a tiled wall, a
 * shelf plank, a stainless bar, a run of cabinet fronts — each stretched across the room and
 * each needing its own line computed; now it is one plate and the fittings are simply in it.
 */
export const ROOM_BG = require('../../assets/kitchen/room-bg.png');

/**
 * Where that plate draws its surfaces, in its own 941x1672 pixels. Nothing in the room is
 * measured in fractions of the phone any more: a station stands on the line the painting puts
 * under it, projected through `fitRoom`. Re-cut the plate and these are what to re-measure.
 */
export const ROOM = {
  width: 941,
  height: 1672,
  /**
   * The open shelf across the top: `board` is where its own top board begins — the face a sign
   * is mounted on — `top` the ceiling of the recess under it, and `base` the board things stand
   * on. `x0`/`x1` are the back wall of the recess, which is narrower than the board in front of
   * it; a jar standing between them is plainly inside the shelf rather than lapping over its end.
   */
  shelf: { x0: 42, x1: 581, board: 309, top: 373, base: 506 },
  /** The tiled recess under it, and the ledge in front of the fridge at the same height. Both
   *  `base` lines are the *front* of the board's lit top face, where a thing standing on it has
   *  its feet — the back edge, against the wall, reads as floating behind the board. */
  alcove: { top: 556, base: 743 },
  ledge: { x0: 613, top: 516, base: 685 },
  /** The work top through the middle: where a cup stands on it, and the edge it turns down at. */
  table: { top: 789, stand: 870, base: 888 },
  /** The lower counter in front of that, a step down and nearer the viewer. */
  bench: { top: 1005, base: 1035 },
  /**
   * The open cubby under the fridge, inside its own frame, which the topping bins stand in. Each
   * bin is a whole sprite of its own (`BIN`) and this box is what the grid of them is fitted to:
   * `x0`/`x1` is the run they fill across, `top` the line the **back** row's trays have their
   * tops on, and `base` the front lip of the floor, which the **front** row's trays have their
   * feet on. The depth between the two is what the two rows divide.
   *
   * `top` is set a little below the cubby's own ceiling (691). Taken right up to it the back row
   * rides high in the cubby, its scoops crowding the board above, and the tray reads as two
   * shelves rather than one set of bins.
   */
  tray: { x0: 613, x1: 900, top: 700, base: 825 },
  /** The pink units at the foot of the room, and the tiled floor in front of them. */
  cabinets: 1339,
  floor: 1463,
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
  bin: 256 / 226,
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

