import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  CategoryId,
  Drink,
  getIngredient,
  MAX_ICE_SCOOPS,
  MAX_POUR,
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
import { Cup } from './Cup';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  /** Full width of this station's column — the press target and the name under it. */
  slot: number;
  /** Line the equipment stands on. */
  base: number;
  /** Where liquid leaves it, measured inside the box. */
  spout: number;
  /** Where the cup's bottom goes while you work here: held just under the equipment. */
  dockY: number;
}

interface Shelf {
  base: number;
}

export interface KitchenLayout {
  stations: Station[];
  shelves: Shelf[];
  /** Top of the wooden work surface the whole lower kitchen stands on. */
  counterTop: number;
  /** The prep table's surface — where the cup rests between jobs. */
  tableLine: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/** How wide each piece of equipment is relative to its height. */
const ASPECT: Record<StationKind, number> = {
  tea: 0.6,
  milk: 0.52,
  topping: 0.92,
  ice: 1.06,
  sugar: 0.46,
  foam: 0.84,
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
 * Arrange the kitchen: shelves of equipment above, a clear prep table along the bottom. Every
 * station gets a dock — the spot the cup is held while that piece of equipment runs into it.
 */
export function layoutKitchen(config: DayConfig, W: number, H: number): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H);
  // The table is a band along the bottom: the cup rests on its surface, hints sit on the wood.
  const tableLine = H - Math.max(22, Math.round(H * 0.055));
  // The awning hangs over the top of the room, so the top shelf starts under it.
  const top = 18;
  const labelH = 13;

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

  // Everything sits above the table, leaving a clear band for the cup to stand in.
  const avail = tableLine - cupH - 16 - top;
  const weights = rows.map((row) => (row[0].kind === 'tea' ? 1.3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);

  const stations: Station[] = [];
  const shelves: Shelf[] = [];
  let y = top;

  rows.forEach((items, r) => {
    const rowH = (avail * weights[r]) / total;
    const base = Math.round(y + rowH - labelH);
    const slot = (W - 6) / items.length;
    const maxH = rowH - labelH - 6;

    items.forEach((item, i) => {
      const aspect = ASPECT[item.kind];
      const w = Math.round(Math.min(slot - 8, maxH * aspect));
      const h = Math.round(w / aspect);
      const cx = Math.round(3 + slot * (i + 0.5));
      const option = item.kind === 'ice' || item.kind === 'sugar' ? undefined : getIngredient(categoryOf(item.kind), item.id);
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
        spout: item.kind === 'tea' ? Math.round(h * 0.72) : item.kind === 'milk' ? Math.round(h * 0.2) : h,
        dockY: base + cupH + 6,
      });
    });

    shelves.push({ base });
    y += rowH;
  });

  return {
    stations,
    shelves,
    // The work surface starts just under the lowest shelf of equipment.
    counterTop: Math.round((shelves[shelves.length - 1]?.base ?? top) + 12),
    tableLine,
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
  /** The pager must stop swiping while the cup is being dragged. */
  onDragging: (dragging: boolean) => void;
  /** Measured for the coin/toss effects. */
  cupRef: React.RefObject<View | null>;
}

/**
 * The kitchen you actually work in. The cup is a physical object on the prep table: drag it under
 * a tea dispenser and hold the tap to fill it (how long you hold is how much tea goes in, and the
 * cup has to reach the "đủ" line), drag it to a bin and scoop toppings in, to the ice chest, the
 * syrup pump, the milk carton, the foam tub. A cup already holding tea locks the other dispensers —
 * tip it out to start over.
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
  const { stations, shelves, tableLine, cupW, cupH, homeX, homeY } = layout;

  const cupX = useSharedValue(homeX);
  const cupY = useSharedValue(homeY);
  /** 0 = standing on the table, 1 = held up to a machine. */
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
      // Left standing on the table it goes home; lifted up to a machine it docks there.
      const lifted = cupY.get() + cupH < tableLine - 2;
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

  const cupStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cupX.value },
      { translateY: cupY.value },
      { scale: 1 + lift.value * 0.05 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.22 * (1 - lift.value),
    transform: [{ translateX: cupX.value }, { translateY: cupY.value }],
  }));

  const hint = nudge.text || hintFor(docked, cup, build);

  const equipment = { cup, build, level, onNudge: nudge.show, onPouring: setPouring };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Furniture
        width={W}
        height={H}
        shelves={shelves}
        tableLine={tableLine}
        matX={homeX - Math.round(cupW * 0.3)}
        matW={Math.round(cupW * 1.6)}
      />

      {stations.map((station) => {
        const props = { station, active: docked?.key === station.key, ...equipment };
        switch (station.kind) {
          case 'tea':
            return <TeaDispenser key={station.key} {...props} onPour={onPour} />;
          case 'milk':
            return <MilkCarton key={station.key} {...props} onPour={onPour} />;
          case 'topping':
            return <ToppingBin key={station.key} {...props} max={config.maxToppings} onScoop={onScoop} />;
          case 'ice':
            return <IceChest key={station.key} {...props} onIce={onIce} />;
          case 'sugar':
            return <SyrupPump key={station.key} {...props} onSugar={onSugar} />;
          default:
            return <FoamTub key={station.key} {...props} onScoop={onScoop} />;
        }
      })}

      {/* The cup: a thing on the table you pick up and carry around the kitchen. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.cupShadow, { width: cupW, height: cupW * 0.3, top: cupH - cupW * 0.14 }, shadowStyle]}
      />
      <Animated.View
        ref={cupRef}
        {...pan.panHandlers}
        accessible
        accessibilityLabel="Ly đang pha — kéo tới thiết bị"
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
        <Spill level={level} cupW={cupW} cupH={cupH} color={inCup.tea ? (getIngredient('tea', inCup.tea)?.color ?? colors.ink) : '#F7F4EC'} />
      </Animated.View>

      <View style={[styles.hintRow, { bottom: Math.max(2, (H - tableLine) / 2 - 9) }]} pointerEvents="none">
        <View style={styles.hint}>
          <Text style={styles.hintText} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Which station the cup was dropped at: it has to be lined up under the equipment. */
function findStation(stations: Station[], x: number, y: number, cupW: number, cupH: number): Station | null {
  let best: Station | null = null;
  let bestScore = Infinity;
  for (const station of stations) {
    const dx = Math.abs(x + cupW / 2 - station.cx) / (station.slot / 2 + cupW * 0.3);
    const dy = Math.abs(y - (station.base + 6)) / (cupH * 0.85);
    if (dx > 1 || dy > 1) continue;
    if (dx + dy < bestScore) {
      bestScore = dx + dy;
      best = station;
    }
  }
  return best;
}

function hintFor(station: Station | null, cup: Drink, build: CupBuild): string {
  if (!station) {
    return build.fill >= MIN_FILL ? 'Kéo ly tới thiết bị khác, hoặc bấm Phục vụ' : 'Kéo ly tới bình trà rồi nhấn giữ vòi';
  }
  switch (station.kind) {
    case 'tea':
      if (cup.tea && cup.tea !== station.id) return 'Ly đã có trà khác — Đổ bỏ rồi rót lại';
      if (build.fill < MIN_FILL) return `Nhấn giữ vòi: rót ${station.name} tới vạch`;
      return 'Đủ trà rồi — giữ thêm sẽ tràn';
    case 'milk':
      if (cup.milk && cup.milk !== station.id) return 'Ly đã có loại sữa khác rồi';
      return `Nhấn giữ để rót ${station.name}`;
    case 'topping':
      return cup.toppings.includes(station.id) ? `Đã có ${station.name}` : `Chạm để múc ${station.name}`;
    case 'ice':
      return build.iceScoops >= MAX_ICE_SCOOPS ? 'Đá đã đầy' : 'Chạm để xúc đá (mỗi lần 2 viên)';
    case 'sugar':
      return build.sugarPumps >= SUGAR_STEPS.length ? 'Ngọt tối đa' : 'Chạm để nhấn bơm đường';
    default:
      return cup.foam ? 'Đã có kem' : `Chạm để phết ${station.name}`;
  }
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
        <Drop key={at} level={level} left={cupW * at - 2} cupH={cupH} color={color} offset={i * 0.07} />
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
      transform: [{ translateY: interpolate(over, [0, MAX_POUR - 1], [0, cupH * 0.8]) }],
    };
  });
  return <Animated.View style={[styles.drop, { left, top: cupH * 0.1, backgroundColor: color }, style]} />;
}

// --------------------------------------------------------------------------- the room

/** Shelves, their brackets, and the wooden prep table the cup lives on. */
function Furniture({
  width: W,
  height: H,
  shelves,
  tableLine,
  matX,
  matW,
}: {
  width: number;
  height: number;
  shelves: Shelf[];
  tableLine: number;
  matX: number;
  matW: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="ksTable" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.counterLight} />
            <Stop offset="1" stopColor={colors.counterEdge} />
          </LinearGradient>
        </Defs>

        {shelves.map(({ base }, i) => (
          <Fragment key={i}>
            {/* steel shelf with a lip, on wall brackets */}
            <Rect x={0} y={base} width={W} height={6} rx={2} fill="#E4D3C2" />
            <Rect x={0} y={base} width={W} height={2} fill="#FFF6EC" opacity={0.9} />
            <Rect x={0} y={base + 5} width={W} height={3} fill="#C9B19C" />
            {[0.16, 0.5, 0.84].map((at) => (
              <Path key={at} d={`M${W * at - 4.5} ${base + 8} h9 l-4.5 5.5 Z`} fill="#C9B19C" opacity={0.6} />
            ))}
          </Fragment>
        ))}

        {/* the rubber mat the cup stands on between jobs */}
        <Rect
          x={matX}
          y={tableLine - 11}
          width={matW}
          height={14}
          rx={7}
          fill={colors.counterDark}
          opacity={0.16}
        />
        <Rect
          x={matX + 4}
          y={tableLine - 9}
          width={matW - 8}
          height={10}
          rx={5}
          fill="none"
          stroke={colors.counterDark}
          strokeWidth={1.2}
          strokeDasharray="4 4"
          opacity={0.3}
        />

        {/* the prep table's front edge */}
        <Rect x={0} y={tableLine} width={W} height={H - tableLine} fill="url(#ksTable)" />
        <Rect x={0} y={tableLine} width={W} height={3} fill="#FFF0DC" opacity={0.9} />
        <Rect x={0} y={tableLine + 6} width={W} height={1.5} fill={colors.counterDark} opacity={0.25} />
      </Svg>
    </View>
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
}

interface FrameProps {
  station: Station;
  active: boolean;
  label: string;
  done?: boolean;
  locked?: boolean;
  accessibilityLabel: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
}

/** Every machine is a press target with its name under it; the one the cup is at glows. */
function Frame({
  station,
  active,
  label,
  done,
  locked,
  accessibilityLabel,
  onPress,
  onPressIn,
  onPressOut,
  children,
}: FrameProps) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <AnimatedPressable
      onPressIn={() => {
        press.set(withTiming(0.96, { duration: 70 }));
        onPressIn?.();
      }}
      onPressOut={() => {
        press.set(withTiming(1, { duration: 160, easing: ease }));
        onPressOut?.();
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={[
        styles.frame,
        { left: station.cx - station.slot / 2, top: station.y - 6, width: station.slot },
        style,
      ]}
    >
      <View style={[{ width: station.w, height: station.h }, locked && styles.locked]}>{children}</View>
      {active && <View style={[styles.ring, { width: station.w + 10, height: station.h + 10 }]} />}
      {done && (
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      )}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Holding a tap open: how long you hold is how much runs into the cup. */
function useHoldPour({
  enabled,
  fill,
  level,
  onStart,
  onCommit,
  onBlocked,
}: {
  enabled: boolean;
  fill: number;
  level: SharedValue<number>;
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
    setPouring(true);
    onStart(true);
    const room = Math.max(0.02, MAX_POUR - fill);
    level.set(withTiming(MAX_POUR, { duration: (room / POUR_RATE) * 1000, easing: Easing.linear }));
  };
  const up = () => {
    if (!pouring) return;
    setPouring(false);
    onStart(false);
    const amount = ((Date.now() - startedAt.current) / 1000) * POUR_RATE;
    level.set(withTiming(Math.min(1, fill + amount), timing(DURATION.fast)));
    onCommit(amount);
  };
  return { pouring, down, up };
}

/** A one-shot 0→1→0 used for scoop and pump movements. */
function useAction() {
  const act = useSharedValue(0);
  const fire = () =>
    act.set(
      withSequence(withTiming(1, { duration: 260, easing: ease }), withTiming(0, { duration: 380, easing: ease })),
    );
  return { act, fire };
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

function TeaDispenser({ station, active, cup, build, level, onNudge, onPouring, onPour }: EquipProps & { onPour: KitchenStationProps['onPour'] }) {
  const { w: W, h: H } = station;
  const tea = getIngredient('tea', station.id) as Tea;
  const locked = cup.tea !== null && cup.tea !== station.id;
  const { pouring, down, up } = useHoldPour({
    enabled: active && !locked,
    fill: build.fill,
    level,
    onStart: (running) => onPouring(running ? { category: 'tea', id: station.id } : null),
    onCommit: (amount) => onPour('tea', station.id, amount),
    onBlocked: () =>
      onNudge(locked ? 'Ly đã có trà khác — bấm Đổ bỏ trước' : `Kéo ly xuống dưới vòi ${tea.name} trước`),
  });

  const lever = useAnimatedStyle(() => ({ transform: [{ rotate: pouring ? '-26deg' : '0deg' }] }));

  const tankY = H * 0.08;
  const tankH = H * 0.56;
  const liquidY = tankY + tankH * 0.14;

  return (
    <Frame
      station={station}
      active={active}
      locked={locked}
      done={cup.tea === station.id}
      label={tea.name}
      accessibilityLabel={`Bình ${tea.name}`}
      onPressIn={down}
      onPressOut={up}
    >
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={`gl-${station.key}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.45} />
          </LinearGradient>
        </Defs>

        {/* stand: two legs over a drip tray, so a cup fits under the tap */}
        <Rect x={W * 0.16} y={H * 0.64} width={W * 0.1} height={H * 0.3} fill="#B9C0BD" />
        <Rect x={W * 0.74} y={H * 0.64} width={W * 0.1} height={H * 0.3} fill="#B9C0BD" />
        <Rect x={W * 0.08} y={H * 0.92} width={W * 0.84} height={H * 0.06} rx={2} fill="#8F9794" />
        <Rect x={W * 0.14} y={H * 0.88} width={W * 0.72} height={H * 0.045} rx={1.5} fill="#D7DEDB" />
        {[0.3, 0.5, 0.7].map((at) => (
          <Rect key={at} x={W * at} y={H * 0.885} width={1.4} height={H * 0.035} fill="#A9B2AF" />
        ))}

        {/* glass tank with the tea in it */}
        <Rect x={W * 0.1} y={tankY} width={W * 0.8} height={tankH} rx={W * 0.1} fill="#EFF5F4" stroke="#C7D4D1" strokeWidth={1.4} />
        <Rect x={W * 0.13} y={liquidY} width={W * 0.74} height={tankY + tankH - liquidY - 2} rx={W * 0.08} fill={tea.color} />
        <Rect x={W * 0.13} y={liquidY} width={W * 0.74} height={2.5} fill="#FFFFFF" opacity={0.35} />
        <Rect x={W * 0.1} y={tankY} width={W * 0.8} height={tankH} rx={W * 0.1} fill={`url(#gl-${station.key})`} />
        {/* front label */}
        <Rect x={W * 0.22} y={tankY + tankH * 0.56} width={W * 0.56} height={tankH * 0.26} rx={3} fill="#FFFDF6" opacity={0.92} />
        <Rect x={W * 0.28} y={tankY + tankH * 0.64} width={W * 0.44} height={2} rx={1} fill={shade(tea.color, -10)} opacity={0.7} />
        <Rect x={W * 0.28} y={tankY + tankH * 0.7} width={W * 0.3} height={2} rx={1} fill={shade(tea.color, -10)} opacity={0.5} />

        {/* lid and knob */}
        <Rect x={W * 0.06} y={tankY - H * 0.055} width={W * 0.88} height={H * 0.07} rx={3} fill="#AFB8B5" />
        <Rect x={W * 0.06} y={tankY - H * 0.055} width={W * 0.88} height={H * 0.022} rx={3} fill="#D6DEDB" />
        <Rect x={W * 0.43} y={tankY - H * 0.1} width={W * 0.14} height={H * 0.05} rx={3} fill="#9AA3A0" />

        {/* chrome tap body */}
        <Rect x={W * 0.4} y={tankY + tankH - 1} width={W * 0.2} height={H * 0.08} rx={2} fill="#CBD2CF" />
        <Rect x={W * 0.44} y={tankY + tankH + H * 0.06} width={W * 0.12} height={H * 0.05} rx={2} fill="#A8B0AD" />
      </Svg>

      {/* the lever you hold */}
      <Animated.View style={[styles.lever, { left: W * 0.56, top: H * 0.6 }, lever]}>
        <Svg width={W * 0.34} height={H * 0.1}>
          <Rect x={0} y={H * 0.028} width={W * 0.3} height={H * 0.035} rx={H * 0.018} fill="#8F9794" />
          <Circle cx={W * 0.29} cy={H * 0.045} r={H * 0.028} fill={colors.primaryDark} />
        </Svg>
      </Animated.View>

      <Stream x={W / 2} top={station.spout} length={station.base - station.y - station.spout + 7} color={tea.color} on={pouring} />
    </Frame>
  );
}

// --------------------------------------------------------------------------- milk cartons

function MilkCarton({ station, active, cup, build, level, onNudge, onPouring, onPour }: EquipProps & { onPour: KitchenStationProps['onPour'] }) {
  const { w: W, h: H } = station;
  const oat = station.id === 'oat';
  const body = oat ? '#F3E6CD' : '#FFFFFF';
  const band = oat ? '#C08E4F' : '#5AA9E6';
  const locked = cup.milk !== null && cup.milk !== station.id;
  const { pouring, down, up } = useHoldPour({
    enabled: active && !locked,
    fill: build.fill,
    level,
    onStart: (running) => onPouring(running ? { category: 'milk', id: station.id } : null),
    onCommit: (amount) => onPour('milk', station.id, amount),
    onBlocked: () => onNudge(locked ? 'Ly đã có loại sữa khác' : 'Kéo ly tới hộp sữa trước'),
  });
  const tip = useAnimatedStyle(() => ({ transform: [{ rotate: pouring ? '-24deg' : '0deg' }] }));

  return (
    <Frame
      station={station}
      active={active}
      locked={locked}
      done={cup.milk === station.id}
      label={oat ? 'Yến mạch' : 'Sữa tươi'}
      accessibilityLabel={`Hộp ${station.name}`}
      onPressIn={down}
      onPressOut={up}
    >
      <Animated.View style={[{ width: W, height: H }, tip]}>
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
          {/* screw cap on the gable */}
          <Rect x={W * 0.56} y={H * 0.12} width={W * 0.16} height={H * 0.07} rx={2} fill={shade(band, -18)} />
        </Svg>
      </Animated.View>
      <Stream x={W * 0.16} top={station.spout} length={station.base - station.y - station.spout + 7} color="#F7F4EC" on={pouring} />
    </Frame>
  );
}

// --------------------------------------------------------------------------- topping bins

function ToppingBin({
  station,
  active,
  cup,
  max,
  onNudge,
  onScoop,
}: EquipProps & { max: number; onScoop: KitchenStationProps['onScoop'] }) {
  const { w: W, h: H } = station;
  const option = getIngredient('toppings', station.id) as Topping;
  const inCup = cup.toppings.includes(station.id);
  const full = !inCup && cup.toppings.length >= max;
  const { act, fire } = useAction();

  const scoop = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(act.value, [0, 1], [0, H * 0.46]) },
      { translateX: interpolate(act.value, [0, 1], [0, -W * 0.18]) },
      { rotate: `${interpolate(act.value, [0, 1], [-8, 128])}deg` },
    ],
  }));

  const handle = () => {
    if (!active) {
      onNudge(`Kéo ly tới hộp ${option.name} trước`);
      return;
    }
    if (inCup) {
      onNudge(`Ly đã có ${option.name}`);
      return;
    }
    if (cup.toppings.length >= max) {
      onNudge(max === 1 ? 'Ly chỉ được 1 topping' : `Tối đa ${max} topping`);
      return;
    }
    fire();
    onScoop('toppings', station.id);
  };

  const binY = H * 0.2;
  const binH = H * 0.78;
  const pearl = option.shape === 'pearl';
  const piece = W * 0.15;
  const mound = [
    [0.26, 0.42],
    [0.44, 0.3],
    [0.62, 0.4],
    [0.35, 0.22],
    [0.55, 0.2],
    [0.73, 0.26],
  ];

  return (
    <Frame
      station={station}
      active={active}
      done={inCup}
      locked={full}
      label={option.name}
      accessibilityLabel={`Hộp ${option.name}`}
      onPress={handle}
    >
      <Svg width={W} height={H}>
        {/* lid, hinged open at the back */}
        <Path
          d={`M${W * 0.06} ${binY} l${W * 0.1} ${-H * 0.16} h${W * 0.78} l${-W * 0.1} ${H * 0.16} Z`}
          fill="#F6EADD"
          stroke="#DCC9B6"
          strokeWidth={1.2}
        />
        {/* bin body */}
        <Rect x={W * 0.06} y={binY} width={W * 0.88} height={binH} rx={4} fill="#FFFDF6" stroke="#E0CDBA" strokeWidth={1.4} />
        <Rect x={W * 0.06} y={binY} width={W * 0.88} height={binH * 0.2} fill="#EFE0CF" />
        {/* the topping itself, mounded up inside */}
        {mound.map(([fx, fy], i) =>
          pearl ? (
            <Circle key={i} cx={W * fx + piece / 2} cy={binY + binH * fy} r={piece / 2} fill={option.color} stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} />
          ) : (
            <Rect
              key={i}
              x={W * fx}
              y={binY + binH * fy - piece / 2}
              width={piece}
              height={piece}
              rx={1.5}
              fill={option.color}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth={0.8}
            />
          ),
        )}
        {/* name plate */}
        <Rect x={W * 0.16} y={binY + binH * 0.66} width={W * 0.68} height={binH * 0.24} rx={2.5} fill="#FFFFFF" opacity={0.9} />
        <Rect x={W * 0.24} y={binY + binH * 0.73} width={W * 0.42} height={2} rx={1} fill={colors.inkSoft} opacity={0.5} />
      </Svg>

      {/* the scoop, which digs in and tips into the cup below */}
      <Animated.View style={[styles.tool, { right: -W * 0.02, top: -H * 0.03 }, scoop]}>
        <Svg width={W * 0.4} height={H * 0.44} viewBox="0 0 24 26">
          <Rect x={10.5} y={0} width={3} height={13} rx={1.5} fill="#8F9794" />
          <Path d="M4 13 h16 a2 2 0 0 1 2 2 v2 a10 7 0 0 1 -20 0 v-2 a2 2 0 0 1 2 -2 Z" fill="#D4D9DE" stroke="#A9B0B8" strokeWidth={1} />
          <Path d="M5 17 h14 a9 5 0 0 1 -14 0 Z" fill={option.color} opacity={0.9} />
        </Svg>
      </Animated.View>
    </Frame>
  );
}

// --------------------------------------------------------------------------- ice chest

function IceChest({ station, active, build, onNudge, onIce }: EquipProps & { onIce: () => void }) {
  const { w: W, h: H } = station;
  const { act, fire } = useAction();
  const scoop = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(act.value, [0, 1], [0, H * 0.5]) },
      { rotate: `${interpolate(act.value, [0, 1], [-6, 120])}deg` },
    ],
  }));

  const handle = () => {
    if (!active) {
      onNudge('Kéo ly tới thùng đá trước');
      return;
    }
    if (build.iceScoops >= MAX_ICE_SCOOPS) {
      onNudge('Đá đã đầy ly');
      return;
    }
    fire();
    onIce();
  };

  const boxY = H * 0.26;
  const boxH = H * 0.7;
  const cubes = [
    [0.2, 0.3],
    [0.42, 0.22],
    [0.62, 0.3],
    [0.34, 0.46],
    [0.56, 0.46],
  ];

  return (
    <Frame
      station={station}
      active={active}
      label={build.iceScoops > 0 ? (build.iceScoops === 1 ? 'Ít đá' : 'Đá thường') : 'Thùng đá'}
      accessibilityLabel="Thùng đá"
      onPress={handle}
    >
      <Svg width={W} height={H}>
        {/* open lid */}
        <Path
          d={`M${W * 0.04} ${boxY} l${W * 0.12} ${-H * 0.18} h${W * 0.8} l${-W * 0.12} ${H * 0.18} Z`}
          fill="#D3E9F4"
          stroke="#A3CADD"
          strokeWidth={1.2}
        />
        {/* chest */}
        <Rect x={W * 0.04} y={boxY} width={W * 0.92} height={boxH} rx={6} fill="#E8F6FC" stroke="#A3CADD" strokeWidth={1.5} />
        <Rect x={W * 0.04} y={boxY} width={W * 0.92} height={boxH * 0.22} fill="#D7EDF7" />
        {/* cubes inside */}
        {cubes.map(([fx, fy], i) => (
          <Rect
            key={i}
            x={W * fx}
            y={boxY + boxH * fy}
            width={W * 0.17}
            height={W * 0.17}
            rx={2.5}
            fill="#F2FBFF"
            stroke="#9FD3EF"
            strokeWidth={1}
          />
        ))}
        {/* latch + how many scoops went in the cup */}
        <Rect x={W * 0.42} y={boxY + boxH * 0.72} width={W * 0.16} height={boxH * 0.16} rx={2} fill="#B6D7E6" />
        {[0, 1].map((i) => (
          <Circle
            key={i}
            cx={W * 0.36 + i * W * 0.28}
            cy={boxY + boxH * 0.93}
            r={W * 0.055}
            fill={i < build.iceScoops ? colors.sky : '#FFFFFF'}
            stroke="#A3CADD"
            strokeWidth={1}
          />
        ))}
      </Svg>

      <Animated.View style={[styles.tool, { right: -W * 0.04, top: -H * 0.1 }, scoop]}>
        <Svg width={W * 0.42} height={H * 0.48} viewBox="0 0 24 26">
          <Rect x={10.5} y={0} width={3} height={13} rx={1.5} fill="#8F9794" />
          <Path d="M4 13 h16 a2 2 0 0 1 2 2 v2 a10 7 0 0 1 -20 0 v-2 a2 2 0 0 1 2 -2 Z" fill="#EAF7FD" stroke="#A3CADD" strokeWidth={1} />
          <Rect x={7} y={14} width={5} height={5} rx={1} fill="#FFFFFF" stroke="#9FD3EF" strokeWidth={0.8} />
          <Rect x={13} y={15} width={4} height={4} rx={1} fill="#FFFFFF" stroke="#9FD3EF" strokeWidth={0.8} />
        </Svg>
      </Animated.View>
    </Frame>
  );
}

// --------------------------------------------------------------------------- syrup pump

function SyrupPump({ station, active, build, onNudge, onSugar }: EquipProps & { onSugar: () => void }) {
  const { w: W, h: H } = station;
  const { act, fire } = useAction();
  const pumps = build.sugarPumps;
  const head = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(act.value, [0, 1], [0, H * 0.055]) }] }));
  const squirt = useAnimatedStyle(() => ({
    opacity: act.value > 0.1 ? 1 : 0,
    height: interpolate(act.value, [0, 1], [0, H * 0.2]),
  }));

  const handle = () => {
    if (!active) {
      onNudge('Kéo ly tới bình đường trước');
      return;
    }
    if (pumps >= SUGAR_STEPS.length) {
      onNudge('Ngọt tối đa rồi');
      return;
    }
    fire();
    onSugar();
  };

  const bottleY = H * 0.3;
  const bottleH = H * 0.68;
  const syrup = bottleH * 0.8;

  return (
    <Frame
      station={station}
      active={active}
      label={pumps > 0 ? `${SUGAR_STEPS[pumps - 1]}%` : 'Đường'}
      accessibilityLabel="Bình đường"
      onPress={handle}
    >
      <Svg width={W} height={H}>
        {/* bottle */}
        <Rect x={W * 0.12} y={bottleY} width={W * 0.76} height={bottleH} rx={W * 0.16} fill="#FFF8EA" stroke="#E4D2AE" strokeWidth={1.4} />
        <Rect x={W * 0.16} y={bottleY + bottleH - syrup} width={W * 0.68} height={syrup - 2} rx={W * 0.12} fill="#EFAE2B" />
        <Rect x={W * 0.22} y={bottleY + 5} width={W * 0.1} height={bottleH * 0.62} rx={W * 0.05} fill="#FFFFFF" opacity={0.45} />
        <Rect x={W * 0.18} y={bottleY + bottleH * 0.5} width={W * 0.64} height={bottleH * 0.2} rx={2} fill="#FFFDF6" opacity={0.9} />
        {/* collar + neck */}
        <Rect x={W * 0.3} y={H * 0.2} width={W * 0.4} height={H * 0.12} rx={2} fill="#D9C49A" />
        {/* dose pips */}
        {[0, 1, 2].map((i) => (
          <Circle key={i} cx={W * 0.28 + i * W * 0.22} cy={bottleY + bottleH * 0.86} r={W * 0.07} fill={i < pumps ? '#C98A1E' : '#FFF3D9'} />
        ))}
      </Svg>

      {/* pump head and its spout */}
      <Animated.View style={[styles.tool, { left: W * 0.12, top: H * 0.06 }, head]}>
        <Svg width={W * 0.9} height={H * 0.16} viewBox="0 0 30 10">
          <Rect x={2} y={3} width={18} height={5} rx={2.5} fill="#C98A3A" />
          <Rect x={18} y={4} width={11} height={3} rx={1.5} fill="#C98A3A" />
          <Rect x={8} y={0} width={7} height={4} rx={2} fill="#A9712B" />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: W * 0.92, top: H * 0.2, width: 3, borderRadius: 2, backgroundColor: '#EFAE2B' }, squirt]}
      />
    </Frame>
  );
}

// --------------------------------------------------------------------------- foam tubs

function FoamTub({ station, active, cup, onNudge, onScoop }: EquipProps & { onScoop: KitchenStationProps['onScoop'] }) {
  const { w: W, h: H } = station;
  const option = getIngredient('foam', station.id);
  const { act, fire } = useAction();
  const inCup = cup.foam === station.id;
  const spatula = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(act.value, [0, 1], [0, H * 0.5]) },
      { rotate: `${interpolate(act.value, [0, 1], [10, 128])}deg` },
    ],
  }));

  const handle = () => {
    if (!active) {
      onNudge(`Kéo ly tới hũ ${option?.name ?? 'kem'} trước`);
      return;
    }
    if (cup.foam) {
      onNudge('Ly đã có kem');
      return;
    }
    fire();
    onScoop('foam', station.id);
  };

  const color = option?.color ?? '#FFF0C9';
  const tubY = H * 0.3;
  const tubH = H * 0.66;

  return (
    <Frame
      station={station}
      active={active}
      done={inCup}
      locked={Boolean(cup.foam) && !inCup}
      label={station.id === 'cheese' ? 'Phô mai' : 'Brûlée'}
      accessibilityLabel={`Hũ ${option?.name ?? 'kem'}`}
      onPress={handle}
    >
      <Svg width={W} height={H}>
        {/* stainless tub */}
        <Path d={`M${W * 0.12} ${tubY} h${W * 0.76} l${-W * 0.07} ${tubH} h${-W * 0.62} Z`} fill="#F2EFEA" stroke="#D8D1C6" strokeWidth={1.4} />
        <Rect x={W * 0.08} y={tubY - H * 0.03} width={W * 0.84} height={H * 0.05} rx={2} fill="#E6E1D8" />
        {/* whipped dome, swirled */}
        <Path
          d={`M${W * 0.14} ${tubY} q${W * 0.16} ${-H * 0.16} ${W * 0.36} ${-H * 0.02} q${W * 0.14} ${-H * 0.1} ${W * 0.36} ${H * 0.02} Z`}
          fill={color}
          stroke={shade(color, -12)}
          strokeWidth={1.1}
        />
        <Path d={`M${W * 0.28} ${tubY - H * 0.045} q${W * 0.1} ${-H * 0.03} ${W * 0.2} 0`} stroke="#FFFFFF" strokeWidth={1.4} fill="none" opacity={0.7} />
        {/* label band */}
        <Rect x={W * 0.2} y={tubY + tubH * 0.4} width={W * 0.56} height={tubH * 0.22} rx={2} fill="#FFFFFF" opacity={0.85} />
      </Svg>

      <Animated.View style={[styles.tool, { left: W * 0.08, top: -H * 0.06 }, spatula]}>
        <Svg width={W * 0.44} height={H * 0.46} viewBox="0 0 24 26">
          <Rect x={10.5} y={0} width={2.6} height={15} rx={1.3} fill="#8F9794" />
          <Ellipse cx={11.8} cy={19} rx={6.5} ry={4.5} fill="#E9E4DA" stroke="#CFC7B8" strokeWidth={1} />
          <Ellipse cx={11.8} cy={18} rx={5} ry={3} fill={color} />
        </Svg>
      </Animated.View>
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
  check: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.display,
  },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontFamily: fonts.semi,
    color: colors.ink,
    maxWidth: '100%',
  },
  labelActive: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  lever: {
    position: 'absolute',
  },
  tool: {
    position: 'absolute',
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
    backgroundColor: '#FFFDF9',
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
