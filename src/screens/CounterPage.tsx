import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { CounterTop } from '../components/art/CounterTop';
import { CustomerStage } from '../components/CustomerStage';
import { Customer, Departure, Feedback } from '../game/reducer';
import { colors } from '../theme';

interface CounterPageProps {
  width: number;
  stageHeight: number;
  /** Sideways: bigger customers, so a wide stage is not a row of distant figures. */
  wide: boolean;
  /** Whether the counter is the page being looked at; off it, the window's clouds stand still. */
  onScreen: boolean;
  slots: (Customer | null)[];
  departures: Departure[];
  selectedSlot: number | null;
  clock: number;
  feedback: Feedback[];
  onTakeOrder: (slot: number) => void;
  onFocusTicket: (slot: number) => void;
}

/** The order-taking screen: customers wait at the counter; tap one to take their order. */
export function CounterPage({
  width,
  stageHeight,
  wide,
  onScreen,
  slots,
  departures,
  selectedSlot,
  clock,
  feedback,
  onTakeOrder,
  onFocusTicket,
}: CounterPageProps) {
  const [floor, setFloor] = useState({ width, height: 0 });
  return (
    <View style={[styles.page, { width }]}>
      <CustomerStage
        width={width}
        height={stageHeight}
        wide={wide}
        drifting={onScreen}
        slots={slots}
        departures={departures}
        selectedSlot={selectedSlot}
        clock={clock}
        feedback={feedback}
        onTakeOrder={onTakeOrder}
        onFocusTicket={onFocusTicket}
      />
      <View
        style={styles.floor}
        onLayout={(event: LayoutChangeEvent) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setFloor({ width: w, height: h });
        }}
      >
        <CounterTop width={floor.width} height={floor.height} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  floor: {
    flex: 1,
    backgroundColor: colors.floor,
  },
});
