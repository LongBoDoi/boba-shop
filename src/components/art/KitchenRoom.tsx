import { memo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import {
  ART,
  BAR_DECK,
  BAR_FRONT,
  BAR_SPLASH,
  CABINET,
  DRAWER,
  COASTER,
  CUP_STACK,
  LAMP,
  PLANT,
  POSTER,
  RAIL_BAR,
  RAIL_CAP,
  SHELF_FOOT,
  PLANK_TOP,
  SHELF_PLANK,
  TABLE_PROPS,
  TOWEL,
  WALL,
} from './kitchenArt';

/** Warm tones the hand-drawn bits borrow so they sit with the painted ones. */
export const SHOP = {
  wall: '#FBF2E7',
  wood: '#E9B87E',
  woodTop: '#F7D7A9',
  woodEdge: '#C9924F',
  woodDark: '#9C6836',
  plaque: '#F7DCAE',
  steel: '#E7EDF1',
  steelTop: '#F8FBFC',
  steelEdge: '#B3BDC5',
  steelDeep: '#8F9AA2',
  pink: '#F79DB7',
  pinkDark: '#E87FA0',
  pinkLine: '#D4648A',
  pinkGrip: '#F2607F',
  glass: '#EDF4F5',
  handle: '#3E3A38',
  ink: '#5C5660',
  inkSoft: '#8A8290',
};

/**
 * Where on the coaster sprite the cup's base belongs. Its top face is an ellipse centred about
 * 0.39 down, but a cup standing dead centre reads as pushed to the back of the disc, so it sits a
 * little forward of that.
 */
const COASTER_FACE = 0.52;

/**
 * Where the design's cluster of props touches the table — the straw tin's base and the
 * chalkboard's feet — as fractions of the sprite, so each stands in a pool of its own rather
 * than the pair sharing one long smear.
 */
/** The run along the floor: a single unit at each end with a double between them. */
const FLOOR = [
  { src: DRAWER, aspect: ART.drawer },
  { src: CABINET, aspect: ART.cabinet },
  { src: DRAWER, aspect: ART.drawer },
];
export const FLOOR_SPAN = FLOOR.reduce((sum, unit) => sum + unit.aspect, 0);

const PROP_FEET = [
  { cx: 0.25, cy: 0.925, rx: 0.245 },
  { cx: 0.74, cy: 0.975, rx: 0.29 },
];

export interface RoomShelf {
  /** Top of the equipment standing on this shelf. */
  top: number;
  /** The surface itself. */
  base: number;
  /** A stainless serving bar (the topping pans drop into it) rather than a wooden shelf. */
  steel?: boolean;
  /**
   * Where the equipment's own rim meets the counter. A pan sprite starts at the scoop standing
   * in it, which reaches well above the steel, so this is lower than `top`.
   */
  rim?: number;
  /**
   * For a steel bar, the run of counter it owns: `from` is where its stainless starts — right
   * under the work top, or under the bar above it — and `until` is where it hands over, so the
   * counter is one unbroken surface from the work top to the cabinets, as the design has it.
   */
  from?: number;
  until?: number;
}

interface KitchenRoomProps {
  width: number;
  height: number;
  shelves: RoomShelf[];
  /** The work top through the middle, where the cup stands. */
  tableLine: number;
  /** The rail the shop clips its notes to, just under the dispensers. */
  railY: number;
  /** Where the cabinet doors along the bottom start. */
  cabinetTop: number;
  /** The coaster under the cup. */
  matX: number;
  matW: number;
  cupH: number;
  /** Room either side of the dispensers for the plant and the poster. */
  sideRoom: number;
}

/**
 * The soft pool a thing standing on a surface casts around its foot: nested ellipses, each barely
 * there, piling up towards the middle. A `View` cannot be an ellipse — its border radius clamps to
 * half the short side — and this renderer flattens a radial gradient to one solid tone, so the
 * falloff is built by hand.
 */
const SHADOW_RINGS = [1, 0.86, 0.72, 0.58, 0.44, 0.3];

function Shadow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <Svg style={{ position: 'absolute', left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2 }} pointerEvents="none">
      {SHADOW_RINGS.map((k) => (
        <Ellipse key={k} cx={rx} cy={ry} rx={rx * k} ry={ry * k} fill="#5C3A18" opacity={0.055} />
      ))}
    </Svg>
  );
}

/** The lines a steel bar is built on: where its stainless starts, ends, and holds its pans. */
function bands(shelf: RoomShelf) {
  const rim = shelf.rim ?? shelf.top;
  const until = shelf.until ?? shelf.base;
  return {
    rim,
    until,
    from: shelf.from ?? rim,
    // the strip of deck it keeps in front of the pans before it turns down
    apron: Math.min(Math.round((shelf.base - rim) * 0.3), until - shelf.base),
  };
}

/**
 * A stainless serving bar: the pack's own counter, sliced across and stretched over the room.
 * Its raised back stands behind the pans, its deck is what they are sunk into, and it turns
 * down at the front into the cabinets. The sprite's ends are drawn in perspective and this
 * counter runs off both sides of the room, so what is stretched is a column out of its middle.
 */
function SteelBar({ W, shelf }: { W: number; shelf: RoomShelf }) {
  const { rim, from, until, apron } = bands(shelf);
  const band = (src: ImageSourcePropType, top: number, height: number) => (
    <Image
      source={src}
      resizeMode="stretch"
      style={{ position: 'absolute', left: -2, top, width: W + 4, height: Math.max(1, height) }}
    />
  );
  return (
    <View>
      {band(BAR_DECK, rim, shelf.base - rim + apron)}
      {/* the counter's raised back, standing behind the pans */}
      {band(BAR_SPLASH, from, rim - from)}
      {/* and the edge it turns down at, beyond the apron in front of them */}
      {band(BAR_FRONT, shelf.base + apron, until - shelf.base - apron)}
    </View>
  );
}

/** One sprite, placed by its width with its own aspect kept, optionally sitting in its own shadow. */
function Prop({
  src,
  aspect,
  x,
  bottom,
  w,
  opacity,
  shadow,
}: {
  src: ImageSourcePropType;
  aspect: number;
  x: number;
  bottom: number;
  w: number;
  opacity?: number;
  /** How wide the contact shadow is, as a fraction of the sprite — 0 for none. */
  shadow?: number;
}) {
  const h = w / aspect;
  const sw = w * (shadow ?? 0);
  return (
    <>
      {sw > 0 && <Shadow cx={x + w / 2} cy={bottom - sw * 0.03} rx={sw * 0.6} ry={sw * 0.19} />}
      <Image source={src} style={{ position: 'absolute', left: x, top: bottom - h, width: w, height: h, opacity }} />
    </>
  );
}

/**
 * The shop itself: tiled wall under two pendant lamps, a wooden shelf for the dispensers, the work
 * top with the cup's coaster and the shop's notes rail, the stainless topping bar, and the pink
 * cabinets along the foot. All scenery — the equipment you touch is drawn on top of this.
 */
export const KitchenRoom = memo(function KitchenRoom({
  width: W,
  height: H,
  shelves,
  tableLine,
  railY,
  cabinetTop,
  matX,
  matW,
  cupH,
  sideRoom,
}: KitchenRoomProps) {
  if (W <= 0 || H <= 0) return null;

  const lampW = Math.max(32, Math.round(W * 0.125));
  const plankH = Math.max(15, Math.round(W * 0.058));
  const counterH = Math.max(46, Math.round(W * 0.15));
  // how much of the table's surface shows behind the things standing on it
  const surfaceD = Math.round(counterH * 0.72);
  const coasterH = matW / ART.coaster;
  const band = tableLine - railY; // the cup's band, rail to work top
  const capW = Math.max(17, Math.round(W * 0.058));
  const capH = capW / ART.railCap;
  // The straw tin, the plant and the chalkboard are one sprite, arranged the way the design
  // arranges them, and the design runs the chalkboard off the side of the screen — so the
  // sprite is cut that way and hangs off the right edge here too.
  const propsW = Math.min(W * 0.285, band * 0.96 * ART.tableProps);
  const propsH = propsW / ART.tableProps;
  // They stand forward of the cup, almost at the table's front edge, as the design has them.
  // The work top runs down to meet the stainless, which stands in front of it: all the wood on
  // show is surface, and the slack in the room goes into that rather than into the steel.
  const woodBottom = shelves.find((shelf) => shelf.steel)?.from ?? tableLine + counterH;
  const propsBottom = tableLine + (woodBottom - tableLine) * 0.74;

  const topShelf = shelves[0];
  const propW = Math.min(sideRoom, Math.round(W * 0.2));
  const showProps = propW > 24 && topShelf;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ---- tiled wall */}
      <Image source={WALL} resizeMode="repeat" style={{ position: 'absolute', left: 0, top: 0, width: W, height: cabinetTop }} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: cabinetTop, backgroundColor: '#FFF6E9', opacity: 0.4 }} />


      {/* ---- what hangs on the wall, behind everything in the room */}
      {showProps && <Prop src={POSTER} aspect={ART.poster} x={W - propW * 1.0} bottom={topShelf.base - propW * 1.02} w={propW * 0.74} />}

      {shelves.map((shelf, i) =>
        shelf.steel ? (
          // One run of stainless with the pans sunk into it, lit the way the design lights it:
          // the surface fills the whole run, so what shows between two pans is counter and not
          // wall; a dark recess sits just above the rims, where the wells drop away; and the
          // front edge catches the light where it turns down to the cabinets.
          <SteelBar key={i} W={W} shelf={shelf} />
        ) : (
          <View key={i}>
            {[0.17, 0.83].map((at) => (
              <Image
                key={at}
                source={SHELF_FOOT}
                style={{
                  position: 'absolute',
                  left: W * at - (plankH * 0.82) / 2,
                  top: shelf.base - plankH * 0.3 + plankH * 0.95,
                  width: plankH * 0.82,
                  height: plankH * 0.64,
                }}
              />
            ))}
            <Image
              source={SHELF_PLANK}
              resizeMode="stretch"
              style={{ position: 'absolute', left: -2, top: shelf.base - plankH * 0.3, width: W + 4, height: plankH }}
            />
          </View>
        ),
      )}

      {/* ---- pendant lamps, hanging from the ceiling in both corners */}
      {[Math.round(W * 0.025), Math.round(W * 0.975 - lampW)].map((x) => (
        <Image key={x} source={LAMP} style={{ position: 'absolute', left: x, top: 0, width: lampW, height: lampW / ART.lamp }} />
      ))}

      {/* ---- and what stands on the dispenser shelf, in front of it */}
      {showProps && (
        <>
          <Prop src={PLANT} aspect={ART.plant} x={-propW * 0.3} bottom={topShelf.base - plankH * 0.02} w={propW * 1.25} shadow={0.72} />
          <Prop
            src={CUP_STACK}
            aspect={ART.cupStack}
            x={W - propW * 0.92}
            bottom={topShelf.base - plankH * 0.02}
            w={propW * 0.72}
            shadow={0.86}
          />
        </>
      )}

      {/* ---- the notes rail across the cup's band */}
      <Image
        source={RAIL_BAR}
        resizeMode="stretch"
        style={{ position: 'absolute', left: capW * 0.55, top: railY, width: W - capW * 1.1, height: capH }}
      />
      <Image source={RAIL_CAP} style={{ position: 'absolute', left: 1, top: railY, width: capW, height: capH }} />
      <Image
        source={RAIL_CAP}
        style={{ position: 'absolute', right: 1, top: railY, width: capW, height: capH, transform: [{ scaleX: -1 }] }}
      />
      {/* ---- the work top. All of it is surface: the topping counter stands in front of it and
              hides its front edge completely, which is how the design has the two meet. */}
      <Image
        source={PLANK_TOP}
        resizeMode="stretch"
        style={{ position: 'absolute', left: -2, top: tableLine - surfaceD, width: W + 4, height: woodBottom - tableLine + surfaceD }}
      />
      {/* the back of the table, where it meets the wall, sits in its own shadow */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: tableLine - surfaceD,
          width: W,
          height: surfaceD * 0.45,
          backgroundColor: '#8A5526',
          opacity: 0.22,
        }}
      />

      {/* ---- props standing on the work top, forward of the cup, as the design has them */}
      {PROP_FEET.map((foot) => (
        <Shadow
          key={foot.cx}
          cx={W - propsW * (1 - foot.cx)}
          cy={propsBottom - propsH * (1 - foot.cy)}
          rx={propsW * foot.rx}
          ry={propsW * foot.rx * 0.3}
        />
      ))}
      <Image
        source={TABLE_PROPS}
        style={{ position: 'absolute', left: W - propsW, top: propsBottom - propsH, width: propsW, height: propsH }}
      />

      {/* The coaster is a disc lying on the table, so the cup standing at `tableLine` meets it at
          its middle while the near rim carries on in front, with its shadow tucked under that rim. */}
      <Shadow cx={matX + matW / 2} cy={tableLine + coasterH * 0.38} rx={matW * 0.52} ry={coasterH * 0.26} />
      <Image
        source={COASTER}
        style={{
          position: 'absolute',
          left: matX,
          // its top face is an ellipse centred COASTER_FACE down the sprite — that is where the
          // cup has to stand for it to look like it is in the middle of the disc
          top: tableLine - coasterH * COASTER_FACE,
          width: matW,
          height: coasterH,
        }}
      />

      {/* ---- pink cabinets along the bottom, with the towel on its rail. A cabinet is a unit,
              not a backdrop — stretched to the width of the room one would be a smear — so the
              run is a single at each end with a double between them, each as wide as its own
              art. `cabinetH` is sized to that run, so none of them is stretched. */}
      {FLOOR.reduce<{ x: number; nodes: React.ReactNode[] }>(
        (run, unit, i) => {
          const w = ((W + 4) * unit.aspect) / FLOOR_SPAN;
          run.nodes.push(
            <Image
              key={i}
              source={unit.src}
              style={{ position: 'absolute', left: run.x, top: cabinetTop, width: w, height: H - cabinetTop + 2 }}
            />,
          );
          return { x: run.x + w, nodes: run.nodes };
        },
        { x: -2, nodes: [] },
      ).nodes}
      <Prop src={TOWEL} aspect={ART.towel} x={W - cupH * 0.42} bottom={H} w={cupH * 0.38} />
    </View>
  );
});
