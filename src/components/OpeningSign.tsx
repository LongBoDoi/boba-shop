import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatMoney } from '../game/money';
import { DURATION, easeInOut, timing } from '../motion';
import { colors, fonts } from '../theme';
import { Button } from './Button';

interface OpeningSignProps {
  day: number;
  goal: number;
  title: string;
  lines: string[];
  onDone: () => void;
}

/** The "open" sign shown at the start of each day. It stays until the player taps Start. */
export function OpeningSign({ day, goal, title, lines, onDone }: OpeningSignProps) {
  const shown = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    shown.set(withTiming(1, timing(DURATION.slow)));
  }, [shown]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    shown.set(withTiming(0, { duration: DURATION.base, easing: easeInOut }));
    setTimeout(onDone, DURATION.base);
  }, [onDone, shown]);

  const signStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * -40 }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: shown.value * 0.5 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      <Animated.View style={[styles.wrap, signStyle]}>
        <View style={styles.ropes}>
          <View style={[styles.rope, { transform: [{ rotate: '18deg' }] }]} />
          <View style={[styles.rope, { transform: [{ rotate: '-18deg' }] }]} />
        </View>
        <View style={styles.board}>
          <View style={styles.inner}>
            <Text style={styles.open}>MỞ CỬA</Text>
            <Text style={styles.day}>Ngày {day}</Text>
            <View style={styles.goal}>
              <Text style={styles.goalText}>Mục tiêu: {formatMoney(goal)}</Text>
            </View>
            {lines.length > 0 && (
              <View style={styles.news}>
                <Text style={styles.newsTitle}>{title}</Text>
                {lines.map((line) => (
                  <Text key={line} style={styles.newsLine}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
            <Button label="Bắt đầu" onPress={close} style={styles.start} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: '#2B1B17',
  },
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ropes: {
    width: 180,
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  rope: {
    width: 3,
    height: 80,
    backgroundColor: colors.counterDark,
    borderRadius: 2,
  },
  board: {
    width: 280,
    padding: 8,
    borderRadius: 22,
    backgroundColor: colors.counter,
    borderBottomWidth: 6,
    borderBottomColor: colors.counterDark,
  },
  inner: {
    borderRadius: 16,
    backgroundColor: colors.paper,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.counterLight,
    borderStyle: 'dashed',
  },
  open: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.primary,
    letterSpacing: 2,
  },
  day: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
  },
  goal: {
    marginTop: 6,
    backgroundColor: '#FFF4D6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  goalText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.goldDark,
  },
  news: {
    marginTop: 10,
    alignSelf: 'stretch',
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    padding: 10,
  },
  newsTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  newsLine: {
    fontFamily: fonts.semi,
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink,
  },
  start: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
