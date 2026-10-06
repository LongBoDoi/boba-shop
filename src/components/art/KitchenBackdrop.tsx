import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { TEAS } from '../../game/ingredients';
import { colors } from '../../theme';
import { shade } from './Character';

interface KitchenBackdropProps {
  width: number;
  height: number;
}

// The same wood + accent palette the front counter uses, so the two pages read as one shop.
const WOOD_LIGHT = '#E7BB86';
const WOOD = colors.counter; // #D9A06B
const WOOD_EDGE = colors.counterEdge; // #B97F4C
const WOOD_DARK = '#9A6A3C';
const SEAM = '#7A5230';
const MINT = colors.mint;
const MINT_DK = colors.mintDark;

/**
 * The back wall of the barista's kitchen, behind the prep station. Deliberately drawn in the same
 * language as the Counter page's `ShopBackdrop` + `CounterTop` — striped pink wallpaper, a scalloped
 * awning along the top and a warm wooden work counter across the bottom — so swiping between the two
 * screens feels like turning around inside one shop. The wall is stocked like a real tea kitchen:
 * shelves of tea canisters and topping jars, a utensil pegboard, and supplies standing on the counter.
 * Purely decorative; the machine, order ticket and ingredient panel sit on top of it.
 */
export const KitchenBackdrop = memo(function KitchenBackdrop({ width: w, height: h }: KitchenBackdropProps) {
  if (w <= 0 || h <= 0) return null;
  const s = Math.min(1.12, w / 360);
  const stripe = 22;
  const awningH = Math.max(7, Math.round(h * 0.028));
  const counterY = Math.round(h * 0.6); // top of the wooden work counter
  const slab = Math.max(8, Math.round(h * 0.03));

  // Two wall shelves on the right (above the machine); the left wall carries the pinned order ticket.
  const shelfA = { y: Math.round(h * 0.13), x0: w * 0.42, x1: w * 0.99 }; // topping jars + straws
  const shelfB = { y: Math.round(h * 0.37), x0: w * 0.42, x1: w * 0.99 }; // tea canisters

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="kbWood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WOOD_EDGE} />
            <Stop offset="1" stopColor={WOOD_LIGHT} />
          </LinearGradient>
          <LinearGradient id="kbGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#E9F6FF" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Wallpaper: the same pink stripes as the customer side. */}
        <Rect width={w} height={counterY} fill={colors.wall} />
        {Array.from({ length: Math.ceil(w / stripe / 2) }, (_, i) => (
          <Rect key={i} x={i * stripe * 2} y={awningH} width={stripe} height={counterY - awningH} fill={colors.wallStripe} />
        ))}

        {/* Scalloped awning along the very top — the shop's signature trim. */}
        <Rect width={w} height={awningH * 0.6} fill={colors.primary} />
        {Array.from({ length: Math.ceil(w / 24) }, (_, i) => (
          <Path key={i} d={`M${i * 24} ${awningH * 0.55} h24 a12 12 0 0 1 -24 0 Z`} fill={i % 2 === 0 ? colors.primary : '#FFFFFF'} />
        ))}

        {/* Utensil pegboard, tucked top-right between the awning and the first shelf. */}
        <Pegboard x={w - 92 * s} y={awningH + 4 * s} s={s} />

        {/* Upper shelf: topping jars + a tub of straws. */}
        <Shelf x0={shelfA.x0} x1={shelfA.x1} y={shelfA.y} s={s} />
        <ToppingJar cx={shelfA.x0 + 26 * s} baseY={shelfA.y} s={s} lid={colors.primary} piece="#3A2318" round />
        <ToppingJar cx={shelfA.x0 + 64 * s} baseY={shelfA.y} s={s} lid={MINT_DK} piece="#F0506E" round />
        <ToppingJar cx={shelfA.x0 + 102 * s} baseY={shelfA.y} s={s} lid={colors.gold} piece="#F4EEDC" round={false} />
        <StrawTub cx={shelfA.x1 - 26 * s} baseY={shelfA.y} s={s} />

        {/* Lower shelf: a row of coloured tea canisters + a little kettle. */}
        <Shelf x0={shelfB.x0} x1={shelfB.x1} y={shelfB.y} s={s} />
        {TEAS.slice(0, 5).map((tea, i) => (
          <TeaCanister key={tea.id} cx={shelfB.x0 + (24 + i * 30) * s} baseY={shelfB.y} s={s} color={tea.color} />
        ))}
        <Kettle cx={shelfB.x1 - 24 * s} baseY={shelfB.y} s={s} />

        {/* Wooden work counter across the bottom — continues the front counter's wood. */}
        <Rect y={counterY} width={w} height={h - counterY} fill="url(#kbWood)" />
        <Rect y={counterY} width={w} height={slab} fill={colors.counterLight} />
        <Rect y={counterY} width={w} height={2.5} fill="#FFE6C8" opacity={0.75} />
        <Rect y={counterY + slab - 2} width={w} height={2} fill={SEAM} opacity={0.5} />
        {[0.34, 0.68].map((f) => (
          <Rect key={f} y={counterY + slab + (h - counterY - slab) * f} width={w} height={1.3} fill={WOOD_EDGE} opacity={0.16} />
        ))}

        {/* Supplies standing on the counter, lower-left (behind the pinned ticket if it runs long). */}
        <CupStack cx={w * 0.09} baseY={h - 6 * s} s={s} />
        <Blender cx={w * 0.26} baseY={h - 6 * s} s={s} />
        <MilkJug cx={w * 0.42} baseY={h - 6 * s} s={s} />
      </Svg>
    </View>
  );
});

// --------------------------------------------------------------------------- wall fittings

/** A wooden plank shelf with two little triangular brackets. */
function Shelf({ x0, x1, y, s }: { x0: number; x1: number; y: number; s: number }) {
  const w = x1 - x0;
  const th = 8 * s;
  return (
    <G>
      <Rect x={x0} y={y} width={w} height={th} rx={2 * s} fill={WOOD} />
      <Rect x={x0} y={y} width={w} height={2} fill="#F0CDA0" opacity={0.7} />
      <Rect x={x0} y={y + th - 2} width={w} height={2} fill={WOOD_DARK} opacity={0.7} />
      {[x0 + 10 * s, x1 - 10 * s].map((bx, i) => (
        <Path key={i} d={`M${bx} ${y + th} l${6 * s} 0 l${-6 * s} ${9 * s} Z`} fill={WOOD_DARK} opacity={0.85} />
      ))}
      <Ellipse cx={(x0 + x1) / 2} cy={y - 1} rx={w / 2 - 4 * s} ry={2 * s} fill="#00000010" />
    </G>
  );
}

/** A small pegboard with a whisk and a strainer hanging — a bit of real-kitchen life. */
function Pegboard({ x, y, s }: { x: number; y: number; s: number }) {
  const w = 84 * s;
  const h = 44 * s;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={5 * s} fill="#F6E2C9" stroke={WOOD_EDGE} strokeWidth={1.5} />
      {Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <Circle key={`${r}-${c}`} cx={x + (10 + c * 13) * s} cy={y + (10 + r * 13) * s} r={1.2 * s} fill={WOOD_EDGE} opacity={0.4} />
        )),
      )}
      {/* whisk */}
      <G>
        <Rect x={x + 18 * s} y={y + 8 * s} width={3 * s} height={14 * s} rx={1.5 * s} fill={WOOD_DARK} />
        <Path d={`M${x + 19 * s} ${y + 20 * s} q${-7 * s} ${8 * s} 0 ${14 * s} q${7 * s} ${-6 * s} 0 ${-14 * s}`} fill="none" stroke="#C9CDD4" strokeWidth={1.4 * s} />
        <Path d={`M${x + 19 * s} ${y + 20 * s} q${7 * s} ${8 * s} 0 ${14 * s}`} fill="none" stroke="#C9CDD4" strokeWidth={1.4 * s} />
      </G>
      {/* strainer */}
      <G>
        <Circle cx={x + 52 * s} cy={y + 20 * s} r={11 * s} fill="none" stroke="#C9CDD4" strokeWidth={2 * s} />
        <Path d={`M${x + 42 * s} ${y + 20 * s} h${20 * s} M${x + 52 * s} ${y + 10 * s} v${20 * s}`} stroke="#C9CDD4" strokeWidth={1 * s} opacity={0.7} />
        <Rect x={x + 62 * s} y={y + 18 * s} width={16 * s} height={3.5 * s} rx={1.5 * s} fill={WOOD_DARK} />
      </G>
    </G>
  );
}

// --------------------------------------------------------------------------- shelf supplies

/** A coloured tea canister (tin) with a lid and a paper label. */
function TeaCanister({ cx, baseY, s, color }: { cx: number; baseY: number; s: number; color: string }) {
  const w = 24 * s;
  const bodyH = 34 * s;
  const x = cx - w / 2;
  const y = baseY - bodyH;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={bodyH} rx={3 * s} fill={color} />
      <Rect x={x} y={y} width={3 * s} height={bodyH} rx={1.5 * s} fill="#FFFFFF" opacity={0.22} />
      <Rect x={x - 1.5 * s} y={y - 5 * s} width={w + 3 * s} height={7 * s} rx={2 * s} fill={shade(color, -26)} />
      <Rect x={x + 3 * s} y={y + 11 * s} width={w - 6 * s} height={12 * s} rx={2 * s} fill="#FFFDF2" opacity={0.95} />
      <Rect x={x + 5 * s} y={y + 14 * s} width={w - 10 * s} height={1.6 * s} rx={0.8 * s} fill={color} opacity={0.6} />
      <Rect x={x + 5 * s} y={y + 18 * s} width={(w - 10 * s) * 0.6} height={1.6 * s} rx={0.8 * s} fill={color} opacity={0.4} />
    </G>
  );
}

/** A glass jar of pearls / jelly cubes. */
function ToppingJar({
  cx,
  baseY,
  s,
  lid,
  piece,
  round,
}: {
  cx: number;
  baseY: number;
  s: number;
  lid: string;
  piece: string;
  round: boolean;
}) {
  const w = 24 * s;
  const bodyH = 30 * s;
  const x = cx - w / 2;
  const y = baseY - bodyH;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={bodyH} rx={5 * s} fill="url(#kbGlass)" stroke="#E7D5C5" strokeWidth={1.3} />
      {Array.from({ length: 6 }, (_, k) => {
        const px = x + 6 * s + (k % 3) * 6 * s;
        const py = baseY - 5 * s - Math.floor(k / 3) * 6 * s;
        return round ? (
          <Circle key={k} cx={px} cy={py} r={3 * s} fill={piece} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
        ) : (
          <Rect key={k} x={px - 2.6 * s} y={py - 2.6 * s} width={5.2 * s} height={5.2 * s} rx={1.2 * s} fill={piece} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
        );
      })}
      <Rect x={x - 1.5 * s} y={y - 5 * s} width={w + 3 * s} height={7 * s} rx={3 * s} fill={lid} />
      <Rect x={x + 3 * s} y={y + 3 * s} width={2.5 * s} height={bodyH * 0.7} rx={1.2 * s} fill="#FFFFFF" opacity={0.6} />
    </G>
  );
}

/** A tub bristling with colourful paper straws. */
function StrawTub({ cx, baseY, s }: { cx: number; baseY: number; s: number }) {
  const w = 22 * s;
  const bodyH = 22 * s;
  const x = cx - w / 2;
  const y = baseY - bodyH;
  const straws: [number, string][] = [
    [-6, colors.primary],
    [-2, MINT_DK],
    [2, colors.gold],
    [6, colors.primaryDark],
  ];
  return (
    <G>
      {straws.map(([dx, col], i) => (
        <Rect key={i} x={cx + dx * s - 1.4 * s} y={y - 13 * s + (i % 2) * 3 * s} width={2.8 * s} height={20 * s} rx={1.4 * s} fill={col} />
      ))}
      <Path d={`M${x} ${y} h${w} l${-2 * s} ${bodyH} h${-(w - 4 * s)} Z`} fill="#FFFFFF" stroke="#E7D5C5" strokeWidth={1.4} />
      <Rect x={x + 3 * s} y={y + 7 * s} width={w - 6 * s} height={5 * s} rx={2 * s} fill={colors.primaryTint} />
    </G>
  );
}

/** A little stovetop kettle. */
function Kettle({ cx, baseY, s }: { cx: number; baseY: number; s: number }) {
  const r = 13 * s;
  const cy = baseY - r - 2 * s;
  return (
    <G>
      <Ellipse cx={cx} cy={baseY - 1} rx={r} ry={3 * s} fill="#00000010" />
      <Path d={`M${cx - r} ${cy} a${r} ${r} 0 1 1 ${r * 2} 0 l${-2 * s} ${r + 1 * s} h${-(r * 2 - 4 * s)} Z`} fill={MINT} stroke={MINT_DK} strokeWidth={1.4} />
      <Path d={`M${cx - r} ${cy - 1 * s} q${-6 * s} ${-9 * s} 2 ${-11 * s}`} fill="none" stroke={MINT_DK} strokeWidth={2.4 * s} strokeLinecap="round" />
      <Rect x={cx - 3 * s} y={cy - r - 4 * s} width={6 * s} height={5 * s} rx={2 * s} fill={WOOD_DARK} />
      <Ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r * 0.3} fill="#FFFFFF" opacity={0.3} />
    </G>
  );
}

// --------------------------------------------------------------------------- counter supplies

/** A stack of to-go cups and one upright cup. */
function CupStack({ cx, baseY, s }: { cx: number; baseY: number; s: number }) {
  const w = 26 * s;
  const x = cx - w / 2;
  const topY = baseY - 30 * s;
  return (
    <G>
      <Ellipse cx={cx} cy={baseY - 1} rx={w * 0.7} ry={3 * s} fill="#00000012" />
      {[0, 1, 2].map((i) => (
        <Rect
          key={i}
          x={x - i * 1.5 * s}
          y={topY + i * 6 * s}
          width={w + i * 3 * s}
          height={8 * s}
          rx={3.5 * s}
          fill={i % 2 === 0 ? '#FFFFFF' : colors.primaryTint}
          stroke={colors.line}
          strokeWidth={1.3}
        />
      ))}
      <Path d={`M${x - 3 * s} ${topY + 14 * s} h${w + 6 * s} l${-2.5 * s} ${16 * s} h${-(w + 1 * s)} Z`} fill="#FFFFFF" stroke={colors.line} strokeWidth={1.3} />
    </G>
  );
}

/** A mint blender, echoing the sealing machine and the fridge on the front counter. */
function Blender({ cx, baseY, s }: { cx: number; baseY: number; s: number }) {
  const w = 30 * s;
  const x = cx - w / 2;
  const baseH = 16 * s;
  const jarH = 30 * s;
  const jarY = baseY - baseH - jarH;
  return (
    <G>
      <Ellipse cx={cx} cy={baseY - 1} rx={w * 0.66} ry={3 * s} fill="#00000012" />
      {/* motor base */}
      <Path d={`M${x} ${baseY - baseH} h${w} l${-3 * s} ${baseH} h${-(w - 6 * s)} Z`} fill={MINT} stroke={MINT_DK} strokeWidth={1.4} />
      <Circle cx={cx} cy={baseY - baseH + 7 * s} r={3.5 * s} fill={MINT_DK} />
      <Circle cx={cx} cy={baseY - baseH + 7 * s} r={1.4 * s} fill="#DFF5EF" />
      {/* jar */}
      <Rect x={x + 3 * s} y={jarY} width={w - 6 * s} height={jarH} rx={3 * s} fill="url(#kbGlass)" stroke="#D9E8E2" strokeWidth={1.3} />
      <Rect x={x + 3 * s} y={jarY + jarH * 0.45} width={w - 6 * s} height={jarH * 0.55} rx={3 * s} fill={colors.primaryTint} opacity={0.75} />
      <Rect x={x + 1.5 * s} y={jarY - 4 * s} width={w - 3 * s} height={6 * s} rx={2 * s} fill={MINT_DK} />
      <Rect x={x + 8 * s} y={jarY + 5 * s} width={2.4 * s} height={jarH * 0.7} rx={1.2 * s} fill="#FFFFFF" opacity={0.6} />
    </G>
  );
}

/** A milk jug with a handle. */
function MilkJug({ cx, baseY, s }: { cx: number; baseY: number; s: number }) {
  const w = 26 * s;
  const bodyH = 30 * s;
  const x = cx - w / 2;
  const y = baseY - bodyH;
  return (
    <G>
      <Ellipse cx={cx} cy={baseY - 1} rx={w * 0.64} ry={3 * s} fill="#00000012" />
      <Path d={`M${x} ${y + 4 * s} q0 ${-4 * s} ${4 * s} ${-4 * s} h${w - 8 * s} q${4 * s} 0 ${4 * s} ${4 * s} v${bodyH - 8 * s} q0 ${4 * s} ${-4 * s} ${4 * s} h${-(w - 8 * s)} q${-4 * s} 0 ${-4 * s} ${-4 * s} Z`} fill="#FFFFFF" stroke="#DED2C4" strokeWidth={1.4} />
      {/* spout */}
      <Path d={`M${x} ${y + 6 * s} l${-4 * s} ${-3 * s} l${3 * s} ${6 * s} Z`} fill="#FFFFFF" stroke="#DED2C4" strokeWidth={1.2} />
      {/* handle */}
      <Path d={`M${x + w} ${y + 7 * s} q${7 * s} ${2 * s} ${7 * s} ${9 * s} q0 ${6 * s} ${-6 * s} ${7 * s}`} fill="none" stroke="#DED2C4" strokeWidth={2.4 * s} />
      <Rect x={x + 4 * s} y={y + bodyH * 0.5} width={w - 8 * s} height={2.4 * s} rx={1.2 * s} fill={colors.mint} opacity={0.8} />
    </G>
  );
}
