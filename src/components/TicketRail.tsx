import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { evaluateDrink } from '../game/orders';
import { Customer } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { Character } from './art/Character';
import { Cup } from './Cup';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface Ticket {
  slot: number;
  customer: Customer;
}

interface TicketRailProps {
  tickets: Ticket[];
  selectedSlot: number | null;
  cup: Drink;
  config: DayConfig;
  clock: number;
  onSelect: (slot: number) => void;
}

/** The row of taken-order tickets on the prep page; tap one to pick which drink you're making. */
export function TicketRail({ tickets, selectedSlot, cup, config, clock, onSelect }: TicketRailProps) {
  if (tickets.length === 0) {
    return (
      <View style={[styles.rail, styles.empty]}>
        <Text style={styles.emptyText}>Chưa có order — vuốt sang Quầy để nhận</Text>
      </View>
    );
  }
  return (
    <View style={styles.rail}>
      {tickets.map(({ slot, customer }) => (
        <TicketCard
          key={customer.id}
          customer={customer}
          selected={slot === selectedSlot}
          ready={evaluateDrink(cup, customer.order, config.categories).quality === 'perfect'}
          patience={Math.max(0, 1 - (clock - (customer.orderedAt ?? customer.arrivedAt)) / customer.patienceMs)}
          onPress={() => onSelect(slot)}
        />
      ))}
    </View>
  );
}

interface TicketCardProps {
  customer: Customer;
  selected: boolean;
  ready: boolean;
  patience: number;
  onPress: () => void;
}

function TicketCard({ customer, selected, ready, patience, onPress }: TicketCardProps) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const barColor = patience > 0.6 ? colors.good : patience > 0.3 ? colors.ok : colors.bad;

  return (
    <AnimatedPressable
      onPressIn={() => press.set(withTiming(0.97, { duration: 80 }))}
      onPressOut={() => press.set(withTiming(1, timing(DURATION.fast)))}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected, style]}
      accessibilityRole="button"
      accessibilityLabel={`Order của ${customer.name}`}
      accessibilityState={{ selected }}
    >
      {ready && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>✓</Text>
        </View>
      )}
      <View style={styles.avatar}>
        <Character look={customer.look} mood="happy" width={22} headOnly />
      </View>
      <Cup drink={customer.order} width={24} backgroundColor={selected ? colors.primaryTint : '#FFFFFF'} straw />
      <Text style={styles.name} numberOfLines={1}>
        {customer.name}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${patience * 100}%`, backgroundColor: barColor }]} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
  },
  emptyText: {
    color: colors.inkSoft,
    fontFamily: fonts.semi,
    fontSize: 13,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingTop: 6,
    paddingBottom: 5,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  readyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  readyText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.display,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.bold,
    color: colors.ink,
    maxWidth: '100%',
  },
  track: {
    width: '86%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#EFE3D8',
    overflow: 'hidden',
    marginTop: 1,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
