import { useEffect, useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  Image as SvgImage,
  Path,
} from 'react-native-svg';

import { Drink, getIngredient, ICE_LEVELS, MIN_FILL, Tea } from '../game/ingredients';
import { DURATION, timing } from '../motion';
import { shade } from './art/Character';
import {
  CUP_BASE,
  CUP_DECAL,
  CUP_EDGE,
  CUP_SPRITE,
  DRINK,
  DRINK_MILKY,
  DRINK_MILKY_TOP,
  DRINK_TOP,
  PIECE,
  PIECE_ART,
} from './art/kitchenArt';

/**
 * The cup on the prep bench: the painted sprite with the drink poured *inside* it. Everything the
 * player adds is drawn in the sprite's own coordinate space and clipped to the glass, so nothing
 * ever spills out past the walls, and it all sits below the cat printed on the front.
 */

/** The sprite is drawn in this box; all the geometry below is in the same units. */
const ART = { w: 113, h: 174 };
/**
 * The cup is clear plastic, so its silhouette is backed rather than filled: see-through enough to
 * show the room behind it, solid enough to be an object. The colour is the cool grey the sprite
 * paints its own plastic, not the cream the silhouette ships as — the kitchen wall is warm and
 * near-white, so a warm backing has nothing to stand against and the cup dissolves into it.
 */
const GLASS = '#DFE6EE';
const GLASS_TINT = 0.45;
/**
 * The inside of the glass, traced off the full cup on  — where the
 * liquid stands there *is* the well, so none of this is guessed.
 */
const WELL = 'M14 48 L22 156 Q24 163 37 163 H73 Q87 163 89 156 L99 48 Z';
export const WELL_TOP = 48 / ART.h;
/**
 * The upper edge of the near lip — the first thing on the way down that the glass puts in front of
 * what is behind it. Read off the design at the cup's middle, where the rim bands are plain: the
 * far side of the rolled lip is y 17–20, the mouth's opening y 21–27 (the backdrop shows straight
 * through), and the near lip y 28–31, bright and solid.
 *
 * A pour splits here — in front of the cup above it, behind below — so it has to be the lip's edge
 * and not somewhere inside the lip, and not `WELL_TOP` (y 48), which is where the liquid sits and
 * is a good 20 further down.
 */
export const CUP_LIP = 28 / ART.h;
export const WELL_BOTTOM = 162 / ART.h;
export const WELL_RUN = WELL_BOTTOM - WELL_TOP;
/** The foot of the well and how deep it runs, for the pour guide drawn on the glass. */
const WELL_Y = 162;
const WELL_DEPTH = 114;
/**
 * The oval surface sprite: a whole ellipse, so it reaches below the line where the liquid meets
 * the glass as well as above it — `DRINK_RISE` above, `DRINK_DROP` below. The sprite is cut to the
 * ellipse and fades out as it closes, so its lower half melts into the body behind it rather than
 * ending on a rim, and it stays inside the glass even down in the foot.
 */
const DRINK_RISE = 10;
const DRINK_DROP = 12;
/**
 * A pour never shows less than this. The surface carries twelve rows of ellipse below the line, and
 * the glass has nothing like that much room left once the level is in the foot, so the first drop
 * shows as a shallow pool rather than a sliver with its underside hanging out of the glass.
 *
 * It is eased in rather than clamped. Clamped, the drink snapped to a tenth and then stood still
 * for the ~180ms it takes to actually pour that much, which reads as the tap stalling before it
 * gets going. Instead the first `POUR_EASE` of the level is squeezed into the room above the floor,
 * so the drink moves from the instant the tap opens and is honest again from there up.
 */
const MIN_POUR = 0.1;
const POUR_EASE = 0.3;
export function pourLevel(raw: number) {
  'worklet';
  if (raw >= POUR_EASE) return raw;
  return MIN_POUR + (raw / POUR_EASE) * (POUR_EASE - MIN_POUR);
}
/** WELL's straight run, for working out how wide the glass is at the surface. */
const WELL_TOP_Y = 48;
const WELL_KNEE_Y = 156;
const WELL_TOP_L = 14;
const WELL_TOP_W = 86;
const WELL_KNEE_L = 22;
const WELL_KNEE_W = 67;

/**
 * How deep the cup's mouth looks for how wide it is. The surface sprite is 85 across and reads
 * about 11 either side of the line it stands on, so anything printed round the glass at a level —
 * the "đủ" line — is an ellipse of these proportions, not a bar.
 */
const CUP_ROUND = 11 / 42.5;
/** The "đủ" line's own ring: where it sits, and how wide the glass is there. */
const MIN_FILL_Y = WELL_Y - MIN_FILL * WELL_DEPTH;
const MIN_FILL_T = (MIN_FILL_Y - WELL_TOP_Y) / (WELL_KNEE_Y - WELL_TOP_Y);
const MIN_FILL_RX = (WELL_TOP_W + (WELL_KNEE_W - WELL_TOP_W) * MIN_FILL_T) / 2;
const MIN_FILL_CX = WELL_TOP_L + (WELL_KNEE_L - WELL_TOP_L) * MIN_FILL_T + MIN_FILL_RX;
const MIN_FILL_RY = MIN_FILL_RX * CUP_ROUND;
/**
 * The ring in halves, because they are not at the same distance: the near one is printed on the
 * glass between you and the drink, the far one is the same ink across the cup from you. They meet
 * at the ring's widest points, where the glass turns away. Both arcs run left to right, so their
 * dashes stay in step.
 */
const MIN_FILL_FAR = `M${MIN_FILL_CX - MIN_FILL_RX} ${MIN_FILL_Y} A${MIN_FILL_RX} ${MIN_FILL_RY} 0 0 1 ${MIN_FILL_CX + MIN_FILL_RX} ${MIN_FILL_Y}`;
const MIN_FILL_NEAR = `M${MIN_FILL_CX - MIN_FILL_RX} ${MIN_FILL_Y} A${MIN_FILL_RX} ${MIN_FILL_RY} 0 0 0 ${MIN_FILL_CX + MIN_FILL_RX} ${MIN_FILL_Y}`;
const GUIDE = '#E5534B';
/**
 * How far past the line the tea has to rise for the far half to go soft. Empty glass is clear, so
 * the far half is as sharp as the near one until there is tea between them — then it is being read
 * through the drink, and it blurs. The near half never does: it is on this side of everything.
 */
const MIN_FILL_BAND = 0.05;
function submerged(raw: number) {
  'worklet';
  const filled = pourLevel(Math.max(0, Math.min(1, raw)));
  return Math.max(0, Math.min(1, (filled - MIN_FILL) / MIN_FILL_BAND));
}

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

  // The drink is revealed from the bottom as it fills; the sprite is already cut to the glass, so
  // the window is a plain rectangle run up from the cup's foot. The rows below the tea's own last
  // one are empty in the sprite, which is why the window can start there rather than at the well's
  // floor without showing anything.
  const reveal = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, level.get()));
    return { height: raw <= 0 ? 0 : padBottom + pourLevel(raw) * runPx };
  });
  const milky = useAnimatedStyle(() => ({ opacity: milkiness.get() }));
  // The oval surface stands on that line, stretched to however wide the glass is there.
  const surfaceStyle = useAnimatedStyle(() => {
    const raw = Math.max(0, Math.min(1, level.get()));
    const filled = pourLevel(raw);
    const acrossWell = (WELL_Y - filled * WELL_DEPTH - WELL_TOP_Y) / (WELL_KNEE_Y - WELL_TOP_Y);
    return {
      opacity: raw <= 0 ? 0 : 1,
      bottom: padBottom + filled * runPx - DRINK_DROP * scale,
      left: (WELL_TOP_L + (WELL_KNEE_L - WELL_TOP_L) * acrossWell) * scale,
      width: (WELL_TOP_W + (WELL_KNEE_W - WELL_TOP_W) * acrossWell) * scale,
      height: (DRINK_RISE + DRINK_DROP) * scale,
    };
  });
  const foamStyle = useAnimatedStyle(() => ({
    bottom: padBottom + pourLevel(Math.max(0, Math.min(1, level.get()))) * runPx - 4 * scale,
  }));
  // How much tea stands between you and the far half of the "đủ" ring.
  const dryGuide = useAnimatedStyle(() => ({ opacity: 1 - submerged(level.get()) }));
  const wetGuide = useAnimatedStyle(() => ({ opacity: submerged(level.get()) }));

  return (
    <View style={{ width, height }}>
      <Image
        source={CUP_BASE}
        tintColor={GLASS}
        style={[styles.layer, { width, height, opacity: GLASS_TINT }]}
      />
      {/* The empty cup, which the drink is laid over rather than drawn behind: the drink sprite is
          the design's *full* cup, glass and all, so wherever it covers it simply is the design. */}
      <Image source={CUP_SPRITE} style={[styles.layer, { width, height }]} />

      {/* The drink: the sheet's own, revealed to the level. */}
      {tea && (
        <>
          <Animated.View style={[styles.reveal, { bottom: 0 }, reveal]}>
            <View style={{ position: 'absolute', bottom: 0, width, height }}>
              <Image source={DRINK[drink.tea as string]} style={{ width, height }} />
              {/* milk turns the whole drink creamy as it goes in */}
              {milk && (
                <Animated.View style={[styles.layer, { width, height }, milky]}>
                  <Image source={DRINK_MILKY[drink.tea as string]} style={{ width, height }} />
                </Animated.View>
              )}
            </View>
          </Animated.View>
          <Animated.View style={[styles.surface, surfaceStyle]} pointerEvents="none">
            <Image source={DRINK_TOP[drink.tea as string]} style={styles.fill} resizeMode="stretch" />
            {milk && (
              <Animated.View style={[styles.layer, styles.fill, milky]}>
                <Image source={DRINK_MILKY_TOP[drink.tea as string]} style={styles.fill} resizeMode="stretch" />
              </Animated.View>
            )}
          </Animated.View>
        </>
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

          {/* The one pour guide: the "đủ" line, a dashed ring printed round the glass. It is an
              ellipse rather than a bar because that is what a level looks like on a cup seen from
              here — pour to it and the drink's own surface sits straight on it. The glass stays
              clear otherwise: a wash of colour over it reads as a tinted cup rather than the clear
              one the sprite paints. */}
          <Path
            d={MIN_FILL_NEAR}
            fill="none"
            stroke={GUIDE}
            strokeWidth={1.2}
            strokeDasharray="4 3"
            opacity={0.85}
          />
        </G>
      </Svg>

      {/* The far half, in two copies crossfaded by how far the tea is over the line. They are their
          own layers because that fade is driven by the level, and a view style is the one way of
          moving something here that has held up — see CLAUDE.md on the drink. */}
      <Animated.View style={[styles.layer, { width, height }, dryGuide]} pointerEvents="none">
        <FarGuide uid={`${uid}d`} width={width} height={height} />
      </Animated.View>
      <Animated.View style={[styles.layer, { width, height }, wetGuide]} pointerEvents="none">
        <FarGuide uid={`${uid}w`} width={width} height={height} blurred />
      </Animated.View>

      {foam && (
        <Animated.View style={[styles.foam, { height: 9 * scale }, foamStyle]} pointerEvents="none">
          <Svg width={width} height={9 * scale} viewBox="0 0 113 9">
            <Ellipse cx={56.5} cy={4.8} rx={41} ry={4.4} fill={foam.color} stroke={shade(foam.color, -16)} strokeWidth={0.9} />
            <Ellipse cx={47} cy={3.9} rx={15} ry={2} fill="#FFFFFF" opacity={0.5} />
          </Svg>
        </Animated.View>
      )}

      {/* and the glass's own linework, so the drink cannot eat into the outline */}
      <Image source={CUP_EDGE} style={[styles.layer, { width, height }]} />
      {/* The cat is printed on the front of the glass, so it goes over the drink. */}
      <Image source={CUP_DECAL} style={[styles.layer, { width, height }]} />
    </View>
  );
}

/** The far half of the "đủ" ring, sharp or softened, clipped to the glass like everything else. */
function FarGuide({
  uid,
  width,
  height,
  blurred = false,
}: {
  uid: string;
  width: number;
  height: number;
  blurred?: boolean;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ART.w} ${ART.h}`}>
      <Defs>
        <ClipPath id={`fw-${uid}`}>
          <Path d={WELL} />
        </ClipPath>
        {/* A generous filter region. The default is the arc's own box plus a tenth, which for a
            line this thin crops the blur off square at both ends. */}
        <Filter id={`fb-${uid}`} x="-15%" y="-120%" width="130%" height="340%">
          <FeGaussianBlur stdDeviation="1.1" />
        </Filter>
      </Defs>
      <G clipPath={`url(#fw-${uid})`}>
        <Path
          d={MIN_FILL_FAR}
          fill="none"
          stroke={GUIDE}
          strokeWidth={blurred ? 1.1 : 1.2}
          strokeDasharray="4 3"
          opacity={blurred ? 0.42 : 0.7}
          filter={blurred ? `url(#fb-${uid})` : undefined}
        />
      </G>
    </Svg>
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
  surface: {
    position: 'absolute',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  foam: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
