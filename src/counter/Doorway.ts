import Phaser from 'phaser';
import { COUNTER_ROOMS } from '../art/counterRoomArt';
import { tex } from '../game/view';
import { DOOR_ART, doorPlacement } from './doorGeometry';
import type { CounterLayout } from './layout';

const FRAMES = 30;
const OPEN_MS = 620;
/** Shared hinged door. FIFO leases prevent two cats walking through each other in the opening. */
export class Doorway {
  readonly placement;
  private walls: Phaser.GameObjects.Image[] = [];
  private garden: Phaser.GameObjects.Image;
  private leftLeaf: Phaser.GameObjects.Image;
  private keys: string[] = [];
  private queue: number[] = [];
  private owner: number | null = null;
  private opening = 0;
  private target = 0;
  private closing = false;
  private shown = -1;
  private prefix = '';

  constructor(private scene: Phaser.Scene, layout: CounterLayout) {
    this.placement = doorPlacement(layout);
    const p = this.placement, art = DOOR_ART[layout.room.orientation];
    const source = scene.textures.get(tex(COUNTER_ROOMS[layout.room.orientation].image)).getSourceImage() as HTMLImageElement;
    const prefix = `counter:door:${layout.room.orientation}`;
    this.prefix = prefix;
    const half = art.width / 2, glass = art.glass, handle = art.handle;
    const insideGlass = (x: number, y: number) => x >= glass.x && x < glass.x + glass.width &&
      y >= glass.y && y < glass.y + glass.height;
    const movingWood = (x: number, y: number) => {
      if (x >= half || (x < art.foregroundLeft.x && y >= art.foregroundLeft.y)) return false;
      return x < glass.x || x >= glass.x + glass.width || y < glass.y || y >= glass.y + glass.height;
    };
    const inPawClear = (x: number, y: number) => {
      const paw = art.pawClear;
      return ((x - paw.x) / paw.rx) ** 2 + ((y - paw.y) / paw.ry) ** 2 <= 1;
    };
    const paintedDetail = (x: number, y: number) => {
      if (x >= handle.x - 1 && x < handle.x + handle.width + 1 &&
        y >= handle.y - 1 && y < handle.y + handle.height + 1) return true;
      return inPawClear(x, y);
    };
    const movingDetail = (x: number, y: number) => {
      const radius = handle.width / 2, centerX = handle.x + radius;
      const inHandle = x >= handle.x && x < handle.x + handle.width && y >= handle.y &&
        y < handle.y + handle.height &&
        (y >= handle.y + radius && y < handle.y + handle.height - radius ||
          (x - centerX) ** 2 + (y - (y < handle.y + radius ? handle.y + radius : handle.y + handle.height - radius)) ** 2 <= radius ** 2);
      return inHandle || art.paw.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
    };
    const backgroundKey = `${prefix}:outside`;
    if (!scene.textures.exists(backgroundKey)) {
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height;
      const c = canvas.getContext('2d')!;
      c.drawImage(source, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
      const original = c.getImageData(0, 0, art.width, art.height);
      const result = c.getImageData(0, 0, art.width, art.height);
      const paw = art.pawClear;
      // Keep the entire right door and the garden in their painted positions. Only pixels hidden
      // by details of the moving left leaf need a stationary outdoor reconstruction.
      for (let y = 0; y < art.height; y++) for (let x = 0; x < half; x++) {
        if (!movingWood(x, y) && !paintedDetail(x, y)) continue;
        if (movingWood(x, y)) {
          const edgeX = glass.x + glass.width - 1, edgeY = glass.y + glass.height - 1;
          let sx = x < glass.x ? glass.x + glass.x - x - 1 : x > edgeX ? edgeX + edgeX - x + 1 : x;
          const sy = y < glass.y ? glass.y + glass.y - y - 1 : y > edgeY ? edgeY + edgeY - y + 1 : y;
          sx = Math.max(glass.x, Math.min(edgeX, sx));
          const direction = sx > glass.x + glass.width / 2 ? -1 : 1;
          while (insideGlass(sx, sy) && paintedDetail(sx, sy)) sx += direction;
          if (insideGlass(sx, sy)) {
            const at = (y * art.width + x) * 4, from = (sy * art.width + sx) * 4;
            for (let channel = 0; channel < 3; channel++) result.data[at + channel] = original.data[from + channel];
            continue;
          }
        }
        if (inPawClear(x, y)) {
          const at = (y * art.width + x) * 4;
          const donorY = Math.min(glass.y + glass.height - 1, y + paw.ry * 2 + 4);
          const fallback = (donorY * art.width + x) * 4;
          const edge = (1 - Math.sqrt(((x - paw.x) / paw.rx) ** 2 + ((y - paw.y) / paw.ry) ** 2)) * Math.min(paw.rx, paw.ry);
          const mix = Math.max(0, Math.min(1, edge / 2));
          for (let channel = 0; channel < 3; channel++) {
            const donor = original.data[fallback + channel];
            result.data[at + channel] = original.data[at + channel] * (1 - mix) + donor * mix;
          }
          continue;
        }
        const at = (y * art.width + x) * 4, from = (y * art.width + x - 24) * 4;
        for (let channel = 0; channel < 3; channel++) result.data[at + channel] = original.data[from + channel];
      }
      c.putImageData(result, 0, 0);
      scene.textures.addCanvas(backgroundKey, canvas);
    }
    this.keys.push(backgroundKey);
    this.garden = scene.add.image(p.x, p.y, backgroundKey).setOrigin(0).setDisplaySize(p.width, p.height).setDepth(1);
    const panel = document.createElement('canvas'); panel.width = art.width; panel.height = art.height;
    const c = panel.getContext('2d')!;
    c.drawImage(source, art.x, art.y, half, art.height, 0, 0, half, art.height);
    // Mask the complete source crop down to leaf wood and its painted details. This excludes
    // scenery beside the center stile and foreground furniture that overlaps the portrait door.
    const pixels = c.getImageData(0, 0, art.width, art.height);
    for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
      if (!movingWood(x, y) && !movingDetail(x, y)) pixels.data[(y * art.width + x) * 4 + 3] = 0;
    }
    c.putImageData(pixels, 0, 0);
    for (let i = 0; i <= FRAMES; i++) {
      const key = `${prefix}:left:${i}`; this.keys.push(key);
      if (scene.textures.exists(key)) continue;
      const canvas = document.createElement('canvas'); canvas.width = art.width; canvas.height = art.height + 45;
      const ctx = canvas.getContext('2d')!;
      const angle = i / FRAMES * Math.PI * .38, squeeze = Math.cos(angle), shear = Math.sin(angle) * .075;
      if (i === 0) ctx.drawImage(panel, 0, 0, half, art.height, 0, 0, half, art.height);
      else {
        ctx.transform(squeeze, shear, 0, 1, 0, 0);
        ctx.drawImage(panel, 0, 0, half, art.height, 0, 0, half, art.height);
      }
      scene.textures.addCanvas(key, canvas);
    }
    this.leftLeaf = scene.add.image(p.x, p.y, `${prefix}:left:0`).setOrigin(0)
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
    const step = Math.min(delta, 50) / OPEN_MS;
    this.opening = this.target > this.opening ? Math.min(this.target, this.opening + step)
      : Math.max(this.target, this.opening - step);
    if (this.opening === 0) this.closing = false;
    // Smoothstep keeps the hinge movement gentle at both ends without slowing the whole action.
    const eased = this.opening * this.opening * (3 - 2 * this.opening);
    const frame = Math.round(eased * FRAMES);
    if (frame !== this.shown) {
      this.shown = frame;
      this.leftLeaf.setTexture(`${this.prefix}:left:${frame}`);
    }
  }
  destroy() {
    this.garden.destroy(); this.leftLeaf.destroy();
    for (const wall of this.walls) wall.destroy();
    for (const key of this.keys) this.scene.textures.remove(key);
  }
}
