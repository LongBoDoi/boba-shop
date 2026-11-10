import Phaser from 'phaser';
import atlas from '../assets/counter/cafe-cats-atlas-v1.png';
import { tex } from '../game/view';
import { CounterLayout } from './layout';

type CatSpot = { sprite: number; x: number; y: number; width: number; phase: number; floor?: boolean };
type Cat = { root: Phaser.GameObjects.Container; picture: Phaser.GameObjects.Image;
  heart: Phaser.GameObjects.Text; x: number; y: number; phase: number; petAt: number; baseScale: number };

const SPOTS: Record<'portrait' | 'landscape', CatSpot[]> = {
  portrait: [
    { sprite: 0, x: 245, y: 690, width: 92, phase: 2.5 },
    { sprite: 1, x: 812, y: 691, width: 79, phase: 3.2 },
    { sprite: 5, x: 333, y: 932, width: 118, phase: 4.1, floor: true },
    { sprite: 0, x: 842, y: 972, width: 138, phase: 4.9 },
  ],
  landscape: [
    { sprite: 2, x: 386, y: 275, width: 112, phase: 0 },
    { sprite: 0, x: 549, y: 359, width: 115, phase: 2.2 },
    { sprite: 5, x: 769, y: 465, width: 95, phase: 4.3, floor: true },
    { sprite: 1, x: 1235, y: 464, width: 87, phase: 5.4, floor: true },
    { sprite: 0, x: 1575, y: 386, width: 119, phase: 6.0 },
    { sprite: 1, x: 1980, y: 468, width: 88, phase: 3.1, floor: true },
  ],
};

/** Cats live above the painting as their own complete silhouettes; no background pixels move. */
export class CafeCats {
  private cats: Cat[] = [];
  private clock = 0;
  private keys: string[] = [];
  private cooldown = 0;

  constructor(private scene: Phaser.Scene) {}

  build(layout: CounterLayout) {
    this.clear();
    const sourceKey = tex(atlas);
    if (!this.scene.textures.exists(sourceKey)) return;
    const source = this.scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
    // The sheet was designed in equal cells; tight crops remove empty transparent padding.
    const boxes = [
      { x: 48, y: 140, w: 438, h: 298 },
      { x: 72, y: 38, w: 360, h: 420 },
      { x: 82, y: 152, w: 344, h: 274 },
      { x: 24, y: 55, w: 450, h: 380 },
    ];
    const spriteIndex = [0, 1, 2, 5];
    for (let n = 0; n < boxes.length; n++) {
      const box = boxes[n];
      const key = `counter:cafe-cat:${spriteIndex[n]}`;
      if (!this.scene.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = box.w; canvas.height = box.h;
        canvas.getContext('2d')!.drawImage(source, box.x + spriteIndex[n] % 3 * 512,
          box.y + Math.floor(spriteIndex[n] / 3) * 512, box.w, box.h, 0, 0, box.w, box.h);
        this.scene.textures.addCanvas(key, canvas);
      }
      this.keys.push(key);
    }
    for (const spot of SPOTS[layout.room.orientation]) {
      const key = `counter:cafe-cat:${spot.sprite}`;
      const x = spot.x * layout.room.scale;
      const y = layout.room.y + spot.y * layout.room.scale;
      const width = spot.width * layout.room.scale;
      const image = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
      image.setDisplaySize(width, width * image.height / image.width);
      const root = this.scene.add.container(x, y).setDepth(spot.floor ? 8 : 3);
      if (spot.floor) {
        const shadow = this.scene.add.ellipse(0, -1, width * 0.78, Math.max(2, width * 0.13), 0x986c48, 0.13);
        root.add(shadow);
      }
      root.add(image);
      const heart = this.scene.add.text(0, -image.displayHeight - 4, '♥', {
        color: '#ef8c91', fontFamily: 'Arial', fontSize: `${Math.max(17, width * 0.27)}px`,
        stroke: '#fff9ef', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      root.add(heart);
      this.cats.push({ root, picture: image, heart, x, y, phase: spot.phase,
        petAt: -10000, baseScale: image.scaleX });
    }
  }

  at(x: number, y: number): number | null {
    for (let i = this.cats.length - 1; i >= 0; i--) {
      const cat = this.cats[i];
      const width = cat.picture.displayWidth, height = cat.picture.displayHeight;
      if (x >= cat.x - width * 0.55 && x <= cat.x + width * 0.55
        && y >= cat.y - height && y <= cat.y + Math.max(8, height * 0.13)) return i;
    }
    return null;
  }

  pet(index: number): boolean {
    if (!this.cats[index] || this.clock < this.cooldown) return false;
    this.cats[index].petAt = this.clock;
    this.cooldown = this.clock + 650;
    return true;
  }

  update(delta: number, reduced: boolean) {
    this.clock += delta;
    for (const cat of this.cats) {
      const age = this.clock - cat.petAt;
      const reaction = age < 620 ? Math.sin(Math.PI * age / 620) : 0;
      const breath = reduced ? 0 : Math.sin(this.clock * 0.003 + cat.phase);
      cat.root.setPosition(cat.x, cat.y - (reduced ? 0 : breath * 2.1) - reaction * 10);
      cat.root.setRotation(reduced ? 0 : Math.sin(this.clock * 0.0018 + cat.phase) * 0.052 + reaction * 0.055);
      cat.picture.setScale(cat.baseScale * (1 + breath * 0.010 + reaction * 0.045),
        cat.baseScale * (1 + breath * 0.022 + reaction * 0.045));
      cat.heart.setAlpha(age > 0 && age < 900 ? (1 - age / 900) * 0.96 : 0);
      cat.heart.y = -cat.picture.displayHeight - 4 - Math.max(0, Math.min(900, age)) * 0.024;
    }
  }

  destroy() {
    this.clear();
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.keys = [];
  }

  private clear() {
    for (const cat of this.cats) cat.root.destroy();
    this.cats = [];
  }
}
