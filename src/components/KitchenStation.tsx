import { memo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, GestureResponderHandlers, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
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
import { fonts } from '../theme';
import { KitchenRoom, kitchenHolderFor, kitchenTableFor, Shadow, SHOP } from './art/KitchenRoom';
import {
  ART,
  FOAM,
  ROOM_BG_ICE_MACHINE,
  ROOM_BG_SIZE,
  ROOM_BG_TEA_SHELF,
  ROOM_BG_TOPPING_SHELF,
  SCOOP,
  SCOOP_ART,
  SCOOP_BOWL,
  SCOOPFUL,
  TEA_DISPENSER_ART,
} from './art/kitchenArt';
import { CUP_ART, CUP_FOOT } from './cupGeometry';
import { KitchenCup } from './KitchenCup';
import { CupContactShadow, PourMeterState } from './PourFeedback';
import { GRABBY, Spill, Stream, useHoldPour } from './pour';
import { KitchenBottle, KitchenIceBox } from './art/KitchenEquipment';
import { TeaDispenserArt } from './art/TeaDispenserArt';
import { ToppingPanArt, ToppingScoopArt } from './art/ToppingSprites';
import { TOPPING_TAG } from './art/toppingArt';
import { toppingPanBounds, ToppingPanShape } from './art/toppingGeometry';
import { fitBackground } from './art/PannableBackground';
import { pointerEventsStyles } from '../pointerEvents';

// --------------------------------------------------------------------------- layout

type StationKind = 'tea' | 'milk' | 'topping' | 'ice' | 'sugar' | 'foam';
type ShelfKind = Exclude<StationKind, 'ice'>;

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
  /** Line the equipment stands on. */
  base: number;
  /** Where liquid leaves it, measured inside the box. */
  spout: number;
  /** Where the cup's bottom goes while you hold this tap open. */
  dockY: number;
  dockScale?: number;
  panShape?: ToppingPanShape;
}

/** A place on the topping tray the week has not reached yet, which an empty bin stands in. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  panShape?: ToppingPanShape;
}

export interface KitchenLayout {
  stations: Station[];
  /** The places on the topping tray with nothing in them yet, back row first. */
  emptyBins: Box[];
  /** Where a cup stands on the work top through the middle of the room. */
  /** Top of the counter's instruction strip. */
  cabinetTop: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/**
 * Cup stays on the foreground counter while the ingredient wall pans behind it.
 *
 * Its size is the work top's, not the screen's: the depth of the painted counter is what says how
 * big a cup standing on it looks, and that depth is however large the room is drawn. A flat cap in
 * screen pixels was a phone's cup on a tablet's counter — a thimble on a coaster three times its
 * width — so the only absolute left is a floor for small phones and a ceiling far enough out that
 * nothing but a desktop window reaches it.
 */
export function cupSizeFor(W: number, H: number) {
  const table = kitchenTableFor(W, H);
  const width = Math.round(Math.max(56, Math.min(150, W * 0.19, (table.base - table.top) * 0.58)));
  return { width, height: Math.round(width / ART.cup) };
}

/** All equipment uses the same projection as the painted shelves, including carried tools. */
export function layoutKitchen(config: DayConfig, W: number, H: number): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H);
  const { scale, top } = fitBackground(W, H, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  const stations: Station[] = [];
  const emptyBins: Box[] = [];
  const add = (kind: StationKind, id: string, x: number, y: number, w: number, h: number) => {
    const option = kind === 'ice' || kind === 'sugar' ? undefined : getIngredient(categoryOf(kind), id);
    const base = top + (y + h) * scale;
    stations.push({
      key: `${kind}-${id}`, kind, id, name: option?.name ?? (kind === 'ice' ? 'Đá' : 'Đường'),
      color: option?.color ?? '#D8B774', x: x * scale, y: top + y * scale,
      w: w * scale, h: h * scale, cx: (x + w / 2) * scale,
      slot: Math.max(44, w * scale), labelW: Math.max(44, w * scale), base,
      spout: h * scale * 0.96,
      dockY: base + cupH * Math.min(1, Math.max(0.7, 44 / cupW)) + 6 * scale,
      dockScale: Math.min(1, Math.max(0.7, 44 / cupW)),
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
    } else emptyBins.push({ x: bin.x * scale, y: top + bin.y * scale,
      w: bin.w * scale, h: bin.h * scale, panShape: bin.shape });
  });

  const extras: { kind: ShelfKind; id: string }[] = [
    ...(config.categories.includes('milk') ? [{ kind: 'milk' as const, id: 'whole' }, { kind: 'milk' as const, id: 'oat' }] : []),
    ...(config.categories.includes('sweetness') ? [{ kind: 'sugar' as const, id: 'sugar' }] : []),
    ...(config.categories.includes('foam') ? [{ kind: 'foam' as const, id: 'cheese' }, { kind: 'foam' as const, id: 'brulee' }] : []),
  ];
  const bottles = extras.filter((item) => item.kind !== 'foam');
  const bottleSlot = Math.max(68, 44 / scale);
  bottles.forEach(({ kind, id }, i) => {
    const w = Math.max(58, 28 / scale);
    const h = Math.max(145, 64 / scale);
    const cx = 856 + (i - (bottles.length - 1) / 2) * bottleSlot;
    add(kind, id, cx - w / 2, 510 - h, w, h);
  });
  extras.filter((item) => item.kind === 'foam').forEach(({ kind, id }, i) => {
    const w = Math.max(80, 40 / scale);
    const h = w / ART.foam;
    add(kind, id, 700 + i * 330 - w / 2, 675 - h, w, h);
  });
  if (config.categories.includes('ice')) {
    const ice = ROOM_BG_ICE_MACHINE;
    add('ice', 'ice', ice.x, ice.y, ice.width, ice.height);
  }
  // The cup rests in the middle of its holder, standing on its foot ring rather than on its box.
  const holder = kitchenHolderFor(W, H);
  return { stations, emptyBins, cabinetTop: H - 36, cupW, cupH,
    homeX: holder.left + (holder.width - cupW) / 2,
    homeY: holder.top + holder.height / 2 - cupH * CUP_FOOT / CUP_ART.h };
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
 *   hold is how much runs in, with a meter above the kitchen showing the live amount;
 * - **drag a topping, a scoop of ice, the syrup bottle or a spoon of foam straight onto the cup**,
 *   wherever the cup happens to be standing.
 *
 * A cup already holding tea locks the other dispensers — tip it out to start over.
 */
export const KitchenStation = memo(function KitchenStation({
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
  const { stations, emptyBins, cabinetTop, cupW, cupH, homeX, homeY } =
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
  const running = Boolean(pouring?.running);
  useEffect(() => {
    onMeterChange(docked ? { level, color: docked.color, running } : null);
  }, [docked, level, running, onMeterChange]);
  useEffect(() => () => onMeterChange(null), [onMeterChange]);
  const nudge = useNudge();

  useEffect(() => {
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    cupScale.set(withTiming(1, timing()));
    // A new cup starts empty, back on the table.
  }, [cupId, cupX, cupY, cupScale, homeX, homeY]);

  useEffect(() => {
    level.set(withTiming(build.fill, timing(DURATION.base)));
  }, [build.fill, cupId, level]);

  /** Send the cup back to its coaster, wherever it was left. */
  const standCupDown = useCallback(() => {
    setDock({ cupId, key: null });
    setPouring(null);
    cupX.set(withTiming(homeX, timing(DURATION.slow)));
    cupY.set(withTiming(homeY, timing(DURATION.slow)));
    cupScale.set(withTiming(1, timing(DURATION.slow)));
  }, [cupId, cupX, cupY, cupScale, homeX, homeY]);

  const startPouring = useCallback((station: Station, running: boolean) => {
    setPouring(running ? { id: station.id, color: station.color, running: true,
      x: station.cx - panOffset.get(), top: station.y + station.spout }
      : (previous) => previous ? { ...previous, running: false } : null);
    handleDragging(running);
  }, [panOffset, handleDragging]);

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
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
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
  }, [stations, cupId, cupW, cupH, homeX, homeY, W, H, cupX, cupY, cupScale, panOffset, handleDragging, standCupDown]);


  const { carry, node: carriedTool } = useCarry({
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

  /**
   * Both hands are emptied when the game is put down, and the tap is let go of.
   *
   * Nothing else does it. A gesture here ends when the finger lifts, and backgrounding the app
   * takes the finger away without lifting it: Android ends the touch sequence as the window loses
   * focus and makes no promise of delivering a terminate to the responder, and `GRABBY` has
   * already refused to hand the gesture to anyone who might have cleaned up after it. What is
   * left behind is not cosmetic. `interacting` is what holds the room still while something is
   * carried, and the pager is frozen for the same reason, so a drag that never ended leaves the
   * prep page a picture: the wall will not pan, the swipe back to the counter does nothing, and a
   * scoop of pearls is stuck to the middle of the screen. It looked exactly like the app hanging.
   */
  const [abort, setAbort] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') return;
      setAbort((generation) => generation + 1);
      carry.cancel();
      standCupDown();
      handleDragging(false);
    });
    return () => subscription.remove();
  }, [carry, standCupDown, handleDragging]);

  const cupStyle = useAnimatedStyle(() => ({
    // Compensate for React Native's center transform origin so cupX/Y stay its visible top-left.
    transform: [{ translateX: cupX.get() - cupW * (1 - cupScale.get()) / 2 },
      { translateY: cupY.get() - cupH * (1 - cupScale.get()) / 2 }, { scale: cupScale.get() }],
  }));

  const hint = nudge.text || hintFor(cup, docked);
  /**
   * The bench is out of action while the cup stands under a tap. The cup is up at the shelf,
   * nowhere near the pans — and a scoop tipped at the coaster it left behind went in all the
   * same, because a drop counts over the cup's home as well as over the cup itself. So the
   * equipment is locked out and says why, the way a tank holding the wrong tea does, rather than
   * taking a drag that can only end somewhere the player did not mean.
   */
  const busy = docked ? `Ly đang ở dưới vòi ${docked.name} — kéo ly ra trước` : undefined;
  // One object, kept stable, because it is spread into every piece of equipment in the room: built
  // fresh each render it defeated their `memo` and rebuilt the whole kitchen on the game's clock.
  const shared = useMemo(() => ({ cup, build, onNudge: nudge.show, carry }), [cup, build, nudge.show, carry]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <KitchenRoom
        width={W}
        height={H}
        panOffset={panOffset}
        scrollEnabled={!interacting}
        onPanBegin={standCupDown}
      >
        {stations.filter((station) => station.kind === 'tea').map((station) => (
          <TeaDispenser key={station.key} station={station} {...shared} abort={abort}
            active={docked?.key === station.key} level={level} onPour={onPour} onPouring={startPouring} />
        ))}
        <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
          {emptyBins.map((bin) => (
            <View key={`${bin.x}-${bin.y}`} style={{ position: 'absolute', left: bin.x, top: bin.y }}>
              <ToppingPanArt width={bin.w} height={bin.h} shape={bin.panShape} />
            </View>
          ))}
        </View>
        {stations.filter((station) => station.kind === 'topping').map((station) => (
          <ToppingBin key={station.key} station={station} {...shared}
            max={config.maxToppings} sceneOffset={panOffset} busy={busy} />
        ))}
        {stations.filter((station) => station.kind === 'ice').map((station) => (
          <IceChest key={station.key} station={station} {...shared} sceneOffset={panOffset} busy={busy} />
        ))}
        {stations.filter((station) => ['milk', 'sugar', 'foam'].includes(station.kind)).map((station) => {
          const props = { station, ...shared, sceneOffset: panOffset, busy };
          if (station.kind === 'milk') return <MilkCarton key={station.key} {...props} />;
          if (station.kind === 'sugar') return <SyrupPump key={station.key} {...props} />;
          return <FoamTub key={station.key} {...props} />;
        })}
      </KitchenRoom>

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
          <KitchenCup drink={inCup} iceSeed={cupId} width={cupW} height={cupH} level={level} pouring={Boolean(pouring?.running)} />
          {pouring && <Spill level={level} cupW={cupW} cupH={cupH} color={pouring.color} />}
        </FreshCup>
      </Animated.View>

      {carriedTool}

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
});

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
  move: (dx: number, dy: number) => void;
  drop: () => void;
  /** Put it back on its shelf without tipping it in, for a gesture that ended without a finger. */
  cancel: () => void;
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
}): { carry: Carry; node: ReactNode } {
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
        // The room scrolls, while carried tools follow the finger in screen coordinates.
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

  /** Nothing is tipped in and nothing is said: the gesture is simply over. */
  const cancel = useCallback(() => {
    if (!origin.current.station) return;
    origin.current.station = null;
    x.set(origin.current.x);
    y.set(origin.current.y);
    tip.set(0);
    show.set(0);
    setHeld(null);
    onDragging(false);
  }, [x, y, tip, show, onDragging]);

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

  // The equipment is handed this and nothing else, so it stays the same object between renders.
  const carry = useMemo(() => ({ begin, move, drop, cancel }), [begin, move, drop, cancel]);

  return { carry, node };
}

/** What a station puts in your hand: a scoopful, a carton, or the syrup bottle. */
function Tool({ station, size }: { station: Station; size: number }) {
  const S = size;
  if (station.kind === 'sugar') {
    return <KitchenBottle width={S * 0.45} height={S * 1.1} color="#C88D54" />;
  }
  if (station.kind === 'milk') {
    return <KitchenBottle width={S * 0.45} height={S * 1.1} color={station.id === 'oat' ? '#EBD4A7' : '#FFF2D3'} />;
  }
  if (station.kind === 'ice') {
    const height = S * 0.9;
    return <Image source={SCOOPFUL.ice} fadeDuration={0}
      style={{ width: height * SCOOP_ART.ice, height }} />;
  }
  if (station.kind === 'topping') {
    return <ToppingScoopArt id={station.id} size={S} />;
  }

  // Foam takes the empty scoop with its cream drawn into the bowl.
  const SH = S / ART.scoop;
  const bowl = { x: S * SCOOP_BOWL.cx, y: SH * SCOOP_BOWL.cy, r: S * SCOOP_BOWL.r };

  return (
    <View style={{ width: S, height: SH }}>
      <Image source={SCOOP} style={{ position: 'absolute', left: 0, top: 0, width: S, height: SH }} />
      {station.kind === 'foam' && (
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
  /** Panorama-mounted equipment carries its tool in screen coordinates. */
  sceneOffset?: SharedValue<number>;
  /** Set while the cup is away under a tap, to the message this equipment answers a touch with. */
  busy?: string;
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
const Frame = memo(function Frame({ station, label, locked, shadow = true, accessibilityLabel, press, handlers, children }: FrameProps) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(locked) }}
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
});

/** Carry a tool in screen coordinates while its station stays anchored to the room. */
function useCarryGesture(
  station: Station,
  carry: Carry,
  press: SharedValue<number>,
  onGrab?: () => void,
  sceneOffset?: SharedValue<number>,
  /** Called instead of lifting the tool when the equipment is locked out; it still takes the touch. */
  refuse?: () => void,
): GestureResponderHandlers {
  const from = useRef({ x: 0, y: 0 });
  // Whether this gesture picked anything up is decided once, as the finger lands, and the release
  // reads the same ref: the room changing mid-drag can never leave a tool stuck to the screen.
  const empty = useRef(false);
  const letGo = () => {
    press.set(withTiming(1, { duration: 180, easing: ease }));
    if (!empty.current) carry.drop();
  };
  return {
    ...GRABBY,
    onResponderGrant: (event) => {
      empty.current = Boolean(refuse);
      press.set(withTiming(0.94, { duration: 80 }));
      if (refuse) return refuse();
      from.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      carry.begin(station, -(sceneOffset?.get() ?? 0));
      onGrab?.();
    },
    onResponderMove: (event) => {
      if (empty.current) return;
      carry.move(event.nativeEvent.pageX - from.current.x, event.nativeEvent.pageY - from.current.y);
    },
    onResponderRelease: letGo,
    onResponderTerminate: letGo,
  };
}

// --------------------------------------------------------------------------- tea dispensers

const TeaDispenser = memo(function TeaDispenser({ station, cup, build, onNudge, active, level, onPour, onPouring, abort }: EquipProps & {
  active: boolean;
  level: SharedValue<number>;
  onPour: KitchenStationProps['onPour'];
  onPouring: (station: Station, running: boolean) => void;
  /** Bumped when the game is put down with this tap still held open. */
  abort: number;
}) {
  const { w: W, h: H } = station;
  const locked = cup.tea !== null && cup.tea !== station.id;
  const labelWidth = W * TEA_DISPENSER_ART.label.width;
  const nameSize = Math.min(Math.max(7, Math.min(11, W * 0.08)),
    labelWidth / (station.name.length * 0.55));
  const press = useSharedValue(1);
  const { handlers } = useHoldPour({ enabled: active && !locked, fill: build.fill, level, press, abort,
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
      <TeaDispenserArt width={W} height={H} teaId={station.id} />
      <View style={[{ position: 'absolute',
        left: (station.slot - W) / 2 + W * TEA_DISPENSER_ART.label.left,
        top: H * TEA_DISPENSER_ART.label.top,
        width: labelWidth, height: H * TEA_DISPENSER_ART.label.height,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 3, borderWidth: active ? 1 : 0, borderColor: '#7B874B',
      }, pointerEventsStyles.none]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
          style={{ textAlign: 'center', fontFamily: fonts.bold, fontSize: nameSize,
            lineHeight: Math.max(9, Math.min(13, W * 0.10)), color: '#784522' }}>{station.name}</Text>
      </View>
    </View>
  );
});

// --------------------------------------------------------------------------- milk cartons

/** A carton you pick up off the shelf and tip into the cup. */
const MilkCarton = memo(function MilkCarton({ station, cup, carry, sceneOffset, onNudge, busy }: EquipProps) {
  const { w: W, h: H } = station;
  const locked = cup.milk !== null && cup.milk !== station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, undefined, sceneOffset,
    busy ? () => onNudge(busy) : undefined);

  return (
    <Frame
      station={station}
      locked={locked || Boolean(busy)}
      label={station.id === 'oat' ? 'Yến mạch' : 'Sữa tươi'}
      accessibilityLabel={`Hộp ${station.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <KitchenBottle width={W} height={H} color={station.id === 'oat' ? '#EBD4A7' : '#FFF2D3'} />
    </Frame>
  );
});

// --------------------------------------------------------------------------- the topping bar

/** A shallow inset pan, named on a card clipped to its near lip the way a tank is named on its glass. */
const ToppingBin = memo(function ToppingBin({ station, cup, max, carry, sceneOffset, onNudge, busy }: EquipProps & { max: number }) {
  const { w: W, h: H } = station;
  const option = getIngredient('toppings', station.id) as Topping;
  const inCup = cup.toppings.includes(station.id);
  const full = !inCup && cup.toppings.length >= max;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, () => onNudge(option.name), sceneOffset,
    busy ? () => onNudge(busy) : undefined);
  // The card stays inside its own pan so nine of them in a grid never touch, and the longest
  // name ("Trân châu trắng") sets the type size rather than being cut off.
  const tagWidth = W * TOPPING_TAG.width;
  const nameSize = Math.min(Math.max(6, Math.min(10, W * 0.085)),
    tagWidth / (option.name.length * 0.52));

  return (
    <Frame
      station={station}
      locked={full || Boolean(busy)}
      shadow={false}
      accessibilityLabel={`Khay ${option.name} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <ToppingPanArt id={station.id} width={W} height={H} shape={station.panShape} />
      <View style={[styles.toppingTag, pointerEventsStyles.none, {
        width: tagWidth, left: (W - tagWidth) / 2, bottom: H * TOPPING_TAG.bottom,
        paddingVertical: Math.max(0.5, H * 0.02),
      }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
          style={{ textAlign: 'center', fontFamily: fonts.bold, fontSize: nameSize,
            lineHeight: nameSize * 1.25, color: '#6B4422' }}>{option.name}</Text>
      </View>
    </Frame>
  );
});

// --------------------------------------------------------------------------- the built-in ice machine

const IceChest = memo(function IceChest({ station, build, carry, sceneOffset, onNudge, busy }: EquipProps) {
  const iceLabel = build.iceScoops === 0 ? 'Không đá' : build.iceScoops === 1 ? 'Ít đá' : 'Đá thường';
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press,
    () => onNudge('Kéo muỗng đá vào ly · 1 muỗng: ít đá · 2 muỗng: đá thường'), sceneOffset,
    busy ? () => onNudge(busy) : undefined);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Khay đá — kéo muỗng đá vào ly"
      accessibilityValue={{ text: iceLabel }}
      accessibilityState={{ disabled: Boolean(busy) }}
      style={[{ position: 'absolute', left: station.x, top: station.y,
        width: station.w, height: Math.max(44, station.h) }, Boolean(busy) && styles.locked, style]}
    >
      <KitchenIceBox width={station.w} height={station.h} />
      <Text style={[styles.iceLabel, pointerEventsStyles.none]}>ĐÁ MÁT</Text>
    </Animated.View>
  );
});

// --------------------------------------------------------------------------- syrup and foam

const SyrupPump = memo(function SyrupPump({ station, build, carry, sceneOffset, onNudge, busy }: EquipProps) {
  const { w: W, h: H } = station;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, undefined, sceneOffset,
    busy ? () => onNudge(busy) : undefined);
  const pumps = build.sugarPumps;

  return (
    <Frame
      station={station}
      locked={Boolean(busy)}
      label={pumps > 0 ? `${SUGAR_STEPS[pumps - 1]}%` : 'Đường'}
      accessibilityLabel="Bình đường — kéo vào ly"
      press={press}
      handlers={handlers}
    >
      <KitchenBottle width={W} height={H} color="#C88D54" />
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
});

const FoamTub = memo(function FoamTub({ station, cup, carry, sceneOffset, onNudge, busy }: EquipProps) {
  const { w: W, h: H } = station;
  const option = getIngredient('foam', station.id);
  const inCup = cup.foam === station.id;
  const press = useSharedValue(1);
  const handlers = useCarryGesture(station, carry, press, undefined, sceneOffset,
    busy ? () => onNudge(busy) : undefined);

  return (
    <Frame
      station={station}
      locked={(Boolean(cup.foam) && !inCup) || Boolean(busy)}
      label={station.id === 'cheese' ? 'Phô mai' : 'Brûlée'}
      accessibilityLabel={`Hũ ${option?.name ?? 'kem'} — kéo vào ly`}
      press={press}
      handlers={handlers}
    >
      <Image source={FOAM[station.id] ?? FOAM.cheese} style={{ width: W, height: H }} />
    </Frame>
  );
});

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
  iceLabel: { position: 'absolute', bottom: '8%', alignSelf: 'center', fontSize: 9, fontFamily: fonts.bold, color: '#785333' },
  toppingTag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: SHOP.woodEdge,
    backgroundColor: SHOP.plaque,
    overflow: 'hidden',
  },
  hintRow: {
    position: 'absolute',
    left: 6,
    right: 6,
    alignItems: 'center',
  },
  hint: {
    maxWidth: '96%',
    backgroundColor: 'rgba(255,245,220,0.94)',
    borderWidth: 1,
    borderColor: '#CEAC7D',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  hintText: {
    color: '#795331',
    fontFamily: fonts.semi,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
