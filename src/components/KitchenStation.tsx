import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderHandlers, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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
import { CupBuild, Customer } from '../game/reducer';
import { DURATION, ease, timing } from '../motion';
import { colors, fonts } from '../theme';
import { FLOOR_SPAN, KitchenRoom, RoomShelf, SHOP } from './art/KitchenRoom';
import {
  ART,
  FOAM,
  JAR_SPOUT,
  PAN_BODY,
  JAR_TEA,
  MILK,
  PAN,
  PIECE,
  PIECE_ART,
  RAIL_CLIP,
  SCOOP,
  SCOOP_BOWL,
  SYRUP,
} from './art/kitchenArt';
import { CUP_LIP, KitchenCup, pourLevel, WELL_BOTTOM, WELL_RUN } from './KitchenCup';
import { OrderNote, TicketPin } from './OrderNote';
import { Ticket } from './TicketRail';

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

/** A row the player can swipe along, and how far it may go. */
interface PanRow {
  offset: SharedValue<number>;
  min: number;
  onHold: (held: boolean) => void;
}

export interface KitchenLayout {
  stations: Station[];
  shelves: RoomShelf[];
  strips: RowStrip[];
  /** The work top in the middle of the room — where the cup rests between jobs. */
  tableLine: number;
  /** The shop's notes rail, across the top of the cup's band. */
  railY: number;
  /** Room at each end of the dispenser shelf for the plant and the poster. */
  sideRoom: number;
  /** Where the pink cabinet doors along the bottom start. */
  cabinetTop: number;
  cupW: number;
  cupH: number;
  homeX: number;
  homeY: number;
}

/** The strip of counter a steel bar keeps in front of its pans, as a fraction of a pan. */
const APRON = 0.3;

/** How much wider than its own art a pan is drawn, towards the design's wider pans. */
const PAN_WIDEN = 1.16;

/** A pan is set into the counter; everything else stands on it. */
const sunkKind = (kind: StationKind) => kind === 'topping' || kind === 'ice';

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
 * Arrange the kitchen the way the shop is laid out: the tea dispensers on a wooden shelf at the
 * top, the work top with the cup's coaster through the middle, then the topping bar and the rest of
 * the equipment below, and the cabinet doors along the very bottom. The dispensers get a dock — the
 * spot the cup is held while that tap runs into it.
 */
export function layoutKitchen(config: DayConfig, W: number, H: number): KitchenLayout {
  const { width: cupW, height: cupH } = cupSizeFor(W, H);
  // The lamps hang over the top of the wall, so the shelf starts close to it — but not under
  // it: with the slack going to the work top there is no gap above the row to fall back on.
  const top = Math.max(16, Math.round(H * 0.05));
  const labelH = 17;
  // Exactly as deep as the run of door fronts along the floor wants to be: a single unit at
  // each end with a double between them, each as wide as its own art. Stretching them to a
  // height that is not their own is what makes a cabinet look pulled out of shape, and the
  // handles show it first.
  const cabinetH = Math.max(34, Math.min(Math.round(H * 0.2), Math.round(W / FLOOR_SPAN)));
  const cabinetTop = H - cabinetH;
  const counterH = Math.max(46, Math.round(W * 0.15));
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

  // With only a few dispensers the shelf has room at both ends for the plant and the poster.
  const sideRoom = rows[0].length <= 4 ? Math.round(W * 0.13) : 0;

  // Each row is only as tall as what stands on it — the slack goes to the cup, like the shop does.
  // The dispensers share their shelf out between them, because the cup is carried to a
  // particular tap and they all have to be reachable. The counters below do the opposite: every
  // box keeps the same size however many there are, and the row scrolls sideways instead of
  // shrinking, which is what stops a long day's worth of toppings from turning into thumbnails.
  const plans = rows.map((items) => {
    const kind = items[0].kind;
    const tea = kind === 'tea';
    const inset = tea ? sideRoom : 0;
    const slot = (W - 6 - inset * 2) / items.length;
    const w = tea
      ? Math.min(slot - 10, W * MAX_WIDTH[kind], H * 0.3 * ASPECT[kind])
      : Math.min(W * MAX_WIDTH[kind], H * 0.13 * ASPECT[kind]);
    return { items, tea, inset, slot, h: Math.round(w / ASPECT[kind]) };
  });

  // A counter keeps a strip of its deck in front of the pans before it turns down, which is
  // where their name plaques hang; that strip is part of what a steel row takes up.
  const apron = (plan: { tea: boolean; h: number }) =>
    plan.tea ? 0 : Math.round(plan.h * (1 - PAN_BODY) * APRON);
  const room = cabinetTop - top - bandH;
  const used = plans.reduce((sum, plan) => sum + plan.h + labelH + apron(plan), 0);
  // Nearly all the slack goes to the cup's band — that is, to the wooden work top, which is
  // where the design puts its room. Spreading it between the rows instead pads out the steel
  // counters, and a counter is only ever as deep as the pans standing in it.
  const slack = room - used;
  const toBand = Math.max(0, slack * 0.88);
  const band = bandH + toBand;
  const gap = Math.max(0, (slack - toBand) / plans.length);
  const squeeze = slack < 0 ? room / used : 1;

  const stations: Station[] = [];
  const shelves: RoomShelf[] = [];
  const strips: RowStrip[] = [];
  let y = top;
  let tableLine = cabinetTop - counterH;

  plans.forEach((plan, r) => {
    const h = Math.round(plan.h * squeeze);
    // The pans sit low in their counter: the design leaves barely a hand's width of stainless
    // behind them and little more in front, so a steel row's slack nearly all goes above it,
    // into the wooden work top that comes down to meet the counter.
    const lead = r === 0 ? 0.5 : 0.45;
    const base = Math.round(y + gap * lead + h);

    // One height for the whole row, and each box as wide as its own art — so a bottle stays a
    // bottle and a carton a carton, instead of every one of them taking the first one's shape.
    // A pan is drawn a little wider than that: the design's are half again as wide as they are
    // tall where ours are square, and a square one is too narrow for its name to fit on a line.
    const widths = plan.items.map((item) =>
      Math.round(h * ASPECT[plan.tea ? 'tea' : item.kind] * (sunkKind(item.kind) ? PAN_WIDEN : 1)),
    );
    // A pan is set into the counter, so pans sit shoulder to shoulder; a bottle or a carton
    // stands on it and takes a column of its own, wide enough to put its name under.
    const slots = plan.items.map((item, i) =>
      sunkKind(item.kind) ? widths[i] : Math.max(widths[i], Math.round(W * 0.2)),
    );
    // The counters start hard against the left, run off the right, and are swiped back.
    const span = slots.reduce((sum, slot) => sum + slot, 0);
    let x = 0;

    plan.items.forEach((item, i) => {
      const w = widths[i];
      const slot = plan.tea ? Math.round(plan.slot) : slots[i];
      const cx = plan.tea ? Math.round(3 + plan.inset + plan.slot * (i + 0.5)) : Math.round(x + slot / 2);
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
        x: cx - Math.round(w / 2),
        y: base - h,
        w,
        h,
        cx,
        slot,
        base,
        spout: item.kind === 'tea' ? Math.round(h * JAR_SPOUT) : Math.round(h * 0.2),
        dockY: base + cupH + 8,
      });
    });
    strips.push({ scroll: !plan.tea && span > W, span });

    const sunk = sunkKind(plan.items[0].kind);
    shelves.push({
      base,
      top: base - h,
      steel: plan.items[0].kind !== 'tea',
      // a pan's sprite starts at the scoop standing in it, well above the counter
      rim: base - Math.round(h * (sunk ? 1 - PAN_BODY : 1)),
    });
    y = base + Math.round((labelH + apron(plan)) * squeeze) + gap * (1 - lead);
    // The work top goes straight under the dispensers, so the cup only has a short lift.
    if (r === 0) {
      tableLine = Math.round(y + band - counterH);
      y += band;
    }
  });

  // The stainless runs unbroken from under the work top down to the cabinets, the way the shop
  // is actually built: each steel bar owns the counter from where the one above it stops, so no
  // wall shows through between them.
  // How far the stainless reaches above its pans is measured off the pans themselves, as the
  // design measures it: enough to stand the scoops in with a little air over them, no more —
  // the design's counter is nearly all pan. The work top above comes down to meet it, so a
  // room with space to spare gets a deeper wooden counter rather than a wider slab of steel.
  const bars = shelves.filter((shelf) => shelf.steel);
  // The stainless may come up as far as the front of the cup's coaster, but no further: past
  // that it would be standing on the work top rather than in front of it.
  const coasterH = Math.round(cupW * 1.5) / ART.coaster;
  const highest = tableLine + Math.round(Math.max(counterH * 0.16, coasterH * 0.56));
  bars.forEach((shelf) => {
    const rim = shelf.rim ?? shelf.top;
    shelf.from = Math.max(highest, Math.round(rim - (shelf.base - rim) * 0.3));
  });
  bars.forEach((shelf, k) => {
    shelf.until = bars[k + 1]?.from ?? cabinetTop;
  });

  return {
    stations,
    shelves,
    strips,
    tableLine,
    // The rail hangs just under the dispensers, at the top of the cup's band.
    railY: Math.round(tableLine - band + counterH + 4),
    cabinetTop,
    sideRoom,
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
  /** The taken orders, which hang on the shop's rail. */
  tickets: Ticket[];
  selectedSlot: number | null;
  selectedCustomer: Customer | null;
  clock: number;
  onSelectTicket: (slot: number) => void;
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
  tickets,
  selectedSlot,
  selectedCustomer,
  clock,
  onSelectTicket,
  cupRef,
}: KitchenStationProps) {
  const layout = useMemo(() => layoutKitchen(config, W, H), [config, W, H]);
  const { stations, shelves, strips, tableLine, railY, cabinetTop, sideRoom, cupW, cupH, homeX, homeY } = layout;

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

  // The note hangs from the rail down towards the work top; the pins sit beside it.
  const noteW = Math.round(Math.min(W * 0.235, (tableLine - railY) * 0.55));
  const noteH = Math.round(Math.min(noteW / ART.card, (tableLine - railY) * 0.95));
  const pinSize = Math.round(Math.min(W * 0.11, (tableLine - railY) * 0.3));
  // The rail's clip, drawn over the note it is holding up.
  const clipH = Math.max(17, Math.round(W * 0.058)) / ART.railCap;
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
        railY={railY}
        cabinetTop={cabinetTop}
        sideRoom={sideRoom}
        cupH={cupH}
        matX={homeX - Math.round(cupW * 0.25)}
        matW={Math.round(cupW * 1.5)}
      />

      {strips.map((strip, r) => {
        const row = stations.filter((station) => station.row === r);
        const pan = strip.scroll ? { offset: swipe[r], min: W - strip.span, onHold: onDragging } : undefined;
        const boxes = row.map((station) => {
          const props = { station, active: docked?.key === station.key, pan, ...shared };
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

      {/* The order hangs on the rail, with the other tickets pegged up beside it. */}
      <OrderNote
        customer={selectedCustomer}
        cup={cup}
        config={config}
        patience={
          selectedCustomer
            ? Math.max(0, 1 - (clock - (selectedCustomer.orderedAt ?? selectedCustomer.arrivedAt)) / selectedCustomer.patienceMs)
            : 1
        }
        x={Math.round(W * 0.035)}
        y={Math.round(railY + clipH * 0.42)}
        width={Math.round(noteH * ART.card)}
        height={noteH}
      />
      {/* the clip holding that note to the rail */}
      <Image
        source={RAIL_CLIP}
        style={{
          position: 'absolute',
          left: Math.round(W * 0.035 + (noteH * ART.card) / 2 - (clipH * ART.railClip) / 2),
          top: railY,
          width: clipH * ART.railClip,
          height: clipH,
        }}
      />

      {tickets.map(({ slot, customer }, i) => (
        <TicketPin
          key={customer.id}
          customer={customer}
          cup={cup}
          config={config}
          selected={slot === selectedSlot}
          size={pinSize}
          x={W - 16 - (tickets.length - i) * (pinSize + 7)}
          y={railY + 2}
          onPress={() => onSelectTicket(slot)}
        />
      ))}

      {/* The half of the pour that is already inside the glass goes under the cup, so the glass
          tints it and the cat covers it. The half still in open air is drawn after the cup. */}
      {pouring && docked && (
        <Stream
          side="back"
          x={docked.cx}
          top={docked.y + docked.spout}
          cupY={cupY}
          cupH={cupH}
          color={getIngredient(pouring.category, pouring.id)?.color ?? colors.ink}
          level={level}
        />
      )}

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
          <KitchenCup drink={inCup} width={cupW} height={cupH} level={level} />
        </FreshCup>
        <Spill
          level={level}
          cupW={cupW}
          cupH={cupH}
          color={inCup.tea ? (getIngredient('tea', inCup.tea)?.color ?? colors.ink) : '#F7F4EC'}
        />
      </Animated.View>

      {/* and the half still falling through open air, which nothing should dim */}
      {pouring && docked && (
        <Stream
          side="front"
          x={docked.cx}
          top={docked.y + docked.spout}
          cupY={cupY}
          cupH={cupH}
          color={getIngredient(pouring.category, pouring.id)?.color ?? colors.ink}
          level={level}
        />
      )}

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
  active: boolean;
  cup: Drink;
  build: CupBuild;
  level: SharedValue<number>;
  onNudge: (message: string) => void;
  onPouring: (what: { category: 'tea' | 'milk'; id: string } | null) => void;
  carry: Carry;
  /** Set when this row holds more than the room is wide, so it can be swiped along. */
  pan?: PanRow;
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
  const sunk = sunkKind(station.kind);
  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(active) }}
      style={[styles.frame, { left: station.cx - station.slot / 2, top: station.y - 6, width: station.slot }, style]}
    >
      {sunk &&
        // A pan is dropped through the counter, so the stainless is in shadow all round its
        // rim. Without it the pans read as standing on the counter rather than in it.
        [0.07, 0.045, 0.022].map((at) => {
          const g = Math.round(station.h * at);
          // the sprite starts at the scoop standing in the pan; the rim is what the counter holds
          const rim = Math.round(station.h * PAN_BODY);
          // The well is deepest behind the pan, where the counter drops away out of the light,
          // so the shadow reaches further up than it does to the sides.
          const back = g * 2.2;
          return (
            <View
              key={at}
              style={{
                position: 'absolute',
                // the frame is a slot-wide column with the equipment centred 6px down it
                left: (station.slot - station.w) / 2 - g,
                top: 6 + rim - back,
                width: station.w + g * 2,
                height: station.h - rim + back + g,
                borderRadius: g * 1.8,
                backgroundColor: '#5E5467',
                opacity: 0.16,
              }}
            />
          );
        })}
      <View style={[{ width: station.w, height: station.h }, locked && styles.locked]}>{children}</View>
      {active && <View style={[styles.ring, { width: station.w + 10, height: station.h + 10 }]} />}
      <Text
        style={[
          styles.label,
          // Wide enough for a short name to stay whole even on a narrow bottle — a plaque held
          // to the width of its box would break "Đường" across two lines.
          { maxWidth: Math.max(station.slot - 2, 70) },
          // A pan is sunk into the counter, so its plaque sits on the rim rather than below it,
          // the way the design has them.
          sunk && styles.labelSunk,
          active && styles.labelActive,
        ]}
        // A plaque is only as wide as the box it belongs to, so a long name runs onto a second
        // line rather than being cut off; the apron in front of the pans is where it goes.
        numberOfLines={2}
      >
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

/**
 * The tea running out of a tap. It is drawn across the kitchen rather than inside the dispenser,
 * so it visibly falls *into* the cup, and it ends at the drink's surface — the stream gets shorter
 * as the cup fills, the way a real pour does.
 *
 * It is drawn in two halves, split at the cup's lip, because neither side alone is right: all in
 * front and it runs down the *outside* of the glass, over the cat; all behind and the falling tea
 * is dimmed by a cup it has not reached yet. Above the lip it is in open air, so the `front` half
 * goes over the cup; below it the tea is inside the glass, so the `back` half goes under, letting
 * the glass tint it and the cat cover it. Each half clips to its own side of the lip, so the two
 * never overlap and the stream is never drawn on itself.
 */
function Stream({
  x,
  top,
  cupY,
  cupH,
  color,
  level,
  side,
  width = 6,
}: {
  x: number;
  top: number;
  cupY: SharedValue<number>;
  cupH: number;
  color: string;
  level: SharedValue<number>;
  side: 'front' | 'back';
  width?: number;
}) {
  const run = useSharedValue(0);
  useEffect(() => {
    run.set(withTiming(1, { duration: 170, easing: Easing.linear }));
    return () => {
      run.set(0);
    };
  }, [run]);

  // Both halves follow the cup where it actually is, not where it was sent: the cup is still
  // gliding into its dock when a tap can first be held, and a split pinned to the dock would sit
  // adrift of the glass for that moment.
  const clipStyle = useAnimatedStyle(() => {
    const lip = cupY.get() + CUP_LIP * cupH;
    if (side === 'front') return { top, height: Math.max(0, lip - top) };
    return { top: lip, height: Math.max(0, cupY.get() + cupH - lip) };
  });
  const style = useAnimatedStyle(() => {
    const lip = cupY.get() + CUP_LIP * cupH;
    const clipTop = side === 'front' ? top : lip;
    const surface = cupY.get() + (WELL_BOTTOM - pourLevel(Math.min(1, Math.max(0, level.get()))) * WELL_RUN) * cupH;
    return {
      top: top - clipTop,
      height: Math.max(0, surface - top) * run.get(),
      opacity: Math.min(1, run.get() * 2.2),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, overflow: 'hidden' }, clipStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: x - width / 2, width }, style]}
      >
        {/* the falling column, with the light down one side of it */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: width * 0.5 }]} />
        <View
          style={{
            position: 'absolute',
            left: width * 0.16,
            top: 0,
            bottom: 0,
            width: width * 0.26,
            borderRadius: width,
            backgroundColor: '#FFFFFF',
            opacity: 0.32,
          }}
        />
        {/* it leaves the spout as a fat drop */}
        <View
          style={{
            position: 'absolute',
            left: -width * 0.45,
            right: -width * 0.45,
            top: -width * 0.35,
            height: width * 1.3,
            borderRadius: width,
            backgroundColor: color,
          }}
        />
        {/* the splash belongs where the tea lands, which is inside the cup */}
        {side === 'back' && <Ripple color={color} size={width * 3.4} />}
      </Animated.View>
    </Animated.View>
  );
}

/** Where the stream hits the drink: a ring that spreads and fades, over and over. */
function Ripple({ color, size }: { color: string; size: number }) {
  const spread = useSharedValue(0);
  useEffect(() => {
    spread.set(withRepeat(withTiming(1, { duration: 520, easing: Easing.linear }), -1, false));
  }, [spread]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - spread.get()),
    transform: [{ scaleX: 0.45 + spread.get() }, { scaleY: 0.45 + spread.get() * 0.5 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: -size * 0.16,
          left: -size / 2,
          width: size * 2,
          height: size * 0.5,
          borderRadius: size,
          borderWidth: Math.max(1.4, size * 0.1),
          borderColor: color,
        },
        style,
      ]}
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
  const { handlers } = useHoldPour({
    enabled: active && !locked,
    fill: build.fill,
    level,
    press,
    onStart: (running) => onPouring(running ? { category: 'tea', id: station.id } : null),
    onCommit: (amount) => onPour('tea', station.id, amount),
    onBlocked: () =>
      onNudge(locked ? 'Ly đã có trà khác — bấm Đổ bỏ trước' : `Kéo ly xuống dưới vòi ${tea.name} trước`),
  });

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
  labelSunk: {
    // half on the pan's rim and half on the counter in front of it, where the design hangs it
    marginTop: -8,
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
  cupLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
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
