import Phaser from 'phaser';

import { Departure } from '../../../src/game/reducer';
import { Mood } from '../art/character';
import { cupLayout, cupSvg } from '../art/cup';
import { risingHeartSvg, steamPuffSvg } from '../art/icons';
import { n } from '../art/svg';
import { apply, figureTexture, ownerOf, StageContext } from './CustomerView';
import { FIGURE_LIFT } from './layout';
import { SHARED } from './textures';

/**
 * A customer walking off (`LeavingCustomer` in `CustomerStage.tsx`): they pause long enough for
 * their reaction to be seen, then step away and fade — left, back out of the door, with a drink
 * they liked; right, with one they didn't or none at all. A delighted one gives off a heart and an
 * unhappy one a puff of steam, which rises and fades once.
 */
const NONE = '__DEFAULT';

export class LeavingView {
  private root: Phaser.GameObjects.Container;
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(ctx: StageContext, parent: Phaser.GameObjects.Container, readonly departure: Departure, startKey: string | null) {
    const { scene, bank, layout } = ctx;
    const { charWidth, charHeight, slotWidth } = layout.metrics;
    const { outcome, drink, customer } = departure;
    const happy = outcome === 'perfect' || outcome === 'close';
    const mood: Mood = outcome === 'perfect' ? 'delighted' : outcome === 'close' ? 'happy' : 'angry';

    // The figure's own box, as the `Animated.View` it is drawn in.
    const top = layout.stageHeight - FIGURE_LIFT - charHeight;
    const left = -charWidth / 2;
    this.root = scene.add.container(0, 0);
    parent.add(this.root);

    const figure = scene.add.image(left, top, startKey ?? NONE).setOrigin(0).setVisible(Boolean(startKey));
    if (startKey) figure.setDisplaySize(charWidth, charHeight);
    apply(figure, figureTexture(ctx, customer, mood, false), charWidth, charHeight);
    this.root.add(figure);

    if (drink) {
      const width = charWidth * 0.26;
      const box = cupLayout(width, { straw: true, sealed: true });
      const owner = ownerOf(customer);
      const cup = scene.add.image(left + charWidth + 2 - width - box.originX, top + charHeight * 0.5 - box.originY, NONE)
        .setOrigin(0).setVisible(false);
      apply(cup, bank.get(owner, `${owner}:held:${departure.id}:${n(width)}`,
        () => cupSvg(drink, { width, backgroundColor: 'transparent', straw: true, sealed: true, tapered: false }),
        box.svgWidth, box.svgHeight), box.svgWidth, box.svgHeight);
      this.root.add(cup);
    }

    const rising = outcome === 'perfect' ? 'heart' : !happy ? 'steam' : null;
    if (rising) {
      const size = rising === 'heart' ? { width: 18, height: 16 } : { width: 24, height: 14 };
      const y = top + charHeight * 0.05;
      const image = scene.add.image(left + charWidth * (rising === 'heart' ? 0.62 : 0.68), y, NONE).setOrigin(0).setVisible(false);
      image.alpha = 0;
      apply(image, bank.get(SHARED, `counter:${rising}`, rising === 'heart' ? risingHeartSvg : steamPuffSvg, size.width, size.height),
        size.width, size.height);
      this.root.add(image);
      const progress = { t: 0 };
      this.tweens.push(scene.tweens.add({
        targets: progress, t: 1, duration: 1100, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const t = progress.t;
          image.alpha = t < 0.2 ? t / 0.2 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          image.y = y - t * 24;
        },
      }));
    }

    const exit = { t: 0 };
    this.tweens.push(scene.tweens.add({
      targets: exit, t: 1, delay: 550, duration: 600, ease: 'Cubic.easeInOut',
      onUpdate: () => {
        this.root.alpha = 1 - exit.t;
        this.root.x = exit.t * (happy ? -1 : 1) * slotWidth * 0.5;
      },
    }));
  }

  destroy() {
    for (const tween of this.tweens) tween.remove();
    this.tweens = [];
    this.root.destroy();
  }
}
