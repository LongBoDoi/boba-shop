import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURATION, timing } from '../motion';
import { colors } from '../theme';

/**
 * The shop getting ready: the fonts, the saved day and the painted kitchen all have to be in hand
 * before the first screen can be drawn, so this says so instead of showing an empty wall.
 *
 * It is the one screen in the game with **no Baloo 2 on it**. The fonts are part of what it is
 * waiting for, so anything it set in the display face would be drawn in the system one and then
 * jump when the real one arrived.
 *
 * The bar is filled by real progress, never by a timer pretending to be one, and there is nothing
 * on it that spins or pulses — the same calm the rest of the game is held to.
 */
export function LoadingScreen({ progress }: { progress: number }) {
  const filled = useSharedValue(0);
  useEffect(() => {
    filled.set(withTiming(progress, timing(DURATION.slow)));
  }, [filled, progress]);
  const grow = useAnimatedStyle(() => ({ width: `${filled.get() * 100}%` }));

  return (
    <View style={styles.screen}>
      <Text style={styles.mark}>🧋</Text>
      <Text style={styles.name}>Tiệm Trà Sữa</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, grow]} />
      </View>
      <Text style={styles.note}>Đang chuẩn bị quầy…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.wall,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  mark: {
    fontSize: 64,
    lineHeight: 76,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  track: {
    marginTop: 14,
    width: '70%',
    maxWidth: 280,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  note: {
    fontSize: 15,
    color: colors.inkSoft,
  },
});
