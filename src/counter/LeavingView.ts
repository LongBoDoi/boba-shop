import Phaser from 'phaser';

import { kindOf } from '../game/customers';
import { Departure } from '../game/reducer';
import { leftContent } from '../game/rules';
import { Mood } from '../art/character';
import { cupLayout, cupSvg } from '../art/cup';
import { risingHeartSvg, steamPuffSvg } from '../art/icons';
import { apply, ownerOf, StageContext } from './CustomerView';
import { CatFigure } from './CatFigure';
import { queueDepth } from './layout';
import { Doorway } from './Doorway';
import { exitWalkway } from './walkway';
import { SHARED } from './textures';

/** A reaction, a turn into the aisle, and a walk to the door. The visual outlives the sale event. */
export class LeavingView {
  private figure: CatFigure;
  private elapsed = 0;
  private done = false;
  phase = 'reaction';
  private phaseTime = 0;
  private start: { x: number; feet: number; scale: number };
  private reaction?: Phaser.GameObjects.Image;
  private reactionY = 0;

  constructor(private ctx: StageContext, private parent: Phaser.GameObjects.Container,
    readonly departure: Departure, figure: CatFigure | undefined, private door: Doorway, private onDone: () => void) {
    const { scene, bank, layout } = ctx;
    const { outcome, drink, customer } = departure;
    const happy = leftContent(departure);
    const unbothered = (outcome === 'timeout' && kindOf(customer.look) === 'shipper') || (outcome === 'close' && !happy);
    const mood: Mood = outcome === 'perfect' ? 'delighted' : happy ? 'happy' : unbothered ? 'neutral' : 'angry';
    this.start = { x: parent.x, feet: parent.y + layout.room.queueY * parent.scaleX, scale: parent.scaleX };
    this.figure = figure ?? new CatFigure(ctx, parent, customer, mood);
    parent.add(this.figure.root);
    this.figure.setWalking(false);
    this.figure.setMood(mood);
    this.figure.acknowledge();

    if (drink) {
      const width = 26;
      const box = cupLayout(width, { straw: true, sealed: true });
      const cup = scene.add.image(-width * .5 - box.originX, 6 - box.svgHeight, '__DEFAULT')
        .setOrigin(0).setVisible(false);
      const owner = ownerOf(customer);
      const raster = layout.metrics.charWidth / 100;
      apply(cup, bank.get(owner, `${owner}:held:${departure.id}:${layout.metrics.charWidth.toFixed(2)}`,
        () => cupSvg(drink, { width: width * raster, backgroundColor: 'transparent', straw: true, sealed: true, tapered: false }),
        box.svgWidth * raster, box.svgHeight * raster), box.svgWidth, box.svgHeight);
      this.figure.hand.add(cup);
      this.figure.holdDrink();
    }

    const rising = outcome === 'perfect' ? 'heart' : !happy && !unbothered ? 'steam' : null;
    if (rising) {
      const size = rising === 'heart' ? { width: 18, height: 16 } : { width: 24, height: 14 };
      this.reactionY = layout.room.queueY - layout.metrics.charHeight * .95;
      const image = scene.add.image(layout.metrics.charWidth * .18, this.reactionY, '__DEFAULT').setOrigin(0).setVisible(false);
      apply(image, bank.get(SHARED, `counter:${rising}`, rising === 'heart' ? risingHeartSvg : steamPuffSvg,
        size.width, size.height), size.width, size.height);
      parent.add(image);
      this.reaction = image;
    }
  }

  private next(phase: string) { this.phase = phase; this.phaseTime = 0; }

  updateMotion(delta: number, reduced: boolean) {
    if (this.done) return;
    const dt = Math.min(delta, 50); this.elapsed += dt; this.phaseTime += dt;
    const { layout } = this.ctx, p = this.door.placement;
    const id = -this.departure.id;
    const waitX = p.passageX;
    const insideY = p.thresholdY + 28 * layout.room.scale;
    const place = (x: number, feet: number, scale: number, outside = false) => {
      this.parent.setPosition(x, feet - layout.room.queueY * scale).setScale(scale)
        .setDepth(outside ? 2 : queueDepth(layout, feet) + .1);
    };
    this.figure.setWalking(false);
    if (this.phase === 'reaction' && this.phaseTime >= 500) {
      this.figure.faceAway(true); this.next('turning');
    } else if (this.phase === 'turning' && this.phaseTime >= 650) {
      this.next('aisle');
    } else if (this.phase === 'aisle') {
      const t = Math.min(1, this.phaseTime / 5800);
      const point = exitWalkway(layout, this.start, t);
      place(point.x, point.feet, point.scale);
      this.figure.setFacing(point.facing);
      this.figure.setWalking(true);
      if (t === 1) this.next('waiting');
    } else if (this.phase === 'waiting') {
      if (this.door.request(id)) { this.figure.setFacing(-90); this.next('handleApproach'); }
    } else if (this.phase === 'handleApproach') {
      const t = Math.min(1, this.phaseTime / 1100);
      place(waitX + (p.handleX - waitX) * t, insideY, p.scale);
      this.figure.setWalking(true);
      if (t === 1) { this.figure.faceAway(true); this.next('handle'); }
    } else if (this.phase === 'handle') {
      this.figure.reachDoor(true);
      if (this.phaseTime >= 1000) { this.door.open(id); this.next('opening'); }
    } else if (this.phase === 'opening') {
      if (this.door.isOpen(id)) { this.figure.reachDoor(false); this.next('crossing'); }
    } else if (this.phase === 'crossing') {
      const t = Math.min(1, this.phaseTime / 1500);
      const x = p.handleX + (p.passageX - p.handleX) * Math.min(1, t * 2);
      const feet = insideY + (p.outsideY - insideY) * t;
      const outside = t > .58;
      if (outside) this.parent.setData('outside', true);
      place(x, feet, p.scale * (1 - .08 * t), outside);
      this.figure.setWalking(true);
      if (t === 1) { this.figure.setFacing(90); this.next('outside'); }
    } else if (this.phase === 'outside') {
      const t = Math.min(1, this.phaseTime / 1900);
      place(p.passageX + (p.hiddenX - p.passageX) * t, p.outsideY, p.scale * .92, true);
      this.figure.setWalking(true);
      if (t === 1) { this.door.release(id); this.done = true; this.onDone(); return; }
    }
    this.figure.update(delta, reduced);
    if (this.reaction) {
      const reaction = Math.min(1, this.elapsed / 950);
      this.reaction.setY(this.reactionY - reaction * 20).setAlpha(Math.sin(reaction * Math.PI));
    }
  }

  destroy() {
    this.done = true;
    this.door.release(-this.departure.id);
    this.parent.setData('outside', false);
    this.figure.destroy();
    this.reaction?.destroy();
  }
}
