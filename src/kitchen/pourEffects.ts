import Phaser from 'phaser';

import { CUP_LIP, WELL_BOTTOM, WELL_RUN } from './cupMarks';
import { pourLevel } from '../art/cupGeometry';
import { bakeCanvas, DPR } from '../game/view';
import { hexNumber, shade } from './color';

/** Where the cup is drawn right now: its visible top-left, its unscaled size, and its scale. */
export interface CupPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/**
 * The tea running out of a tap (`Stream` in pour.tsx). It is drawn in two halves split at the cup's
 * lip: above it the tea is in open air and goes over the cup; below it, it is inside the glass and
 * goes under it, so the glass tints it and the cat covers it. It ends at the drink's surface, so the
 * stream shortens as the cup fills.
 */
export class Stream {
  private readonly front: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private readonly glints: Phaser.GameObjects.Rectangle[];
  private readonly tail: Phaser.GameObjects.Rectangle;
  private flow = 0;
  private phase = 0;
  private tailAt = -1;
  running = false;

  constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly top: number, readonly color: string,
    frontDepth: number, backDepth: number) {
    const key = streamTexture(scene, color);
    this.front = scene.add.image(x, top, key).setOrigin(0.5, 0).setDepth(frontDepth);
    this.back = scene.add.image(x, top, key).setOrigin(0.5, 0).setDepth(backDepth);
    this.glints = [0, 0.33, 0.66].map(() => scene.add.rectangle(x, top, 1, 3, 0xFFF8E4).setDepth(frontDepth));
    this.tail = scene.add.rectangle(x, top, 2.4, 3.5, hexNumber(shade(color, 25))).setDepth(frontDepth).setAlpha(0);
  }

  setRunning(running: boolean) {
    if (running === this.running) return;
    this.running = running;
    if (running) {
      this.phase = 0;
      this.tailAt = -1;
    } else this.tailAt = 0;
  }

  /** False once it has run dry and its tail has fallen, so the caller can let it go. */
  update(delta: number, cup: CupPlacement, level: number): boolean {
    const target = this.running ? 1 : 0;
    const rate = delta / (this.running ? 160 : 140);
    this.flow = target > this.flow ? Math.min(1, this.flow + rate) : Math.max(0, this.flow - rate);
    if (this.running) this.phase = (this.phase + delta / 360) % 1;
    if (this.tailAt >= 0) this.tailAt = Math.min(1, this.tailAt + delta / 220);

    const height = cup.h * cup.scale;
    const lip = cup.y + CUP_LIP * height;
    const bottom = cup.y + height;
    const surface = cup.y + (WELL_BOTTOM - pourLevel(Math.min(1, Math.max(0, level))) * WELL_RUN) * height;
    const width = 3.5 * (0.88 + Math.sin(this.phase * Math.PI * 2) * 0.08);

    const segment = (image: Phaser.GameObjects.Image, from: number, to: number) => {
      const h = to - from;
      image.setVisible(h > 0.5 && this.flow > 0);
      if (h > 0.5) image.setPosition(this.x, from).setDisplaySize(width, h).setAlpha(this.flow);
    };
    segment(this.front, this.top, Math.min(surface, lip));
    segment(this.back, Math.max(this.top, lip), Math.min(surface, bottom));

    const run = Math.max(0, surface - this.top);
    this.glints.forEach((glint, i) => {
      const p = (this.phase + i * 0.33) % 1;
      const y = this.top + p * run;
      glint.setPosition(this.x - width * 0.2 + width * 0.125, y).setSize(width * 0.25, 3)
        .setAlpha(Math.sin(p * Math.PI) * 0.65 * this.flow).setVisible(this.flow > 0 && y < Math.min(surface, lip));
    });
    if (this.tailAt >= 0) {
      const t = this.tailAt * this.tailAt;
      this.tail.setPosition(this.x, this.top + run * t).setScale(1, 1.2).setAlpha(Math.sin(this.tailAt * Math.PI));
    } else this.tail.setAlpha(0);
    return this.running || this.flow > 0 || (this.tailAt >= 0 && this.tailAt < 1);
  }

  destroy() {
    this.front.destroy();
    this.back.destroy();
    for (const glint of this.glints) glint.destroy();
    this.tail.destroy();
  }
}

/** The falling tea, drawn once per colour: a rounded column shaded across, with a highlight. */
function streamTexture(scene: Phaser.Scene, color: string): string {
  const key = `stream-${color}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(8 * 2 * DPR);
  canvas.height = Math.round(100 * DPR);
  const c = canvas.getContext('2d')!;
  c.scale(canvas.width / 8, canvas.height / 100);
  const g = c.createLinearGradient(0, 0, 8, 0);
  g.addColorStop(0, shade(color, -40));
  g.addColorStop(0.36, shade(color, 40));
  g.addColorStop(0.62, color);
  g.addColorStop(1, shade(color, -25));
  c.fillStyle = g;
  c.fill(new Path2D('M1 0 Q0.5 8 1.5 20 Q2.5 50 1 100 H7 Q5.5 50 6.5 20 Q7.5 8 7 0 Z'));
  c.strokeStyle = 'rgba(255,230,187,0.7)';
  c.lineWidth = 0.65;
  c.stroke(new Path2D('M2.7 0 Q2 35 3 70 L2.7 100'));
  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * Tea running over the brim and down the side of the cup (`Spill`): three drops, each starting a
 * little later, falling as the level climbs past full. Drawn in the cup's own coordinates.
 */
export class Spill {
  readonly container: Phaser.GameObjects.Container;
  private readonly drops: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, private readonly cupW: number, private readonly cupH: number, color: string) {
    const key = bakeCanvas(scene, `spill-drop:${color}`, 4, 7, (c) => {
      c.globalAlpha = 0.85;
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(2, 3.5, 2, 3.5, 0, 0, Math.PI * 2);
      c.fill();
    });
    this.drops = [0.18, 0.5, 0.82].map((at) => scene.add.image(cupW * at - 2, cupH * 0.1, key).setOrigin(0).setDisplaySize(4, 7));
    this.container = scene.add.container(0, 0, this.drops);
  }

  update(level: number) {
    this.container.setVisible(level > 1.005);
    this.drops.forEach((drop, i) => {
      const over = Math.max(0, level - 1 - i * 0.12);
      drop.setAlpha(over > 0 ? 1 : 0);
      drop.setY(this.cupH * 0.1 + Math.min(1, over / 0.55) * this.cupH * 0.82);
    });
  }
}

/** The soft shadow a docked cup casts on the shelf under the tap. */
export function cupShadowTexture(scene: Phaser.Scene): string {
  const key = 'cup-contact-shadow';
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 40;
  const c = canvas.getContext('2d')!;
  c.scale(2, 2);
  c.save();
  c.translate(50, 10);
  c.scale(49, 9);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(88,49,28,0.27)');
  g.addColorStop(0.45, 'rgba(88,49,28,0.16)');
  g.addColorStop(1, 'rgba(88,49,28,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 1, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.fillStyle = 'rgba(88,49,28,0.12)';
  c.beginPath();
  c.ellipse(50, 10, 30, 2.3, 0, 0, Math.PI * 2);
  c.fill();
  scene.textures.addCanvas(key, canvas);
  return key;
}
