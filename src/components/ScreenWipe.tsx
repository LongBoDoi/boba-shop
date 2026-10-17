import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Drink } from '../game/ingredients';
import { colors } from '../theme';
import { Cup } from './Cup';
import { pointerEventsStyles } from '../pointerEvents';

const BADGE_DRINK: Drink = { size: 'M', toppings: ['pearls'], sweetness: null, ice: null, tea: 'black', milk: 'whole', foam: null };

/** Fades the screen to pink (with a small cup in the middle) between phases, then back. */
export function ScreenWipe({ progress }: { progress: SharedValue<number> }) {
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.6, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fade, fadeStyle]} />
      <Animated.View style={[styles.center, badgeStyle]}>
        <Cup drink={BADGE_DRINK} width={64} backgroundColor={colors.primary} straw sealed />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    backgroundColor: colors.primary,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
