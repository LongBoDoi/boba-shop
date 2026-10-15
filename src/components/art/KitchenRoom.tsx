import { memo, ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { SharedValue } from 'react-native-reanimated';

import { CUP_HOLDER, ROOM_BG, ROOM_BG_CUP_HOLDER, ROOM_BG_SIZE, ROOM_BG_TABLE } from './kitchenArt';
import { fitBackground, PannableBackground } from './PannableBackground';
import { pointerEventsStyles } from '../../pointerEvents';

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

/** The countertop moves horizontally with the painting, but its height is constant while panning. */
export function kitchenTableFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  return {
    top: top + ROOM_BG_TABLE.top * scale,
    base: top + ROOM_BG_TABLE.base * scale,
  };
}

/**
 * The holder keeps the size and the height on the counter the painting gave it, so the room it
 * was lifted out of still fits around it. Only its left edge is the screen's rather than the
 * painting's: the wall pans and the cup standing on the holder does not, and the painting had it
 * near the middle anyway.
 */
export function kitchenHolderFor(width: number, height: number) {
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  const holderWidth = ROOM_BG_CUP_HOLDER.width * scale;
  return {
    left: (width - holderWidth) / 2,
    top: top + ROOM_BG_CUP_HOLDER.y * scale,
    width: holderWidth,
    height: ROOM_BG_CUP_HOLDER.height * scale,
  };
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
    <Svg style={[{ position: 'absolute', left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2 }, pointerEventsStyles.none]}>
      {SHADOW_RINGS.map((k) => (
        <Ellipse key={k} cx={rx} cy={ry} rx={rx * k} ry={ry * k} fill="#5C3A18" opacity={0.055} />
      ))}
    </Svg>
  );
}

interface KitchenRoomProps {
  children?: ReactNode;
  width: number;
  height: number;
  panOffset: SharedValue<number>;
  scrollEnabled: boolean;
  onPanBegin: () => void;
}

/** The equipment wall pans behind a fixed preparation mat and draggable cup. */
export const KitchenRoom = memo(function KitchenRoom({ width: W, height: H, children, panOffset, scrollEnabled, onPanBegin }: KitchenRoomProps) {
  if (W <= 0 || H <= 0) return null;

  const holder = kitchenHolderFor(W, H);

  return (
    <View style={[StyleSheet.absoluteFill, pointerEventsStyles.boxNone]}>
      <PannableBackground
        source={ROOM_BG}
        imageWidth={ROOM_BG_SIZE.width}
        imageHeight={ROOM_BG_SIZE.height}
        width={W}
        height={H}
        offset={panOffset}
        scrollEnabled={scrollEnabled}
        onPanBegin={onPanBegin}
      >
        {children}
      </PannableBackground>

      {/* The holder carries its own painted contact shadow, as it did in the room it came from. */}
      <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
        <Image testID="cup-holder" source={CUP_HOLDER} fadeDuration={0}
          style={{ position: 'absolute', left: holder.left, top: holder.top,
            width: holder.width, height: holder.height }} />
      </View>
    </View>
  );
});
