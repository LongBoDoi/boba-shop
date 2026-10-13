import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors } from '../../theme';
import { pointerEventsStyles } from '../../pointerEvents';

/** Kitchen backsplash tiles behind the work station. */
export const Tiles = memo(function Tiles({ width, height }: { width: number; height: number }) {
  const size = 28;
  const cols = Math.ceil(width / size) + 1;
  const rows = Math.ceil(height / size) + 1;
  return (
    <Svg width={width} height={height} style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
      <Rect width={width} height={height} fill={colors.grout} />
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => (
          <Rect
            key={`${row}-${col}`}
            x={col * size + (row % 2) * (size / 2) - size / 2 + 1}
            y={row * size + 1}
            width={size - 2}
            height={size - 2}
            rx={3}
            fill={(row + col) % 5 === 0 ? '#FFEFF4' : colors.tile}
          />
        )),
      )}
    </Svg>
  );
});
