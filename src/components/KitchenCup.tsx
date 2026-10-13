import { memo, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Image as SvgImage, Path } from 'react-native-svg';

import { Drink, getIngredient, ICE_LEVELS, Tea } from '../game/ingredients';
import { TeaLiquid } from './TeaLiquid';
import { CUP_SURFACE_BOTTOM, CUP_SURFACE_RUN, CUP_WELL, cupSurface } from './cupGeometry';
import { shade } from './art/Character';
import {
  CUP_BASE,
  CUP_DECAL,
  CUP_EDGE,
  CUP_SPRITE,
  PIECE,
  PIECE_ART,
} from './art/kitchenArt';
import { pointerEventsStyles } from '../pointerEvents';

export { pourLevel } from './cupGeometry';

/**
 * The cup on the prep bench: painted glass with a shaded, animated liquid inside it. Everything the
 * player adds is drawn in the sprite's own coordinate space and clipped to the glass, so nothing
 * ever spills out past the walls, and it all sits below the cat printed on the front.
 */

/** The sprite is drawn in this box; all the geometry below is in the same units. */
const ART = { w: 113, h: 174 };
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
 * and not somewhere inside the lip, and not `WELL_TOP` (y 48), which is the center of the full
 * liquid surface further down.
 */
export const CUP_LIP = 28 / ART.h;
export const WELL_BOTTOM = CUP_SURFACE_BOTTOM / ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;
/** Where the ice floats and where the toppings pile up, in sprite units. */
const ICE_SPOTS = [
  { x: 29, y: 112, r: 15 },
  { x: 67, y: 104, r: 13 },
  { x: 48, y: 131, r: 13 },
  { x: 80, y: 128, r: 12 },
];
const PILE = [
  { x: 29, y: 155 },
  { x: 45, y: 157 },
  { x: 61, y: 157 },
  { x: 78, y: 155 },
  { x: 37, y: 144 },
  { x: 54, y: 146 },
  { x: 70, y: 144 },
  { x: 45, y: 134 },
  { x: 61, y: 134 },
];
const PIECE_R = 9;

interface KitchenCupProps {
  drink: Drink;
  width: number;
  height: number;
  /** Driven by the station while a tap is held open, so the level rises with the hold. */
  level: SharedValue<number>;
  pouring?: boolean;
}

export const KitchenCup = memo(function KitchenCup({ drink, width, height, level, pouring = false }: KitchenCupProps) {
  const uid = useId().replace(/:/g, '');
  const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
  const ice = ICE_LEVELS.find((option) => option.id === drink.ice);
  const hasTea = Boolean(tea);

  // Preserve the original glass above the fill and around the rim/base. Only the
  // glass in front of the tea needs softer reflections to avoid bleaching its colour.
  const filledGlass = useDerivedValue(() => {
    const raw = level.get();
    if (!hasTea || raw <= 0) return '';
    const { y, rx, ry } = cupSurface(raw);
    return `M${ART.w / 2 - rx} ${y} A${rx} ${ry} 0 0 1 ${ART.w / 2 + rx} ${y} L90 153 A33.5 7.8725 0 0 1 23 153 Z`;
  }, [level, hasTea]);
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
          <ClipPath id={`glass-filled-${uid}`}>
            <AnimatedPath animatedProps={softGlassProps} />
          </ClipPath>
          <ClipPath id={`glass-clear-${uid}`}>
            <AnimatedPath clipRule="evenodd" fillRule="evenodd" animatedProps={clearGlassProps} />
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

          {foam && (
            <>
              <AnimatedEllipse cx={56.5} ry={4.4} fill={foam.color} stroke={shade(foam.color, -16)}
                strokeWidth={0.9} animatedProps={foamProps} />
              <AnimatedEllipse cx={47} rx={15} ry={2} fill="#FFFFFF" opacity={0.5} animatedProps={foamGlintProps} />
            </>
          )}
        </G>
        {/* Both glass layers stay in front of all ingredients; the tea retains its rich colour. */}
        <SvgImage href={CUP_SPRITE} x={0} y={0} width={ART.w} height={ART.h}
          clipPath={`url(#glass-clear-${uid})`} />
        <SvgImage href={CUP_SPRITE} x={0} y={0} width={ART.w} height={ART.h}
          clipPath={`url(#glass-filled-${uid})`} opacity={0.22} />
      </Svg>

      <Image source={CUP_EDGE} style={[styles.layer, { width, height }]} />
      {/* The cat is printed on the front of the glass, so it goes over the drink. */}
      <Image source={CUP_DECAL} style={[styles.layer, { width, height }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
