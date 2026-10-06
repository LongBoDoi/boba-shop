import { ReactNode, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';

import { KitchenBackdrop } from '../components/art/KitchenBackdrop';
import { Button } from '../components/Button';
import { Cup } from '../components/Cup';
import { Point } from '../components/Effects';
import { KitchenStation } from '../components/KitchenStation';
import { OrderTicket } from '../components/OrderTicket';
import { Ticket, TicketRail } from '../components/TicketRail';
import { CategoryId, Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { drinkPrice } from '../game/orders';
import { Customer } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';

export interface PrepGeometry {
  /** Where the cup sits on the table, in window coordinates. */
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
  tickets: Ticket[];
  selectedSlot: number | null;
  selectedCustomer: Customer | null;
  clock: number;
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

/** The drink-making screen: pick an order, operate the kitchen equipment, and serve. */
export function PrepPage({
  width,
  config,
  cup,
  cupId,
  tickets,
  selectedSlot,
  selectedCustomer,
  clock,
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
  const cupWidth = Math.round(Math.max(52, Math.min(84, scene.width * 0.2, scene.height * 0.15)));

  // Report where the cup and bin sit (window coordinates) whenever the layout or page changes,
  // so the effects overlay can aim coins and the toss. Re-measured when measureToken bumps.
  useEffect(() => {
    if (scene.height === 0) return;
    machineRef.current?.measureInWindow((x, y, w, h) => {
      const machine: Point = { x: x + w / 2, y: y + h * 0.42 };
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

        <KitchenStation
          config={config}
          cup={cup}
          onPick={onPick}
          recipe={<OrderTicket customer={selectedCustomer} cup={cup} config={config} />}
          cupTable={
            <CupTable cupWidth={cupWidth} innerRef={machineRef} priceLabel={cupPrice > 0 ? `Giá: ${formatMoney(cupPrice)}` : 'Ly mới'}>
              <FreshCup key={cupId} width={cupWidth}>
                <Cup drink={cup} width={cupWidth} backgroundColor={colors.floor} tapered={false} animated />
              </FreshCup>
            </CupTable>
          }
        />
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

/** The cup standing on a little round wooden table in the middle of the kitchen. */
function CupTable({
  cupWidth,
  priceLabel,
  innerRef,
  children,
}: {
  cupWidth: number;
  priceLabel: string;
  innerRef: React.RefObject<View | null>;
  children: ReactNode;
}) {
  const tableW = Math.round(cupWidth * 1.7);
  const tableH = Math.round(cupWidth * 0.5);
  return (
    <View ref={innerRef} style={[styles.cupTable, { width: tableW }]}>
      <View style={styles.priceTag}>
        <Text style={styles.priceText} numberOfLines={1}>
          {priceLabel}
        </Text>
      </View>
      <View style={styles.cupStack}>
        {children}
        <Svg width={tableW} height={tableH} style={styles.table}>
          <Ellipse cx={tableW / 2} cy={tableH * 0.42} rx={tableW * 0.46} ry={tableH * 0.34} fill={colors.counterEdge} />
          <Ellipse cx={tableW / 2} cy={tableH * 0.36} rx={tableW * 0.46} ry={tableH * 0.34} fill={colors.counterLight} />
          <Ellipse cx={tableW / 2} cy={tableH * 0.3} rx={tableW * 0.4} ry={tableH * 0.26} fill="#F0CDA0" opacity={0.6} />
        </Svg>
      </View>
    </View>
  );
}

/** Each new cup glides a short way onto the table. */
function FreshCup({ width, children }: { width: number; children: ReactNode }) {
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.set(withDelay(400, withTiming(1, timing(DURATION.slow))));
  }, [slide]);
  const style = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateY: (1 - slide.value) * -8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
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
  cupTable: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cupStack: {
    alignItems: 'center',
  },
  table: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    zIndex: -1,
  },
  priceTag: {
    backgroundColor: '#3E5A4C',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  priceText: {
    color: '#9FE6C8',
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
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
