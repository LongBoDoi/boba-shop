import toppingPans from '../assets/kitchen/topping-pans-overhead.png';
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
  width: 1254, height: 1254,
  cells: {
    pearls: { x: 11, y: 71, width: 413, height: 255 },
    popping: { x: 427, y: 71, width: 401, height: 255 },
    lychee: { x: 832, y: 71, width: 412, height: 255 },
    pudding: { x: 11, y: 344, width: 414, height: 272 },
    grass: { x: 428, y: 344, width: 400, height: 272 },
    pandan: { x: 831, y: 344, width: 413, height: 272 },
    redbean: { x: 10, y: 629, width: 417, height: 281 },
    aloe: { x: 427, y: 629, width: 402, height: 281 },
    crystal: { x: 830, y: 629, width: 415, height: 280 },
    empty: { x: 417, y: 924, width: 420, height: 275 },
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
