import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { ART, COASTER, ROOM, ROOM_BG } from './kitchenArt';

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
 * The run of the plate the player actually works on — the dispenser shelf down to the bench. A
 * phone shorter than the painting has to lose something off one end or the other, and it is the
 * ceiling and the floor that can go, so the room is centred on this band rather than on itself.
 */
const KEEP = (ROOM.shelf.top + ROOM.bench.base) / 2;

export interface RoomFit {
  /** Plate pixels to room pixels. */
  scale: number;
  px: (x: number) => number;
  py: (y: number) => number;
}

/**
 * How the painting lands on this phone. It keeps its own shape and the room crops what will not
 * fit — a strip off each side on a narrow screen, the ceiling and the floor on a short one.
 * Everything standing in the room is placed through the same transform, so a pan is on the
 * counter the plate paints however the phone is shaped.
 */
export function fitRoom(W: number, H: number): RoomFit {
  const scale = Math.max(W / ROOM.width, H / ROOM.height);
  const drawH = ROOM.height * scale;
  const dx = (W - ROOM.width * scale) / 2;
  // centred on the working band, then held inside the painting so no edge of it shows
  const dy = Math.max(H - drawH, Math.min(0, H / 2 - KEEP * scale));
  return { scale, px: (x: number) => dx + x * scale, py: (y: number) => dy + y * scale };
}

/**
 * The soft pool a thing standing on a surface casts around its foot: nested ellipses, each barely
 * there, piling up towards the middle. A `View` cannot be an ellipse — its border radius clamps to
 * half the short side — and this renderer flattens a radial gradient to one solid tone, so the
 * falloff is built by hand.
 */
const SHADOW_RINGS = [1, 0.86, 0.72, 0.58, 0.44, 0.3];

export function Shadow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <Svg style={{ position: 'absolute', left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2 }} pointerEvents="none">
      {SHADOW_RINGS.map((k) => (
        <Ellipse key={k} cx={rx} cy={ry} rx={rx * k} ry={ry * k} fill="#5C3A18" opacity={0.055} />
      ))}
    </Svg>
  );
}

interface KitchenRoomProps {
  width: number;
  height: number;
  /** Where the cup stands on the work top, so its coaster goes under it. */
  tableLine: number;
  matX: number;
  matW: number;
}

/**
 * The shop, in one painting: the tiled wall and its lamps, the dispenser shelf, the fridge, the
 * work top, the bench and the pink units at the foot of it. All of it is scenery — the equipment
 * the player touches is drawn on top, standing on the surfaces the plate already has.
 */
export const KitchenRoom = memo(function KitchenRoom({ width: W, height: H, tableLine, matX, matW }: KitchenRoomProps) {
  if (W <= 0 || H <= 0) return null;

  const { px, py, scale } = fitRoom(W, H);
  const coasterH = matW / ART.coaster;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The painting, placed by hand rather than by `cover`: cover centres it on itself, which
          crops the work top off the bottom of a short screen. */}
      <Image
        source={ROOM_BG}
        style={{
          position: 'absolute',
          left: px(0),
          top: py(0),
          width: ROOM.width * scale,
          height: ROOM.height * scale,
        }}
      />

      {/* The coaster is a disc lying on the work top, so a cup standing at `tableLine` meets it
          at its middle while the near rim carries on in front, its shadow tucked under that rim. */}
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
    </View>
  );
});
