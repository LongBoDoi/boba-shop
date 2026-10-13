import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderHandlers, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  CategoryId,
  Drink,
  getIngredient,
  MAX_ICE_SCOOPS,
  MILK_SPLASH,
  SUGAR_STEPS,
  Topping,
} from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { CupBuild } from '../game/reducer';
import { DURATION, ease, timing } from '../motion';
import { colors, fonts } from '../theme';
import { fitRoom, KitchenRoom, kitchenTableFor, Shadow, SHOP } from './art/KitchenRoom';
import {
  ART,
  BIN,
  BIN_EMPTY,
  BIN_HEAD,
  COASTER_WIDTH_RATIO,
  FOAM,
  ICE_PAN,
  ROOM_BG_SIZE,
  ROOM_BG_TEA_SHELF,
  TEA_TANK_ART,
  MILK,
  PIECE,
  PIECE_ART,
  ROOM,
  SCOOP,
  SCOOP_ART,
  SCOOP_BOWL,
  SCOOPFUL,
  SYRUP,
} from './art/kitchenArt';
import { KitchenCup } from './KitchenCup';
import { CupContactShadow, PourMeterState } from './PourFeedback';
import { GRABBY, Spill, Stream, useHoldPour } from './pour';
import { TankGraphic } from './TeaLiquid';
import { TeaTankMount } from './art/TeaTankMount';
import { fitBackground } from './art/PannableBackground';
import { pointerEventsStyles } from '../pointerEvents';

// --------------------------------------------------------------------------- layout

type StationKind = 'tea' | 'milk' | 'topping' | 'ice' | 'sugar' | 'foam';

interface Station {
  key: string;
  kind: StationKind;
  /** Ingredient id ('black', 'pearls', 'whole'…); the one-of-a-kind machines use their kind. */
  id: string;
  name: string;
  color: string;
  /** Box the equipment is drawn in. */
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  /** Full width of this station's column — the touch target and the name under it. */
  slot: number;
  /** How wide the plaque under it may get. */
  labelW: number;
  /** Which row of the kitchen it stands in; a row may scroll sideways as a whole. */
  row: number;
  /** Line the equipment stands on. */
  base: number;
  /** Where liquid leaves it, measured inside the box. */
  spout: number;
  /** Where the cup's bottom goes while you hold this tap open. */
  dockY: number;
  dockScale?: number;
  mount?: number;
}

/** A row of equipment, and whether there is more of it than the room is wide. */
export interface RowStrip {
  scroll: boolean;
  /** How wide the row's contents are altogether. */
  span: number;
}

/** A row the player can swipe along, and how far it may go. */
interface PanRow {
  offset: SharedValue<number>;
  min: number;
  onHold: (held: boolean) => void;
}

/** A place on the topping tray the week has not reached yet, which an empty bin stands in. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KitchenLayout {
  stations: Station[];
  strips: RowStrip[];
  /** The places on the topping tray with nothing in them yet, back row first. */
  emptyBins: Box[];
  /** Where a cup stands on the work top through the middle of the room. */
  tableLine: number;
  /** Where the pink units at the foot of the room start. */
  cabinetTop: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/** The ice pan is drawn wider than it is tall; everything else keeps its own art's shape. */
const widened = (kind: StationKind) => kind === 'ice';

/**
 * How the six topping bins stand in their cubby. `across` is how many to a row and `pitch` the
 * step from one to the next across, as a share of a bin's width — just under 1, read off
 * `tools/sheets/topping-bins.png`, which draws them shoulder to shoulder the way a topping bar's
 * are. How far the front row stands in front of the back one is **not** a number here: the two
 * rows simply divide the depth `ROOM.tray` gives them, so they fill the cubby the plate paints
 * however deep it is. `LEAN` is the most they may be pushed together if that depth is ever too
 * little for two trays to both stay in view.
 */
const BIN_GRID = { across: 3, pitch: 0.995 };
/** The least a row may stand in front of the one behind it, as a share of a tray's own depth. */
const LEAN = 0.55;

/** How wide a piece of equipment may get, as a fraction of the room's width. */
const MAX_WIDTH: Record<StationKind, number> = {
  tea: 0.26,
  milk: 0.21,
  // toppings are sized by the bin they stand in, not by the room
  topping: 0.4,
  ice: 0.3,
  sugar: 0.17,
  foam: 0.23,
};

/** How wide each piece of equipment is relative to its height. */
const ASPECT: Record<StationKind, number> = {
  tea: ART.jar,
  milk: ART.milk,
  topping: ART.pan,
  ice: ART.pan,
  sugar: ART.syrup,
  foam: ART.foam,
};


const EQUIPMENT_NAMES: Record<string, string> = {
  ice: 'Đá',
  sugar: 'Đường',
};

/** Size the cup and its holder to the flat countertop in the new background. */
export function cupSizeFor(W: number, H: number) {
  const table = kitchenTableFor(W, H);
  // Leave room for the holder's front rim and shadow, both of which extend past the cup's feet.
  const holderHeight = (table.base - table.top) * 0.75;
  const width = Math.round(Math.max(40, Math.min(80, W * 0.2, holderHeight * ART.coaster / COASTER_WIDTH_RATIO)));
  // The cup sprite is this much taller than it is wide.
  const height = Math.round(width / ART.cup);
  return { width, height };
}

/**
 * The surfaces the painting gives us to stand things on, top to bottom: the open shelf across
 * the top, the ledge in front of the fridge, and the bench nearer the viewer. Nothing is spread
 * to fill the room any more — the room has already decided where its shelves are, and each row
 * of equipment takes the next one down. `ceiling` is what that row has to fit under.
 */
const LEVELS = [
  { base: ROOM.shelf.base, ceiling: ROOM.shelf.top, x0: ROOM.shelf.x0, x1: ROOM.shelf.x1 },
  { base: ROOM.ledge.base, ceiling: ROOM.ledge.top, x0: 0, x1: ROOM.width },
  { base: ROOM.bench.base, ceiling: ROOM.table.base, x0: 0, x1: ROOM.width },
];

/**
 * Arrange the kitchen on the surfaces the room is painted with: the tea dispensers in the open
 * shelf at the top, the toppings on the ledge, the rest of the equipment on the bench in front
 * of the work top, and the cup on its coaster in the middle of that work top. Each dispenser
 * gets a **dock**: the spot the cup is held while that tap runs into it.
 */
export function layoutKitchen(config: DayConfig, W: number, H: number): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H);
  const { px, py } = fitRoom(W, H);

  const has = (c: CategoryId) => config.categories.includes(c);
  const rows: { id: string; kind: StationKind }[][] = [
    config.options.tea.map((id) => ({ id, kind: 'tea' as StationKind })),
    config.options.toppings.map((id) => ({ id, kind: 'topping' as StationKind })),
    [
      ...(has('ice') ? [{ id: 'ice', kind: 'ice' as StationKind }] : []),
      ...(has('sweetness') ? [{ id: 'sugar', kind: 'sugar' as StationKind }] : []),
      ...(has('milk') ? ['whole', 'oat'].map((id) => ({ id, kind: 'milk' as StationKind })) : []),
      ...(has('foam') ? ['cheese', 'brulee'].map((id) => ({ id, kind: 'foam' as StationKind })) : []),
    ],
  ].filter((row) => row.length > 0);

  const stations: Station[] = [];
  const strips: RowStrip[] = [];
  const emptyBins: Box[] = [];

  rows.forEach((items, r) => {
    const kind = items[0].kind;
    if (kind === 'topping') {
      fillBins(items, r, px, py, stations, emptyBins);
      strips.push({ scroll: false, span: 0 });
      return;
    }

    if (kind === 'tea') {
      const background = fitBackground(W, H, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
      const shelf = ROOM_BG_TEA_SHELF;
      const slot = (shelf.x1 - shelf.x0) * background.scale / Math.max(shelf.capacity, items.length);
      const w = Math.min(shelf.tankWidth * background.scale, slot - 8 * background.scale);
      const h = w * TEA_TANK_ART.height / TEA_TANK_ART.width;
      const base = background.top + shelf.bottom * background.scale;
      const y = background.top + shelf.mount * background.scale - h * TEA_TANK_ART.collar;
      const spout = h * TEA_TANK_ART.spout;
      const dockHeight = base - (y + spout + 6 * background.scale);
      const dockScale = Math.min(1, dockHeight / cupH);
      items.forEach((item, i) => {
        const option = getIngredient('tea', item.id)!;
        const cx = shelf.x0 * background.scale + (i + 0.5) * slot;
        stations.push({ key: `tea-${item.id}`, kind: 'tea', id: item.id,
          name: option.name, color: option.color, row: r,
          x: cx - w / 2, y, w, h, cx, slot, labelW: w, base, spout,
          dockY: base, dockScale, mount: background.top + shelf.mount * background.scale });
      });
      strips.push({ scroll: false, span: background.drawnWidth });
      return;
    }

    const level = LEVELS[Math.min(r, LEVELS.length - 1)];

    const base = Math.round(py(level.base));
    // The plaque hangs below the surface, so all of this is the box's: what the shelf above
    // leaves it.
    const headroom = base - Math.round(py(level.ceiling));
    const left = Math.round(px(level.x0));
    const w = Math.min(W * MAX_WIDTH[kind], headroom * ASPECT[kind]);
    const h = Math.round(w / ASPECT[kind]);

    // One height for the whole row, and each box as wide as its own art — so a bottle stays a
    // bottle and a carton a carton, instead of every one of them taking the first one's shape.
    const widths = items.map((item) =>
      Math.round(h * ASPECT[item.kind]),
    );
    const slots = items.map((item, i) => widened(item.kind)
      ? widths[i] : Math.max(widths[i], Math.round(W * 0.2)));
    const span = slots.reduce((sum, slot) => sum + slot, 0);
    // Everything starts hard against the left of what it stands on: the counters then run off the
    // right if they have to, and the shelf leaves the places the day has not reached yet bare.
    let x = left;

    items.forEach((item, i) => {
      const slot = Math.round(slots[i]);
      const cx = Math.round(x + slots[i] / 2);
      x += slots[i];
      const option =
        item.kind === 'ice' || item.kind === 'sugar' ? undefined : getIngredient(categoryOf(item.kind), item.id);
      stations.push({
        key: `${item.kind}-${item.id}`,
        kind: item.kind,
        id: item.id,
        name: option?.name ?? EQUIPMENT_NAMES[item.id] ?? item.id,
        color: option?.color ?? colors.sky,
        row: r,
        x: cx - Math.round(widths[i] / 2),
        y: base - h,
        w: widths[i],
        h,
        cx,
        slot,
        // Wide enough for a short name to stay whole even on a narrow bottle — a plaque held to
        // the width of its box would break "Đường" across two lines.
        labelW: Math.max(slot - 2, 70),
        base,
        spout: Math.round(h * 0.2),
        dockY: base + cupH + 8,
      });
    });

    strips.push({ scroll: span > W, span });
  });

  const table = kitchenTableFor(W, H);
  const tableLine = (table.top + table.base) / 2;
  return {
    stations,
    strips,
    emptyBins,
    tableLine,
    cabinetTop: Math.round(py(ROOM.cabinets)),
    cupW,
    cupH,
    homeX: (W - cupW) / 2,
    homeY: tableLine - cupH,
  };
}


/**
 * Stand the day's toppings on their tray under the fridge. There is no furniture to place and
 * nothing to assemble: a topping is one whole painted bin — tray, what is in it and the scoop
 * standing in it — and the six are laid out in the grid their own sheet draws them in
 * (`BIN_GRID`), sized to the run `ROOM.tray` gives them and stood on its front line.
 *
 * Nothing about a bin depends on the day — it is the same size with two toppings as with six, the
 * way a dispenser is the same size on day one as on day seven. What a short day changes is
 * *which* bins are used: up to three stand in the **front** row, which is the nearer and the
 * easier to reach, and the rest fill from the back. A row that does not fill its three sits as
 * near its middle as three bins allow.
 *
 * The back row is pushed first, so the front row is drawn over it where the two meet — which is
 * what a second row standing behind a first one looks like anyway.
 */
function fillBins(
  items: { id: string; kind: StationKind }[],
  row: number,
  px: (x: number) => number,
  py: (y: number) => number,
  stations: Station[],
  emptyBins: Box[],
): void {
  const { across } = BIN_GRID;
  // The tray holds six and there is nowhere to put a seventh, so a day that somehow brought more
  // would show the first six.
  const day = items.slice(0, across * 2);
  const back = Math.max(0, day.length - across);
  // the back row first, so the front row is drawn over it
  const bands = [day.slice(0, back), day.slice(back)];

  const run = px(ROOM.tray.x1) - px(ROOM.tray.x0);
  const w = Math.round(run / (1 + (across - 1) * BIN_GRID.pitch));
  const h = Math.round(w / ART.bin);
  // the tray alone, without the scoop standing over the back of it
  const deep = h * (1 - BIN_HEAD);
  const foot = Math.round(py(ROOM.tray.base));
  // The two rows divide the cubby's own depth: the back row's trays start at its ceiling and the
  // front row's end at the lip of its floor, so the bins fill it rather than sitting in it.
  const step = Math.max(Math.round(deep * LEAN), Math.round(foot - py(ROOM.tray.top) - deep));

  bands.forEach((band, r) => {
    // A row that does not fill its three sits as near the middle as three bins allow: one topping
    // takes the middle bin, two the left and the middle.
    const first = Math.floor((across - band.length) / 2);
    const base = foot - (1 - r) * step;
    const at = (c: number) => Math.round(px(ROOM.tray.x0) + c * w * BIN_GRID.pitch);
    // The places this row has nothing for. They are collected row by row, so an empty bin in the
    // back row is laid down before the front row's — and because a row only reaches the back one
    // once the front is full, a bin is never drawn over an empty one standing in front of it.
    for (let c = 0; c < across; c += 1) {
      if (c < first || c >= first + band.length) emptyBins.push({ x: at(c), y: base - h, w, h });
    }
    band.forEach((item, i) => {
      const option = getIngredient('toppings', item.id);
      const x = at(first + i);
      const y = base - h;
      stations.push({
        key: `${item.kind}-${item.id}`,
        kind: item.kind,
        id: item.id,
        name: option?.name ?? item.id,
        color: option?.color ?? colors.sky,
        row,
        x,
        y,
        w,
        h,
        cx: x + Math.round(w / 2),
        // The touch target is the sprite, scoop and all. The bins stand shoulder to shoulder, so
        // there is no dead steel between two of them; there is no plaque to leave room for either.
        slot: w,
        labelW: w,
        base,
        spout: Math.round(h * 0.2),
        dockY: base + h,
      });
    });
  });
}

function categoryOf(kind: StationKind) {
  return kind === 'topping' ? 'toppings' : kind === 'tea' ? 'tea' : kind === 'milk' ? 'milk' : 'foam';
}

// --------------------------------------------------------------------------- the station

interface KitchenStationProps {
  width: number;
  height: number;
  config: DayConfig;
  cup: Drink;
  build: CupBuild;
  cupId: number;
  onPour: (category: 'tea' | 'milk', optionId: string, amount: number) => void;
  onScoop: (category: 'toppings' | 'foam', optionId: string) => void;
  onIce: () => void;
  onSugar: () => void;
  /** The pager must stop swiping while something is being dragged around the kitchen. */
  onDragging: (dragging: boolean) => void;
  onMeterChange: (meter: PourMeterState | null) => void;
  /** Measured for the coin/toss effects. */
  cupRef: React.RefObject<View | null>;
}

/**
 * The kitchen you actually work in. Two gestures, both held in the hand:
 * - **drag the cup** up under a tea dispenser and **hold the tap** — how long you
 *   hold is how much runs in, with a floating meter showing the live amount;
 * - **drag a topping, a scoop of ice, the syrup bottle or a spoon of foam straight onto the cup**,
 *   wherever the cup happens to be standing.
 *
 * A cup already holding tea locks the other dispensers — tip it out to start over.
 */
export function KitchenStation({
  width: W,
  height: H,
  config,
  cup,
  build,
  cupId,
  onPour,
  onScoop,
  onIce,
  onSugar,
  onDragging,
  onMeterChange,
  cupRef,
}: KitchenStationProps) {
  const layout = useMemo(() => layoutKitchen(config, W, H), [config, W, H]);
  const { stations, strips, emptyBins, tableLine, cabinetTop, cupW, cupH, homeX, homeY } =
    layout;

  const cupX = useSharedValue(homeX);
  const cupY = useSharedValue(homeY);
  const cupScale = useSharedValue(1);
  /** The live liquid level, which a held-open tap drives straight past the committed fill. */
  const level = useSharedValue(build.fill);

  const panOffset = useSharedValue(0);
  const [interacting, setInteracting] = useState(false);
  const handleDragging = useCallback((held: boolean) => {
    setInteracting(held);
    onDragging(held);
  }, [onDragging]);
  const [dock, setDock] = useState<{ cupId: number; key: string | null }>({ cupId, key: null });
  const docked = dock.cupId === cupId ? stations.find((item) => item.key === dock.key) : undefined;
  const [pouring, setPouring] = useState<{ id: string; color: string; x: number; top: number; running: boolean } | null>(null);
  if (dock.cupId !== cupId) {
    setDock({ cupId, key: null });
    setPouring(null);
  }
  const pouringId = pouring?.id;
  // Prepare the selected tank's painted liquid while docking, before the first flowing frame.
  const previewTea = pouringId ?? docked?.id;
  const inCup = useMemo(() => previewTea ? { ...cup, tea: cup.tea ?? previewTea } : cup, [cup, previewTea]);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = Boolean(pouring?.running);
  useEffect(() => {
    onMeterChange(docked ? { level, color: docked.color, running } : null);
  }, [docked, level, running, onMeterChange]);
  useEffect(() => () => onMeterChange(null), [onMeterChange]);
  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);
  const nudge = useNudge();

  useEffect(() => {
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    cupScale.set(withTiming(1, timing()));
    if (returnTimer.current) clearTimeout(returnTimer.current);
    // A new cup starts empty, back on the table.
  }, [cupId, cupX, cupY, cupScale, homeX, homeY]);

  useEffect(() => {
    level.set(withTiming(build.fill, timing(DURATION.base)));
  }, [build.fill, cupId, level]);

  const cancelReturn = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);

  /** Send the cup back to its coaster, wherever it was left. */
  const standCupDown = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    setDock({ cupId, key: null });
    setPouring(null);
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    cupScale.set(withTiming(1, timing(DURATION.slow)));
  }, [cupId, cupX, cupY, cupScale, homeX, homeY]);

  const startPouring = (station: Station, running: boolean) => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    setPouring(running ? { id: station.id, color: station.color, running: true,
      x: station.cx - panOffset.get(), top: station.y + station.spout }
      : (previous) => previous ? { ...previous, running: false } : null);
    handleDragging(running);
    if (!running) returnTimer.current = setTimeout(standCupDown, 420);
  };

  const pan = useMemo(() => {
    const grab = { x: homeX, y: homeY };
    const settle = () => {
      handleDragging(false);
      const scale = cupScale.get();
      const found = findStation(stations, cupX.get(), cupY.get(), cupW * scale, cupH * scale, panOffset.get(), W);
      if (found) {
        setDock({ cupId, key: found.key });
        const scale = found.dockScale ?? 1;
        cupScale.set(withTiming(scale, timing(DURATION.base)));
        cupX.set(withTiming(found.cx - panOffset.get() - cupW * scale / 2, timing(DURATION.base)));
        cupY.set(withTiming(found.dockY - cupH * scale, timing(DURATION.base)));
      } else standCupDown();
    };
    // PanResponder stores these handlers; timer refs are read only when a gesture runs.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cancelReturn();
        setDock({ cupId, key: null });
        // Keep the cup's center beneath the finger while it grows back to its carrying size.
        const scale = cupScale.get();
        grab.x = cupX.get() - cupW * (1 - scale) / 2;
        grab.y = cupY.get() - cupH * (1 - scale) / 2;
        cupX.set(withTiming(grab.x, timing(DURATION.fast)));
        cupY.set(withTiming(grab.y, timing(DURATION.fast)));
        cupScale.set(withTiming(1, timing(DURATION.fast)));
        handleDragging(true);
      },
      onPanResponderMove: (_event, gesture) => {
        cupX.set(Math.max(-cupW * 0.15, Math.min(W - cupW * 0.85, grab.x + gesture.dx + cupW * (1 - cupScale.get()) / 2)));
        cupY.set(Math.max(-4, Math.min(H - cupH * 0.65, grab.y + gesture.dy + cupH * (1 - cupScale.get()) / 2)));
      },
      onPanResponderRelease: settle,
      onPanResponderTerminate: () => { handleDragging(false); standCupDown(); },
    });
  }, [stations, cupId, cupW, cupH, homeX, homeY, W, H, cupX, cupY, cupScale, panOffset, handleDragging, standCupDown, cancelReturn]);


  // The remaining equipment keeps its existing independent row gestures.
  const swipe = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  // A new day rearranges the counters, so anything swiped out of the way is brought back into
  // range — otherwise a row that no longer overflows would sit permanently off to one side.
  const spans = strips.map((strip) => strip.span).join();
  useEffect(() => {
    strips.forEach((strip, r) => {
      const min = Math.min(0, W - strip.span);
      swipe[r].set(strip.scroll ? Math.max(min, Math.min(0, swipe[r].get())) : 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spans, W]);

  const carry = useCarry({
    cup,
    build,
    maxToppings: config.maxToppings,
    cupX,
    cupY,
    cupW,
    cupH,
    homeX,
    homeY,
    onScoop,
    onIce,
    onSugar,
    onPour,
    onDragging: handleDragging,
    onNudge: nudge.show,
  });

  const cupStyle = useAnimatedStyle(() => ({
    // Compensate for React Native's center transform origin so cupX/Y stay its visible top-left.
    transform: [{ translateX: cupX.get() - cupW * (1 - cupScale.get()) / 2 },
      { translateY: cupY.get() - cupH * (1 - cupScale.get()) / 2 }, { scale: cupScale.get() }],
  }));

  const hint = nudge.text || hintFor(cup, docked);
  const shared = { cup, build, onNudge: nudge.show, carry };
  const matW = Math.round(cupW * COASTER_WIDTH_RATIO);

  return (
    <View style={StyleSheet.absoluteFill}>
      <KitchenRoom
        width={W}
        height={H}
        tableLine={tableLine}
        matX={(W - matW) / 2}
        matW={matW}
        panOffset={panOffset}
        scrollEnabled={!interacting}
        onPanBegin={standCupDown}
      >
        {stations.filter((station) => station.kind === 'tea').map((station) => (
          <TeaDispenser key={station.key} station={station} {...shared}
            active={docked?.key === station.key} level={level} onPour={onPour} onPouring={startPouring} />
        ))}
      </KitchenRoom>

      {/* The bins the week has not reached yet. They go down before the rows, so a bin the day
          does have is simply laid over the one standing where it goes. Wrapped rather than given
          `pointerEvents` of their own, which is not a prop on an Image. */}
      {emptyBins.length > 0 && (
        <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
          {emptyBins.map((bin) => (
            <Image
              key={`${bin.x}-${bin.y}`}
              source={BIN_EMPTY}
              style={{ position: 'absolute', left: bin.x, top: bin.y, width: bin.w, height: bin.h }}
            />
          ))}
        </View>
      )}

      {strips.map((strip, r) => {
        const row = stations.filter((station) => station.row === r && station.kind !== 'tea');
        if (!row.length) return null;
        const pan = strip.scroll ? { offset: swipe[r], min: W - strip.span, onHold: handleDragging } : undefined;
        const boxes = row.map((station) => {
          const props = { station, pan, ...shared };
          switch (station.kind) {
            case 'milk':
              return <MilkCarton key={station.key} {...props} />;
            case 'topping':
              return <ToppingBin key={station.key} {...props} max={config.maxToppings} />;
            case 'ice':
              return <IceChest key={station.key} {...props} />;
            case 'sugar':
              return <SyrupPump key={station.key} {...props} />;
            default:
              return <FoamTub key={station.key} {...props} />;
          }
        });
        return strip.scroll ? (
          <SwipeRow key={r} offset={swipe[r]}>
            {boxes}
          </SwipeRow>
        ) : (
          <View key={r} style={[StyleSheet.absoluteFill, pointerEventsStyles.boxNone]}>
            {boxes}
          </View>
        );
      })}

      {docked && <CupContactShadow cupX={cupX} cupY={cupY} cupScale={cupScale} cupW={cupW} cupH={cupH} />}
      {/* The cup grows in the hand and rests at the shelf's scale when docked. */}
      {pouring && <Stream {...pouring} cupY={cupY} cupH={cupH} cupScale={cupScale} level={level} side="back" />}
      <Animated.View
        ref={cupRef}
        {...pan.panHandlers}
        accessible
        accessibilityLabel="Ly đang pha — kéo tới vòi trà"
        style={[styles.cup, { width: cupW, height: cupH }, cupStyle]}
      >
        <FreshCup key={cupId} width={cupW} height={cupH}>
          <KitchenCup drink={inCup} width={cupW} height={cupH} level={level} pouring={Boolean(pouring?.running)} />
          {pouring && <Spill level={level} cupW={cupW} cupH={cupH} color={pouring.color} />}
        </FreshCup>
      </Animated.View>

      {carry.node}

      {pouring && <Stream {...pouring} cupY={cupY} cupH={cupH} cupScale={cupScale} level={level} side="front" />}

        <View
          style={[styles.hintRow, { top: Math.min(H - 22, cabinetTop + Math.max(3, (H - cabinetTop - 18) / 2)) }, pointerEventsStyles.none]}
        >
          <View style={styles.hint}>
            <Text style={styles.hintText} numberOfLines={2}>
              {hint}
            </Text>
          </View>
        </View>
    </View>
  );
}

/** Find a visible tap directly above the released cup, accounting for the panorama's pan. */
function findStation(stations: Station[], x: number, y: number, cupW: number, cupH: number, offset: number, width: number): Station | null {
  let best: Station | null = null;
  let score = Infinity;
  for (const station of stations) {
    if (station.kind !== 'tea') continue;
    const cx = station.cx - offset;
    if (cx < cupW / 2 || cx > width - cupW / 2) continue;
    const dx = Math.abs(x + cupW / 2 - cx) / (station.slot / 2);
    // The carried cup is full size; accept its mouth near the spout or its base near the shelf.
    const targetTop = station.dockY - cupH * (station.dockScale ?? 1);
    const dy = Math.min(Math.abs(y - targetTop), Math.abs(y + cupH - station.dockY)) / (cupH * 0.65);
    if (dx <= 1 && dy <= 1 && dx + dy < score) { best = station; score = dx + dy; }
  }
  return best;
}

function hintFor(cup: Drink, docked?: Station): string {
  if (docked) {
    if (cup.tea && cup.tea !== docked.id) return 'Ly đã có trà khác — đổ bỏ để pha lại';
    return `Giữ vòi ${docked.name} để rót — xem thanh lượng trà`;
  }
  if (!cup.tea) return 'Kéo ly dưới bình trà, rồi giữ vòi để rót';
  return 'Kéo topping, đá, đường… thả thẳng vào ly';
}

/** A short message that fades back to the normal hint. */
function useNudge() {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (message: string) => {
    setText(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(''), 1600);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { text, show };
}

/** Each new cup settles onto the table. */
function FreshCup({ children, width, height }: { children: ReactNode; width: number; height: number }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.set(withTiming(1, timing(DURATION.slow)));
  }, [appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * -10 }],
  }));
  return <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>;
}

// --------------------------------------------------------------------------- carrying things to the cup

interface Carry {
  /** Start carrying what this station holds; the gesture is owned by the station. */
  begin: (station: Station, offset?: number) => void;
  /** Put it straight back without a word — the gesture turned out to be a swipe. */
  cancel: () => void;
  move: (dx: number, dy: number) => void;
  drop: () => void;
  /** The thing in hand, drawn above everything else. */
  node: ReactNode;
}

/**
 * Toppings, ice, syrup and foam aren't fetched by moving the cup — you take a scoop of them and
 * drop it in. The station that was grabbed owns the gesture; this keeps what's in hand, draws it
 * following the finger, and on release either tips it into the cup or puts it back.
 */
function useCarry({
  cup,
  build,
  maxToppings,
  cupX,
  cupY,
  cupW,
  cupH,
  homeX,
  homeY,
  onScoop,
  onIce,
  onSugar,
  onPour,
  onDragging,
  onNudge,
}: {
  cup: Drink;
  build: CupBuild;
  maxToppings: number;
  cupX: SharedValue<number>;
  cupY: SharedValue<number>;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
  onScoop: KitchenStationProps['onScoop'];
  onIce: () => void;
  onSugar: () => void;
  onPour: KitchenStationProps['onPour'];
  onDragging: (dragging: boolean) => void;
  onNudge: (message: string) => void;
}): Carry {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const show = useSharedValue(0);
  const tip = useSharedValue(0);
  const [held, setHeld] = useState<Station | null>(null);
  const size = Math.round(cupW * 1.2);

  // Everything the drop needs to decide, kept fresh without rebuilding the gesture mid-drag.
  const latest = useRef({ cup, build, maxToppings, cupW, cupH, homeX, homeY, size, onScoop, onIce, onSugar, onPour, onNudge });
  useEffect(() => {
    latest.current = { cup, build, maxToppings, cupW, cupH, homeX, homeY, size, onScoop, onIce, onSugar, onPour, onNudge };
  });

  const origin = useRef({ x: 0, y: 0, station: null as Station | null });

  const begin = useCallback(
    (station: Station, offset = 0) => {
      origin.current = {
        // a row that has been swiped holds its equipment away from where the layout put it
        x: station.cx + offset - latest.current.size / 2,
        y: station.y + station.h * 0.1,
        station,
      };
      x.set(origin.current.x);
      y.set(origin.current.y);
      tip.set(0);
      show.set(1);
      setHeld(station);
      onDragging(true);
    },
    [x, y, tip, show, onDragging],
  );

  const move = useCallback(
    (dx: number, dy: number) => {
      x.set(origin.current.x + dx);
      y.set(origin.current.y + dy);
    },
    [x, y],
  );

  const cancel = useCallback(() => {
    x.set(withTiming(origin.current.x, timing(DURATION.fast)));
    y.set(withTiming(origin.current.y, timing(DURATION.fast)));
    show.set(withDelay(DURATION.fast, withTiming(0, { duration: 1 })));
    setHeld(null);
  }, [x, y, show]);

  const drop = useCallback(() => {
    onDragging(false);
    const station = origin.current.station;
    if (!station) return;
    const {
      cup: now,
      build: made,
      maxToppings: max,
      onScoop: scoop,
      onIce: ice,
      onSugar: sugar,
      onPour: tipIn,
      onNudge: nudge,
      size: s,
    } = latest.current;

    // Is the business end of the tool over the cup? The cup may still be gliding back to its mat,
    // so either where it is now or where it's heading counts.
    const px = x.get() + s / 2;
    const py = y.get() + s * 0.7;
    const overBox = (left: number, top: number) =>
      px > left - cupW * 0.45 && px < left + cupW * 1.45 && py > top - cupH * 0.35 && py < top + cupH * 1.1;
    const over = overBox(cupX.get(), cupY.get()) || overBox(latest.current.homeX, latest.current.homeY);

    const putBack = (message?: string) => {
      if (message) nudge(message);
      x.set(withTiming(origin.current.x, timing(DURATION.base)));
      y.set(withTiming(origin.current.y, timing(DURATION.base)));
      show.set(withDelay(DURATION.base, withTiming(0, { duration: 1 })));
    };

    if (!over) {
      // A tap that never went anywhere: say what to do with it.
      const moved = Math.abs(x.get() - origin.current.x) + Math.abs(y.get() - origin.current.y);
      putBack(moved < 8 ? `Kéo ${station.name.toLowerCase()} thả vào ly` : undefined);
      return;
    }

    switch (station.kind) {
      case 'topping':
        if (now.toppings.includes(station.id)) return putBack(`Ly đã có ${station.name}`);
        if (now.toppings.length >= max) return putBack(max === 1 ? 'Ly chỉ được 1 topping' : `Tối đa ${max} topping`);
        scoop('toppings', station.id);
        break;
      case 'foam':
        if (now.foam) return putBack('Ly đã có kem');
        scoop('foam', station.id);
        break;
      case 'milk':
        if (now.milk && now.milk !== station.id) return putBack('Ly đã có loại sữa khác');
        if (made.fill >= 1) return putBack('Ly đầy rồi — chừa chỗ cho sữa');
        tipIn('milk', station.id, MILK_SPLASH);
        break;
      case 'ice':
        if (made.iceScoops >= MAX_ICE_SCOOPS) return putBack('Đá đã đầy ly');
        ice();
        break;
      default:
        if (made.sugarPumps >= SUGAR_STEPS.length) return putBack('Ngọt tối đa rồi');
        sugar();
        break;
    }

    // Tip it in over the cup, then it's gone.
    tip.set(withTiming(1, { duration: 320, easing: ease }));
    show.set(withDelay(300, withTiming(0, { duration: 1 })));
  }, [x, y, show, tip, cupX, cupY, cupW, cupH, onDragging]);

  const style = useAnimatedStyle(() => ({
    opacity: show.value * (1 - tip.value * 0.85),
    transform: [
      { translateX: x.value },
      { translateY: y.value + tip.value * cupH * 0.12 },
      { rotate: `${interpolate(tip.value, [0, 1], [-6, 124])}deg` },
    ],
  }));

  const node = (
    <Animated.View style={[styles.carried, { width: size, height: size }, style, pointerEventsStyles.none]}>
      {held && <Tool station={held} size={size} />}
    </Animated.View>
  );

  return { begin, cancel, move, drop, node };
}

/** A row holding more equipment than the room is wide: swipe along it to reach the rest. */
function SwipeRow({ offset, children }: { offset: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style, pointerEventsStyles.boxNone]}>
      {children}
    </Animated.View>
  );
}

/** What a station puts in your hand: a scoopful, a carton, or the syrup bottle. */
function Tool({ station, size }: { station: Station; size: number }) {
  const S = size;
  if (station.kind === 'sugar') {
    return <Image source={SYRUP} style={{ width: S * 0.62, height: (S * 0.62) / ART.syrup }} />;
  }
  if (station.kind === 'milk') {
    return <Image source={MILK[station.id] ?? MILK.whole} style={{ width: S * 0.7, height: (S * 0.7) / ART.milk }} />;
  }
  // A scoop of topping is one painted sprite, heap and all. It used to be the bare `SCOOP` with
  // pieces laid into its bowl by hand, which is the same mistake the teas were: the design draws
  // what a scoop of this looks like, so take its word for it. They are drawn to a common
  // **height**, because the scoop is the same in all six and only what mounds over the bowl
  // differs — matched on width instead, a heaped one shrinks beside a flat one.
  if (station.kind === 'topping') {
    const full = SCOOPFUL[station.id];
    if (full) {
      const SH = S / ART.scoop;
      return <Image source={full} style={{ width: SH * (SCOOP_ART[station.id] ?? 0.86), height: SH }} />;
    }
  }

  // Ice and foam still take the empty scoop, with what they are drawn into its bowl.
  const SH = S / ART.scoop;
  const bowl = { x: S * SCOOP_BOWL.cx, y: SH * SCOOP_BOWL.cy, r: S * SCOOP_BOWL.r };
  const piece = PIECE.ice;
  // a small heap, wider than it is tall — the bowl is a shallow one
  const spread = [
    [-0.46, 0.06],
    [0.46, 0.08],
    [0, -0.3],
  ];
  const r = bowl.r * 0.62;

  return (
    <View style={{ width: S, height: SH }}>
      <Image source={SCOOP} style={{ position: 'absolute', left: 0, top: 0, width: S, height: SH }} />
      {station.kind === 'foam' ? (
        <View
          style={{
            position: 'absolute',
            left: bowl.x - bowl.r,
            top: bowl.y - bowl.r * 0.95,
            width: bowl.r * 2,
            height: bowl.r * 1.5,
            borderRadius: bowl.r,
            backgroundColor: station.color,
            borderWidth: 1.4,
            borderColor: SHOP.ink,
          }}
        />
      ) : (
        spread.map(([fx, fy], i) => (
          <Image
            key={i}
            source={piece}
            style={{
              position: 'absolute',
              left: bowl.x + fx * bowl.r - r,
              top: bowl.y + fy * bowl.r - r / PIECE_ART.ice,
              width: r * 2,
              height: (r * 2) / PIECE_ART.ice,
            }}
          />
        ))
      )}
    </View>
  );
}

// --------------------------------------------------------------------------- equipment shell

interface EquipProps {
  station: Station;
  cup: Drink;
  build: CupBuild;
  onNudge: (message: string) => void;
  carry: Carry;
  /** Set when this row holds more than the room is wide, so it can be swiped along. */
  pan?: PanRow;
}

interface FrameProps {
  station: Station;
  /** Optional plaque beneath equipment; tea tanks carry a name tag on their glass. */
  label?: string;
  locked?: boolean;
  /** Off for anything set into a surface rather than stood on one. */
  shadow?: boolean;
  accessibilityLabel: string;
  press: SharedValue<number>;
  handlers: GestureResponderHandlers;
  children: ReactNode;
}

/**
 * Every machine is a touch target with its name on a little wooden plaque below it. The gestures
 * are raw responders rather than presses, so a finger that drifts (or a browser's long-press) can
 * never cut a drag short.
 */
function Frame({ station, label, locked, shadow = true, accessibilityLabel, press, handlers, children }: FrameProps) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.frame, { left: station.cx - station.slot / 2, top: station.y - 6, width: station.slot }, style]}
    >
      {/* Everything in the room stands on a painted surface now, so each box sits in a pool of
          its own rather than in the dark well a steel counter used to give the pans. */}
      {shadow && (
        <Shadow
          cx={station.slot / 2}
          cy={6 + station.h}
          rx={station.w * 0.46}
          ry={Math.max(3, station.w * 0.11)}
        />
      )}
      <View style={[{ width: station.w, height: station.h }, locked && styles.locked]}>{children}</View>
      {label !== undefined && (
        <Text
          style={[styles.label, { maxWidth: station.labelW }]}
          // A plaque is only as wide as the box it belongs to, so a long name runs onto a second
          // line rather than being cut off; the apron in front of the pans is where it goes.
          numberOfLines={2}
        >
          {label}
        </Text>
      )}
    </Animated.View>
  );
}

/**
 * Picking a tool out of a bin and carrying it over to the cup — and, on a row that holds more
 * than the room is wide, swiping that row along instead.
 *
 * The two share one gesture, so which it is has to be decided from the first few pixels of
 * movement: sideways is a swipe along the counter, anything else is a lift. The tool is picked
 * up on touch either way, because that is what makes a tap on a bin say what to do with it; a
 * swipe simply puts it straight back.
 */
function useCarryGesture(
  station: Station,
  carry: Carry,
  press: SharedValue<number>,
  pan?: PanRow,
  /** Called the moment it is lifted, for anything that has to say what it is. */
  onGrab?: () => void,
): GestureResponderHandlers {
  const from = useRef({ x: 0, y: 0 });
  const mode = useRef<'carry' | 'swipe'>('carry');
  const at = useRef(0);
  const letGo = () => {
    press.set(withTiming(1, { duration: 180, easing: ease }));
    if (mode.current === 'swipe') pan?.onHold(false);
    else carry.drop();
    mode.current = 'carry';
  };
  return {
    ...GRABBY,
    onResponderGrant: (event) => {
      from.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      mode.current = 'carry';
      at.current = pan ? pan.offset.get() : 0;
      press.set(withTiming(0.94, { duration: 80 }));
      carry.begin(station, at.current);
      onGrab?.();
    },
    onResponderMove: (event) => {
      const dx = event.nativeEvent.pageX - from.current.x;
      const dy = event.nativeEvent.pageY - from.current.y;
      if (pan && mode.current === 'carry' && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        mode.current = 'swipe';
        carry.cancel();
        pan.onHold(true);
      }
      if (mode.current === 'swipe') pan?.offset.set(Math.max(pan.min, Math.min(0, at.current + dx)));
      else carry.move(dx, dy);
    },
    onResponderRelease: letGo,
    onResponderTerminate: letGo,
  };
}

// --------------------------------------------------------------------------- tea dispensers

function TeaDispenser({ station, cup, build, onNudge, active, level, onPour, onPouring }: EquipProps & {
  active: boolean;
  level: SharedValue<number>;
  onPour: KitchenStationProps['onPour'];
  onPouring: (station: Station, running: boolean) => void;
}) {
  const { w: W, h: H } = station;
  const mountW = W * 1.18;
  const mountH = mountW * 28 / 120;
  const locked = cup.tea !== null && cup.tea !== station.id;
  const press = useSharedValue(1);
  const { handlers, pouring } = useHoldPour({ enabled: active && !locked, fill: build.fill, level, press,
    onStart: (running) => onPouring(station, running),
    onCommit: (amount) => onPour('tea', station.id, amount),
    onBlocked: () => onNudge(locked ? 'Ly đã có trà khác — đổ bỏ để pha lại' : `Kéo ly dưới bình ${station.name} trước`),
  });
  return (
    <View {...handlers} accessible accessibilityRole="button"
      accessibilityLabel={`Bình ${station.name} — giữ vòi để rót`}
      accessibilityState={{ selected: active, disabled: locked }}
      style={{ position: 'absolute', left: station.cx - station.slot / 2, top: station.y,
        width: station.slot, height: Math.max(44, H), alignItems: 'center' }}>
      <View style={[{ position: 'absolute',
        top: (station.mount ?? station.y) - station.y - mountH * 0.45, width: mountW, height: mountH }, pointerEventsStyles.none]}>
        <TeaTankMount width={mountW} height={mountH} />
      </View>
      <TankGraphic width={W} height={H} color={station.color} teaId={station.id} pouring={pouring} />
      <View style={[{ position: 'absolute', bottom: '100%', width: station.slot - 4,
        minHeight: 22, marginBottom: 3, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#FFF5DB', borderColor: active ? '#FF5D96' : '#80573D',
        borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 3 }, pointerEventsStyles.none]}>
        <Text numberOfLines={2} style={{ textAlign: 'center', fontFamily: fonts.bold,
          fontSize: 10, lineHeight: 12, color: '#663722' }}>{station.name}</Text>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------- milk cartons

/** A carton you pick up off the shelf and tip into the cup. */
function MilkCarton({ station, cup, carry, pan }: EquipProps) {
  const { w: W, h: H } = station;
  const locked = cup.milk !== null && cup.milk !== station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan);

  return (
    <Frame
      station={station}
      locked={locked}
      label={station.id === 'oat' ? 'Yến mạch' : 'Sữa tươi'}
      accessibilityLabel={`Hộp ${station.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Image source={MILK[station.id] ?? MILK.whole} style={{ width: W, height: H }} />
    </Frame>
  );
}

// --------------------------------------------------------------------------- the topping bar

/**
 * One topping, heaped in the bin the room paints for it. It wears no plaque and casts no pool of
 * its own: the tray it stands in is painted with its own sign and its own shadow, and six
 * Vietnamese topping names would not fit under six bins this size anyway. What a bin is holding
 * is said out loud instead, on the line along the bottom, the moment it is picked up.
 */
function ToppingBin({ station, cup, max, carry, pan, onNudge }: EquipProps & { max: number }) {
  const { w: W, h: H } = station;
  const option = getIngredient('toppings', station.id) as Topping;
  const inCup = cup.toppings.includes(station.id);
  const full = !inCup && cup.toppings.length >= max;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan, () => onNudge(option.name));

  return (
    <Frame
      station={station}
      locked={full}
      shadow={false}
      accessibilityLabel={`Hộp ${option.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Image source={BIN[station.id] ?? BIN.pearls} style={{ width: W, height: H }} />
    </Frame>
  );
}

// --------------------------------------------------------------------------- the ice pan

function IceChest({ station, build, carry, pan }: EquipProps) {
  const { w: W, h: H } = station;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan);

  return (
    <Frame
      station={station}
      label={build.iceScoops > 0 ? (build.iceScoops === 1 ? 'Ít đá' : 'Đá thường') : 'Thùng đá'}
      accessibilityLabel="Thùng đá — kéo vào ly"
      press={press}
      handlers={handlers}
    >
      <Image source={ICE_PAN} style={{ width: W, height: H }} />
      {/* how many scoops already went in the cup */}
      <View style={[styles.tool, { left: W * 0.12, top: H * 0.1, flexDirection: 'row', gap: W * 0.05 }]}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{
              width: W * 0.09,
              height: W * 0.09,
              borderRadius: W * 0.05,
              borderWidth: 1.2,
              borderColor: SHOP.steelEdge,
              backgroundColor: i < build.iceScoops ? colors.sky : '#FFFFFF',
            }}
          />
        ))}
      </View>
    </Frame>
  );
}

// --------------------------------------------------------------------------- syrup and foam

function SyrupPump({ station, build, carry, pan }: EquipProps) {
  const { w: W, h: H } = station;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan);
  const pumps = build.sugarPumps;

  return (
    <Frame
      station={station}
      label={pumps > 0 ? `${SUGAR_STEPS[pumps - 1]}%` : 'Đường'}
      accessibilityLabel="Bình đường — kéo vào ly"
      press={press}
      handlers={handlers}
    >
      <Image source={SYRUP} style={{ width: W, height: H }} />
      {/* how sweet the cup is already */}
      <View style={[styles.pips, { top: H * 0.92, width: W }]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.pip, { width: W * 0.14, height: W * 0.14, backgroundColor: i < pumps ? '#C98A1E' : '#FFF3D9' }]}
          />
        ))}
      </View>
    </Frame>
  );
}

function FoamTub({ station, cup, carry, pan }: EquipProps) {
  const { w: W, h: H } = station;
  const option = getIngredient('foam', station.id);
  const inCup = cup.foam === station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan);

  return (
    <Frame
      station={station}
      locked={Boolean(cup.foam) && !inCup}
      label={station.id === 'cheese' ? 'Phô mai' : 'Brûlée'}
      accessibilityLabel={`Hũ ${option?.name ?? 'kem'} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Image source={FOAM[station.id] ?? FOAM.cheese} style={{ width: W, height: H }} />
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingTop: 6,
  },
  locked: {
    opacity: 0.55,
  },
  label: {
    marginTop: 1,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.semi,
    color: '#6B4422',
    backgroundColor: SHOP.plaque,
    borderWidth: 1.5,
    borderColor: SHOP.woodEdge,
    borderRadius: 4,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  tool: {
    position: 'absolute',
  },
  pips: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  pip: {
    borderRadius: 99,
    borderWidth: 1,
    borderColor: SHOP.woodEdge,
  },
  carried: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cup: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  hintRow: {
    position: 'absolute',
    left: 6,
    right: 6,
    alignItems: 'center',
  },
  hint: {
    maxWidth: '96%',
    backgroundColor: 'rgba(74,44,42,0.82)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  hintText: {
    color: '#FFF4E8',
    fontFamily: fonts.semi,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
