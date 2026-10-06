import { memo } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

interface CounterTopProps {
  width: number;
  height: number;
}

/**
 * The barista's side of the counter, shown below the customers on the Counter page: a wooden
 * counter surface with a few props (register, tip jar, straws, napkins, a succulent). The
 * customers stand on the far side, so this reads as the table top facing the player. Static.
 */
export const CounterTop = memo(function CounterTop({ width, height }: CounterTopProps) {
  if (height <= 0 || width <= 0) return null;
  const s = Math.min(1.15, width / 390);
  // The counter is drawn in 3D: a shallow top surface that recedes away from us, a slab edge (its
  // thickness) that overhangs, and a tall front face (the barista-side cabinet) down to the floor.
  const surfaceH = Math.round(height * 0.42);
  const slab = Math.max(10, Math.round(height * 0.04));
  const faceTop = surfaceH + slab;
  const vpx = width / 2;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="ctSurface" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B5824F" />
          <Stop offset="0.55" stopColor={colors.counter} />
          <Stop offset="1" stopColor="#E7BB86" />
        </LinearGradient>
        <LinearGradient id="ctSheen" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="ctFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.counter} />
          <Stop offset="1" stopColor="#B07A48" />
        </LinearGradient>
        <LinearGradient id="ctBackShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6B421F" stopOpacity={0.38} />
          <Stop offset="1" stopColor="#6B421F" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="ctOverhang" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A2410" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#3A2410" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Receding top surface (full width; perspective comes from grain + the front face below). */}
      <Rect width={width} height={surfaceH} fill="url(#ctSurface)" />
      {/* Wood grain converging toward a vanishing point above the counter. */}
      {Array.from({ length: 11 }, (_, i) => {
        const fx = (i / 10) * width;
        return <Path key={i} d={`M${fx} ${surfaceH} L${vpx + (fx - vpx) * 0.18} 0`} stroke={colors.counterEdge} strokeWidth={1.2} opacity={0.12} />;
      })}
      {/* Glossy sheen + ambient shadow under the back ledge. */}
      <Rect width={width} height={surfaceH} fill="url(#ctSheen)" />
      <Rect width={width} height={Math.min(34, surfaceH * 0.3)} fill="url(#ctBackShade)" />

      {/* Slab edge (the counter's thickness) with a lit top and a shadowed underside. */}
      <Rect y={surfaceH} width={width} height={slab} fill={colors.counterLight} />
      <Rect y={surfaceH} width={width} height={2.5} fill="#FFE6C8" opacity={0.7} />
      <Rect y={surfaceH + slab - 2} width={width} height={2} fill="#7A5230" opacity={0.6} />

      {/* Front face = the barista-side cabinet. */}
      <Rect y={faceTop} width={width} height={height - faceTop} fill="url(#ctFace)" />
      {/* Shadow the overhanging slab casts onto the cabinet face. */}
      <Rect y={faceTop} width={width} height={Math.min(16, (height - faceTop) * 0.2)} fill="url(#ctOverhang)" />
      <CabinetDoors width={width} top={faceTop + 12} bottom={height - 14} />
      {/* recessed toe-kick at the floor */}
      <Rect y={height - 12} width={width} height={12} fill="#5E3C22" />
      <Rect y={height - 12} width={width} height={2} fill="#3A2410" opacity={0.6} />

      {/* Props in two tight groupings (not an even grid), drawn back-to-front: a till station on
          the left (cup stack behind, register at the front, tip jar beside it) and a supply station
          on the right (plant behind, straws + napkins), leaving open prep space in the middle. */}
      <Succulent cx={width * 0.8} cy={surfaceH * 0.56} scale={s * 0.6} />
      <CupStack cx={width * 0.15} cy={surfaceH * 0.72} scale={s * 0.8} />
      <NapkinBox cx={width * 0.86} cy={surfaceH * 0.9} scale={s * 0.9} />
      <TipJar cx={width * 0.43} cy={surfaceH * 0.96} scale={s * 0.86} />
      <StrawCup cx={width * 0.68} cy={surfaceH * 0.99} scale={s * 0.84} />
      <Register cx={width * 0.24} cy={surfaceH * 1.03} scale={s} />
    </Svg>
  );
});

/** The row of recessed shaker-panel doors on the barista side of the counter front. */
function CabinetDoors({ width, top, bottom }: { width: number; top: number; bottom: number }) {
  const count = width < 340 ? 3 : 4;
  const gap = 8;
  const pad = 10;
  const doorW = (width - pad * 2 - gap * (count - 1)) / count;
  const doorH = bottom - top;
  const rail = Math.min(14, doorW * 0.16); // frame thickness around the recessed panel
  return (
    <G>
      {Array.from({ length: count }, (_, i) => {
        const x = pad + i * (doorW + gap);
        const innerX = x + rail;
        const innerY = top + rail;
        const innerW = doorW - rail * 2;
        const innerH = doorH - rail * 2;
        const handleRight = i < count / 2; // handles meet at the middle, like real cabinet pairs
        const hx = handleRight ? x + doorW - 7 : x + 7;
        const hy = top + doorH * 0.46;
        return (
          <G key={i}>
            {/* gap/shadow between doors */}
            <Rect x={x - gap / 2} y={top} width={doorW + gap} height={doorH} rx={5} fill="#7A5230" opacity={0.35} />
            {/* door face */}
            <Rect x={x} y={top} width={doorW} height={doorH} rx={5} fill={colors.counter} />
            {/* top/left bevel highlight */}
            <Rect x={x} y={top} width={doorW} height={2} rx={1} fill="#F0CDA0" opacity={0.7} />
            <Rect x={x} y={top} width={2} height={doorH} rx={1} fill="#F0CDA0" opacity={0.5} />
            {/* bottom/right bevel shadow */}
            <Rect x={x} y={bottom - 2} width={doorW} height={2} rx={1} fill="#6B4425" opacity={0.6} />
            {/* recessed panel */}
            <Rect x={innerX} y={innerY} width={innerW} height={innerH} rx={4} fill="#B57E49" />
            <Rect x={innerX} y={innerY} width={innerW} height={2} fill="#6B4425" opacity={0.6} />
            <Rect x={innerX} y={innerY} width={2} height={innerH} fill="#6B4425" opacity={0.5} />
            <Rect x={innerX} y={innerY + innerH - 2} width={innerW} height={2} fill="#E7BB86" opacity={0.6} />
            {/* bar handle */}
            <Rect x={hx - 2} y={hy} width={4} height={doorH * 0.12} rx={2} fill="#E8DCCB" />
            <Rect x={hx - 2} y={hy} width={4} height={doorH * 0.12} rx={2} fill="none" stroke="#9A8470" strokeWidth={0.8} />
          </G>
        );
      })}
    </G>
  );
}

function shadow(cx: number, cy: number, rx: number) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.26} fill="#000000" opacity={0.1} />;
}

function Register({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 58 * scale;
  const h = 40 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.52)}
      {/* body */}
      <Rect x={x} y={y + 10 * scale} width={w} height={h - 10 * scale} rx={5 * scale} fill={colors.primary} />
      <Rect x={x} y={y + h - 8 * scale} width={w} height={8 * scale} rx={4 * scale} fill={colors.primaryDark} />
      {/* screen on a stalk */}
      <Rect x={cx - 3 * scale} y={y - 2 * scale} width={6 * scale} height={14 * scale} fill={colors.counterEdge} />
      <Rect x={x + 6 * scale} y={y - 18 * scale} width={w - 12 * scale} height={20 * scale} rx={4 * scale} fill="#3E5A4C" />
      <Rect x={x + 10 * scale} y={y - 14 * scale} width={w - 20 * scale} height={12 * scale} rx={2 * scale} fill="#9FE6C8" />
      {/* keys */}
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <Rect key={`${r}-${c}`} x={x + (7 + c * 11) * scale} y={y + (15 + r * 7) * scale} width={8 * scale} height={5 * scale} rx={1.5 * scale} fill="#FFFFFF" opacity={0.9} />
        )),
      )}
    </G>
  );
}

function TipJar({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 34 * scale;
  const h = 44 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.6)}
      {/* glass */}
      <Rect x={x} y={y + 6 * scale} width={w} height={h - 6 * scale} rx={6 * scale} fill="#CDEFFF" opacity={0.75} />
      <Rect x={x} y={y + 6 * scale} width={w} height={h - 6 * scale} rx={6 * scale} fill="none" stroke="#B4E0F2" strokeWidth={2 * scale} />
      {/* rim */}
      <Rect x={x - 2 * scale} y={y} width={w + 4 * scale} height={8 * scale} rx={3 * scale} fill="#E8F7FF" />
      {/* coins inside */}
      <Ellipse cx={cx - 6 * scale} cy={y + h - 10 * scale} rx={6 * scale} ry={3 * scale} fill={colors.gold} />
      <Ellipse cx={cx + 6 * scale} cy={y + h - 8 * scale} rx={6 * scale} ry={3 * scale} fill={colors.gold} />
      <Ellipse cx={cx} cy={y + h - 14 * scale} rx={6 * scale} ry={3 * scale} fill={colors.goldDark} />
      {/* heart label */}
      <Path d={`M${cx} ${y + 20 * scale} c${-3 * scale} ${-4 * scale} ${-9 * scale} ${-1 * scale} ${-5 * scale} ${4 * scale} l${5 * scale} ${5 * scale} l${5 * scale} ${-5 * scale} c${4 * scale} ${-5 * scale} ${-2 * scale} ${-8 * scale} ${-5 * scale} ${-4 * scale} Z`} fill={colors.primary} />
    </G>
  );
}

function StrawCup({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 26 * scale;
  const h = 30 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  const straws: [number, string][] = [
    [-7, colors.primary],
    [0, colors.mintDark],
    [7, colors.gold],
    [-3, colors.primaryDark],
    [4, colors.mint],
  ];
  return (
    <G>
      {shadow(cx, cy, w * 0.66)}
      {/* straws */}
      {straws.map(([dx, col], i) => (
        <Rect key={i} x={cx + dx * scale - 1.5 * scale} y={y - 14 * scale + (i % 2) * 3 * scale} width={3 * scale} height={22 * scale} rx={1.5 * scale} fill={col} />
      ))}
      {/* cup */}
      <Path d={`M${x} ${y} h${w} l${-2 * scale} ${h} h${-(w - 4 * scale)} Z`} fill="#FFFFFF" />
      <Path d={`M${x} ${y} h${w} l${-2 * scale} ${h} h${-(w - 4 * scale)} Z`} fill="none" stroke={colors.line} strokeWidth={2 * scale} />
      <Rect x={x + 3 * scale} y={y + 8 * scale} width={w - 6 * scale} height={6 * scale} rx={2 * scale} fill={colors.primaryTint} />
    </G>
  );
}

function NapkinBox({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 40 * scale;
  const h = 22 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.56)}
      <Rect x={x} y={y} width={w} height={h} rx={4 * scale} fill={colors.mint} />
      <Rect x={x} y={y} width={w} height={h} rx={4 * scale} fill="none" stroke={colors.mintDark} strokeWidth={2 * scale} />
      {/* slot + a napkin sticking up */}
      <Rect x={x + 8 * scale} y={y + 6 * scale} width={w - 16 * scale} height={4 * scale} rx={2 * scale} fill={colors.mintDark} />
      <Path d={`M${cx - 8 * scale} ${y + 6 * scale} h${16 * scale} l${-3 * scale} ${-9 * scale} h${-10 * scale} Z`} fill="#FFFFFF" />
      <Path d={`M${cx - 8 * scale} ${y + 6 * scale} h${16 * scale} l${-3 * scale} ${-9 * scale} h${-10 * scale} Z`} fill="none" stroke={colors.line} strokeWidth={1.2 * scale} />
    </G>
  );
}

function CupStack({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 30 * scale;
  const h = 34 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.64)}
      {/* nested lids/rims to suggest a stack */}
      {[0, 1, 2].map((i) => (
        <Rect key={i} x={x - i * 2 * scale} y={y + i * 7 * scale} width={w + i * 4 * scale} height={9 * scale} rx={4 * scale} fill={i % 2 === 0 ? '#FFFFFF' : colors.primaryTint} stroke={colors.line} strokeWidth={1.5 * scale} />
      ))}
      <Path d={`M${x - 4 * scale} ${y + 16 * scale} h${w + 8 * scale} l${-3 * scale} ${h - 16 * scale} h${-(w + 2 * scale)} Z`} fill="#FFFFFF" stroke={colors.line} strokeWidth={1.5 * scale} />
    </G>
  );
}

function Succulent({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const y = cy;
  return (
    <G transform={`translate(${cx} ${y}) scale(${scale})`}>
      {shadow(0, 0, 16)}
      {/* pot */}
      <Path d="M-11 -14 H11 L8 2 H-8 Z" fill={colors.counterEdge} />
      <Path d="M-11 -14 H11 L10 -9 H-10 Z" fill={colors.counter} />
      {/* rounded leaves */}
      <Ellipse cx={0} cy={-20} rx={5} ry={9} fill="#6FBF8A" />
      <Ellipse cx={-7} cy={-16} rx={4.5} ry={8} fill="#86D39F" transform="rotate(-24 -7 -16)" />
      <Ellipse cx={7} cy={-16} rx={4.5} ry={8} fill="#86D39F" transform="rotate(24 7 -16)" />
      <Ellipse cx={-4} cy={-19} rx={3.5} ry={6} fill="#9FE0B3" transform="rotate(-10 -4 -19)" />
      <Ellipse cx={4} cy={-19} rx={3.5} ry={6} fill="#9FE0B3" transform="rotate(10 4 -19)" />
    </G>
  );
}
