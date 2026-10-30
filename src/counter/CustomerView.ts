import Phaser from 'phaser';

import { Customer } from '../game/reducer';
import { orderVisible } from '../game/regulars';
import { characterSvg, Mood } from '../art/character';
import { cupLayout, cupSvg } from '../art/cup';
import { bubblePointerColor, bubblePointerSvg, orderPadSvg, patienceRingColor, patienceRingSvg } from '../art/icons';
import { n } from '../art/svg';
import { addText } from '../game/view';
import { BUBBLE_TONE, BubbleTone, bubbleSvg, SIZE_TAG, sizeTagSvg, TAIL_DROP } from './art';
import { BUBBLE, BUBBLE_CUP, bubbleSize, bubbleStack, CounterLayout, FIGURE_LIFT, PAD_SIZE } from './layout';
import { SHARED, TextureBank } from './textures';

/**
 * A customer at the counter (`ActiveCustomer` in `CustomerStage.tsx`): the figure, which walks in
 * from the nearer side and fades up, and the speech bubble over it, which follows half a second
 * later — the order pad while they wait to be asked, their drink once the order is taken. A usual
 * stays a pad after that, until it is asked for: the cup in the bubble is the whole of the answer.
 * The ring on the bubble is their patience; their face follows it (happy, neutral, angry), and they blink.
 *
 * Every picture here is a texture drawn once. The clock only reaches `update`, which compares the
 * rounded patience, the status and the highlight against what is already showing and swaps a
 * texture when one of them actually moved.
 */
export interface StageContext {
  scene: Phaser.Scene;
  bank: TextureBank;
  layout: CounterLayout;
}

const NONE = '__DEFAULT';

/** Who owns a customer's textures: the id plus the look, since a restored shop can reuse an id. */
export function ownerOf(customer: Customer): string {
  const { skin, hair, hairStyle, shirt, accessory } = customer.look;
  return `c:${customer.id}:${skin}${hair}${hairStyle}${shirt}${accessory}`;
}

export function moodFor(patience: number): Mood {
  return patience > 0.6 ? 'happy' : patience > 0.3 ? 'neutral' : 'angry';
}

/** The figure in a mood, at the stage's size. Resolves the texture key, or null if it was dropped. */
export function figureTexture(ctx: StageContext, customer: Customer, mood: Mood, blinking: boolean): Promise<string | null> {
  const { charWidth, charHeight } = ctx.layout.metrics;
  const owner = ownerOf(customer);
  const key = `${owner}:${mood}${blinking ? ':blink' : ''}:${n(charWidth)}`;
  return ctx.bank.get(owner, key, () => characterSvg(customer.look, { mood, blinking, width: charWidth }), charWidth, charHeight);
}

export function figureKeyIfReady(ctx: StageContext, customer: Customer, mood: Mood, blinking: boolean): string | null {
  const key = `${ownerOf(customer)}:${mood}${blinking ? ':blink' : ''}:${n(ctx.layout.metrics.charWidth)}`;
  return ctx.bank.has(key) ? key : null;
}

/** The patience ring at a fiftieth (`patienceLeft` already rounds to one): 51 shared textures. */
export function ringKey(patience: number) {
  return `counter:ring:${Math.round(patience * 50)}`;
}

export function ringTexture(bank: TextureBank, patience: number) {
  const fraction = Math.round(patience * 50) / 50;
  return bank.get(SHARED, ringKey(fraction), () => patienceRingSvg(fraction, patienceRingColor(fraction)), 20, 20);
}

const BUBBLE_CUP_BOX = cupLayout(BUBBLE_CUP, { straw: true });

function contentSize(pad: boolean) {
  return pad ? PAD_SIZE : { width: BUBBLE_CUP_BOX.boxWidth, height: BUBBLE_CUP_BOX.boxHeight };
}

/** How far the tallest bubble and its pointer reach above where a bubble is anchored. */
export function bubbleReach() {
  return -bubbleStack(bubbleSize(contentSize(false)).height).pointerTop;
}

export function bubbleKey(tone: BubbleTone, pad: boolean) {
  return `counter:bubble:${tone}:${pad ? 'pad' : 'cup'}`;
}

/** The shared pieces every bubble is made of, drawn up front so the first customer has them. */
export function preloadShared(bank: TextureBank): Promise<unknown> {
  const jobs: Promise<unknown>[] = [];
  for (const pad of [true, false]) {
    const size = bubbleSize(contentSize(pad));
    for (const tone of Object.keys(BUBBLE_TONE) as BubbleTone[]) {
      jobs.push(bank.get(SHARED, bubbleKey(tone, pad), () => bubbleSvg(size.width, size.height, tone),
        size.width, size.height + TAIL_DROP));
    }
  }
  for (const requesting of [true, false]) {
    const color = bubblePointerColor(requesting);
    jobs.push(bank.get(SHARED, `counter:pointer:${color}`, () => bubblePointerSvg(color), 16, 10));
  }
  jobs.push(bank.get(SHARED, 'counter:pad', () => orderPadSvg(PAD_SIZE.width), PAD_SIZE.width, PAD_SIZE.height));
  jobs.push(bank.get(SHARED, 'counter:sizeTag', sizeTagSvg, SIZE_TAG.width, SIZE_TAG.height));
  for (let i = 0; i <= 50; i++) jobs.push(ringTexture(bank, i / 50));
  return Promise.all(jobs);
}

/** Put a texture on an image once it is there, at a CSS size, unless `still()` says it is stale. */
export function apply(image: Phaser.GameObjects.Image, key: string | null | Promise<string | null>, width: number, height: number,
  still: () => boolean = () => true) {
  const set = (k: string | null) => {
    if (!k || !image.active || !still()) return;
    image.setTexture(k).setDisplaySize(width, height).setVisible(true);
  };
  if (key instanceof Promise) void key.then(set);
  else set(key);
}

/** Place a text so its baseline sits at `baseline` (Phaser places text by its top). */
export function setBaseline(text: Phaser.GameObjects.Text, x: number, baseline: number) {
  text.setPosition(x, baseline - text.getTextMetrics().ascent);
}

export class CustomerView {
  customer: Customer;
  private figure: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Container;
  private pointer: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private content: Phaser.GameObjects.GameObject[] = [];

  private patience = -1;
  private mood: Mood = 'happy';
  private blinking = false;
  private tone: BubbleTone | null = null;
  private pad: boolean | null = null;
  private tweens: Phaser.Tweens.Tween[] = [];
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  private bubbleY: number;

  constructor(private ctx: StageContext, parent: Phaser.GameObjects.Container, customer: Customer,
    patience: number, selected: boolean, enterFrom: number, animate: boolean) {
    const { scene, layout } = ctx;
    const { metrics, stageHeight } = layout;
    this.customer = customer;

    this.figure = scene.add.image(0, stageHeight - FIGURE_LIFT, NONE).setOrigin(0.5, 1).setVisible(false);
    this.bubbleY = stageHeight - metrics.bubbleBottom;
    this.bubble = scene.add.container(0, this.bubbleY);
    this.pointer = scene.add.image(0, 0, NONE).setOrigin(0.5, 0).setVisible(false);
    this.body = scene.add.image(0, 0, NONE).setOrigin(0.5, 0).setVisible(false);
    this.ring = scene.add.image(0, 0, NONE).setOrigin(0, 0).setVisible(false);
    this.bubble.add([this.pointer, this.body, this.ring]);
    parent.add([this.figure, this.bubble]);

    // The drink in the bubble is wanted the moment the order is taken: draw it now.
    if (orderVisible(customer)) {
      void ctx.bank.get(ownerOf(customer), `${ownerOf(customer)}:cup`,
        () => cupSvg(customer.order, { width: BUBBLE_CUP, backgroundColor: '#FFFFFF', straw: true }),
        BUBBLE_CUP_BOX.svgWidth, BUBBLE_CUP_BOX.svgHeight);
    }

    this.update(customer, patience, selected);
    this.scheduleBlink();

    if (animate) {
      const walk = { t: 0 };
      const step = () => {
        this.figure.x = (1 - walk.t) * enterFrom * metrics.slotWidth * 0.5;
        this.figure.alpha = walk.t;
      };
      step();
      this.tweens.push(scene.tweens.add({ targets: walk, t: 1, duration: 600, ease: 'Cubic.easeOut', onUpdate: step }));
      const pop = { t: 0 };
      const rise = () => {
        this.bubble.alpha = pop.t;
        this.bubble.y = this.bubbleY + (1 - pop.t) * 6;
      };
      rise();
      this.tweens.push(scene.tweens.add({ targets: pop, t: 1, delay: 500, duration: 250, ease: 'Cubic.easeOut', onUpdate: rise }));
    }
  }

  /** The clock and the shop, as of now. Touches nothing that has not changed. */
  update(customer: Customer, patience: number, selected: boolean) {
    this.customer = customer;
    const requesting = customer.status === 'requesting';
    const pad = requesting || !orderVisible(customer);
    if (pad !== this.pad) {
      this.pad = pad;
      this.tone = null;
      this.buildContent(pad);
    }
    // A requesting customer always invites a tap; an ordered one points to its selected ticket.
    const tone: BubbleTone = requesting ? 'ask' : selected ? 'selected' : 'plain';
    if (tone !== this.tone) {
      this.tone = tone;
      const size = bubbleSize(contentSize(pad));
      const { bubbleTop, pointerTop } = bubbleStack(size.height);
      this.body.setY(bubbleTop);
      apply(this.body, this.ctx.bank.get(SHARED, bubbleKey(tone, pad), () => bubbleSvg(size.width, size.height, tone),
        size.width, size.height + TAIL_DROP), size.width, size.height + TAIL_DROP, () => this.tone === tone);
      this.pointer.setY(pointerTop);
      if (tone === 'plain') this.pointer.setVisible(false);
      else {
        const color = bubblePointerColor(requesting);
        apply(this.pointer, this.ctx.bank.get(SHARED, `counter:pointer:${color}`, () => bubblePointerSvg(color), 16, 10), 16, 10,
          () => this.tone === tone);
      }
      // `styles.ring`: 8px above and 10px right of the bubble's padding box.
      this.ring.setPosition(size.width / 2 - BUBBLE.border + 10 - 20, bubbleTop + BUBBLE.border - 8);
    }
    if (patience !== this.patience) {
      this.patience = patience;
      const key = ringKey(patience);
      apply(this.ring, this.ctx.bank.has(key) ? key : ringTexture(this.ctx.bank, patience), 20, 20,
        () => ringKey(this.patience) === key);
      const mood = moodFor(patience);
      if (mood !== this.mood || !this.figure.visible) {
        this.mood = mood;
        this.showFigure();
        // Draw the next face down before it is needed, so the change lands on the frame it should.
        const next = mood === 'happy' ? 'neutral' : mood === 'neutral' ? 'angry' : null;
        if (next) {
          void figureTexture(this.ctx, customer, next, false);
          void figureTexture(this.ctx, customer, next, true);
        }
      }
    }
  }

  /** The texture showing right now, for a departure to start from while its own face is drawn. */
  currentFigureKey(): string | null {
    return this.figure.visible ? this.figure.texture.key : null;
  }

  destroy() {
    for (const tween of this.tweens) tween.remove();
    this.tweens = [];
    this.blinkTimer?.remove();
    this.figure.destroy();
    this.bubble.destroy();
  }

  /** Ask for this mood's face (open and blinking) and show it as soon as either is there. */
  private showFigure() {
    this.refreshFigure();
    const mood = this.mood;
    for (const blinking of [false, true]) {
      void figureTexture(this.ctx, this.customer, mood, blinking).then(() => {
        if (this.mood === mood) this.refreshFigure();
      });
    }
  }

  /** The face for the mood and the blink as they are now, or the mood's other eyes if only those are in. */
  private refreshFigure() {
    if (!this.figure.active) return;
    const key = figureKeyIfReady(this.ctx, this.customer, this.mood, this.blinking)
      ?? figureKeyIfReady(this.ctx, this.customer, this.mood, !this.blinking);
    if (!key || (this.figure.visible && this.figure.texture.key === key)) return;
    const { charWidth, charHeight } = this.ctx.layout.metrics;
    this.figure.setTexture(key).setDisplaySize(charWidth, charHeight).setVisible(true);
  }

  /** `useBlink`: every two to four and a half seconds, the eyes close for 140ms. */
  private scheduleBlink() {
    this.blinkTimer = this.ctx.scene.time.delayedCall(2000 + Math.random() * 2600, () => {
      this.setBlink(true);
      this.blinkTimer = this.ctx.scene.time.delayedCall(140, () => {
        this.setBlink(false);
        this.scheduleBlink();
      });
    });
  }

  private setBlink(blinking: boolean) {
    this.blinking = blinking;
    this.refreshFigure();
  }

  /** The pad, or the ordered drink with its size tag. */
  private buildContent(showPad: boolean) {
    for (const object of this.content) object.destroy();
    this.content = [];
    const { scene, bank } = this.ctx;
    const size = bubbleSize(contentSize(showPad));
    const { bubbleTop } = bubbleStack(size.height);
    const left = -size.width / 2 + BUBBLE.border + BUBBLE.padX;
    const top = bubbleTop + BUBBLE.border;
    if (showPad) {
      const pad = scene.add.image(left, top, NONE).setOrigin(0).setVisible(false);
      apply(pad, bank.get(SHARED, 'counter:pad', () => orderPadSvg(PAD_SIZE.width), PAD_SIZE.width, PAD_SIZE.height),
        PAD_SIZE.width, PAD_SIZE.height);
      this.content.push(pad);
    } else {
      const owner = ownerOf(this.customer);
      const order = this.customer.order;
      const cup = scene.add.image(left - BUBBLE_CUP_BOX.originX, top - BUBBLE_CUP_BOX.originY, NONE).setOrigin(0).setVisible(false);
      apply(cup, bank.get(owner, `${owner}:cup`, () => cupSvg(order, { width: BUBBLE_CUP, backgroundColor: '#FFFFFF', straw: true }),
        BUBBLE_CUP_BOX.svgWidth, BUBBLE_CUP_BOX.svgHeight), BUBBLE_CUP_BOX.svgWidth, BUBBLE_CUP_BOX.svgHeight);
      // `styles.orderSize`: left -13, bottom -6 of the cup's box.
      const tagLeft = left - 13;
      const tagTop = top + BUBBLE_CUP_BOX.boxHeight + 6 - SIZE_TAG.height;
      const tag = scene.add.image(tagLeft, tagTop, NONE).setOrigin(0).setVisible(false);
      apply(tag, bank.get(SHARED, 'counter:sizeTag', sizeTagSvg, SIZE_TAG.width, SIZE_TAG.height), SIZE_TAG.width, SIZE_TAG.height);
      const label = addText(scene, 0, 0, order.size ?? '', { size: 12, weight: 700, color: '#795331' }).setOrigin(0.5, 0);
      // Baloo 2's ascent is 1.078em, under the tag's 1px border.
      setBaseline(label, tagLeft + SIZE_TAG.width / 2, tagTop + 1 + 12 * 1.078);
      this.content.push(cup, tag, label);
    }
    // Over the bubble, under the ring.
    this.bubble.addAt(this.content, this.bubble.getIndex(this.ring));
  }
}
