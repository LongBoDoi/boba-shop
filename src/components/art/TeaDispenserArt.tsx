import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Image as SvgImage } from 'react-native-svg';

import { TEA_DISPENSERS, TEA_DISPENSER_ART } from './kitchenArt';
import { pointerEventsStyles } from '../../pointerEvents';

/** A shared painted atlas keeps the six reservoirs identical in shape and lighting. */
export const TeaDispenserArt = memo(function TeaDispenserArt({ width, height, teaId }: {
  width: number;
  height: number;
  teaId: string;
}) {
  const art = TEA_DISPENSER_ART;
  const cell = art.cells[teaId];
  if (!cell) return null;
  const scaleX = width / art.width;
  const scaleY = height / art.height;
  // Drawn through an SVG viewport, not an oversized Image in an `overflow: hidden` box; see the
  // note on AtlasSprite in ToppingSprites.tsx for the paint bug that costs.
  return (
    <View testID={`tea-tank-${teaId}`} style={[{ width, height }, pointerEventsStyles.none]}>
      <Svg width={width} height={height}>
        <SvgImage href={TEA_DISPENSERS} x={-cell.x * scaleX} y={-cell.y * scaleY}
          width={art.imageWidth * scaleX} height={art.imageHeight * scaleY}
          preserveAspectRatio="none" />
      </Svg>
    </View>
  );
});
