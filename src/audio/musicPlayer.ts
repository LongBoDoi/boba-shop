import { MusicPlayer } from './music';
import { getWebAudioContext, resumeWebAudio } from './webAudio';

const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
type MusicSlot = { media: HTMLAudioElement; node: MediaElementAudioSourceNode;
  context: AudioContext; owner: StreamMusicPlayer | null };
const idleSlots: MusicSlot[] = [];
/** Safari grants autoplay per element. Reuse the unlocked element for subsequent chapters. */
function takeSlot(context: AudioContext): MusicSlot {
  while (idleSlots.length) {
    const slot = idleSlots.pop()!;
    if (slot.context === context) return slot;
  }
  const media = new Audio();
  media.preload = 'auto';
  return { media, node: context.createMediaElementSource(media), context, owner: null };
}
export function releaseMusicSlots() { idleSlots.length = 0; }

/** Long music uses one compressed file, never an album of decoded PCM in memory.
 * Fetching the complete small track before creating its blob URL also lets the existing
 * service worker cache a normal 200 response, rather than a media element's partial ranges.
 * Only the current song and a short outgoing crossfade own a media pipeline.
 */
export class StreamMusicPlayer implements MusicPlayer {
  onPlaying: (() => void) | null = null;
  onEnded: (() => void) | null = null;
  onError: (() => void) | null = null;
  private media: HTMLAudioElement;
  private gain: GainNode;
  private node: MediaElementAudioSourceNode;
  private slot: MusicSlot;
  private controller = new AbortController();
  private url: string | null = null;
  private loading: Promise<void> | null = null;
  private wanted = false;
  private removed = false;
  private serial = 0;
  private pending = false;

  constructor(private source: string) {
    const ctx = getWebAudioContext();
    if (!ctx) throw Error('Web Audio is unavailable');
    this.slot = takeSlot(ctx);
    this.slot.owner = this;
    this.media = this.slot.media;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.node = this.slot.node;
    this.node.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.media.onended = () => { this.wanted = false; this.onEnded?.(); };
    this.media.onerror = () => { if (!this.removed) this.fail(this.media.error); };
    for (const event of GESTURES) document.addEventListener(event, this.gesture, true);
  }
  get volume() { return this.gain.gain.value; }
  set volume(value: number) { this.gain.gain.value = Math.max(0, Math.min(1, value)); }
  get loop() { return this.media.loop; }
  set loop(value: boolean) { this.media.loop = value; }

  play() {
    if (this.removed) return;
    this.wanted = true;
    if (this.url) this.attempt();
    else if (!this.loading) this.loading = this.load();
  }
  pause() {
    this.wanted = false;
    this.serial++;
    this.pending = false;
    this.media.pause();
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    this.pause();
    this.controller.abort();
    this.media.onended = this.media.onerror = null;
    this.media.removeAttribute('src');
    this.media.load();
    this.node.disconnect();
    this.gain.disconnect();
    if (this.url) URL.revokeObjectURL(this.url);
    for (const event of GESTURES) document.removeEventListener(event, this.gesture, true);
    this.onPlaying = this.onEnded = this.onError = null;
    this.slot.owner = null;
    if (idleSlots.length < 2) idleSlots.push(this.slot);
  }
  private gesture = () => { if (this.wanted && !this.removed && this.url) this.attempt(); };
  private async load() {
    try {
      const response = await fetch(this.source, { signal: this.controller.signal });
      if (!response.ok || response.headers.get('content-type')?.startsWith('text/html')) throw Error(`Music HTTP ${response.status}`);
      const blob = await response.blob();
      if (this.removed) return;
      this.url = URL.createObjectURL(blob);
      this.media.src = this.url;
      if (this.wanted) this.attempt();
    } catch (error) {
      if (!this.removed) this.fail(error);
    }
  }
  private attempt() {
    if (this.pending || !this.media.paused || !this.wanted || this.removed) return;
    resumeWebAudio();
    const serial = ++this.serial;
    this.pending = true;
    void this.media.play().then(() => {
      // A recycled element may already belong to the next chapter when an old play settles.
      if (this.slot.owner !== this) return;
      if (this.removed || !this.wanted) { this.media.pause(); return; }
      if (this.serial !== serial || this.removed) return;
      this.pending = false;
      this.onPlaying?.();
    }, (error: unknown) => {
      if (this.serial !== serial || this.removed) return;
      this.pending = false;
      // Some phone gestures unlock Web Audio but not media playback. Retry on touchend/click.
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) return;
      this.fail(error);
    });
  }
  private fail(error: unknown) {
    this.pause();
    console.warn('[audio] background music could not play:', error);
    this.onError?.();
  }
}
