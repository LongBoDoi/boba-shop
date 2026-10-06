import { memo } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

/** Wooden counter front; customers stand behind it so it covers their lower half. */
export const Counter = memo(function Counter({ width, height }: { width: number; height: number }) {
  const top = Math.round(height * 0.32);
  const plank = 46;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="counterTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.counterLight} />
          <Stop offset="1" stopColor={colors.counter} />
        </LinearGradient>
      </Defs>
      <Rect y={top} width={width} height={height - top} fill={colors.counter} />
      {Array.from({ length: Math.ceil(width / plank) }, (_, i) => (
        <Rect key={i} x={i * plank} y={top} width={2} height={height - top} fill={colors.counterEdge} opacity={0.5} />
      ))}
      <Rect y={height - 4} width={width} height={4} fill={colors.counterDark} />
      <Rect width={width} height={top} rx={3} fill="url(#counterTop)" />
      <Rect y={top - 2} width={width} height={2} fill={colors.counterDark} opacity={0.4} />
    </Svg>
  );
});
