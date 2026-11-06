import type Phaser from 'phaser';
import type { CustomerView, StageContext } from './CustomerView';
import { Doorway } from './Doorway';
import { queueDepth, queuePosition } from './layout';

/** A visible approach outside, handle reach, door crossing, then an unhurried walk up the aisle. */
export class ArrivalWalk {
  phase: 'waiting' | 'approach' | 'handle' | 'opening' | 'crossing' | 'aisle' | 'done' = 'waiting';
  private elapsed = 0;
  private removed = false;
  private rank: number;
  private aisleStart = { x: 0, feet: 0, scale: 1 };
  constructor(private ctx: StageContext, private root: Phaser.GameObjects.Container,
    private view: CustomerView, private door: Doorway, rank: number) {
    this.rank = rank;
    this.root.setData('outside', true).setAlpha(1).setDepth(2);
    this.place(door.placement.hiddenX, door.placement.outsideY, door.placement.scale * .92, true);
    this.view.figure.setFacing(-90);
  }
  destination(rank: number) { this.rank = rank; }
  isPlaying() { return this.phase !== 'done' && !this.removed; }
  private next(phase: ArrivalWalk['phase']) { this.phase = phase; this.elapsed = 0; }
  private place(x: number, feet: number, scale: number, outside = false) {
    this.root.setPosition(x, feet - this.ctx.layout.room.queueY * scale).setScale(scale).setDepth(outside ? 2 : queueDepth(this.ctx.layout, feet));
  }
  update(delta: number) {
    if (!this.isPlaying()) return;
    const p = this.door.placement, id = this.view.customer.id;
    const dt = Math.min(delta, 50); this.elapsed += dt;
    const figure = this.view.figure;
    if (this.phase === 'waiting') {
      figure.setWalking(false);
      if (this.door.request(id)) this.next('approach');
    } else if (this.phase === 'approach') {
      figure.setWalking(true);
      const t = Math.min(1, this.elapsed / 1600);
      this.place(p.hiddenX + (p.handleX - p.hiddenX) * t, p.outsideY, p.scale * .92, true);
      if (t === 1) { figure.setWalking(false); figure.setFacing(0); this.next('handle'); }
    } else if (this.phase === 'handle') {
      figure.reachDoor(true);
      if (this.elapsed >= 700) { this.door.open(id); this.next('opening'); }
    } else if (this.phase === 'opening') {
      if (this.door.isOpen(id)) { figure.reachDoor(false); this.next('crossing'); }
    } else if (this.phase === 'crossing') {
      figure.setWalking(true);
      const t = Math.min(1, this.elapsed / 1200);
      const feet = p.outsideY + (p.thresholdY + 26 * this.ctx.layout.room.scale - p.outsideY) * t;
      const x = p.handleX + (p.passageX - p.handleX) * Math.min(1, t * 2);
      if (t > .42) this.root.setData('outside', false);
      this.place(x, feet, p.scale * (.92 + .08 * t), t <= .42);
      if (t === 1) {
        this.door.release(id); this.aisleStart = { x, feet, scale: p.scale }; this.next('aisle');
      }
    } else if (this.phase === 'aisle') {
      const end = queuePosition(this.ctx.layout, this.rank);
      const distance = Math.max(.12, (end.feet - p.thresholdY) / (this.ctx.layout.room.queueY - p.thresholdY));
      const t = Math.min(1, this.elapsed / (1600 + distance * 3600));
      const ease = t * t * (3 - 2 * t);
      this.place(this.aisleStart.x + (end.x - this.aisleStart.x) * ease,
        this.aisleStart.feet + (end.feet - this.aisleStart.feet) * ease,
        this.aisleStart.scale + (end.scale - this.aisleStart.scale) * ease);
      if (t === 1) { figure.setWalking(false); figure.acknowledge(); this.next('done'); }
    }
  }
  remove() {
    this.removed = true; this.door.release(this.view.customer.id); this.root.setData('outside', false);
    this.view.figure.reachDoor(false);
  }
}
