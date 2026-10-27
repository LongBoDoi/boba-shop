import drinkBlack from '../assets/kitchen/drink-black.png';
import drinkGreen from '../assets/kitchen/drink-green.png';
import drinkThai from '../assets/kitchen/drink-thai.png';
import drinkOolong from '../assets/kitchen/drink-oolong.png';
import drinkTaro from '../assets/kitchen/drink-taro.png';
import drinkMatcha from '../assets/kitchen/drink-matcha.png';
import drinkBlackMilky from '../assets/kitchen/drink-black-milky.png';
import drinkGreenMilky from '../assets/kitchen/drink-green-milky.png';
import drinkThaiMilky from '../assets/kitchen/drink-thai-milky.png';
import drinkOolongMilky from '../assets/kitchen/drink-oolong-milky.png';
import drinkTaroMilky from '../assets/kitchen/drink-taro-milky.png';
import drinkMatchaMilky from '../assets/kitchen/drink-matcha-milky.png';
import drinkBlackTop from '../assets/kitchen/drink-black-top.png';
import drinkGreenTop from '../assets/kitchen/drink-green-top.png';
import drinkThaiTop from '../assets/kitchen/drink-thai-top.png';
import drinkOolongTop from '../assets/kitchen/drink-oolong-top.png';
import drinkTaroTop from '../assets/kitchen/drink-taro-top.png';
import drinkMatchaTop from '../assets/kitchen/drink-matcha-top.png';
import drinkBlackMilkyTop from '../assets/kitchen/drink-black-milky-top.png';
import drinkGreenMilkyTop from '../assets/kitchen/drink-green-milky-top.png';
import drinkThaiMilkyTop from '../assets/kitchen/drink-thai-milky-top.png';
import drinkOolongMilkyTop from '../assets/kitchen/drink-oolong-milky-top.png';
import drinkTaroMilkyTop from '../assets/kitchen/drink-taro-milky-top.png';
import drinkMatchaMilkyTop from '../assets/kitchen/drink-matcha-milky-top.png';
import teaDispensers from '../assets/kitchen/tea-dispensers-overhead.png';
import cupCreamPainted from '../assets/kitchen/cup-cream-natural-front.png';
import scoop from '../assets/kitchen/scoop.png';
import foamCheese from '../assets/kitchen/foam-cheese.png';
import foamBrulee from '../assets/kitchen/foam-brulee.png';
import binPearls from '../assets/kitchen/bin-pearls.png';
import binPopping from '../assets/kitchen/bin-popping.png';
import binPudding from '../assets/kitchen/bin-pudding.png';
import binPandan from '../assets/kitchen/bin-pandan.png';
import binLychee from '../assets/kitchen/bin-lychee.png';
import binGrass from '../assets/kitchen/bin-grass.png';
import scoopPearls from '../assets/kitchen/scoop-pearls.png';
import scoopPopping from '../assets/kitchen/scoop-popping.png';
import scoopPudding from '../assets/kitchen/scoop-pudding.png';
import scoopPandan from '../assets/kitchen/scoop-pandan.png';
import scoopLychee from '../assets/kitchen/scoop-lychee.png';
import scoopGrass from '../assets/kitchen/scoop-grass.png';
import scoopIce from '../assets/kitchen/scoop-ice.png';
import piecePearls from '../assets/kitchen/piece-pearls.png';
import piecePopping from '../assets/kitchen/piece-popping.png';
import piecePudding from '../assets/kitchen/piece-pudding.png';
import piecePandan from '../assets/kitchen/piece-pandan.png';
import pieceLychee from '../assets/kitchen/piece-lychee.png';
import pieceGrass from '../assets/kitchen/piece-grass.png';
import pieceIceV2 from '../assets/kitchen/piece-ice-v2.png';
import pieceIceClear from '../assets/kitchen/ice-natural-front.png';
import kitchenOverhead from '../assets/kitchen/kitchen-overhead.png';
import sugarScoop from '../assets/kitchen/liquid-sugar-ladle.png';
import { REFERENCE_CUP, REFERENCE_CUP_PARTS, CUP_DISPLAY_HEIGHT } from './referenceCupArt';
import iconTrash from '../assets/kitchen/icon-trash.png';
import iconCup from '../assets/kitchen/icon-cup.png';

import { TOPPING_PANS, TOPPING_PIECES, TOPPING_SCOOPS } from './toppingArt';
import { EXTENDED_ROOM_SIZE, EXTENDED_TEA_WIDTH, ROOM_EXTRA_HEIGHT } from './roomGeometry';
import {
  KITCHEN_ROOM_RENDER, KITCHEN_ROOM_TRAYS, KITCHEN_ORIGINAL_COUNTER, KITCHEN_ROOM_ART,
  KITCHEN_ROOM_TRAY_RAISE, KITCHEN_ROOM_CLEAR_ICE, KITCHEN_CLEAR_BOARDS,
} from './kitchenRoomArt';
import { TOPPING_TRAY_EDGES } from './toppingGeometry';
import { EQUIPMENT_FRAMES, PAINTED_EQUIPMENT, PAINTED_MILK } from './equipmentArt';
import { CUP_GLASS } from './frontalCupArt';

/**
 * A sprite is the **URL** of its own file. `import cup from '../assets/kitchen/cup.png'` hands one
 * back, and that string is both the key a texture is loaded under and the source it is loaded
 * from — see `tex()` in `game/view.ts`.
 */
export type Sprite = string;

/**
 * The painted kitchen, sprite by sprite, plus the geometry the code needs to line up with it.
 * Most sprites are cut from `tools/sheets/` by `tools/cut-sheets.py` — read that script before
 * adding to this one. Sprites that something is drawn *through* (a dispenser's glass, the cup) have
 * a window cleared out of them; the fractions for those are at the bottom of this file.
 */

// ------------------------------------------------------------------ what you work with
/**
 * Painted drink bodies and oval surfaces cut from the cup design. TeaLiquid reuses these as
 * textures inside the cup and tank, adding live fill geometry, shading and pour ripples.
 * The original glass, edge highlights and cat decal remain separate layers above the liquid.
 */
export const DRINK: Record<string, Sprite> = {
  black: drinkBlack,
  green: drinkGreen,
  thai: drinkThai,
  oolong: drinkOolong,
  taro: drinkTaro,
  matcha: drinkMatcha,
};
export const DRINK_MILKY: Record<string, Sprite> = {
  black: drinkBlackMilky,
  green: drinkGreenMilky,
  thai: drinkThaiMilky,
  oolong: drinkOolongMilky,
  taro: drinkTaroMilky,
  matcha: drinkMatchaMilky,
};

export const DRINK_TOP: Record<string, Sprite> = {
  black: drinkBlackTop,
  green: drinkGreenTop,
  thai: drinkThaiTop,
  oolong: drinkOolongTop,
  taro: drinkTaroTop,
  matcha: drinkMatchaTop,
};
export const DRINK_MILKY_TOP: Record<string, Sprite> = {
  black: drinkBlackMilkyTop,
  green: drinkGreenMilkyTop,
  thai: drinkThaiMilkyTop,
  oolong: drinkOolongMilkyTop,
  taro: drinkTaroMilkyTop,
  matcha: drinkMatchaMilkyTop,
};

/** Painted squat glass reservoirs matching the warm kitchen reference, in one transparent atlas. */
export const TEA_DISPENSERS = teaDispensers;
export const TEA_DISPENSER_ART = {
  imageWidth: 1536, imageHeight: 1024, width: 420, height: 480,
  foot: 0.92, spout: 0.975,
  label: { left: 0.255, top: 0.57, width: 0.49, height: 0.14 },
  cells: {
    black: { x: 64, y: 0 }, green: { x: 557, y: 0 }, thai: { x: 1054, y: 0 },
    oolong: { x: 62, y: 503 }, taro: { x: 557, y: 503 }, matcha: { x: 1054, y: 503 },
  } as Record<string, { x: number; y: number }>,
};
export const CUP_CREAM = cupCreamPainted;
export const SCOOP = scoop;

export const CREAM_CAN_ART = { width: 64, height: 150 };

export const FOAM: Record<string, Sprite> = {
  cheese: foamCheese,
  brulee: foamBrulee,
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
export const BIN: Record<string, Sprite> = {
  pearls: binPearls,
  popping: binPopping,
  pudding: binPudding,
  pandan: binPandan,
  lychee: binLychee,
  grass: binGrass,
};

export const SCOOPFUL: Record<string, Sprite> = {
  pearls: scoopPearls,
  popping: scoopPopping,
  pudding: scoopPudding,
  pandan: scoopPandan,
  lychee: scoopLychee,
  grass: scoopGrass,
  ice: scoopIce,
};

export const PIECE: Record<string, Sprite> = {
  pearls: piecePearls,
  popping: piecePopping,
  pudding: piecePudding,
  pandan: piecePandan,
  lychee: pieceLychee,
  grass: pieceGrass,
  ice: pieceIceV2,
};

/** Clear, softly melted ice used only inside the drink, separate from the scoop and icons. */
export const CUP_ICE = pieceIceClear;

/** And each scoopful's, since what is heaped over the bowl differs from topping to topping. */
export const SCOOP_ART: Record<string, number> = {
  pearls: 262 / 307,
  popping: 269 / 307,
  pudding: 265 / 307,
  pandan: 268 / 307,
  lychee: 264 / 307,
  grass: 245 / 306,
  ice: 256 / 296,
};

/**
 * How far down a bin sprite the tray's own rim begins — above it is the scoop standing in the
 * bin, which reaches well over the back of it. The station lines *this* line up with the painted
 * bin's rim, not the top of the sprite.
 */
export const BIN_HEAD = 0.1713;

// ------------------------------------------------------------------ the room around it
/** Original watercolor plate, retained as the reference for equipment design and anchors. */
export const ROOM_BG = kitchenOverhead;
export const SUGAR_SCOOP = sugarScoop;
export const SUGAR_SCOOP_ART = { width: 400, height: 260 };
/** The gray curled holder is independent of the clear cup and stays on the counter. */
export const CUP_HOLDER = REFERENCE_CUP;
export const CUP_HOLDER_ART = REFERENCE_CUP_PARTS.holder.source;
export const ROOM_BG_SIZE = EXTENDED_ROOM_SIZE;
export const ROOM_BG_TABLE = { top: 740 + ROOM_EXTRA_HEIGHT, base: 1025 + ROOM_EXTRA_HEIGHT };
export const ROOM_BG_TEA_SHELF = {
  x0: 70, x1: 760, tankWidth: EXTENDED_TEA_WIDTH,
  // Both rows stand on the shelving unit; the preparation board below stays clear.
  bases: [310, 610],
  // The catalogue's own order, so the week fills the rack left to right and then down a shelf.
  slots: ['black', 'green', 'thai', 'oolong', 'taro', 'matcha'],
};
/** Painted stations share the room's scrolling coordinates and counter surface. */
// The compact organizer sits directly on the counter, without a long shelf behind it.
export const ROOM_BG_CUP_STATION = {
  x: 910, y: 60 + ROOM_EXTRA_HEIGHT, width: 440, height: 270,
  stackTops: [134, 103, 60].map(y => y + ROOM_EXTRA_HEIGHT),
  // Measured centers beneath the painted stacks, independent of minimum-size touch targets.
  labels: { centers: [985, 1120, 1263], y: 660, width: 60, height: 30 },
};
export const ROOM_BG_ICE_MACHINE = {
  x: 40, y: 629 + ROOM_EXTRA_HEIGHT - KITCHEN_ROOM_TRAY_RAISE * ROOM_BG_SIZE.height / KITCHEN_ROOM_ART.height,
  width: 260, height: 182,
};
export const ROOM_BG_LIDDING = {
  lid: { x: 1440, y: 90 + ROOM_EXTRA_HEIGHT, width: 320, height: 300 },
  straw: { x: 1770, y: 170 + ROOM_EXTRA_HEIGHT, width: 135, height: 220 },
  bay: { x: 1540, y: 208 + ROOM_EXTRA_HEIGHT, width: 142, height: 120, cx: 1605, foot: 320 + ROOM_EXTRA_HEIGHT },
  head: { x: 1510, y: 166 + ROOM_EXTRA_HEIGHT, width: 197, height: 34 },
};
export const ROOM_BG_EXTRAS = {
  // Each pair rests inside its compact central board, leaving room for its cast shadow.
  milkCenters: [565, 710], milkBases: [884, 890], milkWidth: 104,
  milkHeight: 104 * EQUIPMENT_FRAMES.milk.height / EQUIPMENT_FRAMES.milk.width,
  foamCenters: [996, 1116], foamBases: [884, 890], foamWidth: 76,
  foamHeight: 76 * EQUIPMENT_FRAMES.cream.height / EQUIPMENT_FRAMES.cream.width,
  // Both trays are painted into the room, with matching straight edges and a narrow gap.
  sugar: {
    x: ROOM_BG_ICE_MACHINE.x,
    y: ROOM_BG_ICE_MACHINE.y + ROOM_BG_ICE_MACHINE.height + 8,
    width: ROOM_BG_ICE_MACHINE.width,
    height: ROOM_BG_ICE_MACHINE.height,
  },
};
/**
 * Where the lifted cup holder fits on the extended work top. It does not pan with the room:
 * one shared mat occupies the foreground, clear of the counter's front edge.
 */
export const ROOM_BG_CUP_HOLDER = { x: 835, y: 805 + ROOM_EXTRA_HEIGHT, width: 250, height: 250 * 211 / 598 };
/**
 * The rows of the plate that have to stay on screen whatever shape the room is given: the crown
 * of a tank standing on the upper shelf, down to the front edge of the cup's holder. Between them
 * are the taps, the toppings, the ice machine, the work top and the cup — everything the player
 * actually reaches for.
 *
 * `fitBackground` draws the plate `cover` and centred, so a room wider than `width / (bottom -
 * top)` starts losing these from both ends at once. That ratio is what decides whether the order
 * can stand across the top of the prep page or has to move beside it; see `src/responsive.ts`.
 * It is measured here, off the same anchors the equipment is placed by, so re-cutting the plate
 * moves it rather than leaving a number behind that used to be true.
 */
export const ROOM_BG_KEEP = {
  top: ROOM_BG_TEA_SHELF.bases[0]
    - ROOM_BG_TEA_SHELF.tankWidth * (TEA_DISPENSER_ART.height / TEA_DISPENSER_ART.width) * TEA_DISPENSER_ART.foot,
  bottom: ROOM_BG_CUP_HOLDER.y + ROOM_BG_CUP_HOLDER.height + 48,
};

/** Center the active working band, from the upper tank to the foreground mats. */
export const ROOM_BG_FOCUS_Y = (ROOM_BG_KEEP.top + ROOM_BG_KEEP.bottom) / 2;

/**
 * The narrower band the room has to keep to still be *workable*, as opposed to whole.
 *
 * Between this and `ROOM_BG_KEEP` lie the crowns of the tanks' lids and the front lip of the mat
 * the cup stands on: paint, not furniture. What is inside it is what the shift needs — a tank's
 * name tag, so you can tell the teas apart, down to the line the cup's foot rests on, so you can
 * see what you are dropping things into. The taps are lower than the tags and the toppings, the
 * ice and the bench are lower still, so all of those come with it.
 *
 * Nothing settles for it by choice: the sideways layouts are chosen to keep `ROOM_BG_KEEP`
 * whole. It is the floor a window too squat for that is held to, by widening the order column
 * until the room beside it fits this much. See `panelWidthFor`.
 */
const TANK_HEIGHT = ROOM_BG_TEA_SHELF.tankWidth
  * (TEA_DISPENSER_ART.height / TEA_DISPENSER_ART.width);
export const ROOM_BG_REACH = {
  // One tag's height of headroom above the tag itself, so it is never flush with the ceiling.
  top: ROOM_BG_KEEP.top + TANK_HEIGHT * (TEA_DISPENSER_ART.label.top - TEA_DISPENSER_ART.label.height),
  bottom: ROOM_BG_CUP_HOLDER.y + ROOM_BG_CUP_HOLDER.height / 2,
};

export const ROOM_BG_TOPPING_SHELF = {
  // Shared boundaries project the whole grid into the basin's perspective.
  edges: TOPPING_TRAY_EDGES.map(edge => ({ ...edge, y: edge.y + ROOM_EXTRA_HEIGHT })),
  // Unlock order, read like a page: left to right along the back row, then the next row forward.
  slots: ['pearls', 'popping', 'lychee', 'pudding', 'grass', 'pandan', 'redbean', 'aloe', 'crystal'],
};

/**
 * The original portrait room's 941x1672 coordinate system, retained for the existing equipment.
 * Keep it separate from ROOM_BG_SIZE so panning or replacing the background leaves the other
 * assets in their current positions.
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

export const ICON_TRASH = iconTrash;
export const ICON_CUP = iconCup;

/** Width ÷ height of every sprite, so nothing gets squashed by accident. */
export const ART = {
  jar: 116 / 205,
  cup: 113 / CUP_DISPLAY_HEIGHT,
  pan: 235 / 239,
  bin: 256 / 226,
  scoop: 102 / 64,
  milk: 99 / 157,
  syrup: 77 / 167,
  foam: CREAM_CAN_ART.width / CREAM_CAN_ART.height,
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

/**
 * Everything the game draws, for the loading screen to fetch before the shop opens.
 *
 * A painted room that arrives sprite by sprite is worse than a moment's wait: the first swipe to
 * the prep page used to land on an empty kitchen that filled itself in, and the first scoop of a
 * topping stuttered while its sprite decoded. So they are all pulled in up front — see
 * `src/useArtwork.ts`.
 *
 * This is deliberately *not* every sprite in this file. The room used to be assembled out of
 * planks, counters and cabinet fronts, and the teas used to be whole jars; those are still cut and
 * still exported, but nothing draws them any more (see "The kitchen's artwork" in CLAUDE.md), and
 * pulling that lot down would double the wait for a shop that never shows them. **When something
 * here starts being drawn, add it; a sprite that is missing from this list still loads — it just
 * loads late, in the middle of play, which is the stutter this exists to remove.**
 */
export const PRELOAD: Sprite[] = [
  // the room itself, and what stands in it
  KITCHEN_ROOM_RENDER,
  KITCHEN_ROOM_TRAYS,
  KITCHEN_ROOM_CLEAR_ICE,
  KITCHEN_ORIGINAL_COUNTER,
  KITCHEN_CLEAR_BOARDS,
  SUGAR_SCOOP,
  PAINTED_EQUIPMENT,
  PAINTED_MILK,
  TEA_DISPENSERS,
  CUP_HOLDER,
  CUP_GLASS,
  TOPPING_PANS,
  TOPPING_SCOOPS,
  TOPPING_PIECES,
  SCOOP,
  ...Object.values(FOAM),
  // what you carry, and what lands in the cup
  SCOOPFUL.ice,
  PIECE.ice,
  CUP_ICE,
  // the cup, and the painted tea inside it
  CUP_CREAM,
  ...Object.values(DRINK),
  ...Object.values(DRINK_MILKY),
  ...Object.values(DRINK_TOP),
  ...Object.values(DRINK_MILKY_TOP),
  // the buttons under the room
  ICON_CUP,
  ICON_TRASH,
];
