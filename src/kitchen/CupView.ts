import Phaser from 'phaser';

import { Drink } from '../game/ingredients';
import { CUP_FINISH_RISE, paintLid, paintStraw } from '../art/finishingArt';
import {
  CUP_CREAM, CUP_ICE, DRINK, DRINK_MILKY, DRINK_MILKY_TOP, DRINK_TOP,
} from '../art/kitchenArt';
import { TOPPING_PIECES } from '../art/toppingArt';
import { createIceLayout, IcePlacement } from '../art/iceLayout';
import { ICE_LEVELS } from '../game/ingredients';
import { bakeCanvas, canvasFont, DPR, tex } from '../game/view';
import { card, measure } from './equipment';
import { CupImages, CupPainter } from './cupPainter';
import { CUP_GLASS, frontalCupGlass } from '../art/frontalCupArt';
import { CUP_OVERFLOW } from './creamPainter';
import { KITCHEN_TEXT_MIN } from './typography';
import { easeOut } from './motion';

const SETTLE_MS = 340;

let viewCount = 0;

function images(scene: Phaser.Scene): CupImages {
  const img = (asset: string) => scene.textures.get(tex(asset)).getSourceImage() as CanvasImageSource;
  return {
    sprite: frontalCupGlass(img(CUP_GLASS)),
    cream: img(CUP_CREAM),
    ice: img(CUP_ICE),
    pieces: img(TOPPING_PIECES),
    drink: (teaId, milky) => ({
      body: (milky ? DRINK_MILKY : DRINK)[teaId] ? img((milky ? DRINK_MILKY : DRINK)[teaId]) : undefined,
      top: (milky ? DRINK_MILKY_TOP : DRINK_TOP)[teaId] ? img((milky ? DRINK_MILKY_TOP : DRINK_TOP)[teaId]) : undefined,
    }),
  };
}

/**
 * The cup as it stands in the room: the glass backing, the painted drink (see `cupPainter.ts`),
 * the reflections, the rolled lip and the clear rounded base — and the size tag beside it.
 *
 * Its origin is its top-left corner and it scales from there, so `x`/`y` are always where the cup
 * visibly starts, whatever size it is drawn at under a tap.
 */
export class CupView {
  readonly container: Phaser.GameObjects.Container;
  private readonly painter: CupPainter;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly key: string;
  private drink: Drink;
  private cupId = -1;
  private iceLayout: IcePlacement[] = createIceLayout(1);
  private iceStart: number[] = [];
  private portionStart: number[] = [];
  private levelValue = 0;
  private pouring = false;
  private agitation = 0;
  private phase = 0;
  private dirty = true;
  private readonly sizeTag: Phaser.GameObjects.Image;
  private sizeTagWidth = 0;
  private readonly finish: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene, readonly width: number, readonly height: number, drink: Drink) {
    this.key = `cup-canvas-${++viewCount}`;
    this.drink = drink;
    this.painter = new CupPainter(images(scene), width * DPR, height * DPR);
    this.texture = scene.textures.addCanvas(this.key, this.painter.canvas)!;

    // The texture extends above the rim for cream; front glass still covers its lower portion.
    const overflow = height * CUP_OVERFLOW;
    const drawn = scene.add.image(0, -overflow, this.key).setOrigin(0)
      .setDisplaySize(width, height + overflow);

    this.sizeTag = scene.add.image(width + 6, 0, '__DEFAULT').setOrigin(1, 0).setVisible(false);
    this.finish = scene.add.image(0, -overflow, '__DEFAULT').setOrigin(0).setVisible(false);
    this.container = scene.add.container(0, 0, [drawn, this.finish, this.sizeTag]);
    this.setDrink(drink, 0, true);
  }

  setFinish(lidded: boolean, straw: boolean) {
    this.finish.setVisible(lidded);
    if (!lidded) return;
    const overflow = this.height * CUP_FINISH_RISE / 174;
    const key = bakeCanvas(this.scene, `cup-finish:${this.width}:${straw}`, this.width, this.height + overflow, (c) => {
      c.scale(this.width / 113, this.height / 174);
      c.translate(0, CUP_FINISH_RISE);
      paintLid(c, this.scene.textures.get(tex(CUP_GLASS)).getSourceImage() as CanvasImageSource);
      if (straw) paintStraw(c, this.scene.textures.get(tex(CUP_GLASS)).getSourceImage() as CanvasImageSource, true);
    });
    this.finish.setY(-overflow).setTexture(key).setDisplaySize(this.width, this.height + overflow);
  }

  /** The drink changed. New portions and new cubes drop into place; a new cup starts as it is. */
  setDrink(drink: Drink, cupId: number, instant = false) {
    const now = this.scene.time.now;
    const fresh = cupId !== this.cupId;
    if (fresh) {
      this.cupId = cupId;
      this.iceLayout = createIceLayout(cupId || 1);
      this.iceStart = [];
      this.portionStart = [];
    }
    const settledAt = instant || fresh ? -Infinity : now;
    const cubes = ICE_LEVELS.find((option) => option.id === drink.ice)?.cubes ?? 0;
    for (let i = 0; i < cubes; i++) if (this.iceStart[i] === undefined) this.iceStart[i] = settledAt;
    this.iceStart.length = cubes;
    drink.toppings.forEach((_id, i) => { if (this.portionStart[i] === undefined) this.portionStart[i] = settledAt; });
    this.portionStart.length = drink.toppings.length;
    if (drink.size !== this.drink.size || fresh) this.drawSizeTag(drink.size);
    this.drink = drink;
    this.dirty = true;
  }

  get level() {
    return this.levelValue;
  }

  set level(value: number) {
    if (value === this.levelValue) return;
    this.levelValue = value;
    this.dirty = true;
  }

  /** The tap is open: ripples and bubbles, which settle out once it closes. */
  setPouring(pouring: boolean) {
    this.pouring = pouring;
    this.dirty = true;
  }

  /** Advance whatever is moving, and repaint if anything did. Called once a frame. */
  update(time: number, delta: number) {
    const tagScale = 1 / Math.max(0.01, Math.min(1, this.container.scaleX));
    const tagWidth = this.sizeTagWidth * tagScale;
    // Preserve CSS dimensions: setting the raw scale also enlarges high-density textures.
    if (this.sizeTagWidth && Math.abs(this.sizeTag.displayWidth - tagWidth) > 0.01) {
      this.sizeTag.setDisplaySize(tagWidth, 14 * tagScale);
    }
    const settling = (start: number) => start > -Infinity && time - start < SETTLE_MS + 20;
    const moving = this.iceStart.some(settling) || this.portionStart.some(settling);
    const target = this.pouring ? 1 : 0;
    if (this.agitation !== target) {
      const rate = delta / (this.pouring ? 180 : 650);
      this.agitation = target > this.agitation ? Math.min(1, this.agitation + rate) : Math.max(0, this.agitation - rate);
      this.dirty = true;
    }
    if (this.pouring || this.agitation > 0) {
      this.phase = (this.phase + delta / 1200) % 1;
      this.dirty = true;
    }
    if (!this.dirty && !moving) return;
    this.dirty = false;
    const progress = (start: number) => (start === -Infinity ? 1 : easeOut(Math.min(1, (time - start) / SETTLE_MS)));
    this.painter.paint({
      drink: this.drink,
      level: this.levelValue,
      iceLayout: this.iceLayout,
      iceSettle: this.iceStart.map(progress),
      portionSettle: this.portionStart.map(progress),
      phase: this.phase,
      agitation: this.agitation,
    });
    this.texture.refresh();
  }

  /** The cup's size, on a little card beside its rim. */
  private drawSizeTag(size: Drink['size']) {
    this.sizeTag.setVisible(Boolean(size));
    if (!size) return;
    const font = canvasFont(KITCHEN_TEXT_MIN, 700);
    const w = measure(size, font) + 6;
    const h = 14;
    const key = bakeCanvas(this.scene, `size-tag:compact:${size}`, w, h, (c) => {
      card(c, w, h, 3, '#FFF4DC', 1, '#C99F6A');
      c.font = font;
      c.fillStyle = '#795331';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(size, w / 2, h / 2 + 1);
    });
    this.sizeTagWidth = w;
    this.sizeTag.setTexture(key).setDisplaySize(w, h);
  }

  destroy() {
    this.container.destroy(true);
    this.scene.textures.remove(this.key);
  }
}
