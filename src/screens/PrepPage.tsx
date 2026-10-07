import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Point } from '../components/Effects';
import { cupSizeFor, KitchenStation } from '../components/KitchenStation';
import { OrderTicket } from '../components/OrderTicket';
import { Ticket, TicketRail } from '../components/TicketRail';
import { Drink, MIN_FILL } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { Customer, CupBuild } from '../game/reducer';
import { colors } from '../theme';

export interface PrepGeometry {
  /** Where the cup is standing, in window coordinates. */
  machine: Point;
  /** Centre of the bin, in window coordinates. */
  trash: Point;
  cupWidth: number;
}

interface PrepPageProps {
  width: number;
  config: DayConfig;
  cup: Drink;
  build: CupBuild;
  cupId: number;
  tickets: Ticket[];
  selectedSlot: number | null;
  selectedCustomer: Customer | null;
  clock: number;
  /** Bumped by the parent when this page scrolls into view, to re-measure on-screen positions. */
  measureToken: number;
  onGeometry: (geometry: PrepGeometry) => void;
  onSelectTicket: (slot: number) => void;
  onPour: (category: 'tea' | 'milk', optionId: string, amount: number) => void;
  onScoop: (category: 'toppings' | 'foam', optionId: string) => void;
  onIce: () => void;
  onSugar: () => void;
  onDragging: (dragging: boolean) => void;
  onClear: () => void;
  onServe: () => void;
  machineRef: React.RefObject<View | null>;
  trashRef: React.RefObject<View | null>;
}

/** The kitchen: pick an order, build the cup with your hands, serve it. */
export function PrepPage({
  width,
  config,
  cup,
  build,
  cupId,
  tickets,
  selectedSlot,
  selectedCustomer,
  clock,
  measureToken,
  onGeometry,
  onSelectTicket,
  onPour,
  onScoop,
  onIce,
  onSugar,
  onDragging,
  onClear,
  onServe,
  machineRef,
  trashRef,
}: PrepPageProps) {
  const [scene, setScene] = useState({ width: 0, height: 0 });
  const insets = useSafeAreaInsets();
  const enough = build.fill >= MIN_FILL;
  const canServe = Boolean(selectedCustomer && cup.tea && enough);
  const serveLabel = !selectedCustomer
    ? 'Chọn order để pha'
    : !cup.tea
      ? 'Rót trà vào ly trước'
      : !enough
        ? 'Chưa đủ trà — rót tới vạch'
        : `Phục vụ ${selectedCustomer.name} ➜`;
  const cupWidth = scene.width > 0 ? cupSizeFor(scene.width, scene.height).width : 56;

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
      <OrderTicket customer={selectedCustomer} cup={cup} config={config} />

      <View
        style={styles.scene}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setScene({ width: w, height: h });
        }}
      >
        {scene.height > 0 && (
          <KitchenStation
            width={scene.width}
            height={scene.height}
            config={config}
            cup={cup}
            build={build}
            cupId={cupId}
            onPour={onPour}
            onScoop={onScoop}
            onIce={onIce}
            onSugar={onSugar}
            onDragging={onDragging}
            cupRef={machineRef}
          />
        )}
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.floor,
  },
  scene: {
    flex: 1,
    marginTop: 6,
    overflow: 'hidden',
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
