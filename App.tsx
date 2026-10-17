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

import { useAudioEngine, useGameAudio } from './src/audio/useAudio';
import { ScreenWipe } from './src/components/ScreenWipe';
import { NewBuildDialog, UpdateDialog } from './src/components/UpdateDialog';
import { gameReducer, GameState } from './src/game/reducer';
import { decodeSaveCode, encodeSaveCode } from './src/game/saveCode';
import { DayEndScreen } from './src/screens/DayEndScreen';
import { GameScreen } from './src/screens/GameScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme';
import { useNewBuild } from './src/updates/useNewBuild';
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
  // Built here rather than up in `App`, which is to say **after** the loading screen rather than
  // behind it. The cues are a twentieth of what the artwork weighs, but a browser will only hold
  // six connections to a host, so twenty of them opened during the preload do not arrive sooner —
  // they push the artwork, which is the only thing the bar is actually waiting for, back behind
  // them. There is nothing to gain by being early: nothing may sound until the first gesture, and
  // on this screen that is the press of "Bắt đầu", which is a title screen away.
  useAudioEngine();
  useGameAudio(state);
  const save = useSaveGame(state, writable);
  const update = useUpdate(save);
  const build = useNewBuild(save);

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
            audio={screen.audio}
            onChangeAudio={(audio) => dispatch({ type: 'SET_AUDIO', audio })}
            onExport={() => encodeSaveCode(state)}
            onImport={(code) => {
              const restored = decodeSaveCode(code);
              if (restored) dispatch({ type: 'RESTORE', state: restored });
              return Boolean(restored);
            }}
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
        {/* Over every screen, not only the menu — see `shown`.

            A new *file* is offered ahead of a new *update*, and in practice they never compete:
            the published updates stop matching a build whose version has moved on, so
            `checkForUpdateAsync` goes quiet at exactly the moment `useNewBuild` speaks up. The
            precedence is written down anyway, so that if that ever stops being true the player is
            told about the one that can actually fix their app rather than the one that cannot
            reach it. */}
        {shown(build.status, screen) ? (
          <NewBuildDialog build={build} />
        ) : shown(update.status, screen) ? (
          <UpdateDialog update={update} />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

/**
 * Whether a version dialog should be on screen.
 *
 * Shared by both kinds so they cannot drift apart: anything mid-flight is shown wherever the
 * player is, and only the opening question is held back while a shift is actually running — a
 * card that takes every touch must not be allowed to drain three patience timers while it is read.
 */
function shown(status: string, screen: GameState): boolean {
  if (status === 'none') return false;
  return !(status === 'offered' && screen.phase === 'playing' && !screen.paused);
}
