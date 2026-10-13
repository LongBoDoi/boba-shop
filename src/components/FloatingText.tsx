import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Tone } from '../game/reducer';
import { fonts, toneColor } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

/** A short message that fades in, drifts up a little and fades out once, on mount. */
export function FloatingText({ text, tone, top }: { text: string; tone: Tone; top: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
    transform: [{ translateY: -progress.value * 20 }],
  }));

  return (
    <Animated.View style={[styles.chip, { top, borderColor: toneColor[tone] }, style, pointerEventsStyles.none]}>
      <Text style={[styles.text, { color: toneColor[tone] }]} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.display,
  },
});
