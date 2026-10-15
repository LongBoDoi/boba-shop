import { useEffect, useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';
import { pourLevel } from './cupGeometry';

type CupPosition = { cupX: SharedValue<number>; cupY: SharedValue<number>; cupScale: SharedValue<number>; cupW: number; cupH: number };

/** Soft elliptical falloff follows the cup's narrow foot, rather than its wider mouth. */
export function CupContactShadow({ cupX, cupY, cupScale, cupW, cupH }: CupPosition) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const style = useAnimatedStyle(() => {
    const width = cupW * cupScale.get();
    const height = width * 0.18;
    return { left: cupX.get() + width * 0.12, top: cupY.get() + cupH * cupScale.get() * 0.96 - height / 2,
      width: width * 0.76, height };
  });
  return (
    <Animated.View style={[styles.shadow, style, pointerEventsStyles.none]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 20" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`cup-shadow-${uid}`}>
            <Stop offset="0" stopColor="#58311C" stopOpacity="0.27" />
            <Stop offset="0.45" stopColor="#58311C" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#58311C" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={50} cy={10} rx={49} ry={9} fill={`url(#cup-shadow-${uid})`} />
        <Ellipse cx={50} cy={10} rx={30} ry={2.3} fill="#58311C" opacity={0.12} />
      </Svg>
    </Animated.View>
  );
}

export interface PourMeterState {
  level: SharedValue<number>;
  color: string;
  running: boolean;
}

/** Quarter marks down the track, so the bar can be read at a glance and not only by its label. */
const MARKS = [0.25, 0.5, 0.75];
/**
 * What the cup is called at the level it holds, as the top of each band.
 *
 * These are not the quarters the marks are drawn at. A label names what is in the glass, and taken
 * as `floor(level * 4)` two of them lied about it: a cup a quarter full was called "Cạn" — dry —
 * and "Đầy" landed on exactly 1 and nowhere else, so a pour ran from "Gần đầy" straight to
 * "Tràn ly!" without ever passing through full. "Đầy" now covers the brim the cup is actually
 * drawn at (`CUP_SURFACE_TOP`), which is what the player is looking at while they hold the tap.
 */
const LABELS = [
  { upTo: 0.02, label: 'Cạn' },
  { upTo: 0.35, label: 'Ít' },
  { upTo: 0.6, label: 'Nửa ly' },
  { upTo: 0.88, label: 'Gần đầy' },
  { upTo: 1, label: 'Đầy' },
];
const OVERFLOW = 'Tràn ly!';

/** Which band the live level falls in; `LABELS.length` is the one past the brim. */
function pourBand(raw: number) {
  'worklet';
  if (raw > 1) return LABELS.length;
  const fill = pourLevel(raw);
  for (let i = 0; i < LABELS.length; i++) {
    if (fill <= LABELS[i].upTo) return i;
  }
  return LABELS.length - 1;
}

/** A small floating bar beneath the order bubble, away from fingers holding the taps. */
export function PourMeter({ level, color }: PourMeterState) {
  const [band, setBand] = useState(0);
  const show = useSharedValue(0);
  useEffect(() => {
    show.set(withTiming(1, { duration: 180 }));
  }, [show]);
  // No polling or per-frame React renders. Only crossing into another band redraws the label.
  useAnimatedReaction(
    () => pourBand(level.get()),
    (current, previous) => { if (current !== previous) scheduleOnRN(setBand, current); },
    [level],
  );
  const appear = useAnimatedStyle(() => ({
    opacity: show.get(), transform: [{ translateY: (1 - show.get()) * -4 }],
  }), [show]);
  // Share the cup's fill mapping; size against the track's inner bounds on every platform.
  const bar = useAnimatedStyle(() => ({ width: `${pourLevel(level.get()) * 100}%` as `${number}%` }), [level]);
  // The bright front of the liquid belongs to a bar still on its way. Held on to the end it sits
  // between the fill and the track's rounded cap, where it reads as a gap the bar never closed —
  // so it is gone by the time the bar reaches it.
  const edge = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (1 - pourLevel(level.get())) * 16)),
  }), [level]);
  const track = useAnimatedStyle(() => ({ borderColor: level.get() > 1 ? '#D34C6A' : '#BC8E61' }), [level]);
  const valueText = band >= LABELS.length ? OVERFLOW : LABELS[band].label;
  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel="Lượng trà trong ly"
      accessibilityValue={{ text: valueText }} aria-valuetext={valueText} style={[styles.meter, appear, pointerEventsStyles.none]}>
      <Animated.View style={[styles.track, track]}>
        <View style={styles.trackContent}>
          <Animated.View style={[styles.fill, { backgroundColor: color }, bar]}>
            <View style={styles.fillShine} />
            <Animated.View style={[styles.fillEdge, edge]} />
          </Animated.View>
          {MARKS.map((mark) => (
            <View key={mark} style={[styles.tick, { left: `${mark * 100}%` }]} />
          ))}
          <Text style={[styles.value, band >= LABELS.length && styles.overflowText]}>{valueText}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute' },
  meter: { width: 220, maxWidth: '100%' },
  value: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, color: '#79442A',
    backgroundColor: '#FFF6E8E6', borderRadius: 5, paddingHorizontal: 5 },
  track: { height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#BC8E61', backgroundColor: '#EBD6B7', overflow: 'hidden' },
  trackContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  fillShine: { position: 'absolute', left: 0, right: 0, top: 2, height: 3, backgroundColor: '#FFF0CB', opacity: 0.55 },
  fillEdge: { position: 'absolute', right: 0, bottom: 0, top: 0, width: 2, backgroundColor: '#FFF1CF' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#9D6A47', opacity: 0.55 },
  overflowText: { color: '#D34C6A' },
});
