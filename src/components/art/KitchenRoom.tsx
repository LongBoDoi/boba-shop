import { memo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

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
  RAIL,
  SHELF,
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

/** One sprite, placed by its width with its own aspect kept. */
function Prop({
  src,
  aspect,
  x,
  bottom,
  w,
  opacity,
}: {
  src: ImageSourcePropType;
  aspect: number;
  x: number;
  bottom: number;
  w: number;
  opacity?: number;
}) {
  const h = w / aspect;
  return <Image source={src} style={{ position: 'absolute', left: x, top: bottom - h, width: w, height: h, opacity }} />;
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

  const lampW = Math.max(34, Math.round(W * 0.13));
  const shelfH = Math.max(10, Math.round(W * 0.042));
  const counterH = Math.max(12, Math.round(H * 0.03));
  const band = tableLine - railY; // the cup's band, rail to work top
  const railH = Math.max(9, Math.round(W * 0.035));
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

      {/* ---- pendant lamps in the corners */}
      <Image
        source={LAMP}
        style={{ position: 'absolute', left: -lampW * 0.12, top: -lampW * 0.22, width: lampW, height: lampW / ART.lamp }}
      />
      <Image
        source={LAMP}
        style={{ position: 'absolute', right: -lampW * 0.12, top: -lampW * 0.22, width: lampW, height: lampW / ART.lamp }}
      />

      {/* ---- the dispenser shelf, dressed either side */}
      {showProps && (
        <>
          <Prop src={PLANT} aspect={ART.plant} x={-propW * 0.3} bottom={topShelf.base + 2} w={propW * 1.25} />
          <Prop src={POSTER} aspect={ART.poster} x={W - propW * 0.95} bottom={topShelf.base - propW * 1.15} w={propW * 0.78} />
          <Prop src={CUP_STACK} aspect={ART.cupStack} x={W - propW * 0.92} bottom={topShelf.base + 2} w={propW * 0.72} />
        </>
      )}

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
          <Image
            key={i}
            source={SHELF}
            resizeMode="stretch"
            style={{ position: 'absolute', left: -2, top: shelf.base - 1, width: W + 4, height: shelfH * 1.4 }}
          />
        ),
      )}

      {/* ---- the notes rail across the cup's band */}
      <Image
        source={RAIL}
        resizeMode="stretch"
        style={{ position: 'absolute', left: W * 0.03, top: railY, width: W * 0.94, height: railH }}
      />

      {/* ---- props standing on the work top */}
      <Prop src={STRAWS} aspect={ART.straws} x={W - propRow * 0.42} bottom={tableLine + 1} w={propRow * 0.36} />
      <Prop src={CHALKBOARD} aspect={ART.chalkboard} x={W - propRow * 0.82} bottom={tableLine + 1} w={propRow * 0.38} />
      <Prop src={SUCCULENT} aspect={ART.succulent} x={W - propRow * 0.94} bottom={tableLine + 1} w={propRow * 0.15} />

      {/* ---- the work top itself, with the cup's coaster on it */}
      <View style={{ position: 'absolute', left: 0, top: tableLine, width: W, height: counterH, backgroundColor: SHOP.wood }} />
      <View style={{ position: 'absolute', left: 0, top: tableLine, width: W, height: 3, backgroundColor: SHOP.woodTop }} />
      <View style={{ position: 'absolute', left: 0, top: tableLine + counterH - 3, width: W, height: 3, backgroundColor: SHOP.woodEdge }} />
      <View
        style={{ position: 'absolute', left: 0, top: tableLine + counterH, width: W, height: 3, backgroundColor: SHOP.woodDark, opacity: 0.2 }}
      />
      <Image
        source={COASTER}
        style={{ position: 'absolute', left: matX, top: tableLine - matW / ART.coaster + 4, width: matW, height: matW / ART.coaster }}
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
