import { useEffect, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  Drink,
  getIngredient,
  GOOD_FILL,
  ICE_LEVELS,
  MIN_FILL,
  Tea,
  Topping,
  TOPPINGS,
} from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { shade } from './art/Character';
import { CUP_BASE, CUP_SPRITE } from './art/kitchenArt';

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

/** Where the ice floats, and where the toppings pile up — both in sprite units. */
const ICE_SPOTS = [
  { x: 36, y: 132, r: 15, turn: -12 },
  { x: 76, y: 120, r: 13, turn: 14 },
  { x: 58, y: 152, r: 14, turn: 6 },
  { x: 92, y: 148, r: 12, turn: -8 },
];
const PILE = [
  { x: 36, y: 182 },
  { x: 54, y: 184 },
  { x: 72, y: 184 },
  { x: 90, y: 182 },
  { x: 45, y: 169 },
  { x: 63, y: 171 },
  { x: 81, y: 169 },
  { x: 54, y: 157 },
  { x: 72, y: 157 },
];
const PIECE_R = 9.5;

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
  const toppings = drink.toppings.map((id) => TOPPINGS.find((t) => t.id === id)).filter(Boolean) as Topping[];

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
                <LinearGradient id={`depth-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000000" stopOpacity={0.18} />
                </LinearGradient>
              </Defs>
              <G clipPath={`url(#well-${uid})`}>
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={tea.color} />
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={`url(#depth-${uid})`} />
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
              </Defs>
              <G clipPath={`url(#wellm-${uid})`}>
                <Rect x={0} y={0} width={ART.w} height={ART.h} fill={tea.milkyColor} />
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
          {toppings.map((topping) => (
            <RadialGradient key={topping.id} id={`g-${topping.id}-${uid}`} cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor={shade(topping.color, 30)} />
              <Stop offset="1" stopColor={shade(topping.color, -22)} />
            </RadialGradient>
          ))}
        </Defs>
        <G clipPath={`url(#wellp-${uid})`}>
          {ice &&
            ICE_SPOTS.slice(0, ice.cubes).map((spot, i) => (
              <G key={i} transform={`rotate(${spot.turn} ${spot.x} ${spot.y})`}>
                <Rect
                  x={spot.x - spot.r / 2}
                  y={spot.y - spot.r / 2}
                  width={spot.r}
                  height={spot.r}
                  rx={2.5}
                  fill="#F2FBFF"
                  fillOpacity={0.9}
                  stroke="#A8D6EE"
                  strokeWidth={1.4}
                />
                <Rect x={spot.x - spot.r / 2 + 2} y={spot.y - spot.r / 2 + 2} width={spot.r * 0.3} height={spot.r * 0.5} rx={1} fill="#FFFFFF" opacity={0.75} />
              </G>
            ))}

          {toppings.length > 0 &&
            PILE.map((spot, i) => {
              const topping = toppings[i % toppings.length];
              return (
                <Piece
                  key={i}
                  x={spot.x}
                  y={spot.y}
                  r={PIECE_R}
                  topping={topping}
                  fill={`url(#g-${topping.id}-${uid})`}
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

/** One pearl or one jelly cube, shaded the way the painted ones are. */
export function Piece({ x, y, r, topping, fill }: { x: number; y: number; r: number; topping: Topping; fill: string }) {
  const rim = shade(topping.color, -38);
  if (topping.shape === 'pearl') {
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={fill} stroke={rim} strokeWidth={1.2} />
        <Ellipse cx={x - r * 0.3} cy={y - r * 0.38} rx={r * 0.3} ry={r * 0.22} fill="#FFFFFF" opacity={0.85} />
      </G>
    );
  }
  return (
    <G transform={`rotate(${(x % 7) - 3} ${x} ${y})`}>
      <Rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * 0.26} fill={fill} stroke={rim} strokeWidth={1.2} />
      <Rect x={x - r * 0.72} y={y - r * 0.72} width={r * 0.7} height={r * 0.5} rx={1} fill="#FFFFFF" opacity={0.6} />
    </G>
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
