/**
 * Reading the game's own GitHub releases.
 *
 * The shop is handed out as files, not through a store: an `.apk` you copy to the phone and an
 * unsigned `.ipa` you re-sign yourself. Nothing is going to tell you a new one exists, so the game
 * asks. `https://api.github.com/repos/<repo>/releases/latest` is public on a public repository and
 * needs no token; it already skips drafts and pre-releases.
 *
 * This module is the part with no React, no network and no platform in it, so it can be driven
 * directly by `tools/check-updates.cjs` against a real release payload.
 */

/** The repository the game is published from. */
export const REPO = 'LongBoDoi/boba-shop';
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

/**
 * Which build of the game this is. `version` is `app.json`'s, which changes rarely; `build` is the
 * workflow's run number, stamped in at build time by `tools/stamp-build.cjs`. A `build` of 0 means
 * nothing stamped it — a dev server or a local export — and the game does not look for updates.
 */
export interface Build {
  version: string;
  build: number;
}

export interface ReleaseFile {
  name: string;
  url: string;
  bytes: number;
}

export interface Release extends Build {
  /** The tag as published, e.g. `v1.0.0+5`. */
  tag: string;
  /** The release's own page, for the platforms that cannot install a file themselves. */
  page: string;
  apk: ReleaseFile | null;
  ipa: ReleaseFile | null;
}

/** `v1.0.0+5` → `{ version: '1.0.0', build: 5 }`. A tag with no `+build` counts as build 0. */
export function parseTag(tag: unknown): Build | null {
  if (typeof tag !== 'string') return null;
  const match = /^v?(\d+(?:\.\d+)*)(?:\+(\d+))?$/.exec(tag.trim());
  if (!match) return null;
  return { version: match[1], build: match[2] ? Number(match[2]) : 0 };
}

/** The GitHub release payload, or `null` if it isn't one we can use. */
export function parseRelease(raw: unknown): Release | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const tag = typeof value.tag_name === 'string' ? value.tag_name : null;
  const parsed = parseTag(tag);
  const page = typeof value.html_url === 'string' ? value.html_url : null;
  if (!tag || !parsed || !page) return null;
  // `/releases/latest` never returns these, but a hand-built URL might.
  if (value.draft === true || value.prerelease === true) return null;

  const files = Array.isArray(value.assets) ? value.assets.map(parseFile) : [];
  const ending = (suffix: string) =>
    files.find((file): file is ReleaseFile => file !== null && file.name.toLowerCase().endsWith(suffix)) ?? null;

  return { ...parsed, tag, page, apk: ending('.apk'), ipa: ending('.ipa') };
}

function parseFile(raw: unknown): ReleaseFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const { name, browser_download_url: url, size } = value;
  if (typeof name !== 'string' || typeof url !== 'string') return null;
  const bytes = typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : 0;
  return { name, url, bytes };
}

/**
 * Is `release` worth offering over what is running?
 *
 * The version is compared segment by segment as numbers, then the build. In practice the build
 * alone would do — it is the workflow's run number, which only ever counts up, across versions as
 * well — but a shop running a version newer than the latest release should not be told to go
 * backwards just because its run number is lower.
 */
export function isNewer(local: Build, release: Build): boolean {
  const order = compareVersions(release.version, local.version);
  if (order !== 0) return order > 0;
  return release.build > local.build;
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

/** A download size the way Vietnamese writes it: `95,1 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const mb = bytes / 1_000_000;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** `v1.0.0+5` as the game shows it: `1.0.0 (build 5)`. */
export function describeBuild({ version, build }: Build): string {
  return build > 0 ? `${version} (build ${build})` : version;
}
