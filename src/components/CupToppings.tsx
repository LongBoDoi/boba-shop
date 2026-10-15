import { memo, useEffect, useId } from 'react';
import Animated, { cancelAnimation, DerivedValue, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Ellipse, G, Image as SvgImage, Path } from 'react-native-svg';

import { getIngredient, Topping } from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { PIECE, PIECE_ART } from './art/kitchenArt';
import { cupToppingPosition } from './cupGeometry';

const AnimatedGroup = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Back to front: smaller pieces sit behind the larger ones at the curved inner floor.
// Fixed, irregular positions keep the pile stable while the game clock and tea level update.
const BED = [
  { x: 34, depth: 0.18, lift: 11, size: 0.81 },
  { x: 45, depth: 0.12, lift: 10, size: 0.85 },
  { x: 56, depth: 0.22, lift: 12, size: 0.8 },
  { x: 67, depth: 0.17, lift: 10, size: 0.86 },
  { x: 78, depth: 0.24, lift: 11, size: 0.83 },
  { x: 29, depth: 0.52, lift: 5, size: 0.91 },
  { x: 40, depth: 0.58, lift: 5.5, size: 0.94 },
  { x: 51, depth: 0.48, lift: 6, size: 0.9 },
  { x: 62, depth: 0.62, lift: 5, size: 0.97 },
  { x: 73, depth: 0.53, lift: 5.5, size: 0.91 },
  { x: 83, depth: 0.6, lift: 5, size: 0.95 },
  { x: 30, depth: 0.91, lift: 0, size: 0.97 },
  { x: 41, depth: 0.95, lift: 0.5, size: 1.03 },
  { x: 52, depth: 1, lift: 0, size: 1 },
  { x: 63, depth: 0.94, lift: 0.3, size: 1.05 },
  { x: 74, depth: 0.98, lift: 0, size: 0.96 },
  { x: 84, depth: 0.9, lift: 0.2, size: 0.93 },
];

interface CupToppingsProps {
  ids: string[];
  /** Live liquid silhouette, shared with the glass so dry pieces are never tea-tinted. */
  liquidShape: DerivedValue<string>;
  teaColor?: string;
  milkColor?: string;
}

/** Painted pieces pack into the cup's base, with depth, overlap and a little settling on addition. */
export const CupToppings = memo(function CupToppings({ ids, ...props }: CupToppingsProps) {
  return (
    <G>
      {/* Additional portions build up behind the first; existing pieces keep their positions. */}
      {ids.map((id, portion) => ({ id, portion })).reverse().map(({ id, portion }) => (
        <ToppingPortion key={id} id={id} portion={portion} {...props} />
      ))}
    </G>
  );
});

function ToppingPortion({ id, portion, liquidShape, teaColor, milkColor }: Omit<CupToppingsProps, 'ids'> & {
  id: string;
  portion: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const settled = useSharedValue(0);
  useEffect(() => {
    settled.set(withTiming(1, timing(DURATION.base)));
    return () => cancelAnimation(settled);
  }, [settled]);
  // An animated `transform` has to be written as the array form: the SVG string is turned into the
  // `matrix` a phone reads by JavaScript, inside the element, which an animated prop never passes
  // through — written as a string the fall happens in a browser and nowhere else. See `CupIce`.
  const settleProps = useAnimatedProps(() => ({
    transform: [{ translateY: -14 * (1 - settled.get()) }],
  }), [settled]);
  const wetProps = useAnimatedProps(() => ({
    d: liquidShape.get() || 'M0 0Z',
    // Counter the falling group's transform: the tea boundary stays fixed in the cup.
    transform: [{ translateY: 14 * (1 - settled.get()) }],
  }), [liquidShape, settled]);
  const option = getIngredient('toppings', id) as Topping | undefined;
  const cube = option?.shape === 'cube';
  const aspect = PIECE_ART[id] ?? 1;
  const seed = [...id].reduce((value, letter) => value + letter.charCodeAt(0), 0);
  const tint = milkColor ?? teaColor;

  return (
    <AnimatedGroup animatedProps={settleProps}>
      <Defs>
        <ClipPath id={`topping-wet-${uid}`}>
          <AnimatedPath animatedProps={wetProps} />
        </ClipPath>
      </Defs>
      {BED.map((spot, i) => {
        const jitter = ((seed + i * 7) % 5 - 2) * 0.55;
        const rx = (cube ? 5.3 : 5.8) * spot.size;
        const ry = rx / aspect;
        const angle = cube ? ((seed + i * 11) % 37) - 18 : 0;
        const { cx, cy } = cupToppingPosition(
          spot.x + jitter,
          rx, ry, angle, spot.lift + portion * 12.5 + ((seed + i * 3) % 4) * 0.4,
        );
        const opacity = 0.8 + spot.depth * 0.2;
        // The wash follows each sprite's silhouette, including the faceted jelly cubes.
        const silhouette = cube
          ? `M${-rx} ${-ry * 0.5} L0 ${-ry} L${rx} ${-ry * 0.5} L${rx} ${ry * 0.55} L0 ${ry} L${-rx} ${ry * 0.55}Z`
          : `M${-rx} 0 A${rx} ${ry} 0 1 0 ${rx} 0 A${rx} ${ry} 0 1 0 ${-rx} 0Z`;
        return (
          <G key={i}>
            <Ellipse cx={cx + 0.3} cy={cy + ry * 0.78} rx={rx * 0.88} ry={ry * 0.2}
              fill="#271710" opacity={0.08 + spot.depth * 0.1} />
            <G transform={`translate(${cx},${cy}) rotate(${angle})`}>
              <SvgImage href={PIECE[id]} x={-rx} y={-ry} width={rx * 2} height={ry * 2}
                opacity={opacity} preserveAspectRatio="xMidYMid meet" />
            </G>
            {tint && (
              <G clipPath={`url(#topping-wet-${uid})`}>
                <Path d={silhouette} transform={`translate(${cx},${cy}) rotate(${angle})`}
                  fill={tint} opacity={(milkColor ? 0.3 : 0.16) * (1.25 - spot.depth * 0.55)} />
              </G>
            )}
          </G>
        );
      })}
    </AnimatedGroup>
  );
}
