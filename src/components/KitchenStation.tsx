import { createContext, ReactNode, useContext, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CategoryId, Drink, getIngredient, ICE_LEVELS, Tea } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { ease } from '../motion';
import { colors, fonts } from '../theme';
import { shade } from './art/Character';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Each equipment piece reads the band height from context so it can scale its art.
const SizeContext = createContext(80);

interface KitchenStationProps {
  config: DayConfig;
  cup: Drink;
  onPick: (category: CategoryId, optionId: string) => void;
  /** The order's recipe card, rendered by the parent. */
  recipe: ReactNode;
  /** The cup standing on the table in the middle, rendered by the parent (keeps its refs). */
  cupTable: ReactNode;
}

/** Advance through a category's values on each tap, so every value (incl. "none") is reachable. */
function nextInCycle(order: string[], current: string | null): string {
  const i = current ? order.indexOf(current) : -1;
  return order[(i + 1) % order.length];
}

/**
 * The barista's prep station as real equipment, not a menu: beverage dispensers of tea you pour from,
 * bins of toppings you scoop, an ice chest, a syrup pump, a milk jug and a foam tub — arranged around
 * the cup, which sits on a table in the middle. Tapping a dispenser/bin/box operates it (with a pour or
 * scoop effect) and adds to the cup. Ice/sugar/milk/foam are single pieces of equipment that cycle on
 * each tap (so "no ice", "no milk" etc. are reachable, and ice/sugar build up with repeated taps).
 */
export function KitchenStation({ config, cup, onPick, recipe, cupTable }: KitchenStationProps) {
  const has = (c: CategoryId) => config.categories.includes(c);
  const hasEquip = has('ice') || has('sweetness') || has('milk') || has('foam');

  return (
    <View style={styles.station}>
      <Bar weight={1}>
        {config.options.tea.map((id) => (
          <TeaDispenser key={id} tea={getIngredient('tea', id) as Tea} selected={cup.tea === id} onPress={() => onPick('tea', id)} />
        ))}
      </Bar>

      <View style={styles.center}>
        <View style={styles.recipe}>{recipe}</View>
        <View style={styles.cupSlot}>{cupTable}</View>
      </View>

      <Bar weight={1}>
        {config.options.toppings.map((id) => (
          <ToppingBin key={id} id={id} selected={cup.toppings.includes(id)} onPress={() => onPick('toppings', id)} />
        ))}
      </Bar>

      {hasEquip && (
        <Bar weight={1}>
          {has('ice') && <IceBox ice={cup.ice} onPress={() => onPick('ice', nextInCycle(['less', 'regular', 'none'], cup.ice))} />}
          {has('sweetness') && (
            <SyrupPump sweetness={cup.sweetness} onPress={() => onPick('sweetness', nextInCycle(['30', '50', '100', '0'], cup.sweetness))} />
          )}
          {has('milk') && <MilkJug milk={cup.milk} onPress={() => onPick('milk', nextInCycle(['whole', 'oat', 'none'], cup.milk))} />}
          {has('foam') && <FoamTub foam={cup.foam} onPress={() => onPick('foam', nextInCycle(['cheese', 'brulee', 'none'], cup.foam))} />}
        </Bar>
      )}
    </View>
  );
}

/** A shelf of equipment that measures its own height so the pieces size to it. */
function Bar({ weight, children }: { weight: number; children: ReactNode }) {
  const [h, setH] = useState(0);
  return (
    <View style={[styles.bar, { flex: weight }]} onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}>
      <View style={styles.plank} />
      <View style={styles.barRow}>
        {h > 0 && (
          <SizeContext.Provider value={Math.min(h - 6, 118)}>{children}</SizeContext.Provider>
        )}
      </View>
    </View>
  );
}

/** Tap feedback + a one-shot "action" progress (0→1→0) to drive pour / scoop effects. */
function useAction() {
  const press = useSharedValue(1);
  const act = useSharedValue(0);
  const down = () => press.set(withTiming(0.92, { duration: 70 }));
  const up = () => press.set(withTiming(1, { duration: 150, easing: ease }));
  const fire = () => act.set(withSequence(withTiming(1, { duration: 220, easing: ease }), withTiming(0, { duration: 340, easing: ease })));
  return { press, act, down, up, fire };
}

function Cell({
  children,
  label,
  accessibilityLabel,
  selected,
  press,
  onDown,
  onUp,
  onPress,
}: {
  children: ReactNode;
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  press: ReturnType<typeof useSharedValue<number>>;
  onDown: () => void;
  onUp: () => void;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <AnimatedPressable
      onPressIn={onDown}
      onPressOut={onUp}
      onPress={onPress}
      style={[styles.cell, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <View>
        {children}
        {selected && (
          <View style={styles.check}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// --------------------------------------------------------------------------- tea dispensers

function TeaDispenser({ tea, selected, onPress }: { tea: Tea; selected: boolean; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const W = Math.round(s * 0.66);
  const H = Math.round(s * 0.86);
  const pour = useAnimatedStyle(() => ({
    opacity: act.value > 0 ? 1 : 0,
    height: interpolate(act.value, [0, 1], [0, H * 0.4]),
  }));
  const handle = () => {
    fire();
    onPress();
  };
  const tankX = W * 0.14;
  const tankY = H * 0.15;
  const tankW = W * 0.72;
  const tankH = H * 0.46;
  return (
    <Cell label={tea.name} accessibilityLabel={`Rót ${tea.name}`} selected={selected} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id={`glass-${tea.id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.4} />
            </LinearGradient>
          </Defs>
          {/* stand */}
          <Rect x={W * 0.2} y={H * 0.72} width={W * 0.6} height={H * 0.2} rx={3} fill={colors.counterEdge} />
          <Rect x={W * 0.16} y={H * 0.9} width={W * 0.68} height={H * 0.08} rx={3} fill={colors.counterDark} />
          {/* tank */}
          <Rect x={tankX} y={tankY} width={tankW} height={tankH + H * 0.16} rx={W * 0.12} fill="#EEF4F3" stroke="#CBD8D5" strokeWidth={1.5} />
          {/* tea liquid */}
          <Rect x={tankX + 2} y={tankY + tankH * 0.32} width={tankW - 4} height={tankH * 0.68 + H * 0.16} rx={W * 0.1} fill={tea.color} />
          <Rect x={tankX + 2} y={tankY + tankH * 0.32} width={tankW - 4} height={3} fill="#FFFFFF" opacity={0.3} />
          <Rect x={tankX} y={tankY} width={tankW} height={tankH + H * 0.16} rx={W * 0.12} fill={`url(#glass-${tea.id})`} />
          {/* lid */}
          <Rect x={tankX - W * 0.04} y={tankY - H * 0.06} width={tankW + W * 0.08} height={H * 0.1} rx={4} fill={shade(tea.color, -24)} />
          <Rect x={W * 0.46} y={tankY - H * 0.12} width={W * 0.08} height={H * 0.07} rx={2} fill={shade(tea.color, -24)} />
          {/* spigot */}
          <Rect x={W * 0.44} y={tankY + tankH + H * 0.1} width={W * 0.12} height={H * 0.08} rx={2} fill="#9AA3A0" />
          <Rect x={W * 0.47} y={tankY + tankH + H * 0.16} width={W * 0.06} height={H * 0.05} fill="#7E8784" />
        </Svg>
        {/* pour stream from the spigot */}
        <Animated.View style={[styles.pour, { left: W / 2 - 1.5, top: H * 0.72, backgroundColor: tea.color }, pour]} />
      </View>
    </Cell>
  );
}

// --------------------------------------------------------------------------- topping bins

function ToppingBin({ id, selected, onPress }: { id: string; selected: boolean; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const option = getIngredient('toppings', id);
  const color = option?.color ?? '#000';
  const pearl = (option as { shape?: string } | undefined)?.shape === 'pearl';
  const W = Math.round(s * 0.72);
  const H = Math.round(s * 0.84);
  const scoop = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(act.value, [0, 1], [0, -H * 0.3]) },
      { rotate: `${interpolate(act.value, [0, 1], [0, -38])}deg` },
    ],
  }));
  const handle = () => {
    fire();
    onPress();
  };
  const boxY = H * 0.26;
  const boxH = H * 0.6;
  const spots = [
    [W * 0.3, boxY + boxH * 0.3],
    [W * 0.52, boxY + boxH * 0.22],
    [W * 0.72, boxY + boxH * 0.32],
    [W * 0.42, boxY + boxH * 0.12],
    [W * 0.62, boxY + boxH * 0.12],
  ];
  return (
    <Cell label={option?.name ?? id} accessibilityLabel={`Múc ${option?.name ?? id}`} selected={selected} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {/* box */}
          <Rect x={W * 0.08} y={boxY} width={W * 0.84} height={boxH} rx={5} fill="#FFFDF6" stroke="#E7D5C5" strokeWidth={1.5} />
          <Rect x={W * 0.08} y={boxY} width={W * 0.84} height={boxH * 0.3} rx={5} fill="#F3E7D8" />
          {/* contents */}
          {spots.map(([x, y], i) =>
            pearl ? (
              <Circle key={i} cx={x} cy={y} r={W * 0.08} fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
            ) : (
              <Rect key={i} x={x - W * 0.07} y={y - W * 0.07} width={W * 0.14} height={W * 0.14} rx={2} fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
            ),
          )}
          {/* front label plate */}
          <Rect x={W * 0.16} y={boxY + boxH * 0.62} width={W * 0.68} height={boxH * 0.26} rx={3} fill="#FFFFFF" opacity={0.85} />
          {selected && <Rect x={W * 0.08} y={boxY} width={W * 0.84} height={boxH} rx={5} fill="none" stroke={colors.primary} strokeWidth={2.5} />}
        </Svg>
        {/* scoop */}
        <Animated.View style={[styles.scoop, { right: -W * 0.02, top: H * 0.02 }, scoop]}>
          <Svg width={W * 0.5} height={H * 0.5} viewBox="0 0 24 24">
            <Rect x={10} y={0} width={3} height={12} rx={1.5} fill={colors.counterDark} />
            <Path d="M4 12 h14 a3 3 0 0 1 3 3 v2 a7 5 0 0 1 -20 0 v-2 a3 3 0 0 1 3 -3 Z" fill="#C9CDD4" stroke="#AEB4BC" strokeWidth={1} />
          </Svg>
        </Animated.View>
      </View>
    </Cell>
  );
}

// --------------------------------------------------------------------------- ice chest

function IceBox({ ice, onPress }: { ice: string | null; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const level = ICE_LEVELS.find((l) => l.id === ice);
  const cubes = level?.cubes ?? 0;
  const label = level ? level.name : 'Đá';
  const W = Math.round(s * 0.78);
  const H = Math.round(s * 0.82);
  const scoop = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(act.value, [0, 1], [0, -H * 0.28]) }, { rotate: `${interpolate(act.value, [0, 1], [0, -34])}deg` }],
  }));
  const handle = () => {
    fire();
    onPress();
  };
  const boxY = H * 0.22;
  const boxH = H * 0.64;
  const chips = [
    [W * 0.3, boxY + boxH * 0.2],
    [W * 0.52, boxY + boxH * 0.12],
    [W * 0.42, boxY + boxH * 0.3],
    [W * 0.66, boxY + boxH * 0.26],
  ];
  return (
    <Cell label={label} accessibilityLabel={`Thêm đá (${label})`} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {/* chest */}
          <Rect x={W * 0.06} y={boxY} width={W * 0.88} height={boxH} rx={7} fill="#DCEFF7" stroke="#A9CFE0" strokeWidth={1.5} />
          <Rect x={W * 0.06} y={boxY} width={W * 0.88} height={boxH * 0.28} rx={7} fill="#EAF6FC" />
          {/* open lid */}
          <Path d={`M${W * 0.06} ${boxY} l${W * 0.1} ${-H * 0.14} h${W * 0.78} l${-W * 0.1} ${H * 0.14} Z`} fill="#CDE7F2" stroke="#A9CFE0" strokeWidth={1.2} />
          {/* ice cubes: a stocked chest until a level is chosen, then the chosen amount (0/2/4). */}
          {chips.slice(0, Math.min(4, ice === null ? 3 : cubes)).map(([x, y], i) => (
            <Rect key={i} x={x - W * 0.08} y={y - W * 0.08} width={W * 0.16} height={W * 0.16} rx={2.5} fill="#CDEBFF" stroke="#8CCBF2" strokeWidth={1} />
          ))}
          {/* level pips: none=0, ít=1, thường=2 */}
          {[0, 1, 2].map((i) => (
            <Circle key={i} cx={W * 0.3 + i * W * 0.2} cy={boxY + boxH + H * 0.08} r={W * 0.045} fill={i < (ice === null ? 0 : Math.round(cubes / 2)) ? colors.sky : '#D8E6EC'} />
          ))}
        </Svg>
        <Animated.View style={[styles.scoop, { right: -W * 0.04, top: H * 0.0 }, scoop]}>
          <Svg width={W * 0.46} height={H * 0.46} viewBox="0 0 24 24">
            <Rect x={10} y={0} width={3} height={12} rx={1.5} fill={colors.counterDark} />
            <Path d="M4 12 h14 a3 3 0 0 1 3 3 v2 a7 5 0 0 1 -20 0 v-2 a3 3 0 0 1 3 -3 Z" fill="#DDEFF7" stroke="#A9CFE0" strokeWidth={1} />
          </Svg>
        </Animated.View>
      </View>
    </Cell>
  );
}

// --------------------------------------------------------------------------- syrup pump

function SyrupPump({ sweetness, onPress }: { sweetness: string | null; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const pct = sweetness === null ? 0 : Number(sweetness);
  const label = sweetness === null ? 'Đường' : `${sweetness}%`;
  const W = Math.round(s * 0.6);
  const H = Math.round(s * 0.86);
  const head = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(act.value, [0, 1], [0, H * 0.06]) }] }));
  const drip = useAnimatedStyle(() => ({ opacity: act.value > 0 ? 1 : 0, height: interpolate(act.value, [0, 1], [0, H * 0.18]) }));
  const handle = () => {
    fire();
    onPress();
  };
  const bottleY = H * 0.3;
  const bottleH = H * 0.6;
  const fillH = (pct / 100) * (bottleH - 6);
  return (
    <Cell label={label} accessibilityLabel={`Bơm đường (${label})`} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {/* bottle */}
          <Rect x={W * 0.18} y={bottleY} width={W * 0.64} height={bottleH} rx={W * 0.14} fill="#FFF7E6" stroke="#E6D4B0" strokeWidth={1.5} />
          {fillH > 0 && <Rect x={W * 0.2} y={bottleY + bottleH - 3 - fillH} width={W * 0.6} height={fillH} rx={W * 0.1} fill="#F5B82E" />}
          <Rect x={W * 0.26} y={bottleY + 4} width={W * 0.08} height={bottleH * 0.7} rx={W * 0.04} fill="#FFFFFF" opacity={0.5} />
          {/* neck + pump */}
          <Rect x={W * 0.38} y={H * 0.18} width={W * 0.24} height={H * 0.14} fill="#E6D4B0" />
        </Svg>
        <Animated.View style={[styles.pumpHead, { width: W * 0.5, left: W * 0.25 }, head]}>
          <Svg width={W * 0.5} height={H * 0.2} viewBox="0 0 24 10">
            <Rect x={0} y={3} width={16} height={5} rx={2.5} fill="#C98A3A" />
            <Rect x={14} y={4} width={9} height={3} rx={1.5} fill="#C98A3A" />
            <Rect x={6} y={0} width={6} height={4} rx={2} fill="#A9712B" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.pour, { left: W * 0.86, top: H * 0.26, backgroundColor: '#F5B82E', width: 3 }, drip]} />
      </View>
    </Cell>
  );
}

// --------------------------------------------------------------------------- milk jug

function MilkJug({ milk, onPress }: { milk: string | null; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const option = milk ? getIngredient('milk', milk) : null;
  const isNone = milk === 'none';
  const label = option ? option.name : 'Sữa';
  const body = milk === 'oat' ? '#F1E3C8' : '#FFFFFF';
  const stripe = milk === 'oat' ? '#C08E4F' : milk === 'whole' ? '#5AA9E6' : '#CBD5DD';
  const W = Math.round(s * 0.64);
  const H = Math.round(s * 0.84);
  const tip = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(act.value, [0, 1], [0, -22])}deg` }] }));
  const pour = useAnimatedStyle(() => ({ opacity: act.value > 0 && !isNone ? 1 : 0, height: interpolate(act.value, [0, 1], [0, H * 0.3]) }));
  const handle = () => {
    fire();
    onPress();
  };
  return (
    <Cell label={label} accessibilityLabel={`Đổi sữa (${label})`} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Animated.View style={tip}>
          <Svg width={W} height={H}>
            {/* carton */}
            <Path d={`M${W * 0.22} ${H * 0.34} L${W * 0.5} ${H * 0.12} L${W * 0.78} ${H * 0.34} V${H * 0.9} H${W * 0.22} Z`} fill={body} stroke="#DCCFC2" strokeWidth={1.5} strokeLinejoin="round" />
            <Path d={`M${W * 0.22} ${H * 0.34} L${W * 0.5} ${H * 0.12} L${W * 0.78} ${H * 0.34} Z`} fill={stripe} opacity={isNone ? 0.4 : 1} />
            <Rect x={W * 0.22} y={H * 0.5} width={W * 0.56} height={H * 0.16} fill={stripe} opacity={isNone ? 0.35 : 0.9} />
            {isNone && <Path d={`M${W * 0.28} ${H * 0.3} L${W * 0.72} ${H * 0.82}`} stroke={colors.bad} strokeWidth={3} strokeLinecap="round" />}
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.pour, { left: W * 0.2, top: H * 0.3, backgroundColor: '#F5F3EE', width: 4 }, pour]} />
      </View>
    </Cell>
  );
}

// --------------------------------------------------------------------------- foam tub

function FoamTub({ foam, onPress }: { foam: string | null; onPress: () => void }) {
  const s = useContext(SizeContext);
  const { press, act, down, up, fire } = useAction();
  const option = foam ? getIngredient('foam', foam) : null;
  const isNone = foam === 'none';
  const label = option ? option.name : 'Kem';
  const color = option && !option.isNone ? option.color : foam ? '#EDEDED' : '#E7E0D2';
  const W = Math.round(s * 0.74);
  const H = Math.round(s * 0.82);
  const spatula = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(act.value, [0, 1], [0, -H * 0.24]) }, { rotate: `${interpolate(act.value, [0, 1], [0, 26])}deg` }],
  }));
  const handle = () => {
    fire();
    onPress();
  };
  const tubY = H * 0.34;
  const tubH = H * 0.52;
  return (
    <Cell label={label} accessibilityLabel={`Đổi kem (${label})`} press={press} onDown={down} onUp={up} onPress={handle}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {/* tub */}
          <Path d={`M${W * 0.16} ${tubY} h${W * 0.68} l${-W * 0.06} ${tubH} h${-W * 0.56} Z`} fill="#F4F1EC" stroke="#DED7CC" strokeWidth={1.5} />
          {/* foam dome */}
          <Path d={`M${W * 0.18} ${tubY + 2} q${W * 0.14} ${-H * 0.16} ${W * 0.32} 0 q${W * 0.14} ${-H * 0.14} ${W * 0.32} 0 Z`} fill={color} stroke={isNone ? '#D9D9D9' : shade(color, -14)} strokeWidth={1.2} />
          {isNone && <Path d={`M${W * 0.24} ${tubY - H * 0.04} L${W * 0.76} ${tubY + H * 0.16}`} stroke={colors.bad} strokeWidth={3} strokeLinecap="round" />}
        </Svg>
        <Animated.View style={[styles.scoop, { left: W * 0.12, top: -H * 0.02 }, spatula]}>
          <Svg width={W * 0.5} height={H * 0.5} viewBox="0 0 24 24">
            <Rect x={10} y={0} width={2.5} height={14} rx={1.2} fill={colors.counterDark} />
            <Ellipse cx={11} cy={17} rx={6} ry={4} fill="#E7E1D6" stroke="#CFC7B8" strokeWidth={1} />
          </Svg>
        </Animated.View>
      </View>
    </Cell>
  );
}

const styles = StyleSheet.create({
  station: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 12,
  },
  bar: {
    justifyContent: 'flex-end',
  },
  plank: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 2,
    height: 8,
    borderRadius: 3,
    backgroundColor: colors.counter,
    borderBottomWidth: 3,
    borderBottomColor: '#9A6A3C',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  center: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  recipe: {
    flex: 1,
  },
  cupSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
  },
  check: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.display,
  },
  name: {
    fontSize: 9.5,
    lineHeight: 11,
    fontFamily: fonts.semi,
    color: colors.ink,
    maxWidth: '100%',
  },
  nameSelected: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  pour: {
    position: 'absolute',
    width: 3,
    borderRadius: 2,
  },
  scoop: {
    position: 'absolute',
  },
  pumpHead: {
    position: 'absolute',
    top: 0,
  },
});
