import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme';

interface KitchenBackdropProps {
  width: number;
  height: number;
}

// The same wood tones the front counter uses, so the two pages read as one shop.
const WOOD_LIGHT = '#E7BB86';
const WOOD_EDGE = colors.counterEdge; // #B97F4C
const SEAM = '#7A5230';

/**
 * The bare back wall of the barista's kitchen: the same striped pink wallpaper, scalloped awning and
 * warm wooden counter as the Counter page's `ShopBackdrop` / `CounterTop`, so swiping between the two
 * screens feels like turning around inside one shop. The supplies that stock this wall are the tappable
 * `IngredientShelves` drawn on top; this component only paints the room around them.
 */
export const KitchenBackdrop = memo(function KitchenBackdrop({ width: w, height: h }: KitchenBackdropProps) {
  if (w <= 0 || h <= 0) return null;
  const stripe = 22;
  const awningH = Math.max(7, Math.round(h * 0.026));
  const counterY = Math.round(h * 0.66); // top of the wooden work counter the cup/recipe sit on
  const slab = Math.max(8, Math.round(h * 0.028));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="kbWood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WOOD_EDGE} />
            <Stop offset="1" stopColor={WOOD_LIGHT} />
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

        {/* Wooden work counter across the bottom — continues the front counter's wood. */}
        <Rect y={counterY} width={w} height={h - counterY} fill="url(#kbWood)" />
        <Rect y={counterY} width={w} height={slab} fill={colors.counterLight} />
        <Rect y={counterY} width={w} height={2.5} fill="#FFE6C8" opacity={0.75} />
        <Rect y={counterY + slab - 2} width={w} height={2} fill={SEAM} opacity={0.5} />
        {[0.4, 0.75].map((f) => (
          <Rect key={f} y={counterY + slab + (h - counterY - slab) * f} width={w} height={1.3} fill={WOOD_EDGE} opacity={0.16} />
        ))}
      </Svg>
    </View>
  );
});
