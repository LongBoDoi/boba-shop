import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Drink, getIngredient, ICE_LEVELS, Tea, TOPPINGS } from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

interface CupProps {
  drink: Drink;
  width: number;
  /** Colour behind the cup — used to mask the body into a tapered shape. */
  backgroundColor: string;
  straw?: boolean;
  sealed?: boolean;
  /** Play pour / drop animations as ingredients are added (the cup being built). */
  animated?: boolean;
  /**
   * Tapered cups are shaped by masking with `backgroundColor`. Cups that move over a busy
   * background (flying, held) use a straight, rounded body instead.
   */
  tapered?: boolean;
  /**
   * How full the cup is (0–1) when the liquid level is a real quantity — the cup being poured.
   * Left out, the cup shows a stock level for whatever is in it (tickets, finished drinks).
   */
  fill?: number;
  /**
   * Lets the station drive the level directly while a spigot is held open, so the liquid rises
   * with the hold instead of jumping when the pour is committed.
   */
  levelSv?: SharedValue<number>;
}

const ICE_SPOTS = [
  { x: 0.2, y: 0.36, rotate: -12 },
  { x: 0.52, y: 0.44, rotate: 18 },
  { x: 0.34, y: 0.56, rotate: 8 },
  { x: 0.56, y: 0.25, rotate: -20 },
];

/** Counts how many times `value` changed to a new non-null value since mount. */
function useChangeCount(value: string | null, enabled: boolean) {
  const [tracked, setTracked] = useState({ value, count: 0 });
  if (tracked.value !== value) {
    setTracked({ value, count: enabled && value !== null ? tracked.count + 1 : tracked.count });
  }
  return tracked.count;
}

export const Cup = memo(function Cup({
  drink,
  width,
  backgroundColor,
  straw,
  sealed,
  animated,
  tapered = true,
  fill,
  levelSv,
}: CupProps) {
  const height = Math.round(width * 1.3);
  const strawRise = straw ? Math.round(height * 0.2) : 0;
  const rimHeight = Math.max(3, Math.round(width * 0.07));
  const bodyHeight = height - rimHeight;
  const inset = tapered ? Math.round(width * 0.12) : 0;
  const stroke = Math.max(1.5, width * 0.025);
  const detailed = width >= 60;

  const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
  const ice = ICE_LEVELS.find((level) => level.id === drink.ice);
  const sweetness = drink.sweetness ? getIngredient('sweetness', drink.sweetness) : undefined;

  const baseColor = tea?.color ?? milk?.color;
  const milkyColor = tea ? tea.milkyColor : milk?.color;
  // A cup being built knows exactly how much went in; elsewhere a stock level just looks right.
  const targetLevel = fill !== undefined ? fill : tea ? 0.72 : milk ? 0.3 : 0;

  const own = useSharedValue(targetLevel);
  // While the station owns the level (a spigot is being held), it animates it instead.
  const level = levelSv ?? own;
  useEffect(() => {
    if (levelSv) return;
    own.value = animated ? withDelay(150, withTiming(targetLevel, timing(600))) : targetLevel;
  }, [animated, own, levelSv, targetLevel]);

  const milkiness = useSharedValue(milk ? 1 : 0);
  useEffect(() => {
    milkiness.value = animated ? withTiming(milk ? 1 : 0, timing(700)) : milk ? 1 : 0;
  }, [animated, milk, milkiness]);

  const teaPours = useChangeCount(drink.tea, !!animated);
  const milkPours = useChangeCount(drink.milk === 'none' ? null : drink.milk, !!animated);
  const sugarDrops = useChangeCount(drink.sweetness, !!animated);

  const liquidStyle = useAnimatedStyle(() => ({ height: Math.min(1, level.value) * bodyHeight }));
  const milkStyle = useAnimatedStyle(() => ({ opacity: milkiness.value }));
  const foamStyle = useAnimatedStyle(() => ({ bottom: Math.min(0.88, level.value) * bodyHeight - 3 }));

  const particle = Math.max(3, width * 0.11);
  const perRow = Math.max(1, Math.floor((width - inset * 2) / (particle * 1.05)));
  const particles =
    drink.toppings.length === 0
      ? []
      : Array.from({ length: perRow * 2 }, (_, i) => {
          const row = Math.floor(i / perRow);
          const toppingId = drink.toppings[i % drink.toppings.length];
          return {
            key: `${toppingId}-${i}`,
            left: inset + (i % perRow) * particle * 1.05 + (row % 2) * particle * 0.5,
            bottom: stroke + row * particle * 0.85,
            topping: TOPPINGS.find((t) => t.id === toppingId),
            delay: i * 15,
          };
        });

  const sideLength = Math.sqrt(bodyHeight * bodyHeight + inset * inset);
  const sideAngle = (Math.atan2(inset, bodyHeight) * 180) / Math.PI;
  const streamWidth = Math.max(4, width * 0.09);
  const pourLength = bodyHeight * (1 - targetLevel) + 6;

  return (
    <View style={{ width, height: height + strawRise, paddingTop: strawRise }}>
      <View style={{ width, height }}>
        {straw && tea && (
          <View
            style={[
              styles.straw,
              { width: width * 0.08, height: height * 0.95, left: width * 0.55, top: -strawRise },
            ]}
          />
        )}

        <View
          style={[
            styles.body,
            { top: rimHeight, width, height: bodyHeight, borderBottomWidth: stroke },
            !tapered && {
              borderLeftWidth: stroke,
              borderRightWidth: stroke,
              borderColor: colors.cupOutline,
              borderBottomLeftRadius: width * 0.18,
              borderBottomRightRadius: width * 0.18,
            },
          ]}
        >
          {baseColor && (
            <Animated.View style={[styles.fill, { backgroundColor: baseColor }, liquidStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: milkyColor }, milkStyle]} />
              {detailed && (
                <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
                  <Defs>
                    <LinearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                      <Stop offset="1" stopColor="#000000" stopOpacity="0.16" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="10" height="10" fill="url(#depth)" />
                </Svg>
              )}
              {detailed && animated && <Surface width={width} />}
            </Animated.View>
          )}

          {foam && targetLevel > 0 && (
            <Animated.View style={[styles.fill, foamStyle]}>
              <FoamLayer key={foam.id} color={foam.color} width={width} height={bodyHeight * 0.14} animated={animated} />
            </Animated.View>
          )}

          {ice &&
            ICE_SPOTS.slice(0, ice.cubes).map((spot, i) => (
              <IceCube
                key={i}
                size={width * 0.24}
                left={width * spot.x}
                bottom={bodyHeight * spot.y}
                rotate={spot.rotate}
                dropFrom={bodyHeight}
                delay={i * 60}
                animated={animated}
              />
            ))}

          {particles.map(({ key, left, bottom, topping, delay }) => (
            <Particle
              key={key}
              left={left}
              bottom={bottom}
              size={particle}
              color={topping?.color ?? '#000'}
              pearl={topping?.shape === 'pearl'}
              delay={delay}
              dropFrom={bodyHeight}
              animated={animated}
            />
          ))}

          {teaPours > 0 && tea && (
            <PourStream key={`tea-${teaPours}`} color={tea.color} cupWidth={width} width={streamWidth} length={pourLength} />
          )}
          {milkPours > 0 && milk && (
            <PourStream key={`milk-${milkPours}`} color={milk.color} cupWidth={width} width={streamWidth} length={pourLength} />
          )}
          {sugarDrops > 0 && <SugarFall key={`sugar-${sugarDrops}`} width={width} fall={bodyHeight * 0.7} />}

          {detailed && (
            <View
              style={[
                styles.gloss,
                { left: inset + width * 0.06, top: bodyHeight * 0.08, width: width * 0.07, height: bodyHeight * 0.7 },
              ]}
            />
          )}
        </View>

        {/* Background-coloured triangles taper the rectangle into a cup. */}
        {tapered && (
          <>
            <View
              style={[
                styles.mask,
                { top: rimHeight, left: 0, borderBottomWidth: bodyHeight, borderBottomColor: backgroundColor, borderRightWidth: inset },
              ]}
            />
            <View
              style={[
                styles.mask,
                { top: rimHeight, right: 0, borderBottomWidth: bodyHeight, borderBottomColor: backgroundColor, borderLeftWidth: inset },
              ]}
            />
            {[-1, 1].map((side) => (
              <View
                key={side}
                style={[
                  styles.side,
                  {
                    width: stroke,
                    height: sideLength,
                    top: rimHeight + bodyHeight / 2 - sideLength / 2,
                    left: (side < 0 ? inset / 2 : width - inset / 2) - stroke / 2,
                    transform: [{ rotate: `${side * sideAngle}deg` }],
                  },
                ]}
              />
            ))}
          </>
        )}

        {sealed ? (
          <View style={[styles.seal, { width: width + 4, height: rimHeight * 1.9, top: -rimHeight * 0.6, borderRadius: rimHeight }]}>
            {[0.2, 0.5, 0.8].map((x) => (
              <View key={x} style={[styles.sealDot, { left: `${x * 100}%`, width: rimHeight, height: rimHeight, borderRadius: rimHeight / 2 }]} />
            ))}
          </View>
        ) : (
          <View style={[styles.rim, { width: width + 4, height: rimHeight, borderRadius: rimHeight / 2 }]} />
        )}

        {sweetness && detailed && (
          <Sticker
            key={sweetness.id}
            label={sweetness.name}
            top={rimHeight + bodyHeight * 0.1}
            left={inset + 2}
            fontSize={Math.max(10, width * 0.11)}
            animated={animated}
          />
        )}
      </View>
    </View>
  );
});

/** A shimmering highlight that rolls across the liquid surface. */
function Surface({ width }: { width: number }) {
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
  }, [shift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -shift.value * width }] }));
  const wave = Array.from({ length: 4 }, (_, i) => {
    const x = (i * width) / 2;
    return `M${x} 4 Q${x + width / 8} 0 ${x + width / 4} 4 T${x + width / 2} 4`;
  }).join(' ');
  return (
    <Animated.View style={[styles.surface, { width: width * 2 }, style]}>
      <Svg width={width * 2} height={8}>
        <Path d={wave} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
      </Svg>
    </Animated.View>
  );
}

function PourStream({ color, cupWidth, width, length }: { color: string; cupWidth: number; width: number; length: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 700, easing: Easing.linear });
  }, [progress]);
  const style = useAnimatedStyle(() => {
    const grow = Math.min(1, progress.value / 0.3);
    const drain = Math.max(0, (progress.value - 0.55) / 0.45);
    return {
      top: drain * length,
      height: Math.max(0, length * grow - drain * length),
      opacity: progress.value < 1 ? 1 : 0,
    };
  });
  return (
    <Animated.View
      style={[styles.stream, { left: (cupWidth - width) / 2, width, borderRadius: width / 2, backgroundColor: color }, style, pointerEventsStyles.none]}
    />
  );
}

function SugarFall({ width, fall }: { width: number; fall: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 800, easing: Easing.in(Easing.quad) });
  }, [progress]);
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <Granule key={i} progress={progress} left={width * (0.25 + ((i * 37) % 50) / 100)} offset={(i % 4) * 0.08} fall={fall} />
      ))}
    </>
  );
}

function Granule({ progress, left, offset, fall }: { progress: SharedValue<number>; left: number; offset: number; fall: number }) {
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.value - offset) / (1 - offset)));
    return { transform: [{ translateY: p * fall }], opacity: p >= 1 ? 0 : 1 };
  });
  return <Animated.View style={[styles.granule, { left }, style, pointerEventsStyles.none]} />;
}

interface ParticleProps {
  left: number;
  bottom: number;
  size: number;
  color: string;
  pearl: boolean;
  delay: number;
  dropFrom: number;
  animated?: boolean;
}

function Particle({ left, bottom, size, color, pearl, delay, dropFrom, animated }: ParticleProps) {
  const drop = useSharedValue(animated ? -dropFrom : 0);
  useEffect(() => {
    if (animated) drop.value = withDelay(delay, withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }));
  }, [animated, delay, drop]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  return (
    <Animated.View
      style={[
        styles.particle,
        { left, bottom, width: size, height: size, borderRadius: pearl ? size / 2 : size * 0.22, backgroundColor: color },
        style,
      ]}
    >
      {size >= 6 && <View style={[styles.particleShine, { width: size * 0.3, height: size * 0.3, borderRadius: size }]} />}
    </Animated.View>
  );
}

interface IceCubeProps {
  size: number;
  left: number;
  bottom: number;
  rotate: number;
  dropFrom: number;
  delay: number;
  animated?: boolean;
}

function IceCube({ size, left, bottom, rotate, dropFrom, delay, animated }: IceCubeProps) {
  const drop = useSharedValue(animated ? -dropFrom : 0);
  useEffect(() => {
    if (animated) drop.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }));
  }, [animated, delay, drop]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }, { rotate: `${rotate}deg` }] }));
  return (
    <Animated.View style={[styles.ice, { width: size, height: size, borderRadius: size * 0.2, left, bottom }, style]}>
      <View style={[styles.iceShine, { width: size * 0.35, height: size * 0.12, borderRadius: size }]} />
    </Animated.View>
  );
}

function FoamLayer({ color, width, height, animated }: { color: string; width: number; height: number; animated?: boolean }) {
  const land = useSharedValue(animated ? 0 : 1);
  useEffect(() => {
    if (animated) land.value = withTiming(1, timing(DURATION.slow));
  }, [animated, land]);
  const style = useAnimatedStyle(() => ({
    opacity: land.value,
    transform: [{ translateY: (1 - land.value) * -height }],
  }));
  const bump = height * 0.8;
  const count = Math.ceil(width / (bump * 0.75));
  return (
    <Animated.View style={[{ height, backgroundColor: color }, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -bump * 0.4,
            left: i * bump * 0.75 - bump * 0.2,
            width: bump,
            height: bump,
            borderRadius: bump / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
}

function Sticker({ label, top, left, fontSize, animated }: { label: string; top: number; left: number; fontSize: number; animated?: boolean }) {
  const appear = useSharedValue(animated ? 0 : 1);
  useEffect(() => {
    if (animated) appear.value = withTiming(1, timing());
  }, [animated, appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.9 + appear.value * 0.1 }, { rotate: '-8deg' }],
  }));
  return (
    <Animated.View style={[styles.sticker, { top, left }, style]}>
      <Text style={[styles.stickerText, { fontSize }]}>🍯{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  straw: {
    position: 'absolute',
    backgroundColor: '#FF8FB1',
    borderRadius: 3,
    borderLeftWidth: 2,
    borderLeftColor: '#FFC2D4',
    transform: [{ rotate: '10deg' }],
  },
  body: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderBottomColor: colors.cupOutline,
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  surface: {
    position: 'absolute',
    top: -3,
    left: 0,
    height: 8,
  },
  stream: {
    position: 'absolute',
  },
  granule: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E8D9C8',
  },
  ice: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  iceShine: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  particle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  particleShine: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  gloss: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 6,
    transform: [{ rotate: '4deg' }],
  },
  mask: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  side: {
    position: 'absolute',
    backgroundColor: colors.cupOutline,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: -2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.cupOutline,
  },
  seal: {
    position: 'absolute',
    left: -2,
    backgroundColor: '#FFF3F7',
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  sealDot: {
    position: 'absolute',
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  sticker: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.cupOutline,
  },
  stickerText: {
    color: colors.ink,
    fontFamily: fonts.bold,
  },
});
