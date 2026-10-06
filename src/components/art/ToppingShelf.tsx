import { memo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '../../theme';

export const SHELF_HEIGHT = 74;

const JARS = [
  { lid: colors.primary, pieces: '#3A2318', round: true },
  { lid: '#7FD6C2', pieces: '#F0506E', round: true },
  { lid: colors.gold, pieces: '#F4EEDC', round: false },
];

/** A little wooden shelf of topping jars and a stack of cups, purely decorative. */
export const ToppingShelf = memo(function ToppingShelf({ width, height }: { width: number; height: number }) {
  const jarWidth = 30;
  const gap = Math.max(6, (width - 28 - JARS.length * jarWidth - 26) / (JARS.length + 1));
  return (
    <Svg width={width} height={height}>
      {JARS.map((jar, i) => {
        const x = 14 + gap + i * (jarWidth + gap);
        return (
          <G key={i}>
            <Rect x={x} y={height - 52} width={jarWidth} height={40} rx={7} fill="#FFFFFF" opacity={0.85} stroke="#E7D5C5" strokeWidth={1.5} />
            {Array.from({ length: 6 }, (_, k) => {
              const cx = x + 8 + (k % 3) * 7;
              const cy = height - 20 - Math.floor(k / 3) * 7;
              return jar.round ? (
                <Circle key={k} cx={cx} cy={cy} r={3.4} fill={jar.pieces} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
              ) : (
                <Rect key={k} x={cx - 3} y={cy - 3} width={6} height={6} rx={1.4} fill={jar.pieces} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
              );
            })}
            <Rect x={x - 2} y={height - 58} width={jarWidth + 4} height={8} rx={3} fill={jar.lid} />
            <Rect x={x + 4} y={height - 46} width={3} height={26} rx={1.5} fill="#FFFFFF" opacity={0.7} />
          </G>
        );
      })}
      <G>
        {[0, 1, 2].map((k) => (
          <Path
            key={k}
            d={`M${width - 40} ${height - 14 - k * 7} L${width - 16} ${height - 14 - k * 7} L${width - 19} ${height - 40 - k * 7} L${width - 37} ${height - 40 - k * 7} Z`}
            fill="#FFFFFF"
            stroke={colors.cupOutline}
            strokeWidth={1.2}
          />
        ))}
      </G>
      <Rect x={4} y={height - 12} width={width - 8} height={8} rx={3} fill={colors.counter} />
      <Rect x={4} y={height - 6} width={width - 8} height={3} rx={1.5} fill={colors.counterDark} />
    </Svg>
  );
});
