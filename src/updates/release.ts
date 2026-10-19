/**
 * Working out whether a new *file* exists, as opposed to a new update.
 *
 * `live.ts` handles the kind of new version that arrives over the air: the web build, swapped in
 * place. This handles the other kind — the one that needs the app installed again, because its
 * native shell changed and an update cannot carry native code.
 *
 * **The release's tag says which shell it contains.** "Build apps" tags `v<nativeVersion>.<run>`,
 * so `v2.57` is run 57 of native shell 2, and an app offers the file only when that first number
 * is higher than its own `NATIVE_VERSION`. Reading it off the release rather than off the site is
 * what keeps the offer honest in the window between a deploy and a build: the site may already
 * want shell 3 while the newest file anyone can install is still shell 2, and in that window the
 * right thing to say is nothing at all.
 *
 * Nothing in this file touches the network or the platform, so it can be driven directly from a
 * script; `install.ts` is the part that cannot.
 */

/** Where the releases are. The repository is public, so this needs no token. */
export const LATEST_RELEASE_URL = 'https://api.github.com/repos/LongBoDoi/boba-shop/releases/latest';

export interface Release {
  /** `2.57`, out of a `v2.57` tag. */
  version: string;
  /** The native shell this file contains — the first number of the tag. See above. */
  nativeVersion: number;
  /** The release page, which is all iOS can be offered — see `useNewBuild`. */
  pageUrl: string;
  /** The `.apk`, or null if this release has none. */
  apkUrl: string | null;
  /** How big the `.apk` is, so the player can be told before a 95 MB download starts. */
  apkBytes: number;
}

/**
 * Compare two dotted version strings. Returns >0 if `a` is newer.
 *
 * Deliberately lenient about shape: it is reading a git tag written by a workflow, and a tag that
 * one day arrives as `v1.2` or `1.2.0-rc1` should order sensibly rather than throw. Anything
 * non-numeric in a segment reads as 0, and a missing segment reads as 0, so `1.2` and `1.2.0` are
 * the same version.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (text: string) => text.replace(/^v/i, '').split(/[.+-]/).map((piece) => Number.parseInt(piece, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Pull what matters out of a GitHub release, or null if the shape is not what we expect. */
export function parseRelease(raw: unknown): Release | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const release = raw as Record<string, unknown>;
  // The workflow tags `v<version>+<run number>`; `name` is prose and not to be parsed.
  const tag = typeof release.tag_name === 'string' ? release.tag_name : null;
  const pageUrl = typeof release.html_url === 'string' ? release.html_url : null;
  if (!tag || !pageUrl) return null;
  const version = /^v?(\d+(?:\.\d+)*)/.exec(tag)?.[1];
  if (!version) return null;
  const nativeVersion = Number.parseInt(version.split('.')[0], 10);
  if (!Number.isInteger(nativeVersion) || nativeVersion < 1) return null;
  // A draft is not published and a prerelease is not for players.
  if (release.draft === true || release.prerelease === true) return null;

  let apkUrl: string | null = null;
  let apkBytes = 0;
  if (Array.isArray(release.assets)) {
    for (const entry of release.assets) {
      if (entry === null || typeof entry !== 'object') continue;
      const asset = entry as Record<string, unknown>;
      const name = typeof asset.name === 'string' ? asset.name : '';
      const url = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : null;
      if (!url || !name.toLowerCase().endsWith('.apk')) continue;
      apkUrl = url;
      apkBytes = typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : 0;
      break;
    }
  }
  return { version, nativeVersion, pageUrl, apkUrl, apkBytes };
}

/**
 * Is this release a file this app has to install — a newer native shell than the one it is?
 *
 * A *rebuild* of the same shell is not: whatever changed in it is the web build, which an update
 * carries perfectly well, and asking a player for a download to get what they could have had over
 * the air is the failure this check exists to prevent.
 */
export function needsNewBuild(installedNative: number, release: Release | null): boolean {
  if (!release || !Number.isInteger(installedNative)) return false;
  return release.nativeVersion > installedNative;
}
