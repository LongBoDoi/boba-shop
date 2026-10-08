import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { colors } from './theme';

/**
 * Over-the-air updates. The shared builds are installed by hand (an APK, or an ad-hoc link), so a
 * new copy of the game has to arrive on its own: `expo-updates` looks for one on every cold start,
 * downloads it in the background, and the new code takes over on the next restart.
 *
 * Nothing here runs in Expo Go, on web, or in development — `Updates.isEnabled` is false there and
 * `checkForUpdateAsync` rejects on purpose.
 */

/** Don't pester the update server on every glance at the app. */
const RECHECK_MS = 15 * 60 * 1000;

/** The restart wears the game's own colours instead of flashing a white screen. */
const RELOAD_SCREEN = {
  backgroundColor: colors.wall,
  fade: true,
  spinner: { enabled: true, color: colors.primary },
};

interface GameUpdate {
  /** An update is sitting on the phone, waiting for a moment when restarting costs nothing. */
  waiting: boolean;
}

/**
 * @param safeToRestart true when losing the current screen would cost the player nothing — between
 * days, not mid-shift. A restart throws away the in-memory game, so the update waits for it.
 */
export function useGameUpdates(safeToRestart: boolean): GameUpdate {
  const { isUpdatePending } = Updates.useUpdates();
  const lastCheck = useRef(0);
  const restarting = useRef(false);

  // expo-updates only looks on launch, and a game on a phone can sit open for days. Look again
  // whenever the player comes back to it.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = now;
      void fetchQuietly();
    });
    return () => sub.remove();
  }, []);

  // The reload is fired from the effect and latched on a ref: asking twice would restart twice.
  useEffect(() => {
    if (!isUpdatePending || !safeToRestart || restarting.current) return;
    restarting.current = true;
    Updates.reloadAsync({ reloadScreenOptions: RELOAD_SCREEN }).catch(() => {
      restarting.current = false;
    });
  }, [isUpdatePending, safeToRestart]);

  return { waiting: isUpdatePending && !safeToRestart };
}

async function fetchQuietly() {
  try {
    const found = await Updates.checkForUpdateAsync();
    if (found.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline, or the update server is unreachable. The copy already on the phone keeps running.
  }
}
