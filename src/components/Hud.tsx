import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatMoney } from '../game/money';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { Coin } from './Effects';

interface HudProps {
  day: number;
  clock: number;
  durationMs: number;
  coins: number;
  goal: number;
  onPause: () => void;
  warm?: boolean;
  /** Reports where the wallet sits on screen (window coordinates) so flying coins can aim at it. */
  onWalletLayout: (x: number, y: number) => void;
}

/** Coins land in the wallet a moment after a sale; the counter waits for them. */
const COIN_ARRIVAL_MS = 750;

export function Hud({ day, clock, durationMs, coins, goal, onPause, onWalletLayout, warm = false }: HudProps) {
  const remaining = Math.max(0, durationMs - clock);
  const seconds = Math.ceil(remaining / 1000);
  const closing = remaining === 0;
  const timeLabel = closing ? 'Sắp đóng cửa!' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const shown = useCountUp(coins, COIN_ARRIVAL_MS);
  const walletRef = useRef<View>(null);
  const goalReached = shown >= goal;

  const bump = useSharedValue(1);
  const previousCoins = useRef(coins);
  useEffect(() => {
    if (coins > previousCoins.current) {
      bump.value = withDelay(COIN_ARRIVAL_MS, withSequence(withTiming(1.12, timing(DURATION.fast)), withTiming(1, timing(DURATION.base))));
    }
    previousCoins.current = coins;
  }, [bump, coins]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <View style={[styles.hud, warm && styles.warmHud]}>
      <View style={[styles.pill, warm && styles.warmPill]}>
        <Text style={[styles.pillText, warm && styles.warmInk]}>Ngày {day}</Text>
      </View>

      <View style={styles.meter}>
        <View style={styles.meterRow}>
          <ClockIcon fraction={remaining / durationMs} warm={warm} />
          <Text style={[styles.meterLabel, warm && styles.warmInk, closing && styles.closing]}>{timeLabel}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(remaining / durationMs) * 100}%`, backgroundColor: warm ? '#8D9856' : '#FFFFFF' }]} />
        </View>
      </View>

      <View style={styles.meter}>
        <View style={styles.meterRow}>
          <Animated.View style={bumpStyle}>
            <View
              ref={walletRef}
              onLayout={() =>
                walletRef.current?.measureInWindow((x, y, width, height) => onWalletLayout(x + width / 2, y + height / 2))
              }
            >
              <Coin size={18} />
            </View>
          </Animated.View>
          <Text style={[styles.meterLabel, warm && styles.warmInk]} numberOfLines={1}>
            {formatMoney(shown)} <Text style={[styles.goal, warm && styles.warmSoft]}>/ {formatMoney(goal)}</Text> {goalReached ? '✓' : ''}
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(1, shown / goal) * 100}%`, backgroundColor: goalReached ? '#7CF0B0' : colors.gold },
            ]}
          />
        </View>
      </View>

      <Pressable onPress={onPause} style={[styles.pause, warm && styles.warmPill]} accessibilityLabel="Tạm dừng" hitSlop={8}>
        <View style={[styles.pauseBar, warm && styles.warmPauseBar]} />
        <View style={[styles.pauseBar, warm && styles.warmPauseBar]} />
      </Pressable>
    </View>
  );
}

/** Animates a displayed number towards `target`, starting after `delay` ms. */
function useCountUp(target: number, delay: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = target <= from ? 1 : Math.min(1, (now - start) / 600);
      const value = Math.round(from + (target - from) * t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(
      () => {
        frame = requestAnimationFrame(step);
      },
      target > from ? delay : 0,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [delay, target]);
  return shown;
}

function ClockIcon({ fraction, warm }: { fraction: number; warm: boolean }) {
  const angle = (1 - fraction) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={8.5} fill="#FFFFFF" stroke={warm ? '#AC8655' : colors.primaryDark} strokeWidth={2} />
      <Path d={`M10 10 L${10 + Math.cos(rad) * 5.5} ${10 + Math.sin(rad) * 5.5}`} stroke={warm ? '#7B874B' : colors.primary} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={10} cy={10} r={1.5} fill={colors.ink} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  warmHud: { backgroundColor: '#E9D0A7' },
  warmPill: { backgroundColor: '#FFF5DF', borderBottomColor: '#C09A67' },
  warmInk: { color: '#705030' },
  warmSoft: { color: '#96764F' },
  warmPauseBar: { backgroundColor: '#8D774D' },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDark,
  },
  pillText: {
    color: colors.primaryDark,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  meter: {
    flex: 1,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  meterLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.display,
    color: '#FFFFFF',
  },
  goal: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: '#FFE3EC',
  },
  closing: {
    color: '#FFF3B0',
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  pause: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDark,
  },
  pauseBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.primaryDark,
  },
});
