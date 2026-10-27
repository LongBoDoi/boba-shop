import Phaser from 'phaser';

import { CUP_CREAM, PRELOAD, SCOOPFUL } from '../art/kitchenArt';
import { prepareReferenceCup, REFERENCE_CUP } from '../art/referenceCupArt';
import { tex } from '../game/view';
import { FOAMS } from '../game/ingredients';
import { prepareCupCream } from '../kitchen/creamPainter';
import { uiState } from '../ui-state';

/**
 * Everything the kitchen draws, pulled in before the shop opens (`PRELOAD` in `kitchenArt.ts`): a
 * sprite that arrives in the middle of a two-minute shift is a stutter, and the wait is better
 * taken up front.
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
    const assets = new Set<string>([...PRELOAD, ...Object.values(SCOOPFUL)]);
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
    prepareReferenceCup(this.textures.get(tex(REFERENCE_CUP)).getSourceImage() as CanvasImageSource);
    const cream = this.textures.get(tex(CUP_CREAM)).getSourceImage() as CanvasImageSource;
    for (const foam of FOAMS) if (!foam.isNone) prepareCupCream(foam.id, foam.color, cream);
    this.scene.launch('counter');
    this.scene.launch('kitchen');
    uiState.set({ loading: 1, ready: true });
  }
}
