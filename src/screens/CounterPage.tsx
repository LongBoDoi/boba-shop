import { StyleSheet, View } from 'react-native';

import { CustomerStage } from '../components/CustomerStage';
import { Customer, Departure, Feedback } from '../game/reducer';
import { colors } from '../theme';

interface CounterPageProps {
  width: number;
  stageHeight: number;
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
  slots,
  departures,
  selectedSlot,
  clock,
  feedback,
  onTakeOrder,
  onFocusTicket,
}: CounterPageProps) {
  return (
    <View style={[styles.page, { width }]}>
      <CustomerStage
        width={width}
        height={stageHeight}
        slots={slots}
        departures={departures}
        selectedSlot={selectedSlot}
        clock={clock}
        feedback={feedback}
        onTakeOrder={onTakeOrder}
        onFocusTicket={onFocusTicket}
      />
      <View style={styles.floor} />
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
