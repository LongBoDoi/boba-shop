import Phaser from 'phaser';
import { COUNTER_ROOMS } from '../art/counterRoomArt';
import { tex } from '../game/view';
import { DOOR_ART, doorPlacement } from './doorGeometry';
import type { CounterLayout } from './layout';

const FRAMES = 24;
/** Shared hinged door. FIFO leases prevent two cats walking through each other in the opening. */
export class Doorway {
  readonly placement;
  readonly outsideMask: Phaser.Display.Masks.GeometryMask;
  private maskShape: Phaser.GameObjects.Graphics;
  private garden: Phaser.GameObjects.Image;
  private leaf: Phaser.GameObjects.Image;
  private keys: string[] = [];
  private queue: number[] = [];
  private owner: number | null = null;
  private opening = 0;
  private target = 0;
  private closing = false;
  private shown = -1;
  private closedKey: string;
  private outsideKey: string;

  constructor(private scene: Phaser.Scene, layout: CounterLayout) {
    this.placement = doorPlacement(layout);
    const p = this.placement, art = DOOR_ART[layout.room.orientation];
    const source = scene.textures.get(tex(COUNTER_ROOMS[layout.room.orientation].image)).getSourceImage() as HTMLImageElement;
    const prefix = `counter:door:${layout.room.orientation}`;
    const backgroundKey = `${prefix}:outside`;
    this.closedKey = `${prefix}:closed`;
    this.outsideKey = backgroundKey;
    if (!scene.textures.exists(this.closedKey)) {
      const original = document.createElement('canvas'); original.width = art.width; original.height = art.height;
      original.getContext('2d')!.drawImage(source, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
      scene.textures.addCanvas(this.closedKey, original);
    }
    if (!scene.textures.exists(backgroundKey)) {
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height;
      const c = canvas.getContext('2d')!;
      // Join the original unobstructed garden panes behind the hinged leaf. Closed doors use
      // an exact source crop, so the room does not acquire a blur or a different window design.
      const total = art.panes.reduce((sum, pane) => sum + pane[1], 0);
      for (const side of [0, 1]) {
        let y = 0;
        const [column, w] = art.columns[side];
        for (const [top, h] of art.panes) {
          const height = h / total * art.height;
          c.drawImage(source, art.x + side * art.width / 2 + column, art.y + top, w, h,
            side * art.width / 2, y, art.width / 2, height + .5);
          y += height;
        }
      }
      const light = c.createLinearGradient(0, 0, 0, art.height);
      light.addColorStop(0, '#ffe6b71a'); light.addColorStop(.8, '#fff5dc22'); light.addColorStop(1, '#f4d6a65c');
      c.fillStyle = light; c.fillRect(0, 0, art.width, art.height);
      scene.textures.addCanvas(backgroundKey, canvas);
    }
    this.keys.push(backgroundKey);
    this.garden = scene.add.image(p.x, p.y, this.closedKey).setOrigin(0).setDisplaySize(p.width, p.height).setDepth(1);
    const panel = document.createElement('canvas'); panel.width = art.width; panel.height = art.height;
    const c = panel.getContext('2d')!; c.drawImage(source, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
    const half = art.width / 2;
    // Glass is transparent; mullions, handles and golden painted wood retain the source pixels.
    for (const offset of [0, half]) for (const [y, h] of art.panes) {
      for (const [column, w] of art.columns) {
        const x = offset + column;
        c.clearRect(x, y, w, h);
        c.fillStyle = '#fff7d91c'; c.fillRect(x, y, w, h);
      }
    }
    for (let i = 0; i <= FRAMES; i++) {
      const key = `${prefix}:${i}`; this.keys.push(key);
      if (scene.textures.exists(key)) continue;
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height + 45;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(panel, half, 0, half, art.height, half, 0, half, art.height);
      const angle = i / FRAMES * Math.PI * .44, squeeze = Math.cos(angle), forward = Math.sin(angle);
      // Affine vertical strips give the painted leaf real perspective on the Canvas renderer.
      for (let x = 0; x < half; x++) {
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
    this.maskShape = scene.make.graphics({ x: 0, y: 0 });
    this.maskShape.fillStyle(0xffffff).fillRect(p.x + 2 * layout.room.scale, p.y, p.width - 4 * layout.room.scale, p.height);
    this.outsideMask = this.maskShape.createGeometryMask();
    this.keys.push(this.closedKey);
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
      this.garden.setTexture(frame === 0 ? this.closedKey : this.outsideKey);
    }
  }
  destroy() {
    this.garden.destroy(); this.leaf.destroy(); this.outsideMask.destroy(); this.maskShape.destroy();
    for (const key of this.keys) this.scene.textures.remove(key);
  }
}
