import { memo, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { pointerEventsStyles } from '../../pointerEvents';

/** Warm, ink-outlined equipment shares the painted room's caramel and cream palette. */
export const KitchenDispenser = memo(function KitchenDispenser({ width, height, color, active, pouring }: {
  width: number; height: number; color: string; active: boolean; pouring: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={width} height={height} viewBox="0 0 140 160" style={pointerEventsStyles.none}>
      <Defs>
        <LinearGradient id={`lid${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8C6A47" /><Stop offset="0.4" stopColor="#58412D" /><Stop offset="1" stopColor="#382C22" />
        </LinearGradient>
        <LinearGradient id={`tea${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#633B1D" /><Stop offset="0.18" stopColor={color} /><Stop offset="0.7" stopColor={color} /><Stop offset="1" stopColor="#8E5027" />
        </LinearGradient>
        <LinearGradient id={`glass${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFF7DF" stopOpacity="0.7" /><Stop offset="0.18" stopColor="#FFF7DF" stopOpacity="0.05" />
          <Stop offset="0.8" stopColor="#FFF7DF" stopOpacity="0.08" /><Stop offset="1" stopColor="#FFF7DF" stopOpacity="0.5" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={70} cy={144} rx={62} ry={5} fill="#67401F" opacity={0.18} />
      <Rect x={9} y={25} width={122} height={112} rx={17} fill="#EACDA6" fillOpacity={0.22} stroke="#735234" strokeWidth={2.5} />
      <Path d="M14 57 Q70 66 126 57 V120 Q126 135 110 135 H30 Q14 135 14 120 Z" fill={`url(#tea${id})`} />
      <Ellipse cx={70} cy={57} rx={56} ry={6} fill={color} stroke="#FFDB96" strokeWidth={1.5} />
      <Path d="M17 61 Q70 68 123 61" fill="none" stroke="#FFF1BD" strokeWidth={1.5} strokeDasharray={pouring ? '3 3' : '1 7'} opacity={0.8} />
      <Rect x={11} y={29} width={118} height={105} rx={16} fill={`url(#glass${id})`} />
      <Path d="M22 39 V116 M28 43 V70 M118 39 V112" stroke="#FFF9E6" strokeWidth={4} strokeLinecap="round" opacity={0.65} />
      <Path d="M7 31 Q5 9 29 8 H111 Q135 9 133 31 Z" fill={`url(#lid${id})`} stroke="#624229" strokeWidth={2.5} />
      <Path d="M15 24 Q19 12 42 12 H103 Q118 13 124 23" fill="none" stroke="#C5996A" strokeWidth={2} opacity={0.75} />
      <Ellipse cx={70} cy={10} rx={15} ry={3} fill="#32281E" />
      <Path d="M9 126 Q70 141 131 126 V139 Q70 151 9 139 Z" fill={`url(#lid${id})`} stroke="#624229" strokeWidth={2} />
      <Rect x={47} y={74} width={46} height={34} rx={5} fill="#FFF0C7" stroke={active ? '#748443' : '#D29A4E'} strokeWidth={2} />
      <Path d="M65 80 Q56 73 56 83 Q60 88 68 88 Q75 76 82 80 Q80 88 69 90 M69 86 L68 96" fill="#98A344" stroke="#7C873A" strokeWidth={0.7} />
      <Path d="M61 123 L64 114 Q70 111 76 114 L79 123 L75 127 V151 Q70 160 65 151 V127 Z" fill={pouring ? '#96724B' : '#42382A'} stroke="#382B1D" strokeWidth={2} />
      <Path d="M66 117 H74 M69 132 V148" stroke="#B99A70" strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 129 L6 140 Q9 145 19 143 L22 135 M132 129 L134 140 Q131 145 121 143 L118 135" fill="#665035" stroke="#4A3522" strokeWidth={2} />
    </Svg>
  );
});

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
