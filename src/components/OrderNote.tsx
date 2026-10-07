import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, describeSelection, Drink } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { formatMoney } from '../game/money';
import { categoryMatches, drinkPrice, evaluateDrink } from '../game/orders';
import { Customer } from '../game/reducer';
import { colors, fonts } from '../theme';
import { Character } from './art/Character';
import { CARD, CARD_BLANK } from './art/kitchenArt';

interface OrderNoteProps {
  customer: Customer | null;
  cup: Drink;
  config: DayConfig;
  /** Fraction of the serve window still left, for the slip's timer bar. */
  patience: number;
  x: number;
  y: number;
  height: number;
  width: number;
}

/**
 * The order, on a note clipped to the shop's rail — where the shop would really keep it. With
 * nothing taken yet it is the printed "Ly mới" slip; otherwise the customer's name goes on the
 * header and the drink is listed underneath, ticking off as the cup comes together.
 */
export function OrderNote({ customer, cup, config, patience, x, y, width, height }: OrderNoteProps) {
  if (!customer) {
    return <Image source={CARD} style={{ position: 'absolute', left: x, top: y, width, height }} />;
  }

  const bar = patience > 0.6 ? colors.good : patience > 0.3 ? colors.ok : colors.bad;
  // The slip is sized by its width: that is what the drink's name has to fit into.
  const line = Math.max(8, Math.round(width * 0.105));

  return (
    <View style={{ position: 'absolute', left: x, top: y, width, height }} pointerEvents="none">
      <Image source={CARD_BLANK} style={{ position: 'absolute', left: 0, top: 0, width, height }} />
      <Text
        style={[styles.name, { top: height * 0.125, fontSize: line * 1.25, lineHeight: height * 0.13 }]}
        numberOfLines={1}
      >
        {customer.name}
      </Text>
      <View style={[styles.list, { top: height * 0.29, left: width * 0.11, right: width * 0.1 }]}>
        {config.categories.map((category) => {
          const done = categoryMatches(cup, customer.order, category);
          return (
            <Text
              key={category}
              style={[styles.item, { fontSize: line, lineHeight: line * 1.4 }, done && styles.itemDone]}
              numberOfLines={1}
            >
              {done ? '✓ ' : `${CATEGORIES[category].icon} `}
              {describeSelection(customer.order, category)}
            </Text>
          );
        })}
      </View>
      <Text style={[styles.price, { bottom: height * 0.1, fontSize: line * 1.05 }]}>
        {formatMoney(drinkPrice(customer.order))}
      </Text>
      <View style={[styles.track, { bottom: height * 0.055, left: width * 0.14, right: width * 0.14 }]}>
        <View style={[styles.fill, { width: `${Math.max(0, patience) * 100}%`, backgroundColor: bar }]} />
      </View>
    </View>
  );
}

interface TicketPinProps {
  customer: Customer;
  cup: Drink;
  config: DayConfig;
  selected: boolean;
  size: number;
  x: number;
  y: number;
  onPress: () => void;
}

/** One taken order, hanging on the rail: tap it to make that drink next. */
export function TicketPin({ customer, cup, config, selected, size, x, y, onPress }: TicketPinProps) {
  const ready = evaluateDrink(cup, customer.order, config.categories).quality === 'perfect';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order của ${customer.name}`}
      accessibilityState={{ selected }}
      style={{ position: 'absolute', left: x, top: y, width: size, alignItems: 'center' }}
    >
      <View style={[styles.peg, { width: size * 0.18, height: size * 0.26 }]} />
      <View
        style={[
          styles.pin,
          { width: size, height: size, borderRadius: size / 2 },
          selected && styles.pinSelected,
        ]}
      >
        <Character look={customer.look} mood="happy" width={size * 0.78} headOnly />
      </View>
      {ready && (
        <View style={[styles.ready, { width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 }]}>
          <Text style={[styles.readyMark, { fontSize: size * 0.26 }]}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
  list: {
    position: 'absolute',
  },
  item: {
    fontFamily: fonts.semi,
    color: '#6B4A32',
  },
  itemDone: {
    color: colors.good,
    textDecorationLine: 'line-through',
  },
  price: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.good,
    fontFamily: fonts.bold,
  },
  track: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E6D8C6',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  peg: {
    borderRadius: 3,
    backgroundColor: '#9AA4AC',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF6E9',
    borderWidth: 2.5,
    borderColor: '#C9B9A8',
  },
  pinSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  ready: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  readyMark: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
  },
});
