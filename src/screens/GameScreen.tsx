import { Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { EffectsGeometry, EffectsLayer, Point } from '../components/Effects';
import { Hud } from '../components/Hud';
import { OpeningSign } from '../components/OpeningSign';
import { Ticket } from '../components/TicketRail';
import { CategoryId } from '../game/ingredients';
import { describeUnlocks } from '../game/levels';
import { GameAction, GameState } from '../game/reducer';
import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { tapHaptic, toneHaptic } from '../utils/haptics';
import { CounterPage } from './CounterPage';
import { PrepGeometry, PrepPage } from './PrepPage';

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
  const [page, setPage] = useState(0);
  const [measureToken, setMeasureToken] = useState(0);

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

  // Pager
  const pagerRef = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  const goToPage = useCallback(
    (p: number) => {
      tapHaptic();
      pagerRef.current?.scrollTo({ x: p * width, animated: true });
    },
    [width],
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const p = Math.round(event.nativeEvent.contentOffset.x / width);
      if (p !== pageRef.current) {
        pageRef.current = p;
        setPage(p);
        // The prep page measures its on-screen positions only once it's actually visible.
        if (p === 1) setMeasureToken((token) => token + 1);
      }
    },
    [width],
  );

  const takeOrder = useCallback(
    (slot: number) => {
      tapHaptic();
      dispatch({ type: 'TAKE_ORDER', slot });
    },
    [dispatch],
  );
  const focusTicket = useCallback(
    (slot: number) => {
      dispatch({ type: 'SELECT_SLOT', slot });
      goToPage(1);
    },
    [dispatch, goToPage],
  );
  const selectTicket = useCallback(
    (slot: number) => {
      tapHaptic();
      dispatch({ type: 'SELECT_SLOT', slot });
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

  // Layout, for aiming the flying coins and the toss (all relative to the root view).
  const rootRef = useRef<View>(null);
  const machineRef = useRef<View>(null);
  const trashRef = useRef<View>(null);
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });
  const [wallet, setWallet] = useState<Point>({ x: width * 0.65, y: 30 });
  const [prep, setPrep] = useState<PrepGeometry>({
    machine: { x: width * 0.7, y: windowHeight * 0.5 },
    trash: { x: width * 0.2, y: windowHeight * 0.9 },
    cupWidth: 90,
  });

  const measureRoot = () => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));

  // The counter owns a whole page now, so the stage can be taller and the customers larger.
  const stageHeight = Math.round(Math.min(360, Math.max(240, windowHeight * 0.44)));

  const geometry: EffectsGeometry = {
    cup: { x: prep.machine.x - origin.x, y: prep.machine.y - origin.y },
    money: { x: wallet.x - origin.x, y: wallet.y - origin.y },
    trash: { x: prep.trash.x - origin.x, y: prep.trash.y - origin.y },
  };

  const tickets: Ticket[] = state.slots.flatMap((customer, slot) =>
    customer && customer.status === 'ordered' ? [{ slot, customer }] : [],
  );
  const selectedCustomer = state.selectedSlot === null ? null : state.slots[state.selectedSlot];
  const requestingCount = state.slots.filter((customer) => customer?.status === 'requesting').length;

  const intro =
    state.day === 1
      ? ['Chạm vào khách ở Quầy để nhận order.', 'Vuốt sang Pha chế ➜ để làm ly rồi bấm Phục vụ!']
      : describeUnlocks(state.day);

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

        <PageTabs page={page} counterBadge={requestingCount} prepBadge={tickets.length} onGo={goToPage} />

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          style={styles.pager}
        >
          <CounterPage
            width={width}
            stageHeight={stageHeight}
            slots={state.slots}
            departures={state.departures}
            selectedSlot={state.selectedSlot}
            clock={state.clock}
            feedback={state.feedback}
            onTakeOrder={takeOrder}
            onFocusTicket={focusTicket}
          />
          <PrepPage
            width={width}
            config={config}
            cup={state.cup}
            cupId={state.cupId}
            tickets={tickets}
            selectedSlot={state.selectedSlot}
            selectedCustomer={selectedCustomer}
            clock={state.clock}
            measureToken={measureToken}
            onGeometry={setPrep}
            onSelectTicket={selectTicket}
            onPick={pick}
            onClear={() => dispatch({ type: 'CLEAR_CUP' })}
            onServe={() => dispatch({ type: 'SERVE' })}
            machineRef={machineRef}
            trashRef={trashRef}
          />
        </ScrollView>

        <EffectsLayer departures={state.departures} discarded={state.discarded} geometry={geometry} cupWidth={prep.cupWidth} />

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

/** The two-page indicator under the HUD: tap a label or swipe to switch screens. */
function PageTabs({ page, counterBadge, prepBadge, onGo }: { page: number; counterBadge: number; prepBadge: number; onGo: (p: number) => void }) {
  return (
    <View style={styles.tabs}>
      <Tab label="Quầy" active={page === 0} badge={counterBadge} onPress={() => onGo(0)} />
      <Tab label="Pha chế" active={page === 1} badge={prepBadge} onPress={() => onGo(1)} />
    </View>
  );
}

function Tab({ label, active, badge, onPress }: { label: string; active: boolean; badge: number; onPress: () => void }) {
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} hitSlop={6}>
      <View style={[styles.dot, active && styles.dotActive]} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
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
  pager: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
    backgroundColor: colors.primaryDark,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 15,
    color: colors.goldDark,
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
