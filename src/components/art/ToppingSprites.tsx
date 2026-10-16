import { memo, useId } from 'react';
import { Platform, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Rect } from 'react-native-svg';

import {
  ToppingAtlas, TOPPING_PANS, TOPPING_PAN_ART, TOPPING_PIECES, TOPPING_PIECE_ART,
  TOPPING_SCOOPS, TOPPING_SCOOP_ART,
} from './toppingArt';
import { pointerEventsStyles } from '../../pointerEvents';
import { toppingPanMatrix, ToppingPanShape } from './toppingGeometry';

/**
 * One cell of a painted atlas, drawn through an SVG viewport rather than an oversized `Image` in
 * an `overflow: hidden` box. Chrome paints that box's background from a raster it keeps per
 * element, and for cells near the sheet's left edge it reused the wrong slice of it — the black
 * pearls pan came out orange and the taro dispenser came out amber, on the web build only, and
 * only until something forced the element to repaint. The SVG viewport does its own clipping.
 */
const AtlasSprite = memo(function AtlasSprite({ source, art, id, width, height }: {
  source: number; art: ToppingAtlas; id: string; width: number; height: number;
}) {
  const cell = art.cells[id];
  if (!cell) return null;
  const sx = width / cell.width;
  const sy = height / cell.height;
  return (
    <View style={[{ width, height }, pointerEventsStyles.none]}>
      <Svg width={width} height={height}>
        <SvgImage href={source} x={-cell.x * sx} y={-cell.y * sy}
          width={art.width * sx} height={art.height * sy} preserveAspectRatio="none" />
      </Svg>
    </View>
  );
});

export const ToppingPanArt = memo(function ToppingPanArt({ id = 'empty', width, height, shape }: {
  id?: string; width: number; height: number; shape?: ToppingPanShape;
}) {
  const cell = TOPPING_PAN_ART.cells[id];
  if (!cell) return null;
  // Trim the transparent top/bottom gutter before fitting the painted rims to their shared edges.
  const cropHeight = cell.height - 6;
  const sx = width / cell.width;
  const sy = height / cropHeight;
  const matrix = shape ? toppingPanMatrix(width, height, shape) : undefined;
  // RN Web 0.21 serializes `matrix` as CSS's six-value matrix, even with 16 entries.
  const transform = matrix && (Platform.OS === 'web' ? `matrix3d(${matrix.join(',')})` : [{ matrix }]);
  return (
    <View style={[{ width, height }, pointerEventsStyles.none]}>
      <View style={{ width, height, overflow: 'hidden', transformOrigin: [0, 0, 0],
        transform }}>
        <Svg width={width} height={height}>
          <SvgImage href={TOPPING_PANS} x={-cell.x * sx} y={-(cell.y + 3) * sy}
            width={TOPPING_PAN_ART.width * sx} height={TOPPING_PAN_ART.height * sy}
            preserveAspectRatio="none" />
        </Svg>
      </View>
    </View>
  );
});

export const ToppingScoopArt = memo(function ToppingScoopArt({ id, size }: { id: string; size: number }) {
  const cell = TOPPING_SCOOP_ART.cells[id];
  if (!cell) return null;
  return <AtlasSprite source={TOPPING_SCOOPS} art={TOPPING_SCOOP_ART} id={id}
    width={size} height={size * cell.height / cell.width} />;
});

/** The static viewport clips one painted piece; the parent animates its position and tea wash. */
export const ToppingPieceArt = memo(function ToppingPieceArt({ id, x, y, width, height, opacity }: {
  id: string; x: number; y: number; width: number; height: number; opacity: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const cell = TOPPING_PIECE_ART.cells[id];
  if (!cell) return null;
  const sx = width / cell.width;
  const sy = height / cell.height;
  return (
    <G opacity={opacity}>
      <Defs><ClipPath id={`piece-${uid}`}><Rect x={x} y={y} width={width} height={height} /></ClipPath></Defs>
      <SvgImage href={TOPPING_PIECES} x={x - cell.x * sx} y={y - cell.y * sy}
        width={TOPPING_PIECE_ART.width * sx} height={TOPPING_PIECE_ART.height * sy}
        preserveAspectRatio="none" clipPath={`url(#piece-${uid})`} />
    </G>
  );
});
