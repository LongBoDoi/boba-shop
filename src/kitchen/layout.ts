import { CupSize, CUP_SIZE_SCALE, Drink, getIngredient } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { CupBuild } from '../game/reducer';
import {
  ART,
  ROOM_BG_CUP_HOLDER,
  ROOM_BG_CUP_STATION,
  ROOM_BG_EXTRAS,
  ROOM_BG_FOCUS_Y,
  ROOM_BG_ICE_MACHINE,
  ROOM_BG_LIDDING,
  ROOM_BG_SIZE,
  ROOM_BG_TABLE,
  ROOM_BG_TEA_SHELF,
  ROOM_BG_TOPPING_SHELF,
  TEA_DISPENSER_ART,
} from '../art/kitchenArt';
import { toppingPanBounds, ToppingPanShape } from '../art/toppingGeometry';
import { MILK_CARTON_ART } from '../art/kitchenEquipment';
import { CUP_ART, CUP_FOOT } from '../art/cupGeometry';

/**
 * Where everything in the kitchen goes — ported from `KitchenStation.tsx` (`layoutKitchen`,
 * `cupSizeFor`) and `KitchenRoom.tsx` (`kitchenHolderFor`), reading the same measurements of the
 * painted room in `kitchenArt.ts`. All in CSS pixels of the kitchen's own area; `x` of anything
 * mounted in the room is in the panorama's coordinates (before it is panned).
 */
export type StationKind = 'tea' | 'milk' | 'topping' | 'ice' | 'sugar' | 'foam' | 'lid' | 'straw';

export interface Station {
  key: string;
  kind: StationKind;
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  slot: number;
  labelW: number;
  base: number;
  spout: number;
  dockY: number;
  dockScale: number;
  panShape?: ToppingPanShape;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  panShape?: ToppingPanShape;
}

export interface KitchenLayout {
  stations: Station[];
  emptyBins: Box[];
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
  /** The painting, as drawn: `cover` of the kitchen's height, panned horizontally. */
  room: { scale: number; top: number; width: number; height: number; maxPan: number };
  holder: { left: number; top: number; width: number; height: number };
  /** The three stacks of cups in the rack, in room coordinates. */
  rack: { size: CupSize; x: number; y: number; w: number; h: number }[];
}

/** Shared projection for the painting and everything anchored to its surfaces. */
export function fitBackground(width: number, height: number, imageWidth: number, imageHeight: number) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;
  const focus = imageWidth === ROOM_BG_SIZE.width && imageHeight === ROOM_BG_SIZE.height
    ? ROOM_BG_FOCUS_Y : imageHeight / 2;
  const top = Math.min(0, Math.max(height - drawnHeight, height / 2 - focus * scale));
  return { scale, drawnWidth, drawnHeight, top };
}

export function kitchenTableFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  return { top: top + ROOM_BG_TABLE.top * scale, base: top + ROOM_BG_TABLE.base * scale };
}

/** One shared mat sits on the clear worktop, with room around the largest cup's base. */
export function kitchenHolderFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  // Leave the left-hand syrup tray clear even when the room is panned fully left.
  const trayRight = (ROOM_BG_EXTRAS.sugar.x + ROOM_BG_EXTRAS.sugar.width) * scale + 10;
  const holderWidth = Math.min(width - trayRight - 30,
    Math.max(ROOM_BG_CUP_HOLDER.width * scale, cupSizeFor(width, height, 'L').width * 1.35));
  const holderHeight = holderWidth * ROOM_BG_CUP_HOLDER.height / ROOM_BG_CUP_HOLDER.width;
  const front = Math.min(height - 12, top + (ROOM_BG_TABLE.base - 32) * scale);
  return {
    left: Math.max(trayRight + 14, (width - holderWidth) / 2),
    top: Math.min(top + ROOM_BG_CUP_HOLDER.y * scale, front - holderHeight),
    width: holderWidth,
    height: holderHeight,
  };
}

/** A cup's size follows the depth of the painted work top, not the screen. */
export function cupSizeFor(W: number, H: number, size: CupSize = 'M') {
  const table = kitchenTableFor(W, H);
  const width = Math.round(Math.max(56, Math.min(150, W * 0.19, (table.base - table.top) * 0.58)) * CUP_SIZE_SCALE[size]);
  return { width, height: Math.round(width / ART.cup) };
}

function categoryOf(kind: StationKind) {
  return kind === 'topping' ? 'toppings' : kind === 'tea' ? 'tea' : kind === 'milk' ? 'milk' : 'foam';
}

export function layoutKitchen(config: DayConfig, W: number, H: number, size: CupSize = 'M'): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H, size);
  const { scale, top, drawnWidth, drawnHeight } = fitBackground(W, H, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  const stations: Station[] = [];
  const emptyBins: Box[] = [];
  const add = (kind: StationKind, id: string, x: number, y: number, w: number, h: number) => {
    const option = ['ice', 'sugar', 'lid', 'straw'].includes(kind) ? undefined : getIngredient(categoryOf(kind), id);
    const base = top + (y + h) * scale;
    const dockScale = Math.min(1, Math.max(0.7, 44 / cupW));
    stations.push({
      key: `${kind}-${id}`, kind, id, name: option?.name ?? ({ ice: 'Đá', sugar: 'Đường', lid: 'Máy đậy nắp', straw: 'Ống hút' }[kind as 'ice' | 'sugar' | 'lid' | 'straw']),
      color: option?.color ?? '#D8B774', x: x * scale, y: top + y * scale,
      w: w * scale, h: h * scale, cx: (x + w / 2) * scale,
      slot: Math.max(44, w * scale), labelW: Math.max(44, w * scale), base,
      spout: h * scale * 0.96,
      dockY: base + cupH * dockScale + 6 * scale,
      dockScale,
    });
  };

  const shelf = ROOM_BG_TEA_SHELF;
  const slot = (shelf.x1 - shelf.x0) / 3;
  shelf.slots.forEach((id, i) => {
    if (!config.options.tea.includes(id)) return;
    const w = shelf.tankWidth;
    const h = w * TEA_DISPENSER_ART.height / TEA_DISPENSER_ART.width;
    add('tea', id, shelf.x0 + (i % 3 + 0.5) * slot - w / 2,
      shelf.bases[Math.floor(i / 3)] - h * TEA_DISPENSER_ART.foot, w, h);
    stations[stations.length - 1].spout = h * scale * TEA_DISPENSER_ART.spout;
    stations[stations.length - 1].slot = Math.max(44, slot * scale);
  });

  const toppings = ROOM_BG_TOPPING_SHELF;
  toppings.slots.forEach((id, i) => {
    const row = Math.floor(i / 3);
    const bin = toppingPanBounds(toppings.edges[row], toppings.edges[row + 1], i % 3);
    if (config.options.toppings.includes(id)) {
      add('topping', id, bin.x, bin.y, bin.w, bin.h);
      stations[stations.length - 1].panShape = bin.shape;
    } else emptyBins.push({ x: bin.x * scale, y: top + bin.y * scale, w: bin.w * scale, h: bin.h * scale, panShape: bin.shape });
  });

  const extras: { kind: Exclude<StationKind, 'ice'>; id: string }[] = [
    ...(config.categories.includes('milk') ? [{ kind: 'milk' as const, id: 'whole' }, { kind: 'milk' as const, id: 'oat' }] : []),
    ...(config.categories.includes('sweetness') ? [{ kind: 'sugar' as const, id: 'sugar' }] : []),
    ...(config.categories.includes('foam') ? [{ kind: 'foam' as const, id: 'cheese' }, { kind: 'foam' as const, id: 'brulee' }] : []),
  ];
  const extrasArt = ROOM_BG_EXTRAS;
  // All containers follow the counter's perspective and room scale, including in landscape.
  for (const kind of ['milk', 'foam'] as const) {
    const milk = kind === 'milk';
    const centers = milk ? extrasArt.milkCenters : extrasArt.foamCenters;
    const w = milk ? extrasArt.milkWidth : extrasArt.foamWidth;
    const h = milk ? extrasArt.milkHeight : extrasArt.foamHeight;
    const foot = milk ? MILK_CARTON_ART.foot / MILK_CARTON_ART.height : 1;
    const bases = milk ? extrasArt.milkBases : extrasArt.foamBases;
    extras.filter(item => item.kind === kind).forEach((item, i) => {
      add(kind, item.id, centers[i] - w / 2, bases[i] - h * foot, w, h);
    });
  }
  if (config.categories.includes('sweetness')) {
    const tray = extrasArt.sugar;
    add('sugar', 'sugar', tray.x, tray.y, tray.width, tray.height);
  }
  if (config.categories.includes('ice')) {
    const ice = ROOM_BG_ICE_MACHINE;
    add('ice', 'ice', ice.x, ice.y, ice.width, ice.height);
  }
  for (const kind of ['lid', 'straw'] as const) {
    const area = ROOM_BG_LIDDING[kind];
    add(kind, kind, area.x, area.y, area.width, area.height);
    if (kind === 'lid') {
      const machine = stations[stations.length - 1];
      machine.cx = ROOM_BG_LIDDING.bay.cx * scale;
      machine.dockScale = Math.min(1, 108 * scale * CUP_SIZE_SCALE[size] / cupH);
      machine.dockY = top + ROOM_BG_LIDDING.bay.foot * scale
        + cupH * machine.dockScale * (1 - CUP_FOOT / CUP_ART.h);
    }
  }

  // The rack of cups is painted into the room; these are the three stacks' touch targets.
  const rackArt = ROOM_BG_CUP_STATION;
  const rack = (['S', 'M', 'L'] as CupSize[]).map((cupSize, index) => {
    const stackTop = rackArt.stackTops[index];
    return {
      size: cupSize,
      x: (rackArt.x + rackArt.width * index / 3) * scale,
      y: top + stackTop * scale,
      w: Math.max(44, rackArt.width / 3 * scale),
      h: Math.max(44, (rackArt.y + rackArt.height - stackTop) * scale),
    };
  });

  const holder = kitchenHolderFor(W, H);
  return {
    stations, emptyBins, cupW, cupH,
    homeX: holder.left + (holder.width - cupW) / 2,
    homeY: holder.top + holder.height / 2 - cupH * CUP_FOOT / CUP_ART.h,
    room: { scale, top, width: drawnWidth, height: drawnHeight, maxPan: Math.max(0, drawnWidth - W) },
    holder,
    rack,
  };
}

/** A visible tap directly above the released cup, accounting for the pan. */
export function findStation(stations: Station[], x: number, y: number, cupW: number, cupH: number, offset: number, width: number): Station | null {
  let best: Station | null = null;
  let score = Infinity;
  for (const station of stations) {
    if (station.kind === 'lid') {
      const cx = x + cupW / 2 + offset;
      const cy = y + cupH / 2;
      if (cx >= station.x && cx <= station.x + station.w
        && cy >= station.y + station.h * 0.4 && cy <= station.base) return station;
      continue;
    }
    if (station.kind !== 'tea') continue;
    const cx = station.cx - offset;
    if (cx < cupW / 2 || cx > width - cupW / 2) continue;
    const dx = Math.abs(x + cupW / 2 - cx) / (station.slot / 2);
    const targetTop = station.dockY - cupH * station.dockScale;
    const dy = Math.min(Math.abs(y - targetTop), Math.abs(y + cupH - station.dockY)) / (cupH * 0.65);
    if (dx <= 1 && dy <= 1 && dx + dy < score) { best = station; score = dx + dy; }
  }
  return best;
}

export function hintFor(cup: Drink, docked?: Station, build?: CupBuild): string {
  if (!cup.size) return 'Vuốt ngang để tìm kệ, chọn ly đúng cỡ khách gọi';
  if (build?.inLidder) return 'Máy đang đậy nắp — đợi ly trở lại thảm rồi thêm ống hút';
  if (build?.straw) return 'Đã đậy nắp và thêm ống hút — sẵn sàng phục vụ';
  if (build?.lidded) return 'Thêm ống hút từ hộp bên cạnh máy đậy nắp';
  if (docked) {
    if (cup.tea && cup.tea !== docked.id) return 'Ly đã có trà khác — đổ bỏ để pha lại';
    return `Giữ vòi ${docked.name} để rót — xem thanh lượng trà`;
  }
  if (!cup.tea) return 'Chạm bình trà để đặt ly dưới vòi, rồi giữ vòi để rót';
  return 'Pha xong? Kéo ly vào máy đậy nắp bên phải';
}
