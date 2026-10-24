import { createRng } from '../game/random';

/** Cup-plane coordinates, before the shared overhead projection. */
export interface IcePlacement { u: number; v: number; r: number; angle: number }

export const ICE_LAYOUT: IcePlacement[] = [
  { u: -0.43, v: -0.25, r: 0.25, angle: -22 },
  { u: 0.35, v: -0.36, r: 0.26, angle: 17 },
  { u: 0.04, v: 0.40, r: 0.24, angle: 38 },
  ...Array.from({ length: 9 }, () => ({ u: 0, v: 0, r: 0.20, angle: 0 })),
];

/** Stable across reloads. The second scoop fills gaps without rearranging the first. */
export function createIceLayout(seed: number): IcePlacement[] {
  const rng = createRng(seed);
  const placed = ICE_LAYOUT.slice(0, 3).map(cube => ({ ...cube, angle: cube.angle + rng.int(-12, 12) }));
  for (let i = 3; i < ICE_LAYOUT.length; i++) {
    const r = 0.18 + rng.next() * 0.055;
    let best = { u: 0, v: 0, r, angle: rng.int(-70, 70) }, gap = -Infinity;
    for (let attempt = 0; attempt < 80; attempt++) {
      const angle = rng.next() * Math.PI * 2;
      const distance = Math.sqrt(rng.next()) * (0.94 - r);
      const u = Math.cos(angle) * distance, v = Math.sin(angle) * distance;
      const clearance = Math.min(...placed.map(p => Math.hypot(u - p.u, v - p.v) - (p.r + r) * 0.7));
      if (clearance > gap) { best = { ...best, u, v }; gap = clearance; }
    }
    placed.push(best);
  }
  return placed;
}
