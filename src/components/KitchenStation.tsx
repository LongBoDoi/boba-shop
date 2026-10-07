import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderHandlers, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  CategoryId,
  Drink,
  getIngredient,
  MAX_ICE_SCOOPS,
  MAX_POUR,
  MILK_SPLASH,
  MIN_FILL,
  POUR_RATE,
  SUGAR_STEPS,
  Tea,
  Topping,
} from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { CupBuild } from '../game/reducer';
import { DURATION, ease, timing } from '../motion';
import { colors, fonts } from '../theme';
import { shade } from './art/Character';
import { heartPath, KitchenRoom, RoomShelf, SHOP } from './art/KitchenRoom';
import { Cup } from './Cup';

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
  /** Line the equipment stands on. */
  base: number;
  /** Where liquid leaves it, measured inside the box. */
  spout: number;
  /** Where the cup's bottom goes while you hold this tap open. */
  dockY: number;
}

export interface KitchenLayout {
  stations: Station[];
  shelves: RoomShelf[];
  /** The work top in the middle of the room — where the cup rests between jobs. */
  tableLine: number;
  /** Where the pink cabinet doors along the bottom start. */
  cabinetTop: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/** How wide each piece of equipment is relative to its height. */
const ASPECT: Record<StationKind, number> = {
  tea: 0.66,
  milk: 0.52,
  topping: 1.12,
  ice: 1.12,
  sugar: 0.5,
  foam: 0.88,
};

const EQUIPMENT_NAMES: Record<string, string> = {
  ice: 'Đá',
  sugar: 'Đường',
};

/** The cup the player builds, sized to the room it has. */
export function cupSizeFor(W: number, H: number) {
  const width = Math.round(Math.max(42, Math.min(62, W * 0.15, H * 0.17)));
  const height = Math.round(width * 1.3 + Math.max(3, width * 0.07));
  return { width, height };
}

/**
 * Arrange the kitchen the way the shop is laid out: the tea dispensers on a wooden shelf at the
 * top, the work top with the cup's coaster through the middle, then the topping bar and the rest of
 * the equipment below, and the cabinet doors along the very bottom. The dispensers get a dock — the
 * spot the cup is held while that tap runs into it.
 */
export function layoutKitchen(config: DayConfig, W: number, H: number): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H);
  // Headroom for the pendant lamps, a wooden name plaque under each machine, cabinets at the foot.
  const top = Math.max(34, Math.round(H * 0.085));
  const labelH = 17;
  const cabinetH = Math.max(30, Math.round(H * 0.085));
  const cabinetTop = H - cabinetH;
  const counterH = Math.max(11, Math.round(H * 0.028));
  // The band the cup lives in: room to stand on the work top and to be lifted up to a tap.
  const bandH = cupH + 24 + counterH;

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

  const avail = cabinetTop - top - bandH;
  const weights = rows.map((row) => (row[0].kind === 'tea' ? 1.25 : 1));
  const total = weights.reduce((a, b) => a + b, 0);

  const stations: Station[] = [];
  const shelves: RoomShelf[] = [];
  let y = top;
  let tableLine = cabinetTop - counterH;

  rows.forEach((items, r) => {
    const rowH = (avail * weights[r]) / total;
    const base = Math.round(y + rowH - labelH);
    const slot = (W - 6) / items.length;
    const tall = items[0].kind === 'tea';
    const maxH = Math.min(rowH - labelH - 6, H * (tall ? 0.32 : 0.26));
    let shelfTop = base;

    items.forEach((item, i) => {
      const aspect = ASPECT[item.kind];
      const w = Math.round(Math.min(slot - 10, maxH * aspect));
      const h = Math.round(w / aspect);
      const cx = Math.round(3 + slot * (i + 0.5));
      const option =
        item.kind === 'ice' || item.kind === 'sugar' ? undefined : getIngredient(categoryOf(item.kind), item.id);
      shelfTop = Math.min(shelfTop, base - h);
      stations.push({
        key: `${item.kind}-${item.id}`,
        kind: item.kind,
        id: item.id,
        name: option?.name ?? EQUIPMENT_NAMES[item.id] ?? item.id,
        color: option?.color ?? colors.sky,
        x: cx - Math.round(w / 2),
        y: base - h,
        w,
        h,
        cx,
        slot: Math.round(slot),
        base,
        spout: item.kind === 'tea' ? Math.round(h * 0.8) : Math.round(h * 0.2),
        dockY: base + cupH + 8,
      });
    });

    shelves.push({ base, top: shelfTop, steel: !tall });
    y += rowH;
    // The work top goes straight under the dispensers, so the cup only has a short lift.
    if (r === 0) {
      tableLine = Math.round(y + bandH - counterH);
      y += bandH;
    }
  });

  return {
    stations,
    shelves,
    tableLine,
    cabinetTop,
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
  cupRef,
}: KitchenStationProps) {
  const layout = useMemo(() => layoutKitchen(config, W, H), [config, W, H]);
  const { stations, shelves, tableLine, cabinetTop, cupW, cupH, homeX, homeY } = layout;

  const cupX = useSharedValue(homeX);
  const cupY = useSharedValue(homeY);
  /** 0 = standing on the table, 1 = held up to a tap. */
  const lift = useSharedValue(0);
  /** The live liquid level, which a held-open tap drives straight past the committed fill. */
  const level = useSharedValue(build.fill);

  // The cup is let go of whenever a fresh one comes in (served or tipped out).
  const [dock, setDock] = useState<{ cupId: number; key: string | null }>({ cupId, key: null });
  if (dock.cupId !== cupId) setDock({ cupId, key: null });
  const docked = stations.find((station) => station.key === dock.key) ?? null;
  const nudge = useNudge();
  // What is running into the cup right now, so the liquid shows its colour while the tap is held.
  const [pouring, setPouring] = useState<{ category: 'tea' | 'milk'; id: string } | null>(null);
  const inCup = pouring ? { ...cup, [pouring.category]: cup[pouring.category] ?? pouring.id } : cup;

  useEffect(() => {
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    lift.set(withTiming(0, timing()));
    // A new cup starts empty, back on the table.
  }, [cupId, cupX, cupY, lift, homeX, homeY]);

  useEffect(() => {
    level.set(withTiming(build.fill, timing(DURATION.base)));
  }, [build.fill, cupId, level]);

  const pan = useMemo(() => {
    const grab = { x: homeX, y: homeY };
    const settle = () => {
      onDragging(false);
      // Left standing on the work top it goes home; lifted up to a tap it docks there.
      const lifted = cupY.get() + cupH < tableLine - 10;
      const found = lifted ? findStation(stations, cupX.get(), cupY.get(), cupW, cupH) : null;
      if (found) {
        setDock({ cupId, key: found.key });
        cupX.set(withTiming(found.cx - Math.round(cupW / 2), timing()));
        cupY.set(withTiming(found.dockY - cupH, timing()));
        lift.set(withTiming(1, timing()));
      } else {
        setDock({ cupId, key: null });
        cupX.set(withTiming(homeX, timing(DURATION.slow)));
        cupY.set(withTiming(homeY, timing(DURATION.slow)));
        lift.set(withTiming(0, timing(DURATION.slow)));
      }
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
  }, [stations, cupId, cupW, cupH, homeX, homeY, tableLine, W, H, cupX, cupY, lift, onDragging]);

  // Finishing a pour sets the cup back on its mat, so it never ends up hiding a shelf you need.
  const standDown = useRef<ReturnType<typeof setTimeout> | null>(null);
  const standCupDown = () => {
    setDock({ cupId, key: null });
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    lift.set(withTiming(0, timing(DURATION.slow)));
  };
  useEffect(() => () => {
    if (standDown.current) clearTimeout(standDown.current);
  }, []);

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
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.22 * (1 - lift.value),
    transform: [{ translateX: cupX.value }, { translateY: cupY.value }],
  }));

  const hint = nudge.text || hintFor(docked, cup, build);
  // Freeze the pager while a tap is held, so a drifting finger can't swipe the page away. When the
  // tap is let go, the cup is put back down on the table a moment later.
  const startPouring = (what: { category: 'tea' | 'milk'; id: string } | null) => {
    setPouring(what);
    onDragging(Boolean(what));
    if (standDown.current) clearTimeout(standDown.current);
    if (!what) standDown.current = setTimeout(standCupDown, 420);
  };
  const shared = { cup, build, level, onNudge: nudge.show, onPouring: startPouring, carry };

  return (
    <View style={StyleSheet.absoluteFill}>
      <KitchenRoom
        width={W}
        height={H}
        shelves={shelves}
        tableLine={tableLine}
        cabinetTop={cabinetTop}
        cupH={cupH}
        matX={homeX - Math.round(cupW * 0.34)}
        matW={Math.round(cupW * 1.68)}
      />

      {stations.map((station) => {
        const props = { station, active: docked?.key === station.key, ...shared };
        switch (station.kind) {
          case 'tea':
            return <TeaDispenser key={station.key} {...props} onPour={onPour} />;
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
      })}

      {/* The cup: a thing on the table you pick up and carry to the taps. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.cupShadow, { width: cupW, height: cupW * 0.3, top: cupH - cupW * 0.14 }, shadowStyle]}
      />
      <Animated.View
        ref={cupRef}
        {...pan.panHandlers}
        accessible
        accessibilityLabel="Ly đang pha — kéo tới vòi trà"
        style={[styles.cup, { width: cupW }, cupStyle]}
      >
        {/* The cup's own body is glassy, so it carries a solid backing over busy shelves. */}
        <View
          style={[
            styles.cupBacking,
            { top: Math.max(3, cupW * 0.07), height: cupH - Math.max(3, cupW * 0.07), borderRadius: cupW * 0.18 },
          ]}
        />
        <FreshCup key={cupId}>
          <Cup
            drink={inCup}
            width={cupW}
            backgroundColor={colors.floor}
            tapered={false}
            animated
            fill={build.fill}
            levelSv={level}
            marks
          />
        </FreshCup>
        <CatDecal cupW={cupW} cupH={cupH} />
        <Spill
          level={level}
          cupW={cupW}
          cupH={cupH}
          color={inCup.tea ? (getIngredient('tea', inCup.tea)?.color ?? colors.ink) : '#F7F4EC'}
        />
      </Animated.View>

      {carry.node}

      <View style={[styles.hintRow, { top: cabinetTop + Math.max(3, (H - cabinetTop - 18) / 2) }]} pointerEvents="none">
        <View style={styles.hint}>
          <Text style={styles.hintText} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Which tap the cup was lifted to: it has to be lined up under the spout. */
function findStation(stations: Station[], x: number, y: number, cupW: number, cupH: number): Station | null {
  let best: Station | null = null;
  let bestScore = Infinity;
  for (const station of stations) {
    // Only the dispensers are poured from; everything else is carried over to the cup.
    if (station.kind !== 'tea') continue;
    const dx = Math.abs(x + cupW / 2 - station.cx) / (station.slot / 2 + cupW * 0.3);
    const dy = Math.abs(y - (station.base + 8)) / (cupH * 0.9);
    if (dx > 1 || dy > 1) continue;
    if (dx + dy < bestScore) {
      bestScore = dx + dy;
      best = station;
    }
  }
  return best;
}

function hintFor(station: Station | null, cup: Drink, build: CupBuild): string {
  if (station) {
    if (cup.tea && cup.tea !== station.id) return 'Ly đã có trà khác — Đổ bỏ rồi rót lại';
    if (build.fill < MIN_FILL) return `Nhấn giữ vòi: rót ${station.name} tới vạch`;
    return 'Đủ trà rồi — giữ thêm sẽ tràn';
  }
  if (build.fill < MIN_FILL) return 'Kéo ly tới bình trà rồi nhấn giữ vòi';
  return 'Kéo topping, đá, đường… thả thẳng vào ly';
}

/** The shop's cat printed on the side of every cup. */
function CatDecal({ cupW, cupH }: { cupW: number; cupH: number }) {
  const s = Math.round(cupW * 0.42);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: (cupW - s) / 2, top: cupH * 0.44, opacity: 0.92 }}>
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path d="M6.4 8 L5.6 3.6 L9.6 6 Z" fill="#F6E6D4" stroke="#C8A98C" strokeWidth={1.1} strokeLinejoin="round" />
        <Path d="M17.6 8 L18.4 3.6 L14.4 6 Z" fill="#F6E6D4" stroke="#C8A98C" strokeWidth={1.1} strokeLinejoin="round" />
        <Circle cx={12} cy={13} r={7.6} fill="#F6E6D4" stroke="#C8A98C" strokeWidth={1.1} />
        <Circle cx={9.2} cy={12} r={1.15} fill="#6B5143" />
        <Circle cx={14.8} cy={12} r={1.15} fill="#6B5143" />
        <Path d="M10.8 15 q1.2 1.2 2.4 0" stroke="#6B5143" strokeWidth={1.1} fill="none" strokeLinecap="round" />
        <Circle cx={12} cy={16.9} r={1.5} fill="#3A2318" />
        <Circle cx={9} cy={17.9} r={1.2} fill="#3A2318" />
        <Circle cx={15} cy={17.9} r={1.2} fill="#3A2318" />
      </Svg>
    </View>
  );
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
function FreshCup({ children }: { children: ReactNode }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.set(withTiming(1, timing(DURATION.slow)));
  }, [appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * -10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Tea running over the brim and down the side of the cup. */
function Spill({ level, cupW, cupH, color }: { level: SharedValue<number>; cupW: number; cupH: number; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: level.value > 1.005 ? 1 : 0 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {[0.18, 0.5, 0.82].map((at, i) => (
        <Drop key={at} level={level} left={cupW * at - 2} cupH={cupH} color={color} offset={i * 0.12} />
      ))}
    </Animated.View>
  );
}

function Drop({
  level,
  left,
  cupH,
  color,
  offset,
}: {
  level: SharedValue<number>;
  left: number;
  cupH: number;
  color: string;
  offset: number;
}) {
  const style = useAnimatedStyle(() => {
    const over = Math.max(0, level.value - 1 - offset);
    return {
      opacity: over > 0 ? 1 : 0,
      transform: [{ translateY: interpolate(over, [0, 0.55], [0, cupH * 0.82], 'clamp') }],
    };
  });
  return <Animated.View style={[styles.drop, { left, top: cupH * 0.1, backgroundColor: color }, style]} />;
}

// --------------------------------------------------------------------------- carrying things to the cup

interface Carry {
  /** Start carrying what this station holds; the gesture is owned by the station. */
  begin: (station: Station) => void;
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
  const size = Math.round(cupW * 0.95);

  // Everything the drop needs to decide, kept fresh without rebuilding the gesture mid-drag.
  const latest = useRef({ cup, build, maxToppings, cupW, cupH, homeX, homeY, size, onScoop, onIce, onSugar, onPour, onNudge });
  useEffect(() => {
    latest.current = { cup, build, maxToppings, cupW, cupH, homeX, homeY, size, onScoop, onIce, onSugar, onPour, onNudge };
  });

  const origin = useRef({ x: 0, y: 0, station: null as Station | null });

  const begin = useCallback(
    (station: Station) => {
      origin.current = {
        x: station.cx - latest.current.size / 2,
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

  return { begin, move, drop, node };
}

/** What a station puts in your hand: a scoop, the syrup bottle, a carton of milk, a spoon of foam. */
function Tool({ station, size }: { station: Station; size: number }) {
  const S = size;
  if (station.kind === 'sugar') {
    return (
      <Svg width={S} height={S} viewBox="0 0 24 24">
        <Rect x={7} y={5} width={10} height={16} rx={4} fill="#FFF8EA" stroke="#E4D2AE" strokeWidth={1.2} />
        <Rect x={8.5} y={9} width={7} height={11} rx={3} fill="#EFAE2B" />
        <Rect x={9.5} y={1.5} width={5} height={4} rx={1.5} fill={SHOP.woodEdge} />
        <Path d="M14.5 3.5 h4 l1 2 h-5 Z" fill={SHOP.pinkGrip} />
      </Svg>
    );
  }
  if (station.kind === 'milk') {
    const oat = station.id === 'oat';
    return (
      <Svg width={S} height={S} viewBox="0 0 24 24">
        <Path
          d="M5 7 L12 2.5 L19 7 V21.5 H5 Z"
          fill={oat ? '#F3E6CD' : '#FFFFFF'}
          stroke="#D8CCBE"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
        <Path d="M5 7 L12 2.5 L19 7 Z" fill={oat ? '#C08E4F' : '#5AA9E6'} />
        <Rect x={5} y={11} width={14} height={4.5} fill={oat ? '#C08E4F' : '#5AA9E6'} opacity={0.9} />
        <Rect x={7} y={12.4} width={10} height={1.6} rx={0.8} fill="#FFFFFF" opacity={0.75} />
      </Svg>
    );
  }
  const cold = station.kind === 'ice';
  const piece = station.kind === 'topping' ? (getIngredient('toppings', station.id) as Topping | undefined) : undefined;
  const fill = cold ? '#EAF7FD' : station.kind === 'foam' ? '#F2EFEA' : '#DDE3E8';
  const edge = cold ? '#A3CADD' : SHOP.steelEdge;
  return (
    <Svg width={S} height={S} viewBox="0 0 24 24">
      <Rect x={10.4} y={0} width={3.2} height={11} rx={1.6} fill={SHOP.pinkGrip} />
      <Rect x={11.1} y={1} width={1} height={8} rx={0.5} fill="#FFFFFF" opacity={0.45} />
      <Rect x={9.9} y={10} width={4.2} height={2.4} rx={1} fill="#C3CBD2" />
      <Path d="M4 12 h16 a2 2 0 0 1 2 2 v1.5 a10 7 0 0 1 -20 0 v-1.5 a2 2 0 0 1 2 -2 Z" fill={fill} stroke={edge} strokeWidth={1} />
      {cold && (
        <>
          <Rect x={6.5} y={13} width={5} height={5} rx={1} fill="#FFFFFF" stroke="#9FD3EF" strokeWidth={0.8} />
          <Rect x={12.5} y={14} width={4.5} height={4.5} rx={1} fill="#FFFFFF" stroke="#9FD3EF" strokeWidth={0.8} />
        </>
      )}
      {station.kind === 'foam' && <Ellipse cx={12} cy={14.5} rx={6} ry={3.4} fill={station.color} />}
      {piece &&
        [
          [8, 15],
          [12, 14],
          [16, 15.4],
          [10, 17.4],
          [14, 17.6],
        ].map(([cx, cy], i) =>
          piece.shape === 'pearl' ? (
            <Circle key={i} cx={cx} cy={cy} r={2} fill={piece.color} stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
          ) : (
            <Rect key={i} x={cx - 2} y={cy - 2} width={4} height={4} rx={0.8} fill={piece.color} stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
          ),
        )}
    </Svg>
  );
}

// --------------------------------------------------------------------------- equipment shell

interface EquipProps {
  station: Station;
  active: boolean;
  cup: Drink;
  build: CupBuild;
  level: SharedValue<number>;
  onNudge: (message: string) => void;
  onPouring: (what: { category: 'tea' | 'milk'; id: string } | null) => void;
  carry: Carry;
}

interface FrameProps {
  station: Station;
  active?: boolean;
  label: string;
  locked?: boolean;
  accessibilityLabel: string;
  press: SharedValue<number>;
  handlers: GestureResponderHandlers;
  children: ReactNode;
}

/**
 * Every machine is a touch target with its name on a little wooden plaque below it; the one the cup
 * is held at glows. The gestures are raw responders rather than presses, so a finger that drifts (or
 * a browser's long-press) can never cut a pour short.
 */
function Frame({ station, active, label, locked, accessibilityLabel, press, handlers, children }: FrameProps) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(active) }}
      style={[styles.frame, { left: station.cx - station.slot / 2, top: station.y - 6, width: station.slot }, style]}
    >
      <View style={[{ width: station.w, height: station.h }, locked && styles.locked]}>{children}</View>
      {active && <View style={[styles.ring, { width: station.w + 10, height: station.h + 10 }]} />}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

/** Claim a touch outright and never give it back until the finger lifts. */
const GRABBY = {
  onStartShouldSetResponder: () => true,
  onStartShouldSetResponderCapture: () => true,
  onMoveShouldSetResponder: () => true,
  onMoveShouldSetResponderCapture: () => true,
  // Nothing — not the pager, not a long-press — gets to take this gesture away.
  onResponderTerminationRequest: () => false,
  onShouldBlockNativeResponder: () => true,
} as const;

/**
 * Holding a tap open: how long you hold is how much runs into the cup. This is the raw responder,
 * not a Pressable, so a finger that drifts (or a browser's long-press menu) can't cut a pour short:
 * it only ends when the finger actually lifts.
 */
function useHoldPour({
  enabled,
  fill,
  level,
  press,
  onStart,
  onCommit,
  onBlocked,
}: {
  enabled: boolean;
  fill: number;
  level: SharedValue<number>;
  press: SharedValue<number>;
  onStart: (running: boolean) => void;
  onCommit: (amount: number) => void;
  onBlocked: () => void;
}) {
  const startedAt = useRef(0);
  const [pouring, setPouring] = useState(false);

  const down = () => {
    if (!enabled) {
      onBlocked();
      return;
    }
    startedAt.current = Date.now();
    press.set(withTiming(0.96, { duration: 80 }));
    setPouring(true);
    onStart(true);
    const room = Math.max(0.02, MAX_POUR - fill);
    level.set(withTiming(MAX_POUR, { duration: (room / POUR_RATE) * 1000, easing: Easing.linear }));
  };
  const up = () => {
    press.set(withTiming(1, { duration: 160, easing: ease }));
    if (!pouring) return;
    setPouring(false);
    onStart(false);
    const amount = ((Date.now() - startedAt.current) / 1000) * POUR_RATE;
    level.set(withTiming(Math.min(1, fill + amount), timing(DURATION.fast)));
    onCommit(amount);
  };

  return {
    pouring,
    handlers: { ...GRABBY, onResponderGrant: down, onResponderRelease: up, onResponderTerminate: up },
  };
}

/** Picking a tool out of a bin and carrying it over to the cup. */
function useCarryGesture(station: Station, carry: Carry, press: SharedValue<number>): GestureResponderHandlers {
  const from = useRef({ x: 0, y: 0 });
  const letGo = () => {
    press.set(withTiming(1, { duration: 180, easing: ease }));
    carry.drop();
  };
  return {
    ...GRABBY,
    onResponderGrant: (event) => {
      from.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      press.set(withTiming(0.94, { duration: 80 }));
      carry.begin(station);
    },
    onResponderMove: (event) =>
      carry.move(event.nativeEvent.pageX - from.current.x, event.nativeEvent.pageY - from.current.y),
    onResponderRelease: letGo,
    onResponderTerminate: letGo,
  };
}

/** The stream from a spout down into the cup's rim. */
function Stream({
  x,
  top,
  length,
  color,
  on,
  width = 3.4,
}: {
  x: number;
  top: number;
  length: number;
  color: string;
  on: boolean;
  width?: number;
}) {
  const run = useSharedValue(0);
  useEffect(() => {
    run.set(withTiming(on ? 1 : 0, { duration: on ? 130 : 110, easing: Easing.linear }));
  }, [on, run]);
  const style = useAnimatedStyle(() => ({ height: run.value * length, opacity: run.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - width / 2, top, width, borderRadius: width, backgroundColor: color }, style]}
    />
  );
}

// --------------------------------------------------------------------------- tea dispensers

function TeaDispenser({
  station,
  active,
  cup,
  build,
  level,
  onNudge,
  onPouring,
  onPour,
}: EquipProps & { onPour: KitchenStationProps['onPour'] }) {
  const { w: W, h: H } = station;
  const tea = getIngredient('tea', station.id) as Tea;
  const locked = cup.tea !== null && cup.tea !== station.id;
  const press = useSharedValue(1);
  const { pouring, handlers } = useHoldPour({
    enabled: active && !locked,
    fill: build.fill,
    level,
    press,
    onStart: (running) => onPouring(running ? { category: 'tea', id: station.id } : null),
    onCommit: (amount) => onPour('tea', station.id, amount),
    onBlocked: () =>
      onNudge(locked ? 'Ly đã có trà khác — bấm Đổ bỏ trước' : `Kéo ly xuống dưới vòi ${tea.name} trước`),
  });

  // The heart handle on the tap tips over while the tea runs.
  const lever = useAnimatedStyle(() => ({ transform: [{ rotate: pouring ? '-24deg' : '0deg' }] }));

  const lidY = H * 0.05;
  const lidH = H * 0.1;
  const jarY = lidY + lidH * 0.72;
  const jarH = H * 0.66;
  const jarBottom = jarY + jarH;
  const teaY = jarY + jarH * 0.12;

  return (
    <Frame
      station={station}
      active={active}
      locked={locked}
      label={tea.name}
      accessibilityLabel={`Bình ${tea.name}`}
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={`gl-${station.key}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.22} />
          </LinearGradient>
        </Defs>

        {/* chunky wooden base the jar stands on */}
        <Rect x={0} y={H * 0.82} width={W} height={H * 0.17} rx={4} fill={SHOP.wood} />
        <Rect x={0} y={H * 0.82} width={W} height={H * 0.045} rx={3} fill={SHOP.woodTop} />
        <Rect x={0} y={H * 0.955} width={W} height={H * 0.035} rx={3} fill={SHOP.woodEdge} />

        {/* the glass jar, with the tea sitting in it */}
        <Rect
          x={W * 0.08}
          y={jarY}
          width={W * 0.84}
          height={jarH}
          rx={W * 0.14}
          fill={SHOP.glass}
          stroke={SHOP.glassEdge}
          strokeWidth={1.6}
        />
        <Rect x={W * 0.11} y={teaY} width={W * 0.78} height={jarBottom - teaY - 2} rx={W * 0.12} fill={tea.color} />
        <Rect x={W * 0.11} y={teaY} width={W * 0.78} height={2.5} fill="#FFFFFF" opacity={0.3} />
        {/* measuring ticks down the side */}
        {[0.3, 0.42, 0.54, 0.66].map((at) => (
          <Rect key={at} x={W * 0.72} y={jarY + jarH * at} width={W * 0.12} height={1.6} rx={0.8} fill="#FFFFFF" opacity={0.55} />
        ))}
        <Rect x={W * 0.08} y={jarY} width={W * 0.84} height={jarH} rx={W * 0.14} fill={`url(#gl-${station.key})`} />
        <Rect x={W * 0.17} y={jarY + jarH * 0.12} width={W * 0.08} height={jarH * 0.5} rx={W * 0.04} fill="#FFFFFF" opacity={0.5} />

        {/* wooden lid with a heart knob */}
        <Rect x={W * 0.03} y={lidY} width={W * 0.94} height={lidH} rx={lidH * 0.42} fill={SHOP.wood} />
        <Rect x={W * 0.03} y={lidY} width={W * 0.94} height={lidH * 0.38} rx={lidH * 0.3} fill={SHOP.woodTop} />
        <Rect x={W * 0.03} y={lidY + lidH * 0.72} width={W * 0.94} height={lidH * 0.28} rx={lidH * 0.14} fill={SHOP.woodEdge} />
        <Path d={heartPath(W * 0.5, lidY - H * 0.012, W * 0.11)} fill={SHOP.woodEdge} />
        <Path d={heartPath(W * 0.5, lidY - H * 0.016, W * 0.085)} fill={SHOP.wood} />

        {/* the tap: a dark body with a heart button, and a chrome spout under it */}
        <Rect x={W * 0.36} y={jarBottom - jarH * 0.2} width={W * 0.28} height={jarH * 0.16} rx={3} fill={SHOP.handle} />
        <Path d={heartPath(W * 0.5, jarBottom - jarH * 0.12, W * 0.07)} fill="#FFB3C8" />
        <Rect x={W * 0.42} y={jarBottom - jarH * 0.05} width={W * 0.16} height={H * 0.07} rx={3} fill="#C8D0D4" />
        <Rect x={W * 0.44} y={jarBottom + H * 0.02} width={W * 0.12} height={H * 0.04} rx={2} fill="#A9B2B8" />
        <Rect x={W * 0.45} y={jarBottom - jarH * 0.04} width={W * 0.04} height={H * 0.05} rx={2} fill="#FFFFFF" opacity={0.5} />
      </Svg>

      {/* the handle you hold down */}
      <Animated.View style={[styles.lever, { left: W * 0.6, top: jarBottom - jarH * 0.21 }, lever]}>
        <Svg width={W * 0.3} height={H * 0.1}>
          <Rect x={0} y={H * 0.025} width={W * 0.22} height={H * 0.03} rx={H * 0.015} fill={SHOP.handle} />
          <Path d={heartPath(W * 0.24, H * 0.04, W * 0.07)} fill={SHOP.pinkGrip} />
        </Svg>
      </Animated.View>

      <Stream
        x={W / 2}
        top={station.spout}
        length={station.base - station.y - station.spout + 10}
        color={tea.color}
        on={pouring}
      />
    </Frame>
  );
}

// --------------------------------------------------------------------------- milk cartons

/** A carton you pick up off the shelf and tip into the cup. */
function MilkCarton({ station, cup, carry }: EquipProps) {
  const { w: W, h: H } = station;
  const oat = station.id === 'oat';
  const body = oat ? '#F3E6CD' : '#FFFFFF';
  const band = oat ? '#C08E4F' : '#5AA9E6';
  const locked = cup.milk !== null && cup.milk !== station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press);

  return (
    <Frame
      station={station}
      locked={locked}
      label={oat ? 'Yến mạch' : 'Sữa tươi'}
      accessibilityLabel={`Hộp ${station.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        {/* gable-top carton */}
        <Path
          d={`M${W * 0.12} ${H * 0.26} L${W * 0.5} ${H * 0.06} L${W * 0.88} ${H * 0.26} V${H * 0.97} H${W * 0.12} Z`}
          fill={body}
          stroke="#D8CCBE"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <Path d={`M${W * 0.12} ${H * 0.26} L${W * 0.5} ${H * 0.06} L${W * 0.88} ${H * 0.26} Z`} fill={band} />
        <Rect x={W * 0.12} y={H * 0.45} width={W * 0.76} height={H * 0.2} fill={band} opacity={0.9} />
        <Rect x={W * 0.2} y={H * 0.5} width={W * 0.6} height={H * 0.04} rx={2} fill="#FFFFFF" opacity={0.75} />
        <Rect x={W * 0.2} y={H * 0.57} width={W * 0.38} height={H * 0.03} rx={2} fill="#FFFFFF" opacity={0.55} />
        <Path d={heartPath(W * 0.5, H * 0.76, W * 0.12)} fill={band} opacity={0.5} />
        {/* screw cap on the gable */}
        <Rect x={W * 0.56} y={H * 0.12} width={W * 0.16} height={H * 0.07} rx={2} fill={shade(band, -18)} />
      </Svg>
    </Frame>
  );
}

// --------------------------------------------------------------------------- topping bins

function ToppingBin({ station, cup, max, carry }: EquipProps & { max: number }) {
  const { w: W, h: H } = station;
  const option = getIngredient('toppings', station.id) as Topping;
  const inCup = cup.toppings.includes(station.id);
  const full = !inCup && cup.toppings.length >= max;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press);

  return (
    <Frame
      station={station}
      locked={full}
      label={option.name}
      accessibilityLabel={`Hộp ${option.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        <Pan W={W} H={H} />
        <Pieces W={W} H={H} color={option.color} shape={option.shape} />
      </Svg>
      <PanScoop station={station} fill={option.color} />
    </Frame>
  );
}

/** A stainless pan dropped into the topping bar. */
function Pan({ W, H }: { W: number; H: number }) {
  return (
    <>
      <Rect x={0} y={H * 0.26} width={W} height={H * 0.72} rx={6} fill="#D6DDE3" stroke={SHOP.steelEdge} strokeWidth={1.6} />
      <Rect x={0} y={H * 0.26} width={W} height={H * 0.1} rx={5} fill={SHOP.steelTop} />
      <Rect
        x={W * 0.09}
        y={H * 0.38}
        width={W * 0.82}
        height={H * 0.52}
        rx={4}
        fill={SHOP.steelDeep}
        stroke="#7D888F"
        strokeWidth={1}
      />
    </>
  );
}

/** The topping itself, heaped up in the pan. */
function Pieces({ W, H, color, shape }: { W: number; H: number; color: string; shape: 'pearl' | 'cube' }) {
  const r = W * 0.085;
  const spots = [
    [0.2, 0.52],
    [0.38, 0.47],
    [0.56, 0.5],
    [0.74, 0.54],
    [0.29, 0.65],
    [0.47, 0.62],
    [0.65, 0.65],
    [0.2, 0.76],
    [0.38, 0.78],
    [0.56, 0.77],
    [0.74, 0.75],
  ];
  return (
    <>
      {spots.map(([fx, fy], i) =>
        shape === 'pearl' ? (
          <Circle key={i} cx={W * fx + r} cy={H * fy} r={r} fill={color} stroke="rgba(0,0,0,0.22)" strokeWidth={0.7} />
        ) : (
          <Rect
            key={i}
            x={W * fx}
            y={H * fy - r}
            width={r * 2}
            height={r * 2}
            rx={1.6}
            fill={color}
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={0.7}
          />
        ),
      )}
      {spots
        .filter((_, i) => i % 3 === 0)
        .map(([fx, fy], i) => (
          <Circle key={`s${i}`} cx={W * fx + r * 0.6} cy={H * fy - r * 0.4} r={r * 0.3} fill="#FFFFFF" opacity={0.45} />
        ))}
    </>
  );
}

/** The scoop that lives in a pan: chrome bowl buried in the topping, pink handle sticking out. */
function PanScoop({ station, fill }: { station: Station; fill: string }) {
  const { w: W, h: H } = station;
  return (
    <View pointerEvents="none" style={[styles.tool, { left: W * 0.47, top: -H * 0.06 }]}>
      <Svg width={W * 0.44} height={H * 0.95} viewBox="0 0 22 40">
        <Rect x={11} y={1} width={5} height={20} rx={2.5} fill={SHOP.pinkGrip} transform="rotate(16 13 11)" />
        <Rect x={12.2} y={3} width={1.3} height={13} rx={0.6} fill="#FFFFFF" opacity={0.4} transform="rotate(16 13 11)" />
        <Rect x={6.6} y={19} width={6} height={3.2} rx={1.4} fill="#C3CBD2" transform="rotate(16 9.5 20)" />
        <Path
          d="M1.5 22 h13 a1.8 1.8 0 0 1 1.8 1.8 v1.6 a8.2 6.4 0 0 1 -16.6 0 v-1.6 a1.8 1.8 0 0 1 1.8 -1.8 Z"
          fill="#E3E9ED"
          stroke={SHOP.steelEdge}
          strokeWidth={1}
        />
        <Path d="M2.4 25.4 h11.6 a7.4 4.6 0 0 1 -11.6 0 Z" fill={fill} opacity={0.9} />
      </Svg>
    </View>
  );
}

// --------------------------------------------------------------------------- ice chest

function IceChest({ station, build, carry }: EquipProps) {
  const { w: W, h: H } = station;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press);

  const cubes = [
    [0.18, 0.5],
    [0.4, 0.46],
    [0.62, 0.5],
    [0.28, 0.66],
    [0.5, 0.64],
    [0.7, 0.68],
    [0.2, 0.79],
    [0.44, 0.8],
    [0.66, 0.81],
  ];

  return (
    <Frame
      station={station}
      label={build.iceScoops > 0 ? (build.iceScoops === 1 ? 'Ít đá' : 'Đá thường') : 'Thùng đá'}
      accessibilityLabel="Thùng đá — kéo vào ly"
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        <Pan W={W} H={H} />
        {cubes.map(([fx, fy], i) => (
          <Rect
            key={i}
            x={W * fx}
            y={H * fy - W * 0.08}
            width={W * 0.17}
            height={W * 0.17}
            rx={2.5}
            fill="#F4FCFF"
            stroke="#A8D6EE"
            strokeWidth={1}
          />
        ))}
        {/* how many scoops already went in the cup */}
        {[0, 1].map((i) => (
          <Circle
            key={i}
            cx={W * 0.4 + i * W * 0.2}
            cy={H * 0.32}
            r={W * 0.045}
            fill={i < build.iceScoops ? colors.sky : '#FFFFFF'}
            stroke={SHOP.steelEdge}
            strokeWidth={1}
          />
        ))}
      </Svg>

      <PanScoop station={station} fill="#DCF2FC" />
    </Frame>
  );
}

// --------------------------------------------------------------------------- syrup pump

function SyrupPump({ station, build, carry }: EquipProps) {
  const { w: W, h: H } = station;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press);
  const pumps = build.sugarPumps;

  const bottleY = H * 0.26;
  const bottleH = H * 0.6;
  const syrup = bottleH * 0.78;

  return (
    <Frame
      station={station}
      label={pumps > 0 ? `${SUGAR_STEPS[pumps - 1]}%` : 'Đường'}
      accessibilityLabel="Bình đường — kéo vào ly"
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        {/* a little wooden coaster, like everything else on this counter */}
        <Rect x={0} y={H * 0.84} width={W} height={H * 0.14} rx={4} fill={SHOP.wood} />
        <Rect x={0} y={H * 0.84} width={W} height={H * 0.04} rx={3} fill={SHOP.woodTop} />

        {/* glass syrup bottle */}
        <Rect
          x={W * 0.08}
          y={bottleY}
          width={W * 0.84}
          height={bottleH}
          rx={W * 0.18}
          fill="#FFF8EA"
          stroke="#E4D2AE"
          strokeWidth={1.4}
        />
        <Rect x={W * 0.13} y={bottleY + bottleH - syrup} width={W * 0.74} height={syrup - 2} rx={W * 0.14} fill="#EFAE2B" />
        <Rect x={W * 0.2} y={bottleY + 5} width={W * 0.1} height={bottleH * 0.55} rx={W * 0.05} fill="#FFFFFF" opacity={0.45} />
        <Rect x={W * 0.14} y={bottleY + bottleH * 0.46} width={W * 0.72} height={bottleH * 0.22} rx={2} fill="#FFFDF6" opacity={0.92} />
        <Path d={heartPath(W * 0.5, bottleY + bottleH * 0.57, W * 0.1)} fill="#F6C56B" />

        {/* wooden collar and a pink pump head */}
        <Rect x={W * 0.26} y={H * 0.17} width={W * 0.48} height={H * 0.1} rx={3} fill={SHOP.woodEdge} />
        <Rect x={W * 0.42} y={H * 0.07} width={W * 0.16} height={H * 0.11} rx={2} fill="#C8D0D4" />
        <Rect x={W * 0.3} y={H * 0.03} width={W * 0.42} height={H * 0.06} rx={3} fill={SHOP.pinkGrip} />

        {/* dose pips */}
        {[0, 1, 2].map((i) => (
          <Circle
            key={i}
            cx={W * 0.26 + i * W * 0.24}
            cy={H * 0.91}
            r={W * 0.07}
            fill={i < pumps ? '#C98A1E' : '#FFF3D9'}
            stroke={SHOP.woodEdge}
            strokeWidth={0.8}
          />
        ))}
      </Svg>
    </Frame>
  );
}

// --------------------------------------------------------------------------- foam tubs

function FoamTub({ station, cup, carry }: EquipProps) {
  const { w: W, h: H } = station;
  const option = getIngredient('foam', station.id);
  const inCup = cup.foam === station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press);

  const color = option?.color ?? '#FFF0C9';
  const tubY = H * 0.3;
  const tubH = H * 0.66;

  return (
    <Frame
      station={station}
      locked={Boolean(cup.foam) && !inCup}
      label={station.id === 'cheese' ? 'Phô mai' : 'Brûlée'}
      accessibilityLabel={`Hũ ${option?.name ?? 'kem'} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Svg width={W} height={H}>
        {/* stainless tub */}
        <Path
          d={`M${W * 0.12} ${tubY} h${W * 0.76} l${-W * 0.07} ${tubH} h${-W * 0.62} Z`}
          fill="#E3E9ED"
          stroke={SHOP.steelEdge}
          strokeWidth={1.4}
        />
        <Rect x={W * 0.06} y={tubY - H * 0.04} width={W * 0.88} height={H * 0.06} rx={3} fill="#D5DDE3" />
        <Rect x={W * 0.06} y={tubY - H * 0.04} width={W * 0.88} height={H * 0.02} rx={2} fill={SHOP.steelTop} />
        {/* whipped dome, swirled */}
        <Path
          d={`M${W * 0.14} ${tubY} q${W * 0.16} ${-H * 0.16} ${W * 0.36} ${-H * 0.02} q${W * 0.14} ${-H * 0.1} ${W * 0.36} ${H * 0.02} Z`}
          fill={color}
          stroke={shade(color, -12)}
          strokeWidth={1.1}
        />
        <Path d={`M${W * 0.28} ${tubY - H * 0.045} q${W * 0.1} ${-H * 0.03} ${W * 0.2} 0`} stroke="#FFFFFF" strokeWidth={1.4} fill="none" opacity={0.7} />
        {/* label band */}
        <Rect x={W * 0.2} y={tubY + tubH * 0.38} width={W * 0.56} height={tubH * 0.24} rx={2} fill="#FFFFFF" opacity={0.85} />
        <Path d={heartPath(W * 0.48, tubY + tubH * 0.5, W * 0.07)} fill={SHOP.pink} />
      </Svg>

      <View style={[styles.tool, { left: W * 0.04, top: -H * 0.12 }]}>
        <Svg width={W * 0.44} height={H * 0.56} viewBox="0 0 24 30">
          <Rect x={10.2} y={0} width={4.4} height={17} rx={2.2} fill={SHOP.pinkGrip} />
          <Rect x={11.2} y={2} width={1.2} height={11} rx={0.6} fill="#FFFFFF" opacity={0.4} />
          <Ellipse cx={12} cy={23} rx={6.8} ry={5} fill="#E3E9ED" stroke={SHOP.steelEdge} strokeWidth={1} />
          <Ellipse cx={12} cy={21.6} rx={5.2} ry={3.2} fill={color} />
        </Svg>
      </View>
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
    opacity: 0.42,
  },
  ring: {
    position: 'absolute',
    top: 1,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,111,156,0.1)',
  },
  label: {
    marginTop: 1,
    fontSize: 9.5,
    lineHeight: 13,
    fontFamily: fonts.semi,
    color: '#6B4422',
    maxWidth: '100%',
    backgroundColor: SHOP.plaque,
    borderWidth: 1.5,
    borderColor: SHOP.woodEdge,
    borderRadius: 4,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  labelActive: {
    color: '#A33A62',
    fontFamily: fonts.bold,
    backgroundColor: '#FFE3EC',
    borderColor: colors.primary,
  },
  lever: {
    position: 'absolute',
  },
  tool: {
    position: 'absolute',
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
  cupBacking: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Clear plastic: enough body to read over the shelves, not so much that it looks painted.
    backgroundColor: 'rgba(252,254,254,0.72)',
  },
  cupShadow: {
    position: 'absolute',
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.counterDark,
  },
  drop: {
    position: 'absolute',
    width: 4,
    height: 7,
    borderRadius: 2,
    opacity: 0.85,
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
