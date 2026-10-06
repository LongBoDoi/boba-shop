import { ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';

interface SealingMachineProps {
  cupWidth: number;
  /** Shown on the machine's little display. */
  display: string;
  /** Changes each time a cup is sealed and served. */
  sealCount: number;
  children: ReactNode;
}

export const MACHINE_HEAD = 30;
export const MACHINE_BASE = 16;
export const MACHINE_SIDE = 10;

/** The cup sits inside a pastel sealing machine; the press stamps down whenever a drink is served. */
export function SealingMachine({ cupWidth, display, sealCount, children }: SealingMachineProps) {
  const cupHeight = Math.round(cupWidth * 1.3);
  const press = useSharedValue(0);
  const glow = useSharedValue(0);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    press.value = withSequence(withTiming(1, timing(DURATION.fast)), withDelay(60, withTiming(0, timing(DURATION.base))));
    glow.value = withSequence(withTiming(1, timing(DURATION.fast)), withDelay(250, withTiming(0, timing(DURATION.slow))));
  }, [glow, press, sealCount]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 14 }] }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.65 }));

  return (
    <View style={[styles.machine, { width: cupWidth + MACHINE_SIDE * 2 + 16 }]}>
      <View style={styles.head}>
        <View style={styles.screen}>
          <Text style={styles.screenText} numberOfLines={1}>
            {display}
          </Text>
        </View>
        <Animated.View style={[styles.light, lightStyle]} />
      </View>
      <View style={[styles.window, { height: cupHeight + 18 }]}>
        <Animated.View style={[styles.plate, { width: cupWidth + 10 }, pressStyle]} />
        <View style={styles.cupSlot}>{children}</View>
      </View>
      <View style={styles.base} />
    </View>
  );
}

const styles = StyleSheet.create({
  machine: {
    backgroundColor: colors.mint,
    borderRadius: 18,
    paddingHorizontal: MACHINE_SIDE,
    borderBottomWidth: 4,
    borderBottomColor: colors.mintDark,
  },
  head: {
    height: MACHINE_HEAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  screen: {
    flex: 1,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#2F4F48',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 6,
  },
  screenText: {
    color: '#9CF5D6',
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
  },
  light: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6F9C',
  },
  window: {
    backgroundColor: colors.machineInside,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  plate: {
    position: 'absolute',
    top: 0,
    height: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.mintDark,
  },
  cupSlot: {
    paddingBottom: 2,
  },
  base: {
    height: MACHINE_BASE - 4,
  },
});
