import { createRng } from '../game/random';
import { cupIcePosition, cupIceRestPosition, cupIceSpreadPosition } from './cupGeometry';

/** Stable placements: adding the second scoop never moves the first three cubes. */
export interface IcePlacement {
  x: number;
  r: number;
  angle: number;
  depth: number;
  restX: number;
  restAngle: number;
  restLift: number;
  /** A fraction of the shallow band just below the tea surface, for the second scoop. */
  liquidDepth?: number;
  immersion?: number;
}

export const ICE_LAYOUT: IcePlacement[] = [
  { x: 31, r: 17, angle: -24, depth: -0.55, restX: 37, restAngle: -28, restLift: 0, immersion: 0.34 },
  { x: 83, r: 18, angle: 16, depth: 0.02, restX: 75, restAngle: 23, restLift: 0.6, immersion: 0.18 },
  { x: 54, r: 16.5, angle: 38, depth: 0.92, restX: 53, restAngle: -8, restLift: 9, immersion: -0.06 },
  // Keep the second scoop chunky too. Its positions are sampled per cup, without rows.
  ...[15.5, 14.5, 16, 14, 15.5, 13.5, 16, 14.5, 15].map((r, i) => ({
    x: 56.5, r, angle: 0, depth: 0,
    restX: 56.5, restAngle: 0, restLift: 20,
    ...(i === 0 ? { immersion: 0.15 } : { liquidDepth: 0.5 }),
  })),
];

/** Sample a stable, loose pile once per cup; measure gaps after fitting whole cubes to the glass. */
export function createIceLayout(seed: number): IcePlacement[] {
  const rng = createRng(seed);
  const layout: IcePlacement[] = ICE_LAYOUT.slice(0, 3).map(cube => ({
    ...cube,
    x: cube.x + rng.next() * 8 - 4,
    angle: cube.angle + rng.int(-24, 24),
    depth: cube.depth + rng.next() * 0.36 - 0.18,
    immersion: (cube.immersion ?? 0.42) + rng.next() * 0.28 - 0.14,
  }));
  const resting = (cube: IcePlacement) => cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift);
  const wet = (cube: IcePlacement) => {
    const dry = resting(cube);
    return cube.liquidDepth === undefined
      ? cupIcePosition(0.8, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle, cube.immersion)
      : cupIceSpreadPosition(0.8, cube.x, cube.r, cube.angle, cube.liquidDepth);
  };
  const dryPositions = layout.map(resting);
  const wetPositions = layout.map(wet);
  for (let i = 3; i < ICE_LAYOUT.length; i++) {
    const base = ICE_LAYOUT[i];
    let best = base, bestGap = -Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = { ...base, restX: 33 + rng.next() * 47, restAngle: rng.int(-70, 70),
        restLift: 12 + rng.next() * 46 };
      const p = resting(candidate);
      const gap = Math.min(...dryPositions.map(other => Math.hypot(p.cx - other.cx, p.cy - other.cy)));
      if (gap > bestGap) { best = candidate; bestGap = gap; }
      if (gap > base.r) break;
    }
    const dry = best;
    bestGap = -Infinity;
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidate: IcePlacement = { ...dry,
        x: i === 5 ? 27 + rng.next() * 12 : i === 6 ? 74 + rng.next() * 12 : 27 + rng.next() * 59,
        angle: rng.int(-70, 70), depth: -0.85 + rng.next() * 1.75,
        immersion: -0.18 + rng.next() * 0.4,
        liquidDepth: i === 3 ? undefined
          : i === 4 ? 0.24 + rng.next() * 0.12 : 0.24 + rng.next() * 0.7,
      };
      const p = wet(candidate);
      const gap = Math.min(...wetPositions.map(other => Math.hypot(p.cx - other.cx, p.cy - other.cy)));
      if (gap > bestGap) { best = candidate; bestGap = gap; }
    }
    layout.push(best);
    dryPositions.push(resting(best));
    wetPositions.push(wet(best));
  }
  return layout;
}
