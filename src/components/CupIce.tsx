import { memo, useEffect, useId, useMemo } from 'react';
import Animated, { cancelAnimation, SharedValue, useAnimatedProps, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Mask, Path, Stop, Use } from 'react-native-svg';

import { CUP_ICE } from './art/kitchenArt';
import { cupIceFillPath, cupIcePosition, cupIceRestPosition, cupSurface } from './cupGeometry';
import { createIceLayout, ICE_LAYOUT } from './iceLayout';
import { DURATION, timing } from '../motion';

const AnimatedGroup = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Rounded, three-dimensional faces give the ice a readable silhouette at phone scale.
// The neutral painting contributes surface detail; it no longer controls the body's contrast.
const CUBE_SHAPE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L18 14Q18 16 16 17L9 22Q8 23 6 22L-19 15Q-22 14-22 11L-22-8Q-22-10-20-11Z';
const TOP_FACE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L8-2Z';
const SIDE_FACE = 'M8-2L21-10L18 14Q18 16 16 17L9 22Q8 23 6 22Z';

interface CupIceProps {
  cubes: number;
  seed: number;
  glassMaskId: string;
  level: SharedValue<number>;
  hasTea: boolean;
  toppingLayers: number;
  teaColor?: string;
  milkColor?: string;
}

/** Frosted ice rests on the dry ingredient bed, then floats with the live tea surface. */
export const CupIce = memo(function CupIce({ cubes, seed, glassMaskId, ...props }: CupIceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const layout = useMemo(() => createIceLayout(seed), [seed]);
  // The tea's rear arc stays behind the ice; every cube shares its near-side water boundary.
  const liquidShape = useDerivedValue(() => {
    const raw = props.level.get();
    return cupIceFillPath(props.hasTea ? raw : 0);
  }, [props.level, props.hasTea]);
  const wetProps = useAnimatedProps(() => ({ d: liquidShape.get() || 'M0 0Z' }), [liquidShape]);
  const dryProps = useAnimatedProps(() => ({ d: `M0 0H113V174H0Z ${liquidShape.get()}` }), [liquidShape]);
  const waterlineProps = useAnimatedProps(() => {
    const surface = cupSurface(props.hasTea ? props.level.get() : 0);
    return { d: `M${56.5 - surface.rx} ${surface.y} A${surface.rx} ${surface.ry} 0 0 0 ${56.5 + surface.rx} ${surface.y}`,
      opacity: surface.opacity };
  }, [props.hasTea, props.level]);
  return (
    <G>
      <Defs>
        <ClipPath id={`ice-submerged-${uid}`}><AnimatedPath animatedProps={wetProps} /></ClipPath>
        <ClipPath id={`ice-exposed-${uid}`}>
          <AnimatedPath animatedProps={dryProps} fillRule="evenodd" clipRule="evenodd" />
        </ClipPath>
        <AnimatedPath id={`ice-waterline-${uid}`} animatedProps={waterlineProps} fill="none"
          stroke={props.teaColor ?? '#769FAC'} strokeWidth={0.8} />
        {/* Exposed ice keeps its crisp faces instead of sitting under the painted plastic wash. */}
        <Mask id={glassMaskId} x={0} y={0} width={113} height={174}
          maskUnits="userSpaceOnUse" maskType="luminance">
          <Path d="M0 0H113V174H0Z" fill="#FFFFFF" />
          <G clipPath={`url(#ice-exposed-${uid})`}>
            {layout.slice(0, cubes).map((_, i) => <Use key={i} href={`#ice-silhouette-${uid}-${i}`} />)}
          </G>
        </Mask>
      </Defs>
      {layout.slice(0, cubes).map((cube, i) => ({ cube, i })).sort((a, b) => a.cube.depth - b.cube.depth)
        .map(({ cube, i }) => <IceCube key={i} uid={`${uid}-${i}`} cube={cube}
          wetClipId={`ice-submerged-${uid}`} dryClipId={`ice-exposed-${uid}`}
          waterlineId={`ice-waterline-${uid}`} {...props} />)}
    </G>
  );
});

function IceCube({ cube, uid, wetClipId, dryClipId, waterlineId, level, hasTea, toppingLayers, teaColor, milkColor }:
  Omit<CupIceProps, 'cubes' | 'seed' | 'glassMaskId'> & {
  cube: typeof ICE_LAYOUT[number];
  uid: string;
  wetClipId: string;
  dryClipId: string;
  waterlineId: string;
}) {
  const { r, angle } = cube;
  const touchesSurface = !cube.submergedDepth;
  const dry = cupIceRestPosition(cube.restX, r, cube.restAngle, cube.restLift + toppingLayers * 10);
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
  const positionProps = useAnimatedProps(() => {
    const { cx, cy, angle: tilt } = position.get();
    const fall = 1 - settled.get();
    return { transform: `translate(${cx},${cy - 10 * fall}) rotate(${tilt - 7 * fall})` };
  }, [position, settled]);
  const shadowProps = useAnimatedProps(() => ({
    cx: dry.contactX, cy: dry.contactY,
    opacity: (1 - position.get().rise) * settled.get() * 0.18,
  }), [position, settled, dry.contactX, dry.contactY]);
  const tint = milkColor ?? teaColor;

  return (
    <G>
      <Defs>
        <AnimatedGroup id={`ice-silhouette-${uid}`} animatedProps={positionProps}>
          <Path d={CUBE_SHAPE} transform={`scale(${r / 24})`} fill="#000000"
            stroke="#000000" strokeWidth={1.6} strokeLinejoin="round" />
        </AnimatedGroup>
        <ClipPath id={`ice-contact-${uid}`}>
          <Use href={`#ice-silhouette-${uid}`} />
        </ClipPath>
        <ClipPath id={`ice-body-${uid}`}>
          <Path d={CUBE_SHAPE} transform={`scale(${r / 24})`} />
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
        <G id={`ice-art-${uid}`}>
          <G transform={`scale(${r / 24})`}>
            <Path d={CUBE_SHAPE} fill={`url(#ice-front-${uid})`} />
            <Path d={TOP_FACE} fill={`url(#ice-top-${uid})`} />
            <Path d={SIDE_FACE} fill={`url(#ice-side-${uid})`} />
          </G>
          <SvgImage href={CUP_ICE} x={-r} y={-r} width={r * 2} height={r * 2}
            opacity={0.2} clipPath={`url(#ice-body-${uid})`} />
          <G transform={`scale(${r / 24})`}>
            <Path d={CUBE_SHAPE} fill="none" stroke="#477E99" strokeWidth={1.6} strokeLinejoin="round" />
            <Path d="M-19-9L8-1L6 20 M8-1L19-10" fill="none" stroke="#F8FEFF"
              strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />
            <Path d="M-18-5L-17 9 M-6-16L4-13" fill="none" stroke="#FFFFFF"
              strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          </G>
        </G>
      </Defs>
      <AnimatedEllipse animatedProps={shadowProps} rx={r * 0.7} ry={1.6} fill="#506576" />
      <G clipPath={`url(#${wetClipId})`}>
        <AnimatedGroup animatedProps={positionProps}>
          <Use href={`#ice-art-${uid}`} opacity={milkColor ? 0.65 : 0.62} />
          {tint && <Path d={CUBE_SHAPE} transform={`scale(${r / 24})`} fill={tint}
            opacity={0.28} />}
        </AnimatedGroup>
      </G>
      <G clipPath={`url(#${dryClipId})`}>
        <AnimatedGroup animatedProps={positionProps}>
          <Use href={`#ice-art-${uid}`} />
        </AnimatedGroup>
      </G>
      {touchesSurface && <G clipPath={`url(#ice-contact-${uid})`}>
        <Use href={`#${waterlineId}`} opacity={0.55} />
      </G>}
    </G>
  );
}
