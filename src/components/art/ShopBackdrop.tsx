import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '../../theme';

interface ShopBackdropProps {
  width: number;
  height: number;
}

/** The wall behind the customers: striped wallpaper, a window with slowly drifting clouds, lamps and a menu board. */
export const ShopBackdrop = memo(function ShopBackdrop({ width, height }: ShopBackdropProps) {
  const stripe = 22;
  const awning = 16;
  const win = { x: width * 0.05, y: awning + 16, w: Math.min(120, width * 0.3), h: height * 0.42 };
  const board = { w: Math.min(104, width * 0.27), h: height * 0.4 };
  const boardX = width - board.w - width * 0.05;
  const boardY = awning + 14;
  const wainscot = height * 0.6;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.sky} />
            <Stop offset="1" stopColor={colors.skyLow} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={colors.wall} />
        {Array.from({ length: Math.ceil(width / stripe / 2) }, (_, i) => (
          <Rect key={i} x={i * stripe * 2} width={stripe} height={wainscot} fill={colors.wallStripe} />
        ))}
        <Rect y={wainscot} width={width} height={height - wainscot} fill="#F9C9D8" />
        <Rect y={wainscot} width={width} height={4} fill="#F3B3C7" />

        <Rect x={win.x - 4} y={win.y - 4} width={win.w + 8} height={win.h + 8} rx={10} fill="#FFFFFF" />
        <Rect x={win.x} y={win.y} width={win.w} height={win.h} rx={7} fill="url(#sky)" />
        <Circle cx={win.x + win.w * 0.78} cy={win.y + win.h * 0.3} r={8} fill="#FFE27A" />

        <G transform={`rotate(-3 ${boardX + board.w / 2} ${boardY + board.h / 2})`}>
          <Rect x={boardX} y={boardY} width={board.w} height={board.h} rx={8} fill={colors.counterEdge} />
          <Rect x={boardX + 4} y={boardY + 4} width={board.w - 8} height={board.h - 8} rx={5} fill="#3E5A4C" />
          <SvgText
            x={boardX + board.w / 2}
            y={boardY + 20}
            fill="#FFFFFF"
            fontSize={13}
            fontFamily={fonts.display}
            textAnchor="middle"
          >
            MENU
          </SvgText>
          {[0, 1, 2].map((row) => (
            <G key={row}>
              <Rect x={boardX + 10} y={boardY + 28 + row * 10} width={board.w * 0.42} height={2.5} rx={1} fill="#FFFFFF" opacity={0.75} />
              <Rect x={boardX + board.w - 26} y={boardY + 28 + row * 10} width={14} height={2.5} rx={1} fill="#FFD36E" opacity={0.9} />
            </G>
          ))}
        </G>

        {/* Scalloped awning along the top. */}
        <Rect width={width} height={awning * 0.6} fill={colors.primary} />
        {Array.from({ length: Math.ceil(width / 24) }, (_, i) => (
          <Path
            key={i}
            d={`M${i * 24} ${awning * 0.55} h24 a12 12 0 0 1 -24 0 Z`}
            fill={i % 2 === 0 ? colors.primary : '#FFFFFF'}
          />
        ))}
      </Svg>

      <View style={[styles.window, { left: win.x, top: win.y, width: win.w, height: win.h }]}>
        <Cloud width={win.w} top={win.h * 0.12} size={30} duration={16000} offset={0.15} />
        <Cloud width={win.w} top={win.h * 0.5} size={22} duration={22000} offset={0.65} />
      </View>
      <View style={[styles.windowBar, { left: win.x + win.w / 2 - 2, top: win.y, height: win.h }]} />
      <View style={[styles.windowBar, { left: win.x, top: win.y + win.h / 2 - 2, width: win.w, height: 4 }]} />
      <View style={[styles.sill, { left: win.x - 8, top: win.y + win.h + 2, width: win.w + 16 }]} />
      <Plant left={win.x + win.w - 22} top={win.y + win.h - 20} />

      <Lamp left={width * 0.4} top={awning - 2} />
      <Lamp left={width * 0.6 - 22} top={awning - 2} />
    </View>
  );
});

function Cloud({ width, top, size, duration, offset }: { width: number; top: number; size: number; duration: number; offset: number }) {
  const travel = width + size * 2;
  const progress = useSharedValue(offset);
  useEffect(() => {
    // Finish the first partial pass, then loop full passes from the left edge.
    progress.value = withSequence(
      withTiming(1, { duration: duration * (1 - offset), easing: Easing.linear }),
      withRepeat(
        withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })),
        -1,
      ),
    );
  }, [duration, offset, progress]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * travel - size * 1.5 }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top }, style]}>
      <Svg width={size * 1.5} height={size * 0.8} viewBox="0 0 30 16">
        <Path d="M6 15 C1 15 1 9 6 9 C6 4 13 2 15 6 C17 2 25 3 24 9 C29 9 29 15 24 15 Z" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

function Lamp({ left, top }: { left: number; top: number }) {
  return (
    <Svg width={22} height={40} viewBox="0 0 22 40" style={{ position: 'absolute', left, top }}>
      <Rect x={10.25} y={0} width={1.5} height={20} fill="#9C6638" />
      <Circle cx={11} cy={33} r={7} fill="#FFF3B0" opacity={0.6} />
      <Path d="M3 30 L7 20 H15 L19 30 Z" fill="#FFFFFF" stroke="#F3B3C7" strokeWidth={1} />
      <Circle cx={11} cy={31} r={3} fill="#FFE27A" />
    </Svg>
  );
}

function Plant({ left, top }: { left: number; top: number }) {
  return (
    <Svg width={20} height={22} viewBox="0 0 20 22" style={{ position: 'absolute', left, top }}>
      <Path d="M10 12 C4 10 3 4 5 2 C9 4 10 8 10 12 Z" fill="#7CC47F" />
      <Path d="M10 12 C16 10 17 4 15 2 C11 4 10 8 10 12 Z" fill="#5FAE63" />
      <Path d="M10 13 C8 7 10 3 10 1 C12 5 12 9 10 13 Z" fill="#8FD392" />
      <Path d="M4 12 H16 L14 21 H6 Z" fill="#E98E6B" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 7,
  },
  windowBar: {
    position: 'absolute',
    width: 4,
    backgroundColor: '#FFFFFF',
  },
  sill: {
    position: 'absolute',
    height: 7,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
