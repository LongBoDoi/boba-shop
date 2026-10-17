import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AppState, Platform } from 'react-native';

import { AudioSettings, DEFAULT_AUDIO } from '../game/reducer';
import { POUR_RATE } from '../game/ingredients';
import { MUSIC, MUSIC_GAIN, MusicId, SOUNDS, SoundId } from './sounds';
import { FoleyEngine } from './foley';

/**
 * The shop's ears. `sounds.ts` says what the cues are; this plays them.
 *
 * **It is a module and not a React anything, and that is the whole point.** Cues fire from the
 * middle of gestures — a finger grabbing a scoop, a tap being held open, a cup being dropped —
 * inside components that are memoized precisely so the day's clock cannot reach them (see "What
 * the game's clock is allowed to redraw" in CLAUDE.md). A context or a hook would have to arrive
 * as a prop or a subscription, and a volume living in React state would re-render every consumer
 * of it ten times a second. Imported functions reach every one of those call sites and change
 * nothing about what renders: `KitchenStation` takes no new prop for any of this.
 *
 * Everything funnels through `reconcile`, because what should be sounding is a function of four
 * facts that change independently — which track the game wants, the player's two volumes, whether
 * the app is in front, and whether the browser has let us make a sound yet. Scattering that
 * across six call sites is how you end up with music playing under a backgrounded app.
 */

/** Crossfades, and the fade a track is stopped with. Long and slow, like everything else here. */
const FADE_MS = 900;
const FADE_STEP_MS = 50;

let settings: AudioSettings = DEFAULT_AUDIO;
/** The track the game wants, regardless of whether anything can be heard right now. */
let wanted: MusicId | null = null;
let current: { id: MusicId; player: AudioPlayer } | null = null;
let gamePaused = false;
let active = true;
let ready = false;

/**
 * Whether a sound is allowed to come out yet.
 *
 * A browser will not play audio until the page has been interacted with, and there is no way to
 * ask whether it will — `play()` returns nothing to catch. So on the web this starts false and the
 * first real gesture anywhere in the document flips it; until then the game remembers what it
 * wanted and `reconcile` starts it the moment it is allowed. In practice the player never notices,
 * because the first gesture *is* the tap that starts the game. Native has no such rule.
 */
let unlocked = Platform.OS !== 'web';

let effects: FoleyEngine | null = null;

/** Storage and audio both fail in ways the game survives, so both report rather than throw. */
function warn(what: string, error: unknown) {
  console.warn(`[audio] ${what}:`, error);
}

// ------------------------------------------------------------------ fades
const fades = new Map<AudioPlayer, ReturnType<typeof setInterval>>();
/** Timers removing a faded-out track, so a teardown mid-fade does not leave them firing. */
const stopping = new Map<ReturnType<typeof setTimeout>, AudioPlayer>();

/**
 * Walk a player's volume to `to` over `FADE_MS`, then optionally stop it.
 *
 * Reanimated is no use here — nothing about this is rendered — so it is a plain timer, and it only
 * runs while a fade is actually in flight. One fade per player: starting a second cancels the
 * first, or the two would fight over the same volume and the loser would win half the time.
 */
function fadeTo(player: AudioPlayer, to: number, thenStop = false) {
  const existing = fades.get(player);
  if (existing) clearInterval(existing);
  const from = player.volume;
  const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    const at = Math.min(1, step / steps);
    try {
      player.volume = from + (to - from) * at;
      if (at >= 1) {
        clearInterval(timer);
        fades.delete(player);
        if (thenStop) player.pause();
      }
    } catch (error: unknown) {
      // A player removed under a running fade — a reload, a teardown — must not leave a timer
      // behind firing into it forever.
      clearInterval(timer);
      fades.delete(player);
      warn('a fade could not be applied', error);
    }
  }, FADE_STEP_MS);
  fades.set(player, timer);
}

// ------------------------------------------------------------------ setting up
/**
 * Build the players and start listening for the things that silence them. Safe to call twice.
 *
 * **This is deliberately not awaited and does not gate the loading screen.** The artwork is held
 * up front because a sprite that arrives late is a visible stutter inside a two-minute shift; a
 * cue that arrives late is a cue nobody can tell was late. Primary recorded contacts are warmed
 * here; the music is a megabyte and is built when it is first played, behind a one-second fade.
 * Putting either in front of the title screen would lengthen a cold start to buy nothing.
 */
export function initAudio(): () => void {
  if (ready) return () => {};
  ready = true;

  // The silent switch is the player's, not ours. `playsInSilentMode` defaults to *true*, which for
  // a game means a phone flipped to silent in a meeting starts playing music box; a game is
  // exactly the kind of app that switch is for. `mixWithOthers` is the other half of the same
  // manners: whatever the player already had on keeps playing, and they can turn our music off.
  setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch((error: unknown) => warn('the audio session could not be configured', error));

  active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  effects = new FoleyEngine(
    (source) => createAudioPlayer(source, { downloadFirst: true, updateInterval: 250 }), warn,
  );
  effects.prepare();
  reconcile();

  const subscription = AppState.addEventListener('change', (status) => {
    active = status === 'active';
    reconcile();
  });

  // On the web, the first gesture anywhere is what buys the right to make a sound. These are the
  // events a browser counts, they fire during the capture phase so nothing can swallow them, and
  // they take themselves off once the first one lands.
  const page = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
  const unlock = () => {
    unlocked = true;
    for (const event of UNLOCKING) page?.removeEventListener(event, unlock, true);
    reconcile();
  };
  for (const event of UNLOCKING) page?.addEventListener(event, unlock, true);

  return () => {
    subscription.remove();
    for (const event of UNLOCKING) page?.removeEventListener(event, unlock, true);
    teardown();
  };
}

const UNLOCKING = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;

function teardown() {
  for (const timer of fades.values()) clearInterval(timer);
  fades.clear();
  for (const [timer, player] of stopping) { clearTimeout(timer); remove(player); }
  stopping.clear();
  effects?.dispose();
  effects = null;
  if (current) remove(current.player);
  current = null;
  ready = false;
  gamePaused = false;
  unlocked = Platform.OS !== 'web';
}

/** `createAudioPlayer` does not clean up after itself, so every player made here is removed. */
function remove(player: AudioPlayer) {
  const fade = fades.get(player);
  if (fade) clearInterval(fade);
  fades.delete(player);
  try {
    player.remove();
  } catch (error: unknown) {
    warn('a player could not be released', error);
  }
}

// ------------------------------------------------------------------ what the game tells it
/** The player changed a volume. 0 for either half stops that half rather than running it silent. */
export function setAudioSettings(next: AudioSettings) {
  settings = next;
  reconcile();
}

/** Which loop belongs under the screen the game is on, or null for silence. */
export function setMusic(track: MusicId | null) {
  if (wanted === track) return;
  effects?.stopAll();
  wanted = track;
  reconcile();
}

/** Tea is running, or has stopped. Held open by the finger on the tap; see `useHoldPour`. */
export function setPouring(next: boolean, fill = 0) {
  effects?.setPouring(next && !gamePaused, fill, POUR_RATE);
}

export function setPourFill(fill: number) {
  effects?.setPourFill(fill);
}

/** Pausing cancels effect tails and delayed actions; UI controls remain audible. */
export function setGamePaused(next: boolean) {
  if (gamePaused === next) return;
  gamePaused = next;
  if (next) effects?.stopAll();
}

export function playSound(id: SoundId, delayMs = 0) {
  if (gamePaused && SOUNDS[id].bus !== 'ui') return;
  effects?.play(id, delayMs);
}

// ------------------------------------------------------------------ the one place it decides
/**
 * Bring what is sounding into line with what should be. Called after anything that could change
 * the answer, and cheap enough to call freely — it compares before it touches a player.
 */
function reconcile() {
  if (!ready) return;
  const audible = unlocked && active;

  effects?.setState(settings.sfx, audible);

  // --- the music.
  //
  // There are three different reasons for there being none, and treating them alike is a bug:
  //
  // - a **different** track is wanted, or none at all: fade the old one out and let go of it;
  // - the player has turned the music **off**: same, because they are not about to turn it back
  //   on mid-gesture and a decoded loop is the better part of a megabyte;
  // - the app simply is not **in front**: pause on the spot and keep the player.
  //
  // That last one used to go through the same fade as the others, and it was wrong twice over. A
  // nine-hundred-millisecond fade is heard by nobody on the way out, and on the web a backgrounded
  // tab throttles timers to about one tick a second — so the fade became eighteen seconds of music
  // playing on in a tab nobody was looking at, which is the exact failure this whole function is
  // arranged to prevent. Keeping the player is also what lets a shift come back where it left off
  // rather than from the top of the loop, without decoding a megabyte again.
  const off = settings.music <= 0;
  if (current && (current.id !== wanted || off)) {
    const leaving = current.player;
    fadeTo(leaving, 0, true);
    const timer = setTimeout(() => {
      stopping.delete(timer);
      remove(leaving);
    }, FADE_MS + 200);
    stopping.set(timer, leaving);
    current = null;
  }
  if (!wanted || off) return;

  if (!audible) {
    if (current) {
      const fade = fades.get(current.player);
      if (fade) {
        clearInterval(fade);
        fades.delete(current.player);
      }
      try {
        current.player.pause();
      } catch (error: unknown) {
        warn('the music could not be paused', error);
      }
    }
    return;
  }

  const target = settings.music * MUSIC_GAIN[wanted];
  if (current) {
    // Same track: follow the volume straight away rather than fading, because this is the player
    // dragging their own volume and it should answer the finger. A fade already in flight owns it.
    try {
      if (!fades.has(current.player)) current.player.volume = target;
      if (!current.player.playing) current.player.play();
    } catch (error: unknown) {
      warn('the music could not be set', error);
    }
    return;
  }

  // Nothing playing and something wanted: this is where a track is built, the first time it is
  // asked for. `loop` is the library's own, so the file is handed to the platform whole and the
  // join is the seamless one `make-music` wrote.
  try {
    const player = createAudioPlayer(MUSIC[wanted]);
    player.loop = true;
    player.volume = 0;
    player.play();
    current = { id: wanted, player };
    fadeTo(player, target);
  } catch (error: unknown) {
    warn(`the "${wanted}" music could not start`, error);
  }
}
