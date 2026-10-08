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
  MIN_FILL,
  SUGAR_STEPS,
  Tea,
  Topping,
} from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { CupBuild } from '../game/reducer';
import { DURATION, ease, timing } from '../motion';
import { colors, fonts } from '../theme';
import { fitRoom, KitchenRoom, Shadow, SHOP } from './art/KitchenRoom';
import {
  ART,
  FOAM,
  JAR_SPOUT,
  JAR_TEA,
  MILK,
  PAN,
  PIECE,
  PIECE_ART,
  ROOM,
  SCOOP,
  SCOOP_BOWL,
  SYRUP,
} from './art/kitchenArt';
import { KitchenCup } from './KitchenCup';
import { GRABBY } from './pour';
import { TeaWindow } from './TeaWindow';

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
}

/** A row of equipment, and whether there is more of it than the room is wide. */
export interface RowStrip {
  scroll: boolean;
  /** How wide the row's contents are altogether. */
  span: number;
}

/** The little wooden sign on the dispenser shelf's top board, naming the station under it. */
export interface TeaSign {
  cx: number;
  top: number;
  height: number;
}

/**
 * The dispenser shelf taken as one thing. The cup is no longer carried to a particular tap: it is
 * lifted anywhere onto this and the pouring window opens on the tap nearest where it was let go.
 */
export interface TeaBay {
  x0: number;
  x1: number;
  /** The jars' shoulders, and the board they stand on. */
  top: number;
  base: number;
}

/** A row the player can swipe along, and how far it may go. */
interface PanRow {
  offset: SharedValue<number>;
  min: number;
  onHold: (held: boolean) => void;
}

export interface KitchenLayout {
  stations: Station[];
  strips: RowStrip[];
  /** Both null on a day with no dispensers at all, which cannot happen in play. */
  teaSign: TeaSign | null;
  teaBay: TeaBay | null;
  /** Where a cup stands on the work top through the middle of the room. */
  tableLine: number;
  /** Where the pink units at the foot of the room start. */
  cabinetTop: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/** How much wider than its own art a pan is drawn, towards the design's wider pans. */
const PAN_WIDEN = 1.16;

/** The sliver between two jars: they stand shoulder to shoulder, not spread down the shelf. */
const TEA_GAP = 2;

/** The pans are drawn wider than they are tall; everything else keeps its own art's shape. */
const widened = (kind: StationKind) => kind === 'topping' || kind === 'ice';

/** How wide a piece of equipment may get, as a fraction of the room's width. */
const MAX_WIDTH: Record<StationKind, number> = {
  tea: 0.26,
  milk: 0.21,
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

/** The cup the player builds, sized to the room it has. */
export function cupSizeFor(W: number, H: number) {
  const width = Math.round(Math.max(40, Math.min(70, W * 0.165, H * 0.14)));
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
  let teaSign: TeaSign | null = null;
  let teaBay: TeaBay | null = null;

  rows.forEach((items, r) => {
    const level = LEVELS[Math.min(r, LEVELS.length - 1)];
    const kind = items[0].kind;
    const tea = kind === 'tea';

    const base = Math.round(py(level.base));
    // The plaque hangs below the surface, so all of this is the box's: what the shelf above
    // leaves it.
    const headroom = base - Math.round(py(level.ceiling));
    const left = Math.round(px(level.x0));
    const run = Math.round(px(level.x1)) - left;

    // Every box is as big as its own art goes in the space above the surface — never shrunk so
    // that the day's whole range fits across at once, which is what used to turn a late day's
    // dispensers into thumbnails. A jar is the same size on day one and on day seven, and the
    // counters below, which do overflow, run off the right of the room and are swiped back
    // instead. The shelf cannot be swiped, so it is the one row held to its own run: the game's
    // six teas fit across it at full size, and a seventh would shrink all six rather than stand
    // out over the fridge.
    const w = tea
      ? Math.min(W * MAX_WIDTH[kind], headroom * ASPECT[kind], run / items.length - TEA_GAP)
      : Math.min(W * MAX_WIDTH[kind], headroom * ASPECT[kind]);
    const h = Math.round(w / ASPECT[kind]);

    // One height for the whole row, and each box as wide as its own art — so a bottle stays a
    // bottle and a carton a carton, instead of every one of them taking the first one's shape.
    const widths = items.map((item) =>
      Math.round(h * ASPECT[tea ? 'tea' : item.kind] * (widened(item.kind) ? PAN_WIDEN : 1)),
    );
    // Jars and pans sit shoulder to shoulder; a bottle or a carton takes a column of its own,
    // wide enough to put its name under. Six jars at this size are what the shelf holds, which
    // is every tea in the game.
    const slots = items.map((item, i) =>
      tea ? widths[i] + TEA_GAP : widened(item.kind) ? widths[i] : Math.max(widths[i], Math.round(W * 0.2)),
    );
    const span = slots.reduce((sum, slot) => sum + slot, 0);
    // Both the shelf and the counters start hard against the left of what they stand on.
    let x = left;

    items.forEach((item, i) => {
      const slot = slots[i];
      const cx = Math.round(x + slot / 2);
      x += slot;
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
        spout: item.kind === 'tea' ? Math.round(h * JAR_SPOUT) : Math.round(h * 0.2),
        dockY: base + cupH + 8,
      });
    });

    if (tea) {
      teaBay = { x0: left, x1: left + span, top: base - h, base };
      teaSign = {
        // Over the jars rather than over the shelf, so that on a day with only three of them it
        // is still naming the three and not the bare end of the board.
        cx: left + Math.round(span / 2),
        top: Math.round(py(ROOM.shelf.board)) - 2,
        height: Math.max(15, Math.round(py(ROOM.shelf.top) - py(ROOM.shelf.board))),
      };
    }
    strips.push({ scroll: !tea && span > W, span });
  });

  const tableLine = Math.round(py(ROOM.table.stand));
  return {
    stations,
    strips,
    teaSign,
    teaBay,
    tableLine,
    cabinetTop: Math.round(py(ROOM.cabinets)),
    cupW,
    cupH,
    homeX: Math.round(W / 2 - cupW / 2),
    homeY: tableLine - cupH,
  };
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
  /** How much of the top of the room the page floats the order card over. */
  topInset: number;
  /** Measured for the coin/toss effects. */
  cupRef: React.RefObject<View | null>;
}

/**
 * The kitchen you actually work in. Two gestures, both held in the hand:
 * - **drag the cup** up under a tea dispenser or a milk carton and **hold the tap** — how long you
 *   hold is how much runs in, and the cup has to reach the "đủ" line to be worth serving;
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
  topInset,
  cupRef,
}: KitchenStationProps) {
  const layout = useMemo(() => layoutKitchen(config, W, H), [config, W, H]);
  const { stations, strips, teaSign, teaBay, tableLine, cabinetTop, cupW, cupH, homeX, homeY } = layout;

  const cupX = useSharedValue(homeX);
  const cupY = useSharedValue(homeY);
  /** 0 = standing on the table, 1 = held up to a tap. */
  const lift = useSharedValue(0);
  /** The live liquid level, which a held-open tap drives straight past the committed fill. */
  const level = useSharedValue(build.fill);

  // Whether the station is open. A fresh cup (served or tipped out) shuts it.
  const [station, setStation] = useState<{ cupId: number; open: boolean }>({ cupId, open: false });
  if (station.cupId !== cupId) setStation({ cupId, open: false });
  const nudge = useNudge();
  /** The day's dispensers, for the station window to put on its own shelf. */
  const teas = stations.filter((item) => item.kind === 'tea').map(({ id, name, color }) => ({ id, name, color }));

  useEffect(() => {
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    lift.set(withTiming(0, timing()));
    // A new cup starts empty, back on the table.
  }, [cupId, cupX, cupY, lift, homeX, homeY]);

  useEffect(() => {
    level.set(withTiming(build.fill, timing(DURATION.base)));
  }, [build.fill, cupId, level]);

  /** Send the cup back to its coaster, wherever it was left. */
  const standCupDown = useCallback(() => {
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    lift.set(withTiming(0, timing(DURATION.slow)));
  }, [cupX, cupY, lift, homeX, homeY]);

  /**
   * Open the station. The cup is put straight back down in the room — in the window it is
   * standing on that room's own work top — and the pager is frozen so that a swipe inside the
   * window cannot take the page with it.
   */
  const openTea = useCallback(() => {
    setStation({ cupId, open: true });
    standCupDown();
    onDragging(true);
  }, [cupId, standCupDown, onDragging]);

  const pan = useMemo(() => {
    const grab = { x: homeX, y: homeY };
    const settle = () => {
      onDragging(false);
      // Left standing on the work top it goes home; lifted up onto the shelf it opens the window.
      const lifted = cupY.get() + cupH < tableLine - 10;
      const found = lifted ? findStation(stations, teaBay, cupX.get(), cupY.get(), cupW, cupH) : null;
      if (found) openTea();
      else standCupDown();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        grab.x = cupX.get();
        grab.y = cupY.get();
        onDragging(true);
        lift.set(withTiming(1, timing(DURATION.fast)));
      },
      onPanResponderMove: (_event, gesture) => {
        cupX.set(Math.max(-cupW * 0.15, Math.min(W - cupW * 0.85, grab.x + gesture.dx)));
        cupY.set(Math.max(-4, Math.min(H - cupH * 0.65, grab.y + gesture.dy)));
      },
      onPanResponderRelease: settle,
      onPanResponderTerminate: settle,
    });
  }, [stations, teaBay, cupW, cupH, homeX, homeY, tableLine, W, H, cupX, cupY, lift, onDragging, openTea, standCupDown]);

  const closeTea = () => {
    setStation({ cupId, open: false });
    onDragging(false);
  };

  // How far each row has been swiped along. There are never more than three, and the top one —
  // the dispensers — never moves, because the cup is carried to a particular tap.
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
    onDragging,
    onNudge: nudge.show,
  });

  const cupStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cupX.value }, { translateY: cupY.value }, { scale: 1 + lift.value * 0.05 }],
  }));

  const hint = nudge.text || hintFor(cup, build);
  const shared = { cup, build, onNudge: nudge.show, carry };

  return (
    <View style={StyleSheet.absoluteFill}>
      <KitchenRoom
        width={W}
        height={H}
        tableLine={tableLine}
        matX={homeX - Math.round(cupW * 0.25)}
        matW={Math.round(cupW * 1.5)}
      />

      {teaSign && <ShelfSign sign={teaSign} />}

      {strips.map((strip, r) => {
        const row = stations.filter((station) => station.row === r);
        const pan = strip.scroll ? { offset: swipe[r], min: W - strip.span, onHold: onDragging } : undefined;
        const boxes = row.map((station) => {
          const props = { station, pan, ...shared };
          switch (station.kind) {
            case 'tea':
              return <TeaDispenser key={station.key} {...props} onOpen={openTea} />;
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
          <View key={r} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {boxes}
          </View>
        );
      })}

      {/* The cup: a thing on the table you pick up and carry to the taps. It needs no shadow of
          its own — the coaster it stands in casts one. */}
      <Animated.View
        ref={cupRef}
        {...pan.panHandlers}
        accessible
        accessibilityLabel="Ly đang pha — kéo tới vòi trà"
        style={[styles.cup, { width: cupW, height: cupH }, cupStyle]}
      >
        <FreshCup key={cupId} width={cupW} height={cupH}>
          <KitchenCup drink={cup} width={cupW} height={cupH} level={level} />
        </FreshCup>
      </Animated.View>

      {carry.node}

      {/* The station, opened: the room behind it goes quiet while the cup is being poured. */}
      {station.open && (
        <TeaWindow
          width={W}
          height={H}
          topInset={topInset}
          teas={teas}
          cup={cup}
          build={build}
          level={level}
          onPour={onPour}
          onNudge={nudge.show}
          onClose={closeTea}
        />
      )}

      {/* The line along the bottom tells you what to do with the room — nothing, while a window
          is up over it. */}
      {!station.open && (
        <View
          style={[styles.hintRow, { top: Math.min(H - 22, cabinetTop + Math.max(3, (H - cabinetTop - 18) / 2)) }]}
          pointerEvents="none"
        >
          <View style={styles.hint}>
            <Text style={styles.hintText} numberOfLines={2}>
              {hint}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Which tap the cup was lifted to. The shelf is one station now, so anywhere along it counts —
 * the cup no longer has to be lined up under a particular jar — and the nearest tap is the one
 * the window opens on.
 */
function findStation(
  stations: Station[],
  bay: TeaBay | null,
  x: number,
  y: number,
  cupW: number,
  cupH: number,
): Station | null {
  if (!bay) return null;
  const cx = x + cupW / 2;
  // Did it reach the shelf at all? Half a cup past either end, and anywhere between the jars'
  // shoulders and a cup's height below the board they stand on.
  if (cx < bay.x0 - cupW * 0.5 || cx > bay.x1 + cupW * 0.5) return null;
  if (y + cupH < bay.top || y > bay.base + cupH * 0.9) return null;

  let best: Station | null = null;
  let bestDx = Infinity;
  for (const station of stations) {
    // Only the dispensers are poured from; everything else is carried over to the cup.
    if (station.kind !== 'tea') continue;
    const dx = Math.abs(cx - station.cx);
    if (dx < bestDx) {
      bestDx = dx;
      best = station;
    }
  }
  return best;
}

function hintFor(cup: Drink, build: CupBuild): string {
  if (!cup.tea) return 'Kéo ly lên kệ trà để mở bàn pha';
  if (build.fill < MIN_FILL) return 'Chưa đủ trà — mở lại kệ trà và rót thêm';
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
    <Animated.View pointerEvents="none" style={[styles.carried, { width: size, height: size }, style]}>
      {held && <Tool station={held} size={size} />}
    </Animated.View>
  );

  return { begin, cancel, move, drop, node };
}

/** A row holding more equipment than the room is wide: swipe along it to reach the rest. */
function SwipeRow({ offset, children }: { offset: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

/** What a station puts in your hand: the shop's scoop, a carton, or the syrup bottle. */
function Tool({ station, size }: { station: Station; size: number }) {
  const S = size;
  if (station.kind === 'sugar') {
    return <Image source={SYRUP} style={{ width: S * 0.62, height: (S * 0.62) / ART.syrup }} />;
  }
  if (station.kind === 'milk') {
    return <Image source={MILK[station.id] ?? MILK.whole} style={{ width: S * 0.7, height: (S * 0.7) / ART.milk }} />;
  }

  // A scoop of something: the pieces are heaped in its bowl, with the scoop drawn over them.
  const SH = S / ART.scoop;
  const bowl = { x: S * SCOOP_BOWL.cx, y: SH * SCOOP_BOWL.cy, r: S * SCOOP_BOWL.r };
  const art = station.kind === 'ice' ? 'ice' : station.id;
  const piece = PIECE[art];
  // a small heap, wider than it is tall — the bowl is a shallow one
  const spread =
    station.kind === 'ice'
      ? [
          [-0.46, 0.06],
          [0.46, 0.08],
          [0, -0.3],
        ]
      : [
          [-0.62, 0.1],
          [0, 0.14],
          [0.62, 0.08],
          [-0.32, -0.24],
          [0.32, -0.22],
        ];
  const r = bowl.r * (station.kind === 'ice' ? 0.62 : 0.52);

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
        piece &&
        spread.map(([fx, fy], i) => (
          <Image
            key={i}
            source={piece}
            style={{
              position: 'absolute',
              left: bowl.x + fx * bowl.r - r,
              top: bowl.y + fy * bowl.r - r / (PIECE_ART[art] ?? 1),
              width: r * 2,
              height: (r * 2) / (PIECE_ART[art] ?? 1),
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
  /** Left off where the equipment speaks for itself — the dispensers are told apart by colour. */
  label?: string;
  locked?: boolean;
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
function Frame({ station, label, locked, accessibilityLabel, press, handlers, children }: FrameProps) {
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
      <Shadow
        cx={station.slot / 2}
        cy={6 + station.h}
        rx={station.w * 0.46}
        ry={Math.max(3, station.w * 0.11)}
      />
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

// --------------------------------------------------------------------------- the tea shelf

/** The little wooden sign on the shelf's top board, naming the station under it. */
function ShelfSign({ sign }: { sign: TeaSign }) {
  const w = Math.round(sign.height * 2.6);
  return (
    <View
      pointerEvents="none"
      style={[styles.sign, { left: sign.cx - w / 2, top: sign.top, width: w, height: sign.height }]}
    >
      <Text style={[styles.signText, { fontSize: Math.round(sign.height * 0.56) }]} numberOfLines={1}>
        Trà
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------- tea dispensers

function TeaDispenser({ station, cup, onOpen }: EquipProps & { onOpen: () => void }) {
  const { w: W, h: H } = station;
  const tea = getIngredient('tea', station.id) as Tea;
  const locked = cup.tea !== null && cup.tea !== station.id;
  const press = useSharedValue(1);
  // Nothing is poured where the jars stand any more: touching one is the other way into the
  // station, the same as carrying the cup up to it.
  const handlers = {
    ...GRABBY,
    onResponderGrant: () => press.set(withTiming(0.95, { duration: 80 })),
    onResponderRelease: () => {
      press.set(withTiming(1, timing(DURATION.fast)));
      onOpen();
    },
    onResponderTerminate: () => press.set(withTiming(1, timing(DURATION.fast))),
  };

  return (
    <Frame
      station={station}
      locked={locked}
      accessibilityLabel={`Bình ${tea.name}`}
      press={press}
      handlers={handlers}
    >
      {/* Glass and tea together, as the sheet paints them. */}
      <Image source={JAR_TEA[station.id] ?? JAR_TEA.black} style={{ width: W, height: H }} />
    </Frame>
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

function ToppingBin({ station, cup, max, carry, pan }: EquipProps & { max: number }) {
  const { w: W, h: H } = station;
  const option = getIngredient('toppings', station.id) as Topping;
  const inCup = cup.toppings.includes(station.id);
  const full = !inCup && cup.toppings.length >= max;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, pan);

  return (
    <Frame
      station={station}
      locked={full}
      label={option.name}
      accessibilityLabel={`Hộp ${option.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Image source={PAN[station.id] ?? PAN.pearls} style={{ width: W, height: H }} />
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
      <Image source={PAN.ice} style={{ width: W, height: H }} />
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
  sign: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SHOP.plaque,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: SHOP.woodEdge,
    borderRadius: 7,
  },
  signText: {
    fontFamily: fonts.bold,
    color: '#6B4422',
    includeFontPadding: false,
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
