import { memo, useId } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

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
import { pointerEventsStyles } from '../pointerEvents';

/**
 * The order is read, not built, so it is listed the way it would be said over the counter —
 * tea first, then what goes in it — rather than in `BUILD_ORDER`, which runs bottom of the cup
 * upwards.
 */
const SPOKEN: CategoryId[] = ['tea', 'milk', 'sweetness', 'ice', 'toppings', 'foam'];

const HEART =
  'M12 21.1 C5.6 16.8 2.2 13.2 2.2 9.3 C2.2 6.2 4.6 3.9 7.6 3.9 C9.5 3.9 11.1 4.8 12 6.3 ' +
  'C12.9 4.8 14.5 3.9 16.4 3.9 C19.4 3.9 21.8 6.2 21.8 9.3 C21.8 13.2 18.4 16.8 12 21.1 Z';

/**
 * The panel's own height, held constant whether or not an order is selected.
 *
 * The kitchen below it is laid out from the height it is given (`layoutKitchen`), so a panel that
 * grew a row when an order was picked would move every dispenser and the cup with it.
 */
export const ORDER_PANEL_HEIGHT = 132;

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
  /** The other taken orders, waiting their turn in the panel's own queue. */
  tickets: Ticket[];
  selectedSlot: number | null;
  width: number;
  onSelectTicket: (slot: number) => void;
}

/**
 * The order the player is making, spoken back to them across the top of the kitchen: who it is
 * for, what the drink is called, how much of it is done, and a tile for every thing that goes in
 * it. The heart beside the name is the customer's patience, emptying from the top.
 *
 * It is a panel docked above the room rather than a note floating over it, so everything it has
 * to say stays inside its own edges: the other waiting orders stand in a queue to the right of
 * the heart instead of hanging off the card's corner, where they used to cover the last two
 * ingredients of a full order. Only those queue portraits take touches.
 */
export const OrderBubble = memo(function OrderBubble({
  customer,
  cup,
  config,
  patience,
  tickets,
  selectedSlot,
  width: W,
  onSelectTicket,
}: OrderBubbleProps) {
  const pad = 10;
  const avatar = 40;
  const others = tickets.filter((ticket) => ticket.slot !== selectedSlot);

  const chips = customer ? chipsFor(customer.order, cup, config) : [];
  const done = chips.filter((chip) => chip.done).length;
  // The tiles stand together at one size and the row runs out from the left, the way the order
  // is read. Sharing the whole width out between them instead leaves a two-thing order as two
  // tiles marooned at either end of the card.
  const room = W - pad * 2;
  const column = chips.length > 0 ? Math.min(room / chips.length, 56) : 0;
  const tile = Math.round(Math.max(24, Math.min(column - 16, 32)));
  const caption = Math.round(Math.max(9, Math.min(column * 0.2, 10.5)) * 2) / 2;

  return (
    <View
      style={[styles.card, { width: W, height: ORDER_PANEL_HEIGHT, padding: pad }, pointerEventsStyles.boxNone]}
    >
      <View style={styles.head}>
        {/* who it is for */}
        <View style={[styles.avatar, { width: avatar, height: avatar, borderRadius: avatar * 0.32 }]}>
          {customer ? (
            <Character look={customer.look} mood="happy" width={avatar * 0.92} headOnly />
          ) : (
            <Image source={ICON_CUP} style={{ width: avatar * 0.5, height: avatar * 0.5 }} resizeMode="contain" />
          )}
        </View>
        <View style={styles.name}>
          <Text style={styles.title} numberOfLines={1}>
            {customer ? drinkName(customer.order) : 'Chưa có order'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {customer ? `Cho ${customer.name} · xong ${done}/${chips.length}` : 'Vuốt sang Quầy để nhận order'}
          </Text>
        </View>
        {customer && <Patience size={26} left={patience} />}
        {others.length > 0 && (
          <>
            <View style={styles.split} />
            <View style={styles.queue}>
              {others.map(({ slot, customer: waiting }) => (
                <OrderPin
                  key={waiting.id}
                  customer={waiting}
                  cup={cup}
                  config={config}
                  size={32}
                  onPress={() => onSelectTicket(slot)}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* How much of the drink is made, under the name it is being made for. */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${chips.length > 0 ? (done / chips.length) * 100 : 0}%` }]} />
      </View>

      {customer ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <ChipTile key={chip.key} chip={chip} width={column} tile={tile} caption={caption} />
          ))}
        </View>
      ) : (
        <View style={styles.hintBox}>
          <Text style={styles.hint}>Mỗi order hiện ở đây, kèm từng thứ cần cho vào ly.</Text>
        </View>
      )}
    </View>
  );
});

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

/**
 * The customer's patience, as a heart emptying from the top.
 *
 * The emptying is a **mask**, not a clip: a clip path is built once and cached on Android, and
 * nothing inside one can clear that cache, so the heart would stay as full as it was drawn the
 * first time. See "Drawing on a phone" in CLAUDE.md.
 */
function Patience({ size, left }: { size: number; left: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = Math.max(0, Math.min(1, left));
  const tone = p > 0.55 ? colors.primary : p > 0.28 ? colors.ok : colors.bad;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <Mask id={`patience${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
          <Rect x={0} y={24 * (1 - p)} width={24} height={24 * p} fill="#FFFFFF" />
        </Mask>
      </Defs>
      <Path d={HEART} fill="#FFFFFF" />
      <Path d={HEART} fill={tone} mask={`url(#patience${uid})`} />
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
          { width: tile, height: tile, borderRadius: tile * 0.3 },
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
          <View style={[styles.check, { width: tile * 0.42, height: tile * 0.42, borderRadius: tile * 0.21 }]}>
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

/** One of the other taken orders, waiting its turn. */
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
      hitSlop={5}
      style={[styles.pin, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Character look={customer.look} mood="happy" width={size * 0.8} headOnly />
      {ready && <View style={[styles.pinReady, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8E7',
    borderWidth: 2,
    borderRadius: 18,
    borderColor: '#D8B889',
    ...Platform.select({
      web: { boxShadow: '0px 4px 9px rgba(107, 74, 50, 0.22)' },
      default: {
        shadowColor: '#6B4A32',
        shadowOpacity: 0.22,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      },
    }),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#F2E4BD',
    borderWidth: 2,
    borderColor: '#D8BC87',
  },
  name: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: '#9C7B55',
    fontFamily: fonts.semi,
  },
  split: {
    width: 1.5,
    height: 30,
    borderRadius: 1,
    backgroundColor: '#EBD7B4',
  },
  queue: {
    flexDirection: 'row',
    gap: 5,
  },
  track: {
    height: 5,
    marginTop: 7,
    marginBottom: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#F0E1C3',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.good,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  hintBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.inkSoft,
    fontFamily: fonts.semi,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF3',
    borderWidth: 1.8,
    borderColor: '#E4CEAA',
  },
  tileDone: {
    borderColor: '#8C9A57',
    backgroundColor: '#F0F2DC',
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
    borderColor: '#FFF8E7',
  },
  checkMark: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
  },
  caption: {
    marginTop: 2,
    textAlign: 'center',
    color: '#6B4A32',
    fontFamily: fonts.semi,
  },
  captionDone: {
    color: colors.good,
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF6E9',
    borderWidth: 2,
    borderColor: '#D8B889',
  },
  pinReady: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    backgroundColor: colors.good,
    borderWidth: 1.5,
    borderColor: '#D8B889',
  },
});
