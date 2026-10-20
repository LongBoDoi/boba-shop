import toppingPans from '../assets/kitchen/topping-pans.png';
import toppingScoops from '../assets/kitchen/topping-scoops.png';
import toppingPieces from '../assets/kitchen/topping-pieces.png';

/** Painted topping atlases share the warm metal, light and ingredient colors of the reference. */
export interface ToppingSprite {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ToppingAtlas {
  width: number;
  height: number;
  cells: Record<string, ToppingSprite>;
}

export const TOPPING_PANS = toppingPans;
export const TOPPING_SCOOPS = toppingScoops;
export const TOPPING_PIECES = toppingPieces;

export const TOPPING_PAN_ART: ToppingAtlas = {
  width: 1536, height: 1024,
  cells: {
    pearls: { x: 30, y: 60, width: 490, height: 192 },
    lychee: { x: 530, y: 60, width: 480, height: 194 },
    popping: { x: 1019, y: 60, width: 488, height: 193 },
    redbean: { x: 30, y: 282, width: 490, height: 206 },
    pudding: { x: 529, y: 287, width: 482, height: 201 },
    aloe: { x: 1018, y: 285, width: 489, height: 203 },
    pandan: { x: 30, y: 521, width: 490, height: 210 },
    grass: { x: 530, y: 521, width: 482, height: 210 },
    crystal: { x: 1020, y: 523, width: 487, height: 209 },
    empty: { x: 530, y: 767, width: 482, height: 206 },
  },
};

export const TOPPING_SCOOP_ART: ToppingAtlas = {
  width: 1254, height: 1254,
  cells: {
    pearls: { x: 21, y: 49, width: 422, height: 347 },
    lychee: { x: 445, y: 49, width: 404, height: 347 },
    popping: { x: 857, y: 57, width: 397, height: 341 },
    redbean: { x: 21, y: 436, width: 422, height: 361 },
    pudding: { x: 445, y: 437, width: 404, height: 361 },
    aloe: { x: 858, y: 445, width: 396, height: 354 },
    pandan: { x: 21, y: 837, width: 422, height: 363 },
    grass: { x: 445, y: 837, width: 407, height: 365 },
    crystal: { x: 853, y: 842, width: 401, height: 365 },
  },
};

export const TOPPING_PIECE_ART: ToppingAtlas = {
  width: 1254, height: 1254,
  cells: {
    pearls: { x: 74, y: 102, width: 280, height: 272 },
    lychee: { x: 488, y: 101, width: 276, height: 275 },
    popping: { x: 895, y: 100, width: 280, height: 276 },
    redbean: { x: 77, y: 523, width: 284, height: 231 },
    pudding: { x: 464, y: 481, width: 326, height: 302 },
    aloe: { x: 887, y: 482, width: 309, height: 300 },
    pandan: { x: 66, y: 870, width: 306, height: 301 },
    grass: { x: 473, y: 869, width: 310, height: 301 },
    crystal: { x: 891, y: 873, width: 291, height: 291 },
  },
};
