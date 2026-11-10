import Phaser from 'phaser';

import { frontSlot, GameState } from '../game/reducer';
import { colors } from '../art/theme';
import { Backdrop } from '../counter/Backdrop';
import { CafeCats } from '../counter/CafeCats';
import { CounterLayout, layoutCounter } from '../counter/layout';
import { Stage } from '../counter/Stage';
import { TextureBank } from '../counter/textures';
import { goToPage } from '../game/pager';
import { placeCamera } from '../game/view';
import { playSound } from '../sound';
import { dispatch, store } from '../store';
import { uiState } from '../ui-state';

/**
 * The counter: customers waiting, and the one tap that takes their order. Page 0 of the pager —
 * The painted cafe and the live customer queue as a Phaser scene.
 *
 * The room is one painted texture. Cat rig layers and bubbles are SVGs rasterised once;
 * frame updates animate joints, travel is tweened, and the game's clock only reaches each customer's rounded
 * patience against the one already showing (see `Stage`).
 *
 * Input is the page's own: a tap on a customer takes their order or opens their ticket, and a
 * horizontal drag pans the larger cafe painting; taps on the resident cats pet them.
 */

/** How far a finger may wander and still be a tap; past it horizontally, it is a swipe. */
const SLOP = 10;
/** How much of the drag's recent history its release speed is measured over. */
const VELOCITY_WINDOW_MS = 100;

type Gesture = {
  id: number;
  startX: number;
  startY: number;
  slot: number | null;
  cat: number | null;
  swiping: boolean;
  startPan: number;
  samples: { t: number; x: number }[];
};

export class CounterScene extends Phaser.Scene {
  private bank!: TextureBank;
  private backdrop!: Backdrop;
  private cats!: CafeCats;
  private stage!: Stage;
  private layout: CounterLayout | null = null;
  private layoutKey = '';
  private gesture: Gesture | null = null;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pan = 0;
  private panVelocity = 0;

  constructor() {
    super('counter');
  }

  create() {
    // The page's floor, under the counter top, is the camera's own colour.
    this.cameras.main.setBackgroundColor(colors.floor);
    this.bank = new TextureBank(this);
    this.backdrop = new Backdrop(this);
    this.cats = new CafeCats(this);
    this.stage = new Stage(this, this.bank);

    const offStore = store.subscribe((state, previous) => this.onState(state, previous));
    const offUi = uiState.subscribe((ui, was) => {
      if (ui.pager !== was.pager) this.relayout();
      if (ui.pager !== was.pager || ui.pageOffset !== was.pageOffset) this.place();
    });
    // The window's proportions decide `wide`, and they can change without the pager's size doing so.
    const onResize = () => this.relayout();
    window.addEventListener('resize', onResize);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    this.events.once('shutdown', () => {
      offStore();
      offUi();
      window.removeEventListener('resize', onResize);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('pointerupoutside', this.onUp, this);
      this.stage.destroy();
      this.cats.destroy();
      this.backdrop.destroy();
      this.bank.releaseAll();
    });

    this.relayout();
    this.place();
  }

  // ================================================================== layout
  private place() {
    const { pager, pageOffset } = uiState.value;
    placeCamera(this.cameras.main, -pageOffset * pager.width, 0, pager.width, pager.height);
    this.cameras.main.setScroll(this.pan, 0);
    this.cameras.main.setVisible(pageOffset < 1);
  }

  private relayout() {
    const { pager } = uiState.value;
    const width = Math.round(pager.width);
    const height = Math.round(pager.height);
    if (width <= 0 || height <= 0) return;
    const slots = store.state.slots.length;
    const key = `${width}x${height}:${window.innerWidth}x${window.innerHeight}:${slots}`;
    if (key === this.layoutKey) return;
    const oldMax = this.layout?.room.maxPan ?? 0;
    const oldPan = this.pan;
    const layout = layoutCounter(width, height, window.innerWidth, window.innerHeight, slots);
    this.layoutKey = key;
    this.layout = layout;
    this.pan = oldMax > 0 ? Math.min(layout.room.maxPan, oldPan / oldMax * layout.room.maxPan)
      : layout.room.initialPan;
    this.cameras.main.setScroll(this.pan, 0);
    uiState.set({ counterPan: this.pan });
    this.backdrop.build(layout);
    this.cats.build(layout);
    this.stage.build(layout, store.state);
  }

  private onState(state: GameState, previous: GameState) {
    if (state.day !== previous.day && this.layout) {
      this.panVelocity = 0;
      this.setPan(this.layout.room.initialPan);
    }
    if (state.slots.length !== previous.slots.length) {
      this.relayout();
      return;
    }
    this.stage.sync(state, previous);
  }

  // ================================================================== input
  /** Whether the shift is running, so customers and the room can be interacted with. */
  private running() {
    const { phase, paused } = store.state;
    return phase === 'playing' && !paused && !uiState.value.opening;
  }

  update(_time: number, delta: number) {
    if (!this.stage) return;
    const running = this.running() && !document.hidden;
    // Pause travel and facial/body motion together. Invisible idle rigs need no frame work;
    // departures still finish while preparing the next drink so their textures can be released.
    this.tweens.timeScale = running ? 1 : 0;
    if (running) this.stage.updateMotion(delta, this.reducedMotion.matches, uiState.value.pageOffset < 1);
    if (running) {
      this.cats.update(delta, this.reducedMotion.matches);
      if (!this.gesture && Math.abs(this.panVelocity) > 0.01) {
        this.setPan(this.pan + this.panVelocity * delta);
        this.panVelocity *= Math.pow(0.991, delta);
        if (this.pan <= 0 || this.pan >= (this.layout?.room.maxPan ?? 0)) this.panVelocity = 0;
      }
    }
    else if (store.state.phase === 'dayEnd' && !document.hidden) {
      // Finish and release the final departing rig even if the results card opened mid-walk.
      this.stage.updateMotion(delta, this.reducedMotion.matches, false);
    }
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.gesture || !this.layout) return;
    const { page, pageOffset } = uiState.value;
    if (page !== 0 || pageOffset !== 0 || !this.running()) return;
    const { x, y } = this.worldPoint(pointer);
    const screenX = x - this.pan;
    if (screenX < 0 || y < 0 || screenX > this.layout.width || y > this.layout.height) return;
    this.panVelocity = 0;
    this.gesture = {
      id: pointer.id, startX: screenX, startY: y, slot: this.stage.slotAt(x, y),
      cat: this.cats.at(x, y), swiping: false, startPan: this.pan,
      samples: [{ t: performance.now(), x: screenX }],
    };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== gesture.id || !this.layout) return;
    const { x, y } = this.worldPoint(pointer);
    const screenX = x - this.pan;
    const dx = screenX - gesture.startX;
    if (!gesture.swiping) {
      if (Math.abs(dx) <= SLOP || Math.abs(dx) < Math.abs(y - gesture.startY)) {
        // A finger that wanders off vertically is no longer a tap, and never becomes a swipe.
        if (Math.hypot(dx, y - gesture.startY) > SLOP) { gesture.slot = null; gesture.cat = null; }
        return;
      }
      gesture.swiping = true;
      gesture.slot = null;
      gesture.cat = null;
    }
    const now = performance.now();
    gesture.samples.push({ t: now, x: screenX });
    while (gesture.samples.length > 2 && now - gesture.samples[0].t > VELOCITY_WINDOW_MS) gesture.samples.shift();
    this.setPan(gesture.startPan - dx);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== gesture.id) return;
    this.gesture = null;
    if (gesture.swiping) {
      const { x } = this.worldPoint(pointer);
      const screenX = x - this.pan;
      const now = performance.now();
      const first = gesture.samples.find((sample) => now - sample.t <= VELOCITY_WINDOW_MS) ?? gesture.samples[gesture.samples.length - 1];
      const dt = Math.max(1, now - first.t);
      this.panVelocity = now - first.t > VELOCITY_WINDOW_MS ? 0
        : Math.max(-1.5, Math.min(1.5, -(screenX - first.x) / dt));
      return;
    }
    if (!this.running()) return;
    const { x, y } = this.worldPoint(pointer);
    if (gesture.cat !== null && this.cats.at(x, y) === gesture.cat) {
      if (this.cats.pet(gesture.cat)) playSound('meow');
      return;
    }
    if (gesture.slot === null) return;
    if (this.stage.slotAt(x, y) !== gesture.slot) return;
    this.tapSlot(gesture.slot);
  }

  /** `takeOrder` / `focusTicket` in `GameScreen.tsx`. */
  private tapSlot(slot: number) {
    const customer = store.state.slots[slot];
    if (!customer || slot !== frontSlot(store.state.slots)) return;
    if (customer.status === 'requesting') {
      playSound('order');
      dispatch({ type: 'TAKE_ORDER', slot });
    } else {
      dispatch({ type: 'SELECT_SLOT', slot });
      goToPage(1);
    }
  }

  /** Where a pointer is on the page — measured off the page's resting place, not where it is mid-swipe. */
  private worldPoint(pointer: Phaser.Input.Pointer) {
    const { pageOffset, pager } = uiState.value;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x - pageOffset * pager.width, y: point.y };
  }

  private setPan(value: number) {
    if (!this.layout) return;
    const next = Math.max(0, Math.min(this.layout.room.maxPan, value));
    if (Math.abs(next - this.pan) < 0.01) return;
    this.pan = next;
    this.cameras.main.setScroll(next, 0);
    uiState.set({ counterPan: next });
  }
}
