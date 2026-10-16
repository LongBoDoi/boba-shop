import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { pointerEventsStyles } from '../../pointerEvents';

export const KitchenBottle = memo(function KitchenBottle({ width, height, color }: { width: number; height: number; color: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={width} height={height} viewBox="0 0 60 150" style={pointerEventsStyles.none}>
      <Defs>
        <LinearGradient id={`bottle${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#C49A68" /><Stop offset="0.18" stopColor={color} /><Stop offset="0.7" stopColor={color} /><Stop offset="1" stopColor="#C49A68" />
        </LinearGradient>
      </Defs>
      <Path d="M27 19 L28 4 Q30 0 32 4 L34 19" fill="#EDC08B" stroke="#A37342" strokeWidth={1.5} />
      <Rect x={19} y={18} width={23} height={12} rx={3} fill="#EDC08B" stroke="#A37342" strokeWidth={1.5} />
      <Path d="M21 30 Q20 38 10 47 Q6 51 6 63 V139 Q6 146 14 146 H47 Q54 146 54 139 V63 Q54 51 49 47 Q40 38 40 30 Z" fill={`url(#bottle${id})`} stroke="#AD7947" strokeWidth={2} />
      <Path d="M12 65 V132 M16 48 L23 37 M13 58 V54" stroke="#FFF8E4" strokeWidth={3.5} strokeLinecap="round" opacity={0.75} />
      <Rect x={13} y={79} width={35} height={29} rx={4} fill="#FFF2D2" stroke="#E6C08A" strokeWidth={1} />
      <Path d="M25 88 Q20 83 21 88 Q22 93 29 93 Q33 84 39 87 Q38 93 30 94 M30 91 V101" fill="#AAB16B" />
      <Path d="M12 141 Q30 144 48 141" stroke="#FFF2C8" strokeWidth={1.5} opacity={0.7} />
    </Svg>
  );
});

export const KitchenIceBox = memo(function KitchenIceBox({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 80" style={pointerEventsStyles.none}>
      <Path d="M9 15 H151 L143 72 H17 Z" fill="#C4B7A1" stroke="#8E795D" strokeWidth={2} />
      <Path d="M9 15 L21 3 H141 L151 15 L140 58 H20 Z" fill="#EFE5D2" stroke="#8E795D" strokeWidth={2} />
      <Path d="M19 16 H141 L133 50 H27 Z" fill="#B6C8BC" stroke="#9D9278" strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <G key={i} transform={`translate(${30 + i % 4 * 25} ${18 + Math.floor(i / 4) * 15})`}>
          <Rect width={20} height={17} rx={4} fill="#F6FAE9" fillOpacity={0.8} stroke="#FFFDF0" strokeWidth={1.5} />
          <Path d="M4 4 H13 M4 5 V11" fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
        </G>
      ))}
      <Rect x={58} y={56} width={44} height={18} rx={4} fill="#FFF1CE" stroke="#BD925C" strokeWidth={1.5} />
      <Circle cx={80} cy={65} r={4} fill="#9DAD8D" />
    </Svg>
  );
});

export function KitchenActionIcon({ kind }: { kind: 'cup' | 'trash' }) {
  return (
    <Svg width={20} height={24} viewBox="0 0 24 28" style={pointerEventsStyles.none}>
      {kind === 'trash' ? (
        <G fill="none" stroke="#987044" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 8 L7.5 24 H17 L19 8 M4 7 H21 M9 6 V3 H16 V6 M10 12 V20 M15 12 V20" />
          <Path d="M8 10 L9 22 H16 L17 10" fill="#DDBD87" fillOpacity={0.4} stroke="none" />
        </G>
      ) : (
        <G fill="none" stroke="#FFF4D6" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 7 H20 L17.5 24 H8 Z M4 6 H21 M14 3 L12 15" />
          <Path d="M8 16 H17 L16 23 H9 Z" fill="#E6D0A0" stroke="none" />
          <Circle cx={10} cy={21} r={1.3} fill="#827244" stroke="none" />
          <Circle cx={14} cy={21} r={1.3} fill="#827244" stroke="none" />
        </G>
      )}
    </Svg>
  );
}
