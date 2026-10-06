import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

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
  // The counter is drawn in 3D: a top surface that recedes away from us, a slab edge showing its
  // thickness, and a front face (the barista-side cabinet) going down to the floor.
  const surfaceH = Math.round(height * 0.52);
  const slab = Math.max(9, Math.round(height * 0.035));
  const faceTop = surfaceH + slab;
  // The far (back) edge of the surface is inset, so the top looks like it recedes in perspective.
  const inset = Math.min(width * 0.14, 64);
  const vpx = width / 2;

  // Props sit near the front of the surface; a back row is smaller for depth.
  const backY = surfaceH * 0.46;
  const frontY = surfaceH * 0.96;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="ctSurface" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.counter} />
          <Stop offset="1" stopColor={colors.counterLight} />
        </LinearGradient>
        <LinearGradient id="ctFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.counter} />
          <Stop offset="1" stopColor={colors.counterEdge} />
        </LinearGradient>
        <LinearGradient id="ctBackShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8A5A30" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#8A5A30" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Back wall behind the counter, so the perspective corners read as wall, not a gap. */}
      <Rect width={width} height={surfaceH} fill="#F3E6D5" />
      <Rect width={width} height={surfaceH} fill="url(#ctBackShade)" />

      {/* Receding top surface: a trapezoid, inset at the far edge. */}
      <Path d={`M0 ${surfaceH} L${inset} 0 H${width - inset} L${width} ${surfaceH} Z`} fill="url(#ctSurface)" />
      {/* Grain lines converging toward a vanishing point for perspective. */}
      {Array.from({ length: 7 }, (_, i) => {
        const fx = (i / 6) * width; // across the near (front) edge
        const bx = inset + (i / 6) * (width - 2 * inset); // across the far edge
        return <Path key={i} d={`M${fx} ${surfaceH} L${bx} 0`} stroke={colors.counterEdge} strokeWidth={1.4} opacity={0.14} />;
      })}
      {/* Soft shadow cast by the stage counter along the far edge. */}
      <Path d={`M0 ${surfaceH} L${inset} 0 H${width - inset} L${width} ${surfaceH} Z`} fill="url(#ctBackShade)" />

      {/* Slab edge (thickness of the counter top). */}
      <Rect y={surfaceH} width={width} height={slab} fill={colors.counterLight} />
      <Rect y={surfaceH} width={width} height={2} fill="#FFFFFF" opacity={0.4} />
      <Rect y={surfaceH + slab - 2} width={width} height={2} fill={colors.counterDark} opacity={0.5} />

      {/* Front face = the barista-side cabinet. */}
      <Rect y={faceTop} width={width} height={height - faceTop} fill="url(#ctFace)" />
      <CabinetDoors width={width} top={faceTop + 6} bottom={height - 6} />
      {/* kick plate / shadow */}
      <Rect y={height - 5} width={width} height={5} fill={colors.counterDark} />

      {/* Props on the surface. */}
      <NapkinBox cx={width * 0.22} cy={backY} scale={s * 0.82} />
      <StrawCup cx={vpx} cy={backY} scale={s * 0.82} />
      <Succulent cx={width * 0.8} cy={backY} scale={s * 0.82} />

      <Register cx={width * 0.26} cy={frontY} scale={s} />
      <CupStack cx={width * 0.56} cy={frontY} scale={s} />
      <TipJar cx={width * 0.83} cy={frontY} scale={s} />
    </Svg>
  );
});

/** The row of cabinet doors on the barista side of the counter front. */
function CabinetDoors({ width, top, bottom }: { width: number; top: number; bottom: number }) {
  const count = width < 340 ? 3 : 4;
  const gap = 10;
  const pad = 12;
  const doorW = (width - pad * 2 - gap * (count - 1)) / count;
  const doorH = bottom - top;
  return (
    <G>
      {Array.from({ length: count }, (_, i) => {
        const x = pad + i * (doorW + gap);
        const knobY = top + doorH * 0.5;
        return (
          <G key={i}>
            <Rect x={x} y={top} width={doorW} height={doorH} rx={8} fill={colors.counter} />
            <Rect x={x} y={top} width={doorW} height={doorH} rx={8} fill="none" stroke={colors.counterDark} strokeWidth={2} opacity={0.5} />
            <Rect x={x + 5} y={top + 5} width={doorW - 10} height={doorH - 10} rx={5} fill="none" stroke={colors.counterLight} strokeWidth={1.5} opacity={0.6} />
            {/* knob near the inner edge */}
            <Circle cx={i < count / 2 ? x + doorW - 10 : x + 10} cy={knobY} r={3.5} fill={colors.counterDark} />
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
