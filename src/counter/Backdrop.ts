import Phaser from 'phaser';

import { counterSvg } from '../art/counter';
import { counterTopSvg } from '../art/counterTop';
import { backdropClouds, backdropWindow, cloudSvg, cloudX, CloudSpec, shopBackdropSvg, WindowRect } from '../art/shopBackdrop';
import { addText } from '../game/view';
import { setBaseline } from './CustomerView';
import { COUNTER_HEIGHT, CounterLayout } from './layout';
import { SHARED, TextureBank } from './textures';

/**
 * Everything on the counter page that is not a customer: the shop's wall behind them
 * (`ShopBackdrop`), the rim of the counter they stand behind (`Counter`), and the barista's side
 * of the counter filling the page below (`CounterTop`). All still pictures, drawn once per layout,
 * except the two clouds drifting across the window — and those only while the counter can be seen.
 *
 * The wall comes in two sheets with the clouds between them, as the original stacks its views:
 * the clouds pass behind the window's cross-bars, its sill and the plant on it.
 *
 * A new layout keeps showing the old pictures until all of its own are drawn, then swaps them in
 * one frame, so turning the phone does not flash the shop away.
 */
export const DEPTH = { floor: 0, back: 1, clouds: 2, menu: 3, front: 4, rim: 100 };

/**
 * The board's lettering. A rasterised SVG cannot see the page's fonts, so the `back` sheet would
 * draw it in the system face; it is left out of the sheet and set in Baloo 2 over the board.
 */
const MENU_TEXT = /<text\b[^>]*>MENU<\/text>/;

export class Backdrop {
  private back: Phaser.GameObjects.Image;
  private front: Phaser.GameObjects.Image;
  private rim: Phaser.GameObjects.Image;
  private floor: Phaser.GameObjects.Image;
  private menu: Phaser.GameObjects.Container;
  private menuText: Phaser.GameObjects.Text;
  private clouds: { image: Phaser.GameObjects.Image; spec: CloudSpec; progress: number }[] = [];
  private window: WindowRect | null = null;
  private generation = 0;
  private owner: string | null = null;

  constructor(private scene: Phaser.Scene, private bank: TextureBank) {
    const hidden = (depth: number) => scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false).setDepth(depth);
    this.floor = hidden(DEPTH.floor);
    this.back = hidden(DEPTH.back);
    this.front = hidden(DEPTH.front);
    this.rim = hidden(DEPTH.rim);
    this.menuText = addText(scene, 0, 0, 'MENU', { size: 13, weight: 800, color: '#FFFFFF' }).setOrigin(0.5, 0);
    this.menu = scene.add.container(0, 0, [this.menuText]).setDepth(DEPTH.menu).setVisible(false);
  }

  /** Draw the still pictures for a layout; they replace the old ones when all are ready. */
  build(layout: CounterLayout) {
    const generation = ++this.generation;
    const owner = `layout:${generation}`;
    const { width, stageHeight, floorHeight } = layout;
    const size = `${width}x${stageHeight}`;
    const jobs: Promise<string | null>[] = [
      this.bank.get(owner, `counter:back:${size}`, () => shopBackdropSvg(width, stageHeight, 'back').replace(MENU_TEXT, ''), width, stageHeight),
      this.bank.get(owner, `counter:front:${size}`, () => shopBackdropSvg(width, stageHeight, 'front'), width, stageHeight),
      this.bank.get(owner, `counter:rim:${width}`, () => counterSvg(width, COUNTER_HEIGHT), width, COUNTER_HEIGHT),
      floorHeight > 0
        ? this.bank.get(owner, `counter:floor:${width}x${floorHeight}`, () => counterTopSvg(width, floorHeight), width, floorHeight)
        : Promise.resolve(null),
    ];
    const specs = backdropClouds(width, stageHeight);
    for (const spec of specs) {
      jobs.push(this.bank.get(SHARED, `counter:cloud:${spec.size}`, () => cloudSvg(spec.size), spec.size * 1.5, spec.size * 0.8));
    }

    void Promise.all(jobs).then(([back, front, rim, floor, ...clouds]) => {
      if (generation !== this.generation) return;
      const show = (image: Phaser.GameObjects.Image, key: string | null, x: number, y: number, w: number, h: number) => {
        if (!key) { image.setVisible(false); return; }
        image.setTexture(key).setPosition(x, y).setDisplaySize(w, h).setVisible(true);
      };
      show(this.back, back, 0, 0, width, stageHeight);
      show(this.front, front, 0, 0, width, stageHeight);
      show(this.rim, rim, 0, stageHeight - COUNTER_HEIGHT, width, COUNTER_HEIGHT);
      show(this.floor, floor, 0, stageHeight, width, floorHeight);

      // The board's lettering, in Baloo 2, turned with the board: 3° back about its centre.
      const board = { w: Math.min(104, width * 0.27), h: stageHeight * 0.4 };
      const boardX = width - board.w - width * 0.05;
      const boardY = 16 + 14;
      const cx = boardX + board.w / 2;
      const cy = boardY + board.h / 2;
      this.menu.setPosition(cx, cy).setAngle(-3).setVisible(true);
      setBaseline(this.menuText, 0, boardY + 20 - cy);

      this.window = backdropWindow(width, stageHeight);
      for (const cloud of this.clouds) cloud.image.destroy();
      this.clouds = specs.map((spec, i) => {
        const was = this.clouds[i];
        const image = this.scene.add.image(0, 0, clouds[i] ?? '__DEFAULT').setOrigin(0).setDepth(DEPTH.clouds)
          .setVisible(Boolean(clouds[i]));
        if (clouds[i]) image.setDisplaySize(spec.size * 1.5, spec.size * 0.8);
        return { image, spec, progress: was?.progress ?? spec.offset };
      });
      this.placeClouds();

      if (this.owner) this.bank.release(this.owner);
      this.owner = owner;
    });
  }

  /**
   * Move the clouds on by `delta` ms. Each one finishes the pass it is on, then loops full passes
   * from the window's left edge, at the same constant speed.
   */
  drift(delta: number) {
    if (!this.clouds.length) return;
    for (const cloud of this.clouds) {
      cloud.progress += delta / cloud.spec.duration;
      if (cloud.progress >= 1) cloud.progress %= 1;
    }
    this.placeClouds();
  }

  /**
   * Each cloud cropped to the window's glass. The glass has 7px corners, but no cloud ever rides
   * high or low enough to reach one (the top one is 12% down a window at least 100px tall), so a
   * rectangular crop is the original's rounded `overflow: hidden` exactly.
   */
  private placeClouds() {
    const win = this.window;
    if (!win) return;
    for (const { image, spec, progress } of this.clouds) {
      const w = spec.size * 1.5;
      const x = cloudX(progress, win.w, spec.size);
      image.setPosition(win.x + x, win.y + spec.top);
      const from = Math.max(0, -x);
      const to = Math.min(w, win.w - x);
      if (to <= from || !image.texture || image.texture.key === '__DEFAULT') {
        image.setVisible(false);
        continue;
      }
      const scale = image.frame.realWidth / w;
      image.setCrop(from * scale, 0, (to - from) * scale, image.frame.realHeight).setVisible(true);
    }
  }

  destroy() {
    this.generation++;
    if (this.owner) this.bank.release(this.owner);
    this.owner = null;
  }
}
