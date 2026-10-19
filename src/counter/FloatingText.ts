import Phaser from 'phaser';

import { Feedback } from '../game/reducer';
import { colors } from '../art/theme';
import { addText } from '../game/view';
import { CHIP_HEIGHT, chipSvg } from './art';
import { apply, setBaseline, StageContext } from './CustomerView';
import { SHARED } from './textures';

/**
 * A short message over a customer (`FloatingText.tsx`): it fades in, drifts up 20px and fades out
 * once, over 1.4 seconds. The chip behind the words is shared by every message of the same tone
 * and width, so a day's worth of "+8k" draws it once.
 */
const TONE: Record<Feedback['tone'], string> = { good: colors.good, ok: colors.ok, bad: colors.bad };

export class FloatingText {
  private root: Phaser.GameObjects.Container;
  private tween: Phaser.Tweens.Tween;

  constructor(ctx: StageContext, parent: Phaser.GameObjects.Container, readonly feedback: Feedback, onDone: () => void) {
    const { scene, bank, layout } = ctx;
    const color = TONE[feedback.tone];
    const top = layout.metrics.bubbleCenterY - 10;
    const text = addText(scene, 0, 0, feedback.text, { size: 15, weight: 800, color }).setOrigin(0.5, 0);
    // 8px either side and the 2px border; the line is 21px, so Baloo 2's 1.6em of glyph box
    // overhangs it by 1.5px above and below and the baseline sits 14.65px down.
    const width = Math.ceil(text.width + 16 + 4);
    setBaseline(text, 0, 2 + 21 / 2 - (1.602 * 15) / 2 + 1.078 * 15);
    const chip = scene.add.image(-width / 2, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    apply(chip, bank.get(SHARED, `counter:chip:${feedback.tone}:${width}`, () => chipSvg(width, color), width, CHIP_HEIGHT),
      width, CHIP_HEIGHT);
    this.root = scene.add.container(0, top, [chip, text]);
    this.root.alpha = 0;
    parent.add(this.root);

    const progress = { t: 0 };
    this.tween = scene.tweens.add({
      targets: progress, t: 1, duration: 1400, ease: 'Quad.easeOut',
      onUpdate: () => {
        const t = progress.t;
        this.root.alpha = t < 0.12 ? t / 0.12 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        this.root.y = top - t * 20;
      },
      onComplete: onDone,
    });
  }

  destroy() {
    this.tween.remove();
    this.root.destroy();
  }
}
