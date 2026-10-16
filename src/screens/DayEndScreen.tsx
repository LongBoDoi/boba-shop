import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../components/Button';
import { Coin, Confetti } from '../components/Effects';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { DayStats, GameState } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

interface DayEndScreenProps {
  state: GameState;
  onNextDay: () => void;
  onMenu: () => void;
}

/**
 * How the day went, out of three. There is no money target any more — a day cannot be failed and
 * the takings are simply kept — so the stars rate the *service*: how many customers got a drink at
 * all, and how many got the one they actually asked for. Money is the reward; this is the grade.
 */
export function starsFor({ served, perfect, missed }: DayStats) {
  if (served === 0) return 0;
  const happy = served / (served + missed);
  if (happy >= 0.9 && perfect >= served * 0.6) return 3;
  if (happy >= 0.7) return 2;
  return 1;
}

const VERDICT = [
  'Hôm nay chưa bán được ly nào.',
  'Vẫn còn khách phải chờ lâu.',
  'Một ngày bán hàng tốt.',
  'Tiệm đông nghịt cả ngày!',
];

export function DayEndScreen({ state, onNextDay, onMenu }: DayEndScreenProps) {
  const { width } = useWindowDimensions();
  const { day, coins, money, stats } = state;
  const stars = starsFor(stats);
  const unlocks = describeUnlocks(day + 1);

  const rows: [string, string][] = [
    ['Số ly đã bán', String(stats.served)],
    ['Ly hoàn hảo', String(stats.perfect)],
    ['Tiền tip', formatMoney(stats.tips)],
    ['Khách bỏ đi', String(stats.missed)],
  ];

  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, timing(DURATION.slow));
  }, [rise]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 24 }],
  }));

  return (
    <View style={styles.screen}>
      {stars > 0 && <SunRays width={width} />}
      <SafeAreaView style={styles.content}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <Star key={i} earned={i < stars} delay={400 + i * 250} big={i === 1} />
            ))}
          </View>
          <Text style={styles.title}>{`Hoàn thành ngày ${day}!`}</Text>
          <Text style={styles.subtitle}>{VERDICT[stars]}</Text>

          {/* The day's takings, and then where they went. This is the only screen that reports a
              single day's earnings — the HUD counts the till — so the two are labelled apart.
              Nothing here can be failed: the money is banked whatever the stars say. */}
          <Text style={styles.earnedLabel}>Tiền bán hôm nay</Text>
          <View style={styles.earnings}>
            <Coin size={30} />
            <CountUp value={coins} style={styles.earned} />
          </View>
          <View style={styles.till}>
            <Text style={styles.tillText}>Két tiền: {formatMoney(money)}</Text>
          </View>

          <View style={styles.table}>
            {rows.map(([label, value], index) => (
              <StatRow key={label} label={label} value={value} delay={200 + index * 60} />
            ))}
          </View>

          {unlocks.length > 0 && (
            <View style={styles.unlocks}>
              <Text style={styles.unlockTitle}>Mở khóa cho ngày {day + 1}</Text>
              {unlocks.map((line) => (
                <Text key={line} style={styles.unlockLine}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.buttons}>
            <Button label={`Bắt đầu ngày ${day + 1}`} onPress={onNextDay} />
            <Button label="Về menu chính" variant="secondary" onPress={onMenu} />
          </View>
        </Animated.View>
      </SafeAreaView>
      {stars > 0 && (
        <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
          <Confetti at={{ x: width * 0.5, y: 150 }} delay={900} pieces={16} power={1.2} />
        </View>
      )}
    </View>
  );
}

function Star({ earned, delay, big }: { earned: boolean; delay: number; big: boolean }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(earned ? delay : 200, withTiming(1, timing(DURATION.slow)));
  }, [appear, delay, earned]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.8 + appear.value * 0.2 }],
  }));
  const size = big ? 64 : 48;
  return (
    <Animated.View style={[big && styles.bigStar, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 1.8 L15 8.3 L22 9.1 L16.8 13.9 L18.3 20.9 L12 17.3 L5.7 20.9 L7.2 13.9 L2 9.1 L9 8.3 Z"
          fill={earned ? colors.gold : '#EADBCB'}
          stroke={earned ? colors.goldDark : '#D9C6B3'}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {earned && <Path d="M9 9.5 L10.5 6.5" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />}
      </Svg>
    </Animated.View>
  );
}

function StatRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, timing()));
  }, [delay, enter]);
  const style = useAnimatedStyle(() => ({ opacity: enter.value }));
  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Animated.View>
  );
}

function CountUp({ value, style }: { value: number; style: object }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 350);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return <Text style={style}>{formatMoney(shown)}</Text>;
}

function SunRays({ width }: { width: number }) {
  const size = width * 1.8;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 24;
    const r = 50;
    return `M50 50 L${50 + Math.cos(a) * r} ${50 + Math.sin(a) * r} L${50 + Math.cos(b) * r} ${50 + Math.sin(b) * r} Z`;
  }).join(' ');
  return (
    <View style={[styles.rays, { width: size, height: size, left: (width - size) / 2, top: 130 - size / 2 }, pointerEventsStyles.none]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={rays} fill="#FFFFFF" opacity={0.45} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.wall,
    overflow: 'hidden',
  },
  rays: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.floor,
    borderRadius: 28,
    padding: 20,
    paddingTop: 12,
    borderBottomWidth: 6,
    borderBottomColor: colors.line,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: -50,
    marginBottom: 6,
  },
  bigStar: {
    marginBottom: 10,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  earnedLabel: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  earned: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: fonts.display,
    color: colors.goldDark,
  },
  till: {
    alignSelf: 'center',
    marginTop: 4,
    backgroundColor: '#FFF4D6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  tillText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.goldDark,
  },
  table: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  value: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  unlocks: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
  },
  unlockTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  unlockLine: {
    fontSize: 14,
    fontFamily: fonts.semi,
    color: colors.ink,
  },
  buttons: {
    marginTop: 14,
    gap: 10,
  },
});
