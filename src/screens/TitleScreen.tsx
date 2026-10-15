import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextStyle, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { Character } from '../components/art/Character';
import { Button } from '../components/Button';
import { Cup } from '../components/Cup';
import { SettingsSheet } from '../components/SettingsSheet';
import { CustomerLook } from '../game/customers';
import { Drink } from '../game/ingredients';
import { GameMode } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { pointerEventsStyles } from '../pointerEvents';

const SHOWCASE_DRINK: Drink = {
  toppings: ['pearls'],
  sweetness: null,
  ice: 'regular',
  tea: 'taro',
  milk: 'whole',
  foam: 'cheese',
};

const LEFT_FAN: CustomerLook = { skin: '#F6C8A4', hair: '#2B1B17', hairStyle: 'bun', shirt: '#7FD6C2', accessory: 'none' };
const RIGHT_FAN: CustomerLook = { skin: '#E9B48E', hair: '#6B4423', hairStyle: 'cap', shirt: '#FFCF6E', accessory: 'glasses' };

/** The three how-to-play lines; the first one depends on who takes the orders. */
function stepsFor(mode: GameMode) {
  return [
    mode === 'relaxed' ? '⚡ Order tự được nhận, khách tới liên tục' : '🧍 Chạm vào khách để nhận order',
    '🧋 Cho từng nguyên liệu vào ly',
    '💰 Phục vụ nhanh để được tip, đạt mục tiêu mỗi ngày!',
  ];
}

interface TitleScreenProps {
  onStart: () => void;
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
}

export function TitleScreen({ onStart, mode, onChangeMode }: TitleScreenProps) {
  const { width, height } = useWindowDimensions();
  const cupWidth = Math.min(130, width * 0.32);
  const [settings, setSettings] = useState(false);

  return (
    <View style={styles.screen}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {Array.from({ length: Math.ceil(width / 44) }, (_, i) => (
          <Rect key={i} x={i * 44} width={22} height={height} fill={colors.wallStripe} />
        ))}
      </Svg>
      <Pearls width={width} height={height} />
      <Awning width={width} />

      <SafeAreaView style={styles.safe}>
        {/*
          The menu is laid out to fill the screen, but it has no slack: on a short phone the logo
          was already sliding under the awning before anything was put above the card. So it
          scrolls when it has to — `flexGrow` keeps the spread-out layout wherever there is room,
          and a notice that only sometimes appears can never crop the shop's own name.
        */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Logo />
            <View style={styles.scene}>
              <View style={styles.fan}>
                <Character look={LEFT_FAN} mood="delighted" width={74} />
              </View>
              <Cup drink={SHOWCASE_DRINK} width={cupWidth} backgroundColor={colors.wall} straw />
              <View style={styles.fan}>
                <Character look={RIGHT_FAN} mood="happy" width={74} />
              </View>
            </View>
          </View>

          <SlideUp>
            <View style={styles.card}>
              {stepsFor(mode).map((step) => (
                <Text key={step} style={styles.step}>
                  {step}
                </Text>
              ))}
              <Button label="Mở cửa tiệm" onPress={onStart} style={styles.start} />
              <Button label="⚙️ Cài đặt" variant="secondary" onPress={() => setSettings(true)} />
            </View>
          </SlideUp>
        </ScrollView>
      </SafeAreaView>

      {settings && (
        <SettingsSheet mode={mode} onChangeMode={onChangeMode} onClose={() => setSettings(false)} />
      )}
    </View>
  );
}

function Logo() {
  return (
    <View style={styles.logo}>
      <FadeWord delay={0} style={styles.logoSmall}>
        Tiệm
      </FadeWord>
      <FadeWord delay={120} style={styles.logoBig}>
        Trà Sữa
      </FadeWord>
      <FadeWord delay={300} style={styles.subtitle}>
        Lắc đều. Ép nắp. Bán đắt hàng.
      </FadeWord>
    </View>
  );
}

function FadeWord({ delay, style, children }: { delay: number; style: object; children: string }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(delay, withTiming(1, timing(DURATION.slow)));
  }, [appear, delay]);
  const animated = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 8 }],
  }));
  return <Animated.Text style={[style, animated]}>{children}</Animated.Text>;
}

function SlideUp({ children }: { children: React.ReactNode }) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(300, withTiming(1, timing(DURATION.slow)));
  }, [rise]);
  const animated = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 16 }],
  }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

/** A few still tapioca pearls scattered over the wallpaper. */
function Pearls({ width, height }: { width: number; height: number }) {
  const pearls = Array.from({ length: 10 }, (_, i) => ({
    key: i,
    x: (((i * 53) % 100) / 100) * width,
    y: (((i * 29 + 11) % 100) / 100) * height,
    size: 10 + ((i * 7) % 14),
  }));
  return (
    <View style={[StyleSheet.absoluteFill, pointerEventsStyles.none]}>
      {pearls.map((pearl) => (
        <View
          key={pearl.key}
          style={[styles.pearl, { left: pearl.x, top: pearl.y, width: pearl.size, height: pearl.size, borderRadius: pearl.size / 2 }]}
        >
          <View style={[styles.pearlShine, { width: pearl.size * 0.3, height: pearl.size * 0.3, borderRadius: pearl.size }]} />
        </View>
      ))}
    </View>
  );
}

function Awning({ width }: { width: number }) {
  return (
    <Svg width={width} height={44} style={styles.awning}>
      <Rect width={width} height={22} fill={colors.primary} />
      {Array.from({ length: Math.ceil(width / 32) }, (_, i) => (
        <Path key={i} d={`M${i * 32} 20 h32 a16 16 0 0 1 -32 0 Z`} fill={i % 2 === 0 ? colors.primary : '#FFFFFF'} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.wall,
  },
  awning: {
    position: 'absolute',
    top: 0,
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    alignItems: 'center',
  },
  logoSmall: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fonts.display,
    color: colors.primary,
  },
  logoBig: {
    fontSize: 58,
    lineHeight: 66,
    fontFamily: fonts.display,
    color: colors.ink,
    // React Native Web uses CSS textShadow; native keeps its platform text styles.
    ...Platform.select<TextStyle & { textShadow?: string }>({
      web: { textShadow: '0px 4px 0px #FFFFFF' },
      default: {
        textShadowColor: '#FFFFFF',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 0,
      },
    }),
  },
  subtitle: {
    fontSize: 17,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  scene: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  fan: {
    marginBottom: -4,
  },
  card: {
    backgroundColor: colors.floor,
    borderRadius: 24,
    padding: 20,
    gap: 8,
    borderBottomWidth: 6,
    borderBottomColor: colors.line,
  },
  step: {
    fontSize: 16,
    fontFamily: fonts.semi,
    color: colors.ink,
  },
  start: {
    marginTop: 8,
  },
  pearl: {
    position: 'absolute',
    backgroundColor: '#3A2318',
    opacity: 0.12,
  },
  pearlShine: {
    position: 'absolute',
    top: '18%',
    left: '22%',
    backgroundColor: '#FFFFFF',
  },
});
