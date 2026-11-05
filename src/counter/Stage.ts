import Phaser from 'phaser';

import { Departure, Feedback, frontSlot, GameState, patienceLeft, queueSlots } from '../game/reducer';
import { CustomerView, ownerOf, preloadShared, StageContext } from './CustomerView';
import { FloatingText } from './FloatingText';
import { behindCounterForeground } from './foreground';
import { CounterLayout, queuePosition } from './layout';
import { LeavingView } from './LeavingView';
import { TextureBank } from './textures';
import { ArrivalWalk } from './ArrivalWalk';
import { Doorway } from './Doorway';
import { uiState } from '../ui-state';

export const SLOT_DEPTH = 10;
interface Guest {
  root: Phaser.GameObjects.Container;
  view: CustomerView;
  rank: number;
  slot: number | null;
  walk?: Phaser.Tweens.Tween | ArrivalWalk;
}
interface Effect<T> { root: Phaser.GameObjects.Container; view: T }

/** One continuous, depth-sorted line from the entrance to the register. Storage slots stay stable. */
export class Stage {
  private ctx: StageContext | null = null;
  private customers = new Map<number, Guest>();
  private leaving = new Map<number, Effect<LeavingView>>();
  private floating = new Map<number, Effect<FloatingText>>();
  private front: number | null = null;
  private door: Doorway | null = null;

  constructor(private scene: Phaser.Scene, private bank: TextureBank) { void preloadShared(bank); }

  build(layout: CounterLayout, state: GameState) {
    const arriving = new Set([...this.customers.values()]
      .filter(g => g.walk instanceof ArrivalWalk && g.walk.isPlaying()).map(g => g.view.customer.id));
    this.clear();
    this.ctx = { scene: this.scene, bank: this.bank, layout };
    this.door = new Doorway(this.scene, layout);
    this.syncCustomers(state, state.phase === 'playing' && state.clock < 5000);
    for (const guest of this.customers.values()) if (arriving.has(guest.view.customer.id) && !(guest.walk instanceof ArrivalWalk)) {
      guest.walk = new ArrivalWalk(this.ctx, guest.root, guest.view, this.door, guest.rank);
    }
    this.syncReady();
    this.sweep(state);
  }

  sync(state: GameState, previous: GameState) {
    if (!this.ctx) return;
    if (state.day !== previous.day || state.clock < previous.clock) {
      this.build(this.ctx.layout, state);
      return;
    }
    if (state.departures !== previous.departures) this.syncDepartures(state.departures, previous.departures);
    if (state.slots !== previous.slots || state.line !== previous.line || state.clock !== previous.clock
      || state.selectedSlot !== previous.selectedSlot) this.syncCustomers(state, true);
    if (state.feedback !== previous.feedback) this.syncFeedback(state.feedback, previous.feedback);
    if (state.slots !== previous.slots || state.line !== previous.line || state.departures !== previous.departures) this.sweep(state);
  }

  destroy() { this.clear(); this.ctx = null; }

  private syncCustomers(state: GameState, animate: boolean) {
    const ctx = this.ctx!;
    const { layout } = ctx;
    this.front = frontSlot(state.slots);
    const queue = [
      ...queueSlots(state.slots).map(slot => ({ customer: state.slots[slot]!, slot })),
      ...state.line.map(customer => ({ customer, slot: null })),
    ];
    const live = new Set(queue.map(({ customer }) => customer.id));
    for (const [id, guest] of this.customers) {
      if (live.has(id)) continue;
      guest.walk?.remove(); guest.view.destroy(); guest.root.destroy(); this.customers.delete(id);
    }
    queue.forEach(({ customer, slot }, rank) => {
      let guest = this.customers.get(customer.id);
      if (guest && ownerOf(guest.view.customer) !== ownerOf(customer)) {
        guest.walk?.remove(); guest.view.destroy(); guest.root.destroy(); guest = undefined;
      }
      const destination = queuePosition(layout, rank);
      const target = { x: destination.x, y: destination.feet - layout.room.queueY * destination.scale,
        scaleX: destination.scale, scaleY: destination.scale, alpha: 1 };
      const waiting = rank !== 0 || slot === null;
      if (!guest) {
        const root = this.scene.add.container(target.x, target.y).setScale(destination.scale);
        const view = new CustomerView(ctx, root, customer, waiting ? 1 : patienceLeft(customer, state.clock),
          slot === state.selectedSlot);
        guest = { root, view, rank: -1, slot };
        this.customers.set(customer.id, guest);
        if (animate) guest.walk = new ArrivalWalk(ctx, root, view, this.door!, rank);
      } else guest.view.update(customer, waiting ? 1 : patienceLeft(customer, state.clock), slot === state.selectedSlot);
      guest.view.setWaiting(waiting || !!guest.walk?.isPlaying());
      guest.slot = slot;
      if (!(guest.walk instanceof ArrivalWalk) || !guest.walk.isPlaying()) guest.root.setDepth(SLOT_DEPTH + 100 - rank);
      if (guest.rank !== rank) {
        if (guest.walk instanceof ArrivalWalk && guest.walk.isPlaying()) {
          guest.walk.destination(rank); guest.rank = rank; return;
        }
        guest.walk?.remove();
        if (animate) {
          guest.view.setWalking(true);
          const moving = guest;
          guest.walk = this.scene.tweens.add({ targets: guest.root, ...target,
            duration: 1800, ease: 'Sine.easeInOut',
            onComplete: () => moving.view.setWalking(false) });
        }
        else guest.root.setPosition(target.x, target.y).setScale(destination.scale);
        guest.rank = rank;
      }
    });
    this.syncReady();
  }

  private syncDepartures(departures: Departure[], previous: Departure[]) {
    const ctx = this.ctx!;
    const seen = new Set(previous.map(d => d.id));
    for (const departure of departures) {
      if (seen.has(departure.id) || this.leaving.has(departure.id)) continue;
      const guest = this.customers.get(departure.customer.id);
      const root = this.scene.add.container(guest?.root.x ?? ctx.layout.room.queueX, guest?.root.y ?? 0)
        .setScale(guest?.root.scaleX ?? 1).setDepth(SLOT_DEPTH + 101);
      const view = new LeavingView(ctx, root, departure, guest?.view.detachFigure(), this.door!, () => {
        const effect = this.leaving.get(departure.id);
        effect?.view.destroy(); effect?.root.destroy(); this.leaving.delete(departure.id);
        const owner = ownerOf(departure.customer);
        if (![...this.customers.values()].some(g => ownerOf(g.view.customer) === owner)
          && ![...this.leaving.values()].some(e => ownerOf(e.view.departure.customer) === owner)) this.bank.release(owner);
      });
      this.leaving.set(departure.id, { root, view });
    }
  }

  private syncFeedback(feedback: Feedback[], previous: Feedback[]) {
    const ctx = this.ctx!;
    const seen = new Set(previous.map(f => f.id)), live = new Set(feedback.map(f => f.id));
    for (const [id, effect] of this.floating) if (!live.has(id)) {
      effect.view.destroy(); effect.root.destroy(); this.floating.delete(id);
    }
    for (const item of feedback) {
      if (seen.has(item.id) || this.floating.has(item.id) || (item.tone === 'say' && item.slot !== this.front)) continue;
      const anchorX = ctx.layout.room.queueX + Math.max(56, ctx.layout.metrics.charWidth * 0.82);
      const root = this.scene.add.container(anchorX, 0)
        .setDepth(SLOT_DEPTH + 102);
      const view = new FloatingText(ctx, root, item, () => {
        const effect = this.floating.get(item.id);
        effect?.view.destroy(); effect?.root.destroy(); this.floating.delete(item.id);
      }, anchorX);
      this.floating.set(item.id, { root, view });
    }
  }

  private sweep(state: GameState) {
    const live = new Set<string>();
    for (const customer of [...state.slots, ...state.line]) if (customer) live.add(ownerOf(customer));
    for (const departure of state.departures) live.add(ownerOf(departure.customer));
    for (const effect of this.leaving.values()) live.add(ownerOf(effect.view.departure.customer));
    for (const owner of this.bank.owners()) if (owner.startsWith('c:') && !live.has(owner)) this.bank.release(owner);
  }

  /** Visual time is separate from the reducer's 150ms service clock. */
  updateMotion(delta: number, reduced: boolean, visible: boolean) {
    this.door?.update(delta);
    for (const guest of this.customers.values()) {
      if (guest.walk instanceof ArrivalWalk) guest.walk.update(delta);
      if (visible || guest.walk?.isPlaying()) guest.view.updateMotion(delta, reduced);
      guest.view.setWaiting(guest.slot !== this.front || guest.rank !== 0 || !!guest.walk?.isPlaying());
    }
    for (const effect of this.leaving.values()) effect.view.updateMotion(delta, reduced);
    this.syncReady();
  }

  private syncReady() {
    const guest = [...this.customers.values()].find(g => g.slot === this.front && g.rank === 0);
    uiState.set({ counterReady: Boolean(guest && !guest.walk?.isPlaying()) });
  }

  /** Waiting customers are scenery, never alternate service targets. */
  slotAt(x: number, y: number): number | null {
    const layout = this.ctx?.layout;
    if (!layout || this.front === null || behindCounterForeground(layout.room, x, y)) return null;
    const guest = [...this.customers.values()].find(item => item.slot === this.front);
    if (!guest || guest.walk?.isPlaying()) return null;
    const { charWidth, charHeight } = layout.metrics;
    const figure = Math.abs(x - layout.room.queueX) <= Math.max(22, charWidth / 2)
      && y >= layout.room.queueY - charHeight && y <= layout.room.queueY + 8;
    const bubble = Math.abs(x - (layout.room.queueX + Math.max(56, charWidth * 0.82))) <= 32
      && y >= layout.stageHeight - layout.metrics.bubbleBottom - 74
      && y <= layout.stageHeight - layout.metrics.bubbleBottom + 8;
    return figure || bubble ? this.front : null;
  }

  private clear() {
    for (const guest of this.customers.values()) { guest.walk?.remove(); guest.view.destroy(); guest.root.destroy(); }
    for (const effect of this.leaving.values()) { effect.view.destroy(); effect.root.destroy(); }
    for (const effect of this.floating.values()) { effect.view.destroy(); effect.root.destroy(); }
    this.customers.clear(); this.leaving.clear(); this.floating.clear(); this.front = null;
    this.door?.destroy(); this.door = null;
    uiState.set({ counterReady: false });
  }
}
