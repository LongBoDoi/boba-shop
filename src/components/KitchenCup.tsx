import { useEffect, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { Drink, getIngredient, GOOD_FILL, ICE_LEVELS, MIN_FILL, Tea } from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { shade } from './art/Character';
import { CUP_BASE, CUP_SPRITE, PIECE, PIECE_ART } from './art/kitchenArt';

/**
 * The cup on the prep bench: the painted sprite with the drink poured *inside* it. Everything the
 * player adds is drawn in the sprite's own coordinate space and clipped to the glass, so nothing
 * ever spills out past the walls, and it all sits below the cat printed on the front.
 */

/** The sprite is drawn in this box; all the geometry below is in the same units. */
const ART = { w: 133, h: 199 };
/** The inside of the glass: straight walls leaning in to a rounded base. */
const WELL = 'M10 34 L30 186 Q33 193 44 193 H89 Q100 193 103 186 L121 34 Z';
export const WELL_TOP = 34 / ART.h;
export const WELL_BOTTOM = 193 / ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;

/** Where the ice floats and where the toppings pile up, in sprite units. */
const ICE_SPOTS = [
  { x: 34, y: 128, r: 17 },
  { x: 78, y: 118, r: 15 },
  { x: 56, y: 150, r: 16 },
  { x: 94, y: 146, r: 14 },
];
const PILE = [
  { x: 34, y: 181 },
  { x: 53, y: 184 },
  { x: 72, y: 184 },
  { x: 91, y: 181 },
  { x: 44, y: 168 },
  { x: 63, y: 170 },
  { x: 82, y: 168 },
  { x: 53, y: 156 },
  { x: 72, y: 156 },
];
const PIECE_R = 11;

interface KitchenCupProps {
  drink: Drink;
  width: number;
  height: number;
  /** Driven by the station while a tap is held open, so the level rises with the hold. */
  level: SharedValue<number>;
}

export function KitchenCup({ drink, width, height, level }: KitchenCupProps) {
  const uid = useId().replace(/:/g, '');
  const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
  const ice = ICE_LEVELS.find((option) => option.id === drink.ice);

  const scale = height / ART.h;
  const padBottom = (1 - WELL_BOTTOM) * height;
  const runPx = WELL_RUN * height;

  const milkiness = useSharedValue(milk ? 1 : 0);
  useEffect(() => {
    milkiness.set(withTiming(milk ? 1 : 0, timing(DURATION.slow)));
  }, [milk, milkiness]);

  // The drink is a full-height painting of itself, revealed from the bottom as the cup fills.
  const reveal = useAnimatedStyle(() => ({ height: Math.max(0, Math.min(1, level.get())) * runPx }));
  const milky = useAnimatedStyle(() => ({ opacity: milkiness.get() }));
  const foamStyle = useAnimatedStyle(() => ({
    bottom: padBottom + Math.max(0.06, Math.min(1, level.get())) * runPx - 5 * scale,
  }));

  return (
    <View style={{ width, height }}>
      <Image source={CUP_BASE} style={[styles.layer, { width, height }]} />

      {tea && (
        <Animated.View style={[styles.reveal, { bottom: padBottom }, reveal]}>
          <View style={{ position: 'absolute', bottom: -padBottom, width, height }}>
            <Svg width={width} height={height} viewBox={`0 0 ${ART.w} ${ART.h}`}>
              <Defs>
                <ClipPath id={`well-${uid}`}>
                  <Path d={WELL} />
                </ClipPath>
                <LinearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={shade(tea.color, 14)} />
                  <Stop offset="0.45" stopColor={tea.color} />
                  <Stop offset="1" stopColor={shade(tea.color, -16)} />
                </LinearGradient>
                <LinearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
                  <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.86" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.14} />
                </LinearGradient>
              </Defs>
              <G clipPath={`url(#well-${uid})`}>
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={`url(#body-${uid})`} />
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={`url(#sheen-${uid})`} />
                {/* the surface catches the light */}
                <Rect x={0} y={0} width={ART.w} height={5} fill="#FFFFFF" opacity={0.3} />
                <Rect x={0} y={5} width={ART.w} height={3} fill="#FFFFFF" opacity={0.12} />
              </G>
            </Svg>
          </View>
        </Animated.View>
      )}

      {/* milk turns the whole drink creamy as it goes in */}
      {tea && milk && (
        <Animated.View style={[styles.reveal, { bottom: padBottom }, reveal]}>
          <Animated.View style={[{ position: 'absolute', bottom: -padBottom, width, height }, milky]}>
            <Svg width={width} height={height} viewBox={`0 0 ${ART.w} ${ART.h}`}>
              <Defs>
                <ClipPath id={`wellm-${uid}`}>
                  <Path d={WELL} />
                </ClipPath>
                <LinearGradient id={`milky-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={shade(tea.milkyColor, 10)} />
                  <Stop offset="1" stopColor={shade(tea.milkyColor, -14)} />
                </LinearGradient>
              </Defs>
              <G clipPath={`url(#wellm-${uid})`}>
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={`url(#milky-${uid})`} />
                <Rect x={0} y={0} width={ART.w} height={5} fill="#FFFFFF" opacity={0.3} />
              </G>
            </Svg>
          </Animated.View>
        </Animated.View>
      )}

      {/* ice, toppings and the pouring guides live in the drink, never outside the glass */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox={`0 0 ${ART.w} ${ART.h}`}>
        <Defs>
          <ClipPath id={`wellp-${uid}`}>
            <Path d={WELL} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#wellp-${uid})`}>
          {ice &&
            ICE_SPOTS.slice(0, ice.cubes).map((spot, i) => (
              <SvgImage
                key={i}
                href={PIECE.ice}
                x={spot.x - spot.r}
                y={spot.y - spot.r / PIECE_ART.ice}
                width={spot.r * 2}
                height={(spot.r * 2) / PIECE_ART.ice}
                opacity={0.92}
                preserveAspectRatio="xMidYMid meet"
              />
            ))}

          {drink.toppings.length > 0 &&
            PILE.map((spot, i) => {
              const id = drink.toppings[i % drink.toppings.length];
              const aspect = PIECE_ART[id] ?? 1;
              return (
                <SvgImage
                  key={i}
                  href={PIECE[id]}
                  x={spot.x - PIECE_R}
                  y={spot.y - PIECE_R / aspect}
                  width={PIECE_R * 2}
                  height={(PIECE_R * 2) / aspect}
                  preserveAspectRatio="xMidYMid meet"
                />
              );
            })}

          {/* the pour guides: "đủ" and the clean-pour band */}
          <Rect
            x={8}
            y={193 - MIN_FILL * 159}
            width={ART.w - 16}
            height={1.6}
            fill="#E5534B"
            opacity={0.85}
          />
          <Rect
            x={8}
            y={193 - 159}
            width={ART.w - 16}
            height={159 * (1 - GOOD_FILL)}
            fill="#3FA56B"
            opacity={0.14}
          />
        </G>
      </Svg>

      {foam && (
        <Animated.View style={[styles.foam, { height: 13 * scale }, foamStyle]} pointerEvents="none">
          <Svg width={width} height={13 * scale} viewBox="0 0 133 13">
            <Ellipse cx={66} cy={7} rx={48} ry={6.5} fill={foam.color} stroke={shade(foam.color, -16)} strokeWidth={1.2} />
            <Ellipse cx={55} cy={5.5} rx={18} ry={3} fill="#FFFFFF" opacity={0.5} />
          </Svg>
        </Animated.View>
      )}

      <Image source={CUP_SPRITE} style={[styles.layer, { width, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  reveal: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  foam: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
