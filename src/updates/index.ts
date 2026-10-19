import { uiState } from '../ui-state';
import { applyUpdate, fetchManifest, isApp, settle } from './live';
import { canInstall, fetchRelease, installNewBuild, isNewFile, openReleasePage } from './install';
import { decide } from './manifest';
import { NATIVE_VERSION } from './native';
import { Release } from './release';

/**
 * Keeping an installed app current, which is two different jobs wearing one face.
 *
 * The page needs none of this — it fetches the newest build every time it is opened — but an app
 * carries the game inside it, so it has to be told. It asks **once a launch** and the player
 * decides; nothing is ever swapped behind them.
 *
 * - Most new versions are the web build, and those are downloaded into place and swapped
 *   (`live.ts`). No reinstall, no store, and the shop is untouched.
 * - A new version whose **native shell** moved cannot travel that way, so the app is told to
 *   install a file instead (`install.ts`). That is the rarer of the two by a long way.
 *
 * **The new file takes precedence** when both are true, because an update that cannot carry what
 * the player is missing is not worth asking about. In practice they do not compete: the site only
 * asks for a newer shell once one has been built.
 */
export type UpdateStatus = 'offered' | 'downloading' | 'applying' | 'failed';

export interface UpdateOffer {
  kind: 'live' | 'newFile';
  status: UpdateStatus;
  /** 0–1 while something is coming down. */
  progress: number;
  /** Megabytes, for the new-file offer, where a download that size is worth saying out loud. */
  megabytes: number;
  /** Android can install a new file; iOS can only be shown where it is. */
  canInstall: boolean;
  /** `2.57`, for the card. Empty for a live update, which has no version a player would know. */
  version: string;
  accept(): void;
  dismiss(): void;
}

let cancelled = false;

function show(offer: UpdateOffer | null) {
  uiState.set({ update: offer });
}

function patch(offer: UpdateOffer, changes: Partial<UpdateOffer>) {
  const next = { ...offer, ...changes };
  show(next);
  return next;
}

/**
 * Ask what is out there, once, and put up the card if there is anything to say.
 *
 * Called after the shop is on screen rather than before it: the first thing it does is make the
 * build that has just booted permanent (`settle`), which is the rollback rule in `live.ts`, and
 * neither half of it is worth a single frame of the loading screen.
 */
export async function startUpdates(): Promise<void> {
  if (!isApp()) return;
  await settle();

  const manifest = await fetchManifest();
  const verdict = decide({ webBuild: __WEB_BUILD__, nativeVersion: NATIVE_VERSION }, manifest);
  if (verdict.kind === 'none') return;

  if (verdict.kind === 'newFile') {
    const release = await fetchRelease();
    // Nothing to install *yet* is a real state: the site wants a shell that has not been built
    // into a file anyone can have. The right thing to say about it is nothing.
    if (isNewFile(release) && release) offerNewFile(release);
    return;
  }

  // What this will actually cost is worked out inside `applyUpdate`, against the build on disk;
  // the live card shows a bar rather than a size, because "a few hundred kB, unless this is your
  // first one" is not a number worth putting in front of anybody.
  offerLive(() => applyUpdate(verdict.manifest, (progress) => {
    const offer = uiState.value.update;
    if (offer && offer.status === 'downloading') patch(offer, { progress: progress.done });
  }, () => cancelled));
}

function offerLive(apply: () => Promise<void>) {
  const offer: UpdateOffer = {
    kind: 'live',
    status: 'offered',
    progress: 0,
    megabytes: 0,
    canInstall: true,
    version: '',
    accept: () => void accept(),
    dismiss,
  };
  show(offer);

  async function accept() {
    const working = patch(uiState.value.update ?? offer, { status: 'downloading', progress: 0 });
    try {
      await apply();
      // The WebView is reloading into the new build; this card goes with the page it is on.
      patch(working, { status: 'applying' });
    } catch (error: unknown) {
      if (cancelled) return;
      console.warn('[update] the new build could not be put in place:', error);
      patch(working, { status: 'failed' });
    }
  }
}

function offerNewFile(release: Release) {
  const offer: UpdateOffer = {
    kind: 'newFile',
    status: 'offered',
    progress: 0,
    megabytes: Math.round(release.apkBytes / 1024 / 1024),
    canInstall: canInstall() && !!release.apkUrl,
    version: release.version,
    accept: () => void accept(),
    dismiss,
  };
  show(offer);

  async function accept() {
    if (!offer.canInstall) {
      openReleasePage(release);
      return;
    }
    const working = patch(uiState.value.update ?? offer, { status: 'downloading', progress: 0 });
    try {
      await installNewBuild(release, (fraction) => {
        const current = uiState.value.update;
        if (current && current.status === 'downloading') patch(current, { progress: fraction });
      }, () => cancelled);
      // Android's installer is in front now; the game is behind it either way.
      patch(working, { status: 'applying' });
    } catch (error: unknown) {
      if (cancelled) return;
      console.warn('[update] the new file could not be installed:', error);
      patch(working, { status: 'failed' });
    }
  }
}

/**
 * Put the card away for this launch.
 *
 * A card that covers the screen and takes every touch must always have a way off it: a download
 * that stalls on a bad connection would otherwise leave the player holding a picture of a boba
 * shop, which is a complete freeze as far as they are concerned.
 */
function dismiss() {
  cancelled = true;
  show(null);
}
