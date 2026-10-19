import { createRng } from '../game/random';

/** Stable placements: adding the second scoop never moves the first three cubes. */
export interface IcePlacement {
  x: number;
  r: number;
  angle: number;
  depth: number;
  restX: number;
  restAngle: number;
  restLift: number;
  /** A fraction of the tea's height, from its surface to its floor, for the second scoop. */
  liquidDepth?: number;
  immersion?: number;
}

export const ICE_LAYOUT: IcePlacement[] = [
  { x: 31, r: 17, angle: -24, depth: -0.55, restX: 37, restAngle: -28, restLift: 0, immersion: 0.34 },
  { x: 83, r: 18, angle: 16, depth: 0.02, restX: 75, restAngle: 23, restLift: 0.6, immersion: 0.18 },
  { x: 54, r: 16.5, angle: 38, depth: 0.92, restX: 53, restAngle: -8, restLift: 9, immersion: -0.06 },
  // Nine simple regions across the tea. Small seeded offsets keep the spread from looking tiled.
  ...[0, 1, 2].flatMap(row => [0, 1, 2].map(column => ({
    x: 32 + column * 24.5, r: 12.5, angle: 0, depth: row / 2,
    restX: 33 + column * 23.5, restAngle: 0, restLift: 39 - row * 15,
    liquidDepth: 0.12 + row * 0.34,
  }))),
];

/** One seeded pass, with no collision search, retries or hidden submerged-depth offsets. */
export function createIceLayout(seed: number): IcePlacement[] {
  const rng = createRng(seed);
  return ICE_LAYOUT.map((cube, i) => i < 3 ? {
    ...cube,
    x: cube.x + rng.next() * 8 - 4,
    angle: cube.angle + rng.int(-24, 24),
    depth: cube.depth + rng.next() * 0.36 - 0.18,
    immersion: (cube.immersion ?? 0.42) + rng.next() * 0.28 - 0.14,
  } : {
    ...cube,
    x: cube.x + rng.next() * 12 - 6,
    angle: rng.int(-48, 48),
    restAngle: rng.int(-28, 28),
    liquidDepth: cube.liquidDepth! + rng.next() * 0.16 - 0.08,
  });
}
