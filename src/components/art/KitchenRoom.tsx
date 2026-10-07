import { memo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import {
  ART,
  CABINET,
  CHALKBOARD,
  COASTER,
  COUNTER_STEEL,
  CUP_STACK,
  LAMP,
  PLANT,
  POSTER,
  RAIL_BAR,
  RAIL_CAP,
  SHELF_FOOT,
  PLANK_FACE,
  PLANK_TOP,
  SHELF_PLANK,
  STRAWS,
  SUCCULENT,
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

export interface RoomShelf {
  /** Top of the equipment standing on this shelf. */
  top: number;
  /** The surface itself. */
  base: number;
  /** A stainless serving bar (the topping pans drop into it) rather than a wooden shelf. */
  steel?: boolean;
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
  const shelfH = Math.max(10, Math.round(W * 0.042));
  const plankH = Math.max(15, Math.round(W * 0.058));
  const counterH = Math.max(46, Math.round(W * 0.15));
  // how much of the table's surface shows behind the things standing on it
  const surfaceD = Math.round(counterH * 0.72);
  const coasterH = matW / ART.coaster;
  // The lip is the strip of table in front of whatever stands on it — deep enough for the
  // coaster, which is a disc seen from above: the cup sits at its middle, not on its back edge.
  const lip = Math.round(Math.max(counterH * 0.16, coasterH * 0.56));
  const band = tableLine - railY; // the cup's band, rail to work top
  const capW = Math.max(17, Math.round(W * 0.058));
  const capH = capW / ART.railCap;
  // the cluster of props standing at the right of the work top
  const propRow = Math.min(band * 1.1, W * 0.44);

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
          <View key={i}>
            {/* the counter surface crosses the pans, so they read as sunk into it */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: shelf.top + (shelf.base - shelf.top) * 0.3,
                width: W,
                height: (shelf.base - shelf.top) * 0.7,
                backgroundColor: SHOP.steel,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: shelf.top + (shelf.base - shelf.top) * 0.3,
                width: W,
                height: 3,
                backgroundColor: SHOP.steelTop,
              }}
            />
            <Image
              source={COUNTER_STEEL}
              resizeMode="stretch"
              style={{ position: 'absolute', left: -2, top: shelf.base - shelfH * 0.5, width: W + 4, height: shelfH * 1.6 }}
            />
          </View>
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
      {/* ---- the work top: a surface receding behind whatever stands on it, then its front edge */}
      <Image
        source={PLANK_TOP}
        resizeMode="stretch"
        style={{ position: 'absolute', left: -2, top: tableLine - surfaceD, width: W + 4, height: surfaceD + lip + 2 }}
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

      {/* ---- props standing on the work top */}
      <Prop src={SUCCULENT} aspect={ART.succulent} x={W - propRow * 0.92} bottom={tableLine - surfaceD * 0.34} w={propRow * 0.16} shadow={0.8} />
      <Prop src={CHALKBOARD} aspect={ART.chalkboard} x={W - propRow * 0.8} bottom={tableLine - surfaceD * 0.22} w={propRow * 0.37} shadow={0.74} />
      <Prop src={STRAWS} aspect={ART.straws} x={W - propRow * 0.4} bottom={tableLine} w={propRow * 0.34} shadow={0.8} />

      {/* ---- the table's front edge, in front of everything standing on it */}
      <Image
        source={PLANK_FACE}
        resizeMode="stretch"
        style={{ position: 'absolute', left: -2, top: tableLine + lip, width: W + 4, height: counterH - lip }}
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

      {/* ---- pink cabinets along the bottom, with the towel on its rail */}
      <Image
        source={CABINET}
        resizeMode="stretch"
        style={{ position: 'absolute', left: -2, top: cabinetTop, width: W + 4, height: H - cabinetTop + 2 }}
      />
      <Prop src={TOWEL} aspect={ART.towel} x={W - cupH * 0.42} bottom={H} w={cupH * 0.38} />
    </View>
  );
});
