import Phaser from 'phaser';

import {
  CupSize, Drink, EMPTY_DRINK, getIngredient, MAX_ICE_SCOOPS, MAX_POUR, MILK_SPLASH, POUR_RATE, SUGAR_STEPS,
} from '../game/ingredients';
import { GameState } from '../game/reducer';
import { CUP_HOLDER, CUP_HOLDER_ART, ROOM_BG_CUP_STATION, ROOM_BG_LIDDING, ROOM_BG_SIZE, TEA_DISPENSER_ART, TEA_DISPENSERS } from '../art/kitchenArt';
import { ORIGINAL_ROOM_SIZE, ROOM_EXTRA_HEIGHT } from '../art/roomGeometry';
import { TOPPING_PANS } from '../art/toppingArt';
import { equipmentFrame, PaintedEquipmentId } from '../art/equipmentArt';
import {
  KITCHEN_ROOM_ART, KITCHEN_ROOM_RENDER, KITCHEN_ROOM_TRAYS,
  KITCHEN_ORIGINAL_COUNTER, KITCHEN_ORIGINAL_COUNTER_ART, KITCHEN_ROOM_TRAY_CELLS,
  KITCHEN_BOARDS, KITCHEN_BOARD_ART, KITCHEN_CLEAR_BOARDS, KITCHEN_CLEAR_BOARDS_PATCH,
  KITCHEN_ROOM_TRAY_RAISE, KITCHEN_ROOM_CLEAR_ICE, KITCHEN_ROOM_CLEAR_ICE_PATCH,
} from '../art/kitchenRoomArt';
import { holderSurfaceY, HOLDER_HEIGHT, HOLDER_RECESS } from '../art/referenceCupArt';
import { CUP_ART, CUP_BASE, CUP_FOOT } from '../art/cupGeometry';
import { gameArea } from '../game/host';
import { bakeCanvas, canvasFont, placeCamera, tex } from '../game/view';
import { playSound, setPourFill, setPouring as setPourSound } from '../sound';
import { dispatch, store } from '../store';
import { nudge, uiState } from '../ui-state';
import { CupView } from '../kitchen/CupView';
import {
  addTool, prepareEquipmentTextures, card, drawPan, drawEquipmentShadow, equipmentShadowExtent,
  measure, panExtent, roundRect, sourceImage,
} from '../kitchen/equipment';
import { Atlas } from '../kitchen/atlas';
import { cupSizeFor, findDairyStation, findStation, hintFor, KitchenLayout, layoutKitchen, Station } from '../kitchen/layout';
import { KITCHEN_TEXT_MIN } from '../kitchen/typography';
import { DURATION, EASE } from '../kitchen/motion';
import { cupSeatShadowTexture, cupShadowTexture, Spill, Stream } from '../kitchen/pourEffects';

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

type Gesture =
  | { kind: 'cup'; startX: number; startY: number; grabX: number; grabY: number; owned: boolean }
  | { kind: 'lidder'; station: Station; startX: number }
  | { kind: 'pour'; station: Station; enabled: boolean; startedAt: number; startX: number }
  | { kind: 'carry'; station: Station; startX: number; startY: number; distance: number; target: Phaser.GameObjects.Container }
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
  private holderFront!: Phaser.GameObjects.Image;
  private matLabel: Phaser.GameObjects.Image | null = null;
  private stationViews = new Map<string, { container: Phaser.GameObjects.Container; art: Phaser.GameObjects.Container; locked?: boolean }>();
  private teaLabels = new Map<string, Phaser.GameObjects.Image>();
  /** The carton or canister in a hand. There is one of each, so its place on the counter stands empty. */
  private held: Station | null = null;

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
  private lidderElapsed = 0;
  private lidderLoading = false;
  private lidderHead: Phaser.GameObjects.Image | null = null;

  private level = 0;
  private levelTween: Phaser.Tweens.Tween | null = null;
  private pouring: { station: Station; running: boolean } | null = null;
  private stream: Stream | null = null;
  private spill: Spill | null = null;

  private tool: Phaser.GameObjects.Container | null = null;
  private toolState = { x: 0, y: 0, tip: 0, show: 0, originX: 0, originY: 0, size: 0 };
  private toolTweens: Phaser.Tweens.Tween[] = [];
  private finishingTool = false;
  private toolCupId = -1;
  private rackCup: { view: CupView; x: number; y: number; alpha: number } | null = null;

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

  /**
   * The room: the painting, and everything standing in it drawn into one atlas (see `atlas.ts`), so
   * the whole wall is two textures however much is on it. What changes while playing — a station
   * dimmed, pressed or ringed — is a different frame of that atlas or an alpha,
   * never a redraw.
   */
  private buildRoom() {
    const layout = this.layout!;
    this.room.removeAll(true);
    this.stationViews.clear();
    this.teaLabels.clear();
    const { room } = layout;
    // Render the repaired wall and room together: separate strips left a visible blurred join.
    this.room.add(this.add.image(0, room.top, tex(KITCHEN_ROOM_RENDER))
      .setOrigin(0).setDisplaySize(room.width, ROOM_BG_SIZE.height * room.scale));
    // Read the first design directly, without regenerating or baking its boards and counter.
    const counter = KITCHEN_ORIGINAL_COUNTER_ART;
    const counterTexture = this.textures.get(tex(KITCHEN_ORIGINAL_COUNTER));
    if (!counterTexture.has('original-counter')) {
      counterTexture.add('original-counter', 0, 0, counter.top, counter.width, counter.height - counter.top);
    }
    const counterTop = ROOM_EXTRA_HEIGHT + counter.top / counter.height * ORIGINAL_ROOM_SIZE.height;
    this.room.add(this.add.image(0, room.top + counterTop * room.scale, tex(KITCHEN_ORIGINAL_COUNTER), 'original-counter')
      .setOrigin(0).setDisplaySize(room.width, (ROOM_BG_SIZE.height - counterTop) * room.scale));
    // Consume removal pixels only inside the two old board footprints and their shadows.
    const cleared = KITCHEN_CLEAR_BOARDS_PATCH;
    const clearBoardsKey = bakeCanvas(this, 'clear-old-board-footprints', cleared.width, cleared.height, c => {
      c.drawImage(sourceImage(this, KITCHEN_CLEAR_BOARDS), cleared.x, cleared.y, cleared.width, cleared.height,
        0, 0, cleared.width, cleared.height);
      c.globalCompositeOperation = 'destination-in';
      c.translate(0, -cleared.y); c.filter = 'blur(3px)';
      c.beginPath(); c.moveTo(96, 342); c.lineTo(1170, 342);
      c.quadraticCurveTo(1215, 342, 1219, 377); c.lineTo(1224, 590);
      c.lineTo(0, 590); c.lineTo(0, 490); c.lineTo(42, 374);
      c.quadraticCurveTo(50, 342, 96, 342); c.closePath(); c.fill();
      c.filter = 'none';
      const fade = c.createLinearGradient(0, 565, 0, 590);
      fade.addColorStop(0, '#000'); fade.addColorStop(1, 'transparent');
      c.fillStyle = fade; c.fillRect(0, cleared.y, cleared.width, cleared.height);
    });
    const originalScale = ORIGINAL_ROOM_SIZE.width / counter.width;
    this.room.add(this.add.image(cleared.x * originalScale * room.scale,
      room.top + (ROOM_EXTRA_HEIGHT + cleared.y * originalScale) * room.scale, clearBoardsKey)
      .setOrigin(0).setDisplaySize(cleared.width * originalScale * room.scale, cleared.height * originalScale * room.scale));
    // Ease the projection into the rounded front: every source row survives, without a cut line.
    for (const [index, board] of KITCHEN_BOARDS.entries()) {
      const crop = board.source;
      const padding = 20;
      const face = bakeCanvas(this, `rounded-board-face:${index}`, board.width, board.height, c => {
        const image = sourceImage(this, KITCHEN_BOARD_ART);
        const scale = board.surfaceHeight / crop.topHeight;
        const start = crop.topHeight - 30;
        const rest = crop.height - start;
        const curve = (board.height - start * scale - rest * scale) / (rest * rest);
        const project = (y: number) => y <= start ? y * scale
          : start * scale + (y - start) * scale + curve * (y - start) ** 2;
        c.imageSmoothingQuality = 'high';
        for (let row = 0; row < crop.height; row++) {
          const y = project(row), next = project(row + 1);
          c.drawImage(image, crop.x, crop.y + row, crop.width, 1,
            0, y, board.width, next - y + 0.2);
        }
      });
      const key = bakeCanvas(this, `rounded-overhead-board:${index}`, board.width + padding * 2, board.height + padding * 2, c => {
        c.shadowColor = '#57391c40'; c.shadowBlur = 9; c.shadowOffsetX = -7; c.shadowOffsetY = 7;
        c.drawImage(sourceImage(this, face), padding, padding, board.width, board.height);
      });
      this.room.add(this.add.image((board.x - padding) * room.scale,
        room.top + (board.y - padding) * room.scale, key).setOrigin(0)
        .setDisplaySize((board.width + padding * 2) * room.scale, (board.height + padding * 2) * room.scale));
    }
    // Preserve the original room; local counter edits blend only at their marble boundaries.
    for (const [image, patch, key, targetY] of [
      [KITCHEN_ROOM_CLEAR_ICE, KITCHEN_ROOM_CLEAR_ICE_PATCH, 'room-clear-old-ice', KITCHEN_ROOM_CLEAR_ICE_PATCH.y],
    ] as const) {
      const patchKey = bakeCanvas(this, key, patch.width, patch.height, c => {
        c.drawImage(sourceImage(this, image), patch.x, patch.y, patch.width, patch.height,
          0, 0, patch.width, patch.height);
        c.globalCompositeOperation = 'destination-in';
        const across = c.createLinearGradient(0, 0, patch.width, 0);
        across.addColorStop(0, patch.x > 0 ? 'transparent' : '#000');
        if (patch.x > 0) across.addColorStop(patch.feather / patch.width, '#000');
        across.addColorStop(1 - patch.feather / patch.width, '#000');
        across.addColorStop(1, 'transparent');
        c.fillStyle = across; c.fillRect(0, 0, patch.width, patch.height);
        const down = c.createLinearGradient(0, 0, 0, patch.height);
        down.addColorStop(0, 'transparent');
        down.addColorStop(patch.topFeather / patch.height, '#000');
        down.addColorStop(1 - patch.feather / patch.height, '#000');
        down.addColorStop(1, 'transparent');
        c.fillStyle = down; c.fillRect(0, 0, patch.width, patch.height);
        c.globalCompositeOperation = 'source-over';
      });
      this.room.add(this.add.image(patch.x / KITCHEN_ROOM_ART.width * room.width,
        room.top + targetY / KITCHEN_ROOM_ART.height * room.height, patchKey)
        .setOrigin(0).setDisplaySize(patch.width / KITCHEN_ROOM_ART.width * room.width,
          patch.height / KITCHEN_ROOM_ART.height * room.height));
    }
    // Clip each moved pan to its own rim: no marble rectangle can cover the restored wood.
    for (const [index, pan] of KITCHEN_ROOM_TRAY_CELLS.entries()) {
      const key = bakeCanvas(this, `raised-pan:${index}`, pan.width, pan.height, c => {
        roundRect(c, 0, 0, pan.width, pan.height, 7); c.clip();
        c.drawImage(sourceImage(this, KITCHEN_ROOM_TRAYS), pan.x, pan.y, pan.width, pan.height,
          0, 0, pan.width, pan.height);
      });
      this.room.add(this.add.image(pan.x / KITCHEN_ROOM_ART.width * room.width,
        room.top + (pan.y - KITCHEN_ROOM_TRAY_RAISE) / KITCHEN_ROOM_ART.height * room.height, key)
        .setOrigin(0).setDisplaySize(pan.width / KITCHEN_ROOM_ART.width * room.width,
          pan.height / KITCHEN_ROOM_ART.height * room.height));
    }
    this.lidderHead?.destroy();
    const head = ROOM_BG_LIDDING.head;
    const pressKey = bakeCanvas(this, `lidder-head:${room.scale}`, head.width * room.scale, head.height * room.scale, (c) => {
      const art = sourceImage(this, KITCHEN_ROOM_RENDER) as HTMLImageElement;
      c.drawImage(art, head.x / ROOM_BG_SIZE.width * art.width, head.y / ROOM_BG_SIZE.height * art.height,
        head.width / ROOM_BG_SIZE.width * art.width, head.height / ROOM_BG_SIZE.height * art.height,
        0, 0, head.width * room.scale, head.height * room.scale);
    });
    this.lidderHead = this.add.image(0, 0, pressKey).setOrigin(0)
      .setDisplaySize(head.width * room.scale, head.height * room.scale).setDepth(DEPTH.cup + 1).setVisible(false);

    const atlas = new Atlas();
    const pans = sourceImage(this, TOPPING_PANS);
    const tanks = sourceImage(this, TEA_DISPENSERS);
    const sized = (w: number, h: number) => `${w.toFixed(1)}x${h.toFixed(1)}`;
    type Piece = { frame: string; x: number; y: number; w: number; h: number; dims?: boolean; name?: string; visible?: boolean };
    const pieces: { station?: Station; items: Piece[] }[] = [];

    // Small paper plaques sit on the wooden front, centered under the actual painted stacks.
    const labels = ROOM_BG_CUP_STATION.labels;
    layout.rack.forEach((stack, index) => {
      const w = Math.max(26, labels.width * room.scale);
      const h = Math.max(14, labels.height * room.scale);
      const frame = atlas.add(`cup-size:${stack.size}:${sized(w, h)}`, w, h, c => {
        // A tight contact shadow and warm paper shading keep these part of the organizer.
        roundRect(c, 1, 1.5, w - 2, h - 2, 2);
        c.fillStyle = 'rgba(100, 57, 23, 0.22)'; c.fill();
        const paper = c.createLinearGradient(0, 1, 0, h - 2);
        paper.addColorStop(0, '#FFF0CF'); paper.addColorStop(1, '#EAC995');
        roundRect(c, 1, 0.5, w - 2, h - 2, 2);
        c.fillStyle = paper; c.fill();
        c.strokeStyle = '#BA8C55'; c.lineWidth = 0.65; c.stroke();
        c.fillStyle = 'rgba(255, 250, 225, 0.7)'; c.fillRect(3, 1.5, w - 6, 0.6);
        c.fillStyle = '#BB915E';
        for (const x of [4, w - 4]) {
          c.beginPath(); c.arc(x, (h - 1) / 2, 0.65, 0, Math.PI * 2); c.fill();
        }
        c.font = canvasFont(Math.max(KITCHEN_TEXT_MIN, h * 0.58), 700);
        c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#79502F';
        const glyph = c.measureText(stack.size);
        c.fillText(stack.size, w / 2, (h - 1 + glyph.actualBoundingBoxAscent - glyph.actualBoundingBoxDescent) / 2);
      });
      pieces.push({ items: [{ frame, x: labels.centers[index] * room.scale - w / 2,
        y: room.top + labels.y * room.scale - h / 2, w, h }] });
    });

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
        const labelW = w * TEA_DISPENSER_ART.label.width, lh = h * TEA_DISPENSER_ART.label.height;
        const lx = w * TEA_DISPENSER_ART.label.left, ly = h * TEA_DISPENSER_ART.label.top;
        const frame = atlas.add(`tank:${station.id}:${sized(w, h)}`, w, h, (c) => {
          c.drawImage(tanks, cell.x, cell.y, TEA_DISPENSER_ART.width, TEA_DISPENSER_ART.height, 0, 0, w, h);
          // A pictorial emblem replaces the name. The order uses this same emblem and tank.
          roundRect(c, lx + 1, ly + 1, labelW - 2, lh - 2, w * 0.025);
          c.fillStyle = '#FFF0CC'; c.fill();
          const key = `ingredient-mark-tea-${station.id}`;
          if (this.textures.exists(key)) {
            const size = Math.min(labelW - 3, lh - 2);
            c.drawImage(sourceImage(this, key), (w - size) / 2, ly + (lh - size) / 2, size, size);
          }
        });
        items.push({ frame, x, y, w, h });
        const ring = atlas.add(`tea-ring:${sized(labelW, lh)}`, labelW, lh, (c) => {
          roundRect(c, 0.5, 0.5, labelW - 1, lh - 1, 3);
          c.lineWidth = 1;
          c.strokeStyle = '#7B874B';
          c.stroke();
        });
        items.push({ frame: ring, x: x + lx, y: y + ly, w: labelW, h: lh, name: 'ring', visible: false });
      } else if (station.kind === 'topping') {
        const extent = panExtent(w, h, station.panShape);
        const frame = atlas.add(`pan:${station.id}:${sized(w, h)}`, extent.width, h, (c) => {
          drawPan(c, pans, station.id, w, h, station.panShape);
        });
        items.push({ frame, x: x + extent.left, y, w: extent.width, h, dims: true });
      } else if (station.kind === 'ice' || station.kind === 'sugar' || station.kind === 'lid' || station.kind === 'straw') {
        // Trays and machines are in the background; only their touch highlights are overlaid.
        const gh = Math.max(44, h);
        const frame = atlas.add(`ice-glow:${sized(w, gh)}`, w, gh, (c) => {
          roundRect(c, 0, 0, w, gh, 12);
          c.fillStyle = '#FFF8E6';
          c.fill();
        });
        // The lid press and the straw box are painted into the room and carry no name tag, like
        // every other station: the hint line and the order card say what the cup still needs.
        items.push({ frame, x, y, w, h: gh, name: 'glow', visible: false });
      } else {
        const equipmentKey = station.kind === 'foam' ? `cream-can-${station.id}` : `milk-carton-${station.id}`;
        const art = this.textures.exists(equipmentKey) ? sourceImage(this, equipmentKey) : null;
        if (art) {
          const equipment = equipmentFrame(station.id as PaintedEquipmentId);
          const foot = h * equipment.foot / equipment.height;
          const box = equipmentShadowExtent(w, h, foot);
          const shadow = atlas.add(`shadow:${station.key}:${sized(w, h)}`, box.width, box.height,
            c => drawEquipmentShadow(c, art, station.id as PaintedEquipmentId, w, h, foot));
          items.push({ frame: shadow, x: x + box.left, y: y + box.top,
            w: box.width, h: box.height, name: 'shadow' });
          const frame = atlas.add(`${station.key}:${sized(w, h)}`, w, h, (c) => c.drawImage(art, 0, 0, w, h));
          items.push({ frame, x, y, w, h, dims: true, name: 'object' });
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
      // Each station scales from its own middle when pressed.
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
    }
    this.room.setX(-this.pan);
    // A rebuild (a resize mid-carry) draws the whole counter back, including what is in a hand.
    if (this.held) this.showStationObject(this.held, false);

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

  /** Locks, labels and the active tap: everything about the equipment that follows the drink. */
  private refreshEquipment() {
    const layout = this.layout;
    if (!layout) return;
    const { cup, config, build } = store.state;
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
      if (station.kind === 'lid') locked = !cup.size || !cup.tea || build.lidded || build.inLidder;
      else if (station.kind === 'straw') locked = busy || !build.lidded || build.straw;
      else if (build.lidded) locked = true;
      view.locked = locked;
    }
    for (const [key, border] of this.teaLabels) border.setVisible(docked?.key === key);
    uiState.set({ hint: hintFor(cup, docked ?? undefined, build) });
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
      if (relayout) {
        if (store.state.build.inLidder) this.restoreLidderCup();
        else this.standCupDown(true);
      }
      return;
    }
    const freshCup = !this.cupKey.startsWith(`${cupId}:`);
    this.cup?.destroy();
    this.cupKey = key;
    this.cup = new CupView(this, layout.cupW, layout.cupH, cup);
    this.cup.setFinish(store.state.build.lidded, store.state.build.straw);
    this.cup.setDrink(cup, cupId, true);
    this.cup.level = this.level;
    this.cup.container.setDepth(DEPTH.cup);
    this.spill?.container.destroy();
    this.spill = null;
    this.dock = null;
    this.cupPos = { x: layout.homeX, y: layout.homeY, scale: 1 };
    if (store.state.build.inLidder) this.restoreLidderCup();
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
    if (store.state.build.inLidder) return;
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
      this.lidderLoading = false;
      this.lidderElapsed = 0;
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
    if (state.build !== previous.build) {
      this.cup?.setFinish(state.build.lidded, state.build.straw);
      this.refreshEquipment();
    }
  }

  /** The drink as drawn: while the cup stands under a tap, its tea is the tap's. */
  private drinkShown(): Drink {
    const { cup } = store.state;
    const docked = this.docked();
    const tap = this.pouring?.station.id ?? (docked?.kind === 'tea' ? docked.id : undefined);
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
          this.gesture = { kind: 'lidder', station, startX: x };
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
      case 'lidder':
        if (Math.abs(x - gesture.startX) > 8) {
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
      case 'lidder': return this.loadLidder(gesture.station);
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
    this.leaveLidder();
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
    if (found?.kind === 'lid' && !store.state.build.lidded) return this.loadLidder(found);
    if (found && !store.state.build.lidded) {
      playSound('cupDown', DURATION.base);
      this.dockCup(found, DURATION.base);
    } else {
      playSound('cupDown', DURATION.slow);
      this.standCupDown();
      this.cup?.setDrink(this.drinkShown(), store.state.cupId);
    }
  }

  /** Insert the cup, then let the machine complete its press cycle before returning it. */
  private loadLidder(station: Station) {
    const { cup, build, cupId } = store.state;
    const refusal = !cup.size ? 'Lấy ly và pha trà trước khi dùng máy'
      : !cup.tea ? 'Pha trà xong rồi đặt ly vào máy'
      : build.lidded ? 'Ly đã có nắp — thêm ống hút rồi phục vụ'
      : build.inLidder ? 'Máy đang đậy nắp…' : null;
    if (refusal) {
      playSound('nudge'); nudge(refusal);
      if (!build.inLidder) this.standCupDown();
      return;
    }
    this.cancelTool();
    if (this.pouring) this.stopPour(false);
    this.lidderElapsed = 0;
    this.lidderLoading = true;
    const to = this.panForDock(station);
    const duration = DURATION.slow;
    this.tweenPan(to, duration);
    this.dockCup(station, duration);
    this.cupTweens[0].setCallback('onComplete', () => {
      if (store.state.cupId === cupId) this.lidderLoading = false;
    });
    dispatch({ type: 'LOAD_LIDDER' });
    playSound('cupPickup');
    playSound('cupDown', duration);
  }

  private leaveLidder() {
    this.lidderLoading = false;
    this.lidderElapsed = 0;
    this.lidderHead?.setVisible(false);
    if (store.state.build.inLidder) dispatch({ type: 'UNLOAD_LIDDER' });
  }

  /** A resized room or a restored save keeps the cup in the machine it was left in. */
  private restoreLidderCup() {
    const layout = this.layout;
    const station = layout?.stations.find(s => s.kind === 'lid');
    if (!layout || !station) return;
    this.lidderLoading = false;
    this.lidderElapsed = 0;
    for (const tween of this.cupTweens) tween.stop();
    this.setPan(this.panForDock(station));
    this.dock = station.key;
    this.dockCupId = store.state.cupId;
    this.cupPos = { x: station.cx - this.pan - layout.cupW * station.dockScale / 2,
      y: station.dockY - layout.cupH * station.dockScale, scale: station.dockScale };
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
      if (!cup.size) {
        playSound('nudge');
        nudge('Chạm ly S / M / L trên kệ để lấy ly trước');
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
    if (docked?.kind === 'lid' || store.state.build.inLidder) return 'Ly đang ở trong máy đậy nắp — đợi máy xong';
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

  /**
   * A milk carton and a cream canister are carried *whole* — unlike a scoop of topping or a spoonful of
   * sugar, whose container stays where it is — and the room has only one of each. So the counter
   * shows nothing while one is in hand, and has it back the moment the carried one is gone.
   */
  private holdStation(station: Station | null) {
    const previous = this.held;
    this.held = station;
    if (previous && previous !== station) this.showStationObject(previous, true);
    if (station) this.showStationObject(station, false);
  }

  private showStationObject(station: Station, visible: boolean) {
    if (station.kind !== 'milk' && station.kind !== 'foam') return;
    const view = this.stationViews.get(station.key);
    if (!view) return;
    (view.art.getByName('object') as Phaser.GameObjects.Image | null)?.setVisible(visible);
    // Its contact shadow goes with it; nothing is standing there to cast one.
    (view.container.getByName('shadow') as Phaser.GameObjects.Image | null)?.setVisible(visible);
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
    const inner = this.add.container(-size / 2, -size / 2, addTool(this, station, size));
    this.tool = this.add.container(0, 0, [inner]).setDepth(DEPTH.tool);
    this.toolState = {
      // The room scrolls, while carried tools follow the finger in screen coordinates.
      originX: station.cx - this.pan - size / 2,
      originY: station.y + (station.kind === 'milk' || station.kind === 'foam' ? 0 : station.h * 0.1),
      x: 0, y: 0, tip: 0, show: 1, size,
    };
    this.toolState.x = this.toolState.originX;
    this.toolState.y = this.toolState.originY;
    this.holdStation(station);
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
    if (station.kind === 'lid') return 'Đặt ly vào máy để đậy nắp';
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
    switch (station.kind) {
      case 'straw':
        playSound('pickup');
        dispatch({ type: 'ADD_STRAW' });
        break;
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
    if (quick) return this.sendToolToCup(station);
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
  private sendToolToCup(station: Station) {
    const flier = this.tool;
    const layout = this.layout;
    if (!flier || !layout) return;
    this.tool = null;
    this.toolTweens = [];
    const finishing = this.finishingTool;
    const s = this.toolState.size;
    const to = { x: this.cupPos.x + layout.cupW / 2, y: this.cupPos.y + layout.cupH * 0.12 + s * 0.1 };
    const duration = this.flightTime(to.x - flier.x, to.y - flier.y);
    const landed = () => {
      // Milk and cream are carried whole: the counter has its own back once this one is gone.
      if (this.held === station) this.holdStation(null);
      flier.destroy();
    };
    this.tweens.add({
      targets: flier, x: to.x, y: to.y, duration, ease: EASE,
      onComplete: () => this.tweens.add({
        targets: flier, alpha: 0, duration: 430, ease: EASE,
        rotation: finishing ? 0 : Phaser.Math.DegToRad(118),
        onComplete: landed,
      }),
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
      this.tweens.add({ targets: this.toolState, show: 0, delay: DURATION.base, duration: 1 }),
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
      nudge('Đổ bỏ ly đang pha trước khi lấy ly mới');
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

    // The cycle pauses with the shop. No delayed callback can lid a discarded or replaced cup.
    const state = store.state;
    if (state.build.inLidder && !this.lidderLoading) {
      if (this.docked()?.kind !== 'lid') this.restoreLidderCup();
      const machine = this.docked();
      if (machine) this.cupPos.x = machine.cx - this.pan - layout.cupW * this.cupPos.scale / 2;
      if (state.phase === 'playing' && !state.paused && !uiState.value.opening) {
        this.lidderElapsed += Math.min(delta, 50);
      }
      const progress = Math.min(1, this.lidderElapsed / 1100);
      const press = Math.sin(progress * Math.PI);
      const head = ROOM_BG_LIDDING.head;
      const rimY = this.cupPos.y + layout.cupH * this.cupPos.scale * 16 / CUP_ART.h;
      const stroke = Math.max(0, rimY - layout.room.top - (head.y + head.height) * layout.room.scale);
      this.lidderHead?.setVisible(true).setPosition(head.x * layout.room.scale - this.pan,
        layout.room.top + head.y * layout.room.scale + press * stroke);
      if (progress >= 1) {
        dispatch({ type: 'LID_CUP' });
        this.lidderHead?.setVisible(false);
        this.lidderElapsed = 0;
        playSound('cupDown');
        this.standCupDown();
      }
    } else this.lidderHead?.setVisible(false);

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
        if (this.held) this.holdStation(null);
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

