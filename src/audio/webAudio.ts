/**
 * The shop's sound, on the web, played the way a browser game should be: through the Web Audio
 * API rather than through `<audio>` elements.
 *
 * The obvious way to play a sound on a page is an `HTMLAudioElement` per player, and this game keeps one player
 * per voice — fourteen effects, the pour loop and the music, rising past fifty elements over a
 * shift as voices are recycled. A media element is a whole playback pipeline (demuxer, decoder,
 * an output stream in the browser's audio service), and every cue on a recycled voice drove one
 * through pause, an asynchronous seek and a play, while the pour loop rewrote an element's volume
 * every sixteen milliseconds. **That is what made the web build stutter once sound arrived**, on a
 * desktop and on a phone alike, and it is invisible to a headless browser, whose audio goes to a
 * null device: there, sound cost nothing in every benchmark. Setting both volumes to 0 on a real
 * device is what found it — the lag went away with them.
 *
 * Web Audio is built for exactly this. Each clip is fetched and decoded **once** into an
 * `AudioBuffer`; a cue is a throwaway `AudioBufferSourceNode` on that buffer — a few object
 * allocations, no pipeline, no seek — and all of it is mixed on the browser's own audio thread.
 * A loop is sample-accurate, which a media element's `loop` is not.
 *
 * `WebAudioPlayer` is the whole of what `audio.ts` and `FoleyEngine` ask of a player:
 *
 * - `volume`, `loop`, `playing`, `play()`, `pause()`, `seekTo()`, `remove()`, as a media element;
 * - `setPlaybackRate()` moves the pitch with the speed. `shouldCorrectPitch` is accepted and
 *   ignored, because every caller here sets it false — the rate *is* the variation.
 *
 * This is the only player the game has. `audio.ts` checks for an `AudioContext` before building
 * any of it; a browser without Web Audio simply plays no sound.
 */

type ContextClass = typeof AudioContext;

let context: AudioContext | null = null;
/** Whether the browser has ever let the context run. Until then, a resume needs a gesture. */
let allowed = false;
const decoded = new Map<string, Promise<AudioBuffer | null>>();

function contextClass(): ContextClass | undefined {
  const scope = globalThis as unknown as { AudioContext?: ContextClass; webkitAudioContext?: ContextClass };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/** Whether this runtime can take the Web Audio path at all. */
export function webAudioAvailable(): boolean {
  return contextClass() !== undefined;
}

/**
 * The one context, made on first use.
 *
 * A browser makes it suspended until the page has been interacted with, and **which** events
 * count is narrower than it looks: on a phone a `touchstart` does not, the `touchend` after it
 * does. So rather than trusting the first event to have been the right one, every candidate is
 * listened for until the context is actually running, and only then are the listeners dropped.
 */
function audio(): AudioContext | null {
  if (context) return context;
  const Context = contextClass();
  if (!Context) return null;
  try {
    context = new Context();
  } catch (error: unknown) {
    console.warn('[audio] the Web Audio context could not be created:', error);
    return null;
  }
  const page = typeof document !== 'undefined' ? document : null;
  const settle = () => {
    if (!context || context.state === 'running') return;
    context.resume().then(() => {
      if (context?.state !== 'running') return;
      allowed = true;
      for (const event of GESTURES) page?.removeEventListener(event, settle, true);
    }, () => { /* not a gesture the browser counts; the next one will be */ });
  };
  for (const event of GESTURES) page?.addEventListener(event, settle, true);
  // A hidden page plays nothing (`audio.ts` stops it all), and a suspended context lets go of the
  // audio device instead of holding it open in a background tab.
  page?.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (page.visibilityState === 'hidden') void context.suspend().catch(() => {});
    else if (allowed) void context.resume().catch(() => {});
  });
  return context;
}

const GESTURES = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'] as const;

/** Called from the first gesture `audio.ts` sees; harmless anywhere else. */
export function resumeWebAudio() {
  const ctx = audio();
  if (!ctx || ctx.state === 'running') return;
  ctx.resume().then(() => { if (ctx.state === 'running') allowed = true; }, () => {});
}

/** Old Safari has only the callback form of `decodeAudioData`; this takes either. */
function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const pending = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (pending && typeof pending.then === 'function') pending.then(resolve, reject);
  });
}

/**
 * A clip's decoded samples, fetched and decoded once however many players share it. A clip that
 * cannot be had is silent for the rest of the session rather than retried on every cue — which,
 * for a sound that fails, would be a failing fetch on every scoop.
 */
function bufferFor(uri: string): Promise<AudioBuffer | null> {
  const known = decoded.get(uri);
  if (known) return known;
  const ctx = audio();
  const pending = (async () => {
    if (!ctx) return null;
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${uri}`);
    return decode(ctx, await response.arrayBuffer());
  })().catch((error: unknown) => {
    console.warn('[audio] a sound could not be loaded:', error);
    return null;
  });
  decoded.set(uri, pending);
  return pending;
}

export class WebAudioPlayer {
  /** Accepted and ignored: the rate always moves the pitch here. See above. */
  shouldCorrectPitch = true;

  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private level = 1;
  private rate = 1;
  private looping = false;
  /** Where in the clip the next start begins, in seconds of the clip. */
  private offset = 0;
  /** The context time the running source began, for working out where it has got to. */
  private startedAt = 0;
  /** Asked to play and not since paused — what `playing` reports, as a media element does. */
  private wanted = false;
  private removed = false;

  constructor(module: string) {
    const ctx = audio();
    if (ctx) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.level;
      this.gain.connect(ctx.destination);
    }
    // Decoding starts now, so a voice warmed at launch has its samples by the time it is asked
    // for. A `play()` that arrives first is remembered and honoured the moment they land.
    void bufferFor(module).then((buffer) => {
      if (this.removed) return;
      this.buffer = buffer;
      if (this.wanted && !this.source) this.start();
    });
  }

  get volume() { return this.level; }
  set volume(value: number) {
    this.level = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (this.gain) this.gain.gain.value = this.level;
  }

  get loop() { return this.looping; }
  set loop(value: boolean) {
    this.looping = value;
    if (this.source) this.source.loop = value;
  }

  get playing() { return this.wanted; }
  get playbackRate() { return this.rate; }

  setPlaybackRate(rate: number) {
    const next = Number.isFinite(rate) && rate > 0 ? rate : 1;
    if (this.source && context) {
      // Bank how far it got at the old rate before changing it, or `position` would misread it.
      this.offset = this.position();
      this.startedAt = context.currentTime;
      this.source.playbackRate.value = next;
    }
    this.rate = next;
  }

  play() {
    if (this.removed || this.wanted) return;
    this.wanted = true;
    if (this.buffer) this.start();
  }

  pause() {
    if (!this.wanted) return;
    this.offset = this.position();
    this.wanted = false;
    this.stopSource();
  }

  seekTo(seconds: number): Promise<void> {
    this.offset = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    if (this.source) {
      this.stopSource();
      this.start();
    }
    return Promise.resolve();
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.wanted = false;
    this.stopSource();
    this.gain?.disconnect();
    this.gain = null;
  }

  /** Seconds into the clip the running source has reached. */
  private position(): number {
    if (!this.source || !this.buffer || !context) return this.offset;
    const at = this.offset + (context.currentTime - this.startedAt) * this.rate;
    return this.looping ? at % this.buffer.duration : Math.min(at, this.buffer.duration);
  }

  private start() {
    const ctx = context;
    if (!ctx || !this.buffer || !this.gain || this.removed) return;
    if (ctx.state === 'suspended' && allowed) void ctx.resume().catch(() => {});
    // A clip that has run to its end starts again from the top, as a media element's does.
    if (this.offset >= this.buffer.duration) this.offset = 0;
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.looping;
    source.playbackRate.value = this.rate;
    source.connect(this.gain);
    source.onended = () => {
      // A source stopped on purpose ends too; only the one still playing may say it finished.
      if (this.source !== source) return;
      this.source = null;
      this.wanted = false;
      this.offset = 0;
    };
    this.startedAt = ctx.currentTime;
    source.start(0, this.offset);
    this.source = source;
  }

  private stopSource() {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch { /* never started, or already stopped */ }
    source.disconnect();
  }
}
