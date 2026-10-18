import Phaser from 'phaser';

import { Departure, Feedback, GameState, patienceLeft } from '../../../src/game/reducer';
import { CustomerView, ownerOf, preloadShared, StageContext } from './CustomerView';
import { FloatingText } from './FloatingText';
import { CounterLayout } from './layout';
import { LeavingView } from './LeavingView';
import { TextureBank } from './textures';

/**
 * The customers' half of `CustomerStage.tsx`: one column per slot, each holding (back to front)
 * whoever is walking off from it, whoever is standing in it, and the messages floating over it.
 * A later slot draws over an earlier one, as the original's row of `Pressable`s does, and the
 * counter's rim draws over all of them.
 *
 * `sync` is the whole of what the game's clock reaches. It is handed the state and the one before
 * it, and leans on the reducer keeping `slots`, `departures` and `feedback` the same arrays when
 * nothing in them moved: on an ordinary tick it compares a rounded patience per customer and
 * returns.
 */
export const SLOT_DEPTH = 10;

interface Column {
  root: Phaser.GameObjects.Container;
  leaving: Phaser.GameObjects.Container;
  active: Phaser.GameObjects.Container;
  floating: Phaser.GameObjects.Container;
}

export class Stage {
  private ctx: StageContext | null = null;
  private columns: Column[] = [];
  private customers: (CustomerView | null)[] = [];
  private leaving = new Map<number, LeavingView>();
  private floating = new Map<number, FloatingText>();

  constructor(private scene: Phaser.Scene, private bank: TextureBank) {
    void preloadShared(bank);
  }

  /**
   * Lay the stage out afresh for `layout`, standing everybody where they are without walking them
   * in again. Departures and messages already under way are not replayed.
   */
  build(layout: CounterLayout, state: GameState) {
    this.clear();
    const ctx: StageContext = { scene: this.scene, bank: this.bank, layout };
    this.ctx = ctx;
    this.columns = layout.slots.map((slot, i) => {
      const leaving = this.scene.add.container(0, 0);
      const active = this.scene.add.container(0, 0);
      const floating = this.scene.add.container(0, 0);
      const root = this.scene.add.container(slot.centre, 0, [leaving, active, floating]).setDepth(SLOT_DEPTH + i);
      return { root, leaving, active, floating };
    });
    this.customers = layout.slots.map(() => null);
    this.syncCustomers(state, false);
    this.sweep(state);
  }

  sync(state: GameState, previous: GameState) {
    if (!this.ctx) return;
    // Departures first: one arrives in the same state as the slot it empties, and starts from the
    // face that customer is still showing.
    if (state.departures !== previous.departures) this.syncDepartures(state.departures, previous.departures);
    if (state.slots !== previous.slots || state.clock !== previous.clock || state.selectedSlot !== previous.selectedSlot) {
      this.syncCustomers(state, true);
    }
    if (state.feedback !== previous.feedback) this.syncFeedback(state.feedback, previous.feedback);
    if (state.slots !== previous.slots || state.departures !== previous.departures) this.sweep(state);
  }

  destroy() {
    this.clear();
    this.ctx = null;
  }

  private syncCustomers(state: GameState, animate: boolean) {
    const ctx = this.ctx!;
    const count = this.columns.length;
    for (let slot = 0; slot < count; slot++) {
      const customer = state.slots[slot] ?? null;
      const view = this.customers[slot];
      if (!customer) {
        if (view) {
          view.destroy();
          this.customers[slot] = null;
        }
        continue;
      }
      const patience = patienceLeft(customer, state.clock);
      const selected = slot === state.selectedSlot;
      if (view && view.customer.id === customer.id) {
        view.update(customer, patience, selected);
        continue;
      }
      view?.destroy();
      this.customers[slot] = new CustomerView(ctx, this.columns[slot].active, customer, patience, selected,
        slot < count / 2 ? -1 : 1, animate);
    }
  }

  private syncDepartures(departures: Departure[], previous: Departure[]) {
    const ctx = this.ctx!;
    const seen = new Set(previous.map((d) => d.id));
    const live = new Set(departures.map((d) => d.id));
    for (const [id, view] of this.leaving) {
      if (!live.has(id)) {
        view.destroy();
        this.leaving.delete(id);
      }
    }
    for (const departure of departures) {
      if (seen.has(departure.id) || this.leaving.has(departure.id)) continue;
      const column = this.columns[departure.slot];
      if (!column) continue;
      // Start from the face they had at the counter while the one they leave with is drawn.
      const standing = this.customers.find((view) => view?.customer.id === departure.customer.id);
      const startKey = standing?.currentFigureKey() ?? null;
      this.leaving.set(departure.id, new LeavingView(ctx, column.leaving, departure, startKey));
    }
  }

  private syncFeedback(feedback: Feedback[], previous: Feedback[]) {
    const ctx = this.ctx!;
    const seen = new Set(previous.map((f) => f.id));
    const live = new Set(feedback.map((f) => f.id));
    for (const [id, view] of this.floating) {
      if (!live.has(id)) {
        view.destroy();
        this.floating.delete(id);
      }
    }
    for (const item of feedback) {
      if (seen.has(item.id) || this.floating.has(item.id)) continue;
      const column = this.columns[item.slot];
      if (!column) continue;
      this.floating.set(item.id, new FloatingText(ctx, column.floating, item, () => {
        this.floating.get(item.id)?.destroy();
        this.floating.delete(item.id);
      }));
    }
  }

  /** Let go of the textures of everyone who is neither at the counter nor walking away from it. */
  private sweep(state: GameState) {
    const live = new Set<string>();
    for (const customer of state.slots) if (customer) live.add(ownerOf(customer));
    for (const departure of state.departures) live.add(ownerOf(departure.customer));
    for (const owner of this.bank.owners()) {
      if (owner.startsWith('c:') && !live.has(owner)) this.bank.release(owner);
    }
  }

  /** Which slot a point on the stage is in, if any. */
  slotAt(x: number, y: number): number | null {
    const layout = this.ctx?.layout;
    if (!layout || y < 0 || y > layout.stageHeight) return null;
    const index = layout.slots.findIndex((slot) => x >= slot.left && x < slot.left + slot.width);
    return index < 0 ? null : index;
  }

  private clear() {
    for (const view of this.customers) view?.destroy();
    for (const view of this.leaving.values()) view.destroy();
    for (const view of this.floating.values()) view.destroy();
    this.customers = [];
    this.leaving.clear();
    this.floating.clear();
    for (const column of this.columns) column.root.destroy();
    this.columns = [];
  }
}
