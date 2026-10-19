import Phaser from 'phaser';

import {
  CupSize, Drink, EMPTY_DRINK, getIngredient, MAX_ICE_SCOOPS, MAX_POUR, MILK_SPLASH, POUR_RATE, SUGAR_STEPS, Topping,
} from '../game/ingredients';
import { GameState } from '../game/reducer';
import { CUP_HOLDER, ROOM_BG, TEA_DISPENSER_ART, TEA_DISPENSERS } from '../art/kitchenArt';
import { TOPPING_PANS, TOPPING_TAG } from '../art/toppingArt';
import { CUP_ART, CUP_FOOT } from '../art/cupGeometry';
import { gameArea } from '../game/host';
import { bakeCanvas, canvasFont, placeCamera, tex } from '../game/view';
import { playSound, setPourFill, setPouring as setPourSound } from '../sound';
import { dispatch, store } from '../store';
import { nudge, uiState } from '../ui-state';
import { CupView } from '../kitchen/CupView';
import {
  addTool, bottleColor, bottleTexture, card, drawPan, drawShadow, fitText, foamTexture, measure, panExtent, plaque, roundRect, SHOP, sourceImage,
} from '../kitchen/equipment';
import { Atlas } from '../kitchen/atlas';
import { cupSizeFor, findStation, hintFor, KitchenLayout, layoutKitchen, Station } from '../kitchen/layout';
import { DURATION, EASE } from '../kitchen/motion';
import { cupShadowTexture, Spill, Stream } from '../kitchen/pourEffects';

/**
 * The kitchen you work in — `KitchenStation.tsx`, as a Phaser scene. Page 1 of the pager.
 *
 * Two gestures, both held in the hand:
 * - **drag the cup** up under a tea dispenser and **hold the tap** — how long you hold is how much
 *   runs in, with the meter over the kitchen showing the live amount;
 * - **drag a topping, a scoop of ice, the syrup bottle or a spoon of foam straight onto the cup**.
 *
 * Plus the rack of cups, tapped (or dragged onto the mat) to start one, and the painted room itself,
 * swiped to pan along the wall. Every rule of what may go in is the reducer's; this scene checks the
 * same things first only so it can put a tool back and say why.
 *
 * Depth, back to front: the room (panned), the mat, the docked cup's shadow, the stream's lower
 * half, the cup, the tool in hand, the cup off the rack, the stream's upper half.
 */
const DEPTH = { room: 0, holder: 10, shadow: 15, streamBack: 18, cup: 20, tool: 30, rackCup: 32, streamFront: 35 };

type Gesture =
  | { kind: 'cup'; startX: number; startY: number; grabX: number; grabY: number; owned: boolean }
  | { kind: 'pour'; station: Station; enabled: boolean; startedAt: number; startX: number }
  | { kind: 'carry'; station: Station; startX: number; startY: number; target: Phaser.GameObjects.Container }
  | { kind: 'refused'; station?: Station }
  | { kind: 'rack'; size: CupSize; startX: number; startY: number; originX: number; originY: number; distance: number }
  | { kind: 'pan'; startX: number; startPan: number; lastX: number; lastT: number; velocity: number };

interface Placed { x: number; y: number; scale: number }

export class KitchenScene extends Phaser.Scene {
  private layout: KitchenLayout | null = null;
  private layoutKey = '';
  private W = 0;
  private H = 0;

  private room!: Phaser.GameObjects.Container;
  private holder!: Phaser.GameObjects.Image;
  private matLabel: Phaser.GameObjects.Image | null = null;
  private stationViews = new Map<string, { container: Phaser.GameObjects.Container; art: Phaser.GameObjects.Container; locked?: boolean }>();
  private teaLabels = new Map<string, Phaser.GameObjects.Image>();
  private syrupLabel: { container: Phaser.GameObjects.Container; art: Phaser.GameObjects.Container; pumps: number } | null = null;

  private pan = 0;
  private panVelocity = 0;

  private cup: CupView | null = null;
  private cupKey = '';
  private cupPos: Placed = { x: 0, y: 0, scale: 1 };
  private cupTweens: Phaser.Tweens.Tween[] = [];
  private appear = 1;
  private cupShadow!: Phaser.GameObjects.Image;
  private dock: string | null = null;
  private dockCupId = -1;

  private level = 0;
  private levelTween: Phaser.Tweens.Tween | null = null;
  private pouring: { station: Station; running: boolean } | null = null;
  private stream: Stream | null = null;
  private spill: Spill | null = null;

  private tool: Phaser.GameObjects.Container | null = null;
  private toolState = { x: 0, y: 0, tip: 0, show: 0, originX: 0, originY: 0, size: 0 };
  private toolTweens: Phaser.Tweens.Tween[] = [];
  private rackCup: { view: CupView; x: number; y: number; alpha: number } | null = null;

  private gesture: Gesture | null = null;
  private pointerId = -1;

  constructor() {
    super('kitchen');
  }

  create() {
    this.room = this.add.container(0, 0).setDepth(DEPTH.room);
    this.holder = this.add.image(0, 0, tex(CUP_HOLDER)).setOrigin(0).setDepth(DEPTH.holder);
    this.cupShadow = this.add.image(0, 0, cupShadowTexture(this)).setOrigin(0).setDepth(DEPTH.shadow).setVisible(false);
    this.level = store.state.build.fill;

    // Bottles are vector art, rasterised once; the room is rebuilt when they are ready.
    void Promise.all(['#C88D54', '#EBD4A7', '#FFF2D3'].map((color) => bottleTexture(this, color)))
      .then(() => this.relayout(true))
      .catch((error: unknown) => console.warn('[kitchen] bottles could not be drawn', error));

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
    this.layoutKey = key;
    this.W = W;
    this.H = H;
    this.cancelGesture();
    this.layout = layoutKitchen(state.config, W, H, state.cup.size ?? 'M');
    this.pan = Math.min(this.pan, this.layout.room.maxPan);
    this.buildRoom();
    this.buildCup(true);
    this.refreshEquipment();
  }

  /**
   * The room: the painting, and everything standing in it drawn into one atlas (see `atlas.ts`), so
   * the whole wall is two textures however much is on it. What changes while playing — a station
   * dimmed, pressed or ringed, the syrup's count — is a different frame of that atlas or an alpha,
   * never a redraw.
   */
  private buildRoom() {
    const layout = this.layout!;
    this.room.removeAll(true);
    this.stationViews.clear();
    this.teaLabels.clear();
    this.syrupLabel = null;
    const { room } = layout;
    this.room.add(this.add.image(0, room.top, tex(ROOM_BG)).setOrigin(0).setDisplaySize(room.width, room.height));

    const atlas = new Atlas();
    const pans = sourceImage(this, TOPPING_PANS);
    const tanks = sourceImage(this, TEA_DISPENSERS);
    const sized = (w: number, h: number) => `${w.toFixed(1)}x${h.toFixed(1)}`;
    type Piece = { frame: string; x: number; y: number; w: number; h: number; dims?: boolean; name?: string; visible?: boolean };
    const pieces: { station?: Station; items: Piece[] }[] = [];

    for (const bin of layout.emptyBins) {
      const extent = panExtent(bin.w, bin.h, bin.panShape);
      const frame = atlas.add(`pan:empty:${sized(bin.w, bin.h)}:${bin.panShape ? Object.values(bin.panShape).map((v) => v.toFixed(3)).join(',') : ''}`,
        extent.width, bin.h, (c) => drawPan(c, pans, 'empty', bin.w, bin.h, bin.panShape));
      pieces.push({ items: [{ frame, x: bin.x + extent.left, y: bin.y, w: extent.width, h: bin.h }] });
    }

    for (const station of layout.stations) {
      const items: Piece[] = [];
      const { x, y, w, h } = station;
      if (station.kind === 'tea') {
        const cell = TEA_DISPENSER_ART.cells[station.id];
        const label = TEA_DISPENSER_ART.label;
        const labelW = w * label.width;
        const lh = h * label.height;
        const lx = w * label.left;
        const ly = h * label.top;
        const nameSize = Math.min(Math.max(7, Math.min(11, w * 0.08)), labelW / (station.name.length * 0.55));
        const frame = atlas.add(`tank:${station.id}:${sized(w, h)}`, w, h, (c) => {
          c.drawImage(tanks, cell.x, cell.y, TEA_DISPENSER_ART.width, TEA_DISPENSER_ART.height, 0, 0, w, h);
          fitText(c, station.name, nameSize, 700, '#784522', lx + labelW / 2, ly + lh / 2, labelW);
        });
        items.push({ frame, x, y, w, h });
        // The active tap's name is ringed; the ring is a frame shown or hidden.
        const ring = atlas.add(`tea-ring:${sized(labelW, lh)}`, labelW, lh, (c) => {
          roundRect(c, 0.5, 0.5, labelW - 1, lh - 1, 3);
          c.lineWidth = 1;
          c.strokeStyle = '#7B874B';
          c.stroke();
        });
        items.push({ frame: ring, x: x + lx, y: y + ly, w: labelW, h: lh, name: 'ring', visible: false });
      } else if (station.kind === 'topping') {
        const option = getIngredient('toppings', station.id) as Topping;
        const extent = panExtent(w, h, station.panShape);
        const tagW = w * TOPPING_TAG.width;
        const nameSize = Math.min(Math.max(6, Math.min(10, w * 0.085)), tagW / (option.name.length * 0.52));
        const padY = Math.max(0.5, h * 0.02);
        const tagH = nameSize * 1.25 + padY * 2 + 2;
        const tagTop = h - h * TOPPING_TAG.bottom - tagH;
        const frame = atlas.add(`pan:${station.id}:${sized(w, h)}`, extent.width, h, (c) => {
          drawPan(c, pans, station.id, w, h, station.panShape);
          c.save();
          c.translate(-extent.left + (w - tagW) / 2, tagTop);
          card(c, tagW, tagH, 3, SHOP.plaque, 1, SHOP.woodEdge);
          fitText(c, option.name, nameSize, 700, '#6B4422', tagW / 2, tagH / 2, tagW - 4);
          c.restore();
        });
        items.push({ frame, x: x + extent.left, y, w: extent.width, h, dims: true });
      } else if (station.kind === 'ice') {
        // The machine is painted into the room; only its touch highlight is drawn over it.
        const gh = Math.max(44, h);
        const frame = atlas.add(`ice-glow:${sized(w, gh)}`, w, gh, (c) => {
          roundRect(c, 0, 0, w, gh, 12);
          c.fillStyle = '#FFF8E6';
          c.fill();
        });
        items.push({ frame, x, y, w, h: gh, name: 'glow', visible: false });
      } else {
        const rx = w * 0.46;
        const ry = Math.max(3, w * 0.11);
        const shadow = atlas.add(`shadow:${sized(rx, ry)}`, rx * 2, ry * 2, (c) => drawShadow(c, rx, ry));
        items.push({ frame: shadow, x: station.cx - rx, y: y + h - ry, w: rx * 2, h: ry * 2 });
        const art = station.kind === 'foam' ? sourceImage(this, foamTexture(station.id))
          : this.textures.exists(`bottle-${bottleColor(station)}`) ? sourceImage(this, `bottle-${bottleColor(station)}`) : null;
        if (art) {
          const frame = atlas.add(`${station.key}:${sized(w, h)}`, w, h, (c) => c.drawImage(art, 0, 0, w, h));
          items.push({ frame, x, y, w, h, dims: true });
        }
        const labels = station.kind === 'sugar'
          ? ['Đường', ...SUGAR_STEPS.map((step) => `${step}%`)]
          : [station.kind === 'milk' ? (station.id === 'oat' ? 'Yến mạch' : 'Sữa tươi') : (station.id === 'cheese' ? 'Phô mai' : 'Brûlée')];
        labels.forEach((text, i) => {
          const p = plaque(text, station.labelW);
          const frame = atlas.add(`plaque:${text}:${p.w.toFixed(1)}`, p.w, p.h, p.draw);
          items.push({ frame, x: station.cx - p.w / 2, y: y + h + 1, w: p.w, h: p.h, name: `plaque${i}`, visible: i === 0 });
        });
        if (station.kind === 'sugar') {
          // How sweet the cup already is, in three pips: one frame per count.
          const d = w * 0.14;
          const total = d * 3 + 6;
          for (let pumps = 0; pumps <= 3; pumps++) {
            const frame = atlas.add(`pips:${pumps}:${d.toFixed(2)}`, total + 2, d + 2, (c) => {
              for (let i = 0; i < 3; i++) {
                c.beginPath();
                c.arc(1 + i * (d + 3) + d / 2, 1 + d / 2, d / 2 - 0.5, 0, Math.PI * 2);
                c.fillStyle = i < pumps ? '#C98A1E' : '#FFF3D9';
                c.fill();
                c.lineWidth = 1;
                c.strokeStyle = SHOP.woodEdge;
                c.stroke();
              }
            });
            items.push({ frame, x: station.cx - (total + 2) / 2, y: y + h * 0.92, w: total + 2, h: d + 2, dims: true, name: `pips${pumps}`, visible: pumps === 0 });
          }
        }
      }
      pieces.push({ station, items });
    }

    const key = atlas.build(this, 'kitchen-room');
    for (const { station, items } of pieces) {
      if (!station) {
        for (const item of items) this.room.add(this.add.image(item.x, item.y, key, item.frame).setOrigin(0).setDisplaySize(item.w, item.h));
        continue;
      }
      // Each station scales from its own middle when pressed; its art dims when it is locked out.
      const cx = station.cx;
      const cy = station.y + station.h / 2;
      const container = this.add.container(cx, cy);
      const art = this.add.container(0, 0);
      for (const item of items) {
        const image = this.add.image(item.x - cx, item.y - cy, key, item.frame).setOrigin(0).setDisplaySize(item.w, item.h);
        if (item.name) image.setName(item.name);
        if (item.visible === false) image.setVisible(false);
        if (item.name === 'glow') image.setVisible(true).setAlpha(0);
        (item.dims || ['tea', 'topping', 'ice'].includes(station.kind) ? art : container).add(image);
        if (item.name === 'ring') this.teaLabels.set(station.key, image);
      }
      container.add(art);
      this.room.add(container);
      this.stationViews.set(station.key, { container, art });
      if (station.kind === 'sugar') this.syrupLabel = { container, art, pumps: -1 };
    }
    this.room.setX(-this.pan);

    const { holder } = layout;
    this.holder.setPosition(holder.left, holder.top).setDisplaySize(holder.width, holder.height);
  }

  /** Locks, labels and the active tap: everything about the equipment that follows the drink. */
  private refreshEquipment() {
    const layout = this.layout;
    if (!layout) return;
    const { cup, build, config } = store.state;
    const docked = this.docked();
    const busy = Boolean(!cup.size || docked);
    for (const station of layout.stations) {
      const view = this.stationViews.get(station.key);
      if (!view) continue;
      let locked = false;
      if (station.kind === 'milk') locked = (cup.milk !== null && cup.milk !== station.id) || busy;
      else if (station.kind === 'topping') {
        locked = (!cup.toppings.includes(station.id) && cup.toppings.length >= config.maxToppings) || busy;
      } else if (station.kind === 'foam') locked = (Boolean(cup.foam) && cup.foam !== station.id) || busy;
      else if (station.kind === 'sugar') locked = busy;
      view.art.setAlpha(locked ? 0.55 : 1);
      view.locked = locked;
    }
    for (const [key, border] of this.teaLabels) border.setVisible(docked?.key === key);
    // The bottle says how sweet the cup already is: on its plaque, and in three pips.
    if (this.syrupLabel && this.syrupLabel.pumps !== build.sugarPumps) {
      const { container, art } = this.syrupLabel;
      const pumps = build.sugarPumps;
      this.syrupLabel.pumps = pumps;
      for (let i = 0; i <= 3; i++) {
        (container.getByName(`plaque${i}`) as Phaser.GameObjects.Image | null)?.setVisible(i === pumps);
        (art.getByName(`pips${i}`) as Phaser.GameObjects.Image | null)?.setVisible(i === pumps);
      }
    }
    uiState.set({ hint: hintFor(cup, docked ?? undefined) });
  }

  // ================================================================== the cup
  private docked(): Station | null {
    if (!this.layout || this.dockCupId !== store.state.cupId || !this.dock) return null;
    return this.layout.stations.find((s) => s.key === this.dock) ?? null;
  }

  /** Make (or remake) the cup for the drink on the mat. */
  private buildCup(relayout = false) {
    const { cup, cupId } = store.state;
    const layout = this.layout;
    if (!layout) return;
    const key = `${cupId}:${cup.size}:${layout.cupW}`;
    if (!cup.size) {
      this.cup?.destroy();
      this.cup = null;
      this.cupKey = '';
      this.showMatLabel(true);
      return;
    }
    this.showMatLabel(false);
    if (key === this.cupKey && this.cup) {
      if (relayout) this.standCupDown(true);
      return;
    }
    const freshCup = !this.cupKey.startsWith(`${cupId}:`);
    this.cup?.destroy();
    this.cupKey = key;
    this.cup = new CupView(this, layout.cupW, layout.cupH, cup);
    this.cup.setDrink(cup, cupId, true);
    this.cup.level = this.level;
    this.cup.container.setDepth(DEPTH.cup);
    this.spill?.container.destroy();
    this.spill = null;
    this.dock = null;
    this.cupPos = { x: layout.homeX, y: layout.homeY, scale: 1 };
    // A new cup drops onto the mat; one that is merely re-sized or re-laid-out just stands there.
    this.appear = freshCup ? 0 : 1;
    if (this.appear === 0) this.tweens.add({ targets: this, appear: 1, duration: DURATION.slow, ease: EASE });
  }

  private showMatLabel(show: boolean) {
    this.matLabel?.destroy();
    this.matLabel = null;
    if (!show || !this.layout) return;
    const { holder } = this.layout;
    const label = 'Chạm ly S / M / L trên kệ';
    const font = canvasFont(11, 700);
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
    this.cupTweens = [this.tweens.add({ targets: this.cupPos, ...to, duration, ease: EASE })];
  }

  /** Send the cup back to its mat, wherever it was left. */
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
    }
    if (state.cupId !== previous.cupId || state.cup !== previous.cup) {
      this.buildCup();
      this.cup?.setDrink(this.drinkShown(), state.cupId);
      this.refreshEquipment();
    }
    if (state.build.fill !== previous.build.fill || state.cupId !== previous.cupId) {
      this.tweenLevel(state.build.fill, DURATION.base);
      setPourFill(state.build.fill);
    }
    if (state.build !== previous.build) this.refreshEquipment();
  }

  /** The drink as drawn: while the cup stands under a tap, its tea is the tap's. */
  private drinkShown(): Drink {
    const { cup } = store.state;
    const tap = this.pouring?.station.id ?? this.docked()?.id;
    return tap && !cup.tea ? { ...cup, tea: tap } : cup;
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
    const layout = this.layout;

    // 1. The cup itself.
    if (this.cup && state.cup.size) {
      const { x: cx, y: cy, scale } = this.cupPos;
      if (this.inside(x, y, cx, cy, layout.cupW * scale, layout.cupH * scale)) return this.grabCup(x, y);
    }

    // 2. Equipment, in the room.
    const rx = x + this.pan;
    for (let i = layout.stations.length - 1; i >= 0; i--) {
      const station = layout.stations[i];
      const left = station.cx - station.slot / 2;
      if (station.kind === 'tea') {
        if (this.inside(rx, y, left, station.y, station.slot, Math.max(44, station.h))) return this.pressTap(station, x);
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
      case 'pour': return this.releaseTap(gesture);
      case 'carry':
        this.pressStation(gesture.station, false);
        return this.dropTool(gesture.station);
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

  private setPan(value: number) {
    if (!this.layout) return;
    this.pan = Math.max(0, Math.min(this.layout.room.maxPan, value));
    this.room.setX(-this.pan);
  }

  /** The game is put down mid-gesture: empty the hands, and let go of the tap without pouring. */
  private abortAll() {
    if (this.pouring?.running) {
      this.tweenLevel(store.state.build.fill, DURATION.fast);
      this.stopPour(false);
    }
    this.cancelGesture();
    this.standCupDown();
  }

  private cancelGesture() {
    const gesture = this.gesture;
    this.gesture = null;
    this.pointerId = -1;
    if (!gesture) return;
    if (gesture.kind === 'carry') this.cancelTool();
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
    if (found) {
      playSound('cupDown', DURATION.base);
      this.dock = found.key;
      this.dockCupId = store.state.cupId;
      const dockScale = found.dockScale;
      this.tweenCup({
        scale: dockScale,
        x: found.cx - this.pan - layout.cupW * dockScale / 2,
        y: found.dockY - layout.cupH * dockScale,
      }, DURATION.base);
      this.cup?.setDrink(this.drinkShown(), store.state.cupId);
      this.refreshEquipment();
    } else {
      playSound('cupDown', DURATION.slow);
      this.standCupDown();
      this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    }
  }

  // ------------------------------------------------------------------ the taps
  private pressTap(station: Station, x: number) {
    const { cup, build } = store.state;
    const locked = cup.tea !== null && cup.tea !== station.id;
    const enabled = this.docked()?.key === station.key && !locked;
    this.gesture = { kind: 'pour', station, enabled, startedAt: performance.now(), startX: x };
    if (!enabled) return;
    this.pouring = { station, running: true };
    setPourSound(true, this.level);
    const room = Math.max(0.02, MAX_POUR - build.fill);
    this.tweenLevel(MAX_POUR, (room / POUR_RATE) * 1000, true);
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
      const locked = cup.tea !== null && cup.tea !== station.id;
      playSound('nudge');
      nudge(locked ? 'Ly đã có trà khác — đổ bỏ để pha lại' : `Kéo ly dưới bình ${station.name} trước`);
      return;
    }
    if (!this.pouring?.running) return;
    const amount = ((performance.now() - gesture.startedAt) / 1000) * POUR_RATE;
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
  private busyMessage(): string | null {
    const { cup } = store.state;
    const docked = this.docked();
    if (!cup.size) return 'Chạm ly S / M / L trên kệ để lấy ly trước';
    if (docked) return `Ly đang ở dưới vòi ${docked.name} — kéo ly ra trước`;
    return null;
  }

  private pressStation(station: Station, down: boolean) {
    const view = this.stationViews.get(station.key);
    if (!view) return;
    this.tweens.killTweensOf(view.container);
    this.tweens.add({ targets: view.container, scale: down ? 0.94 : 1, duration: down ? 80 : 180, ease: EASE });
    const glow = view.art.getByName('glow') as Phaser.GameObjects.Image | null;
    if (glow) {
      this.tweens.killTweensOf(glow);
      this.tweens.add({ targets: glow, alpha: down ? 0.16 : 0, duration: down ? 80 : 180, ease: EASE });
    }
  }

  private grabTool(station: Station, x: number, y: number) {
    const busy = this.busyMessage();
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
    for (const tween of this.toolTweens) tween.stop();
    this.tool?.destroy();
    const inner = this.add.container(-size / 2, -size / 2, addTool(this, station, size));
    this.tool = this.add.container(0, 0, [inner]).setDepth(DEPTH.tool);
    this.toolState = {
      // The room scrolls, while carried tools follow the finger in screen coordinates.
      originX: station.cx - this.pan - size / 2,
      originY: station.y + station.h * 0.1,
      x: 0, y: 0, tip: 0, show: 1, size,
    };
    this.toolState.x = this.toolState.originX;
    this.toolState.y = this.toolState.originY;
    playSound('pickup');
    if (station.kind === 'topping') nudge(getIngredient('toppings', station.id)?.name ?? station.name);
    else if (station.kind === 'ice') nudge('Kéo muỗng đá vào ly · 1 muỗng: ít đá · 2 muỗng: đá thường');
    this.gesture = { kind: 'carry', station, startX: x, startY: y, target: this.tool };
  }

  private dropTool(station: Station) {
    const state = store.state;
    const { cup: now, build: made, config } = state;
    const layout = this.layout!;
    const s = this.toolState.size;
    if (!now.size) {
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
    const over = overBox(this.cupPos.x, this.cupPos.y) || overBox(layout.homeX, layout.homeY);

    const putBack = (message?: string) => {
      if (message) {
        playSound('nudge');
        nudge(message);
      }
      this.toolTweens = [
        this.tweens.add({ targets: this.toolState, x: this.toolState.originX, y: this.toolState.originY, duration: DURATION.base, ease: EASE }),
        this.tweens.add({ targets: this.toolState, show: 0, delay: DURATION.base, duration: 1 }),
      ];
    };
    if (!over) {
      const moved = Math.abs(this.toolState.x - this.toolState.originX) + Math.abs(this.toolState.y - this.toolState.originY);
      putBack(moved < 8 ? `Kéo ${station.name.toLowerCase()} thả vào ly` : undefined);
      return;
    }
    switch (station.kind) {
      case 'topping':
        if (now.toppings.includes(station.id)) return putBack(`Ly đã có ${station.name}`);
        if (now.toppings.length >= config.maxToppings) return putBack(config.maxToppings === 1 ? 'Ly chỉ được 1 topping' : `Tối đa ${config.maxToppings} topping`);
        playSound('scoop');
        dispatch({ type: 'SCOOP', category: 'toppings', optionId: station.id });
        break;
      case 'foam':
        if (now.foam) return putBack('Ly đã có kem');
        playSound('foam');
        dispatch({ type: 'SCOOP', category: 'foam', optionId: station.id });
        break;
      case 'milk':
        if (now.milk && now.milk !== station.id) return putBack('Ly đã có loại sữa khác');
        if (made.fill >= 1) return putBack('Ly đầy rồi — chừa chỗ cho sữa');
        playSound('milk');
        dispatch({ type: 'POUR', category: 'milk', optionId: station.id, amount: MILK_SPLASH });
        break;
      case 'ice':
        if (made.iceScoops >= MAX_ICE_SCOOPS) return putBack('Đá đã đầy ly');
        playSound('ice');
        dispatch({ type: 'ICE_SCOOP' });
        break;
      default:
        if (made.sugarPumps >= SUGAR_STEPS.length) return putBack('Ngọt tối đa rồi');
        playSound('sugar');
        dispatch({ type: 'SUGAR_PUMP' });
        break;
    }
    // Tip it in over the cup, then it's gone.
    this.toolTweens = [
      this.tweens.add({ targets: this.toolState, tip: 1, duration: 320, ease: EASE }),
      this.tweens.add({ targets: this.toolState, show: 0, delay: 300, duration: 1 }),
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
      nudge('Đổ bỏ ly đang pha trước khi lấy ly mới');
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

  private takeCup(size: CupSize) {
    if (store.state.cup.size) {
      nudge('Đổ bỏ ly đang pha trước khi lấy ly mới');
      return;
    }
    playSound('cupDown');
    dispatch({ type: 'PICK_CUP', size });
  }

  private releaseRack(gesture: Extract<Gesture, { kind: 'rack' }>) {
    const rack = this.rackCup;
    if (!rack) return;
    // A tap is the quick way: the cup goes straight onto the mat, as if it had been carried.
    if (gesture.distance < 8) {
      this.dropRackCup();
      this.takeCup(gesture.size);
      return;
    }
    // Anywhere on the mat counts: the cup is tested by the point it would stand on.
    const holder = this.layout!.holder;
    const cup = cupSizeFor(this.W, this.H, gesture.size);
    const footX = rack.x + cup.width / 2;
    const footY = rack.y + cup.height * CUP_FOOT / CUP_ART.h;
    const padX = cup.width / 2;
    const padY = 24 + cup.height * 0.45;
    const overMat = footX >= holder.left - padX && footX <= holder.left + holder.width + padX
      && footY >= holder.top - padY && footY <= holder.top + holder.height + padY;
    if (overMat && !store.state.cup.size) {
      this.dropRackCup();
      this.takeCup(gesture.size);
      return;
    }
    this.tweens.add({ targets: rack, x: gesture.originX, y: gesture.originY, duration: DURATION.base, ease: EASE });
    this.tweens.add({ targets: rack, alpha: 0, delay: 220, duration: 100, onComplete: () => this.dropRackCup() });
    nudge('Thả ly lên thảm — hoặc chỉ cần chạm vào ly trên kệ');
  }

  /** Tell the HTML where the cup is on the page, for the effects that start from it. */
  private reportCup() {
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

    // The room coasts to a stop after a flick.
    if (!this.gesture && Math.abs(this.panVelocity) > 0.01) {
      this.setPan(this.pan + this.panVelocity * delta);
      this.panVelocity *= Math.pow(0.992, delta);
      if (this.pan <= 0 || this.pan >= layout.room.maxPan) this.panVelocity = 0;
    }

    // The cup.
    if (this.cup) {
      const { x, y, scale } = this.cupPos;
      this.cup.container.setPosition(x, y - (1 - this.appear) * 10).setScale(scale).setAlpha(this.appear);
      this.cup.level = this.level;
      this.cup.update(time, delta);
      this.spill?.update(this.level);
      const docked = Boolean(this.dock);
      this.cupShadow.setVisible(docked);
      if (docked) {
        const w = layout.cupW * scale;
        const h = w * 0.18;
        this.cupShadow.setPosition(x + w * 0.12, y + layout.cupH * scale * 0.96 - h / 2).setDisplaySize(w * 0.76, h);
      }
    } else this.cupShadow.setVisible(false);
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
    if (docked) {
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
        .setRotation(Phaser.Math.DegToRad(-6 + (124 + 6) * tip))
        .setAlpha(show * (1 - tip * 0.85))
        .setVisible(show > 0);
      if (show <= 0 && !this.gesture) {
        this.tool.destroy();
        this.tool = null;
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

