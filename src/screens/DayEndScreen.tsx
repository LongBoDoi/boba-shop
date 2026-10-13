import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../components/Button';
import { Coin, Confetti } from '../components/Effects';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { GameState } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

interface DayEndScreenProps {
  state: GameState;
  onNextDay: () => void;
  onRetry: () => void;
  onMenu: () => void;
}

export function starsFor(coins: number, goal: number) {
  if (coins < goal) return 0;
  return coins >= goal * 1.6 ? 3 : coins >= goal * 1.3 ? 2 : 1;
}

export function DayEndScreen({ state, onNextDay, onRetry, onMenu }: DayEndScreenProps) {
  const { width } = useWindowDimensions();
  const { day, coins, config, stats } = state;
  const passed = coins >= config.goal;
  const stars = starsFor(coins, config.goal);
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
      {passed && <SunRays width={width} />}
      <SafeAreaView style={styles.content}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <Star key={i} earned={i < stars} delay={400 + i * 250} big={i === 1} />
            ))}
          </View>
          <Text style={styles.title}>{passed ? `Hoàn thành ngày ${day}!` : `Ngày ${day}: chưa đạt mục tiêu`}</Text>
          <Text style={styles.subtitle}>
            {passed ? 'Tiệm đang đắt khách.' : `Bạn cần thêm ${formatMoney(config.goal - coins)}.`}
          </Text>

          <View style={styles.earnings}>
            <Coin size={30} />
            <CountUp value={coins} style={styles.earned} />
            <Text style={styles.goal}>/ {formatMoney(config.goal)}</Text>
          </View>

          <View style={styles.table}>
            {rows.map(([label, value], index) => (
              <StatRow key={label} label={label} value={value} delay={200 + index * 60} />
            ))}
          </View>

          {passed && unlocks.length > 0 && (
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
            {passed ? (
              <Button label={`Bắt đầu ngày ${day + 1}`} onPress={onNextDay} />
            ) : (
              <Button label={`Chơi lại ngày ${day}`} onPress={onRetry} />
            )}
            <Button label="Về menu chính" variant="secondary" onPress={onMenu} />
          </View>
        </Animated.View>
      </SafeAreaView>
      {passed && (
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
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  earned: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: fonts.display,
    color: colors.goldDark,
  },
  goal: {
    fontSize: 18,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
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
