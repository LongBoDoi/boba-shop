import { memo } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

interface CounterTopProps {
  width: number;
  height: number;
}

// Wood + accent tones for the counter and cabinetry.
const WOOD_LIGHT = '#E7BB86';
const WOOD = colors.counter; // #D9A06B
const WOOD_EDGE = colors.counterEdge; // #B97F4C
const WOOD_DARK = '#9A6A3C';
const PANEL = '#C9915A';
const SEAM = '#7A5230';
const MINT = '#9FDCCB';
const MINT_DK = '#6FBFA9';

/**
 * The barista's side of the counter, below the customers on the Counter page. Drawn as a flat
 * front elevation (like a café cooking game): a slim wooden counter top crowded with themed props,
 * over a row of varied cabinetry — double doors, a drawer unit with pinned order tickets, a hanging
 * towel and a cat-themed cold box. Static.
 */
export const CounterTop = memo(function CounterTop({ width, height }: CounterTopProps) {
  if (height <= 0 || width <= 0) return null;
  const s = Math.min(1.15, width / 390);
  // Slim counter top: kept short (and capped) so the props nearly fill it and the cabinet dominates.
  const surfaceH = Math.max(68, Math.min(86, Math.round(height * 0.26)));
  const slab = Math.max(10, Math.round(height * 0.04));
  const faceTop = surfaceH + slab;
  const base = surfaceH; // props sit on the front of the counter top

  // Cabinet units span the width in varied widths (not a uniform grid).
  const b = [0, 0.3, 0.52, 0.74, 1].map((f) => f * width);
  const cabTop = faceTop + Math.min(16, (height - faceTop) * 0.12);
  const cabBottom = height - 12;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="ctSurface" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={WOOD_EDGE} />
          <Stop offset="1" stopColor={WOOD_LIGHT} />
        </LinearGradient>
        <LinearGradient id="ctFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={WOOD} />
          <Stop offset="1" stopColor="#B07A48" />
        </LinearGradient>
        <LinearGradient id="ctOverhang" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A2410" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#3A2410" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Counter top (flat), with straight grain and a lit near edge. */}
      <Rect width={width} height={surfaceH} fill="url(#ctSurface)" />
      {Array.from({ length: 3 }, (_, i) => (
        <Rect key={i} y={(i + 1) * (surfaceH / 4)} width={width} height={1.3} fill={WOOD_EDGE} opacity={0.14} />
      ))}

      {/* Slab (the counter's thickness): lit top, shadowed underside. */}
      <Rect y={surfaceH} width={width} height={slab} fill={colors.counterLight} />
      <Rect y={surfaceH} width={width} height={2.5} fill="#FFE6C8" opacity={0.75} />
      <Rect y={surfaceH + slab - 2} width={width} height={2} fill={SEAM} opacity={0.6} />

      {/* Cabinet body + overhang shadow. */}
      <Rect y={faceTop} width={width} height={height - faceTop} fill="url(#ctFace)" />
      <Rect y={faceTop} width={width} height={Math.min(14, (height - faceTop) * 0.18)} fill="url(#ctOverhang)" />

      {/* Varied cabinetry. */}
      <DoubleCabinet x0={b[0]} x1={b[1]} top={cabTop} bottom={cabBottom} />
      <DrawerUnit x0={b[1]} x1={b[2]} top={cabTop} bottom={cabBottom} />
      <ColdBox x0={b[2]} x1={b[3]} top={cabTop} bottom={cabBottom} s={s} />
      <DoubleCabinet x0={b[3]} x1={b[4]} top={cabTop} bottom={cabBottom} />

      {/* Order tickets pinned to the apron above the drawers; a towel over the first divider. */}
      <Notes x={(b[1] + b[2]) / 2} y={faceTop + 2} s={s} />
      <Towel x={b[1]} y={surfaceH + slab} s={s} />

      {/* recessed toe-kick */}
      <Rect y={height - 12} width={width} height={12} fill="#5E3C22" />
      <Rect y={height - 12} width={width} height={2} fill="#3A2410" opacity={0.6} />

      {/* Themed props crowding the counter top, left to right. */}
      <Register cx={width * 0.11} cy={base} scale={s * 0.88} />
      <CupStack cx={width * 0.23} cy={base} scale={s * 0.78} />
      <TipJar cx={width * 0.34} cy={base} scale={s * 0.84} />
      <LuckyCat cx={width * 0.47} cy={base} scale={s * 0.8} />
      <StrawCup cx={width * 0.58} cy={base} scale={s * 0.78} />
      <NapkinBox cx={width * 0.69} cy={base} scale={s * 0.82} />
      <MilkCarton cx={width * 0.85} cy={base} scale={s * 0.88} />
    </Svg>
  );
});

// ---------------------------------------------------------------------------- cabinetry

function DoubleCabinet({ x0, x1, top, bottom }: { x0: number; x1: number; top: number; bottom: number }) {
  const pad = 8;
  const gap = 7;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const doorW = (w - gap) / 2;
  return (
    <G>
      {[0, 1].map((i) => {
        const dx = x + i * (doorW + gap);
        const handleX = i === 0 ? dx + doorW - 8 : dx + 8;
        return <Door key={i} x={dx} y={top} w={doorW} h={h} handleX={handleX} />;
      })}
    </G>
  );
}

function Door({ x, y, w, h, handleX }: { x: number; y: number; w: number; h: number; handleX: number }) {
  const rail = Math.min(12, w * 0.16);
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={5} fill={WOOD} />
      <Rect x={x} y={y} width={w} height={2} fill="#F0CDA0" opacity={0.6} />
      <Rect x={x} y={y + h - 2} width={w} height={2} fill={WOOD_DARK} opacity={0.6} />
      <Rect x={x + rail} y={y + rail} width={w - rail * 2} height={h - rail * 2} rx={4} fill={PANEL} />
      <Rect x={x + rail} y={y + rail} width={w - rail * 2} height={2} fill={WOOD_DARK} opacity={0.55} />
      <Rect x={x + rail} y={y + h - rail - 2} width={w - rail * 2} height={2} fill="#E7BB86" opacity={0.55} />
      <Rect x={handleX - 2} y={y + h * 0.44} width={4} height={h * 0.12} rx={2} fill="#E8DCCB" />
    </G>
  );
}

function DrawerUnit({ x0, x1, top, bottom }: { x0: number; x1: number; top: number; bottom: number }) {
  const pad = 8;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const n = 3;
  const gap = 6;
  const dh = (h - gap * (n - 1)) / n;
  return (
    <G>
      {Array.from({ length: n }, (_, i) => {
        const y = top + i * (dh + gap);
        return (
          <G key={i}>
            <Rect x={x} y={y} width={w} height={dh} rx={5} fill={WOOD} />
            <Rect x={x} y={y} width={w} height={2} fill="#F0CDA0" opacity={0.55} />
            <Rect x={x} y={y + dh - 2} width={w} height={2} fill={WOOD_DARK} opacity={0.6} />
            {/* bar pull */}
            <Rect x={x + w * 0.3} y={y + dh * 0.42} width={w * 0.4} height={4} rx={2} fill="#E8DCCB" />
          </G>
        );
      })}
    </G>
  );
}

/** A cat-themed cold box / mini-fridge, like the appliance in the reference. */
function ColdBox({ x0, x1, top, bottom, s }: { x0: number; x1: number; top: number; bottom: number; s: number }) {
  const pad = 8;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const cx = x + w / 2;
  return (
    <G>
      <Rect x={x} y={top} width={w} height={h} rx={8} fill={MINT} />
      <Rect x={x} y={top} width={w} height={h} rx={8} fill="none" stroke={MINT_DK} strokeWidth={2} />
      {/* lid line */}
      <Rect x={x + 5} y={top + h * 0.34} width={w - 10} height={2.5} rx={1} fill={MINT_DK} opacity={0.7} />
      {/* frosty window */}
      <Rect x={x + w * 0.2} y={top + h * 0.1} width={w * 0.6} height={h * 0.18} rx={5} fill="#DFF5EF" />
      {[0, 1, 2].map((i) => (
        <Rect key={i} x={x + w * (0.28 + i * 0.16)} y={top + h * 0.13} width={3} height={h * 0.12} rx={1.5} fill={MINT_DK} opacity={0.5} />
      ))}
      {/* paw badge */}
      <G transform={`translate(${cx} ${top + h * 0.64}) scale(${s})`}>
        <Ellipse cx={0} cy={2} rx={7} ry={6} fill="#FFFFFF" />
        <Ellipse cx={-5} cy={-5} rx={2} ry={2.6} fill="#FFFFFF" />
        <Ellipse cx={0} cy={-7} rx={2} ry={2.6} fill="#FFFFFF" />
        <Ellipse cx={5} cy={-5} rx={2} ry={2.6} fill="#FFFFFF" />
      </G>
      {/* handle */}
      <Rect x={x + w - 12} y={top + h * 0.42} width={4} height={h * 0.16} rx={2} fill="#FFFFFF" />
    </G>
  );
}

/** Pinned order-ticket cards on the apron. */
function Notes({ x, y, s }: { x: number; y: number; s: number }) {
  const cards: number[] = [-1, 0, 1];
  return (
    <G>
      {cards.map((d) => {
        const cx = x + d * 22 * s;
        const cy = y + (d === 0 ? 0 : 1 * s);
        return (
          <G key={d}>
            <Rect x={cx - 9 * s} y={cy} width={18 * s} height={22 * s} rx={2 * s} fill="#FFFDF2" stroke={colors.line} strokeWidth={1} />
            {[0, 1, 2].map((i) => (
              <Rect key={i} x={cx - 6 * s} y={cy + (5 + i * 4) * s} width={12 * s} height={1.6 * s} rx={0.8 * s} fill={colors.inkSoft} opacity={0.6} />
            ))}
            {/* clip */}
            <Rect x={cx - 4 * s} y={cy - 3 * s} width={8 * s} height={4 * s} rx={1.5 * s} fill={colors.counterDark} />
          </G>
        );
      })}
    </G>
  );
}

/** A dish towel hanging over the counter edge. */
function Towel({ x, y, s }: { x: number; y: number; s: number }) {
  const w = 22 * s;
  const h = 46 * s;
  return (
    <G>
      <Rect x={x - w / 2} y={y - 3 * s} width={w} height={h} rx={4 * s} fill={colors.primary} />
      <Rect x={x - w / 2} y={y - 3 * s} width={w} height={h} rx={4 * s} fill="none" stroke={colors.primaryDark} strokeWidth={1.5} opacity={0.5} />
      <Rect x={x - w / 2} y={y + h - 10 * s} width={w} height={2.5 * s} fill="#FFFFFF" opacity={0.7} />
      <Rect x={x - w / 2} y={y + h - 6 * s} width={w} height={2.5 * s} fill="#FFFFFF" opacity={0.7} />
      {/* fold over the edge */}
      <Rect x={x - w / 2} y={y - 4 * s} width={w} height={6 * s} rx={3 * s} fill={colors.primaryDark} />
    </G>
  );
}

// ---------------------------------------------------------------------------- counter props

function shadow(cx: number, cy: number, rx: number) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.26} fill="#000000" opacity={0.1} />;
}

function Register({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 54 * scale;
  const h = 38 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.52)}
      <Rect x={x} y={y + 10 * scale} width={w} height={h - 10 * scale} rx={5 * scale} fill={colors.primary} />
      <Rect x={x} y={y + h - 8 * scale} width={w} height={8 * scale} rx={4 * scale} fill={colors.primaryDark} />
      <Rect x={cx - 3 * scale} y={y - 2 * scale} width={6 * scale} height={14 * scale} fill={colors.counterEdge} />
      <Rect x={x + 6 * scale} y={y - 18 * scale} width={w - 12 * scale} height={20 * scale} rx={4 * scale} fill="#3E5A4C" />
      <Rect x={x + 10 * scale} y={y - 14 * scale} width={w - 20 * scale} height={12 * scale} rx={2 * scale} fill="#9FE6C8" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <Rect key={`${r}-${c}`} x={x + (6 + c * 11) * scale} y={y + (15 + r * 7) * scale} width={8 * scale} height={5 * scale} rx={1.5 * scale} fill="#FFFFFF" opacity={0.9} />
        )),
      )}
    </G>
  );
}

function TipJar({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 32 * scale;
  const h = 42 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  return (
    <G>
      {shadow(cx, cy, w * 0.6)}
      <Rect x={x} y={y + 6 * scale} width={w} height={h - 6 * scale} rx={6 * scale} fill="#CDEFFF" opacity={0.75} />
      <Rect x={x} y={y + 6 * scale} width={w} height={h - 6 * scale} rx={6 * scale} fill="none" stroke="#B4E0F2" strokeWidth={2 * scale} />
      <Rect x={x - 2 * scale} y={y} width={w + 4 * scale} height={8 * scale} rx={3 * scale} fill="#E8F7FF" />
      <Ellipse cx={cx - 6 * scale} cy={y + h - 10 * scale} rx={6 * scale} ry={3 * scale} fill={colors.gold} />
      <Ellipse cx={cx + 6 * scale} cy={y + h - 8 * scale} rx={6 * scale} ry={3 * scale} fill={colors.gold} />
      <Ellipse cx={cx} cy={y + h - 14 * scale} rx={6 * scale} ry={3 * scale} fill={colors.goldDark} />
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
      {straws.map(([dx, col], i) => (
        <Rect key={i} x={cx + dx * scale - 1.5 * scale} y={y - 14 * scale + (i % 2) * 3 * scale} width={3 * scale} height={22 * scale} rx={1.5 * scale} fill={col} />
      ))}
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
      {[0, 1, 2].map((i) => (
        <Rect key={i} x={x - i * 2 * scale} y={y + i * 7 * scale} width={w + i * 4 * scale} height={9 * scale} rx={4 * scale} fill={i % 2 === 0 ? '#FFFFFF' : colors.primaryTint} stroke={colors.line} strokeWidth={1.5 * scale} />
      ))}
      <Path d={`M${x - 4 * scale} ${y + 16 * scale} h${w + 8 * scale} l${-3 * scale} ${h - 16 * scale} h${-(w + 2 * scale)} Z`} fill="#FFFFFF" stroke={colors.line} strokeWidth={1.5 * scale} />
    </G>
  );
}

/** A maneki-neko (lucky cat), a nod to the reference's cat theme. */
function LuckyCat({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  return (
    <G transform={`translate(${cx} ${cy}) scale(${scale})`}>
      {shadow(0, 0, 20)}
      {/* body */}
      <Path d="M-15 0 C-15 -20 -10 -30 0 -30 C10 -30 15 -20 15 0 Z" fill="#FFFFFF" stroke={colors.counterEdge} strokeWidth={1.5} />
      {/* head */}
      <Ellipse cx={0} cy={-30} rx={15} ry={13} fill="#FFFFFF" stroke={colors.counterEdge} strokeWidth={1.5} />
      {/* ears */}
      <Path d="M-14 -38 l-3 -9 l8 4 Z" fill="#FFFFFF" stroke={colors.counterEdge} strokeWidth={1.5} />
      <Path d="M14 -38 l3 -9 l-8 4 Z" fill="#FFFFFF" stroke={colors.counterEdge} strokeWidth={1.5} />
      <Path d="M-13 -40 l-1.5 -5 l4.5 2 Z" fill={colors.primaryTint} />
      <Path d="M13 -40 l1.5 -5 l-4.5 2 Z" fill={colors.primaryTint} />
      {/* face */}
      <Path d="M-6 -32 q2 2 4 0" stroke={colors.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M2 -32 q2 2 4 0" stroke={colors.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M0 -29 l-1.5 2 h3 Z" fill={colors.primary} />
      {/* raised paw */}
      <Ellipse cx={11} cy={-14} rx={5} ry={6} fill="#FFFFFF" stroke={colors.counterEdge} strokeWidth={1.5} />
      {/* gold collar + coin */}
      <Path d="M-9 -20 q9 7 18 0" stroke={colors.goldDark} strokeWidth={2.5} fill="none" />
      <Ellipse cx={0} cy={-14} rx={5} ry={6} fill={colors.gold} stroke={colors.goldDark} strokeWidth={1.5} />
    </G>
  );
}

/** A tall milk carton, a nod to the reference's MILK box. */
function MilkCarton({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const w = 34 * scale;
  const bodyH = 48 * scale;
  const roofH = 14 * scale;
  const x = cx - w / 2;
  const y = cy - bodyH;
  return (
    <G>
      {shadow(cx, cy, w * 0.62)}
      {/* body */}
      <Rect x={x} y={y} width={w} height={bodyH} rx={2 * scale} fill="#FFFFFF" stroke={colors.line} strokeWidth={1.5} />
      {/* gable roof */}
      <Path d={`M${x} ${y} L${cx} ${y - roofH} L${x + w} ${y} Z`} fill="#F3F7FF" stroke={colors.line} strokeWidth={1.5} />
      <Rect x={cx - 2 * scale} y={y - roofH} width={4 * scale} height={5 * scale} fill="#E4ECF7" />
      {/* label */}
      <Rect x={x + 4 * scale} y={y + bodyH * 0.3} width={w - 8 * scale} height={bodyH * 0.42} rx={3 * scale} fill={colors.primaryTint} />
      <Path d={`M${cx - 10 * scale} ${y + bodyH * 0.54} h${20 * scale}`} stroke={colors.primaryDark} strokeWidth={3 * scale} strokeLinecap="round" />
      <Path d={`M${cx - 7 * scale} ${y + bodyH * 0.66} h${14 * scale}`} stroke={colors.primary} strokeWidth={2 * scale} strokeLinecap="round" opacity={0.8} />
      {/* a splash/drop icon */}
      <Path d={`M${cx} ${y + bodyH * 0.4} c${-3 * scale} ${3 * scale} ${-3 * scale} ${7 * scale} ${0} ${7 * scale} c${3 * scale} ${0} ${3 * scale} ${-4 * scale} ${0} ${-7 * scale} Z`} fill="#FFFFFF" />
    </G>
  );
}
