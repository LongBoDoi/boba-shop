import { useEffect, useRef, useState } from 'react';
import { GestureResponderHandlers, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { MAX_POUR, POUR_RATE } from '../game/ingredients';
import { DURATION, ease, timing } from '../motion';
import { CUP_LIP, pourLevel, WELL_BOTTOM, WELL_RUN } from './KitchenCup';

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
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
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
export function Stream({
  x,
  top,
  cupY,
  cupH,
  color,
  level,
  side,
  width = 6,
}: {
  x: number;
  top: number;
  cupY: SharedValue<number>;
  cupH: number;
  color: string;
  level: SharedValue<number>;
  side: 'front' | 'back';
  width?: number;
}) {
  const run = useSharedValue(0);
  useEffect(() => {
    run.set(withTiming(1, { duration: 170, easing: Easing.linear }));
    return () => {
      run.set(0);
    };
  }, [run]);

  // Both halves follow the cup where it actually is, not where it was sent: the cup is still
  // gliding into place when a tap can first be held, and a split pinned to where it is headed
  // would sit adrift of the glass for that moment.
  const clipStyle = useAnimatedStyle(() => {
    const lip = cupY.get() + CUP_LIP * cupH;
    if (side === 'front') return { top, height: Math.max(0, lip - top) };
    return { top: lip, height: Math.max(0, cupY.get() + cupH - lip) };
  });
  const style = useAnimatedStyle(() => {
    const lip = cupY.get() + CUP_LIP * cupH;
    const clipTop = side === 'front' ? top : lip;
    const surface = cupY.get() + (WELL_BOTTOM - pourLevel(Math.min(1, Math.max(0, level.get()))) * WELL_RUN) * cupH;
    return {
      top: top - clipTop,
      height: Math.max(0, surface - top) * run.get(),
      opacity: Math.min(1, run.get() * 2.2),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, overflow: 'hidden' }, clipStyle]}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - width / 2, width }, style]}>
        {/* the falling column, with the light down one side of it */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: width * 0.5 }]} />
        <View
          style={{
            position: 'absolute',
            left: width * 0.16,
            top: 0,
            bottom: 0,
            width: width * 0.26,
            borderRadius: width,
            backgroundColor: '#FFFFFF',
            opacity: 0.32,
          }}
        />
        {/* it leaves the spout as a fat drop */}
        <View
          style={{
            position: 'absolute',
            left: -width * 0.45,
            right: -width * 0.45,
            top: -width * 0.35,
            height: width * 1.3,
            borderRadius: width,
            backgroundColor: color,
          }}
        />
        {/* the splash belongs where the tea lands, which is inside the cup */}
        {side === 'back' && <Ripple color={color} size={width * 3.4} />}
      </Animated.View>
    </Animated.View>
  );
}

/** Where the stream hits the drink: a ring that spreads and fades, over and over. */
function Ripple({ color, size }: { color: string; size: number }) {
  const spread = useSharedValue(0);
  useEffect(() => {
    spread.set(withRepeat(withTiming(1, { duration: 520, easing: Easing.linear }), -1, false));
  }, [spread]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - spread.get()),
    transform: [{ scaleX: 0.45 + spread.get() }, { scaleY: 0.45 + spread.get() * 0.5 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: -size * 0.16,
          left: -size / 2,
          width: size * 2,
          height: size * 0.5,
          borderRadius: size,
          borderWidth: Math.max(1.4, size * 0.1),
          borderColor: color,
        },
        style,
      ]}
    />
  );
}
