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
import { gameReducer, GameState } from './src/game/reducer';
import { DayEndScreen } from './src/screens/DayEndScreen';
import { GameScreen } from './src/screens/GameScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme';
import { useSavedGame, useSaveGame } from './src/useSavedGame';

const WIPE_MS = 250;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold });
  const initial = useSavedGame();

  // Hold the splash until the saved shop is read as well as the fonts: a restored day has to *be*
  // the reducer's initial state, not something applied over a day that has already opened.
  if ((!fontsLoaded && !fontError) || !initial) {
    return <View style={{ flex: 1, backgroundColor: colors.wall }} />;
  }

  return <Shop initial={initial} />;
}

function Shop({ initial }: { initial: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  useSaveGame(state);

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
            onRetry={() => dispatch({ type: 'START_DAY', day: screen.day })}
            onMenu={() => dispatch({ type: 'GO_TO_TITLE' })}
          />
        )}
        <ScreenWipe progress={wipe} />
      </View>
    </SafeAreaProvider>
  );
}
