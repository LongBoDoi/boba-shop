import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';

/**
 * A downloaded update is waiting for the end of the day. Says so quietly at the foot of the screen
 * and takes no taps — the game restarts by itself once the day is over.
 */
export function UpdateNotice() {
  const shown = useSharedValue(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    shown.set(withTiming(1, timing(DURATION.slow)));
  }, [shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * 12 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.row, { bottom: insets.bottom + 8 }, style]}>
      <View style={styles.pill}>
        <Text style={styles.text}>Có bản cập nhật mới — sẽ cài khi hết ngày</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    opacity: 0.94,
  },
  text: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semi,
  },
});
