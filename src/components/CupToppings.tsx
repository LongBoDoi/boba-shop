import { Fragment, memo, useEffect, useId, useMemo } from 'react';
import Animated, { cancelAnimation, DerivedValue, SharedValue, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

import { getIngredient, Topping } from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { ToppingPieceArt } from './art/ToppingSprites';
import { TOPPING_PIECE_ART } from './art/toppingArt';
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
  const option = getIngredient('toppings', id) as Topping | undefined;
  const cube = option?.shape === 'cube';
  const art = TOPPING_PIECE_ART.cells[id];
  const aspect = art ? art.width / art.height : 1;
  const tint = milkColor ?? teaColor;

  /**
   * Where this portion's seventeen pieces sit. Fixed for the life of the portion — the pile is
   * deliberately stable while the clock and the tea level move — so it is worked out once instead
   * of on every render of a cup that is redrawn ten times a second.
   */
  const pieces = useMemo(() => {
    const seed = [...id].reduce((value, letter) => value + letter.charCodeAt(0), 0);
    return BED.map((spot, i) => {
      const jitter = ((seed + i * 7) % 5 - 2) * 0.55;
      const rx = (cube ? 5.3 : 5.8) * spot.size;
      const ry = rx / aspect;
      const angle = cube ? ((seed + i * 11) % 37) - 18 : 0;
      const { cx, cy } = cupToppingPosition(
        spot.x + jitter,
        rx, ry, angle, spot.lift + portion * 12.5 + ((seed + i * 3) % 4) * 0.4,
      );
      // The wash follows each sprite's silhouette, including the faceted jelly cubes — and it is
      // a *clip*, so it has to be drawn where it belongs rather than carried there by a transform.
      const radians = angle * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const at = (px: number, py: number) =>
        `${(cx + px * cos - py * sin).toFixed(2)} ${(cy + px * sin + py * cos).toFixed(2)}`;
      return {
        rx, ry, cx, cy,
        // A *static* transform may be the SVG string: it is turned into the matrix a phone reads
        // inside the element, and only an animated prop skips past that. See `settleProps` above.
        place: `translate(${cx},${cy}) rotate(${angle})`,
        opacity: 0.8 + spot.depth * 0.2,
        shadow: 0.08 + spot.depth * 0.1,
        wash: 1.25 - spot.depth * 0.55,
        silhouette: cube
          ? `M${at(-rx, -ry * 0.5)} L${at(0, -ry)} L${at(rx, -ry * 0.5)} L${at(rx, ry * 0.55)} L${at(0, ry)} L${at(-rx, ry * 0.55)}Z`
          : `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`,
      };
    });
  }, [id, portion, cube, aspect]);

  return (
    <AnimatedGroup animatedProps={settleProps}>
      {/*
        Each piece's tea wash is the *liquid* drawn inside the piece, not the piece drawn inside a
        mask of the liquid. The two produce the same picture, and the second one is ruinous on a
        phone: a masked element costs react-native-svg four canvas-sized offscreen layers and two
        draws of the mask's own contents, every frame — and the mask here held the live tea
        boundary. Seventeen of those per portion, three portions deep, was fifty-one masks and two
        hundred layers a frame for one cup of boba, which is most of why a finished drink stuttered
        on a phone while the same cup was smooth in a browser.

        Turning it inside out leaves the boundary as the thing being drawn (so it still moves — an
        animated `d`) and the silhouette as the thing clipping it. A clip is frozen at its first
        draw on Android, which is exactly right for a shape that never moves, and costs a canvas
        clip rather than four layers. The silhouettes are drawn where they stand, because a clip
        cannot be carried into place by a transform.
      */}
      <Defs>
        {tint && pieces.map((piece, i) => (
          <ClipPath key={i} id={`topping-wet-${uid}-${i}`}>
            <Path d={piece.silhouette} />
          </ClipPath>
        ))}
      </Defs>
      {pieces.map((piece, i) => (
        <Fragment key={i}>
          <Ellipse cx={piece.cx + 0.3} cy={piece.cy + piece.ry * 0.78} rx={piece.rx * 0.88} ry={piece.ry * 0.2}
            fill="#271710" opacity={piece.shadow} />
          <G transform={piece.place}>
            <ToppingPieceArt id={id} x={-piece.rx} y={-piece.ry}
              width={piece.rx * 2} height={piece.ry * 2} opacity={piece.opacity} />
          </G>
          {tint && (
            <ToppingWash clip={`topping-wet-${uid}-${i}`} liquidShape={liquidShape} settled={settled}
              tint={tint} opacity={(milkColor ? 0.3 : 0.16) * piece.wash} />
          )}
        </Fragment>
      ))}
    </AnimatedGroup>
  );
}

/** How far up one piece the drink stands: the live tea, clipped to that piece's own outline. */
function ToppingWash({ clip, liquidShape, settled, tint, opacity }: {
  clip: string;
  liquidShape: DerivedValue<string>;
  settled: SharedValue<number>;
  tint: string;
  opacity: number;
}) {
  const wetProps = useAnimatedProps(() => ({
    d: liquidShape.get() || 'M0 0Z',
    // Counter the falling group's transform: the tea boundary stays fixed in the cup.
    transform: [{ translateY: 14 * (1 - settled.get()) }],
  }), [liquidShape, settled]);
  return (
    <G clipPath={`url(#${clip})`}>
      <AnimatedPath animatedProps={wetProps} fill={tint} opacity={opacity} />
    </G>
  );
}
