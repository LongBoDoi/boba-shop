import { memo, useEffect, useId, useMemo } from 'react';
import Animated, { cancelAnimation, SharedValue, useAnimatedProps, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Stop } from 'react-native-svg';

import { CUP_ICE } from './art/kitchenArt';
import { cupIceFillPath, cupIceOutlinePath, cupIcePosition, cupIceRestPosition, cupSurface } from './cupGeometry';
import { IcePlacement } from './iceLayout';
import { DURATION, timing } from '../motion';

const AnimatedGroup = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Rounded, three-dimensional faces give the ice a readable silhouette at phone scale.
// The neutral painting contributes surface detail; it no longer controls the body's contrast.
const CUBE_SHAPE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L18 14Q18 16 16 17L9 22Q8 23 6 22L-19 15Q-22 14-22 11L-22-8Q-22-10-20-11Z';
const TOP_FACE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L8-2Z';
const SIDE_FACE = 'M8-2L21-10L18 14Q18 16 16 17L9 22Q8 23 6 22Z';

/** The cup's own box, for the even-odd hole that leaves everything above the water exposed. */
const BOX = 'M0 0H113V174H0Z';

/**
 * Which side of the waterline this is drawing. Ice is drawn twice, from either side of the cup's
 * painted front wall: what is under the tea keeps the glass wash over it, and the crowns standing
 * out of the tea are drawn over that wall, crisp. The cup decides where the wall goes — see
 * `KitchenCup` — which is why this takes the side rather than punching the wall out with a mask.
 */
export type IceLayer = 'submerged' | 'exposed';

interface CupIceProps {
  cubes: number;
  /** Shared by both layers, so the two sides of the waterline are the same ice. */
  layout: IcePlacement[];
  layer: IceLayer;
  level: SharedValue<number>;
  hasTea: boolean;
  toppingLayers: number;
  teaColor?: string;
  milkColor?: string;
}

/**
 * Frosted ice resting on the dry ingredient bed, then floating with the live tea surface.
 *
 * **Everything here has to draw on a phone, not only in a browser**, and react-native-svg is not a
 * browser. Two of its gaps shape this file:
 *
 * - **`<Use>` does not survive.** A `Use` inside a `ClipPath` asks the native renderer for the path
 *   of whatever it points at, and a template it cannot find at that moment hands back nothing —
 *   which Android then calls a method on and iOS passes to `CFAutorelease`. Shapes are drawn where
 *   they are needed instead, even when that repeats them.
 * - **An animated `transform` never arrives.** `transform` is turned into the `matrix` the phone
 *   understands by JavaScript, inside the element — and an animated prop goes straight to the view,
 *   so a string written by a worklet is dropped in silence. The array form (`[{ translateX }, …]`)
 *   is read natively, so that is what the cubes are placed with. A clip cannot take even that,
 *   because a clip is a path: `cupIceOutlinePath` draws the cube already standing where it stands.
 */
export const CupIce = memo(function CupIce({ cubes, layout, layer, ...props }: CupIceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const submerged = layer === 'submerged';
  // The tea's rear arc stays behind the ice; every cube shares its near-side water boundary.
  const liquidShape = useDerivedValue(() => {
    const raw = props.level.get();
    return cupIceFillPath(props.hasTea ? raw : 0);
  }, [props.level, props.hasTea]);
  const waterProps = useAnimatedProps(() => {
    const shape = liquidShape.get();
    return { d: submerged ? shape || 'M0 0Z' : `${BOX} ${shape}` };
  }, [liquidShape, submerged]);

  // Back to front, so the cubes nearer the viewer overlap the ones behind them.
  const standing = useMemo(
    () => layout.slice(0, cubes).map((cube, i) => ({ cube, i })).sort((a, b) => a.cube.depth - b.cube.depth),
    [layout, cubes],
  );

  return (
    <G>
      <Defs>
        <ClipPath id={`ice-water-${uid}`}>
          <AnimatedPath animatedProps={waterProps} fillRule="evenodd" clipRule="evenodd" />
        </ClipPath>
        {/* One cube's shape, in the 48-unit box every cube is drawn in before it is scaled. */}
        <ClipPath id={`ice-body-${uid}`}>
          <Path d={CUBE_SHAPE} />
        </ClipPath>
        <LinearGradient id={`ice-front-${uid}`} x1="0%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0" stopColor="#EFFAFF" />
          <Stop offset="0.4" stopColor="#C9E6F1" />
          <Stop offset="1" stopColor="#8DBACC" />
        </LinearGradient>
        <LinearGradient id={`ice-top-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#C5E8F4" />
        </LinearGradient>
        <LinearGradient id={`ice-side-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#A9D3E3" />
          <Stop offset="1" stopColor="#6696AE" />
        </LinearGradient>
      </Defs>
      {/* The contact shadow belongs to the cup's floor, so it is never clipped to the tea. */}
      {submerged && standing.map(({ cube, i }) => (
        <IceShadow key={i} cube={cube} level={props.level} hasTea={props.hasTea}
          toppingLayers={props.toppingLayers} />
      ))}
      <G clipPath={`url(#ice-water-${uid})`}>
        {standing.map(({ cube, i }) => (
          <IceCube key={i} uid={uid} cube={cube} submerged={submerged} {...props} />
        ))}
      </G>
      {/* A cube that breaks the surface is anchored to it by the tea's own near arc. */}
      {!submerged && standing.filter(({ cube }) => !cube.submergedDepth).map(({ cube, i }) => (
        <IceMeniscus key={i} uid={`${uid}-${i}`} cube={cube} level={props.level} hasTea={props.hasTea}
          toppingLayers={props.toppingLayers} teaColor={props.teaColor} />
      ))}
    </G>
  );
});

/** Where this cube rests, where it is now, and how far through settling in it is. */
function useCube(cube: IcePlacement, level: SharedValue<number>, hasTea: boolean, toppingLayers: number) {
  const { r, angle } = cube;
  const dry = useMemo(
    () => cupIceRestPosition(cube.restX, r, cube.restAngle, cube.restLift + toppingLayers * 10),
    [cube.restX, cube.restAngle, cube.restLift, r, toppingLayers],
  );
  const settled = useSharedValue(0);
  useEffect(() => {
    settled.set(withTiming(1, timing(DURATION.base)));
    return () => cancelAnimation(settled);
  }, [settled]);
  const position = useDerivedValue(() => {
    // Always read the live level, including while the empty cup is waiting for its first tea.
    const raw = level.get();
    return cupIcePosition(hasTea ? raw : 0, cube.x, r, angle, cube.depth, dry.cx, dry.cy, cube.restAngle,
      cube.submergedDepth ?? 0, cube.immersion ?? 0.42);
  }, [cube.x, cube.depth, cube.restAngle, cube.submergedDepth, cube.immersion, r, angle, dry.cx, dry.cy, level, hasTea]);
  return { dry, settled, position };
}

function IceCube({ cube, uid, submerged, level, hasTea, toppingLayers, teaColor, milkColor }:
  Omit<CupIceProps, 'cubes' | 'layout' | 'layer'> & {
  cube: IcePlacement;
  uid: string;
  submerged: boolean;
}) {
  const { r } = cube;
  const { settled, position } = useCube(cube, level, hasTea, toppingLayers);
  const placement = useAnimatedProps(() => {
    const { cx, cy, angle: tilt } = position.get();
    const fall = 1 - settled.get();
    return {
      transform: [
        { translateX: cx },
        { translateY: cy - 10 * fall },
        { rotate: `${tilt - 7 * fall}deg` },
      ],
    };
  }, [position, settled]);
  const scale = `scale(${r / 24})`;
  const tint = milkColor ?? teaColor;

  return (
    <AnimatedGroup animatedProps={placement}>
      <G transform={scale} opacity={submerged ? (milkColor ? 0.65 : 0.62) : 1}>
        <Path d={CUBE_SHAPE} fill={`url(#ice-front-${uid})`} />
        <Path d={TOP_FACE} fill={`url(#ice-top-${uid})`} />
        <Path d={SIDE_FACE} fill={`url(#ice-side-${uid})`} />
        <SvgImage href={CUP_ICE} x={-24} y={-24} width={48} height={48}
          opacity={0.2} clipPath={`url(#ice-body-${uid})`} />
        <Path d={CUBE_SHAPE} fill="none" stroke="#477E99" strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M-19-9L8-1L6 20 M8-1L19-10" fill="none" stroke="#F8FEFF"
          strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />
        <Path d="M-18-5L-17 9 M-6-16L4-13" fill="none" stroke="#FFFFFF"
          strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      </G>
      {/* Under the tea the body is softened and takes the drink's colour. */}
      {submerged && tint && <Path d={CUBE_SHAPE} transform={scale} fill={tint} opacity={0.28} />}
    </AnimatedGroup>
  );
}

function IceShadow({ cube, level, hasTea, toppingLayers }: {
  cube: IcePlacement;
  level: SharedValue<number>;
  hasTea: boolean;
  toppingLayers: number;
}) {
  const { dry, settled, position } = useCube(cube, level, hasTea, toppingLayers);
  const fade = useAnimatedProps(() => ({
    opacity: (1 - position.get().rise) * settled.get() * 0.18,
  }), [position, settled]);
  return (
    <AnimatedEllipse animatedProps={fade} cx={dry.contactX} cy={dry.contactY}
      rx={cube.r * 0.7} ry={1.6} fill="#506576" />
  );
}

function IceMeniscus({ cube, uid, level, hasTea, toppingLayers, teaColor }: {
  cube: IcePlacement;
  uid: string;
  level: SharedValue<number>;
  hasTea: boolean;
  toppingLayers: number;
  teaColor?: string;
}) {
  const { settled, position } = useCube(cube, level, hasTea, toppingLayers);
  const outline = useAnimatedProps(() => {
    const { cx, cy, angle } = position.get();
    const fall = 1 - settled.get();
    return { d: cupIceOutlinePath(cx, cy - 10 * fall, angle - 7 * fall, cube.r) };
  }, [position, settled, cube.r]);
  const waterline = useAnimatedProps(() => {
    const surface = cupSurface(hasTea ? level.get() : 0);
    return {
      d: `M${56.5 - surface.rx} ${surface.y} A${surface.rx} ${surface.ry} 0 0 0 ${56.5 + surface.rx} ${surface.y}`,
      opacity: surface.opacity * 0.55,
    };
  }, [hasTea, level]);
  return (
    <G>
      <Defs>
        <ClipPath id={`ice-edge-${uid}`}>
          <AnimatedPath animatedProps={outline} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#ice-edge-${uid})`}>
        <AnimatedPath animatedProps={waterline} fill="none" stroke={teaColor ?? '#769FAC'} strokeWidth={0.8} />
      </G>
    </G>
  );
}
