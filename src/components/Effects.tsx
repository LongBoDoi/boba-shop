import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Drink } from '../game/ingredients';
import { Departure } from '../game/reducer';
import { easeInOut } from '../motion';
import { colors, fonts } from '../theme';
import { Cup } from './Cup';
import { pointerEventsStyles } from '../pointerEvents';

export interface Point {
  x: number;
  y: number;
}

export interface EffectsGeometry {
  cup: Point;
  money: Point;
  trash: Point;
}

interface EffectsLayerProps {
  departures: Departure[];
  discarded: { id: number; drink: Drink } | null;
  geometry: EffectsGeometry;
  cupWidth: number;
}

/**
 * Serve and discard effects drawn over the whole game screen. Each effect is keyed by the
 * reducer event that caused it, so it plays once on mount and disappears when the event expires.
 */
export function EffectsLayer({ departures, discarded, geometry, cupWidth }: EffectsLayerProps) {
  return (
    <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
      {discarded && <TossedCup key={discarded.id} drink={discarded.drink} from={geometry.cup} to={geometry.trash} cupWidth={cupWidth} />}
      {/* The served cup is carried off by the customer on the counter page, so here we only
          reward the sale: confetti and coins spring from the prep machine to the HUD wallet. */}
      {departures.map((departure) => (
        <View key={departure.id} style={StyleSheet.absoluteFill}>
          {departure.outcome === 'perfect' && <Confetti at={geometry.cup} delay={300} />}
          {departure.earned > 0 && (
            <CoinFlight from={geometry.cup} to={geometry.money} count={Math.min(3, Math.max(1, Math.ceil(departure.earned / 3)))} />
          )}
        </View>
      ))}
    </View>
  );
}

function TossedCup({ drink, from, to, cupWidth }: { drink: Drink; from: Point; to: Point; cupWidth: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 550, easing: easeInOut });
  }, [progress]);
  const cupHeight = cupWidth * 1.3;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.7 ? 1 : (1 - p) / 0.3,
      transform: [
        { translateX: from.x + (to.x - from.x) * p - cupWidth / 2 },
        { translateY: from.y + (to.y - from.y) * p - cupHeight / 2 },
        { rotate: `${-p * 35}deg` },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.flyer, style]}>
      <Cup drink={drink} width={cupWidth} backgroundColor="transparent" tapered={false} />
    </Animated.View>
  );
}

function CoinFlight({ from, to, count }: { from: Point; to: Point; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <FlyingCoin key={i} from={from} to={to} delay={450 + i * 110} />
      ))}
    </>
  );
}

function FlyingCoin({ from, to, delay }: { from: Point; to: Point; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 650, easing: easeInOut }));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 || p >= 1 ? 0 : 1,
      transform: [
        { translateX: from.x + (to.x - from.x) * p - 9 },
        { translateY: from.y + (to.y - from.y) * p - 30 * 4 * p * (1 - p) - 9 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.flyer, style]}>
      <Coin size={18} />
    </Animated.View>
  );
}

export function Coin({ size }: { size: number }) {
  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1.5, size * 0.1) }]}>
      <Text style={[styles.coinText, { fontSize: size * 0.55, lineHeight: size * 0.75 }]}>đ</Text>
    </View>
  );
}

/** Deterministic 0–1 pseudo-random value, so confetti stays pure to render. */
function noise(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI_COLORS = [colors.primary, colors.gold, '#7EC8E3', '#B7E07A', '#B79CF2', '#FF9A76'];

export function Confetti({ at, delay = 0, pieces = 12, power = 0.8 }: { at: Point; delay?: number; pieces?: number; power?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) }));
  }, [delay, progress]);
  const particles = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = -Math.PI / 2 + (noise(i, 1) - 0.5) * Math.PI * 1.1;
        const speed = (60 + noise(i, 2) * 70) * power;
        return {
          id: i,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          spin: (noise(i, 3) - 0.5) * 240,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
        };
      }),
    [pieces, power],
  );
  return (
    <>
      {particles.map(({ id, ...particle }) => (
        <ConfettiPiece key={id} at={at} progress={progress} {...particle} />
      ))}
    </>
  );
}

interface ConfettiPieceProps {
  at: Point;
  progress: SharedValue<number>;
  vx: number;
  vy: number;
  spin: number;
  color: string;
  round: boolean;
}

function ConfettiPiece({ at, progress, vx, vy, spin, color, round }: ConfettiPieceProps) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 1 - Math.max(0, (p - 0.7) / 0.3),
      transform: [
        { translateX: at.x + vx * p },
        { translateY: at.y + vy * p + 160 * p * p },
        { rotate: `${spin * p}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.flyer, { width: round ? 7 : 6, height: round ? 7 : 10, borderRadius: round ? 4 : 1.5, backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  flyer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  coin: {
    backgroundColor: colors.gold,
    borderColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {
    color: colors.goldDark,
    fontFamily: fonts.display,
  },
});
