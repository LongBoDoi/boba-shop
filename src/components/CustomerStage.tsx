import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Customer, Departure, Feedback, patienceLeft } from '../game/reducer';
import { ease, easeInOut, timing } from '../motion';
import { colors, fonts } from '../theme';
import { Character, Mood } from './art/Character';
import { Counter } from './art/Counter';
import { ShopBackdrop } from './art/ShopBackdrop';
import { Cup } from './Cup';
import { FloatingText } from './FloatingText';
import { pointerEventsStyles } from '../pointerEvents';

export const COUNTER_HEIGHT = 44;
/** Customers stand raised so the counter hides their waist, not their shoulders. */
const FIGURE_LIFT = 14;
const BUBBLE_CUP = 26;

interface CustomerStageProps {
  width: number;
  height: number;
  slots: (Customer | null)[];
  departures: Departure[];
  selectedSlot: number | null;
  clock: number;
  feedback: Feedback[];
  /** Tap a waiting customer to take their order. */
  onTakeOrder: (slot: number) => void;
  /** Tap a customer whose order is already taken to jump to their ticket on the prep page. */
  onFocusTicket: (slot: number) => void;
  /** A stage laid sideways, with the room for larger figures; see `stageMetrics`. */
  wide?: boolean;
  /** Whether the window's clouds move — only while the counter is on screen. */
  drifting?: boolean;
}

/**
 * Character size for a stage, shared with the effects layer so cups land on the right spot.
 *
 * The 108 is a phone's: a figure drawn any larger than that is wider than the slot it stands in.
 * A stage laid sideways has three or four times that width per slot and the height to match, and
 * holding the cap there leaves the customers small and far apart, like a shop seen from across
 * the street — so a wide stage sizes them off its own height instead, and the slot width and the
 * stage's headroom still have the last word.
 */
export function stageMetrics(width: number, height: number, slotCount: number, wide = false) {
  const slotWidth = width / slotCount;
  const cap = wide ? Math.min(170, Math.max(108, height * 0.42)) : 108;
  const charWidth = Math.min(cap, slotWidth * 0.8, (height - 76) / 1.2);
  const charHeight = charWidth * 1.2;
  const bubbleBottom = charHeight * 0.86 + FIGURE_LIFT;
  // Centre of the speech bubble, measured from the top of the stage.
  const bubbleCenterY = height - bubbleBottom - 26;
  return { slotWidth, charWidth, charHeight, bubbleBottom, bubbleCenterY };
}

export function CustomerStage({ width, height, slots, departures, selectedSlot, clock, feedback, wide = false, drifting = true, onTakeOrder, onFocusTicket }: CustomerStageProps) {
  // The same object between renders, so a customer whose patience has not visibly moved is left
  // alone on the game's clock instead of being drawn again.
  const metrics = useMemo(() => stageMetrics(width, height, slots.length, wide), [width, height, slots.length, wide]);

  // Two customers given half a sideways stage each stand a room apart, one at either end of an
  // empty counter. Sideways they keep a slot's worth of elbow room and queue in the middle of it
  // instead, which is also where the shop's own backdrop leaves room for them.
  const slotWidth = wide ? Math.min(width / slots.length, metrics.charWidth * 1.6) : undefined;

  return (
    <View style={{ width, height }}>
      <ShopBackdrop width={width} height={height} drifting={drifting} />
      <View style={[styles.row, wide && styles.rowCentred]}>
        {slots.map((customer, slot) => (
          <Pressable
            key={slot}
            // The width has to go in as the flex basis: `styles.slot` is `flex: 1`, which carries
            // a basis of 0, and a basis — even an inherited one — outranks a width.
            style={[styles.slot, slotWidth !== undefined && { flexGrow: 0, flexShrink: 0, flexBasis: slotWidth }]}
            onPress={() => (customer?.status === 'requesting' ? onTakeOrder(slot) : onFocusTicket(slot))}
            disabled={!customer}
            accessibilityRole="button"
            accessibilityLabel={
              customer
                ? customer.status === 'requesting'
                  ? `Nhận order của ${customer.name}`
                  : `Xem order của ${customer.name} — ly ${customer.order.size}`
                : 'Chỗ trống'
            }
          >
            {departures
              .filter((departure) => departure.slot === slot)
              .map((departure) => (
                <LeavingCustomer key={departure.id} departure={departure} metrics={metrics} />
              ))}
            {customer && (
              <ActiveCustomer
                key={customer.id}
                customer={customer}
                selected={slot === selectedSlot}
                patience={patienceLeft(customer, clock)}
                metrics={metrics}
                enterFrom={slot < slots.length / 2 ? -1 : 1}
              />
            )}
            {feedback
              .filter((item) => item.slot === slot)
              .map((item) => (
                <FloatingText key={item.id} text={item.text} tone={item.tone} top={metrics.bubbleCenterY - 10} />
              ))}
          </Pressable>
        ))}
      </View>
      <View style={[styles.counter, pointerEventsStyles.none]}>
        <Counter width={width} height={COUNTER_HEIGHT} />
      </View>
    </View>
  );
}

type Metrics = ReturnType<typeof stageMetrics>;

function useBlink() {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 140);
      }, 2000 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return blinking;
}

interface ActiveCustomerProps {
  customer: Customer;
  selected: boolean;
  patience: number;
  metrics: Metrics;
  enterFrom: number;
}

const ActiveCustomer = memo(function ActiveCustomer({ customer, selected, patience, metrics, enterFrom }: ActiveCustomerProps) {
  const mood: Mood = patience > 0.6 ? 'happy' : patience > 0.3 ? 'neutral' : 'angry';
  const blinking = useBlink();
  const walk = useSharedValue(0);
  const bubble = useSharedValue(0);

  useEffect(() => {
    walk.value = withTiming(1, timing(600));
    bubble.value = withDelay(500, withTiming(1, timing()));
  }, [bubble, walk]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: walk.value,
    transform: [{ translateX: (1 - walk.value) * enterFrom * metrics.slotWidth * 0.5 }],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubble.value,
    transform: [{ translateY: (1 - bubble.value) * 6 }],
  }));

  const ringColor = patience > 0.6 ? colors.good : patience > 0.3 ? colors.ok : colors.bad;
  const requesting = customer.status === 'requesting';
  // A requesting customer always invites a tap; an ordered one points to its selected ticket.
  const highlighted = requesting || selected;

  return (
    <>
      <Animated.View style={[styles.figure, { width: metrics.charWidth }, bodyStyle]}>
        <Character look={customer.look} mood={mood} blinking={blinking} width={metrics.charWidth} />
      </Animated.View>
      <Animated.View style={[styles.bubbleWrap, { bottom: metrics.bubbleBottom }, bubbleStyle]}>
        <View style={[styles.pointer, !highlighted && styles.hidden]}>
          <Svg width={16} height={10} viewBox="0 0 16 10">
            <Path d="M1 1 H15 L8 9 Z" fill={requesting ? colors.gold : colors.primary} />
          </Svg>
        </View>
        <View style={[styles.bubble, highlighted && (requesting ? styles.bubbleAsk : styles.bubbleSelected)]}>
          {requesting ? (
            <OrderPad />
          ) : (
            <View>
              <Cup drink={customer.order} width={BUBBLE_CUP} backgroundColor="#FFFFFF" straw />
              <Text style={styles.orderSize}>{customer.order.size}</Text>
            </View>
          )}
          <View style={styles.ring}>
            <PatienceRing fraction={patience} color={ringColor} />
          </View>
        </View>
        <View style={[styles.bubbleTail, highlighted && (requesting ? styles.bubbleTailAsk : styles.bubbleTailSelected)]} />
      </Animated.View>
    </>
  );
});

/** A little speech bubble with "…" shown over a customer who wants to order but hasn't yet. */
function OrderPad() {
  return (
    <Svg width={BUBBLE_CUP} height={BUBBLE_CUP + 4} viewBox="0 0 26 30">
      <Path d="M5 3 H21 A2 2 0 0 1 23 5 V27 H3 V5 A2 2 0 0 1 5 3 Z" fill="#FFFDF6" stroke={colors.primary} strokeWidth={1.6} />
      <Path d="M7 1 V5 M13 1 V5 M19 1 V5" stroke={colors.primaryDark} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M7 12 H19 M7 17 H19 M7 22 H15" stroke={colors.line} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

const PatienceRing = memo(function PatienceRing({ fraction, color }: { fraction: number; color: string }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={9.5} fill="#FFFFFF" />
      <Circle cx={10} cy={10} r={radius} stroke="#EFE3D8" strokeWidth={3} fill="none" />
      <Circle
        cx={10}
        cy={10}
        r={radius}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 10 10)"
      />
    </Svg>
  );
});

function LeavingCustomer({ departure, metrics }: { departure: Departure; metrics: Metrics }) {
  const { outcome, drink, customer } = departure;
  const happy = outcome === 'perfect' || outcome === 'close';
  const mood: Mood = outcome === 'perfect' ? 'delighted' : outcome === 'close' ? 'happy' : 'angry';
  const exit = useSharedValue(0);

  useEffect(() => {
    // Pause so the reaction can be seen, then step away.
    exit.value = withDelay(550, withTiming(1, { duration: 600, easing: easeInOut }));
  }, [exit]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ translateX: exit.value * (happy ? -1 : 1) * metrics.slotWidth * 0.5 }],
  }));

  return (
    <Animated.View style={[styles.figure, { width: metrics.charWidth }, style]}>
      <Character look={customer.look} mood={mood} width={metrics.charWidth} />
      {drink && (
        <View style={[styles.heldCup, { top: metrics.charHeight * 0.5 }]}>
          <Cup drink={drink} width={metrics.charWidth * 0.26} backgroundColor="transparent" straw sealed tapered={false} />
        </View>
      )}
      {outcome === 'perfect' && <Rising top={metrics.charHeight * 0.05} kind="heart" />}
      {!happy && <Rising top={metrics.charHeight * 0.05} kind="steam" />}
    </Animated.View>
  );
}

/** A single heart (happy) or puff of steam (angry) that rises slowly and fades. */
function Rising({ top, kind }: { top: number; kind: 'heart' | 'steam' }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 1100, easing: ease });
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ translateY: -progress.value * 24 }],
  }));
  return (
    <Animated.View style={[styles.effect, { top, left: kind === 'heart' ? '62%' : '68%' }, style]}>
      {kind === 'heart' ? (
        <Svg width={18} height={16} viewBox="0 0 16 14">
          <Path d="M8 13 C2 9 0 6 0 3.8 C0 1.6 1.8 0 3.9 0 C5.6 0 7 1 8 2.4 C9 1 10.4 0 12.1 0 C14.2 0 16 1.6 16 3.8 C16 6 14 9 8 13 Z" fill="#FF5C8A" />
        </Svg>
      ) : (
        <Svg width={24} height={14} viewBox="0 0 30 16">
          <Path d="M6 15 C1 15 1 9 6 9 C6 4 13 2 15 6 C17 2 25 3 24 9 C29 9 29 15 24 15 Z" fill="#9AA0A6" />
        </Svg>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orderSize: { position: 'absolute', left: -13, bottom: -6, minWidth: 19, textAlign: 'center',
    backgroundColor: '#FFF4DC', color: '#795331', borderRadius: 5, borderWidth: 1,
    borderColor: '#C99F6A', fontFamily: fonts.bold, fontSize: 12 },
  row: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  rowCentred: {
    justifyContent: 'center',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
  },
  figure: {
    position: 'absolute',
    bottom: FIGURE_LIFT,
  },
  bubbleWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingBottom: 4,
    borderWidth: 2,
    borderColor: colors.line,
  },
  bubbleSelected: {
    borderColor: colors.primary,
  },
  bubbleAsk: {
    borderColor: colors.gold,
    backgroundColor: '#FFFDF2',
  },
  bubbleTail: {
    width: 10,
    height: 10,
    marginTop: -6,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.line,
    transform: [{ rotate: '45deg' }],
  },
  bubbleTailSelected: {
    borderColor: colors.primary,
  },
  bubbleTailAsk: {
    borderColor: colors.gold,
  },
  ring: {
    position: 'absolute',
    top: -8,
    right: -10,
  },
  pointer: {
    marginBottom: 2,
  },
  hidden: {
    opacity: 0,
  },
  heldCup: {
    position: 'absolute',
    right: -2,
  },
  effect: {
    position: 'absolute',
  },
  counter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
