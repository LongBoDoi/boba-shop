import { CupSize, CUP_SIZE_SCALE, Drink, getIngredient } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import {
  ART,
  ROOM_BG_CUP_HOLDER,
  ROOM_BG_CUP_STATION,
  ROOM_BG_EXTRAS,
  ROOM_BG_ICE_MACHINE,
  ROOM_BG_SIZE,
  ROOM_BG_TABLE,
  ROOM_BG_TEA_SHELF,
  ROOM_BG_TOPPING_SHELF,
  TEA_DISPENSER_ART,
} from '../art/kitchenArt';
import { toppingPanBounds, ToppingPanShape } from '../art/toppingGeometry';
import { CUP_ART, CUP_FOOT } from '../art/cupGeometry';

/**
 * Where everything in the kitchen goes — ported from `KitchenStation.tsx` (`layoutKitchen`,
 * `cupSizeFor`) and `KitchenRoom.tsx` (`kitchenHolderFor`), reading the same measurements of the
 * painted room in `kitchenArt.ts`. All in CSS pixels of the kitchen's own area; `x` of anything
 * mounted in the room is in the panorama's coordinates (before it is panned).
 */
export type StationKind = 'tea' | 'milk' | 'topping' | 'ice' | 'sugar' | 'foam';

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
  return { scale, drawnWidth, drawnHeight, top: (height - drawnHeight) / 2 };
}

export function kitchenTableFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  return { top: top + ROOM_BG_TABLE.top * scale, base: top + ROOM_BG_TABLE.base * scale };
}

/** The mat keeps the painting's size and height; only its x is the screen's (centred). */
export function kitchenHolderFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  const holderWidth = ROOM_BG_CUP_HOLDER.width * scale;
  return {
    left: (width - holderWidth) / 2,
    top: top + ROOM_BG_CUP_HOLDER.y * scale,
    width: holderWidth,
    height: ROOM_BG_CUP_HOLDER.height * scale,
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
    const option = kind === 'ice' || kind === 'sugar' ? undefined : getIngredient(categoryOf(kind), id);
    const base = top + (y + h) * scale;
    const dockScale = Math.min(1, Math.max(0.7, 44 / cupW));
    stations.push({
      key: `${kind}-${id}`, kind, id, name: option?.name ?? (kind === 'ice' ? 'Đá' : 'Đường'),
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
  extras.filter((item) => item.kind === 'milk').forEach(({ kind, id }, i) => {
    const w = extrasArt.milkWidth;
    const h = extrasArt.milkHeight;
    add(kind, id, extrasArt.milkCenters[i] - w / 2, extrasArt.milkBase - h, w, h);
  });
  if (config.categories.includes('sweetness')) {
    const jar = extrasArt.sugar;
    add('sugar', 'sugar', jar.x, jar.y, jar.width, jar.height);
  }
  extras.filter((item) => item.kind === 'foam').forEach(({ kind, id }, i) => {
    const w = extrasArt.foamWidth;
    const h = w / ART.foam;
    add(kind, id, extrasArt.foamCenters[i] - w / 2, extrasArt.foamBase - h, w, h);
  });
  if (config.categories.includes('ice')) {
    const ice = ROOM_BG_ICE_MACHINE;
    add('ice', 'ice', ice.x, ice.y, ice.width, ice.height);
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

export function hintFor(cup: Drink, docked?: Station): string {
  if (!cup.size) return 'Chạm ly đúng cỡ khách gọi trên kệ — hoặc kéo lên thảm';
  if (docked) {
    if (cup.tea && cup.tea !== docked.id) return 'Ly đã có trà khác — đổ bỏ để pha lại';
    return `Giữ vòi ${docked.name} để rót — xem thanh lượng trà`;
  }
  if (!cup.tea) return 'Chạm bình trà để đặt ly dưới vòi, rồi giữ vòi để rót';
  return 'Chạm topping, đá, đường… hoặc kéo thẳng vào ly';
}
