/**
 * What a build *is*, and what an installed app has to do about one it has not got.
 *
 * `update.json` sits beside the game at the site root, written by the `updateManifest` plugin in
 * `vite.config.ts` out of the same build it describes. Nothing here touches the network, the
 * filesystem or the platform, so the whole decision can be driven from a script —
 * `tools/check-updates.cjs` does exactly that.
 */

export interface UpdateManifest {
  /** The build the site is serving: the commit it was built from, or a local timestamp. */
  webBuild: string;
  /** The native shell that build expects. See `native.ts`. */
  nativeVersion: number;
  /** Every file of the build, by its path under the site root, and how big it is. */
  files: Record<string, number>;
}

/** What the running app is. */
export interface Installed {
  webBuild: string;
  nativeVersion: number;
}

export type Verdict =
  /** Up to date, or nothing to go on. */
  | { kind: 'none' }
  /** A build this app can download into place. */
  | { kind: 'live'; manifest: UpdateManifest }
  /** A build that needs the app installed again, because the shell itself moved. */
  | { kind: 'newFile'; nativeVersion: number };

/**
 * Which of the two it is.
 *
 * The order matters and is not arbitrary: **the new file wins**. A build whose shell has moved
 * cannot be delivered over the air at all, so offering the over-the-air update instead would hand
 * the player a download that leaves them exactly as far behind as they were — and the two are
 * never both worth asking about in one launch.
 *
 * A manifest that cannot be read, or that names a build this app is already running, is nothing to
 * report. Being *ahead* of the site is also nothing to report: it happens while a deploy is in
 * flight, and "update" to an older build is not a thing to offer.
 */
export function decide(installed: Installed, remote: UpdateManifest | null): Verdict {
  if (!remote) return { kind: 'none' };
  if (remote.nativeVersion > installed.nativeVersion) return { kind: 'newFile', nativeVersion: remote.nativeVersion };
  if (remote.webBuild === installed.webBuild) return { kind: 'none' };
  return { kind: 'live', manifest: remote };
}

/** Read a manifest off the wire, or null if it is not one. */
export function parseManifest(raw: unknown): UpdateManifest | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const webBuild = typeof value.webBuild === 'string' ? value.webBuild : null;
  const nativeVersion = typeof value.nativeVersion === 'number' && Number.isInteger(value.nativeVersion)
    ? value.nativeVersion : null;
  if (!webBuild || nativeVersion === null || nativeVersion < 1) return null;
  if (value.files === null || typeof value.files !== 'object' || Array.isArray(value.files)) return null;
  const files: Record<string, number> = {};
  for (const [path, bytes] of Object.entries(value.files as Record<string, unknown>)) {
    // A path is a file under the site root and nothing else. `..` would write outside the update's
    // own directory, and a leading slash would land at the root of the device.
    if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\')) return null;
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
    files[path] = bytes;
  }
  if (!files['index.html']) return null;
  return { webBuild, nativeVersion, files };
}

export interface Plan {
  /** Files the build this app is running already has, byte for byte, by their own name. */
  copy: string[];
  /** Files that have to come down. */
  fetch: string[];
  /** How much that is, in bytes. */
  bytes: number;
}

/**
 * What applying `next` actually costs, given the manifest of the build now running.
 *
 * Vite puts a hash of the contents in every name under `assets/`, so a file with the same name in
 * both builds **is** the same file and is copied across rather than downloaded — which is what
 * makes the usual update a few hundred kilobytes of changed code rather than twenty megabytes of
 * unchanged artwork. `index.html` and the handful of fixed names (`sw.js`, the manifest, the
 * icons) carry no hash, so they are always fetched; they are tiny.
 *
 * `current` is null for an app running the build inside its own package: nothing it has can be
 * copied, because those files are in the app's assets and not on the filesystem, so the first
 * update after installing a file is a full download. Every one after that is small.
 */
export function plan(current: UpdateManifest | null, next: UpdateManifest): Plan {
  const HASHED = /^assets\//;
  const copy: string[] = [];
  const fetch: string[] = [];
  let bytes = 0;
  for (const [path, size] of Object.entries(next.files)) {
    const reusable = current && HASHED.test(path) && current.files[path] === size;
    if (reusable) copy.push(path);
    else {
      fetch.push(path);
      bytes += size;
    }
  }
  return { copy, fetch, bytes };
}

/** The directories an update's files need, deepest last, so each can be made in turn. */
export function directories(manifest: UpdateManifest): string[] {
  const found = new Set<string>();
  for (const path of Object.keys(manifest.files)) {
    const parts = path.split('/').slice(0, -1);
    for (let i = 1; i <= parts.length; i++) found.add(parts.slice(0, i).join('/'));
  }
  return [...found].sort((a, b) => a.length - b.length);
}

/**
 * Does `html` — the page the site is serving right now — belong to the build `manifest` describes?
 *
 * It is one site but it is not one file, and the host caches each of them for an hour with no way
 * to ask for a fresh one (a query string is not part of its cache key; that was tried). So for a
 * while after a deploy, `update.json` can be the new build while `index.html` is still the old
 * one, and taking that pair would write down a build whose page asks for a script that is not in
 * it: a white screen, and an app that thinks it is already up to date.
 *
 * The page names the bundle it needs and the manifest lists what the build contains, so the two
 * can be held against each other. When they disagree the honest answer is to wait — the window is
 * minutes long and the next launch asks again.
 */
export function pageAsks(html: string): string[] {
  return [...html.matchAll(/(?:src|href)="\/?([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
}

export function isWhole(html: string, manifest: UpdateManifest): boolean {
  const asked = pageAsks(html);
  return asked.length > 0 && asked.every((path) => path in manifest.files);
}
