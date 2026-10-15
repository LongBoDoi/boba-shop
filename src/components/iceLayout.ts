import { createRng } from '../game/random';
import { cupIcePosition, cupIceRestPosition } from './cupGeometry';

/** Stable, asymmetric placements: adding a scoop never reshuffles the existing ice. */
export interface IcePlacement {
  x: number;
  r: number;
  angle: number;
  depth: number;
  restX: number;
  restAngle: number;
  restLift: number;
  /** Lower pieces of the packed cluster sit underneath the exposed surface cubes. */
  submergedDepth?: number;
  /** Per-cube seating at the waterline; smaller values expose more of its tilted body. */
  immersion?: number;
}

export const ICE_LAYOUT: IcePlacement[] = [
  // Chunky 27–36-unit bodies; the first three retain their fitted dry-floor poses.
  { x: 31, r: 17, angle: -24, depth: -0.55, restX: 37, restAngle: -28, restLift: 0, immersion: 0.34 },
  { x: 83, r: 18, angle: 16, depth: 0.02, restX: 75, restAngle: 23, restLift: 0.6, immersion: 0.18 },
  { x: 54, r: 16.5, angle: 38, depth: 0.92, restX: 53, restAngle: -8, restLift: 9, immersion: -0.06 },
  { x: 57, r: 15.5, angle: -31, depth: -0.88, restX: 47, restAngle: 32, restLift: 22, immersion: 0.28 },
  { x: 74, r: 14.5, angle: 48, depth: 0.02, restX: 67, restAngle: -40, restLift: 17, submergedDepth: 19 },
  { x: 30, r: 13.5, angle: 23, depth: 0.58, restX: 33, restAngle: 11, restLift: 13, submergedDepth: 20 },
  { x: 62, r: 14, angle: -9, depth: 0.49, restX: 59, restAngle: -21, restLift: 33, submergedDepth: 24 },
  { x: 44, r: 15.5, angle: -46, depth: 0.16, restX: 43, restAngle: 58, restLift: 37, submergedDepth: 22 },
  { x: 81, r: 13.5, angle: -22, depth: 0.31, restX: 76, restAngle: -35, restLift: 22, submergedDepth: 16 },
  { x: 67, r: 14, angle: 14, depth: 0.59, restX: 65, restAngle: 17, restLift: 44, submergedDepth: 29 },
  { x: 45, r: 15.5, angle: -5, depth: -0.12, restX: 45, restAngle: -19, restLift: 52, submergedDepth: 27 },
  { x: 76, r: 16, angle: 31, depth: 0.7, restX: 71, restAngle: 39, restLift: 46, immersion: -0.01 },
];

/** Generate once per cup: scattered depth and tilt, with spacing measured after fitting the glass. */
export function createIceLayout(seed: number): IcePlacement[] {
  const rng = createRng(seed);
  const layout: IcePlacement[] = ICE_LAYOUT.slice(0, 3).map((cube) => ({
    ...cube,
    x: cube.x + rng.next() * 8 - 4,
    angle: cube.angle + rng.int(-24, 24),
    depth: cube.depth + rng.next() * 0.36 - 0.18,
    immersion: (cube.immersion ?? 0.42) + rng.next() * 0.28 - 0.14,
  }));
  const floatingPosition = (cube: IcePlacement) => {
    const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift);
    return cupIcePosition(1, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle,
      cube.submergedDepth ?? 0, cube.immersion ?? 0.42);
  };
  const wetPositions = layout.map(floatingPosition);
  const dryPositions = layout.map((cube) => cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift));

  for (let i = 3; i < ICE_LAYOUT.length; i++) {
    const base = ICE_LAYOUT[i];
    const surface = i === 3;
    let best = base;
    let bestDryGap = -Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = { ...base, restX: 33 + rng.next() * 47, restAngle: rng.int(-75, 75),
        restLift: 12 + rng.next() * 55 };
      const dry = cupIceRestPosition(candidate.restX, candidate.r, candidate.restAngle, candidate.restLift);
      const gap = Math.min(...dryPositions.map((p) => Math.hypot(dry.cx - p.cx, dry.cy - p.cy)));
      if (gap > bestDryGap) { best = candidate; bestDryGap = gap; }
      if (gap > base.r) break;
    }
    const resting = best;
    let bestGap = -Infinity;
    // Accept an irregular sample with room around it, or the loosest candidate if the cup is packed.
    for (let attempt = 0; attempt < 32; attempt++) {
      const candidate: IcePlacement = {
        ...resting,
        x: 27 + rng.next() * 59,
        angle: rng.int(-78, 76),
        depth: -0.85 + rng.next() * 1.75,
        immersion: surface ? -0.18 + rng.next() * 0.4 : 0.42,
        submergedDepth: surface ? undefined : 14 + rng.next() * 80,
      };
      const wet = floatingPosition(candidate);
      const gap = Math.min(...wetPositions.map((p) => Math.hypot(wet.cx - p.cx, wet.cy - p.cy)));
      if (gap > bestGap) { best = candidate; bestGap = gap; }
      if (gap > base.r * (surface ? 0.72 : 1.35)) break;
    }
    layout.push(best);
    wetPositions.push(floatingPosition(best));
    dryPositions.push(cupIceRestPosition(best.restX, best.r, best.restAngle, best.restLift));
  }
  return layout;
}
