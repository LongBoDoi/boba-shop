export interface Rng {
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  readonly seed: number;
}

/**
 * Seeded mulberry32 generator. The seed lives in game state so the reducer
 * stays pure: create an Rng from state.seed, use it, store rng.seed back.
 */
export function createRng(seed: number): Rng {
  let state = seed | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    get seed() {
      return state;
    },
  };
}
