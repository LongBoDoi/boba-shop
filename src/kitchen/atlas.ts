import Phaser from 'phaser';

import { DPR } from '../game/view';

/**
 * Many small pictures drawn once into **one** texture, so the GPU can draw them all in one batch.
 *
 * Every texture a frame switches to is a texture bind and a new draw call, and the room is a lot
 * of small pictures — six tanks with their names, nine pans with their cards, bottles, tubs,
 * plaques. Each as its own texture, drawing them was half of an idle frame on a slowed phone;
 * packed together, they cost about what the painting behind them does.
 *
 * Pictures are drawn with Canvas 2D in CSS pixels, at the device's density, shrunk only if the
 * whole sheet would not fit in a texture every phone can hold.
 */
const MAX_SIZE = 2048;
const GAP = 2;

interface Item {
  name: string;
  w: number;
  h: number;
  draw: (context: CanvasRenderingContext2D) => void;
  x?: number;
  y?: number;
}

export class Atlas {
  private items: Item[] = [];
  private names = new Set<string>();

  /** Queue a picture `w`×`h` CSS pixels; `draw` paints it from (0, 0). Same name twice is kept once. */
  add(name: string, w: number, h: number, draw: (context: CanvasRenderingContext2D) => void) {
    if (this.names.has(name)) return name;
    this.names.add(name);
    this.items.push({ name, w: Math.max(1, w), h: Math.max(1, h), draw });
    return name;
  }

  /** Pack and paint everything into the texture `key` (replacing any texture of that name). */
  build(scene: Phaser.Scene, key: string) {
    let scale = DPR;
    const renderer = scene.game.renderer;
    const limit = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer
      ? Math.min(4096, renderer.getMaxTextureSize()) : MAX_SIZE;
    let maxSize = Math.min(MAX_SIZE, limit);
    let packed = this.pack(scale, maxSize);
    // Keep full device density on large screens before sacrificing detail to the 2048px limit.
    // Small rooms still use the smaller atlas; older GPUs retain the existing fallback.
    if (!packed && maxSize < limit) {
      maxSize = limit;
      packed = this.pack(scale, maxSize);
    }
    while (!packed && scale > 0.5) {
      scale *= 0.85;
      packed = this.pack(scale, maxSize);
    }
    if (!packed) throw new Error('the room does not fit in one texture');
    const canvas = document.createElement('canvas');
    canvas.width = packed.width;
    canvas.height = packed.height;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    for (const item of this.items) {
      context.save();
      context.translate(item.x!, item.y!);
      context.scale(scale, scale);
      item.draw(context);
      context.restore();
    }
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.addCanvas(key, canvas)!;
    for (const item of this.items) {
      texture.add(item.name, 0, item.x!, item.y!, Math.ceil(item.w * scale), Math.ceil(item.h * scale));
    }
    return key;
  }

  /** Shelf packing, tallest first. Returns the sheet's size, or null if it would not fit. */
  private pack(scale: number, maxSize: number): { width: number; height: number } | null {
    const sorted = [...this.items].sort((a, b) => b.h - a.h);
    let x = 0;
    let y = 0;
    let shelf = 0;
    let width = 0;
    for (const item of sorted) {
      const w = Math.ceil(item.w * scale) + GAP;
      const h = Math.ceil(item.h * scale) + GAP;
      if (w > maxSize) return null;
      if (x + w > maxSize) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      item.x = x;
      item.y = y;
      x += w;
      shelf = Math.max(shelf, h);
      width = Math.max(width, x);
    }
    const height = y + shelf;
    return height <= maxSize ? { width, height } : null;
  }
}
