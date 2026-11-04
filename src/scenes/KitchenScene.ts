import Phaser from 'phaser';

import {
  CupSize, Drink, EMPTY_DRINK, getIngredient, MAX_ICE_SCOOPS, MILK_SPLASH, pouredAmount, SUGAR_STEPS,
} from '../game/ingredients';
import { GameState } from '../game/reducer';
import { CUP_HOLDER, CUP_HOLDER_ART, ROOM_BG_SIZE } from '../art/kitchenArt';
import { KITCHEN_ROOM_RENDER } from '../art/kitchenRoomArt';
import { holderSurfaceY, HOLDER_HEIGHT, HOLDER_RECESS } from '../art/referenceCupArt';
import { CUP_ART, CUP_BASE, CUP_FOOT } from '../art/cupGeometry';
import { gameArea } from '../game/host';
import { bakeCanvas, canvasFont, placeCamera, tex } from '../game/view';
import { playSound, setPourFill, setPouring as setPourSound } from '../sound';
import { dispatch, store } from '../store';
import { nudge, uiState } from '../ui-state';
import { CupView } from '../kitchen/CupView';
import { addTool, finishPartTexture, prepareEquipmentTextures, card, measure, roundRect, sourceImage } from '../kitchen/equipment';
import { cupSizeFor, findDairyStation, findStation, hintFor, KitchenLayout, layoutKitchen, Station } from '../kitchen/layout';
import { KITCHEN_TEXT_MIN } from '../kitchen/typography';
import { DURATION, EASE } from '../kitchen/motion';
import { cupSeatShadowTexture, cupShadowTexture, Spill, Stream } from '../kitchen/pourEffects';
import { CUP_LID_HOLE_Y, STRAW_INSERT } from '../art/finishingArt';

/**
 * The kitchen you work in — `KitchenStation.tsx`, as a Phaser scene. Page 1 of the pager.
 *
 * Two gestures, both held in the hand:
 * - **drag the cup** up under a tea dispenser and **hold the tap** — how long you hold is how much
 *   runs in, with the meter over the kitchen showing the live amount;
 * - **drag a topping, ice, milk or a spoon of sugar or foam straight onto the cup**.
 *
 * **Everything that can be dragged can be tapped instead**, and a tap is immediate: the cup stands
 * on the mat, the ingredient is in the cup, the cup is under the tapped tank. Nothing travels —
 * a tap is the short way and is drawn as one — and the one thing it will not do for the player is
 * hold the tap open, because how long it is held is the pour.
 *
 * Plus the painted room itself, swiped to pan along the wall. Every rule of what may go in is the
 * reducer's; this scene checks the same things first only so it can put a tool back and say why.
 *
 * Depth, back to front: the room (panned), the mat, the resting cup's shadow, the stream's lower
 * half, the cup, the tool in hand, the cup off the rack, the stream's upper half.
 */
const DEPTH = { room: 0, holder: 10, shadow: 15, streamBack: 18, cup: 20, tool: 30, rackCup: 32, streamFront: 35 };
/**
 * How far a finger may travel and still be a tap. It is the only thing separating the quick way
 * from a drag, and it decides three things at once: whether a tool is ever lifted off the counter,
 * where the cup goes, and whether anything is animated getting there.
 */
const TAP_DISTANCE = 8;
/** How long the straw takes to go down through the lid, once it is lined up over the opening. */
const INSERT_MS = 220;

type Gesture =
  | { kind: 'cup'; startX: number; startY: number; grabX: number; grabY: number; owned: boolean }
  | { kind: 'lid'; station: Station; startX: number; startY: number }
  | { kind: 'pour'; station: Station; enabled: boolean; startedAt: number; startX: number }
  | { kind: 'carry'; station: Station; startX: number; startY: number; distance: number; target: Phaser.GameObjects.Container }
  | { kind: 'refused'; station?: Station }
  | { kind: 'rack'; size: CupSize; startX: number; startY: number; originX: number; originY: number; distance: number }
  | { kind: 'pan'; startX: number; startPan: number; lastX: number; lastT: number; velocity: number };

interface Placed { x: number; y: number; scale: number }

/** Where a finishing part sits on the cup, in the cup's own 113x174 units. */
interface FinishBox { x: number; y: number; width: number; height: number }

export class KitchenScene extends Phaser.Scene {
  private layout: KitchenLayout | null = null;
  private layoutKey = '';
  private W = 0;
  private H = 0;

  private room!: Phaser.GameObjects.Container;
  private holder!: Phaser.GameObjects.Image;
  private holderFront!: Phaser.GameObjects.Image;
  private matLabel: Phaser.GameObjects.Image | null = null;
  /** Transient input feedback only; all stationary equipment is part of the room painting. */
  private stationViews = new Map<string, Phaser.GameObjects.Image>();

  private pan = 0;
  private panVelocity = 0;
  /** Where the wall is heading while it slides itself to a tapped tap; otherwise where it is. */
  private panTarget = 0;
  private panTween: Phaser.Tweens.Tween | null = null;

  private cup: CupView | null = null;
  private cupKey = '';
  private cupPos: Placed = { x: 0, y: 0, scale: 1 };
  private cupTweens: Phaser.Tweens.Tween[] = [];
  private appear = 1;
  /** Set while a cup that has just flown to the mat is handed over, so it is not dropped in twice. */
  private flewIn = false;
  private cupShadow!: Phaser.GameObjects.Image;
  private dock: string | null = null;
  private dockCupId = -1;

  private level = 0;
  private levelTween: Phaser.Tweens.Tween | null = null;
  private pouring: { station: Station; running: boolean; startedAt: number; from: number } | null = null;
  private stream: Stream | null = null;
  private spill: Spill | null = null;

  private tool: Phaser.GameObjects.Container | null = null;
  private toolState = { x: 0, y: 0, tip: 0, show: 0, originX: 0, originY: 0, size: 0 };
  private toolTweens: Phaser.Tweens.Tween[] = [];
  private finishingTool = false;
  private toolCupId = -1;
  private rackCup: { view: CupView; x: number; y: number; alpha: number } | null = null;
  /**
   * What a tool still crossing the room has already tipped in: the drink as it was before it did,
   * which is what the cup goes on being drawn as until the tool lands. The shop has the scoop from
   * the dispatch exactly as it always did — what waits is the picture, so that the pearls are not
   * in the drink while the scoop of them is still in the air.
   */
  private pending: { drink: Drink; cupId: number } | null = null;
  /** A lid or a straw on its way onto the cup, and the picture it is holding back: {@link fitPart}. */
  private fitting:
    | { part: 'lid' | 'straw'; view: Phaser.GameObjects.Image; box: FinishBox; fromX: number; fromY: number; t: number; sunk: number }
    | null = null;

  private gesture: Gesture | null = null;
  private pointerId = -1;

  constructor() {
    super('kitchen');
  }

  create() {
    this.room = this.add.container(0, 0).setDepth(DEPTH.room);
    this.holder = this.add.image(0, 0, tex(CUP_HOLDER)).setOrigin(0).setDepth(DEPTH.holder);
    this.holderFront = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(DEPTH.cup + 1).setVisible(false);
    this.cupShadow = this.add.image(0, 0, cupShadowTexture(this)).setOrigin(0).setDepth(DEPTH.shadow).setVisible(false);
    this.level = store.state.build.fill;

    // Vector equipment is rasterised once; the room is rebuilt when it is ready.
    void prepareEquipmentTextures(this)
      .then(() => this.relayout(true))
      .catch((error: unknown) => console.warn('[kitchen] equipment could not be drawn', error));

    const offStore = store.subscribe((state, previous) => this.onState(state, previous));
    const offUi = uiState.subscribe((ui, was) => {
      if (ui.kitchenRect !== was.kitchenRect || ui.pager !== was.pager) this.relayout();
      if (ui.pageOffset !== was.pageOffset || ui.kitchenRect !== was.kitchenRect || ui.pager !== was.pager) this.placeCameraNow();
    });
    const onHidden = () => {
      if (document.visibilityState === 'hidden') this.abortAll();
    };
    document.addEventListener('visibilitychange', onHidden);
    this.events.once('shutdown', () => {
      offStore();
      offUi();
      document.removeEventListener('visibilitychange', onHidden);
    });

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    this.relayout();
    this.placeCameraNow();
  }

  // ================================================================== layout
  private placeCameraNow() {
    const { pager, pageOffset, kitchenRect } = uiState.value;
    placeCamera(this.cameras.main, (1 - pageOffset) * pager.width + kitchenRect.x, kitchenRect.y,
      kitchenRect.width, kitchenRect.height);
    this.cameras.main.setVisible(pageOffset > 0 && kitchenRect.width > 0);
  }

  /** Rebuild the room for the kitchen's size, the day's equipment and the cup's size. */
  private relayout(force = false) {
    const { kitchenRect } = uiState.value;
    const state = store.state;
    const W = Math.round(kitchenRect.width);
    const H = Math.round(kitchenRect.height);
    if (W <= 0 || H <= 0) return;
    const key = `${W}x${H}:${state.day}:${state.cup.size ?? 'M'}`;
    if (!force && key === this.layoutKey) return;
    const firstLayout = !this.layoutKey;
    this.layoutKey = key;
    this.W = W;
    this.H = H;
    this.cancelGesture();
    this.layout = layoutKitchen(state.config, W, H, state.cup.size ?? 'M');
    // The room opens at its left-hand end and is panned right from there; it used to open on the
    // cup rack, which put half the wall behind the player before they had touched anything.
    this.pan = firstLayout ? 0 : Math.min(this.pan, this.layout.room.maxPan);
    this.buildRoom();
    this.buildCup(true);
    this.refreshEquipment();
  }

  /** One continuous room painting, invisible touch feedback, and the movable cup's holder. */
  private buildRoom() {
    const layout = this.layout!;
    this.room.removeAll(true);
    this.stationViews.clear();
    const { room } = layout;
    this.room.add(this.add.image(0, room.top, tex(KITCHEN_ROOM_RENDER))
      .setOrigin(0).setDisplaySize(room.width, ROOM_BG_SIZE.height * room.scale));
    const sized = (w: number, h: number) => `${w.toFixed(1)}x${h.toFixed(1)}`;
    // These highlights are transparent at rest. They never repaint or resize the equipment.
    for (const station of layout.stations) {
      const key = bakeCanvas(this, `station-touch:${sized(station.w, station.h)}`, station.w, station.h, c => {
        roundRect(c, 0, 0, station.w, station.h, 8);
        c.fillStyle = '#FFF8E6'; c.fill();
      });
      const highlight = this.add.image(station.x, station.y, key).setOrigin(0)
        .setDisplaySize(station.w, station.h).setAlpha(0);
      this.room.add(highlight);
      this.stationViews.set(station.key, highlight);
    }
    this.room.setX(-this.pan);

    const box = layout.holder;
    const faceKey = bakeCanvas(this, `holder-plane:${sized(box.width, box.height)}`, box.width * 2, box.height * 2, c => {
      c.scale(2, 2);
      c.imageSmoothingQuality = 'high';
      const crop = CUP_HOLDER_ART;
      const source = sourceImage(this, CUP_HOLDER);
      for (let row = 0; row < crop.height; row++) {
        const y0 = holderSurfaceY(row) / HOLDER_HEIGHT * box.height;
        const y1 = holderSurfaceY(row + 1) / HOLDER_HEIGHT * box.height;
        c.drawImage(source, crop.x, crop.y + row, crop.width, 1, 0, y0, box.width, y1 - y0 + 0.08);
      }
    });
    // Cast from the finished silhouette once, leaving space for the soft edge on all sides.
    const pad = 8;
    const holderKey = bakeCanvas(this, `holder-contact:${sized(box.width, box.height)}`,
      box.width + pad * 2, box.height + pad * 2, c => {
        const face = this.textures.get(faceKey).getSourceImage() as CanvasImageSource;
        c.shadowColor = '#69513d42';
        c.shadowBlur = 3.5;
        c.shadowOffsetX = -2;
        c.shadowOffsetY = 2.5;
        c.drawImage(face, pad, pad, box.width, box.height);
      });
    this.holder.setTexture(holderKey).setPosition(box.left - pad, box.top - pad)
      .setDisplaySize(box.width + pad * 2, box.height + pad * 2);
    const frontKey = bakeCanvas(this, `holder-near-lip:${sized(box.width, box.height)}`, box.width, box.height, c => {
      const recess = HOLDER_RECESS;
      const px = (x: number) => x / CUP_HOLDER_ART.width * box.width;
      const py = (y: number) => holderSurfaceY(y) / HOLDER_HEIGHT * box.height;
      c.beginPath();
      c.moveTo(px(recess.x - recess.rx), py(recess.y));
      // Trace the projected near ellipse, then keep only the actual painted holder below it.
      for (let step = 1; step <= 64; step++) {
        const angle = Math.PI - step / 64 * Math.PI;
        c.lineTo(px(recess.x + Math.cos(angle) * recess.rx), py(recess.y + Math.sin(angle) * recess.ry));
      }
      c.lineTo(box.width, box.height); c.lineTo(0, box.height); c.closePath();
      c.clip();
      c.drawImage(this.textures.get(faceKey).getSourceImage() as CanvasImageSource, 0, 0, box.width, box.height);
    });
    this.holderFront.setTexture(frontKey).setPosition(box.left, box.top).setDisplaySize(box.width, box.height);
  }

  /** The active tap and the hint follow the drink; the painted supplies stay in place. */
  private refreshEquipment() {
    const { cup, build } = store.state;
    const docked = this.docked();
    for (const [key, highlight] of this.stationViews) {
      highlight.setAlpha(docked?.key === key ? 0.08 : 0);
    }
    uiState.set({ hint: hintFor(cup, docked ?? undefined, build) });
  }

  // ================================================================== the cup
  private docked(): Station | null {
    if (!this.layout || this.dockCupId !== store.state.cupId || !this.dock) return null;
    return this.layout.stations.find((s) => s.key === this.dock) ?? null;
  }

  /** Make (or remake) the cup for the drink on the mat. */
  private buildCup(relayout = false) {
    const { build, cup, cupId } = store.state;
    const layout = this.layout;
    if (!layout) return;
    const key = `${cupId}:${cup.size}:${layout.cupW}`;
    // No cup yet, or one carried out to the counter: either way the mat is empty. Only an empty mat
    // is labelled — a cup that is out at the front is spoken for, and the hint pill says where it is.
    if (!cup.size || build.atCounter) {
      this.pending = null;
      this.settlePart();
      this.cup?.destroy();
      this.cup = null;
      this.cupKey = '';
      // The spill lived inside the cup's container and went with it.
      this.spill = null;
      this.dock = null;
      this.showMatLabel(!cup.size);
      return;
    }
    this.showMatLabel(false);
    if (key === this.cupKey && this.cup) {
      if (relayout) {
        this.standCupDown(true);
      }
      return;
    }
    const freshCup = !this.cupKey.startsWith(`${cupId}:`);
    this.cup?.destroy();
    this.cupKey = key;
    this.cup = new CupView(this, layout.cupW, layout.cupH, cup);
    this.showFinish();
    this.cup.setDrink(this.drinkShown(), cupId, true);
    this.cup.level = this.level;
    this.cup.container.setDepth(DEPTH.cup);
    this.spill?.container.destroy();
    this.spill = null;
    this.dock = null;
    this.cupPos = { x: layout.homeX, y: layout.homeY, scale: 1 };
    // A new cup drops onto the mat; one that is merely re-sized or re-laid-out just stands there,
    // and one that flew there has been on screen the whole way and must not be dropped in on top.
    this.appear = freshCup && !this.flewIn ? 0 : 1;
    if (this.appear === 0) this.tweens.add({ targets: this, appear: 1, duration: DURATION.slow, ease: EASE });
  }

  private showMatLabel(show: boolean) {
    this.matLabel?.destroy();
    this.matLabel = null;
    if (!show || !this.layout) return;
    const { holder } = this.layout;
    const label = 'Chọn ly';
    const font = canvasFont(KITCHEN_TEXT_MIN, 700);
    const w = measure(label, font) + 12;
    const h = 19;
    const key = bakeCanvas(this, `mat-label:${w.toFixed(1)}`, w, h, (c) => {
      card(c, w, h, 5, '#FFF4DC', 0, '');
      c.font = font;
      c.fillStyle = '#795331';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, w / 2, h / 2 + 1);
    });
    this.matLabel = this.add.image(holder.left + holder.width / 2, holder.top + holder.height / 2, key)
      .setDisplaySize(w, h).setDepth(DEPTH.holder + 1);
  }

  private tweenCup(to: Partial<Placed>, duration: number) {
    for (const tween of this.cupTweens) tween.stop();
    if (duration <= 0) {
      Object.assign(this.cupPos, to);
      this.cupTweens = [];
      return;
    }
    this.cupTweens = [this.tweens.add({ targets: this.cupPos, ...to, duration, ease: EASE })];
  }

  /**
   * Send the cup back to its mat, wherever it was left, gliding down from a tank's spout the way
   * it went up. **The dock is given up before the glide starts**, so nothing is held by it: a tool
   * can be picked up, another tank tapped or the cup itself grabbed while it is still on its way
   * down, and whatever that does simply takes over the tween. `instant` is for the one case with
   * no journey in it at all — a relayout, where the cup is already being put back where it stands.
   */
  private standCupDown(instant = false) {
    if (!this.layout) return;
    const wasDocked = Boolean(this.dock);
    this.dock = null;
    if (this.pouring) this.stopPour(false);
    const home = { x: this.layout.homeX, y: this.layout.homeY, scale: 1 };
    if (instant) {
      for (const tween of this.cupTweens) tween.stop();
      Object.assign(this.cupPos, home);
    } else this.tweenCup(home, DURATION.slow);
    if (wasDocked) {
      this.cup?.setDrink(this.drinkShown(), store.state.cupId);
      this.refreshEquipment();
    }
  }

  // ================================================================== the shop changed
  private onState(state: GameState, previous: GameState) {
    if (state.phase !== 'playing') {
      this.cancelGesture();
      return;
    }
    if (state.day !== previous.day || state.config !== previous.config || state.cup.size !== previous.cup.size) {
      this.relayout();
    }
    if (state.cupId !== previous.cupId) {
      // A new cup starts empty, back on the table.
      this.cancelGesture();
      this.dock = null;
      this.pouring = null;
      this.level = state.build.fill;
      this.levelTween?.stop();
      // Nothing in the air belongs to this cup.
      this.pending = null;
      this.settlePart();
    }
    if (state.cupId !== previous.cupId || state.cup !== previous.cup
      || state.build.atCounter !== previous.build.atCounter) {
      this.buildCup();
      this.cup?.setDrink(this.drinkShown(), state.cupId);
      this.refreshEquipment();
    }
    if (state.build.fill !== previous.build.fill || state.cupId !== previous.cupId) {
      // A carton still on its way over has not splashed in yet; `settlePending` catches up for it.
      if (!this.pending) this.tweenLevel(state.build.fill, DURATION.base);
      setPourFill(state.build.fill);
    }
    if (state.build !== previous.build) {
      this.showFinish();
      this.refreshEquipment();
    }
  }

  /**
   * The drink as drawn: while the cup stands under a tap its tea is the tap's, and whatever a tool
   * in the air is still bringing over is not in it yet ({@link pending}).
   */
  private drinkShown(): Drink {
    const cup = this.pending?.cupId === store.state.cupId ? this.pending.drink : store.state.cup;
    const docked = this.docked();
    const tap = this.pouring?.station.id ?? (docked?.kind === 'tea' ? docked.id : undefined);
    return tap && !cup.tea ? { ...cup, tea: tap } : cup;
  }

  /** The tool landed: the cup catches up with the shop, and what it was carrying drops in. */
  private settlePending() {
    if (!this.pending) return;
    this.pending = null;
    this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    if (!this.pouring?.running) this.tweenLevel(store.state.build.fill, DURATION.base);
  }

  private tweenLevel(to: number, duration: number, linear = false) {
    this.levelTween?.stop();
    this.levelTween = this.tweens.add({ targets: this, level: to, duration, ease: linear ? 'Linear' : EASE });
  }

  // ================================================================== input
  private worldPoint(pointer: Phaser.Input.Pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private inside(x: number, y: number, left: number, top: number, w: number, h: number) {
    return x >= left && x <= left + w && y >= top && y <= top + h;
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.gesture || !this.layout || uiState.value.page !== 1 || uiState.value.pageOffset !== 1) return;
    const state = store.state;
    if (state.phase !== 'playing' || state.paused || uiState.value.opening) return;
    const { x, y } = this.worldPoint(pointer);
    if (x < 0 || y < 0 || x > this.W || y > this.H) return;
    this.pointerId = pointer.id;
    this.settlePan();
    const layout = this.layout;

    // 1. The cup itself.
    if (this.cup && state.cup.size) {
      const { x: cx, y: cy, scale } = this.cupPos;
      if (this.inside(x, y, cx, cy, layout.cupW * scale, layout.cupH * scale)) return this.grabCup(x, y);
    }

    // 2. Equipment, in the room.
    const rx = x + this.pan;
    const dairy = findDairyStation(layout.stations, rx, y);
    if (dairy) return this.grabTool(dairy, x, y);
    for (let i = layout.stations.length - 1; i >= 0; i--) {
      const station = layout.stations[i];
      if (station.kind === 'milk' || station.kind === 'foam') continue;
      const left = station.cx - station.slot / 2;
      if (station.kind === 'tea') {
        if (this.inside(rx, y, left, station.y, station.slot, Math.max(44, station.h))) return this.pressTap(station, x);
      } else if (station.kind === 'lid') {
        if (this.inside(rx, y, station.x, station.y, station.w, station.h)) {
          this.pressStation(station, true);
          this.gesture = { kind: 'lid', station, startX: x, startY: y };
          return;
        }
      } else if (station.kind === 'ice') {
        if (this.inside(rx, y, station.x, station.y, station.w, Math.max(44, station.h))) return this.grabTool(station, x, y);
      } else {
        const labelH = station.kind === 'topping' ? 0 : 18;
        if (this.inside(rx, y, left, station.y - 6, station.slot, station.h + 6 + labelH)) return this.grabTool(station, x, y);
      }
    }

    // 3. The rack of cups.
    for (const stack of layout.rack) {
      if (this.inside(rx, y, stack.x, stack.y, stack.w, stack.h)) return this.grabRack(stack, x, y);
    }

    // 4. The room: touching it sends a cup under a tap back home, and a drag pans it.
    this.standCupDown();
    this.panVelocity = 0;
    this.gesture = { kind: 'pan', startX: x, startPan: this.pan, lastX: x, lastT: this.time.now, velocity: 0 };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== this.pointerId || !this.layout) return;
    const { x, y } = this.worldPoint(pointer);
    const layout = this.layout;
    switch (gesture.kind) {
      case 'cup': {
        // The finger owns the cup now: the ease back to full size keeps only the scale, as setting a
        // shared value mid-animation did in the original. Left running, it pulled a quick drag home.
        if (!gesture.owned) {
          gesture.owned = true;
          for (const tween of this.cupTweens) tween.stop();
          this.cupTweens = [this.tweens.add({ targets: this.cupPos, scale: 1, duration: DURATION.fast, ease: EASE })];
        }
        const scale = this.cupPos.scale;
        this.cupPos.x = Math.max(-layout.cupW * 0.15, Math.min(this.W - layout.cupW * 0.85,
          gesture.grabX + (x - gesture.startX) + layout.cupW * (1 - scale) / 2));
        this.cupPos.y = Math.max(-4, Math.min(this.H - layout.cupH * 0.65,
          gesture.grabY + (y - gesture.startY) + layout.cupH * (1 - scale) / 2));
        break;
      }
      case 'carry':
        gesture.distance = Math.max(gesture.distance, Math.hypot(x - gesture.startX, y - gesture.startY));
        this.toolState.x = this.toolState.originX + (x - gesture.startX);
        this.toolState.y = this.toolState.originY + (y - gesture.startY);
        break;
      case 'rack':
        if (this.rackCup) {
          gesture.distance = Math.hypot(x - gesture.startX, y - gesture.startY);
          this.rackCup.x = gesture.originX + (x - gesture.startX);
          this.rackCup.y = gesture.originY + (y - gesture.startY);
        }
        break;
      case 'lid':
        if (Math.hypot(x - gesture.startX, y - gesture.startY) > TAP_DISTANCE) {
          this.pressStation(gesture.station, false);
          this.gesture = { kind: 'pan', startX: x, startPan: this.pan, lastX: x, lastT: this.time.now, velocity: 0 };
        }
        break;
      case 'pour':
        // A tap that was never going to pour, dragged sideways, is a swipe along the wall.
        if (!gesture.enabled && Math.abs(x - gesture.startX) > 8) {
          this.gesture = { kind: 'pan', startX: x, startPan: this.pan, lastX: x, lastT: this.time.now, velocity: 0 };
        }
        break;
      case 'pan': {
        this.setPan(gesture.startPan - (x - gesture.startX));
        const now = this.time.now;
        const dt = Math.max(1, now - gesture.lastT);
        gesture.velocity = gesture.velocity * 0.6 + ((gesture.lastX - x) / dt) * 0.4;
        gesture.lastX = x;
        gesture.lastT = now;
        break;
      }
      default:
        break;
    }
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== this.pointerId) return;
    this.gesture = null;
    this.pointerId = -1;
    switch (gesture.kind) {
      case 'cup': return this.releaseCup();
      case 'lid':
        this.pressStation(gesture.station, false);
        return this.addLid();
      case 'pour': return this.releaseTap(gesture);
      case 'carry':
        this.pressStation(gesture.station, false);
        return this.dropTool(gesture);
      case 'rack': return this.releaseRack(gesture);
      case 'pan':
        this.panVelocity = gesture.velocity;
        return;
      case 'refused':
        if (gesture.station) this.pressStation(gesture.station, false);
        return;
      default:
        return;
    }
  }

  private applyPan(value: number) {
    if (!this.layout) return;
    this.pan = Math.max(0, Math.min(this.layout.room.maxPan, value));
    this.room.setX(-this.pan);
  }

  private setPan(value: number) {
    this.applyPan(value);
    this.panTarget = this.pan;
  }

  /**
   * Where the wall has to stand for a cup docked under this tap to be wholly on screen. A tank can
   * be tapped while it is half off the edge of the room, and the cup fetched to it would hang off
   * the same edge with its meter reading a cup nobody can see.
   */
  private panForDock(station: Station) {
    const layout = this.layout!;
    const margin = layout.cupW * station.dockScale / 2 + 8;
    const near = station.cx - this.W + margin;
    const far = station.cx - margin;
    return Math.max(0, Math.min(layout.room.maxPan, Math.max(near, Math.min(far, this.pan))));
  }

  /** Slide the wall there, alongside whatever is being carried to it. */
  private tweenPan(to: number, duration: number) {
    this.panTween?.stop();
    this.panTween = null;
    this.panVelocity = 0;
    this.panTarget = to;
    if (duration <= 0 || Math.abs(to - this.pan) < 0.5) return this.applyPan(to);
    const from = { value: this.pan };
    this.panTween = this.tweens.add({
      targets: from, value: to, duration, ease: EASE,
      onUpdate: () => this.applyPan(from.value),
      onComplete: () => { this.panTween = null; },
    });
  }

  /** A wall still sliding is put where it was going at once: the next touch reads a settled room. */
  private settlePan() {
    if (!this.panTween) return;
    this.panTween.stop();
    this.panTween = null;
    this.applyPan(this.panTarget);
  }

  /**
   * How long a quick-added thing takes to cross the room: the length of the move, bounded by the
   * two durations the rest of the kitchen moves in. It times a picture and nothing else — the
   * shop's state has already changed before any of these start — so no rule, refusal or dispatch
   * is ever waiting on one of them.
   */
  private flightTime(dx: number, dy: number) {
    return Math.round(Phaser.Math.Clamp(Math.hypot(dx, dy) * 2.15, DURATION.fast, DURATION.slow));
  }

  /** The game is put down mid-gesture: empty the hands, and let go of the tap without pouring. */
  private abortAll() {
    if (this.pouring?.running) {
      this.tweenLevel(store.state.build.fill, DURATION.fast);
      this.stopPour(false);
    }
    this.cancelGesture();
    // A tool still carrying itself to the cup is holding a dispatch: it is not a gesture, so
    // cancelGesture does not reach it.
    this.cancelTool();
    this.settlePending();
    this.settlePart();
    this.dropRackCup();
    this.settlePan();
    this.standCupDown();
  }

  private cancelGesture() {
    const gesture = this.gesture;
    this.gesture = null;
    this.pointerId = -1;
    if (!gesture) return;
    if (gesture.kind === 'carry') this.cancelTool();
    if (gesture.kind === 'lid') this.pressStation(gesture.station, false);
    if (gesture.kind === 'rack') this.dropRackCup();
    if (gesture.kind === 'pour' && this.pouring?.running) {
      this.tweenLevel(store.state.build.fill, DURATION.fast);
      this.stopPour(false);
    }
  }

  // ------------------------------------------------------------------ the cup
  private grabCup(x: number, y: number) {
    const layout = this.layout!;
    playSound('cupPickup');
    const wasDocked = Boolean(this.dock);
    this.dock = null;
    if (wasDocked) this.refreshEquipment();
    // Keep the cup's centre under the finger while it grows back to its carrying size.
    const scale = this.cupPos.scale;
    const grabX = this.cupPos.x - layout.cupW * (1 - scale) / 2;
    const grabY = this.cupPos.y - layout.cupH * (1 - scale) / 2;
    this.tweenCup({ x: grabX, y: grabY, scale: 1 }, DURATION.fast);
    this.gesture = { kind: 'cup', startX: x, startY: y, grabX, grabY, owned: false };
  }

  private releaseCup() {
    const layout = this.layout!;
    const scale = this.cupPos.scale;
    const found = findStation(layout.stations, this.cupPos.x, this.cupPos.y, layout.cupW * scale, layout.cupH * scale, this.pan, this.W);
    if (found?.kind === 'lid' && !store.state.build.lidded) return this.addLid();
    if (found && !store.state.build.lidded) {
      playSound('cupDown', DURATION.base);
      this.dockCup(found, DURATION.base);
    } else {
      playSound('cupDown', DURATION.slow);
      this.standCupDown();
      this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    }
  }

  /**
   * A tap takes a lid off the stack and seals the drink. The shop has the lid at once, as it has
   * every other thing the room does; the lid itself then flies over while the cup stands itself
   * back down to meet it, so the two settle together wherever the cup happened to be — under a
   * tap, or dragged up to the stack. It used to be put on with no picture of it at all, and the
   * cup snapped home from under the tap in the same frame.
   */
  private addLid() {
    const { cup, build } = store.state;
    const refusal = this.awayMessage() ?? (!cup.size ? 'Lấy ly và pha trà trước khi đậy nắp'
      : !cup.tea ? 'Rót trà vào ly trước khi đậy nắp'
      : build.lidded ? 'Ly đã có nắp — thêm ống hút rồi phục vụ' : null);
    if (refusal) {
      playSound('nudge'); nudge(refusal);
      this.standCupDown();
      return;
    }
    this.cancelTool();
    if (this.pouring) this.stopPour(false);
    const stack = this.layout?.stations.find((station) => station.kind === 'lid');
    const flight = stack ? this.fitPart('lid', stack.cx - this.pan, stack.y + stack.h / 2) : 0;
    dispatch({ type: 'LID_CUP' });
    if (!store.state.build.lidded) return this.settlePart();
    this.standCupDown();
    playSound('cupDown', flight);
  }

  // ------------------------------------------------------------------ the lid and the straw
  /**
   * Fly a finishing part onto the cup, and **hold the cup's own picture of it back until it
   * lands**. The lid and the straw are the only two things in the room that *become* part of the
   * cup, so neither can appear the instant it is dispatched, the way a scoop of pearls does: a
   * drink already wearing its straw while the straw is still crossing the room is what the carried
   * one landing second looked like. The shop still has them from the dispatch — what waits is the
   * picture, which is the fresh cup's fade and the settling scoops again.
   *
   * It is aimed at where the cup is *this frame*, so a cup still gliding down from a tap is met
   * rather than overtaken, and what is in the air is the same picture the cup draws for itself
   * (`finishPartTexture`), so the swap at the end of the flight is not seen. Hands back how long
   * it will take, which is what delays the contact sound.
   */
  private fitPart(part: 'lid' | 'straw', atX: number, atY: number): number {
    const layout = this.layout;
    if (!layout || !this.cup) return 0;
    this.settlePart();
    const art = finishPartTexture(this, part, layout.cupW, layout.cupH, true);
    const fromX = atX - art.width / 2;
    const fromY = atY - art.height / 2;
    const fit = {
      part,
      view: this.add.image(fromX, fromY, art.key).setOrigin(0)
        .setDisplaySize(art.width, art.height).setDepth(DEPTH.tool),
      box: art.box, fromX, fromY, t: 0, sunk: 0,
    };
    this.fitting = fit;
    this.showFinish();
    const seat = this.finishSeat(art.box);
    const travel = this.flightTime(seat.x - fromX, seat.y - fromY);
    const sink = part === 'straw' ? INSERT_MS : 0;
    this.tweens.add({
      targets: fit, t: 1, duration: travel, ease: EASE,
      onComplete: () => {
        if (this.fitting !== fit) return;
        if (!sink) return this.settlePart();
        this.tweens.add({ targets: fit, sunk: 1, duration: sink, ease: EASE,
          onComplete: () => { if (this.fitting === fit) this.settlePart(); } });
      },
    });
    return travel + sink;
  }

  /**
   * The part is the cup's now: the cup draws it from this frame on and the one in the air is let
   * go of. Called when the flight lands, and whenever it is cut short — the cup binned, carried
   * out to the counter, the game put down — because the picture may lag the shop but must never
   * be left behind it.
   */
  private settlePart() {
    const fit = this.fitting;
    if (!fit) return;
    this.fitting = null;
    this.tweens.killTweensOf(fit);
    fit.view.destroy();
    this.showFinish();
  }

  /** What the cup wears: the shop's lid and straw, less whichever of them is still on its way. */
  private showFinish() {
    const { build } = store.state;
    const flying = this.fitting?.part;
    this.cup?.setFinish(build.lidded && flying !== 'lid', build.straw && flying !== 'straw');
  }

  /** Where the cup wears a part, exactly as the cup draws it: its top-left and its drawn size. */
  private finishSeat(target: FinishBox) {
    const layout = this.layout!;
    const { x, y, scale } = this.cupPos;
    const unitX = layout.cupW / CUP_ART.w * scale;
    const unitY = layout.cupH / CUP_ART.h * scale;
    return {
      x: x + target.x * unitX,
      y: y + target.y * unitY,
      width: target.width * unitX,
      height: target.height * unitY,
    };
  }

  /** Stand the cup under a tap and leave it there, ready for the tap to be held. */
  private dockCup(station: Station, duration: number) {
    const layout = this.layout!;
    const scale = station.dockScale;
    this.dock = station.key;
    this.dockCupId = store.state.cupId;
    this.tweenCup({
      scale,
      // Against where the wall is *going*, not where it is: the two slide there together.
      x: station.cx - this.panTarget - layout.cupW * scale / 2,
      y: station.dockY - layout.cupH * scale,
    }, duration);
    this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    this.refreshEquipment();
  }

  // ------------------------------------------------------------------ the taps
  private pressTap(station: Station, x: number) {
    const { cup, build } = store.state;
    const locked = build.lidded || (cup.tea !== null && cup.tea !== station.id);
    const enabled = this.docked()?.key === station.key && !locked;
    const startedAt = performance.now();
    this.gesture = { kind: 'pour', station, enabled, startedAt, startX: x };
    if (!enabled) return;
    this.pouring = { station, running: true, startedAt, from: build.fill };
    setPourSound(true, this.level);
    // The level is read off the clock every frame instead of tweened across the room it has: the
    // pour stands still at the brim, which no single tween does, and this way the number the cup
    // is drawn at and the one the release hands to `POUR` come out of the same function.
    this.levelTween?.stop();
    this.cup?.setPouring(true);
    this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    const layout = this.layout!;
    this.stream?.destroy();
    this.stream = new Stream(this, station.cx - this.pan, station.y + station.spout, station.color, DEPTH.streamFront, DEPTH.streamBack);
    this.stream.setRunning(true);
    if (!this.spill) {
      this.spill = new Spill(this, layout.cupW, layout.cupH, station.color);
      this.cup?.container.add(this.spill.container);
    }
  }

  private releaseTap(gesture: Extract<Gesture, { kind: 'pour' }>) {
    const { station } = gesture;
    if (!gesture.enabled) {
      const { cup } = store.state;
      if (!cup.size) {
        playSound('nudge');
        nudge('Chạm ly S / M / L trên kệ để lấy ly trước');
        return;
      }
      const away = this.awayMessage();
      if (away) {
        playSound('nudge'); nudge(away);
        return;
      }
      if (store.state.build.lidded) {
        playSound('nudge'); nudge('Ly đã đậy nắp — thêm ống hút rồi phục vụ');
        return;
      }
      if (cup.tea !== null && cup.tea !== station.id) {
        playSound('nudge');
        nudge('Ly đã có trà khác — đổ bỏ để pha lại');
        return;
      }
      // Touching a tank fetches the cup under its spout, which is the drag the player would have
      // made. It does not pour: how long the tap is held is the pour, and that stays in their hand.
      // The cup counts as docked from this instant; the sliding is only how it looks getting there,
      // so the tap can be held for the pour before it has arrived.
      const layout = this.layout!;
      const scale = station.dockScale;
      const to = this.panForDock(station);
      const duration = this.flightTime(
        station.cx - to - layout.cupW * scale / 2 - this.cupPos.x,
        station.dockY - layout.cupH * scale - this.cupPos.y);
      this.tweenPan(to, duration);
      playSound('cupPickup');
      playSound('cupDown', duration);
      this.dockCup(station, duration);
      // No word about it: docking is what sets the hint line to how the tap is held.
      return;
    }
    if (!this.pouring?.running) return;
    const amount = pouredAmount(this.pouring.from, performance.now() - gesture.startedAt);
    this.stopPour(true);
    this.tweenLevel(Math.min(1, store.state.build.fill + amount), DURATION.fast);
    dispatch({ type: 'POUR', category: 'tea', optionId: station.id, amount });
  }

  /** The tap closes. The stream runs dry and its last drop falls on its own. */
  private stopPour(keepStream: boolean) {
    if (!this.pouring) return;
    this.pouring = { ...this.pouring, running: false };
    setPourSound(false);
    this.cup?.setPouring(false);
    this.stream?.setRunning(false);
    if (!keepStream) {
      this.stream?.destroy();
      this.stream = null;
    }
    this.pouring = null;
  }

  // ------------------------------------------------------------------ carrying things to the cup
  /** The cup has been carried out to the counter: whatever the room reaches for, it is not here. */
  private awayMessage(): string | null {
    return store.state.build.atCounter ? 'Ly đang chờ ở quầy — bấm máy tính tiền để trao cho khách' : null;
  }

  private busyMessage(): string | null {
    const { cup } = store.state;
    const docked = this.docked();
    const away = this.awayMessage();
    if (away) return away;
    if (!cup.size) return 'Chạm ly S / M / L trên kệ để lấy ly trước';
    if (docked) return `Ly đang ở dưới vòi ${docked.name} — kéo ly ra trước`;
    return null;
  }

  private pressStation(station: Station, down: boolean) {
    const highlight = this.stationViews.get(station.key);
    if (!highlight) return;
    this.tweens.killTweensOf(highlight);
    this.tweens.add({ targets: highlight, alpha: down ? 0.16 : this.docked()?.key === station.key ? 0.08 : 0,
      duration: down ? 80 : 180, ease: EASE });
  }

  private grabTool(station: Station, x: number, y: number) {
    const busy = this.busyMessage() ?? this.refuseTool(station);
    this.pressStation(station, true);
    if (busy) {
      // It still takes the touch, so the room does not pan out from under it.
      this.gesture = { kind: 'refused', station };
      playSound('nudge');
      nudge(busy);
      return;
    }
    const layout = this.layout!;
    const size = Math.round(layout.cupW * 1.2);
    this.finishingTool = station.kind === 'straw';
    this.toolCupId = store.state.cupId;
    for (const tween of this.toolTweens) tween.stop();
    this.tool?.destroy();
    const inner = this.add.container(-size / 2, -size / 2, addTool(this, station, size, { w: layout.cupW, h: layout.cupH }));
    this.tool = this.add.container(0, 0, [inner]).setDepth(DEPTH.tool);
    this.toolState = {
      // The room scrolls, while carried tools follow the finger in screen coordinates.
      originX: station.cx - this.pan - size / 2,
      originY: station.y + (station.kind === 'milk' || station.kind === 'foam' ? 0 : station.h * 0.1),
      x: 0, y: 0, tip: 0, show: 1, size,
    };
    this.toolState.x = this.toolState.originX;
    this.toolState.y = this.toolState.originY;
    playSound('pickup');
    if (station.kind === 'topping') nudge(getIngredient('toppings', station.id)?.name ?? station.name);
    else if (station.kind === 'ice') nudge('1 muỗng: ít đá · 2 muỗng: đá thường');
    this.gesture = { kind: 'carry', station, startX: x, startY: y, distance: 0, target: this.tool };
  }

  /**
   * The tool is let go of. Over the cup it tips in, and dropped anywhere else it goes back on its
   * shelf. A touch that never moved is the quick way to the same thing: it goes into the cup where
   * the player tapped, with nothing crossing the room. Either way it is the same refusal and the
   * same pour — only the carrying differs.
   */
  private dropTool(gesture: Extract<Gesture, { kind: 'carry' }>) {
    const { station } = gesture;
    const layout = this.layout!;
    const s = this.toolState.size;
    if (!store.state.cup.size) {
      this.toolState.show = 0;
      nudge('Lấy ly từ kệ trước khi thêm nguyên liệu');
      return;
    }
    // Is the business end of the tool over the cup — where it is, or where it is heading?
    const px = this.toolState.x + s / 2;
    const py = this.toolState.y + s * 0.7;
    const cupW = layout.cupW;
    const cupH = layout.cupH;
    const overBox = (left: number, top: number) =>
      px > left - cupW * 0.45 && px < left + cupW * 1.45 && py > top - cupH * 0.35 && py < top + cupH * 1.1;
    const tapped = gesture.distance < TAP_DISTANCE;
    if (!tapped && !overBox(this.cupPos.x, this.cupPos.y) && !overBox(layout.homeX, layout.homeY)) {
      return this.putToolBack();
    }
    const refusal = this.refuseTool(station);
    if (refusal) return this.putToolBack(refusal);
    return this.tipToolIn(station, tapped);
  }

  /** What stops this tool going into the cup, said the way the cup would say it. */
  private refuseTool(station: Station): string | null {
    const { cup, build, config } = store.state;
    const away = this.awayMessage();
    if (away) return away;
    if (station.kind === 'lid') return 'Chạm chồng nắp để đậy nắp ly';
    if (station.kind === 'straw') return !build.lidded ? 'Đậy nắp trước khi thêm ống hút' : build.straw ? 'Ly đã có ống hút' : null;
    if (build.lidded) return 'Ly đã đậy nắp — đổ bỏ nếu muốn pha lại';
    switch (station.kind) {
      case 'topping':
        if (cup.toppings.includes(station.id)) return `Ly đã có ${station.name}`;
        if (cup.toppings.length >= config.maxToppings) {
          return config.maxToppings === 1 ? 'Ly chỉ được 1 topping' : `Tối đa ${config.maxToppings} topping`;
        }
        return null;
      case 'foam':
        return cup.foam ? 'Ly đã có kem' : null;
      case 'milk':
        if (cup.milk && cup.milk !== station.id) return 'Ly đã có loại sữa khác';
        return build.fill >= 1 ? 'Ly đầy rồi — chừa chỗ cho sữa' : null;
      case 'ice':
        return build.iceScoops >= MAX_ICE_SCOOPS ? 'Đá đã đầy ly' : null;
      default:
        return build.sugarPumps >= SUGAR_STEPS.length ? 'Ngọt tối đa rồi' : null;
    }
  }

  /**
   * Tip it in over the cup, then it's gone. **The cup has it the moment this runs** — the carrying
   * afterwards is only the picture of it, which is what lets the quick way be tapped again before
   * the last one has landed.
   */
  private tipToolIn(station: Station, quick = false) {
    if (this.toolCupId !== store.state.cupId) return this.putToolBack();
    const refusal = this.busyMessage() ?? this.refuseTool(station);
    if (refusal) return this.putToolBack(refusal);
    if (station.kind === 'straw') {
      // The straw does not tip in, it goes in: the one in hand is handed over to the flight that
      // seats it in the lid, which is the same picture in the same place (see `fitPart`), and
      // which holds the cup's own straw back until it lands.
      const { x, y, size } = this.toolState;
      this.cancelTool();
      const flight = this.fitPart('straw', x + size / 2, y + size / 2);
      dispatch({ type: 'ADD_STRAW' });
      // Heard as it meets the lid, not as it sets off.
      playSound('pickup', Math.max(0, flight - INSERT_MS));
      return;
    }
    // Tipped in over the cup it drops in as it tips; tapped from across the room it has the room
    // to cross first, and the cup is drawn without it until it gets there.
    this.settlePending();
    if (quick) this.pending = { drink: store.state.cup, cupId: store.state.cupId };
    switch (station.kind) {
      case 'topping':
        playSound('scoop');
        dispatch({ type: 'SCOOP', category: 'toppings', optionId: station.id });
        break;
      case 'foam':
        playSound('foam');
        dispatch({ type: 'SCOOP', category: 'foam', optionId: station.id });
        break;
      case 'milk':
        playSound('milk');
        dispatch({ type: 'POUR', category: 'milk', optionId: station.id, amount: MILK_SPLASH });
        break;
      case 'ice':
        playSound('ice');
        dispatch({ type: 'ICE_SCOOP' });
        break;
      default:
        playSound('sugar');
        dispatch({ type: 'SUGAR_PUMP' });
        break;
    }
    for (const tween of this.toolTweens) tween.stop();
    if (quick) return this.sendToolToCup();
    this.toolTweens = [
      this.tweens.add({ targets: this.toolState, tip: 1, duration: 430, ease: EASE }),
      this.tweens.add({ targets: this.toolState, show: 0, delay: 410, duration: 1 }),
    ];
  }

  /**
   * The quick way's flight, and it is **only** a flight: whatever was in the tool is already in the
   * cup, so this hands the sprite its own tweens and forgets about it. Nothing in the room waits
   * for it — the next station can be tapped while it is still in the air, and that tap builds its
   * own tool rather than stealing this one out of the sky, which is what used to drop an
   * ingredient when two were tapped quickly.
   */
  private sendToolToCup() {
    const flier = this.tool;
    const layout = this.layout;
    // With nothing to fly, whatever it was bringing over is simply in the cup.
    if (!flier || !layout) return this.settlePending();
    this.tool = null;
    this.toolTweens = [];
    const s = this.toolState.size;
    const to = { x: this.cupPos.x + layout.cupW / 2, y: this.cupPos.y + layout.cupH * 0.12 + s * 0.1 };
    const duration = this.flightTime(to.x - flier.x, to.y - flier.y);
    const landed = () => {
      // The in-flight serving tool is temporary; the stocked station stays in the painting.
      flier.destroy();
    };
    this.tweens.add({
      targets: flier, x: to.x, y: to.y, duration, ease: EASE,
      // It is over the cup: what it was carrying drops in as it tips, which is what the cup has
      // been drawn without all the way across the room.
      onComplete: () => {
        this.settlePending();
        this.tweens.add({
          targets: flier, alpha: 0, duration: 430, ease: EASE,
          rotation: Phaser.Math.DegToRad(118),
          onComplete: landed,
        });
      },
    });
  }

  /** Back on its shelf, with a word about why if there is one. */
  private putToolBack(message?: string) {
    if (message) {
      playSound('nudge');
      nudge(message);
    }
    for (const tween of this.toolTweens) tween.stop();
    this.toolTweens = [
      this.tweens.add({ targets: this.toolState, x: this.toolState.originX, y: this.toolState.originY, duration: DURATION.base, ease: EASE }),
      // It fades over the last of the way back, rather than winking out once it is there.
      this.tweens.add({ targets: this.toolState, show: 0, delay: DURATION.base * 0.55, duration: DURATION.base * 0.45, ease: EASE }),
    ];
  }

  /** Put it back on its shelf without tipping it in, for a gesture that ended without a finger. */
  private cancelTool() {
    for (const tween of this.toolTweens) tween.stop();
    this.toolState.show = 0;
    this.toolState.tip = 0;
  }

  // ------------------------------------------------------------------ the rack of cups
  private grabRack(stack: KitchenLayout['rack'][number], x: number, y: number) {
    if (store.state.cup.size) {
      this.gesture = { kind: 'refused' };
      playSound('nudge');
      nudge(this.awayMessage() ?? 'Đổ bỏ ly đang pha trước khi lấy ly mới');
      return;
    }
    const size = cupSizeFor(this.W, this.H, stack.size);
    this.dropRackCup();
    const view = new CupView(this, size.width, size.height, { ...EMPTY_DRINK, size: stack.size });
    view.container.setDepth(DEPTH.rackCup);
    const originX = x - size.width / 2;
    const originY = y - size.height / 2;
    this.rackCup = { view, x: originX, y: originY, alpha: 1 };
    playSound('cupPickup');
    this.gesture = { kind: 'rack', size: stack.size, startX: x, startY: y, originX, originY, distance: 0 };
  }

  private dropRackCup() {
    if (!this.rackCup) return;
    this.tweens.killTweensOf(this.rackCup);
    this.rackCup.view.destroy();
    this.rackCup = null;
  }

  /**
   * The cup is the shop's **before** it has walked anywhere: the rack's sprite is handed over at
   * once (same size, same place, so the swap is not seen — that is what {@link flewIn} is for) and
   * what travels to the mat is the real cup. So the walk holds nothing up; it can be grabbed,
   * dragged, docked under a tank or scooped into while it is still on its way, and whatever is
   * done to it simply takes over from the tween.
   */
  private cupToMat(size: CupSize) {
    const rack = this.rackCup;
    const layout = this.layout;
    if (!rack || !layout) return;
    if (store.state.cup.size) {
      this.dropRackCup();
      playSound('nudge');
      nudge(this.awayMessage() ?? 'Đổ bỏ ly đang pha trước khi lấy ly mới');
      return;
    }
    const from = { x: rack.x, y: rack.y };
    this.flewIn = true;
    dispatch({ type: 'PICK_CUP', size });
    this.flewIn = false;
    this.dropRackCup();
    // `PICK_CUP` has already laid the room out again and stood the cup on its mat; walk it in from
    // where the rack one was.
    const home = { x: this.layout!.homeX, y: this.layout!.homeY };
    const duration = this.flightTime(home.x - from.x, home.y - from.y);
    Object.assign(this.cupPos, from);
    playSound('cupDown', duration);
    this.tweenCup({ ...home, scale: 1 }, duration);
  }

  private releaseRack(gesture: Extract<Gesture, { kind: 'rack' }>) {
    const rack = this.rackCup;
    if (!rack) return;
    // A tap is the quick way: the cup walks itself over, and is the shop's from the first frame.
    if (gesture.distance < TAP_DISTANCE) return this.cupToMat(gesture.size);
    // Anywhere on the mat counts: the cup is tested by the point it would stand on.
    const holder = this.layout!.holder;
    const cup = cupSizeFor(this.W, this.H, gesture.size);
    const footX = rack.x + cup.width / 2;
    const footY = rack.y + cup.height * CUP_FOOT / CUP_ART.h;
    const padX = cup.width / 2;
    const padY = 24 + cup.height * 0.45;
    const overMat = footX >= holder.left - padX && footX <= holder.left + holder.width + padX
      && footY >= holder.top - padY && footY <= holder.top + holder.height + padY;
    if (overMat && !store.state.cup.size) return this.cupToMat(gesture.size);
    this.tweens.add({ targets: rack, x: gesture.originX, y: gesture.originY, duration: DURATION.base, ease: EASE });
    this.tweens.add({ targets: rack, alpha: 0, delay: 300, duration: 135, onComplete: () => this.dropRackCup() });
    nudge('Thả ly lên thảm — hoặc chỉ cần chạm vào ly trên kệ');
  }

  /** Tell the HTML where the cup is on the page, for the effects that start from it. */
  private reportCup() {
    // Out at the counter the cup is the counter's to place, and `HandoffCup` has said where it
    // stands; clearing that here every frame would take the coins of the sale back to the kitchen.
    if (store.state.build.atCounter) return;
    const layout = this.layout;
    // Read from where the HTML put the canvas, never from the DOM: a layout read every frame is a
    // forced layout every frame.
    const host = gameArea();
    if (!layout || !this.cup || !store.state.cup.size) {
      if (uiState.value.cupScreen) uiState.set({ cupScreen: null });
      return;
    }
    const { pager, pageOffset, kitchenRect } = uiState.value;
    const width = layout.cupW * this.cupPos.scale;
    const x = host.x + (1 - pageOffset) * pager.width + kitchenRect.x + this.cupPos.x + width / 2;
    const y = host.y + kitchenRect.y + this.cupPos.y + layout.cupH * this.cupPos.scale / 2;
    const was = uiState.value.cupScreen;
    if (!was || Math.abs(was.x - x) > 0.5 || Math.abs(was.y - y) > 0.5 || Math.abs(was.width - width) > 0.5) {
      uiState.set({ cupScreen: { x, y, width } });
    }
  }

  // ================================================================== every frame
  update(time: number, delta: number) {
    if (!this.layout) return;
    const layout = this.layout;

    const state = store.state;

    // The room coasts to a stop after a flick.
    if (!this.gesture && Math.abs(this.panVelocity) > 0.01) {
      this.setPan(this.pan + this.panVelocity * delta);
      this.panVelocity *= Math.pow(0.992, delta);
      if (this.pan <= 0 || this.pan >= layout.room.maxPan) this.panVelocity = 0;
    }

    // The tap, while it is held: how full the cup is now is how long it has been open.
    if (this.pouring?.running) {
      this.level = this.pouring.from + pouredAmount(this.pouring.from, performance.now() - this.pouring.startedAt);
    }

    // The cup.
    if (this.cup) {
      const { x, y, scale } = this.cupPos;
      this.cup.container.setPosition(x, y - (1 - this.appear) * 10).setScale(scale).setAlpha(this.appear);
      this.cup.level = this.level;
      this.cup.update(time, delta, state.phase === 'playing' && !state.paused
        && !uiState.value.opening && uiState.value.pageOffset > 0.1);
      this.spill?.update(this.level);
      const docked = Boolean(this.dock);
      const onMat = Math.abs(x - layout.homeX) < 0.5 && Math.abs(y - layout.homeY) < 0.5
        && Math.abs(scale - 1) < 0.01 && this.gesture?.kind !== 'cup';
      this.cupShadow.setVisible(docked || onMat).setAlpha(this.appear);
      this.holderFront.setVisible(onMat).setAlpha(this.appear);
      if (docked || onMat) {
        const w = layout.cupW * scale;
        const footY = y + layout.cupH * scale * CUP_FOOT / CUP_ART.h;
        const sw = onMat ? w * (CUP_BASE.rx * 2 + 5) / CUP_ART.w : w * 0.76;
        const sh = onMat ? layout.cupH * scale * (CUP_BASE.ry * 2 + 6) / CUP_ART.h : w * 0.18;
        this.cupShadow.setTexture(onMat ? cupSeatShadowTexture(this) : cupShadowTexture(this))
          .setPosition(x + w / 2 - sw / 2, footY - sh / 2 + (onMat ? 0.5 : 0))
          .setDisplaySize(sw, sh);
      }
    } else {
      this.cupShadow.setVisible(false);
      this.holderFront.setVisible(false);
    }

    // A lid or a straw on its way onto the cup, aimed at where the cup is this frame. The straw
    // then sinks through the lid, and whatever has gone below the opening is inside the cup now,
    // so it is cropped away there: what is left when it stops is exactly what the cup draws.
    const fit = this.fitting;
    if (fit && this.cup) {
      const seat = this.finishSeat(fit.box);
      const unit = layout.cupH / CUP_ART.h * this.cupPos.scale;
      const sink = fit.part === 'straw' ? STRAW_INSERT * unit : 0;
      const x = fit.fromX + (seat.x - fit.fromX) * fit.t;
      const y = fit.fromY + (seat.y - sink - fit.fromY) * fit.t + sink * fit.sunk;
      fit.view.setPosition(x, y).setDisplaySize(seat.width, seat.height);
      if (fit.sunk > 0) {
        const hole = this.cupPos.y + CUP_LID_HOLE_Y * unit;
        const shown = Phaser.Math.Clamp((hole - y) / seat.height, 0, 1);
        fit.view.setCrop(0, 0, fit.view.frame.width, fit.view.frame.height * shown);
      }
    }
    this.reportCup();

    // The stream, and the meter over the kitchen.
    if (this.stream) {
      const alive = this.stream.update(delta, { x: this.cupPos.x, y: this.cupPos.y, w: layout.cupW, h: layout.cupH, scale: this.cupPos.scale }, this.level);
      if (!alive) {
        this.stream.destroy();
        this.stream = null;
      }
    }
    const docked = this.docked();
    if (docked?.kind === 'tea') {
      const meter = uiState.value.meter;
      const running = Boolean(this.pouring?.running);
      if (!meter || meter.level !== this.level || meter.color !== docked.color || meter.running !== running) {
        uiState.set({ meter: { level: this.level, color: docked.color, running } });
      }
    } else if (uiState.value.meter) uiState.set({ meter: null });

    // The tool in hand.
    if (this.tool) {
      const { x, y, tip, show, size } = this.toolState;
      this.tool.setPosition(x + size / 2, y + size / 2 + tip * layout.cupH * 0.12)
        .setRotation(this.finishingTool ? 0 : Phaser.Math.DegToRad(-6 + (124 + 6) * tip))
        .setAlpha(show * (1 - tip * 0.85))
        .setVisible(show > 0);
      if (show <= 0) {
        // Whatever ended the carry — tipped in, put back, or the game put down — it is off the
        // screen now, so the counter has its carton or canister back.
        if (!this.gesture) {
          this.tool.destroy();
          this.tool = null;
        }
      }
    }

    // The cup off the rack.
    if (this.rackCup) {
      const { view, x, y, alpha } = this.rackCup;
      view.container.setPosition(x, y).setAlpha(alpha);
      view.update(time, delta);
    }
  }
}

