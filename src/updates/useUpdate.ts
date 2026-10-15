import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Keeping the shop up to date without reinstalling it.
 *
 * The game is handed out as files, so nothing tells a player a new build exists. It used to read
 * its own GitHub releases and hand the `.apk` to Android's package installer — a 95 MB download, a
 * permission to install unknown apps, and nothing at all for iOS, which cannot install an `.ipa`
 * from inside an app. **EAS Update replaces all of that**: the JavaScript and the artwork are
 * swapped in place and the app restarts itself. Both platforms, no reinstall, a few hundred
 * kilobytes.
 *
 * What it cannot do is change native code. The runtime version is `app.json`'s `version` (the
 * `appVersion` policy), so **adding or removing a native dependency means bumping that version and
 * building the apps again** — otherwise an update would reach a build whose native side cannot run
 * it. `tools/check-updates.cjs` fails the moment the native dependencies change without the
 * version moving, because nothing else would catch it until a phone crashed.
 *
 * The player is asked rather than updated behind: `checkAutomatically` is `NEVER` in `app.json`, so
 * the library downloads nothing on its own — this asks once per launch and the dialog decides.
 */

/** Storage, network and a restart: survivable, so they are reported rather than thrown. */
function warn(what: string, error: unknown) {
  console.warn(`[update] ${what}:`, error);
}

export type UpdateStatus =
  /** Nothing to say: the web build, a dev build, no update, or the player said no. */
  | 'none'
  | 'offered'
  | 'downloading'
  | 'applying'
  | 'failed';

export interface Update {
  status: UpdateStatus;
  /** When the offered update was published, so it is recognisable as a particular one. */
  publishedAt: Date | null;
  /** 0–1 while downloading. */
  progress: number;
  accept: () => void;
  dismiss: () => void;
}

/**
 * Only a real build can update itself. On the web the page *is* the newest version as soon as it
 * is reloaded, and `expo-updates` is a stub there that always answers "no update"; in Expo Go and
 * in a dev build the API rejects outright.
 */
function updatable(): boolean {
  return Platform.OS !== 'web' && Updates.isEnabled;
}

/**
 * @param beforeRestart flushed and awaited before the app restarts — the shift on screen has to be
 * written down first, or applying an update throws away the day.
 */
export function useUpdate(beforeRestart: () => Promise<void>): Update {
  const { isUpdateAvailable, isDownloading, downloadProgress, availableUpdate } = Updates.useUpdates();
  // What *this* screen is doing about it, as opposed to what the library knows.
  const [step, setStep] = useState<'waiting' | 'accepted' | 'restarting' | 'failed' | 'dismissed'>('waiting');

  // Asked once, when the game opens. Returning to the menu between days does not re-ask: the
  // answer cannot change without a new launch, and a dialog over every day would be a nag.
  useEffect(() => {
    if (!updatable()) return;
    Updates.checkForUpdateAsync().catch((error: unknown) => {
      // Not being able to reach the update server is ordinary, and never the player's problem.
      warn('could not check for a new version', error);
    });
  }, []);

  const accept = useCallback(() => {
    setStep('accepted');
    (async () => {
      await Updates.fetchUpdateAsync();
      setStep('restarting');
      // The restart replaces this process. Everything that has to survive it goes now.
      await beforeRestart();
      await Updates.reloadAsync();
    })().catch((error: unknown) => {
      warn('could not install the new version', error);
      setStep('failed');
    });
  }, [beforeRestart]);

  const dismiss = useCallback(() => setStep('dismissed'), []);

  let status: UpdateStatus = 'none';
  if (step === 'failed') status = 'failed';
  else if (step === 'restarting') status = 'applying';
  else if (step === 'accepted') status = isDownloading ? 'downloading' : 'applying';
  else if (step === 'waiting' && isUpdateAvailable && updatable()) status = 'offered';

  return {
    status,
    publishedAt: availableUpdate?.createdAt ?? null,
    progress: downloadProgress ?? 0,
    accept,
    dismiss,
  };
}
