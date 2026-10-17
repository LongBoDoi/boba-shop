import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { LATEST_RELEASE_URL, needsNewBuild, parseRelease, Release } from './release';

/**
 * The other kind of new version: the one that has to be installed, not downloaded into place.
 *
 * An over-the-air update is JavaScript and artwork and nothing else, so the moment the native side
 * changes — a new native dependency, a new SDK — the installed app is on its own. Before this,
 * **nothing told the player**: `checkForUpdateAsync` goes quiet exactly then, because the
 * published updates no longer match the runtime version the app was built as, so the game looked
 * perfectly up to date while sitting several versions behind. That silence is what this closes.
 *
 * The two paths are not equal and cannot be made equal:
 *
 * - **Android** can do the whole thing. The `.apk` is downloaded and handed to the system
 *   installer, which puts it over the top of the running app. Because every release is signed with
 *   the same EAS keystore, that is an *update* and not a reinstall, so **the shop survives it
 *   untouched** — no export, no backup, nothing for the player to do. This is the one path where
 *   "auto-update" is a fair description.
 * - **iOS cannot install an `.ipa` from inside an app.** There is no API, no entitlement and no
 *   permission that changes this; it is not an Expo limitation. So iOS is told plainly that there
 *   is a new version and handed the release page. (And because the repository's `.ipa` is
 *   unsigned, re-signing it is usually a fresh install, which is precisely why the settings card
 *   also offers a backup code — see `src/game/saveCode.ts`.)
 *
 * The permission this needs — `REQUEST_INSTALL_PACKAGES` — is the reason the old APK-installer
 * route was dropped once. It is back deliberately and for a narrower job: the OTA update carries
 * every ordinary change, and this is only for the handful that it cannot.
 *
 * **The two Android-only imports above are safe to import everywhere**, which is worth writing
 * down because it is the sort of thing that is assumed and then white-screens the web build.
 * `expo-intent-launcher` ships `export default {}` as its non-Android implementation and only
 * throws if something *calls* it, and `expo-file-system/legacy`'s web shim is a module of nulls.
 * The guards below are therefore about behaviour, not about avoiding an import — but if either of
 * those ever changes, this is where it will land, and the game ships on the web.
 */

function warn(what: string, error: unknown) {
  console.warn(`[build] ${what}:`, error);
}

/**
 * The checks have deadlines for the same reason the update's do: the dialog covers the screen.
 * Asking GitHub is quick or it is broken; a 95 MB download over a phone connection is neither.
 */
const CHECK_LIMIT_MS = 10_000;
const DOWNLOAD_LIMIT_MS = 15 * 60_000;

function deadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, giveUp) => {
      timer = setTimeout(() => giveUp(new Error(`${what} took longer than ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export type NewBuildStatus = 'none' | 'offered' | 'downloading' | 'installing' | 'failed';

export interface NewBuild {
  status: NewBuildStatus;
  /** The version being offered, for the card to name. */
  version: string | null;
  /** Megabytes, rounded, or 0 when the release does not say. */
  megabytes: number;
  /** 0–1 while downloading. */
  progress: number;
  /** False on iOS, where the app can only point at the download. */
  canInstall: boolean;
  accept: () => void;
  dismiss: () => void;
}

const IDLE: NewBuild = {
  status: 'none',
  version: null,
  megabytes: 0,
  progress: 0,
  canInstall: false,
  accept: () => {},
  dismiss: () => {},
};

/** Only a real installed build can be out of date in this sense. */
function relevant(): boolean {
  return Platform.OS !== 'web' && Updates.isEnabled;
}

/**
 * @param beforeLeaving flushed and awaited before the installer takes over — the system may
 * replace this process without warning once the install is accepted, and a write still in flight
 * is a lost shift. The same promise the update path uses.
 */
export function useNewBuild(beforeLeaving: () => Promise<void>): NewBuild {
  const [release, setRelease] = useState<Release | null>(null);
  const [step, setStep] = useState<'waiting' | 'downloading' | 'installing' | 'failed' | 'dismissed'>('waiting');
  const [progress, setProgress] = useState(0);

  // Asked once, when the game opens, like the update check — and for the same reason: the answer
  // cannot change without a new launch, and a dialog between every day would be a nag.
  useEffect(() => {
    if (!relevant()) return;
    let live = true;
    (async () => {
      const response = await deadline(
        fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } }),
        CHECK_LIMIT_MS,
        'asking about the newest version',
      );
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
      const latest = parseRelease(await response.json());
      if (!live) return;
      if (needsNewBuild(Updates.runtimeVersion, latest)) setRelease(latest);
    })().catch((error: unknown) => {
      // Being unable to reach GitHub is ordinary — no network, rate limited, repository moved —
      // and never the player's problem. They simply are not told about a new file this launch.
      warn('could not check for a newer build', error);
    });
    return () => {
      live = false;
    };
  }, []);

  const accept = useCallback(() => {
    const target = release;
    if (!target) return;

    // iOS: there is no install to perform, so this is the whole of it.
    if (Platform.OS !== 'android' || !target.apkUrl) {
      Linking.openURL(target.pageUrl).catch((error: unknown) => {
        warn('could not open the download page', error);
        setStep('failed');
      });
      setStep('dismissed');
      return;
    }

    setStep('downloading');
    setProgress(0);
    (async () => {
      // Into the cache: the system may clear it, which is correct for a file that is useless the
      // moment it has been installed. A stale one from a previous attempt is replaced rather than
      // resumed, because a half-written APK is refused by the installer with nothing to explain it.
      const destination = new File(Paths.cache, `boba-shop-${target.version}.apk`);
      try {
        if (destination.exists) destination.delete();
      } catch (error: unknown) {
        warn('could not clear a previous download', error);
      }

      const task = File.createDownloadTask(target.apkUrl!, destination);
      const subscription = task.addListener('progress', (update) => {
        // `totalBytes` is -1 when the server sends no Content-Length. GitHub's asset redirect does
        // send one, but the release already told us the size, so the bar does not depend on it.
        const total = update.totalBytes > 0 ? update.totalBytes : target.apkBytes;
        if (total > 0) setProgress(Math.min(1, update.bytesWritten / total));
      });
      try {
        const file = await deadline(task.downloadAsync(), DOWNLOAD_LIMIT_MS, 'downloading the new version');
        if (!file) throw new Error('the download did not finish');

        setStep('installing');
        // Everything that has to survive goes now: accepting hands control to the system
        // installer, and this process can be replaced from that point on without returning here.
        await beforeLeaving();

        // The installer cannot read a `file://` path out of another app's sandbox. A `content://`
        // URI through the FileProvider that `expo-file-system` already declares is what it takes,
        // and the read permission has to be granted along with it — flag 1,
        // FLAG_GRANT_READ_URI_PERMISSION. Without the flag the installer opens and immediately
        // reports the package as invalid.
        const content = await getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: content,
          type: 'application/vnd.android.package-archive',
          flags: 1,
        });
        // Back here means the player closed the installer without going through with it. The card
        // goes away rather than sitting on a step that has already finished.
        setStep('dismissed');
      } finally {
        subscription.remove();
      }
    })().catch((error: unknown) => {
      warn('could not install the newer build', error);
      setStep('failed');
    });
  }, [release, beforeLeaving]);

  const dismiss = useCallback(() => setStep('dismissed'), []);

  if (!release) return IDLE;

  let status: NewBuildStatus = 'none';
  if (step === 'failed') status = 'failed';
  else if (step === 'downloading') status = 'downloading';
  else if (step === 'installing') status = 'installing';
  else if (step === 'waiting') status = 'offered';

  return {
    status,
    version: release.version,
    megabytes: release.apkBytes > 0 ? Math.round(release.apkBytes / 1024 / 1024) : 0,
    progress,
    canInstall: Platform.OS === 'android' && Boolean(release.apkUrl),
    accept,
    dismiss,
  };
}
