import Phaser from 'phaser';

import { svgTexture } from '../game/view';

/**
 * The counter's rasterised drawings, each made once and owned by whoever needs it.
 *
 * A customer's figure is an SVG drawn into a texture per mood (and its blink), at the size the
 * stage gives it; those belong to that customer and go when they have walked off, so a day's worth
 * of faces does not pile up in GPU memory. Shared pieces (the rings, the bubbles, the pad…) belong
 * to `SHARED` and stay. Layout-sized pieces (the backdrop, the counter) belong to the layout that
 * drew them and go when the page is laid out again.
 *
 * A texture that finishes decoding after its owner was released is dropped on arrival, and the
 * promise resolves `null` so the caller knows not to use it.
 */
export const SHARED = 'shared';

export class TextureBank {
  private owned = new Map<string, Set<string>>();
  private pending = new Map<string, Promise<string | null>>();

  constructor(private scene: Phaser.Scene) {}

  has(key: string): boolean {
    return this.scene.textures.exists(key);
  }

  /** The texture `key`, drawn from `svg()` at `width`×`height` CSS pixels if it is not there yet. */
  get(owner: string, key: string, svg: () => string, width: number, height: number): Promise<string | null> {
    let keys = this.owned.get(owner);
    if (!keys) this.owned.set(owner, keys = new Set());
    keys.add(key);
    if (this.scene.textures.exists(key)) return Promise.resolve(key);
    const waiting = this.pending.get(key);
    if (waiting) return waiting;
    const promise = svgTexture(this.scene, key, svg(), width, height)
      .then(() => {
        this.pending.delete(key);
        if (!this.isOwned(key)) {
          this.scene.textures.remove(key);
          return null;
        }
        return key;
      })
      .catch((error: unknown) => {
        this.pending.delete(key);
        console.warn('[counter] could not draw', key, error);
        return null;
      });
    this.pending.set(key, promise);
    return promise;
  }

  /** Drop everything `owner` asked for that no other owner still holds. */
  release(owner: string) {
    const keys = this.owned.get(owner);
    if (!keys) return;
    this.owned.delete(owner);
    for (const key of keys) {
      if (!this.isOwned(key) && this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }

  owners(): string[] {
    return [...this.owned.keys()];
  }

  releaseAll() {
    for (const owner of this.owners()) this.release(owner);
  }

  private isOwned(key: string): boolean {
    for (const keys of this.owned.values()) if (keys.has(key)) return true;
    return false;
  }
}
