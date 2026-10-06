import { memo } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * The far (customer-facing) edge of the counter: a raised rim the customers stand behind. Drawn
 * in the same wood tones and lighting as `CounterTop` below it so the two read as one 3D counter —
 * a lit top, a front face darkening downward, and a shadow where it meets the receding surface.
 */
export const Counter = memo(function Counter({ width, height }: { width: number; height: number }) {
  const topH = Math.round(height * 0.42); // lit top of the rim
  const seam = 46;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="rimTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F3DCBC" />
          <Stop offset="1" stopColor={colors.counterLight} />
        </LinearGradient>
        <LinearGradient id="rimFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.counter} />
          <Stop offset="1" stopColor={colors.counterEdge} />
        </LinearGradient>
      </Defs>

      {/* Front face of the rim, darkening toward the bottom. */}
      <Rect y={topH} width={width} height={height - topH} fill="url(#rimFace)" />
      {/* faint plank seams, matching the surface grain */}
      {Array.from({ length: Math.ceil(width / seam) }, (_, i) => (
        <Rect key={i} x={i * seam} y={topH} width={1.4} height={height - topH} fill={colors.counterEdge} opacity={0.18} />
      ))}
      {/* Lit top of the rim with a bright highlight catching the light. */}
      <Rect width={width} height={topH} fill="url(#rimTop)" />
      <Rect width={width} height={2.5} fill="#FFE9CC" opacity={0.85} />
      {/* Soft shade under the lit top. The bottom carries no hard line: the rim's front face ends on
          the same wood tone the surface below starts with, so the two read as one continuous counter. */}
      <Rect y={topH - 2} width={width} height={2} fill={colors.counterEdge} opacity={0.4} />
    </Svg>
  );
});
