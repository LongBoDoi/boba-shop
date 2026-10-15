import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Build, isNewer, LATEST_RELEASE_URL, parseRelease, Release, ReleaseFile } from './releases';

/**
 * Offering the newest release to a shop that was handed out as a file.
 *
 * What the game can actually do about an update is not the same on every platform, and only one of
 * the three can install anything:
 *
 * - **Android** can. The `.apk` is downloaded and handed to the system package installer, which
 *   asks the player to confirm. It installs over the running app because both are signed with the
 *   same EAS keystore. This needs `REQUEST_INSTALL_PACKAGES`, declared in `app.json`.
 * - **iOS** cannot, and no library changes that: there is no API for installing an `.ipa` from
 *   inside an app, and the published one is unsigned anyway — it has to be re-signed on a computer.
 *   So the game says a new build exists and opens the release page.
 * - **The web build** is never behind: it is redeployed on every push, and the page the player has
 *   open is the newest one as soon as they reload. It is never offered an update.
 *
 * A build that nothing stamped (`build: 0` — a dev server or a local export) is left alone too:
 * there is no release behind it to compare against, and every release would look newer.
 */

/** Only look again this often; coming back to the menu between days should not re-ask. */
const LOOK_AGAIN_MS = 30 * 60 * 1000;

/** `FLAG_GRANT_READ_URI_PERMISSION` — the installer has to be allowed to read our cached file. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

export type UpdateFailure = 'network' | 'noFile' | 'install';

export type UpdateState =
  /** This build does not do updates: the web page, or nothing stamped it. */
  | { status: 'off' }
  | { status: 'checking' }
  | { status: 'current' }
  | { status: 'available'; release: Release }
  | { status: 'downloading'; release: Release; fraction: number }
  /** Android: handed to the package installer. iOS: the release page is open in the browser. */
  | { status: 'opened'; release: Release }
  | { status: 'failed'; reason: UpdateFailure };

/**
 * Which build of the game this is. `version` is `app.json`'s; `build` is the workflow run number
 * that `tools/stamp-build.cjs` wrote into `extra.build` at build time, or 0 if nothing did.
 */
export function runningBuild(): Build {
  const config = Constants.expoConfig;
  const version = typeof config?.version === 'string' ? config.version : '0.0.0';
  const stamped = (config?.extra as Record<string, unknown> | undefined)?.build;
  const build = typeof stamped === 'number' && Number.isInteger(stamped) && stamped > 0 ? stamped : 0;
  return { version, build };
}

/** Whether this build is one that could be replaced by a release. */
export function updatable(): boolean {
  return Platform.OS !== 'web' && runningBuild().build > 0;
}

/** Remembered for the life of the app, so returning to the menu doesn't re-ask GitHub. */
let lastLook: { at: number; release: Release | null } | null = null;

async function fetchLatest(): Promise<Release | null> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  // A repository with no releases yet answers 404, which is not an error worth showing.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return parseRelease(await response.json());
}

/**
 * Download the `.apk` and hand it to the system installer. Resolves once the installer has been
 * opened — what the player does there is out of our hands, and if they accept, this process is
 * replaced rather than returning.
 */
async function installApk(file: ReleaseFile, onProgress: (fraction: number) => void): Promise<void> {
  // Loaded here rather than at the top of the file: neither module has anything to do on the web,
  // and `expo-intent-launcher` is Android-only, so neither should be evaluated to render a menu.
  const { File, Paths } = await import('expo-file-system');
  const { startActivityAsync } = await import('expo-intent-launcher');

  const target = new File(Paths.cache, file.name);
  // A part-downloaded file from a cancelled attempt would otherwise be appended to or refused.
  if (target.exists) target.delete();

  const task = File.createDownloadTask(file.url, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      // `totalBytes` is -1 when the server sends no Content-Length; the release tells us the size.
      const total = totalBytes > 0 ? totalBytes : file.bytes;
      if (total > 0) onProgress(Math.min(1, bytesWritten / total));
    },
  });
  // Resolves to null only when the task was paused, which nothing here does.
  const downloaded = await task.downloadAsync();
  if (!downloaded) throw new Error('the download did not finish');

  await startActivityAsync('android.intent.action.VIEW', {
    data: downloaded.contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

export function useUpdate() {
  const [state, setState] = useState<UpdateState>(() => (updatable() ? { status: 'checking' } : { status: 'off' }));
  // Fixed for the life of the app: it is read out of the build's own embedded config.
  const running = useMemo(() => runningBuild(), []);
  // Nothing that happens after the menu is left should land in state.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const settle = useCallback((next: UpdateState) => {
    if (live.current) setState(next);
  }, []);

  const check = useCallback(
    (force = false) => {
      if (!updatable()) {
        settle({ status: 'off' });
        return;
      }
      const fresh = lastLook && !force && Date.now() - lastLook.at < LOOK_AGAIN_MS;
      if (fresh && lastLook) {
        const { release } = lastLook;
        settle(release && isNewer(running, release) ? { status: 'available', release } : { status: 'current' });
        return;
      }
      settle({ status: 'checking' });
      fetchLatest()
        .then((release) => {
          lastLook = { at: Date.now(), release };
          settle(release && isNewer(running, release) ? { status: 'available', release } : { status: 'current' });
        })
        .catch((error: unknown) => {
          // Not being able to reach GitHub is ordinary — the shop still opens.
          console.warn('[update] could not read the latest release:', error);
          settle({ status: 'failed', reason: 'network' });
        });
    },
    [running, settle],
  );

  // Ask once when the menu appears. `check` only sets state from a callback, never synchronously.
  useEffect(() => {
    check();
  }, [check]);

  const install = useCallback(
    (release: Release) => {
      if (Platform.OS === 'android') {
        if (!release.apk) {
          settle({ status: 'failed', reason: 'noFile' });
          return;
        }
        settle({ status: 'downloading', release, fraction: 0 });
        installApk(release.apk, (fraction) => settle({ status: 'downloading', release, fraction }))
          .then(() => settle({ status: 'opened', release }))
          .catch((error: unknown) => {
            console.warn('[update] could not install the new build:', error);
            settle({ status: 'failed', reason: 'install' });
          });
        return;
      }
      // iOS and anything else: the release page is as far as the game can take them.
      Linking.openURL(release.page)
        .then(() => settle({ status: 'opened', release }))
        .catch((error: unknown) => {
          console.warn('[update] could not open the release page:', error);
          settle({ status: 'failed', reason: 'install' });
        });
    },
    [settle],
  );

  return { state, running, check, install };
}
