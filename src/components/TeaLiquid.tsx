import { memo, useEffect, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, DerivedValue, SharedValue, useAnimatedProps, useDerivedValue, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Mask, Path, RadialGradient, Rect, Stop,
} from 'react-native-svg';

import { shade } from './art/Character';
import { DRINK, DRINK_MILKY, DRINK_MILKY_TOP, DRINK_TOP, TEA_TANK } from './art/kitchenArt';
import { CUP_ART, CUP_FLOOR_EDGE, CUP_FLOOR_FRONT, CUP_WELL, cupLiquidPath, cupSurface } from './cupGeometry';
import { pointerEventsStyles } from '../pointerEvents';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedImage = Animated.createAnimatedComponent(SvgImage);
const AnimatedGroup = Animated.createAnimatedComponent(G);

/** Moving liquid settles after the tap closes; the glass and frame never move. */
function useLiquidMotion(pouring: boolean) {
  const phase = useSharedValue(0);
  const agitation = useSharedValue(0);
  useEffect(() => {
    agitation.set(withTiming(pouring ? 1 : 0, { duration: pouring ? 180 : 650 }));
    if (pouring) {
      phase.set(0);
      phase.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1));
    } else cancelAnimation(phase);
    return () => cancelAnimation(phase);
  }, [pouring, phase, agitation]);
  return { phase, agitation };
}

interface LiquidProps {
  width: number;
  height: number;
  color: string;
  teaId: string;
  pouring: boolean;
  /** Cup uses a live fill; tank is a reservoir that remains stocked. */
  level?: SharedValue<number>;
  milkColor?: string;
}

/** Painted tea textures, translucent depth, curved meniscus and ripples inside the original glass. */
export const TeaLiquid = memo(function TeaLiquid({ width, height, color, teaId, pouring, level, milkColor }: LiquidProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tank = !level;
  const vbW = tank ? 971 : CUP_ART.w;
  const vbH = tank ? 1619 : CUP_ART.h;
  const well = tank
    ? 'M108 370 Q485 350 863 370 L863 1115 Q861 1190 485 1190 Q108 1190 108 1115 Z'
    : CUP_WELL;
  const { phase, agitation } = useLiquidMotion(pouring);
  const tint = milkColor ? blend(color, milkColor, 0.6) : color;
  const bodyArt = tank ? undefined : (milkColor ? DRINK_MILKY : DRINK)[teaId];
  const topArt = tank ? undefined : (milkColor ? DRINK_MILKY_TOP : DRINK_TOP)[teaId];
  const visible = useDerivedValue(() => !level || level.get() > 0, [level]);
  const visibilityProps = useAnimatedProps(() => ({ opacity: visible.get() ? 1 : 0 }), [visible]);
  // A shared geometry value keeps every layer subscribed to each animation frame.
  const surface = useDerivedValue(() => {
    'worklet';
    const s = tank ? { y: 545, rx: 377, ry: 48, opacity: 1 } : cupSurface(level!.get());
    // The cup's oval matches the ice and glass footprint exactly; ripples provide its motion.
    return { ...s, y: s.y + (tank ? Math.sin(phase.get() * Math.PI * 2) * agitation.get() * 2 : 0) };
  }, [tank, level, phase, agitation]);
  const bodyProps = useAnimatedProps(() => {
    const s = surface.get();
    return { y: s.y, height: (tank ? 1190 : CUP_FLOOR_FRONT) - s.y, opacity: s.opacity };
  }, [surface, tank]);
  const bodyShapeProps = useAnimatedProps(() => {
    const s = surface.get();
    return { d: cupLiquidPath(s.y, s.rx, s.ry), opacity: s.opacity };
  }, [surface]);
  const surfaceProps = useAnimatedProps(() => {
    const s = surface.get();
    return { cy: s.y, rx: s.rx, ry: s.ry, opacity: s.opacity };
  }, [surface]);
  const textureProps = useAnimatedProps(() => {
    const s = surface.get();
    return { x: vbW / 2 - s.rx, y: s.y - s.ry, width: s.rx * 2, height: s.ry * 2, opacity: s.opacity * 0.7 };
  }, [surface, vbW]);
  const meniscusProps = useAnimatedProps(() => {
    const s = surface.get();
    const cx = vbW / 2;
    return { d: `M${cx - s.rx * 0.91} ${s.y + s.ry * 0.2} A${s.rx * 0.93} ${s.ry * 0.9} 0 0 0 ${cx + s.rx * 0.88} ${s.y + s.ry * 0.34}`,
      opacity: s.opacity * 0.7 };
  }, [surface, vbW]);
  const reflectionProps = useAnimatedProps(() => {
    const s = surface.get();
    const cx = vbW / 2;
    const x = cx - s.rx * 0.78;
    const bottom = tank ? 1150 : CUP_FLOOR_FRONT - 2;
    const start = Math.min(bottom, s.y + s.ry);
    const middle = ((tank ? s.y : start) + bottom) / 2;
    const w = tank ? 48 : 3.5;
    const bend = Math.sin(phase.get() * Math.PI * 2) * agitation.get() * w * 0.5;
    return { d: `M${x} ${start} Q${x + w + bend} ${middle} ${x + w} ${bottom} L${x + w * 1.8} ${bottom} Q${x + w * 2 + bend} ${middle} ${x + w} ${start} Z`,
      opacity: start < bottom ? s.opacity * (tank ? 0.18 : 0.32) : 0 };
  }, [surface, vbW, tank, phase, agitation]);
  const glintProps = useAnimatedProps(() => {
    const s = surface.get();
    return { cx: vbW / 2 - s.rx * 0.34, cy: s.y - s.ry * 0.33, rx: s.rx * 0.32,
      ry: s.ry * 0.19, opacity: s.opacity * (0.3 + agitation.get() * 0.12) };
  }, [surface, vbW, tank, phase, agitation]);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`} style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
      <Defs>
        <ClipPath id={`liquid-well-${uid}`}><Path d={well} /></ClipPath>
        {/* The body's own edge moves with every drop poured, so it is a mask rather than a clip:
            a clip path is baked on its first draw on Android and never changes again. */}
        <Mask id={`liquid-body-${uid}-mask`} maskUnits="userSpaceOnUse" x={0} y={0} width={vbW} height={vbH}>
          {tank ? <AnimatedRect x={0} width={vbW} fill="#FFFFFF" animatedProps={bodyProps} />
            : <AnimatedPath fill="#FFFFFF" animatedProps={bodyShapeProps} />}
        </Mask>
        <LinearGradient id={`liquid-body-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0" stopColor={shade(tint, -40)} />
          <Stop offset="0.18" stopColor={shade(tint, tank ? 10 : 24)} />
          <Stop offset="0.4" stopColor={shade(tint, tank ? -6 : 6)} />
          <Stop offset="0.7" stopColor={tint} />
          <Stop offset="0.9" stopColor={shade(tint, -22)} />
          <Stop offset="1" stopColor={shade(tint, -42)} />
        </LinearGradient>
        <LinearGradient id={`liquid-depth-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor="#FFEAC0" stopOpacity={tank ? 0.04 : 0.12} />
          <Stop offset="0.45" stopColor={tint} stopOpacity="0" />
          <Stop offset="1" stopColor="#351A11" stopOpacity={milkColor ? 0.12 : 0.3} />
        </LinearGradient>
        <LinearGradient id={`liquid-top-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor={shade(tint, -20)} />
          <Stop offset="0.45" stopColor={shade(tint, 30)} />
          <Stop offset="1" stopColor={shade(tint, 8)} />
        </LinearGradient>
        <RadialGradient id={`liquid-light-${uid}`}>
          <Stop offset="0" stopColor="#FFF1BE" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#FFF1BE" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <AnimatedGroup clipPath={`url(#liquid-well-${uid})`} animatedProps={visibilityProps}>
        {tank ? <AnimatedRect x={0} width={vbW} fill={`url(#liquid-body-${uid})`} animatedProps={bodyProps} />
          : <AnimatedPath fill={`url(#liquid-body-${uid})`} animatedProps={bodyShapeProps} />}
        <G mask={`url(#liquid-body-${uid}-mask)`}>
          {bodyArt && <SvgImage href={bodyArt} x={0} y={0}
            width={CUP_ART.w} height={CUP_ART.h} preserveAspectRatio="none" opacity={0.5} />}
          <Ellipse cx={vbW * 0.38} cy={tank ? 1080 : 150} rx={tank ? 230 : 22} ry={tank ? 90 : 12} fill={`url(#liquid-light-${uid})`} />
          <AnimatedRect x={0} width={vbW} fill={`url(#liquid-depth-${uid})`} animatedProps={bodyProps} />
          <AnimatedPath fill="#FFF8DF" animatedProps={reflectionProps} />
          {!tank && <Path d={CUP_FLOOR_EDGE} fill="none"
            stroke={shade(tint, -28)} strokeWidth={0.7} opacity={0.35} />}
        </G>
        <AnimatedEllipse cx={vbW / 2} fill={`url(#liquid-top-${uid})`}
          stroke={shade(tint, -24)} strokeWidth={tank ? 5 : 0.55} animatedProps={surfaceProps} />
        {topArt && <AnimatedImage href={topArt} preserveAspectRatio="none" animatedProps={textureProps} />}
        <AnimatedPath fill="none" stroke="#FFEAC2" strokeWidth={tank ? 6 : 0.7} animatedProps={meniscusProps} />
        <AnimatedEllipse fill="#FFF3DA" animatedProps={glintProps} />
        {[0, 0.5].map((delay) => <SurfaceRipple key={delay} surface={surface} cx={vbW / 2}
          phase={phase} agitation={agitation} delay={delay} tank={tank} />)}
        {[0, 0.33, 0.66].map((delay) => <LiquidBubble key={delay} surface={surface} cx={vbW / 2}
          phase={phase} agitation={agitation} delay={delay} tank={tank} />)}
      </AnimatedGroup>
    </Svg>
  );
});

type Surface = DerivedValue<{ y: number; rx: number; ry: number; opacity: number }>;
interface MotionProps {
  surface: Surface; cx: number; phase: SharedValue<number>; agitation: SharedValue<number>; delay: number; tank: boolean;
}
function SurfaceRipple({ surface, cx, phase, agitation, delay, tank }: MotionProps) {
  const props = useAnimatedProps(() => {
    const s = surface.get();
    const p = (phase.get() + delay) % 1;
    return { cy: s.y, rx: s.rx * (0.08 + p * 0.84), ry: s.ry * (0.08 + p * 0.84),
      opacity: Math.sin(p * Math.PI) * (1 - p) * agitation.get() * s.opacity * 0.75 };
  }, [surface, phase, agitation, delay, tank, cx]);
  return <AnimatedEllipse cx={cx} fill="none" stroke="#FFF1CD" strokeWidth={tank ? 5 : 0.65} animatedProps={props} />;
}
function LiquidBubble({ surface, cx, phase, agitation, delay, tank }: MotionProps) {
  const props = useAnimatedProps(() => {
    const s = surface.get();
    const p = (phase.get() + delay) % 1;
    const unit = tank ? 8 : 1;
    return { cx: cx + Math.sin(delay * 16) * 9 * unit, cy: s.y + s.ry + (1 - p) * 16 * unit,
      r: (0.6 + p * 0.8) * unit, opacity: agitation.get() * Math.sin(p * Math.PI) * s.opacity * 0.5 };
  }, [surface, phase, agitation, delay, tank, cx]);
  return <AnimatedCircle fill="#FFF2CD" fillOpacity={0.25} stroke="#FFF5DC" strokeWidth={tank ? 2 : 0.25} animatedProps={props} />;
}

/** Memoized frame: dragging the cup never rebuilds or animates the tank body. */
export const TankGraphic = memo(function TankGraphic(props: Omit<LiquidProps, 'level' | 'milkColor'>) {
  return (
    <View style={[{ width: props.width, height: props.height }, pointerEventsStyles.none]}>
      <TeaLiquid {...props} />
      <Image source={TEA_TANK} fadeDuration={0} style={{ width: props.width, height: props.height }} />
    </View>
  );
});

function blend(a: string, b: string, amount: number) {
  const channels = [1, 3, 5].map((at) => Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - amount)
    + parseInt(b.slice(at, at + 2), 16) * amount).toString(16).padStart(2, '0'));
  return `#${channels.join('')}`;
}
