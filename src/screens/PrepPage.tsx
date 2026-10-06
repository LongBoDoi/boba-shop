import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tiles } from '../components/art/Tiles';
import { SHELF_HEIGHT, ToppingShelf } from '../components/art/ToppingShelf';
import { Button } from '../components/Button';
import { Cup } from '../components/Cup';
import { Point } from '../components/Effects';
import { IngredientPanel } from '../components/IngredientPanel';
import { OrderTicket } from '../components/OrderTicket';
import { MACHINE_BASE, MACHINE_HEAD, SealingMachine } from '../components/SealingMachine';
import { Ticket, TicketRail } from '../components/TicketRail';
import { CategoryId, Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { drinkPrice } from '../game/orders';
import { Customer } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors } from '../theme';

export interface PrepGeometry {
  /** Where the cup sits on the machine, in window coordinates. */
  machine: Point;
  /** Centre of the bin, in window coordinates. */
  trash: Point;
  cupWidth: number;
}

interface PrepPageProps {
  width: number;
  config: DayConfig;
  cup: Drink;
  cupId: number;
  activeCategory: CategoryId;
  tickets: Ticket[];
  selectedSlot: number | null;
  selectedCustomer: Customer | null;
  clock: number;
  sealCount: number;
  /** Bumped by the parent when this page scrolls into view, to re-measure on-screen positions. */
  measureToken: number;
  onGeometry: (geometry: PrepGeometry) => void;
  onSelectTicket: (slot: number) => void;
  onSelectCategory: (category: CategoryId) => void;
  onPick: (category: CategoryId, optionId: string) => void;
  onClear: () => void;
  onServe: () => void;
  machineRef: React.RefObject<View | null>;
  trashRef: React.RefObject<View | null>;
}

/** The drink-making screen: choose a ticket, build the cup, and serve it. */
export function PrepPage({
  width,
  config,
  cup,
  cupId,
  activeCategory,
  tickets,
  selectedSlot,
  selectedCustomer,
  clock,
  sealCount,
  measureToken,
  onGeometry,
  onSelectTicket,
  onSelectCategory,
  onPick,
  onClear,
  onServe,
  machineRef,
  trashRef,
}: PrepPageProps) {
  const [station, setStation] = useState({ width: 0, height: 0 });
  const insets = useSafeAreaInsets();
  const cupPrice = drinkPrice(cup);
  const canServe = Boolean(selectedCustomer && cup.tea);
  const serveLabel = !selectedCustomer
    ? 'Chọn order để pha'
    : !cup.tea
      ? 'Chọn trà trước'
      : `Phục vụ ${selectedCustomer.name} ➜`;
  const cupWidth = Math.round(
    Math.max(56, Math.min(140, station.width * 0.34, station.height ? (station.height - 24 - MACHINE_HEAD - MACHINE_BASE - 22) / 1.3 : 90)),
  );

  // Report where the cup and bin sit (window coordinates) whenever the layout or page changes,
  // so the effects overlay can aim coins and the toss. Re-measured when measureToken bumps.
  useEffect(() => {
    if (station.height === 0) return;
    machineRef.current?.measureInWindow((x, y, w, h) => {
      const machine: Point = { x: x + w / 2, y: y + h - MACHINE_BASE - (cupWidth * 1.3) / 2 - 4 };
      trashRef.current?.measureInWindow((tx, ty, tw, th) => {
        onGeometry({ machine, trash: { x: tx + tw / 2, y: ty + th / 2 }, cupWidth });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.width, station.height, cupWidth, measureToken]);

  return (
    <View style={[styles.page, { width }]}>
      <TicketRail tickets={tickets} selectedSlot={selectedSlot} cup={cup} config={config} clock={clock} onSelect={onSelectTicket} />

      <View
        style={styles.station}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setStation({ width: w, height: h });
        }}
      >
        {station.height > 0 && <Tiles width={station.width} height={station.height} />}
        <View style={styles.ticketColumn}>
          <OrderTicket customer={selectedCustomer} cup={cup} config={config} />
          {station.height > 70 + config.categories.length * 22 + SHELF_HEIGHT && (
            <View style={styles.shelf} pointerEvents="none">
              <ToppingShelf width={station.width - cupWidth - 66} height={SHELF_HEIGHT} />
            </View>
          )}
        </View>
        <View ref={machineRef} style={styles.machineArea}>
          <SealingMachine cupWidth={cupWidth} display={cupPrice > 0 ? `Giá: ${formatMoney(cupPrice)}` : 'Sẵn sàng'} sealCount={sealCount}>
            <FreshCup key={cupId} width={cupWidth}>
              <Cup drink={cup} width={cupWidth} backgroundColor={colors.machineInside} animated />
            </FreshCup>
          </SealingMachine>
        </View>
      </View>

      <IngredientPanel config={config} cup={cup} activeCategory={activeCategory} onSelectCategory={onSelectCategory} onPick={onPick} />

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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.floor,
  },
  station: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  ticketColumn: {
    flex: 1,
  },
  shelf: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  machineArea: {
    justifyContent: 'flex-end',
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
