import { useEffect, useId, useRef, useState } from 'react';
import { GestureResponderHandlers, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { shade } from './art/Character';

import { MAX_POUR, POUR_RATE } from '../game/ingredients';
import { DURATION, ease, timing } from '../motion';
import { CUP_LIP, pourLevel, WELL_BOTTOM, WELL_RUN } from './KitchenCup';
import { pointerEventsStyles } from '../pointerEvents';

/** Claim a touch outright and never give it back until the finger lifts. */
export const GRABBY = {
  onStartShouldSetResponder: () => true,
  onStartShouldSetResponderCapture: () => true,
  onMoveShouldSetResponder: () => true,
  onMoveShouldSetResponderCapture: () => true,
  // Nothing — not the pager, not a long-press — gets to take this gesture away.
  onResponderTerminationRequest: () => false,
  onShouldBlockNativeResponder: () => true,
} as const;

/** A shelf that holds more taps than it shows, swiped along under the finger that is on a tap. */
export interface TapSwipe {
  begin: () => void;
  move: (dx: number) => void;
  end: (dx: number) => void;
}

/**
 * Holding a tap open: how long you hold is how much runs into the cup. This is the raw responder,
 * not a Pressable, so a finger that drifts (or a browser's long-press menu) can't cut a pour short:
 * it only ends when the finger actually lifts.
 *
 * Where the taps are on a shelf that swipes, the two share this one gesture and which it is comes
 * out of the first few pixels of movement: sideways is a swipe, and the pour that had already
 * started is thrown away rather than committed — a tenth of a second of tea that was never meant.
 */
export function useHoldPour({
  enabled,
  fill,
  level,
  press,
  onStart,
  onCommit,
  onBlocked,
  swipe,
}: {
  enabled: boolean;
  fill: number;
  level: SharedValue<number>;
  press: SharedValue<number>;
  onStart: (running: boolean) => void;
  onCommit: (amount: number) => void;
  onBlocked: () => void;
  swipe?: TapSwipe;
}) {
  const startedAt = useRef(0);
  const from = useRef({ x: 0, y: 0 });
  const mode = useRef<'pour' | 'swipe'>('pour');
  /** A tap that was never going to pour — it still presses, and says so when the finger lifts. */
  const shut = useRef(false);
  const [pouring, setPouring] = useState(false);

  const stop = () => {
    press.set(withTiming(1, { duration: 160, easing: ease }));
    setPouring(false);
    onStart(false);
  };
  const down = (x: number, y: number) => {
    from.current = { x, y };
    mode.current = 'pour';
    shut.current = !enabled;
    press.set(withTiming(0.96, { duration: 80 }));
    if (!enabled) return;
    startedAt.current = Date.now();
    setPouring(true);
    onStart(true);
    const room = Math.max(0.02, MAX_POUR - fill);
    level.set(withTiming(MAX_POUR, { duration: (room / POUR_RATE) * 1000, easing: Easing.linear }));
  };
  const up = () => {
    press.set(withTiming(1, { duration: 160, easing: ease }));
    if (mode.current === 'swipe') return;
    // Said on the way up rather than on the way down, so that a tap which turned out to be the
    // start of a swipe says nothing at all.
    if (shut.current) {
      shut.current = false;
      onBlocked();
      return;
    }
    if (!pouring) return;
    setPouring(false);
    onStart(false);
    const amount = ((Date.now() - startedAt.current) / 1000) * POUR_RATE;
    level.set(withTiming(Math.min(1, fill + amount), timing(DURATION.fast)));
    onCommit(amount);
  };

  return {
    pouring,
    handlers: {
      ...GRABBY,
      onResponderGrant: (event) => down(event.nativeEvent.pageX, event.nativeEvent.pageY),
      onResponderMove: (event) => {
        if (!swipe) return;
        const dx = event.nativeEvent.pageX - from.current.x;
        const dy = event.nativeEvent.pageY - from.current.y;
        if (mode.current === 'pour' && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          mode.current = 'swipe';
          shut.current = false;
          // Whatever ran while the finger was making up its mind goes back in the jar.
          if (pouring) {
            level.set(withTiming(fill, timing(DURATION.fast)));
            stop();
          }
          swipe.begin();
        }
        if (mode.current === 'swipe') swipe.move(dx);
      },
      onResponderRelease: (event) => {
        if (mode.current === 'swipe') swipe?.end(event.nativeEvent.pageX - from.current.x);
        up();
        mode.current = 'pour';
      },
      onResponderTerminate: () => {
        if (mode.current === 'swipe') swipe?.end(0);
        up();
        mode.current = 'pour';
      },
    } as GestureResponderHandlers,
  };
}

/** Tea running over the brim and down the side of the cup. */
export function Spill({
  level,
  cupW,
  cupH,
  color,
}: {
  level: SharedValue<number>;
  cupW: number;
  cupH: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({ opacity: level.value > 1.005 ? 1 : 0 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style, pointerEventsStyles.none]}>
      {[0.18, 0.5, 0.82].map((at, i) => (
        <Drop key={at} level={level} left={cupW * at - 2} cupH={cupH} color={color} offset={i * 0.12} />
      ))}
    </Animated.View>
  );
}

function Drop({
  level,
  left,
  cupH,
  color,
  offset,
}: {
  level: SharedValue<number>;
  left: number;
  cupH: number;
  color: string;
  offset: number;
}) {
  const style = useAnimatedStyle(() => {
    const over = Math.max(0, level.value - 1 - offset);
    return {
      opacity: over > 0 ? 1 : 0,
      transform: [{ translateY: interpolate(over, [0, 0.55], [0, cupH * 0.82], 'clamp') }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 4, height: 7, borderRadius: 2, opacity: 0.85 },
        { left, top: cupH * 0.1, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * The tea running out of a tap. It is drawn across the room rather than inside the dispenser,
 * so it visibly falls *into* the cup, and it ends at the drink's surface — the stream gets shorter
 * as the cup fills, the way a real pour does.
 *
 * It is drawn in two halves, split at the cup's lip, because neither side alone is right: all in
 * front and it runs down the *outside* of the glass, over the cat; all behind and the falling tea
 * is dimmed by a cup it has not reached yet. Above the lip it is in open air, so the `front` half
 * goes over the cup; below it the tea is inside the glass, so the `back` half goes under, letting
 * the glass tint it and the cat cover it. Each half clips to its own side of the lip, so the two
 * never overlap and the stream is never drawn on itself.
 */
export function Stream({ x, top, cupY, cupH, cupScale, color, level, side, running, width = 3.5 }: {
  x: number;
  top: number;
  cupY: SharedValue<number>;
  cupH: number;
  cupScale: SharedValue<number>;
  color: string;
  level: SharedValue<number>;
  side: 'front' | 'back';
  running: boolean;
  width?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const flow = useSharedValue(0);
  const phase = useSharedValue(0);
  const tail = useSharedValue(0);
  useEffect(() => {
    flow.set(withTiming(running ? 1 : 0, { duration: running ? 160 : 140 }));
    if (running) {
      tail.set(0);
      phase.set(0);
      phase.set(withRepeat(withTiming(1, { duration: 360, easing: Easing.linear }), -1));
    } else {
      cancelAnimation(phase);
      tail.set(withTiming(1, { duration: 220, easing: Easing.in(Easing.quad) }));
    }
    return () => cancelAnimation(phase);
  }, [running, flow, phase, tail]);
  const clipStyle = useAnimatedStyle(() => {
    const height = cupH * cupScale.get();
    const lip = cupY.get() + CUP_LIP * height;
    if (side === 'front') return { top, height: Math.max(0, lip - top) };
    return { top: lip, height: Math.max(0, cupY.get() + height - lip) };
  });
  const columnStyle = useAnimatedStyle(() => {
    const height = cupH * cupScale.get();
    const lip = cupY.get() + CUP_LIP * height;
    const surface = cupY.get() + (WELL_BOTTOM - pourLevel(Math.min(1, Math.max(0, level.get()))) * WELL_RUN) * height;
    return { top: top - (side === 'front' ? top : lip), height: Math.max(0, surface - top),
      opacity: flow.get(), transform: [{ scaleX: 0.88 + Math.sin(phase.get() * Math.PI * 2) * 0.08 }] };
  });
  const tailStyle = useAnimatedStyle(() => {
    const height = cupH * cupScale.get();
    const lip = cupY.get() + CUP_LIP * height;
    const surface = cupY.get() + (WELL_BOTTOM - pourLevel(Math.min(1, Math.max(0, level.get()))) * WELL_RUN) * height;
    return { top: top - (side === 'front' ? top : lip) + Math.max(0, surface - top) * tail.get(),
      opacity: running ? 0 : Math.sin(tail.get() * Math.PI), transform: [{ scaleY: 1.2 }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, overflow: 'hidden' }, clipStyle, pointerEventsStyles.none]}>
      <Animated.View style={[{ position: 'absolute', left: x - width / 2, width, overflow: 'hidden' }, columnStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 8 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`stream-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={shade(color, -40)} />
              <Stop offset="0.36" stopColor={shade(color, 40)} />
              <Stop offset="0.62" stopColor={color} />
              <Stop offset="1" stopColor={shade(color, -25)} />
            </LinearGradient>
          </Defs>
          <Path d="M1 0 Q0.5 8 1.5 20 Q2.5 50 1 100 H7 Q5.5 50 6.5 20 Q7.5 8 7 0 Z" fill={`url(#stream-${uid})`} />
          <Path d="M2.7 0 Q2 35 3 70 L2.7 100" fill="none" stroke="#FFE6BB" strokeOpacity={0.7} strokeWidth={0.65} />
        </Svg>
        {[0, 0.33, 0.66].map((delay) => <FlowGlint key={delay} phase={phase} delay={delay} />)}
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: x - 1.2, width: 2.4, height: 3.5,
        borderRadius: 2, backgroundColor: shade(color, 25) }, tailStyle]} />
    </Animated.View>
  );
}

function FlowGlint({ phase, delay }: { phase: SharedValue<number>; delay: number }) {
  const style = useAnimatedStyle(() => ({ top: `${((phase.get() + delay) % 1) * 100}%` as `${number}%`,
    opacity: Math.sin(((phase.get() + delay) % 1) * Math.PI) * 0.65 }));
  return <Animated.View style={[{ position: 'absolute', left: '30%', width: '25%', height: 3,
    borderRadius: 3, backgroundColor: '#FFF8E4' }, style]} />;
}
