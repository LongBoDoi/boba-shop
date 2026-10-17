/**
 * Working out whether a new *file* exists, as opposed to a new update.
 *
 * `useUpdate.ts` handles the kind of new version that arrives over the air: JavaScript and
 * artwork, swapped in place. This handles the other kind — the one that needs the app installed
 * again, because its native side changed and an update cannot carry native code.
 *
 * **The whole thing rests on one invariant the project already keeps**: `expo.version` moves if
 * and only if a new binary is required. `tools/check-updates.cjs` enforces exactly that — it
 * fails when the native dependency list changes while the version stands still. So comparing the
 * version in the latest GitHub release against the version this app was built as is a complete
 * answer, and needs nothing else: no build numbers, no manifest archaeology, no extra native
 * module to read the installed version with. A rebuild at the same version is an update's job and
 * is deliberately *not* offered here.
 *
 * Nothing in this file touches the network or the platform, so it can be driven directly from a
 * script; `useNewBuild.ts` is the part that cannot.
 */

/** Where the releases are. The repository is public, so this needs no token. */
export const LATEST_RELEASE_URL = 'https://api.github.com/repos/LongBoDoi/boba-shop/releases/latest';

export interface Release {
  /** `1.2.0`, out of a `v1.2.0+41` tag. */
  version: string;
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
  return { version, pageUrl, apkUrl, apkBytes };
}

/**
 * Is `release` a build this app cannot reach with an over-the-air update?
 *
 * `installed` is the running app's version — `Updates.runtimeVersion` under the `appVersion`
 * policy. When it cannot be read at all, the answer is **no**: a missing version is not evidence
 * of being out of date, and offering a 95 MB download on a guess is worse than staying quiet.
 */
export function needsNewBuild(installed: string | null, release: Release | null): boolean {
  if (!release || !installed) return false;
  return compareVersions(release.version, installed) > 0;
}
