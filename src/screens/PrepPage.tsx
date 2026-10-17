import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KitchenActionIcon } from '../components/art/KitchenEquipment';
import { Point } from '../components/Effects';
import { cupSizeFor, KitchenStation } from '../components/KitchenStation';
import { OrderBubble } from '../components/OrderBubble';
import { PourMeter, PourMeterState } from '../components/PourFeedback';
import { Ticket } from '../components/TicketRail';
import { Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { Customer, CupBuild, patienceLeft } from '../game/reducer';
import { panelWidthFor } from '../responsive';
import { fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

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
  /** Sideways: the order panel and the buttons stand beside the kitchen. See `isWideLayout`. */
  wide: boolean;
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
  wide,
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
  const [pourMeter, setPourMeter] = useState<PourMeterState | null>(null);
  /** What the side column has left for the order once the buttons have taken theirs. */
  const [orderSpace, setOrderSpace] = useState(0);
  const insets = useSafeAreaInsets();
  const canServe = Boolean(selectedCustomer && cup.tea);
  const serveLabel = !selectedCustomer
    ? 'Chọn order để pha'
    : !cup.tea
      ? 'Rót trà vào ly'
      : `Phục vụ ${selectedCustomer.name} ➜`;
  const cupWidth = scene.width > 0 ? cupSizeFor(scene.width, scene.height).width : 56;
  const panelWidth = panelWidthFor(width);

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
  }, [scene.width, scene.height, cupWidth, measureToken, wide]);

  const order = (
    <OrderBubble
      customer={selectedCustomer} cup={cup} config={config}
      patience={selectedCustomer ? patienceLeft(selectedCustomer, clock) : 1}
      tickets={tickets} selectedSlot={selectedSlot} onSelectTicket={onSelectTicket}
      width={(wide ? panelWidth : width) - GUTTER * 2} tall={wide} maxHeight={orderSpace}
    />
  );

  const kitchen = (
    <View style={styles.scene} onLayout={(event: LayoutChangeEvent) => {
      const { width: w, height: h } = event.nativeEvent.layout;
      setScene({ width: w, height: h });
    }}>
      {scene.height > 0 && <KitchenStation
        width={scene.width} height={scene.height} config={config} cup={cup} build={build} cupId={cupId}
        onPour={onPour} onScoop={onScoop} onIce={onIce} onSugar={onSugar} onDragging={onDragging}
        onMeterChange={setPourMeter} cupRef={machineRef}
      />}
      {pourMeter && <View style={[styles.floatingMeter, pointerEventsStyles.none]}><PourMeter {...pourMeter} /></View>}
    </View>
  );

  // The bin is also the toss's target, so its ref is on the box around the button either way.
  const clearButton = (
    <View ref={trashRef} style={wide ? undefined : styles.clear}>
      <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Đổ bỏ"
        style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
        <KitchenActionIcon kind="trash" />
        <Text style={styles.clearText}>Đổ bỏ</Text>
      </Pressable>
    </View>
  );
  const serveButton = (
    <Pressable onPress={onServe} disabled={!canServe} accessibilityRole="button"
      accessibilityLabel={serveLabel} accessibilityState={{ disabled: !canServe }}
      style={({ pressed }) => [styles.serve, wide && styles.serveWide, !canServe && styles.disabled, pressed && styles.pressed]}>
      <KitchenActionIcon kind="cup" />
      <Text style={styles.serveText} numberOfLines={1} adjustsFontSizeToFit>{serveLabel}</Text>
    </Pressable>
  );

  if (wide) {
    // Sideways the kitchen keeps the whole height of the page, and the order — the thing that is
    // read rather than handled — stands in a column beside it with the buttons under it.
    return (
      <View style={[styles.page, styles.pageWide, { width, paddingLeft: insets.left }]}>
        {kitchen}
        <View style={[styles.column, { width: panelWidth, paddingBottom: 10 + insets.bottom, paddingRight: GUTTER + insets.right }]}>
          {/* The card stands in whatever the buttons leave, and is told how much that is: a
              phone on its side has barely two hundred pixels here, and a full order laid out at
              the size a tablet's column takes would run out under the buttons. */}
          <View style={styles.orderSpace} onLayout={(event: LayoutChangeEvent) => {
            setOrderSpace(event.nativeEvent.layout.height);
          }}>
            {order}
          </View>
          {clearButton}
          {serveButton}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.orderHeader}>{order}</View>
      {kitchen}
      <View style={[styles.actions, { paddingBottom: 10 + insets.bottom }]}>
        {clearButton}
        {serveButton}
      </View>
    </View>
  );
}

/** The band of shop either side of the order panel. */
const GUTTER = 10;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF4DE' },
  pageWide: { flexDirection: 'row', alignItems: 'stretch' },
  orderHeader: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 9, backgroundColor: '#FBF0DA', borderBottomWidth: 2, borderBottomColor: '#D7B384' },
  column: {
    gap: 10,
    paddingLeft: GUTTER,
    paddingTop: 8,
    backgroundColor: '#FBF0DA',
    borderLeftWidth: 2,
    borderLeftColor: '#D7B384',
  },
  scene: { flex: 1, overflow: 'hidden', backgroundColor: '#FBE6BF' },
  floatingMeter: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#F4E2C3', borderTopWidth: 2, borderTopColor: '#C69B66' },
  clear: { flex: 1 },
  /** In the column the card is only as tall as the order; the buttons keep the foot of it. */
  /** The card takes the column down to the buttons, however tall the order it is showing. */
  orderSpace: { flex: 1, overflow: 'hidden' },
  clearButton: { minHeight: 52, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4DF', borderRadius: 13, borderWidth: 1.5, borderColor: '#C99F6A', borderBottomWidth: 4 },
  clearText: { fontFamily: fonts.bold, fontSize: 16, color: '#805735' },
  serve: { flex: 2.1, minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B874B', borderRadius: 13, borderWidth: 1.5, borderColor: '#66703C', borderBottomWidth: 4 },
  /** In the side column the buttons are stacked, so neither of them shares out a row's width. */
  serveWide: { flex: 0, minHeight: 56 },
  serveText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFF7DF', flexShrink: 1 },
  disabled: { backgroundColor: '#B1AE83', borderColor: '#9B9771' },
  pressed: { opacity: 0.8, transform: [{ translateY: 2 }] },
});
