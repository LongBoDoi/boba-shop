import { Dispatch, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Tiles } from '../components/art/Tiles';
import { SHELF_HEIGHT, ToppingShelf } from '../components/art/ToppingShelf';
import { Button } from '../components/Button';
import { Cup } from '../components/Cup';
import { CustomerStage, stageMetrics } from '../components/CustomerStage';
import { EffectsGeometry, EffectsLayer, Point } from '../components/Effects';
import { Hud } from '../components/Hud';
import { IngredientPanel } from '../components/IngredientPanel';
import { OpeningSign } from '../components/OpeningSign';
import { OrderTicket } from '../components/OrderTicket';
import { MACHINE_BASE, MACHINE_HEAD, SealingMachine } from '../components/SealingMachine';
import { CategoryId } from '../game/ingredients';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { drinkPrice } from '../game/orders';
import { GameAction, GameState } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { tapHaptic, toneHaptic } from '../utils/haptics';

const TICK_MS = 100;
// Cap a single step so returning from the background doesn't skip time.
const MAX_STEP_MS = 250;

interface GameScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export function GameScreen({ state, dispatch }: GameScreenProps) {
  const { width, height: windowHeight } = useWindowDimensions();
  const { config, paused } = state;
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    if (paused || opening) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'TICK', dt: Math.min(now - last, MAX_STEP_MS) });
      last = now;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [paused, opening, dispatch]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') dispatch({ type: 'SET_PAUSED', paused: true });
    });
    return () => subscription.remove();
  }, [dispatch]);

  // Buzz once for every new serve / walk-out message.
  const lastFeedbackId = useRef(0);
  useEffect(() => {
    const latest = state.feedback[state.feedback.length - 1];
    if (latest && latest.id > lastFeedbackId.current) {
      lastFeedbackId.current = latest.id;
      toneHaptic(latest.tone);
    }
  }, [state.feedback]);

  const selectSlot = useCallback(
    (slot: number) => {
      tapHaptic();
      dispatch({ type: 'SELECT_SLOT', slot });
    },
    [dispatch],
  );
  const selectCategory = useCallback(
    (category: CategoryId) => {
      tapHaptic();
      dispatch({ type: 'SET_CATEGORY', category });
    },
    [dispatch],
  );
  const pick = useCallback(
    (category: CategoryId, optionId: string) => {
      tapHaptic();
      dispatch({ type: 'PICK', category, optionId });
    },
    [dispatch],
  );
  const finishOpening = useCallback(() => setOpening(false), []);

  // Layout, for aiming the flying cups and coins (all relative to the root view).
  const rootRef = useRef<View>(null);
  const machineRef = useRef<View>(null);
  const trashRef = useRef<View>(null);
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });
  const [machine, setMachine] = useState({ x: width * 0.7, y: windowHeight * 0.4, width: 120, height: 180 });
  const [trash, setTrash] = useState<Point>({ x: width * 0.2, y: windowHeight * 0.9 });
  const [wallet, setWallet] = useState<Point>({ x: width * 0.65, y: 30 });
  const [stageTop, setStageTop] = useState(50);
  const [station, setStation] = useState({ width, height: 0 });

  const measureRoot = () => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  const measureMachine = () =>
    machineRef.current?.measureInWindow((x, y, w, h) => setMachine({ x, y, width: w, height: h }));
  const measureTrash = () =>
    trashRef.current?.measureInWindow((x, y, w, h) => setTrash({ x: x + w / 2, y: y + h / 2 }));

  const stageHeight = Math.round(Math.min(196, Math.max(166, windowHeight * 0.23)));
  const metrics = stageMetrics(width, stageHeight, state.slots.length);
  const cupWidth = Math.round(
    Math.max(56, Math.min(140, width * 0.34, station.height ? (station.height - 24 - MACHINE_HEAD - MACHINE_BASE - 22) / 1.3 : 90)),
  );

  const geometry: EffectsGeometry = {
    slotCenters: state.slots.map((_, slot) => ({
      x: (slot + 0.5) * metrics.slotWidth,
      y: stageTop + metrics.bubbleCenterY,
    })),
    cup: {
      x: machine.x - origin.x + machine.width / 2,
      y: machine.y - origin.y + machine.height - MACHINE_BASE - (cupWidth * 1.3) / 2 - 4,
    },
    money: { x: wallet.x - origin.x, y: wallet.y - origin.y },
    trash: { x: trash.x - origin.x, y: trash.y - origin.y },
  };

  const selectedCustomer = state.selectedSlot === null ? null : state.slots[state.selectedSlot];
  const canServe = Boolean(selectedCustomer && state.cup.tea);
  const serveLabel = !selectedCustomer
    ? 'Chưa có khách'
    : !state.cup.tea
      ? 'Chọn trà trước'
      : `Phục vụ ${selectedCustomer.name} ➜`;
  const cupPrice = drinkPrice(state.cup);

  const intro = state.day === 1 ? ['Chạm vào khách, pha đúng món họ gọi rồi bấm Phục vụ!'] : describeUnlocks(state.day);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View ref={rootRef} style={styles.root} onLayout={measureRoot}>
        <Hud
          day={state.day}
          clock={state.clock}
          durationMs={config.durationMs}
          coins={state.coins}
          goal={config.goal}
          onPause={() => dispatch({ type: 'SET_PAUSED', paused: true })}
          onWalletLayout={(x, y) => setWallet({ x, y })}
        />

        <View onLayout={(event: LayoutChangeEvent) => setStageTop(event.nativeEvent.layout.y)}>
          <CustomerStage
            width={width}
            height={stageHeight}
            slots={state.slots}
            departures={state.departures}
            selectedSlot={state.selectedSlot}
            clock={state.clock}
            feedback={state.feedback}
            onSelect={selectSlot}
          />
        </View>

        <View
          style={styles.station}
          onLayout={(event: LayoutChangeEvent) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            setStation({ width: w, height: h });
          }}
        >
          {station.height > 0 && <Tiles width={station.width} height={station.height} />}
          <View style={styles.ticketColumn}>
            <OrderTicket customer={selectedCustomer} cup={state.cup} config={config} />
            {/* Fill the space under short tickets with a shelf of topping jars. */}
            {station.height > 70 + config.categories.length * 22 + SHELF_HEIGHT && (
              <View style={styles.shelf} pointerEvents="none">
                <ToppingShelf width={station.width - cupWidth - 66} height={SHELF_HEIGHT} />
              </View>
            )}
          </View>
          <View ref={machineRef} onLayout={measureMachine} style={styles.machineArea}>
            <SealingMachine
              cupWidth={cupWidth}
              display={cupPrice > 0 ? `Giá: ${formatMoney(cupPrice)}` : 'Sẵn sàng'}
              sealCount={state.stats.served}
            >
              <FreshCup key={state.cupId} width={cupWidth}>
                <Cup drink={state.cup} width={cupWidth} backgroundColor={colors.machineInside} animated />
              </FreshCup>
            </SealingMachine>
          </View>
        </View>

        <IngredientPanel
          config={config}
          cup={state.cup}
          activeCategory={state.activeCategory}
          onSelectCategory={selectCategory}
          onPick={pick}
        />

        <SafeAreaView edges={['bottom']} style={styles.actionsArea}>
          <View style={styles.actions}>
            <View ref={trashRef} onLayout={measureTrash} style={styles.clear}>
              <Button label="Đổ bỏ" variant="secondary" onPress={() => dispatch({ type: 'CLEAR_CUP' })} />
            </View>
            <Button
              label={serveLabel}
              disabled={!canServe}
              onPress={() => dispatch({ type: 'SERVE' })}
              style={styles.serve}
            />
          </View>
        </SafeAreaView>

        <EffectsLayer departures={state.departures} discarded={state.discarded} geometry={geometry} cupWidth={cupWidth} />

        {opening && (
          <OpeningSign
            day={state.day}
            goal={config.goal}
            title={state.day === 1 ? 'Cách chơi' : 'Mới hôm nay'}
            lines={intro}
            onDone={finishOpening}
          />
        )}

        {paused && <PauseMenu onResume={() => dispatch({ type: 'SET_PAUSED', paused: false })} onQuit={() => dispatch({ type: 'GO_TO_TITLE' })} />}
      </View>
    </SafeAreaView>
  );
}

/** Each new cup glides a short way onto the machine. */
function FreshCup({ width, children }: { width: number; children: ReactNode }) {
  const slide = useSharedValue(0);
  useEffect(() => {
    // Wait for the served cup to leave before the fresh one fades in.
    slide.value = withDelay(500, withTiming(1, timing(DURATION.slow)));
  }, [slide]);
  const style = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateX: (1 - slide.value) * -width * 0.25 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function PauseMenu({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ scale: 0.96 + appear.value * 0.04 }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, dimStyle]} />
      <View style={styles.pauseCenter}>
        <Animated.View style={[styles.pauseCard, cardStyle]}>
          <Text style={styles.pauseTitle}>Tạm dừng</Text>
          <Button label="Tiếp tục" onPress={onResume} />
          <Button label="Về menu chính" variant="secondary" onPress={onQuit} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  root: {
    flex: 1,
    backgroundColor: colors.floor,
  },
  station: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  ticketColumn: {
    flex: 1,
  },
  shelf: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  machineArea: {
    justifyContent: 'flex-end',
  },
  actionsArea: {
    backgroundColor: colors.panel,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  clear: {
    flex: 1.1,
  },
  serve: {
    flex: 2,
  },
  overlay: {
    backgroundColor: 'rgba(43,27,23,0.45)',
  },
  pauseCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCard: {
    width: 260,
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.floor,
    borderBottomWidth: 6,
    borderBottomColor: colors.line,
  },
  pauseTitle: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: 'center',
  },
});
