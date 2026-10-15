import { memo, useId, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Mask, Path, Stop } from 'react-native-svg';

import { Drink, getIngredient, ICE_LEVELS, Tea } from '../game/ingredients';
import { TeaLiquid } from './TeaLiquid';
import { CupToppings } from './CupToppings';
import { CupIce } from './CupIce';
import { createIceLayout } from './iceLayout';
import { CUP_ART, CUP_FLOOR_FRONT, CUP_FRONT_GLINTS, CUP_ICE_WELL, CUP_REAR_FLOOR_GLASS, CUP_SURFACE_BOTTOM, CUP_SURFACE_RUN, CUP_WELL, cupFillPath, cupSurface } from './cupGeometry';
import { shade } from './art/Character';
import {
  CUP_BASE,
  CUP_DECAL,
  CUP_EDGE,
  CUP_SPRITE,
} from './art/kitchenArt';
import { pointerEventsStyles } from '../pointerEvents';

export { pourLevel } from './cupGeometry';

/**
 * The cup on the prep bench: painted glass with a shaded, animated liquid inside it. Everything the
 * player adds is drawn in the sprite's own coordinate space and clipped to the glass, so nothing
 * ever spills out past the walls, and it all sits below the cat printed on the front.
 */

/** The sprite is drawn in this box; all the geometry below is in the same units. */
const ART = CUP_ART;
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);
/**
 * The cup is clear plastic, so its silhouette is backed rather than filled: see-through enough to
 * show the room behind it, solid enough to be an object. The colour is the cool grey the sprite
 * paints its own plastic, not the cream the silhouette ships as — the kitchen wall is warm and
 * near-white, so a warm backing has nothing to stand against and the cup dissolves into it.
 */
const GLASS = '#DFE6EE';
const GLASS_TINT = 0.45;
/**
 * The inside of the glass, measured from the full cup in tools/sheets/cup-design.png.
 * Keep the liquid inside the wall highlights and above the molded base.
 */
const WELL = CUP_WELL;
export const WELL_TOP = (CUP_SURFACE_BOTTOM - CUP_SURFACE_RUN) / ART.h;
/**
 * The upper edge of the near lip — the first thing on the way down that the glass puts in front of
 * what is behind it. Read off the design at the cup's middle, where the rim bands are plain: the
 * far side of the rolled lip is y 17–20, the mouth's opening y 21–27 (the backdrop shows straight
 * through), and the near lip y 28–31, bright and solid.
 *
 * A pour splits here — in front of the cup above it, behind below — so it has to be the lip's edge
 * and not somewhere inside the lip, and not `WELL_TOP` (y 36), which is the center of the full
 * liquid surface further down.
 */
export const CUP_LIP = 28 / ART.h;
export const WELL_BOTTOM = CUP_SURFACE_BOTTOM / ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;
interface KitchenCupProps {
  drink: Drink;
  iceSeed?: number;
  width: number;
  height: number;
  /** Driven by the station while a tap is held open, so the level rises with the hold. */
  level: SharedValue<number>;
  pouring?: boolean;
}

export const KitchenCup = memo(function KitchenCup({ drink, iceSeed = 1, width, height, level, pouring = false }: KitchenCupProps) {
  const uid = useId().replace(/:/g, '');
  const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
  const ice = ICE_LEVELS.find((option) => option.id === drink.ice);
  // One arrangement, shared by the two sides of the waterline, so they are the same ice.
  const iceLayout = useMemo(() => createIceLayout(iceSeed), [iceSeed]);
  const hasTea = Boolean(tea);

  const filledGlass = useDerivedValue(() => cupFillPath(hasTea ? level.get() : 0), [level, hasTea]);
  // Toppings do not change the cup's glass. Only actual liquid changes its front reflections.
  const softGlassProps = useAnimatedProps(() => ({ d: filledGlass.get() || 'M0 0Z' }), [filledGlass]);
  const clearGlassProps = useAnimatedProps(() => ({
    d: `M0 0H${ART.w}V${ART.h}H0Z ${filledGlass.get()}`,
  }), [filledGlass]);

  const foamProps = useAnimatedProps(() => {
    const surface = cupSurface(level.get());
    return { cy: surface.y - 0.2, rx: surface.rx - 0.5 };
  }, [level]);
  const foamGlintProps = useAnimatedProps(() => ({ cy: cupSurface(level.get()).y - 1.1 }), [level]);

  return (
    <View style={{ width, height }}>
      <Image
        source={CUP_BASE}
        tintColor={GLASS}
        style={[styles.layer, { width, height, opacity: GLASS_TINT }]}
      />
      {tea && <TeaLiquid width={width} height={height} color={tea.color} teaId={tea.id}
        milkColor={milk?.color} level={level} pouring={pouring} />}

      {/* ice and toppings live in the drink, never outside the glass */}
      <Svg style={[StyleSheet.absoluteFill, pointerEventsStyles.none]} width={width} height={height} viewBox={`0 0 ${ART.w} ${ART.h}`}>
        <Defs>
          <ClipPath id={`wellp-${uid}`}>
            <Path d={WELL} />
          </ClipPath>
          <ClipPath id={`ice-well-${uid}`}>
            <Path d={CUP_ICE_WELL} />
          </ClipPath>
          {/* Where the painted glass reads through the tea and where it reads clear both follow the
              live surface, so they are masks: a clip path never moves again after its first draw on
              a phone. The cup's fixed boundaries below stay clips. */}
          <Mask id={`glass-filled-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={ART.w} height={ART.h}>
            <AnimatedPath fill="#FFFFFF" animatedProps={softGlassProps} />
          </Mask>
          <Mask id={`glass-clear-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={ART.w} height={ART.h}>
            <AnimatedPath fill="#FFFFFF" fillRule="evenodd" animatedProps={clearGlassProps} />
          </Mask>
          <ClipPath id={`glass-rear-floor-${uid}`}>
            <Path d={CUP_REAR_FLOOR_GLASS} />
          </ClipPath>
          <ClipPath id={`glass-front-wall-${uid}`}>
            <Path d={`M0 0H${ART.w}V${ART.h}H0Z ${CUP_REAR_FLOOR_GLASS}`} clipRule="evenodd" fillRule="evenodd" />
          </ClipPath>
          <LinearGradient id={`glass-shine-fade-${uid}`} x1={0} y1={132} x2={0} y2={CUP_FLOOR_FRONT} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity={0.32} />
            <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <Mask id={`glass-front-glints-${uid}`} x={0} y={0} width={ART.w} height={ART.h} maskUnits="userSpaceOnUse">
            <Path d={CUP_FRONT_GLINTS} fill={`url(#glass-shine-fade-${uid})`} />
          </Mask>
        </Defs>
        <G clipPath={`url(#glass-rear-floor-${uid})`}>
          <GlassPainting uid={uid} />
        </G>
        <G clipPath={`url(#wellp-${uid})`}>
          <CupToppings ids={drink.toppings} liquidShape={filledGlass}
            teaColor={tea?.color} milkColor={milk?.color} />
        </G>
        <G clipPath={`url(#ice-well-${uid})`}>
          {ice && <CupIce cubes={ice.cubes} layout={iceLayout} layer="submerged" level={level}
            hasTea={hasTea} toppingLayers={drink.toppings.length}
            teaColor={tea?.color} milkColor={milk?.color} />}
        </G>
        <G clipPath={`url(#wellp-${uid})`}>
          {foam && (
            <>
              <AnimatedEllipse cx={56.5} ry={4.4} fill={foam.color} stroke={shade(foam.color, -16)}
                strokeWidth={0.9} animatedProps={foamProps} />
              <AnimatedEllipse cx={47} rx={15} ry={2} fill="#FFFFFF" opacity={0.5} animatedProps={foamGlintProps} />
            </>
          )}
        </G>
        <G clipPath={`url(#glass-front-wall-${uid})`}>
          <GlassPainting uid={uid} />
        </G>
        {/* The crowns standing out of the tea are drawn over the painted plastic rather than
            punched out of it: a mask built from the ice could not be read on a phone. */}
        <G clipPath={`url(#ice-well-${uid})`}>
          {ice && <CupIce cubes={ice.cubes} layout={iceLayout} layer="exposed" level={level}
            hasTea={hasTea} toppingLayers={drink.toppings.length}
            teaColor={tea?.color} milkColor={milk?.color} />}
        </G>
        <SvgImage href={CUP_SPRITE} x={0} y={0} width={ART.w} height={ART.h}
          mask={`url(#glass-front-glints-${uid})`} />
      </Svg>

      <Image source={CUP_EDGE} style={[styles.layer, { width, height }]} />
      {/* The cat is printed on the front of the glass, so it goes over the drink. */}
      <Image source={CUP_DECAL} style={[styles.layer, { width, height }]} />
    </View>
  );
});

/** The same painted glass and liquid-opacity rule are used on both sides of the contents. */
const GlassPainting = memo(function GlassPainting({ uid }: { uid: string }) {
  return (
    <>
      <SvgImage href={CUP_SPRITE} x={0} y={0} width={ART.w} height={ART.h}
        mask={`url(#glass-clear-${uid})`} />
      <SvgImage href={CUP_SPRITE} x={0} y={0} width={ART.w} height={ART.h}
        mask={`url(#glass-filled-${uid})`} opacity={0.22} />
    </>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
