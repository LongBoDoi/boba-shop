import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CategoryId, CATEGORIES, describeSelection, Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { categoryMatches, drinkPrice } from '../game/orders';
import { Customer } from '../game/reducer';
import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { Character } from './art/Character';

interface OrderTicketProps {
  customer: Customer | null;
  cup: Drink;
  config: DayConfig;
}

/**
 * The order slip clipped above the kitchen: a compact strip of what to put in the cup, ticked off
 * as the drink comes together. Kept out of the kitchen itself so the whole room is workspace.
 */
export function OrderTicket({ customer, cup, config }: OrderTicketProps) {
  if (!customer) {
    return (
      <View style={[styles.slip, styles.waiting]}>
        <Text style={styles.waitingText}>Chọn một order ở trên để pha</Text>
      </View>
    );
  }
  return <Slip key={customer.id} customer={customer} cup={cup} config={config} />;
}

function Slip({ customer, cup, config }: { customer: Customer; cup: Drink; config: DayConfig }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.set(withTiming(1, timing()));
  }, [appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * -6 }],
  }));

  return (
    <Animated.View style={[styles.slip, style]}>
      <View style={styles.who}>
        <View style={styles.avatar}>
          <Character look={customer.look} mood="happy" width={22} headOnly />
        </View>
        <View style={styles.whoText}>
          <Text style={styles.name} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={styles.price}>{formatMoney(drinkPrice(customer.order))}</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {config.categories.map((category) => (
          <Chip
            key={category}
            category={category}
            order={customer.order}
            done={categoryMatches(cup, customer.order, category)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function Chip({ category, order, done }: { category: CategoryId; order: Drink; done: boolean }) {
  return (
    <View style={[styles.chip, done && styles.chipDone]}>
      <Text style={styles.chipIcon}>{done ? '✓' : CATEGORIES[category].icon}</Text>
      <Text style={[styles.chipText, done && styles.chipTextDone]} numberOfLines={1}>
        {describeSelection(order, category)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  waiting: {
    justifyContent: 'center',
    paddingVertical: 9,
  },
  waitingText: {
    color: colors.inkSoft,
    fontFamily: fonts.semi,
    fontSize: 13,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 8,
    borderRightWidth: 1.5,
    borderRightColor: colors.line,
    borderStyle: 'dashed',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whoText: {
    maxWidth: 74,
  },
  name: {
    fontSize: 13,
    lineHeight: 15,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  price: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fonts.bold,
    color: colors.good,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: '#FFF1E4',
  },
  chipDone: {
    backgroundColor: '#E5F6EC',
  },
  chipIcon: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.good,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semi,
    color: colors.ink,
    maxWidth: 108,
  },
  chipTextDone: {
    color: colors.good,
    textDecorationLine: 'line-through',
  },
});
