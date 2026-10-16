import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Rect } from 'react-native-svg';

import {
  ToppingAtlas, TOPPING_PANS, TOPPING_PAN_ART, TOPPING_PIECES, TOPPING_PIECE_ART,
  TOPPING_SCOOPS, TOPPING_SCOOP_ART,
} from './toppingArt';
import { pointerEventsStyles } from '../../pointerEvents';
import { toppingPanBands, ToppingPanShape } from './toppingGeometry';

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

/**
 * One pan, fitted to its cell of the tray so that its painted rims meet its neighbours'. The fit
 * is a trapezoid, and it is drawn as a stack of bands rather than through a transform: see
 * {@link toppingPanBands} for why a phone cannot be handed the matrix.
 */
export const ToppingPanArt = memo(function ToppingPanArt({ id = 'empty', width, height, shape }: {
  id?: string; width: number; height: number; shape?: ToppingPanShape;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const cell = TOPPING_PAN_ART.cells[id];
  if (!cell) return null;
  // Trim the transparent top/bottom gutter before fitting the painted rims to their shared edges.
  const cropHeight = cell.height - 6;
  const bands = shape
    ? toppingPanBands(width, height, shape)
    : [{ x: 0, y: 0, w: width, h: height, top: 0, bottom: 1 }];
  // The fit is wider than the box it is fitted into, so the viewport has to be too, or it would
  // clip away the very rim the fit exists to push out to the cell's edge.
  const left = Math.min(...bands.map((band) => band.x));
  const right = Math.max(...bands.map((band) => band.x + band.w));

  return (
    <View style={[{ width, height }, pointerEventsStyles.none]}>
      <Svg width={right - left} height={height} style={{ position: 'absolute', left, top: 0 }}>
        <Defs>
          {bands.map((band, i) => (
            <ClipPath key={i} id={`pan-${uid}-${i}`}>
              {/* A hair of overlap, so the seam between two bands never opens into a bright line. */}
              <Rect x={band.x - left} y={band.y - 0.25} width={band.w} height={band.h + 0.5} />
            </ClipPath>
          ))}
        </Defs>
        {bands.map((band, i) => {
          const sx = band.w / cell.width;
          const sy = band.h / ((band.bottom - band.top) * cropHeight);
          return (
            <SvgImage key={i} href={TOPPING_PANS}
              x={band.x - left - cell.x * sx}
              y={band.y - (cell.y + 3 + band.top * cropHeight) * sy}
              width={TOPPING_PAN_ART.width * sx} height={TOPPING_PAN_ART.height * sy}
              preserveAspectRatio="none" clipPath={`url(#pan-${uid}-${i})`} />
          );
        })}
      </Svg>
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
