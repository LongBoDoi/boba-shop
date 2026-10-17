import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { playSound } from '../audio/audio';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
  /** Painted icon shown to the left of the label. */
  icon?: ImageSourcePropType;
}

export function Button({ label, onPress, variant = 'primary', disabled, style, icon }: ButtonProps) {
  const primary = variant === 'primary';
  /**
   * Every button in the game sounds the same, and it is done here rather than at the call sites
   * for the obvious reason: this one line covers the menu, the pause card, the settings sheet, the
   * day's sign, the day-end screen and the update dialog, and no future screen can forget it.
   *
   * It is also what buys the web its first sound. A browser will not play anything until the page
   * has been interacted with, and on the title screen the first interaction is somebody pressing
   * "Bắt đầu" — the unlock listener in `initAudio` is on the capture phase, so it has already run
   * by the time this handler does, and the press that starts the game is audible.
   */
  const sound = () => {
    playSound('button');
    onPress();
  };
  const press = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <AnimatedPressable
      onPress={sound}
      onPressIn={() => press.set(withTiming(0.96, { duration: 80 }))}
      onPressOut={() => press.set(withTiming(1, timing(DURATION.fast)))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.button, primary ? styles.primary : styles.secondary, disabled && styles.disabled, style, animatedStyle]}
    >
      {icon && <Image source={icon} style={styles.icon} resizeMode="contain" />}
      <Text style={[styles.label, !primary && styles.secondaryLabel]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 5,
  },
  icon: {
    width: 21,
    height: 21,
  },
  primary: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomColor: colors.line,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
  },
  secondaryLabel: {
    color: colors.ink,
  },
});
