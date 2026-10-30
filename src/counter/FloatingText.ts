import Phaser from 'phaser';

import { Feedback } from '../game/reducer';
import { SAY_MS } from '../game/rules';
import { colors } from '../art/theme';
import { addText } from '../game/view';
import { CHIP_HEIGHT, chipSvg } from './art';
import { apply, bubbleReach, setBaseline, StageContext } from './CustomerView';
import { chipShift } from './layout';
import { SHARED } from './textures';

/**
 * A short message over a customer (`FloatingText.tsx`): it fades in, drifts up 20px and fades out
 * once, over 1.4 seconds. The chip behind the words is shared by every message of the same tone
 * and width, so a day's worth of "+8k" draws it once.
 *
 * What a customer says as they arrive is one of these too, but it is read rather than glanced at:
 * it stands clear above the bubble, wraps inside its own slot, and stays up longer and barely moves.
 */
const TONE: Record<Feedback['tone'], string> = { good: colors.good, ok: colors.ok, bad: colors.bad, say: colors.ink };

/** Between a spoken line's chip and the edge of its slot, and between its words and the chip's edge. */
const SAY_MARGIN = 4;
const SAY_PAD = 10;

export class FloatingText {
  private root: Phaser.GameObjects.Container;
  private tween: Phaser.Tweens.Tween;

  constructor(ctx: StageContext, parent: Phaser.GameObjects.Container, readonly feedback: Feedback, onDone: () => void) {
    const { scene, bank, layout } = ctx;
    const say = feedback.tone === 'say';
    const color = TONE[feedback.tone];
    const text = say
      ? addText(scene, 0, 0, feedback.text, { size: 13, weight: 700, color, align: 'center', lineSpacing: -2,
        wrap: layout.slots[0].width - (SAY_MARGIN + SAY_PAD) * 2 }).setOrigin(0.5, 0)
      : addText(scene, 0, 0, feedback.text, { size: 15, weight: 800, color }).setOrigin(0.5, 0);
    // 8px either side and the 2px border; the line is 21px, so Baloo 2's 1.6em of glyph box
    // overhangs it by 1.5px above and below and the baseline sits 14.65px down.
    const width = Math.ceil(text.width + (say ? SAY_PAD * 2 : 16 + 4));
    const height = say ? Math.ceil(text.height + 4) : CHIP_HEIGHT;
    if (say) text.setPosition(0, 2);
    else setBaseline(text, 0, 2 + 21 / 2 - (1.602 * 15) / 2 + 1.078 * 15);
    const border = say ? colors.inkSoft : color;
    const chip = scene.add.image(-width / 2, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    apply(chip, bank.get(SHARED, `counter:chip:${feedback.tone}:${width}:${height}`, () => chipSvg(width, border, height), width, height),
      width, height);
    // Its foot on the bubble's top, growing upwards, and never past the top of the stage.
    const top = say
      ? Math.max(2, layout.stageHeight - layout.metrics.bubbleBottom - bubbleReach() - height)
      : layout.metrics.bubbleCenterY - 10;
    // The column stands at the slot's centre, so this is the one place that knows where the edge is.
    const shift = chipShift(layout.slots[feedback.slot]?.centre ?? 0, width, layout.width);
    this.root = scene.add.container(shift, top, [chip, text]);
    this.root.alpha = 0;
    parent.add(this.root);

    const progress = { t: 0 };
    this.tween = scene.tweens.add({
      targets: progress, t: 1, duration: say ? SAY_MS : 1400, ease: say ? 'Linear' : 'Quad.easeOut',
      onUpdate: () => {
        const t = progress.t;
        // A line waits for its customer to have walked up, and leaves before its time is out.
        this.root.alpha = say ? Math.min(1, Math.max(0, (t - 0.15) / 0.1), (1 - t) / 0.12)
          : t < 0.12 ? t / 0.12 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        this.root.y = top - t * (say ? 4 : 20);
      },
      onComplete: onDone,
    });
  }

  destroy() {
    this.tween.remove();
    this.root.destroy();
  }
}
