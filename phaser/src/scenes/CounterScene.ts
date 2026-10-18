import Phaser from 'phaser';

import { GameState } from '../../../src/game/reducer';
import { colors } from '../art/theme';
import { Backdrop } from '../counter/Backdrop';
import { CounterLayout, layoutCounter } from '../counter/layout';
import { Stage } from '../counter/Stage';
import { TextureBank } from '../counter/textures';
import { dragPage, goToPage, releasePage } from '../game/pager';
import { placeCamera } from '../game/view';
import { playSound } from '../sound';
import { dispatch, store } from '../store';
import { uiState } from '../ui-state';

/**
 * The counter: customers waiting, and the one tap that takes their order. Page 0 of the pager —
 * `CounterPage.tsx` and `CustomerStage.tsx` as a Phaser scene.
 *
 * The page is the stage (the shop's wall, the customers, the counter's rim) over the barista's
 * side of the counter. Every picture on it is an SVG rasterised once into a texture; what moves is
 * moved by tweens, and the game's clock only ever reaches a comparison of each customer's rounded
 * patience against the one already showing (see `Stage`).
 *
 * Input is the page's own: a tap on a customer takes their order or opens their ticket, and a
 * horizontal drag anywhere drives the pager towards the kitchen.
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
  swiping: boolean;
  samples: { t: number; x: number }[];
};

export class CounterScene extends Phaser.Scene {
  private bank!: TextureBank;
  private backdrop!: Backdrop;
  private stage!: Stage;
  private layout: CounterLayout | null = null;
  private layoutKey = '';
  private gesture: Gesture | null = null;

  constructor() {
    super('counter');
  }

  create() {
    // The page's floor, under the counter top, is the camera's own colour.
    this.cameras.main.setBackgroundColor(colors.floor);
    this.bank = new TextureBank(this);
    this.backdrop = new Backdrop(this, this.bank);
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
      this.backdrop.destroy();
      this.bank.releaseAll();
    });

    this.relayout();
    this.place();
  }

  /** The clouds are the only thing that moves on its own, and only while the counter is in view. */
  update(_time: number, delta: number) {
    if (uiState.value.pageOffset < 1) this.backdrop.drift(delta);
  }

  // ================================================================== layout
  private place() {
    const { pager, pageOffset } = uiState.value;
    placeCamera(this.cameras.main, -pageOffset * pager.width, 0, pager.width, pager.height);
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
    const layout = layoutCounter(width, height, window.innerWidth, window.innerHeight, slots);
    const was = this.layout;
    this.layoutKey = key;
    this.layout = layout;
    if (!was || was.width !== layout.width || was.stageHeight !== layout.stageHeight || was.floorHeight !== layout.floorHeight) {
      this.backdrop.build(layout);
    }
    this.stage.build(layout, store.state);
  }

  private onState(state: GameState, previous: GameState) {
    if (state.slots.length !== previous.slots.length) {
      this.relayout();
      return;
    }
    this.stage.sync(state, previous);
  }

  // ================================================================== input
  /** Whether the shift is running, so a customer can be served — or a page swiped. */
  private running() {
    const { phase, paused } = store.state;
    return phase === 'playing' && !paused && !uiState.value.opening;
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.gesture || !this.layout) return;
    const { page, pageOffset } = uiState.value;
    if (page !== 0 || pageOffset !== 0 || !this.running()) return;
    const { x, y } = this.worldPoint(pointer);
    if (x < 0 || y < 0 || x > this.layout.width || y > this.layout.height) return;
    this.gesture = {
      id: pointer.id, startX: x, startY: y, slot: this.stage.slotAt(x, y), swiping: false,
      samples: [{ t: performance.now(), x }],
    };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== gesture.id || !this.layout) return;
    const { x, y } = this.worldPoint(pointer);
    const dx = x - gesture.startX;
    if (!gesture.swiping) {
      if (Math.abs(dx) <= SLOP || Math.abs(dx) < Math.abs(y - gesture.startY)) {
        // A finger that wanders off vertically is no longer a tap, and never becomes a swipe.
        if (Math.hypot(dx, y - gesture.startY) > SLOP) gesture.slot = null;
        return;
      }
      gesture.swiping = true;
      gesture.slot = null;
    }
    const now = performance.now();
    gesture.samples.push({ t: now, x });
    while (gesture.samples.length > 2 && now - gesture.samples[0].t > VELOCITY_WINDOW_MS) gesture.samples.shift();
    // Dragging left brings the kitchen in from the right.
    dragPage(-dx / this.layout.width);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== gesture.id) return;
    this.gesture = null;
    if (gesture.swiping) {
      const { x } = this.worldPoint(pointer);
      const now = performance.now();
      const first = gesture.samples.find((sample) => now - sample.t <= VELOCITY_WINDOW_MS) ?? gesture.samples[gesture.samples.length - 1];
      const dt = Math.max(1, now - first.t);
      // Pages a second, towards the kitchen. A finger held still before it lifts has no flick in it.
      const velocity = now - first.t > VELOCITY_WINDOW_MS ? 0 : (-(x - first.x) / (this.layout?.width ?? 1)) * (1000 / dt);
      releasePage(velocity);
      return;
    }
    if (gesture.slot === null || !this.running()) return;
    const { x, y } = this.worldPoint(pointer);
    if (this.stage.slotAt(x, y) !== gesture.slot) return;
    this.tapSlot(gesture.slot);
  }

  /** `takeOrder` / `focusTicket` in `GameScreen.tsx`. */
  private tapSlot(slot: number) {
    const customer = store.state.slots[slot];
    if (!customer) return;
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
}
