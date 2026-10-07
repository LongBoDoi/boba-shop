/**
 * The painted kitchen sprites (cut from the shop's asset sheet) and the geometry the code needs to
 * line up with them. Anything drawn *through* a sprite — the tea in a jar, the drink in the cup —
 * is rendered behind it and shows through a window that was cleared out of the artwork.
 */

export const JAR = require('../../assets/kitchen/jar.png');
export const CUP_SPRITE = require('../../assets/kitchen/cup.png');
export const CUP_BASE = require('../../assets/kitchen/cup-base.png');
export const CARD = require('../../assets/kitchen/card.png');
export const ICON_TRASH = require('../../assets/kitchen/icon-trash.png');
export const ICON_CUP = require('../../assets/kitchen/icon-cup.png');

export const PAN: Record<string, number> = {
  pearls: require('../../assets/kitchen/pan-pearls.png'),
  popping: require('../../assets/kitchen/pan-popping.png'),
  lychee: require('../../assets/kitchen/pan-lychee.png'),
  pudding: require('../../assets/kitchen/pan-pudding.png'),
  grass: require('../../assets/kitchen/pan-grass.png'),
  redbean: require('../../assets/kitchen/pan-redbean.png'),
  ice: require('../../assets/kitchen/pan-ice.png'),
};

/** Width ÷ height of each sprite, so the layout never squashes one. */
export const ART_ASPECT = {
  jar: 191 / 321,
  pan: 228 / 232,
  cup: 133 / 199,
  card: 130 / 229,
};

/** The cleared glass of a dispenser, as fractions of the sprite. */
export const JAR_WINDOW = { x: 24 / 191, y: 88 / 321, w: 157 / 191, h: 175 / 321 };
/** How full a dispenser looks on the shelf. */
export const JAR_LEVEL = 0.86;
/** Where the tap lets go of the tea, down the sprite. */
export const JAR_SPOUT = 0.87;
