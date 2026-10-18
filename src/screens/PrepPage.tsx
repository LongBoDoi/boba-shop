import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KitchenActionIcon } from '../components/art/KitchenEquipment';
import { Point } from '../components/Effects';
import { cupSizeFor, KitchenStation } from '../components/KitchenStation';
import { OrderBubble } from '../components/OrderBubble';
import { PourMeter, PourMeterState } from '../components/PourFeedback';
import { Ticket } from '../components/TicketRail';
import { CupSize, Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { Customer, CupBuild, patienceLeft } from '../game/reducer';
import { panelWidthFor, PrepLayout } from '../responsive';
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
  /** Where the order and the buttons go: above the kitchen or beside it. See `prepLayoutFor`. */
  layout: PrepLayout;
  /** Bumped by the parent when this page scrolls into view, to re-measure on-screen positions. */
  measureToken: number;
  onGeometry: (geometry: PrepGeometry) => void;
  onSelectTicket: (slot: number) => void;
  onPour: (category: 'tea' | 'milk', optionId: string, amount: number) => void;
  onScoop: (category: 'toppings' | 'foam', optionId: string) => void;
  onIce: () => void;
  onSugar: () => void;
  onPickCup: (size: CupSize) => void;
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
  layout,
  measureToken,
  onGeometry,
  onSelectTicket,
  onPour,
  onScoop,
  onIce,
  onSugar,
  onPickCup,
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
  const canServe = Boolean(selectedCustomer && cup.size && cup.tea);
  const serveLabel = !selectedCustomer
    ? 'Chọn order để pha'
    : !cup.size
      ? 'Lấy ly đúng cỡ từ kệ'
    : !cup.tea
      ? 'Rót trà vào ly'
      : `Phục vụ ${selectedCustomer.name} ➜`;
  /*
   * Each of the three layouts below is its own tree, and `key` is what stops React reconciling
   * one against another. They are all a `<View>` holding `<View>`s, so without it the band's own
   * strip is updated *into* the kitchen's box and the kitchen into whatever stood next to it —
   * the host views survive, their `onLayout` never fires, and `KitchenStation` goes on laying the
   * room out for the box it had under the other layout. That is a room drawn at the wrong scale
   * with its hint pill somewhere below the bottom of the screen, and nothing about it looks like
   * a keying problem.
   */
  const cupWidth = scene.width > 0 ? cupSizeFor(scene.width, scene.height).width : 56;
  const panelWidth = panelWidthFor(width);
  const column = layout === 'column';
  const band = layout === 'band';
  // Sideways the card spans the band, inside whatever the notch leaves of it.
  const bandOrderWidth = width - insets.left - insets.right - GUTTER * 2;

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
  }, [scene.width, scene.height, cupWidth, measureToken, layout, cup.size, cupId]);

  const order = (
    <OrderBubble
      customer={selectedCustomer} cup={cup} config={config}
      patience={selectedCustomer ? patienceLeft(selectedCustomer, clock) : 1}
      tickets={tickets} selectedSlot={selectedSlot} onSelectTicket={onSelectTicket}
      width={column ? panelWidth - GUTTER * 2 : band ? bandOrderWidth : width - GUTTER * 2}
      form={layout} maxHeight={orderSpace}
    />
  );

  const kitchen = (
    <View style={styles.scene} onLayout={(event: LayoutChangeEvent) => {
      const { width: w, height: h } = event.nativeEvent.layout;
      setScene({ width: w, height: h });
    }}>
      {scene.height > 0 && <KitchenStation
        width={scene.width} height={scene.height} config={config} cup={cup} build={build} cupId={cupId}
        onPour={onPour} onScoop={onScoop} onIce={onIce} onSugar={onSugar}
        onPickCup={onPickCup}
        onMeterChange={setPourMeter} cupRef={machineRef}
      />}
      {pourMeter && <View style={[styles.floatingMeter, pointerEventsStyles.none]}><PourMeter {...pourMeter} /></View>}
    </View>
  );

  // The bin is also the toss's target, so its ref is on the box around the button either way.
  const clearButton = (
    <View ref={trashRef} style={column ? undefined : styles.clear}>
      <Pressable onPress={onClear} disabled={!cup.size} accessibilityRole="button" accessibilityLabel="Đổ bỏ"
        accessibilityState={{ disabled: !cup.size }}
        style={({ pressed }) => [styles.clearButton, band && styles.buttonBand, !cup.size && { opacity: 0.55 }, pressed && styles.pressed]}>
        <KitchenActionIcon kind="trash" />
        <Text style={styles.clearText}>Đổ bỏ</Text>
      </Pressable>
    </View>
  );
  const serveButton = (
    <Pressable onPress={onServe} disabled={!canServe} accessibilityRole="button"
      accessibilityLabel={serveLabel} accessibilityState={{ disabled: !canServe }}
      style={({ pressed }) => [styles.serve, column && styles.serveWide, band && styles.buttonBand,
        !canServe && styles.disabled, pressed && styles.pressed]}>
      <KitchenActionIcon kind="cup" />
      <Text style={styles.serveText} numberOfLines={1} adjustsFontSizeToFit>{serveLabel}</Text>
    </Pressable>
  );

  if (column) {
    // Sideways and short with it: the kitchen keeps the whole height of the page, and the order —
    // the thing that is read rather than handled — stands beside it with the buttons under it.
    return (
      <View key={layout} style={[styles.page, styles.pageWide, { width, paddingLeft: insets.left }]}>
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

  // Upright and sideways are the same arrangement — the order across the top, the kitchen, the
  // two buttons along the bottom — and sideways is that arrangement with every spare pixel taken
  // out of it. The card's tiles move up beside its name and the buttons give back a few pixels of
  // height, because all of it comes off the room. See "Turning it on its side" in CLAUDE.md.
  return (
    <View key={layout} style={[styles.page, { width }]}>
      <View style={[styles.orderHeader, band && styles.orderHeaderBand,
        band && { paddingLeft: GUTTER + insets.left, paddingRight: GUTTER + insets.right }]}>
        {order}
      </View>
      {kitchen}
      <View style={[styles.actions, band && styles.actionsBand,
        { paddingBottom: (band ? ACTIONS_PAD : 10) + insets.bottom },
        band && { paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }]}>
        {clearButton}
        {serveButton}
      </View>
    </View>
  );
}

/** The band of shop either side of the order panel. */
const GUTTER = 10;
/** The sideways button bar: shorter buttons and less air, since the room pays for both. */
const ACTIONS_PAD = 6;
const ACTIONS_BUTTON = 48;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF4DE' },
  pageWide: { flexDirection: 'row', alignItems: 'stretch' },
  orderHeader: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 9, backgroundColor: '#FBF0DA', borderBottomWidth: 2, borderBottomColor: '#D7B384' },
  /** Sideways the card is shorter, so the air around it is trimmed to match. */
  orderHeaderBand: { paddingTop: 7, paddingBottom: 8 },
  actionsBand: { paddingTop: ACTIONS_PAD },
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
  /** Sideways both buttons are a little shorter; the pixels go to the room. */
  buttonBand: { minHeight: ACTIONS_BUTTON },
  serveText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFF7DF', flexShrink: 1 },
  disabled: { backgroundColor: '#B1AE83', borderColor: '#9B9771' },
  pressed: { opacity: 0.8, transform: [{ translateY: 2 }] },
});
