import {
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/baloo-2';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useReducer, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenWipe } from './src/components/ScreenWipe';
import { UpdateDialog } from './src/components/UpdateDialog';
import { gameReducer, GameState } from './src/game/reducer';
import { DayEndScreen } from './src/screens/DayEndScreen';
import { GameScreen } from './src/screens/GameScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme';
import { useUpdate } from './src/updates/useUpdate';
import { useArtwork } from './src/useArtwork';
import { useSavedGame, useSaveGame } from './src/useSavedGame';

const WIPE_MS = 250;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold });
  const restored = useSavedGame();
  const artwork = useArtwork();

  // Three things have to be in hand before the first screen can be drawn, and the saved shop is
  // the one that cannot be applied later: a restored day has to *be* the reducer's initial state,
  // not something laid over a day that has already opened. The artwork could be left to arrive as
  // it is drawn, and that is exactly what made the kitchen fill itself in plank by plank.
  const lettering = fontsLoaded || fontError;
  if (!lettering || !restored || artwork < 1) {
    // The bar is weighted the way the wait actually falls: the artwork is nearly all of it.
    const progress = (lettering ? 0.1 : 0) + (restored ? 0.05 : 0) + artwork * 0.85;
    return <LoadingScreen progress={progress} />;
  }

  return <Shop initial={restored.state} writable={restored.writable} />;
}

function Shop({ initial, writable }: { initial: GameState; writable: boolean }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const save = useSaveGame(state, writable);
  const update = useUpdate(save);

  // When the phase changes, keep showing the old screen (frozen) until the wipe covers it.
  const [previous, setPrevious] = useState(state);
  const [outgoing, setOutgoing] = useState<GameState | null>(null);
  if (state !== previous) {
    if (state.phase !== previous.phase && !outgoing) setOutgoing(previous);
    setPrevious(state);
  }

  const wipe = useSharedValue(0);
  useEffect(() => {
    if (!outgoing) return;
    wipe.value = withTiming(1, { duration: WIPE_MS, easing: Easing.inOut(Easing.cubic) });
    const timer = setTimeout(() => {
      setOutgoing(null);
      wipe.value = withDelay(80, withTiming(0, { duration: WIPE_MS + 100, easing: Easing.inOut(Easing.cubic) }));
    }, WIPE_MS + 20);
    return () => clearTimeout(timer);
  }, [outgoing, wipe]);

  const screen = outgoing ?? state;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.wall }}>
        {screen.phase === 'title' && (
          <TitleScreen
            onStart={() => dispatch({ type: 'START_DAY', day: 1 })}
            mode={screen.mode}
            onChangeMode={(mode) => dispatch({ type: 'SET_MODE', mode })}
          />
        )}
        {screen.phase === 'playing' && <GameScreen state={screen} dispatch={dispatch} />}
        {screen.phase === 'dayEnd' && (
          <DayEndScreen
            state={screen}
            onNextDay={() => dispatch({ type: 'START_DAY', day: screen.day + 1 })}
            onMenu={() => dispatch({ type: 'GO_TO_TITLE' })}
          />
        )}
        <ScreenWipe progress={wipe} />
        {/* Over every screen, not only the menu — but held back while a shift is actually
            running, so a question nobody asked for cannot drain three patience timers while it
            is read. The check lands at launch, where the day is either not started or paused. */}
        {update.status !== 'none' && !(update.status === 'offered' && screen.phase === 'playing' && !screen.paused) && (
          <UpdateDialog update={update} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
