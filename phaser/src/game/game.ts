import Phaser from 'phaser';

import { uiState } from '../ui-state';
import { CounterScene } from '../scenes/CounterScene';
import { KitchenScene } from '../scenes/KitchenScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { DPR } from './view';

/**
 * The one Phaser game: a canvas laid over the pager area the HTML leaves for it (see `host.ts`),
 * with the counter and the kitchen as two scenes side by side, each drawn through its own camera.
 */
let game: Phaser.Game | null = null;

export function createGame(parent: HTMLElement): Phaser.Game {
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#FFF4E8',
    banner: false,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round((parent.clientWidth || 1) * DPR)),
      height: Math.max(1, Math.round((parent.clientHeight || 1) * DPR)),
      zoom: 1 / DPR,
    },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 3 },
    scene: [PreloadScene, CounterScene, KitchenScene],
  });

  // One texture per batch, everywhere. Phaser compiles a shader for every number of textures a batch
  // mixes, the first time it meets that number — a third of a second stalled on the GPU the first
  // time a scoop was lifted. Phones are given one per batch already (`autoMobileTextures`), and the
  // room is a single atlas, so the extra draw calls are few. Desktop now behaves as phones do.
  game.events.once('ready', () => {
    const renderer = game?.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) renderer.renderNodes.setMaxParallelTextureUnits(1);
  });

  // The HTML decides where the canvas goes and how big it is; follow it.
  const fit = () => {
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!game || width <= 0 || height <= 0) return;
    game.scale.resize(Math.round(width * DPR), Math.round(height * DPR));
    uiState.set({ pager: { width, height } });
  };
  new ResizeObserver(fit).observe(parent);
  fit();
  return game;
}

export function getGame(): Phaser.Game | null {
  return game;
}
