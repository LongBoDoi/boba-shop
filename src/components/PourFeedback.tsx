import { useEffect, useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

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

const MILESTONES = [
  { value: 0, label: 'Cạn' },
  { value: 0.25, label: 'Ít' },
  { value: 0.5, label: 'Nửa ly' },
  { value: 0.75, label: 'Gần đầy' },
  { value: 1, label: 'Đầy' },
];

/** Screen overlay stays visible for the whole docking session, including before the first pour. */
export function PourMeter({ level, running, color, screenHeight }: PourMeterState & { screenHeight: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [milestone, setMilestone] = useState(0);
  const show = useSharedValue(0);
  const trackHeight = Math.round(Math.max(180, Math.min(300, screenHeight * 0.32)));
  useEffect(() => {
    show.set(withTiming(1, { duration: 180 }));
  }, [show]);
  // No polling or per-frame React renders. Only milestone crossings update accessibility text.
  useAnimatedReaction(
    () => level.get() > 1 ? 5 : Math.floor(Math.max(0, Math.min(1, level.get())) * 4),
    (current, previous) => { if (current !== previous) scheduleOnRN(setMilestone, current); },
    [level],
  );
  const appear = useAnimatedStyle(() => ({
    opacity: show.get(), transform: [{ translateY: -(trackHeight + 91) / 2 }, { translateX: (1 - show.get()) * 10 }],
  }), [show, trackHeight]);
  const bar = useAnimatedStyle(() => {
    const fill = Math.max(0, Math.min(1, level.get()));
    return { transform: [{ translateY: (trackHeight - 4) * (1 - fill) / 2 }, { scaleY: fill }] };
  }, [level, trackHeight]);
  const overflow = useAnimatedStyle(() => ({ opacity: level.get() > 1 ? 1 : 0 }), [level]);
  const valueText = milestone > 4 ? 'Tràn ly' : MILESTONES[milestone].label;
  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel="Lượng trà trong ly"
      accessibilityValue={{ text: valueText }} aria-valuetext={valueText} style={[styles.meter, appear, pointerEventsStyles.none]}>
      <Text style={styles.title}>Lượng trà</Text>
      <Text style={styles.subtitle}>{running ? 'Đang rót' : 'Sẵn sàng'}</Text>
      <View style={{ height: trackHeight, marginTop: 12, marginBottom: 10 }}>
        <View style={[styles.track, { height: trackHeight }]}>
          <Animated.View style={[StyleSheet.absoluteFill, bar]}>
            <Svg width="100%" height="100%" viewBox="0 0 36 100" preserveAspectRatio="none">
              <Defs><LinearGradient id={`meter-fill-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0" stopColor={color} />
                <Stop offset="0.4" stopColor={color} />
                <Stop offset="0.4" stopColor="#FFF0CB" stopOpacity="0.7" />
                <Stop offset="0.52" stopColor={color} />
                <Stop offset="1" stopColor={color} />
              </LinearGradient></Defs>
              <Rect width={36} height={100} fill={`url(#meter-fill-${uid})`} />
            </Svg>
            <View style={styles.fillEdge} />
          </Animated.View>
        </View>
        {MILESTONES.map((mark) => <MeterMilestone key={mark.value} level={level}
          value={mark.value} label={mark.label} trackHeight={trackHeight} />)}
      </View>
      <Animated.View style={[styles.overflow, overflow]}><Text style={styles.overflowText}>Tràn ly!</Text></Animated.View>
    </Animated.View>
  );
}

function MeterMilestone({ level, value, label, trackHeight }: {
  level: SharedValue<number>; value: number; label: string; trackHeight: number;
}) {
  const reached = useAnimatedStyle(() => ({
    backgroundColor: level.get() >= value ? '#F06094' : '#C5A688',
  }), [level, value]);
  const text = useAnimatedStyle(() => ({ color: level.get() >= value ? '#853A51' : '#9C7E62' }), [level, value]);
  return (
    <View style={[styles.milestone, { top: (1 - value) * trackHeight - 9 }]}>
      <View style={styles.tick} />
      <Animated.View style={[styles.dot, reached]} />
      <Animated.Text style={[styles.milestoneText, text]}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute' },
  meter: { position: 'absolute', right: 12, top: '50%', width: 120, paddingHorizontal: 10,
    paddingTop: 10, paddingBottom: 8, borderRadius: 20, backgroundColor: '#FFF6E8F5',
    borderWidth: 2, borderColor: '#C78D5C' },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: '#79442A' },
  subtitle: { fontFamily: fonts.semi, fontSize: 11, lineHeight: 14, color: '#AF6C55' },
  track: { position: 'absolute', left: 0, width: 34, borderRadius: 15,
    borderWidth: 2, borderColor: '#BC8E61', backgroundColor: '#EBD6B7', overflow: 'hidden' },
  fillEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: '#FFF1CF' },
  milestone: { position: 'absolute', left: 25, right: -4, height: 18, flexDirection: 'row', alignItems: 'center' },
  tick: { width: 12, height: 2, backgroundColor: '#9D6A47' },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  milestoneText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },
  overflow: { height: 16, alignItems: 'center' },
  overflowText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: '#D34C6A' },
});
