import { CLIPS, Clip } from './clips';

export type SoundId = 'tap' | 'button' | 'nudge' | 'customer' | 'order' | 'leave'
  | 'milk' | 'ice' | 'scoop' | 'sugar' | 'foam' | 'pickup' | 'cupPickup' | 'cupDown'
  | 'spill' | 'trash' | 'coin' | 'serveGood' | 'serveOk' | 'serveBad' | 'dayEnd'
  | 'pourStart' | 'pourStop';
export type MusicId = 'menu' | 'shop';
export type SoundBus = 'ui' | 'kitchen' | 'counter';
export interface SoundLayer {
  clips: readonly Clip[];
  gain: number;
  delayMs: number;
  rate: readonly [number, number];
}
export interface SoundSpec {
  bus: SoundBus;
  gain: number;
  priority: number;
  voices: number;
  minGapMs: number;
  layers: readonly SoundLayer[];
}
const layer = (clips: readonly Clip[], gain = 1, delayMs = 0,
  rate: readonly [number, number] = [0.97, 1.03]): SoundLayer => ({ clips, gain, delayMs, rate });
const cue = (bus: SoundBus, gain: number, priority: number, voices: number, minGapMs: number,
  ...layers: SoundLayer[]): SoundSpec => ({ bus, gain, priority, voices, minGapMs, layers });

// Recorded material sounds. Delays describe the action: contact first, movement/settling after.
export const SOUNDS: Record<SoundId, SoundSpec> = {
  tap: cue('ui', 0.55, 0, 2, 55, layer([CLIPS.cup1], 0.8, 0, [1.12, 1.18])),
  button: cue('ui', 0.72, 0, 2, 80, layer([CLIPS.pump1, CLIPS.pump2], 0.9)),
  nudge: cue('ui', 0.42, 1, 1, 180, layer([CLIPS.cup1], 0.8, 0, [0.85, 0.9])),
  customer: cue('counter', 0.62, 2, 2, 220, layer([CLIPS.bell1])),
  order: cue('counter', 0.68, 1, 2, 100, layer([CLIPS.paper1, CLIPS.paper2])),
  leave: cue('counter', 0.45, 1, 2, 250, layer([CLIPS.step1], 0.85), layer([CLIPS.step2], 0.55, 220)),
  milk: cue('kitchen', 0.9, 2, 2, 180, layer([CLIPS.milk1, CLIPS.milk2])),
  ice: cue('kitchen', 0.9, 2, 3, 110, layer([CLIPS.ice1, CLIPS.ice2, CLIPS.ice3]), layer([CLIPS.ice1, CLIPS.ice2, CLIPS.ice3], 0.24, 65, [1.07, 1.14])),
  scoop: cue('kitchen', 0.88, 2, 3, 110, layer([CLIPS.plop1, CLIPS.plop2], 0.95), layer([CLIPS.spoon1, CLIPS.spoon2], 0.36, 25)),
  sugar: cue('kitchen', 0.85, 2, 2, 140, layer([CLIPS.pump1, CLIPS.pump2, CLIPS.pump3]), layer([CLIPS.milk1, CLIPS.milk2], 0.24, 55, [0.9, 0.95])),
  foam: cue('kitchen', 0.78, 2, 2, 150, layer([CLIPS.foam1, CLIPS.foam2], 0.95), layer([CLIPS.plop1, CLIPS.plop2], 0.45, 70)),
  pickup: cue('kitchen', 0.5, 1, 2, 80, layer([CLIPS.spoon1, CLIPS.spoon2], 0.85)),
  cupPickup: cue('kitchen', 0.44, 1, 1, 80, layer([CLIPS.cup1], 0.75, 0, [1.04, 1.08])),
  cupDown: cue('kitchen', 0.7, 2, 1, 120, layer([CLIPS.cup1, CLIPS.cup2])),
  spill: cue('kitchen', 0.82, 3, 1, 400, layer([CLIPS.splash1, CLIPS.splash2])),
  trash: cue('kitchen', 0.65, 2, 2, 180, layer([CLIPS.cup1], 0.85, 0, [0.8, 0.87]), layer([CLIPS.bag1, CLIPS.bag2], 0.8, 50)),
  coin: cue('counter', 0.82, 2, 3, 70, layer([CLIPS.coin1])),
  serveGood: cue('counter', 0.82, 3, 2, 180, layer([CLIPS.cup1, CLIPS.cup2], 0.8), layer([CLIPS.coin1], 0.38, 60, [1.08, 1.15]), layer([CLIPS.bell1], 0.55, 130)),
  serveOk: cue('counter', 0.7, 3, 2, 180, layer([CLIPS.cup1, CLIPS.cup2]), layer([CLIPS.paper1, CLIPS.paper2], 0.45, 75)),
  serveBad: cue('counter', 0.55, 3, 2, 180, layer([CLIPS.cup1], 0.85, 0, [0.9, 0.94]), layer([CLIPS.step1], 0.4, 160)),
  dayEnd: cue('counter', 0.85, 3, 1, 1000, layer([CLIPS.coin1], 0.9), layer([CLIPS.coin1], 0.4, 100, [1.1, 1.18]), layer([CLIPS.bell1], 0.8, 200)),
  pourStart: cue('kitchen', 0.8, 2, 1, 100, layer([CLIPS.pump1, CLIPS.pump2], 0.48), layer([CLIPS.pourStart], 0.95)),
  pourStop: cue('kitchen', 0.72, 2, 1, 80, layer([CLIPS.pourStop])),
};
export const BUS_GAIN: Record<SoundBus, number> = { ui: 0.9, kitchen: 1, counter: 1 };
export const POUR_LOOP = { ...CLIPS.pourLoop, gain: 0.72 };
export const MUSIC: Record<MusicId, number> = {
  menu: require('../assets/audio/music-menu.wav'),
  shop: require('../assets/audio/music-shop.wav'),
};
// Recorded contacts have more transient headroom than the old synth cues. Leave room for them.
export const MUSIC_GAIN: Record<MusicId, number> = { menu: 0.45, shop: 0.32 };
// Primary contacts warmed first; alternate clips are loaded only when chosen.
export const WARM_CLIPS = [CLIPS.cup1, CLIPS.pump1, CLIPS.ice1, CLIPS.milk1, CLIPS.paper1, CLIPS.spoon1];
export const PRELOAD = Object.values(CLIPS).map((clip) => clip.module);
