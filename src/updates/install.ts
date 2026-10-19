import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

import { NATIVE_VERSION } from './native';
import { LATEST_RELEASE_URL, needsNewBuild, parseRelease, Release } from './release';

/**
 * The other kind of new version: the one that has to be installed, because the native shell moved
 * and no update can carry native code.
 *
 * The two halves are not equal and cannot be made so:
 *
 * - **Android does the whole thing.** The `.apk` is downloaded and handed to the system installer
 *   (`InstallPlugin.java`). Every release is signed with the same key, so Android treats it as an
 *   update of this app and *the shop survives untouched*. That is the one reason this is worth a
 *   sensitive permission.
 * - **iOS cannot install an `.ipa` from inside an app.** No API, no entitlement — this is iOS, not
 *   Capacitor. So iOS is told plainly and handed the release page, and because the repository's
 *   `.ipa` is unsigned, re-signing it is usually a *fresh* install. That is why the iOS wording is
 *   the one place in the game that tells the player to export a backup first.
 */

interface InstallerPlugin {
  /** Hand a downloaded file to Android's package installer. */
  openApk(options: { path: string }): Promise<void>;
}
const Installer = registerPlugin<InstallerPlugin>('Install');

/** Only Android can install anything; iOS is offered the page instead. */
export const canInstall = () => Capacitor.getPlatform() === 'android';

/** The newest published file, or null if GitHub cannot be reached or says nothing useful. */
export async function fetchRelease(): Promise<Release | null> {
  try {
    const response = await fetch(LATEST_RELEASE_URL, { cache: 'no-store', headers: { accept: 'application/vnd.github+json' } });
    if (!response.ok) return null;
    return parseRelease(await response.json());
  } catch (error: unknown) {
    console.warn('[update] the releases could not be read:', error);
    return null;
  }
}

/** Whether this release is a file this app does not have. */
export function isNewFile(release: Release | null): boolean {
  return needsNewBuild(NATIVE_VERSION, release);
}

/**
 * Download the `.apk` and open the installer. Resolves when the installer has been handed the
 * file — what happens next is Android's and the player's.
 */
export async function installNewBuild(
  release: Release,
  onProgress: (fraction: number) => void,
  cancelled: () => boolean,
): Promise<void> {
  if (!release.apkUrl) throw new Error('that release has no .apk');
  const path = `download/tiem-tra-sua-${release.version}.apk`;
  await Filesystem.mkdir({ path: 'download', directory: Directory.Cache, recursive: true }).catch(() => {});
  await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});

  // The listener is the only progress a download gives; a file this size (tens of megabytes) with
  // a bar that never moves is indistinguishable from one that has stalled.
  const listener = await Filesystem.addListener('progress', (event) => {
    if (release.apkBytes > 0) onProgress(Math.min(1, event.bytes / release.apkBytes));
  });
  try {
    const downloaded = await Filesystem.downloadFile({ url: release.apkUrl, path, directory: Directory.Cache, progress: true });
    if (cancelled()) return;
    // `downloadFile` reports where it put the file; ask again if it did not say.
    const file = downloaded.path ?? (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
    await Installer.openApk({ path: file });
  } finally {
    await listener.remove();
  }
}

/** iOS, and anything else: the release page, in the system browser. */
export function openReleasePage(release: Release) {
  window.open(release.pageUrl, '_blank');
}
