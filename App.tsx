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
import { createInitialState, gameReducer, GameState } from './src/game/reducer';
import { DayEndScreen } from './src/screens/DayEndScreen';
import { GameScreen } from './src/screens/GameScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme';

const WIPE_MS = 250;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, Date.now(), createInitialState);
  const [fontsLoaded, fontError] = useFonts({ Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold });

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

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.wall }} />;
  }

  const screen = outgoing ?? state;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.wall }}>
        {screen.phase === 'title' && <TitleScreen onStart={() => dispatch({ type: 'START_DAY', day: 1 })} />}
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
