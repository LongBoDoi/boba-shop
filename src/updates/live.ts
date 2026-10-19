import { Capacitor, WebView } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { directories, isWhole, parseManifest, plan, UpdateManifest } from './manifest';

/**
 * The update that needs no reinstalling: the new web build, downloaded into the app and served
 * from there.
 *
 * **Why this works at all.** A Capacitor app is this same page, served to its WebView by a local
 * server out of the app's own files. `WebView.setServerBasePath` points that server somewhere
 * else — a directory in the app's data — and reloads. So an update is: fetch the files, write them
 * down, point the server at them. No store, no reinstall, and **the shop survives**, because the
 * page's origin does not change and the save is `localStorage` on that origin.
 *
 * Three rules, each of which is the difference between an update and an unusable app:
 *
 * - **Nothing is swapped until every file is written.** A half-written directory served to the
 *   WebView is a white screen with no way back.
 * - **The new build is made permanent only once it has booted.** `setServerBasePath` lasts for
 *   this launch; `persistServerBasePath` is what survives a restart, and `settle()` below calls it
 *   from the new build itself, after the shop is on screen. A build that cannot boot is therefore
 *   never persisted: the player force-closes the app and the next launch comes up on the last one
 *   that *did* boot. That is the whole rollback, and it needs no native code to work.
 * - **Only the files that actually changed come down.** Everything under `assets/` carries a hash
 *   of its own contents in its name, so a file with the same name is the same file and is copied
 *   across from the build already on disk. See `plan` in `manifest.ts`.
 */

/** Where the game is published. The app asks this, whatever build it is itself running. */
export const SITE = 'https://boba-shop.expo.app';
/** The app's data directory for downloaded builds, one directory per build. */
const ROOT = 'builds';
/** A whole update has this long to finish before it is called a failure. */
const DEADLINE_MS = 10 * 60_000;

export const isApp = () => Capacitor.isNativePlatform();

/** The build the site is serving, or null if it cannot be read or does not hang together. */
export async function fetchManifest(): Promise<UpdateManifest | null> {
  try {
    const response = await fetch(`${SITE}/update.json`, { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest = parseManifest(await response.json());
    return manifest && (await servedPageMatches(manifest)) ? manifest : null;
  } catch (error: unknown) {
    console.warn('[update] the site could not be asked:', error);
    return null;
  }
}

/**
 * Whether the page the site is serving is the one the manifest describes — see `isWhole`, which is
 * where the reasoning lives. A site caught mid-deploy is not an update, it is a wait.
 */
async function servedPageMatches(manifest: UpdateManifest): Promise<boolean> {
  try {
    const response = await fetch(`${SITE}/index.html`, { cache: 'no-store' });
    if (!response.ok) return false;
    const whole = isWhole(await response.text(), manifest);
    if (!whole) console.warn('[update] the site is mid-deploy; waiting for the next launch');
    return whole;
  } catch {
    return false;
  }
}

/**
 * The build this app is running, read back from the files it is being served.
 *
 * For an app still running what it was installed with, those files are inside the package and
 * `basePath` is empty — nothing of it can be copied, so this returns null and the first update is
 * a full download.
 */
async function running(): Promise<{ basePath: string; manifest: UpdateManifest | null }> {
  const { path } = await WebView.getServerBasePath();
  if (!path) return { basePath: '', manifest: null };
  try {
    const response = await fetch('update.json', { cache: 'no-store' });
    return { basePath: path, manifest: response.ok ? parseManifest(await response.json()) : null };
  } catch {
    return { basePath: path, manifest: null };
  }
}

async function mkdirp(path: string) {
  try {
    await Filesystem.mkdir({ path, directory: Directory.Data, recursive: true });
  } catch {
    // Already there, which is the only failure worth ignoring; a real one surfaces on the write.
  }
}

export interface Progress {
  /** 0–1 across the whole apply. */
  done: number;
  bytes: number;
  totalBytes: number;
}

/**
 * Put `manifest`'s build on disk and serve the game from it. Throws if anything is missing, and
 * leaves what is running untouched when it does.
 */
export async function applyUpdate(
  manifest: UpdateManifest,
  onProgress: (progress: Progress) => void,
  cancelled: () => boolean,
): Promise<void> {
  const started = Date.now();
  const current = await running();
  const work = plan(current.manifest, manifest);
  const target = `${ROOT}/${manifest.webBuild}`;
  const source = current.manifest ? `${ROOT}/${current.manifest.webBuild}` : null;

  // A directory left over from an update that was interrupted is not worth reusing: it may hold
  // half a build. Start it again from nothing.
  await Filesystem.rmdir({ path: target, directory: Directory.Data, recursive: true }).catch(() => {});
  await mkdirp(target);
  for (const directory of directories(manifest)) await mkdirp(`${target}/${directory}`);

  const total = work.copy.length + work.fetch.length;
  let done = 0;
  let bytes = 0;
  const step = (size = 0) => {
    done += 1;
    bytes += size;
    onProgress({ done: total ? done / total : 1, bytes, totalBytes: work.bytes });
  };
  const check = () => {
    if (cancelled()) throw new Error('cancelled');
    if (Date.now() - started > DEADLINE_MS) throw new Error('the update took too long');
  };

  for (const path of work.copy) {
    check();
    await Filesystem.copy({
      from: `${source}/${path}`,
      to: `${target}/${path}`,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
    step();
  }
  for (const path of work.fetch) {
    check();
    await Filesystem.downloadFile({
      url: `${SITE}/${path}`,
      path: `${target}/${path}`,
      directory: Directory.Data,
    });
    step(manifest.files[path]);
  }

  // Everything is down. The manifest goes in last, so a directory that holds one is a build that
  // is all there — `running()` reads it back as what this app is.
  check();
  await Filesystem.writeFile({
    path: `${target}/update.json`,
    directory: Directory.Data,
    data: JSON.stringify(manifest),
    encoding: Encoding.UTF8,
  });

  const { uri } = await Filesystem.getUri({ path: target, directory: Directory.Data });
  await WebView.setServerBasePath({ path: filePath(uri) });
  // The WebView is reloading into the new build; `settle()` there makes it permanent.
}

/** `file:///data/...` as the plain path both platforms want back. */
function filePath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

/**
 * Called once the shop is actually on screen: this build works, so make it the one the app opens
 * with, and throw away every build that is not it.
 *
 * Until this runs, the app is still *persisted* on the build it opened with — which is what makes
 * a bad update cost a force-close rather than a reinstall.
 *
 * **Installing a new file resets this**, and that is Capacitor's doing, not ours: both platforms
 * forget the persisted path when the binary's version changes (`isNewBinary` in Android's
 * `Bridge`, `updateBinaryVersion` on iOS). So a freshly installed app runs the build inside it
 * rather than whatever it had downloaded before, which is the only safe answer — the downloaded
 * one was made for the shell that app has just replaced. The downloads it leaves behind are what
 * the empty-path branch below is for.
 */
export async function settle(): Promise<void> {
  if (!isApp()) return;
  try {
    const { path } = await WebView.getServerBasePath();
    if (!path) {
      // Running the build inside the app: anything downloaded is being served to nobody.
      await Filesystem.rmdir({ path: ROOT, directory: Directory.Data, recursive: true }).catch(() => {});
      return;
    }
    await WebView.persistServerBasePath();
    const keep = path.split('/').pop();
    const { files } = await Filesystem.readdir({ path: ROOT, directory: Directory.Data });
    for (const entry of files) {
      if (entry.name === keep) continue;
      await Filesystem.rmdir({ path: `${ROOT}/${entry.name}`, directory: Directory.Data, recursive: true })
        .catch(() => {});
    }
  } catch (error: unknown) {
    console.warn('[update] this build could not be kept:', error);
  }
}
