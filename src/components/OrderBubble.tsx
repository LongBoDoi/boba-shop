import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import {
  CategoryId,
  describeSelection,
  Drink,
  effectiveId,
  getIngredient,
  selectedIds,
} from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { categoryMatches, evaluateDrink } from '../game/orders';
import { Customer } from '../game/reducer';
import { colors, fonts } from '../theme';
import { Character } from './art/Character';
import { IngredientIcon } from './art/IngredientIcon';
import { ICON_CUP } from './art/kitchenArt';
import { Ticket } from './TicketRail';

/**
 * The order is read, not built, so it is listed the way it would be said over the counter —
 * tea first, then what goes in it — rather than in `BUILD_ORDER`, which runs bottom of the cup
 * upwards.
 */
const SPOKEN: CategoryId[] = ['tea', 'milk', 'sweetness', 'ice', 'toppings', 'foam'];

const HEART =
  'M12 21.1 C5.6 16.8 2.2 13.2 2.2 9.3 C2.2 6.2 4.6 3.9 7.6 3.9 C9.5 3.9 11.1 4.8 12 6.3 ' +
  'C12.9 4.8 14.5 3.9 16.4 3.9 C19.4 3.9 21.8 6.2 21.8 9.3 C21.8 13.2 18.4 16.8 12 21.1 Z';

interface Chip {
  key: string;
  category: CategoryId;
  /** The ingredient the icon draws; null when the order asks for none of this category. */
  id: string | null;
  label: string;
  done: boolean;
}

/** What the order asks for, one tile per thing — a cup with two toppings gets two. */
function chipsFor(order: Drink, cup: Drink, config: DayConfig): Chip[] {
  return SPOKEN.filter((category) => config.categories.includes(category)).flatMap<Chip>((category) => {
    const done = categoryMatches(cup, order, category);
    if (category === 'toppings') {
      const ids = selectedIds(order, category);
      if (ids.length === 0) return [{ key: 'toppings', category, id: null, label: 'Không topping', done }];
      return ids.map((id) => ({
        key: `topping-${id}`,
        category,
        id,
        label: getIngredient(category, id)?.name ?? id,
        done,
      }));
    }
    return [
      {
        key: category,
        category,
        id: effectiveId(order, category),
        label: describeSelection(order, category),
        done,
      },
    ];
  });
}

interface OrderBubbleProps {
  customer: Customer | null;
  cup: Drink;
  config: DayConfig;
  /** Fraction of the serve window still left; the heart empties with it. */
  patience: number;
  /** The other taken orders, pegged under the card's right corner. */
  tickets: Ticket[];
  selectedSlot: number | null;
  width: number;
  onSelectTicket: (slot: number) => void;
}

/**
 * The order the player is making, spoken back to them across the top of the kitchen: who it is
 * for, what the drink is called, and a tile for every thing that goes in it, each ticking off as
 * the cup comes together. The heart at the end is the customer's patience, emptying from the top.
 *
 * It is a **speech bubble over the room**, not a note pinned inside it, so nothing it covers is
 * ever something you reach for — and it takes no touches at all except on the pegged orders.
 */
export function OrderBubble({
  customer,
  cup,
  config,
  patience,
  tickets,
  selectedSlot,
  width: W,
  onSelectTicket,
}: OrderBubbleProps) {
  const pad = Math.round(Math.max(7, W * 0.022));
  const avatar = Math.round(Math.min(58, W * 0.155));
  const title = Math.round(Math.min(19, W * 0.052));
  const heart = Math.round(title * 1.5);
  const others = tickets.filter((ticket) => ticket.slot !== selectedSlot);
  const pin = Math.round(Math.min(30, W * 0.085));

  const chips = customer ? chipsFor(customer.order, cup, config) : [];
  // The tiles stand together at one size and the row runs out from the left, the way the order
  // is read. Sharing the whole width out between them instead leaves a two-thing order as two
  // tiles marooned at either end of the card.
  const room = W - pad * 3 - avatar;
  const column = chips.length > 0 ? Math.min(room / chips.length, avatar * 1.24) : 0;
  const tile = Math.round(Math.max(22, Math.min(column - 5, avatar * 0.84)));
  const caption = Math.round(Math.max(7.5, Math.min(9.5, column * 0.2)));

  return (
    <View style={{ width: W }}>
      <View style={[styles.card, { padding: pad, borderRadius: Math.round(W * 0.055) }]} pointerEvents="none">
        <View style={styles.row}>
          {/* who it is for */}
          <View style={[styles.avatar, { width: avatar, height: avatar, borderRadius: avatar * 0.3 }]}>
            {customer ? (
              <Character look={customer.look} mood="happy" width={avatar * 0.92} headOnly />
            ) : (
              <Image source={ICON_CUP} style={{ width: avatar * 0.56, height: avatar * 0.56 }} resizeMode="contain" />
            )}
          </View>
          {customer && (
            <View style={[styles.badge, { width: heart * 0.62, height: heart * 0.62, borderRadius: heart * 0.31 }]}>
              <Svg width={heart * 0.38} height={heart * 0.38} viewBox="0 0 24 24">
                <Path d={HEART} fill={colors.primary} />
              </Svg>
            </View>
          )}

          <View style={[styles.body, { marginLeft: pad }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { fontSize: title, lineHeight: title * 1.3 }]} numberOfLines={1}>
                {customer ? drinkName(customer.order) : 'Chọn order để pha'}
              </Text>
              {customer && <Patience size={heart} left={patience} />}
            </View>

            {customer ? (
              <View style={styles.chips}>
                {chips.map((chip) => (
                  <ChipTile key={chip.key} chip={chip} width={column} tile={tile} caption={caption} />
                ))}
              </View>
            ) : (
              <Text style={[styles.hint, { fontSize: Math.max(10, title * 0.62) }]} numberOfLines={1}>
                Nhận order ở quầy, rồi chọn một order ở đây
              </Text>
            )}
          </View>
        </View>
        {/* the bubble's tail, pointing down into the room */}
        <View
          style={[
            styles.tail,
            { left: Math.round(W * 0.12), width: pad * 1.7, height: pad * 1.7, bottom: -pad * 0.85 },
          ]}
        />
      </View>

      {/* the other taken orders, pegged under the card's corner — tap one to make it next */}
      {others.length > 0 && (
        <View style={[styles.pins, { right: pad, bottom: -pin * 0.42, gap: Math.round(pin * 0.2) }]}>
          {others.map(({ slot, customer: waiting }) => (
            <OrderPin
              key={waiting.id}
              customer={waiting}
              cup={cup}
              config={config}
              size={pin}
              onPress={() => onSelectTicket(slot)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * What the drink is called. A tea on its own goes by its own name; with milk in it the word
 * lands where Vietnamese puts it, which is not the same place every time — "Trà Thái" becomes
 * "Trà sữa Thái", but "Hồng trà" becomes "Hồng trà sữa", not "Trà sữa hồng trà".
 */
function drinkName(order: Drink): string {
  const tea = order.tea ? getIngredient('tea', order.tea)?.name : null;
  if (!tea) return 'Ly trà sữa';
  if (!order.milk || order.milk === 'none') return tea;
  if (/^trà\s/i.test(tea)) return `Trà sữa ${tea.slice(4)}`;
  if (/\strà$/i.test(tea)) return `${tea} sữa`;
  return `Trà sữa ${tea}`;
}

/** The customer's patience, as a heart emptying from the top. */
function Patience({ size, left }: { size: number; left: number }) {
  const p = Math.max(0, Math.min(1, left));
  const tone = p > 0.55 ? colors.primary : p > 0.28 ? colors.ok : colors.bad;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id="orderHeart">
          <Rect x={0} y={24 * (1 - p)} width={24} height={24 * p} />
        </ClipPath>
      </Defs>
      <Path d={HEART} fill="#FFFFFF" />
      <Path d={HEART} fill={tone} clipPath="url(#orderHeart)" />
      <Path d={HEART} fill="none" stroke={tone} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function ChipTile({ chip, width, tile, caption }: { chip: Chip; width: number; tile: number; caption: number }) {
  return (
    <View style={{ width, alignItems: 'center' }}>
      <View
        style={[
          styles.tile,
          { width: tile, height: tile, borderRadius: tile * 0.28 },
          chip.done && styles.tileDone,
        ]}
      >
        {chip.id ? (
          <IngredientIcon category={chip.category} id={chip.id} size={tile * 0.74} />
        ) : (
          // nothing of this kind was asked for: the thing, faded, with a line through it
          <View style={styles.none}>
            <IngredientIcon category={chip.category} id="pearls" size={tile * 0.74} />
            <View style={[styles.slash, { width: tile * 0.74 }]} />
          </View>
        )}
        {chip.done && (
          <View style={[styles.check, { width: tile * 0.4, height: tile * 0.4, borderRadius: tile * 0.2 }]}>
            <Text style={[styles.checkMark, { fontSize: tile * 0.26 }]}>✓</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.caption, { fontSize: caption, lineHeight: caption * 1.25 }, chip.done && styles.captionDone]}
        numberOfLines={2}
      >
        {chip.label}
      </Text>
    </View>
  );
}

/** One of the other taken orders. */
function OrderPin({
  customer,
  cup,
  config,
  size,
  onPress,
}: {
  customer: Customer;
  cup: Drink;
  config: DayConfig;
  size: number;
  onPress: () => void;
}) {
  const ready = evaluateDrink(cup, customer.order, config.categories).quality === 'perfect';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order của ${customer.name}`}
      style={[styles.pin, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Character look={customer.look} mood="happy" width={size * 0.8} headOnly />
      {ready && <View style={[styles.pinReady, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#6B4A32',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF1E2',
    borderWidth: 2,
    borderColor: '#F6D7C2',
  },
  badge: {
    position: 'absolute',
    left: -2,
    top: -3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFD7E3',
  },
  body: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.display,
  },
  hint: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fonts.semi,
  },
  chips: {
    marginTop: 3,
    // a two-line name needs its descenders clear of the card's edge
    paddingBottom: 3,
    flexDirection: 'row',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    borderColor: '#F0DCCB',
  },
  tileDone: {
    borderColor: colors.good,
    backgroundColor: '#EFFAF2',
  },
  none: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  slash: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.bad,
    transform: [{ rotate: '-45deg' }],
  },
  check: {
    position: 'absolute',
    right: -3,
    top: -3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.good,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  checkMark: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
  },
  caption: {
    marginTop: 1,
    textAlign: 'center',
    color: '#6B4A32',
    fontFamily: fonts.semi,
  },
  captionDone: {
    color: colors.good,
  },
  tail: {
    position: 'absolute',
    backgroundColor: colors.paper,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  pins: {
    position: 'absolute',
    flexDirection: 'row',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF6E9',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinReady: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    backgroundColor: colors.good,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
