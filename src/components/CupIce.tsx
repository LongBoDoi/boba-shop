import { memo, useEffect, useId, useMemo } from 'react';
import Animated, { cancelAnimation, DerivedValue, SharedValue, useAnimatedProps, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Mask, Path, Stop } from 'react-native-svg';

import { CUP_ICE } from './art/kitchenArt';
import { CUP_ART, cupIceFillPath, cupIceOutlinePath, cupIcePosition, cupIceRestPosition, cupSurface } from './cupGeometry';
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

/** How much of the drink's colour a cube under the tea takes. See `fade` in `CupIce`. */
const TINT = 0.28;

/**
 * Which side of the waterline this is drawing. Ice is drawn twice, from either side of the cup's
 * painted front wall: what is under the tea keeps the glass wash over it, and the crowns standing
 * out of the tea are drawn over that wall, crisp. The cup decides where the wall goes — see
 * `KitchenCup` — which is why this takes the side rather than punching the wall out with a mask.
 */
export type IceLayer = 'submerged' | 'exposed';

/** One cube's live pose, as `cupIcePosition` reports it. */
type IcePose = ReturnType<typeof cupIcePosition>;

export interface IcePlacements {
  /** Where each cube of the layout rests on the dry bed, by its own index in that layout. */
  dry: ReturnType<typeof cupIceRestPosition>[];
  /** Where each cube is *now*, by the same index — the whole tray of them, in one worklet. */
  poses: DerivedValue<IcePose[]>;
}

/**
 * Fit every cube in the layout to the live tea, once per frame.
 *
 * This used to be a `useDerivedValue` inside each cube, and each cube appears four times over: it
 * is drawn on both sides of the waterline, it has a contact shadow, and it has a meniscus. So a
 * full cup ran `cupIcePosition` — an eighteen-point fit of the painted outline against the tapered
 * glass, with its own trigonometry — forty-eight times on every frame of a pour, for twelve
 * answers. They all read the same level, so the fit is done once here and handed out by index.
 *
 * It fits the whole layout rather than the cubes currently in the cup, so an index means the same
 * thing however many scoops have gone in: a cube that mounts with the second scoop cannot find
 * itself off the end of an array that has not caught up with it yet.
 */
export function useIcePlacements(layout: IcePlacement[], level: SharedValue<number>, hasTea: boolean,
  toppingLayers: number): IcePlacements {
  const dry = useMemo(
    () => layout.map((cube) => cupIceRestPosition(cube.restX, cube.r, cube.restAngle,
      cube.restLift + toppingLayers * 10)),
    [layout, toppingLayers],
  );
  const poses = useDerivedValue(() => {
    // Always read the live level, including while the empty cup is waiting for its first tea.
    const raw = hasTea ? level.get() : 0;
    return layout.map((cube, i) => cupIcePosition(raw, cube.x, cube.r, cube.angle, cube.depth,
      dry[i].cx, dry[i].cy, cube.restAngle, cube.submergedDepth ?? 0, cube.immersion ?? 0.42));
  }, [layout, dry, level, hasTea]);
  // Kept the same object between renders: it is a prop of the memoized `CupIce`, and a fresh one
  // re-rendered both trays of ice — every cube, twice — whenever anything at all went into the cup.
  return useMemo(() => ({ dry, poses }), [dry, poses]);
}

interface CupIceProps {
  cubes: number;
  /** The whole layout, so an index is stable; `cubes` says how many of it are in the cup. */
  layout: IcePlacement[];
  /** Shared by both layers, so the two sides of the waterline are the same ice. */
  placements: IcePlacements;
  layer: IceLayer;
  level: SharedValue<number>;
  hasTea: boolean;
  teaColor?: string;
  milkColor?: string;
}

/**
 * Frosted ice resting on the dry ingredient bed, then floating with the live tea surface.
 *
 * **Everything here has to draw on a phone, not only in a browser**, and react-native-svg is not a
 * browser. Its gaps shape this file:
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
 * - **A clip path is drawn once and then frozen.** Android builds a `ClipPath`'s geometry the first
 *   time it is used and caches it, and nothing inside one can clear that cache — a `Path` in a
 *   `ClipPath` is never itself drawn, and the renderer skips the invalidation for anything that has
 *   not been drawn. So the waterline here is a `Mask`: a mask's contents *are* drawn, every frame,
 *   which is what makes an animated `d` inside one arrive. Fixed shapes stay clips, which are
 *   cheaper.
 * - **A mask and a faded group are both expensive, so there is one of each.** See "What a group
 *   costs" in CLAUDE.md: every masked element buys four canvas-sized offscreen layers and draws
 *   its mask twice, and every `<G>` whose opacity is not 1 allocates and throws away a bitmap the
 *   size of the canvas on each draw. Both used to be per cube.
 */
export const CupIce = memo(function CupIce({ cubes, layout, placements, layer, level, hasTea,
  teaColor, milkColor }: CupIceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const submerged = layer === 'submerged';
  const { dry, poses } = placements;
  // The tea's rear arc stays behind the ice; every cube shares its near-side water boundary.
  const liquidShape = useDerivedValue(() => {
    const raw = level.get();
    return cupIceFillPath(hasTea ? raw : 0);
  }, [level, hasTea]);
  const waterProps = useAnimatedProps(() => {
    const shape = liquidShape.get();
    return { d: submerged ? shape || 'M0 0Z' : `${BOX} ${shape}` };
  }, [liquidShape, submerged]);
  /** The tea's own near arc, which anchors a cube breaking the surface to the drink. */
  const waterlineProps = useAnimatedProps(() => {
    const surface = cupSurface(hasTea ? level.get() : 0);
    return {
      d: `M${56.5 - surface.rx} ${surface.y} A${surface.rx} ${surface.ry} 0 0 0 ${56.5 + surface.rx} ${surface.y}`,
      opacity: surface.opacity * 0.55,
    };
  }, [hasTea, level]);

  // Back to front, so the cubes nearer the viewer overlap the ones behind them. `at` is the cube's
  // index in the whole layout, which is how it finds its own pose.
  const standing = useMemo(
    () => layout.slice(0, cubes).map((cube, at) => ({ cube, at })).sort((a, b) => a.cube.depth - b.cube.depth),
    [layout, cubes],
  );
  const surfacing = standing.filter(({ cube }) => !cube.submergedDepth);
  /**
   * Under the tea the whole tray of ice is softened at once, and takes a wash of the drink's
   * colour — rather than a cube at a time, which was a faded group per cube and so a canvas-sized
   * bitmap per cube on every frame.
   *
   * Fading the tray as one lands in the same colour only if the wash is folded into the same
   * group, and at the right strength. `TINT` over a cube softened to `s` over the room is
   * `TINT·t + (1-TINT)·s·c + (1-TINT)(1-s)·b`; a group at `fade` holding the cube and a wash at
   * `wash` is `fade·wash·t + fade(1-wash)·c + (1-fade)·b`. Matching the room's share gives the
   * `fade` below, and the wash is what is left of `TINT` inside it.
   *
   * What this cannot reproduce is one cube showing through another: inside the group they stack
   * opaquely and are faded once, where before each was faded and then stacked. `createIceLayout`
   * samples them with a gap wider than their own radius, so there is very little of that.
   */
  const tint = submerged ? milkColor ?? teaColor : undefined;
  const soften = submerged ? (milkColor ? 0.65 : 0.62) : 1;
  const fade = tint ? 1 - (1 - TINT) * (1 - soften) : soften;

  return (
    <G>
      <Defs>
        <Mask id={`ice-water-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={CUP_ART.w} height={CUP_ART.h}>
          <AnimatedPath fill="#FFFFFF" fillRule="evenodd" animatedProps={waterProps} />
        </Mask>
        {/* One cube's shape, in the 48-unit box every cube is drawn in before it is scaled.
            This one never moves — it is in the cube's own space — so it stays a clip. */}
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
      {submerged && standing.map(({ cube, at }) => (
        <IceShadow key={at} at={at} r={cube.r} dry={dry[at]} poses={poses} />
      ))}
      <G mask={`url(#ice-water-${uid})`} opacity={fade}>
        {standing.map(({ cube, at }) => (
          <IceCube key={at} at={at} r={cube.r} uid={uid} poses={poses}
            tint={tint} wash={TINT / fade} />
        ))}
      </G>
      {/* Every cube that breaks the surface is anchored to it by the same arc, drawn through one
          mask holding all of their outlines. */}
      {!submerged && surfacing.length > 0 && (
        <G>
          <Defs>
            <Mask id={`ice-edges-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={CUP_ART.w} height={CUP_ART.h}>
              {surfacing.map(({ cube, at }) => (
                <IceEdge key={at} at={at} r={cube.r} poses={poses} />
              ))}
            </Mask>
          </Defs>
          <G mask={`url(#ice-edges-${uid})`}>
            <AnimatedPath animatedProps={waterlineProps} fill="none" stroke={teaColor ?? '#769FAC'} strokeWidth={0.8} />
          </G>
        </G>
      )}
    </G>
  );
});

/** A cube drops the last few pixels into place as it is added, each on its own clock. */
function useSettle() {
  const settled = useSharedValue(0);
  useEffect(() => {
    settled.set(withTiming(1, timing(DURATION.base)));
    return () => cancelAnimation(settled);
  }, [settled]);
  return settled;
}

/** Off the side of the sprite box, for the frame a cube mounts on before the fit includes it. */
const AWAY: IcePose = { cx: -999, cy: -999, angle: 0, waterY: 0, floating: false, rise: 0 };

interface CubeProps {
  /** The cube's index in the whole layout, which is how it reads its own pose. */
  at: number;
  r: number;
  poses: DerivedValue<IcePose[]>;
}

function IceCube({ at, r, uid, poses, tint, wash }: CubeProps & {
  uid: string;
  /** The drink's colour, when this is the cube under the tea. */
  tint?: string;
  /** That colour's strength *inside* the group the whole tray is faded by. See `fade` above. */
  wash: number;
}) {
  const settled = useSettle();
  const placement = useAnimatedProps(() => {
    const { cx, cy, angle: tilt } = poses.get()[at] ?? AWAY;
    const fall = 1 - settled.get();
    return {
      transform: [
        { translateX: cx },
        { translateY: cy - 10 * fall },
        { rotate: `${tilt - 7 * fall}deg` },
      ],
    };
  }, [poses, at, settled]);
  const scale = `scale(${r / 24})`;

  return (
    <AnimatedGroup animatedProps={placement}>
      <G transform={scale}>
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
      {/* Under the tea the body takes the drink's colour, at the strength that comes out at `TINT`
          once the group around the whole tray has been faded. */}
      {tint && <Path d={CUBE_SHAPE} transform={scale} fill={tint} opacity={wash} />}
    </AnimatedGroup>
  );
}

function IceShadow({ at, r, dry, poses }: CubeProps & { dry: ReturnType<typeof cupIceRestPosition> }) {
  const settled = useSettle();
  const fade = useAnimatedProps(() => ({
    opacity: (1 - (poses.get()[at] ?? AWAY).rise) * settled.get() * 0.18,
  }), [poses, at, settled]);
  return (
    <AnimatedEllipse animatedProps={fade} cx={dry.contactX} cy={dry.contactY}
      rx={r * 0.7} ry={1.6} fill="#506576" />
  );
}

/** One surfacing cube's silhouette, inside the mask the waterline is drawn through. */
function IceEdge({ at, r, poses }: CubeProps) {
  const settled = useSettle();
  const outline = useAnimatedProps(() => {
    const { cx, cy, angle } = poses.get()[at] ?? AWAY;
    const fall = 1 - settled.get();
    return { d: cupIceOutlinePath(cx, cy - 10 * fall, angle - 7 * fall, r) };
  }, [poses, at, settled, r]);
  return <AnimatedPath fill="#FFFFFF" animatedProps={outline} />;
}
