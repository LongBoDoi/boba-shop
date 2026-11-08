import { AudioSettings, clampAudio, DEFAULT_AUDIO } from '../game/reducer';
import { POUR_RATE } from '../game/ingredients';
import { SOUNDS, SoundId } from './sounds';
import { FoleyEngine } from './foley';
import { MusicEngine, MusicSnapshot } from './music';
import { MUSIC_ASSETS } from './musicAssets';
import { releaseMusicSlots, StreamMusicPlayer } from './musicPlayer';
import { resumeWebAudio, WebAudioPlayer, webAudioAvailable } from './webAudio';

/** Imported functions can fire in gestures without subscribing the kitchen to game renders. */
let settings: AudioSettings = DEFAULT_AUDIO;
let gamePaused = false;
let active = true;
let ready = false;
let unlocked = false;
let effects: FoleyEngine | null = null;
let music: MusicEngine | null = null;
let musicSnapshot: MusicSnapshot = { track: null, state: 'waiting' };
const musicListeners = new Set<() => void>();

function musicChanged(next: MusicSnapshot) {
  musicSnapshot = next;
  for (const listener of musicListeners) listener();
}
export const getMusicSnapshot = () => musicSnapshot;
export function subscribeMusic(listener: () => void): () => void {
  musicListeners.add(listener);
  return () => { musicListeners.delete(listener); };
}
export function retryMusic() { music?.retry(); }

/** Audio loads outside the artwork gate. The same playlist lives across every game screen. */
export function initAudio(): () => void {
  if (ready) return () => {};
  ready = true;
  if (!webAudioAvailable()) {
    console.warn('[audio] the browser has no Web Audio, so the shop is silent');
    return () => { ready = false; };
  }
  active = visible();
  effects = new FoleyEngine((source) => new WebAudioPlayer(source),
    (what, error) => console.warn(`[audio] ${what}:`, error));
  effects.prepare();
  music = new MusicEngine((id) => new StreamMusicPlayer(MUSIC_ASSETS[id]), musicChanged);
  reconcile();
  const seen = () => { active = visible(); reconcile(); };
  document.addEventListener('visibilitychange', seen);
  const unlock = () => {
    unlocked = true;
    resumeWebAudio();
    for (const event of UNLOCKING) window.removeEventListener(event, unlock, true);
    reconcile();
  };
  for (const event of UNLOCKING) window.addEventListener(event, unlock, true);
  return () => {
    document.removeEventListener('visibilitychange', seen);
    for (const event of UNLOCKING) window.removeEventListener(event, unlock, true);
    effects?.dispose();
    effects = null;
    music?.dispose();
    releaseMusicSlots();
    music = null;
    ready = false;
    gamePaused = false;
    unlocked = false;
  };
}
const UNLOCKING = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;
function visible() { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; }

export function setAudioSettings(next: AudioSettings) { settings = clampAudio(next); reconcile(); }

/** Screen transitions cancel action tails without interrupting the shared background music. */
export function stopGameEffects() { effects?.stopAll(); }
export function setPouring(next: boolean, fill = 0) { effects?.setPouring(next && !gamePaused, fill, POUR_RATE); }
export function setPourFill(fill: number) { effects?.setPourFill(fill); }
export function setGamePaused(next: boolean) {
  if (gamePaused === next) return;
  gamePaused = next;
  if (next) effects?.stopAll();
}
export function playSound(id: SoundId, delayMs = 0) {
  if (gamePaused && SOUNDS[id].bus !== 'ui') return;
  effects?.play(id, delayMs);
}
function reconcile() {
  if (!ready) return;
  const audible = unlocked && active;
  effects?.setState(settings.sfx, audible);
  music?.setState(settings, audible);
}
