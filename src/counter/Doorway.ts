import Phaser from 'phaser';
import { COUNTER_ROOMS } from '../art/counterRoomArt';
import { tex } from '../game/view';
import { DOOR_ART, doorPlacement } from './doorGeometry';
import type { CounterLayout } from './layout';

const FRAMES = 24;
/** Shared hinged door. FIFO leases prevent two cats walking through each other in the opening. */
export class Doorway {
  readonly placement;
  private walls: Phaser.GameObjects.Image[] = [];
  private garden: Phaser.GameObjects.Image;
  private leaf: Phaser.GameObjects.Image;
  private keys: string[] = [];
  private queue: number[] = [];
  private owner: number | null = null;
  private opening = 0;
  private target = 0;
  private closing = false;
  private shown = -1;

  constructor(private scene: Phaser.Scene, layout: CounterLayout) {
    this.placement = doorPlacement(layout);
    const p = this.placement, art = DOOR_ART[layout.room.orientation];
    const source = scene.textures.get(tex(COUNTER_ROOMS[layout.room.orientation].image)).getSourceImage() as HTMLImageElement;
    const prefix = `counter:door:${layout.room.orientation}`;
    const backgroundKey = `${prefix}:outside`;
    if (!scene.textures.exists(backgroundKey)) {
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height;
      const c = canvas.getContext('2d')!;
      c.drawImage(source, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
      const original = c.getImageData(0, 0, art.width, art.height), result = c.getImageData(0, 0, art.width, art.height);
      const panes = [0, art.width / 2].flatMap(offset => art.columns.flatMap(([x, w]) =>
        art.panes.map(([y, h]) => ({ x: Math.ceil(x + offset), y, right: Math.floor(x + offset + w - 1), bottom: y + h - 1 }))));
      // Preserve every visible garden pixel at its original coordinate. Only the wood/handle
      // occlusions are reconstructed, once, from adjacent glass samples. This ONE stationary
      // garden is used for both open and closed doors; there is no scenery/lighting swap.
      for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
        if (panes.some(r => x >= r.x && x <= r.right && y >= r.y && y <= r.bottom)) continue;
        const nearest = panes.map(r => {
          const px = Math.max(r.x, Math.min(r.right, x)), py = Math.max(r.y, Math.min(r.bottom, y));
          return { at: (py * art.width + px) * 4, distance: (px - x) ** 2 + (py - y) ** 2 };
        }).sort((a, b) => a.distance - b.distance).slice(0, 4);
        const weights = nearest.map(n => 1 / Math.max(1, n.distance) ** 2), total = weights.reduce((a, b) => a + b, 0);
        const at = (y * art.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) result.data[at + channel] = nearest.reduce((sum, n, i) => sum + original.data[n.at + channel] * weights[i], 0) / total;
      }
      c.putImageData(result, 0, 0);
      scene.textures.addCanvas(backgroundKey, canvas);
    }
    this.keys.push(backgroundKey);
    this.garden = scene.add.image(p.x, p.y, backgroundKey).setOrigin(0).setDisplaySize(p.width, p.height).setDepth(1);
    const panel = document.createElement('canvas'); panel.width = art.width; panel.height = art.height;
    const c = panel.getContext('2d')!; c.drawImage(source, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
    const half = art.width / 2;
    // Glass is transparent; mullions, handles and golden painted wood retain the source pixels.
    for (const offset of [0, half]) for (const [y, h] of art.panes) {
      for (const [column, w] of art.columns) {
        const x = offset + column;
        c.clearRect(x, y, w, h);

      }
    }
    for (let i = 0; i <= FRAMES; i++) {
      const key = `${prefix}:${i}`; this.keys.push(key);
      if (scene.textures.exists(key)) continue;
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height + 45;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(panel, half, 0, half, art.height, half, 0, half, art.height);
      const angle = i / FRAMES * Math.PI * .44, squeeze = Math.cos(angle), forward = Math.sin(angle);
      // Bake the painted leaf into perspective frames for the WebGL/Canvas texture cache.
      if (i === 0) ctx.drawImage(panel, 0, 0);
      else for (let x = 0; x < half; x++) {
        const depth = x / half * forward;
        ctx.drawImage(panel, x, 0, 1, art.height, x * squeeze, depth * 8,
          squeeze + .55, art.height + depth * 25);
      }
      if (i > 0) {
        ctx.strokeStyle = '#8d552c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(half * squeeze, forward * 8);
        ctx.lineTo(half * squeeze, art.height + forward * 33); ctx.stroke();
      }
      scene.textures.addCanvas(key, canvas);
    }
    this.leaf = scene.add.image(p.x, p.y, `${prefix}:0`).setOrigin(0)
      .setDisplaySize(p.width, (art.height + 45) * layout.room.scale).setDepth(3);
    // Opaque room strips hide exterior actors outside the aperture on WebGL and Canvas alike.
    // They reuse the original texture; no unsupported GeometryMask or extra offscreen filter.
    const crops = [[0, 0, art.x, source.height], [art.x + art.width, 0, source.width - art.x - art.width, source.height],
      [art.x, 0, art.width, art.y], [art.x, art.y + art.height, art.width, source.height - art.y - art.height]];
    this.walls = crops.map(([x, y, width, height]) => scene.add.image(layout.room.x, layout.room.y,
      tex(COUNTER_ROOMS[layout.room.orientation].image)).setOrigin(0).setDisplaySize(layout.room.width, layout.room.height)
      .setCrop(x, y, width, height).setDepth(2.5));

  }

  request(id: number) {
    if (this.owner !== id && !this.queue.includes(id)) this.queue.push(id);
    if (this.owner === null && !this.closing) this.owner = this.queue.shift() ?? null;
    return this.owner === id;
  }
  open(id: number) { if (this.owner === id) this.target = 1; }
  isOpen(id: number) { return this.owner === id && this.opening >= .99; }
  release(id: number) {
    this.queue = this.queue.filter(candidate => candidate !== id);
    if (this.owner !== id) return;
    this.owner = null; this.target = 0; this.closing = true;
  }
  update(delta: number) {
    const step = Math.min(delta, 50) / 850;
    this.opening = this.target > this.opening ? Math.min(this.target, this.opening + step)
      : Math.max(this.target, this.opening - step);
    if (this.opening === 0) this.closing = false;
    const frame = Math.round(this.opening * FRAMES);
    if (frame !== this.shown) {
      this.shown = frame; this.leaf.setTexture(this.keys[frame + 1]);

    }
  }
  destroy() {
    this.garden.destroy(); this.leaf.destroy();
    for (const wall of this.walls) wall.destroy();
    for (const key of this.keys) this.scene.textures.remove(key);
  }
}
