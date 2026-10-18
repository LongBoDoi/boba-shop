import Phaser from 'phaser';

import { PRELOAD, SCOOPFUL } from '../../../src/components/art/kitchenArt';
import { tex } from '../game/view';
import { uiState } from '../ui-state';

/**
 * Everything the kitchen draws, pulled in before the shop opens — the same list the Expo build's
 * loading screen waited on (`PRELOAD` in `kitchenArt.ts`), for the same reason: a sprite that
 * arrives in the middle of a two-minute shift is a stutter, and the wait is better taken up front.
 *
 * Gives up after ten seconds rather than lock a player on a slow connection out of their shop;
 * anything still missing then is loaded on demand.
 */
const GIVE_UP_MS = 10_000;
/** The bar's share for the artwork; fonts and the save are the rest (see `main.tsx`). */
const ART_SHARE = 0.85;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload() {
    const assets = new Set<number>([...PRELOAD, ...Object.values(SCOOPFUL)]);
    for (const asset of assets) this.load.image(tex(asset), tex(asset));
    const base = uiState.value.loading;
    this.load.on('progress', (value: number) => uiState.set({ loading: base + value * ART_SHARE }));
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('[art] could not load', file.src));
    const timer = setTimeout(() => {
      console.warn(`[art] opening the shop with ${this.load.totalComplete} of ${this.load.totalToLoad} sprites`);
      this.done();
    }, GIVE_UP_MS);
    this.load.once('complete', () => {
      clearTimeout(timer);
      this.done();
    });
  }

  private finished = false;
  private done() {
    if (this.finished) return;
    this.finished = true;
    this.scene.launch('counter');
    this.scene.launch('kitchen');
    uiState.set({ loading: 1, ready: true });
  }
}
