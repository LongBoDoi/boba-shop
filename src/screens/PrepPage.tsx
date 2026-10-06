import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientIcon } from '../components/art/IngredientIcon';
import { KitchenBackdrop } from '../components/art/KitchenBackdrop';
import { Button } from '../components/Button';
import { Cup } from '../components/Cup';
import { Point } from '../components/Effects';
import { IngredientShelves } from '../components/IngredientShelves';
import { OrderTicket } from '../components/OrderTicket';
import { MACHINE_BASE, SealingMachine } from '../components/SealingMachine';
import { Ticket, TicketRail } from '../components/TicketRail';
import { CategoryId, Drink, getIngredient } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { drinkPrice } from '../game/orders';
import { Customer } from '../game/reducer';
import { DURATION, ease, timing } from '../motion';
import { colors } from '../theme';

export interface PrepGeometry {
  /** Where the cup sits on the machine, in window coordinates. */
  machine: Point;
  /** Centre of the bin, in window coordinates. */
  trash: Point;
  cupWidth: number;
}

/** The ingredient the player most recently tapped, so the prep page can drop it into the cup. */
export interface PickFx {
  category: CategoryId;
  id: string;
  seq: number;
}

interface PrepPageProps {
  width: number;
  config: DayConfig;
  cup: Drink;
  cupId: number;
  tickets: Ticket[];
  selectedSlot: number | null;
  selectedCustomer: Customer | null;
  clock: number;
  sealCount: number;
  pickFx: PickFx | null;
  /** Bumped by the parent when this page scrolls into view, to re-measure on-screen positions. */
  measureToken: number;
  onGeometry: (geometry: PrepGeometry) => void;
  onSelectTicket: (slot: number) => void;
  onPick: (category: CategoryId, optionId: string) => void;
  onClear: () => void;
  onServe: () => void;
  machineRef: React.RefObject<View | null>;
  trashRef: React.RefObject<View | null>;
}

/** The drink-making screen: pick an order, tap ingredients off the kitchen shelves, and serve. */
export function PrepPage({
  width,
  config,
  cup,
  cupId,
  tickets,
  selectedSlot,
  selectedCustomer,
  clock,
  sealCount,
  pickFx,
  measureToken,
  onGeometry,
  onSelectTicket,
  onPick,
  onClear,
  onServe,
  machineRef,
  trashRef,
}: PrepPageProps) {
  const [scene, setScene] = useState({ width: 0, height: 0 });
  const insets = useSafeAreaInsets();
  const cupPrice = drinkPrice(cup);
  const canServe = Boolean(selectedCustomer && cup.tea);
  const serveLabel = !selectedCustomer
    ? 'Chọn order để pha'
    : !cup.tea
      ? 'Chọn trà trước'
      : `Phục vụ ${selectedCustomer.name} ➜`;
  const cupWidth = Math.round(Math.max(54, Math.min(92, scene.width * 0.22, scene.height * 0.16)));

  // Report where the cup and bin sit (window coordinates) whenever the layout or page changes,
  // so the effects overlay can aim coins and the toss. Re-measured when measureToken bumps.
  useEffect(() => {
    if (scene.height === 0) return;
    machineRef.current?.measureInWindow((x, y, w, h) => {
      const machine: Point = { x: x + w / 2, y: y + h - MACHINE_BASE - (cupWidth * 1.3) / 2 - 4 };
      trashRef.current?.measureInWindow((tx, ty, tw, th) => {
        onGeometry({ machine, trash: { x: tx + tw / 2, y: ty + th / 2 }, cupWidth });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.width, scene.height, cupWidth, measureToken]);

  return (
    <View style={[styles.page, { width }]}>
      <TicketRail tickets={tickets} selectedSlot={selectedSlot} cup={cup} config={config} clock={clock} onSelect={onSelectTicket} />

      <View
        style={styles.scene}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setScene({ width: w, height: h });
        }}
      >
        {scene.height > 0 && <KitchenBackdrop width={scene.width} height={scene.height} />}

        {/* Shelves of tappable ingredients fill the wall. */}
        <IngredientShelves config={config} cup={cup} onPick={onPick} />

        {/* The order you're making + the cup on the machine, standing on the counter. */}
        <View style={styles.counter}>
          <View style={styles.recipe}>
            <OrderTicket customer={selectedCustomer} cup={cup} config={config} />
          </View>
          <View ref={machineRef} style={styles.machineArea}>
            <SealingMachine cupWidth={cupWidth} display={cupPrice > 0 ? `Giá: ${formatMoney(cupPrice)}` : 'Sẵn sàng'} sealCount={sealCount}>
              <FreshCup key={cupId} width={cupWidth}>
                <Cup drink={cup} width={cupWidth} backgroundColor={colors.machineInside} animated />
              </FreshCup>
            </SealingMachine>
            {pickFx && <DropInIcon key={pickFx.seq} pick={pickFx} cupWidth={cupWidth} />}
          </View>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: 10 + insets.bottom }]}>
        <View ref={trashRef} style={styles.clear}>
          <Button label="Đổ bỏ" variant="secondary" onPress={onClear} />
        </View>
        <Button label={serveLabel} disabled={!canServe} onPress={onServe} style={styles.serve} />
      </View>
    </View>
  );
}

/** Each new cup glides a short way onto the machine. */
function FreshCup({ width, children }: { width: number; children: ReactNode }) {
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.set(withDelay(500, withTiming(1, timing(DURATION.slow))));
  }, [slide]);
  const style = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateX: (1 - slide.value) * -width * 0.25 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * When the player taps an ingredient off a shelf, a little picture of it falls into the cup on the
 * machine — so grabbing from the shelf visibly feeds the drink. Skipped for the "none" options.
 */
function DropInIcon({ pick, cupWidth }: { pick: PickFx; cupWidth: number }) {
  const option = getIngredient(pick.category, pick.id);
  const drop = useSharedValue(0);
  const cupHeight = Math.round(cupWidth * 1.3);
  useEffect(() => {
    drop.set(withTiming(1, { duration: 440, easing: ease }));
  }, [drop]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(drop.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(drop.value, [0, 1], [-cupHeight * 0.85, cupHeight * 0.18]) },
      { scale: interpolate(drop.value, [0, 1], [1.15, 0.7]) },
    ],
  }));
  if (!option || option.isNone) return null;
  return (
    <Animated.View style={[styles.drop, { bottom: MACHINE_BASE + cupHeight * 0.4 }, style]} pointerEvents="none">
      <IngredientIcon category={pick.category} id={pick.id} size={Math.round(cupWidth * 0.5)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.floor,
  },
  scene: {
    flex: 1,
    overflow: 'hidden',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  recipe: {
    flex: 1,
  },
  machineArea: {
    justifyContent: 'flex-end',
  },
  drop: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.panel,
  },
  clear: {
    flex: 1.1,
  },
  serve: {
    flex: 2,
  },
});
