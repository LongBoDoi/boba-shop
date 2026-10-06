import { StyleSheet, Text, View } from 'react-native';

import { CustomerStage } from '../components/CustomerStage';
import { Customer, Departure, Feedback } from '../game/reducer';
import { colors, fonts } from '../theme';

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
      <View style={styles.floor}>
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>Chạm vào khách để nhận order</Text>
          <Text style={styles.hintText}>Khung vàng là khách đang muốn gọi. Nhận xong, vuốt sang Pha chế ➜ để làm ly.</Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  hint: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    maxWidth: 320,
    borderBottomWidth: 5,
    borderBottomColor: colors.line,
  },
  hintTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  hintText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
