import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { CategoryId, describeSelection, Drink, selectedIds } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { categoryMatches, drinkPrice } from '../game/orders';
import { Customer } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { Character } from './art/Character';
import { IngredientIcon } from './art/IngredientIcon';

interface OrderTicketProps {
  customer: Customer | null;
  cup: Drink;
  config: DayConfig;
}

export function OrderTicket({ customer, cup, config }: OrderTicketProps) {
  if (!customer) {
    return (
      <View style={[styles.ticket, styles.waiting]}>
        <Text style={styles.waitingText}>Chọn một order để pha</Text>
      </View>
    );
  }
  return <Ticket key={customer.id} customer={customer} cup={cup} config={config} />;
}

function Ticket({ customer, cup, config }: { customer: Customer; cup: Drink; config: DayConfig }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * -8 }],
  }));

  return (
    <Animated.View style={style}>
      <View style={styles.ticket}>
        <View style={styles.pin} />
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Character look={customer.look} mood="happy" width={24} headOnly />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {customer.name}
          </Text>
          <View style={styles.priceTag}>
            <Text style={styles.price}>{formatMoney(drinkPrice(customer.order))}</Text>
          </View>
        </View>
        {config.categories.map((category) => (
          <TicketRow key={category} category={category} order={customer.order} done={categoryMatches(cup, customer.order, category)} />
        ))}
      </View>
      <Svg width="100%" height={6} viewBox="0 0 100 6" preserveAspectRatio="none" style={styles.zigzag}>
        <Path d="M0 0 L5 6 L10 0 L15 6 L20 0 L25 6 L30 0 L35 6 L40 0 L45 6 L50 0 L55 6 L60 0 L65 6 L70 0 L75 6 L80 0 L85 6 L90 0 L95 6 L100 0 Z" fill={colors.paper} />
      </Svg>
    </Animated.View>
  );
}

function TicketRow({ category, order, done }: { category: CategoryId; order: Drink; done: boolean }) {
  const ids = selectedIds(order, category);
  const check = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    check.value = withTiming(done ? 1 : 0, timing(DURATION.fast));
  }, [done, check]);
  const checkStyle = useAnimatedStyle(() => ({ opacity: check.value })); 

  return (
    <View style={styles.row}>
      <View style={styles.icons}>
        {ids.length > 0 ? (
          ids.map((id) => <IngredientIcon key={id} category={category} id={id} size={18} />)
        ) : (
          <Text style={styles.none}>–</Text>
        )}
      </View>
      <Text style={[styles.item, done && styles.itemDone]} numberOfLines={2}>
        {describeSelection(order, category)}
      </Text>
      <View style={styles.checkBox}>
        <Animated.View style={[styles.check, checkStyle]}>
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  zigzag: {
    marginTop: -0.5,
  },
  pin: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },
  waiting: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    borderRadius: 6,
  },
  waitingText: {
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderBottomColor: colors.line,
    paddingBottom: 5,
    marginBottom: 2,
    gap: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  priceTag: {
    backgroundColor: '#E5F6EC',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  price: {
    fontSize: 14,
    fontFamily: fonts.display,
    color: colors.good,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0.5,
  },
  icons: {
    width: 30,
    flexDirection: 'row',
  },
  none: {
    color: colors.inkSoft,
    fontFamily: fonts.bold,
    width: 18,
    textAlign: 'center',
  },
  item: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 15,
    fontFamily: fonts.semi,
    color: colors.ink,
  },
  itemDone: {
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.display,
  },
});
