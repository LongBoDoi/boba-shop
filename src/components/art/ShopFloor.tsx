import { memo } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

interface ShopFloorProps {
  width: number;
  height: number;
}

// Local wood + decor tones, derived to sit alongside the counter palette.
const WOOD = '#EAD3B4';
const WOOD_ALT = '#E4CAA6';
const WOOD_SEAM = '#D8B88C';
const LEAF = '#7CC47F';
const LEAF_DARK = '#5FAE63';
const LEAF_LIGHT = '#8FD392';
const POT = '#E98E6B';
const POT_DARK = '#D4774F';

/**
 * The café seating area shown below the counter on the Counter page: a wood floor with a rug,
 * two little bistro tables, potted plants and a sleeping cat. Purely decorative and static.
 */
export const ShopFloor = memo(function ShopFloor({ width, height }: ShopFloorProps) {
  if (height <= 0 || width <= 0) return null;
  const plankH = Math.max(26, Math.round(height / 5));
  const rows = Math.ceil(height / plankH);
  const baseY = height * 0.78; // where the seating vignette "sits" on the floor
  const stoolY = Math.min(height * 0.22, 78);
  const s = Math.min(1.1, width / 390);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B98A5A" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#B98A5A" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Wood plank floor. */}
      <Rect width={width} height={height} fill={WOOD} />
      {Array.from({ length: rows }, (_, r) => (
        <G key={r}>
          <Rect y={r * plankH} width={width} height={plankH} fill={r % 2 === 0 ? WOOD : WOOD_ALT} />
          <Rect y={r * plankH} width={width} height={1.5} fill={WOOD_SEAM} opacity={0.6} />
          {/* staggered plank joints */}
          <Rect x={((r % 3) + 1) * (width / 4)} y={r * plankH} width={1.5} height={plankH} fill={WOOD_SEAM} opacity={0.45} />
          <Rect x={((r % 2) + 2) * (width / 5)} y={r * plankH} width={1.5} height={plankH} fill={WOOD_SEAM} opacity={0.35} />
        </G>
      ))}

      {/* Soft shadow the counter casts onto the floor. */}
      <Rect width={width} height={Math.min(40, height * 0.18)} fill="url(#floorShade)" />

      {/* Bar stools lined up under the counter. */}
      <Stool cx={width * 0.22} cy={stoolY} scale={s} />
      <Stool cx={width * 0.5} cy={stoolY} scale={s} />
      <Stool cx={width * 0.78} cy={stoolY} scale={s} />

      {/* Rug. */}
      <Ellipse cx={width / 2} cy={baseY + height * 0.04} rx={width * 0.44} ry={height * 0.2} fill="#FFD9E6" />
      <Ellipse cx={width / 2} cy={baseY + height * 0.04} rx={width * 0.44} ry={height * 0.2} fill="none" stroke="#FFC2D6" strokeWidth={4} />
      <Ellipse cx={width / 2} cy={baseY + height * 0.04} rx={width * 0.31} ry={height * 0.14} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.75} />

      <Plant x={width * 0.08} y={baseY} scale={s} />
      <Plant x={width * 0.92} y={baseY + height * 0.03} scale={s * 0.9} />

      <BistroTable cx={width * 0.3} baseY={baseY - height * 0.03} scale={s * 0.95} cup="taro" />
      <BistroTable cx={width * 0.7} baseY={baseY + height * 0.02} scale={s} cup="tea" />

      <Cat cx={width / 2} cy={baseY + height * 0.1} scale={s} />
    </Svg>
  );
});

function BistroTable({ cx, baseY, scale, cup }: { cx: number; baseY: number; scale: number; cup: 'taro' | 'tea' }) {
  const topW = 46 * scale;
  const topH = 15 * scale;
  const topY = baseY - 58 * scale;
  return (
    <G>
      {/* chair back peeking behind the table */}
      <G>
        <Rect x={cx - 15 * scale} y={topY - 26 * scale} width={30 * scale} height={30 * scale} rx={10 * scale} fill={colors.mint} />
        <Rect x={cx - 15 * scale} y={topY - 26 * scale} width={30 * scale} height={30 * scale} rx={10 * scale} fill="none" stroke={colors.mintDark} strokeWidth={2 * scale} />
      </G>
      {/* floor shadow */}
      <Ellipse cx={cx} cy={baseY} rx={28 * scale} ry={7 * scale} fill="#000000" opacity={0.08} />
      {/* pedestal */}
      <Rect x={cx - 4 * scale} y={topY} width={8 * scale} height={56 * scale} fill={colors.counter} />
      <Ellipse cx={cx} cy={baseY - 2 * scale} rx={16 * scale} ry={5 * scale} fill={colors.counterEdge} />
      {/* round top */}
      <Ellipse cx={cx} cy={topY} rx={topW} ry={topH} fill={colors.counterLight} />
      <Ellipse cx={cx} cy={topY} rx={topW} ry={topH} fill="none" stroke={colors.counterEdge} strokeWidth={2 * scale} />
      <Path d={`M${cx - topW} ${topY} a${topW} ${topH} 0 0 0 ${topW * 2} 0 v${4 * scale} a${topW} ${topH} 0 0 1 ${-topW * 2} 0 Z`} fill={colors.counterEdge} />
      {/* a little boba cup on the table */}
      <MiniCup cx={cx + 14 * scale} cy={topY - 2 * scale} scale={scale} kind={cup} />
    </G>
  );
}

function Stool({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const r = 18 * scale;
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 30 * scale} rx={16 * scale} ry={4 * scale} fill="#000000" opacity={0.08} />
      {/* legs */}
      <Path d={`M${cx - r * 0.7} ${cy} L${cx - r * 0.9} ${cy + 30 * scale}`} stroke={colors.counterEdge} strokeWidth={3 * scale} strokeLinecap="round" />
      <Path d={`M${cx + r * 0.7} ${cy} L${cx + r * 0.9} ${cy + 30 * scale}`} stroke={colors.counterEdge} strokeWidth={3 * scale} strokeLinecap="round" />
      {/* seat */}
      <Ellipse cx={cx} cy={cy} rx={r} ry={r * 0.42} fill={colors.primary} />
      <Ellipse cx={cx} cy={cy - 2 * scale} rx={r} ry={r * 0.42} fill={colors.primaryTint} />
      <Ellipse cx={cx} cy={cy - 2 * scale} rx={r} ry={r * 0.42} fill="none" stroke={colors.primaryDark} strokeWidth={1.5 * scale} />
    </G>
  );
}

function MiniCup({ cx, cy, scale, kind }: { cx: number; cy: number; scale: number; kind: 'taro' | 'tea' }) {
  const w = 14 * scale;
  const h = 20 * scale;
  const fill = kind === 'taro' ? '#C9A9E6' : '#D9A06B';
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      <Path d={`M${x} ${y} h${w} l${-1.5 * scale} ${h} h${-(w - 3 * scale)} Z`} fill={fill} />
      {/* pearls */}
      <Path d={`M${x + 2 * scale} ${y + h - 3 * scale} h${w - 4 * scale}`} stroke="#3A2A2A" strokeWidth={3 * scale} strokeLinecap="round" opacity={0.8} />
      {/* lid + straw */}
      <Rect x={x - 1 * scale} y={y - 2 * scale} width={w + 2 * scale} height={3 * scale} rx={1.5 * scale} fill="#FFFFFF" />
      <Rect x={cx - 1 * scale} y={y - 10 * scale} width={2.5 * scale} height={10 * scale} rx={1 * scale} fill={colors.primary} />
    </G>
  );
}

function Plant({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Ellipse cx={0} cy={2} rx={20} ry={5} fill="#000000" opacity={0.08} />
      {/* leaves */}
      <Path d="M0 -8 C-16 -14 -20 -34 -14 -46 C-4 -38 0 -22 0 -8 Z" fill={LEAF} />
      <Path d="M0 -8 C16 -14 20 -34 14 -46 C4 -38 0 -22 0 -8 Z" fill={LEAF_DARK} />
      <Path d="M0 -8 C-6 -26 0 -44 0 -54 C6 -40 6 -24 0 -8 Z" fill={LEAF_LIGHT} />
      {/* pot */}
      <Path d="M-14 -8 H14 L10 10 H-10 Z" fill={POT} />
      <Path d="M-14 -8 H14 L12.6 -2 H-12.6 Z" fill={POT_DARK} />
    </G>
  );
}

function Cat({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  return (
    <G transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <Ellipse cx={0} cy={6} rx={26} ry={6} fill="#000000" opacity={0.08} />
      {/* curled body */}
      <Ellipse cx={0} cy={0} rx={24} ry={12} fill="#C9BBA8" />
      {/* tail wrapping front */}
      <Path d="M22 0 C32 2 30 12 20 10 C14 9 14 2 22 0 Z" fill="#B7A892" />
      {/* head */}
      <Ellipse cx={-16} cy={-3} rx={10} ry={9} fill="#C9BBA8" />
      <Path d="M-24 -10 l3 -7 l4 5 Z" fill="#C9BBA8" />
      <Path d="M-10 -10 l-3 -7 l-4 5 Z" fill="#C9BBA8" />
      {/* sleepy eyes + nose */}
      <Path d="M-20 -3 q2 2 4 0" stroke="#5A4A3A" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M-14 -3 q2 2 4 0" stroke="#5A4A3A" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M-16 1 l-1.5 2 h3 Z" fill="#A86A6A" />
    </G>
  );
}
