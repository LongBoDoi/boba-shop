import { Capacitor, CapacitorHttp, WebView } from '@capacitor/core';
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

/**
 * Where downloaded builds are kept, one directory per build — and **iOS does not get a choice**.
 *
 * Android remembers the whole path it was given and checks the directory still exists before
 * serving it, so any directory in the app's data will do. iOS keeps only the **last component** of
 * the persisted path and roots it at `Library/NoCloud/ionic_built_snapshots` on the next launch,
 * with no check that anything is there (`instanceDescriptor` in `CAPBridgeViewController`). A
 * build written anywhere else therefore works for exactly one launch and comes back to a white
 * screen that no force-close can clear — the one failure this whole design exists to prevent, and
 * the only one it cannot roll back from, because the build *did* boot and so *was* persisted.
 */
const IOS = Capacitor.getPlatform() === 'ios';
const ROOT = IOS ? 'NoCloud/ionic_built_snapshots' : 'builds';
const HOME = IOS ? Directory.Library : Directory.Data;
/**
 * A whole update has this long to finish before it is called a failure.
 *
 * It is generous because it is the wrong tool for a stalled connection: twenty-two megabytes on a
 * phone's data is legitimately slow, and a deadline tight enough to catch a stall would fail an
 * update that was working. The stall is caught per request instead, by the timeouts below, which
 * the native HTTP layer enforces on a connection that opens and then says nothing.
 */
const DEADLINE_MS = 20 * 60_000;
/** How long one request may take to connect, and how long it may then go quiet mid-file. */
const CONNECT_MS = 20_000;
const READ_MS = 60_000;

export const isApp = () => Capacitor.isNativePlatform();

/**
 * Read one file off the site — and **not with `fetch`**, which cannot do it at all.
 *
 * This is the only thing in the game that reaches outside the app, and the app is not where the
 * site is: the WebView is served from `https://localhost` (`capacitor://localhost` on iOS), so
 * every request to the site is cross-origin, and the host sends no `Access-Control-Allow-Origin`
 * on a static file — its CORS defaults are for API routes, and a static deploy has none. The
 * browser therefore refuses the response before any of this code sees it, with a bare
 * `TypeError: Failed to fetch`. That is exactly the shape of a site that cannot be asked, which
 * `fetchManifest` reads as nothing to report, so the check was **silent rather than broken**: the
 * card never appeared and no app ever updated itself.
 *
 * `CapacitorHttp` makes the request in native code instead, where there is no origin to be wrong
 * about. Two things about it are worth knowing before it is swapped for something else:
 *
 * - it is **part of Capacitor's core** on both platforms, not a plugin to install, so this needs
 *   no change to the native shell and `NATIVE_VERSION` does not move for it;
 * - calling it is **not** gated on the `CapacitorHttp.enabled` config, which only decides whether
 *   `window.fetch` is patched to go through it. Turning that on would have fixed this in one line
 *   and sent Phaser's twenty megabytes of artwork through a native round trip as well, so it
 *   stays off and the two requests that need native HTTP ask for it by name.
 *
 * Android hands a JSON response back already parsed and everything else as a string, iOS hands
 * back a string, so both shapes arrive here and neither is the one to count on.
 */
async function readSite(file: string): Promise<unknown> {
  const { status, data } = await CapacitorHttp.get({
    url: `${SITE}/${file}`,
    headers: { 'Cache-Control': 'no-cache' },
    responseType: 'text',
    connectTimeout: CONNECT_MS,
    readTimeout: READ_MS,
  });
  if (status < 200 || status >= 300) throw new Error(`${file} answered ${status}`);
  return data;
}

const asText = (data: unknown): string => (typeof data === 'string' ? data : JSON.stringify(data));
const asJson = (data: unknown): unknown => (typeof data === 'string' ? JSON.parse(data) : data);

export const reasonFor = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)) || 'không rõ lý do';

/**
 * Do one step of an update, and if it fails, say **which** step it was.
 *
 * An update is a few hundred native calls over two platforms, and what comes back from a failed
 * one is a sentence with no subject: "File does not exist", "Error downloading file". A player
 * cannot read a log and neither can anyone they report it to, so the card shows this text, and
 * what it is worth depends entirely on it naming the file and the move. The first version of this
 * failed with nothing but "Chưa tải được bản mới" and cost a build to find out why.
 */
async function doing<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    throw new Error(`${what}: ${reasonFor(error)}`);
  }
}

/**
 * Fetch one file of the build and write it down.
 *
 * **Not `Filesystem.downloadFile`**, which is what this used to be and is the single thing that
 * has been removed from the mechanism rather than added to it. Three strikes against it: it is
 * deprecated (the plugin points at `@capacitor/file-transfer` instead, which is native code this
 * app would have to be reinstalled to get); it is the plugin's one remaining *legacy*
 * implementation, which writes straight to a `FileOutputStream` and so fails on any directory
 * nobody made first; and it was never the thing this app had been shown to be able to do.
 * `CapacitorHttp` is — it is how the manifest is read, so by the time a file is being fetched it
 * has already worked twice on this device.
 *
 * A native response for a binary body arrives as base64, which is exactly what `writeFile` takes
 * when it is given no encoding, so the file crosses the bridge once and lands as itself.
 * `recursive` makes its own parent directories, which is what the legacy downloader would not.
 */
async function downloadInto(file: string, to: string): Promise<void> {
  const { status, data } = await CapacitorHttp.get({
    url: `${SITE}/${file}`,
    responseType: 'blob',
    connectTimeout: CONNECT_MS,
    readTimeout: READ_MS,
  });
  if (status < 200 || status >= 300) throw new Error(`máy chủ trả lịi ${status}`);
  if (typeof data !== 'string') throw new Error('không nhận được nội dung tệp');
  await Filesystem.writeFile({ path: to, directory: HOME, data, recursive: true });
}

/** The build the site is serving, or null if it cannot be read or does not hang together. */
export async function fetchManifest(): Promise<UpdateManifest | null> {
  try {
    const manifest = parseManifest(asJson(await readSite('update.json')));
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
    const whole = isWhole(asText(await readSite('index.html')), manifest);
    if (!whole) console.warn('[update] the site is mid-deploy; waiting for the next launch');
    return whole;
  } catch (error: unknown) {
    console.warn('[update] the page could not be read:', error);
    return false;
  }
}

/**
 * Which downloaded build the app is serving, by the name of its directory — or **null when it is
 * serving the one inside its own package**, which is not a directory at all.
 *
 * `WebView.getServerBasePath()` does not answer that question on its own, and believing it did is
 * what broke the first two updates anybody tried. A Capacitor app that has never been updated is
 * serving its *assets*, and what the base path reads back as then is the literal string `public`:
 * the name of a folder inside the APK, not a path, and **not empty**. Taken for a build on disk it
 * names `builds/<whatever the package's own manifest says>` — a directory that has never existed
 * — so every file the update meant to copy out of it is missing, and the update dies on the first
 * one. Which is exactly how it died: the first copy, the first font, every time.
 *
 * So the question is not "is there a path" but "is it one of ours": an absolute path ending in a
 * directory under `ROOT`. iOS says `public` too, as an absolute path inside its bundle, so it
 * passes the first half of that and fails the second.
 */
function servedBuild(path: string | null | undefined): string | null {
  const match = new RegExp(`^/.*/${ROOT}/([^/]+)/?$`).exec(path ?? '');
  return match ? match[1] : null;
}

/**
 * The build this app is running, read back from the files it is being served.
 *
 * For an app still running what it was installed with, those files are inside the package: nothing
 * of it can be copied, so this returns null for both and the first update is a full download.
 *
 * The `fetch` is a plain one and should stay one: it reads the app's **own** page, off the local
 * server, on the WebView's own origin. `readSite` above is for the site, which is somewhere else.
 */
async function running(): Promise<{ build: string | null; manifest: UpdateManifest | null }> {
  const { path } = await WebView.getServerBasePath();
  const build = servedBuild(path);
  if (!build) return { build: null, manifest: null };
  try {
    const response = await fetch('update.json', { cache: 'no-store' });
    return { build, manifest: response.ok ? parseManifest(await response.json()) : null };
  } catch {
    return { build, manifest: null };
  }
}

/**
 * Make a directory, and **let a real failure through**.
 *
 * A directory that already exists is the one failure worth ignoring. Everything else used to be
 * swallowed here too, on the reasoning that a real problem would surface on the write — and that
 * was wrong twice over: the write it surfaced on was a different call, with a message about a
 * missing file rather than a missing directory, and `Filesystem.copy` refuses outright when the
 * destination's parent is not there, which is most of an update after the first one.
 */
async function mkdirp(path: string) {
  try {
    await Filesystem.mkdir({ path, directory: HOME, recursive: true });
  } catch (error: unknown) {
    if (!/exist/i.test(reasonFor(error))) throw new Error(`tạo thư mục ${path}: ${reasonFor(error)}`);
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
  // Named after the directory that is actually being served, not after what a manifest inside it
  // says it is: those two disagreeing is what this whole failure was.
  const source = current.build ? `${ROOT}/${current.build}` : null;

  // A directory left over from an update that was interrupted is not worth reusing: it may hold
  // half a build. Start it again from nothing.
  await Filesystem.rmdir({ path: target, directory: HOME, recursive: true }).catch(() => {});
  await mkdirp(target);
  // `downloadInto` makes its own parents; these are for `copy`, which refuses without them.
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

  // A copy is only ever an **optimisation** — the same file, already on the device, under the same
  // content-hashed name. So a copy that cannot be made is a file to fetch, not an update to
  // abandon: whatever has become of the build on disk, the site still has every byte of this one.
  // The update that found this out failed with a hundred and forty files sitting on the server.
  const refetched: string[] = [];
  for (const path of work.copy) {
    check();
    try {
      await Filesystem.copy({
        from: `${source}/${path}`,
        to: `${target}/${path}`,
        directory: HOME,
        toDirectory: HOME,
      });
    } catch {
      refetched.push(path);
      await doing(`tải lại ${path}`, () => downloadInto(path, `${target}/${path}`));
    }
    step();
  }
  if (refetched.length) {
    console.warn(`[update] ${refetched.length} file(s) could not be copied from ${source} and came` +
      ` down again, starting with ${refetched[0]}`);
  }
  for (const path of work.fetch) {
    check();
    await doing(`tải ${path}`, () => downloadInto(path, `${target}/${path}`));
    step(manifest.files[path]);
  }

  // Everything is down. The manifest goes in last, so a directory that holds one is a build that
  // is all there — `running()` reads it back as what this app is.
  check();
  await doing('ghi update.json', () => Filesystem.writeFile({
    path: `${target}/update.json`,
    directory: HOME,
    data: JSON.stringify(manifest),
    encoding: Encoding.UTF8,
  }));

  const uri = await doing('tìm thư mục bản mới',
    async () => (await Filesystem.getUri({ path: target, directory: HOME })).uri);
  await doing('chuyển sang bản mới', () => WebView.setServerBasePath({ path: filePath(uri) }));
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
    const keep = servedBuild(path);
    if (!keep) {
      // Running the build inside the app: anything downloaded is being served to nobody. Note that
      // this is the common case and not the odd one — see `servedBuild` for what `path` says here,
      // which is neither empty nor a directory, and must not be persisted as one.
      await Filesystem.rmdir({ path: ROOT, directory: HOME, recursive: true }).catch(() => {});
      return;
    }
    await WebView.persistServerBasePath();
    const { files } = await Filesystem.readdir({ path: ROOT, directory: HOME });
    for (const entry of files) {
      if (entry.name === keep) continue;
      await Filesystem.rmdir({ path: `${ROOT}/${entry.name}`, directory: HOME, recursive: true })
        .catch(() => {});
    }
  } catch (error: unknown) {
    console.warn('[update] this build could not be kept:', error);
  }
}
