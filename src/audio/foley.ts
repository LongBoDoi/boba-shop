import { Clip } from './clips';
import { BUS_GAIN, POUR_LOOP, SOUNDS, SoundId, WARM_CLIPS } from './sounds';

/** Small adapter keeps sound scheduling testable without an audio device or native imports. */
export interface FoleyPlayer {
  volume: number;
  loop: boolean;
  playbackRate: number;
  shouldCorrectPitch: boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
}
interface Voice {
  player: FoleyPlayer;
  module: number;
  cue: SoundId | null;
  until: number;
  priority: number;
  token: number;
  gain: number;
}
export const MAX_FOLEY_VOICES = 14;

export class FoleyEngine {
  private voices: Voice[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private lastAt = new Map<SoundId, number>();
  private lastClip = new Map<string, number>();
  private cueGeneration = new Map<SoundId, number>();
  private generation = 0;
  private enabled = false;
  private master = 0;
  private disposed = false;
  private loopPlayer: FoleyPlayer | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private pouring = false;
  private fill = 0;
  private flowTimer: ReturnType<typeof setInterval> | null = null;
  private fillPerSecond = 0;

  constructor(
    private create: (module: number) => FoleyPlayer,
    private report: (message: string, error: unknown) => void,
    private random: () => number = Math.random,
    private now: () => number = Date.now,
  ) {}

  prepare() {
    if (this.disposed || this.voices.length) return;
    for (const clip of WARM_CLIPS) this.allocate(clip);
    try {
      this.loopPlayer = this.create(POUR_LOOP.module);
      this.loopPlayer.volume = 0;
      this.loopPlayer.loop = true;
      this.loopPlayer.shouldCorrectPitch = false;
    } catch (error) { this.report('pour preparation', error); }
  }

  setState(master: number, enabled: boolean) {
    if (this.disposed) return;
    this.master = Math.max(0, Math.min(1, Number.isFinite(master) ? master : 0));
    const next = enabled && this.master > 0;
    if (!next && (this.enabled || this.pouring || this.timers.size)) this.stopAll();
    const wasEnabled = this.enabled;
    this.enabled = next;
    for (const voice of this.voices) {
      try { voice.player.volume = this.master * voice.gain; }
      catch (error) { this.report('effect volume', error); }
    }
    if (this.pouring && this.enabled) {
      if (!wasEnabled) {
        this.pouring = false;
        this.setPouring(true, this.fill, this.fillPerSecond);
      } else this.updatePour();
    }
  }

  play(id: SoundId, delayMs = 0) {
    if (!this.enabled || this.disposed) return;
    const spec = SOUNDS[id];
    const now = this.now();
    if (now - (this.lastAt.get(id) ?? -Infinity) < spec.minGapMs) return;
    this.lastAt.set(id, now);
    if (id === 'cupPickup') this.cueGeneration.set('cupDown', (this.cueGeneration.get('cupDown') ?? 0) + 1);
    const cueGeneration = this.cueGeneration.get(id) ?? 0;
    const generation = this.generation;
    spec.layers.forEach((layer, index) => {
      // Draw from every take except the previous one. Two-take banks always alternate.
      const key = `${id}:${index}`;
      const previous = this.lastClip.get(key);
      let chosen = Math.floor(this.random() * layer.clips.length);
      if (layer.clips.length > 1 && previous !== undefined) {
        chosen = Math.floor(this.random() * (layer.clips.length - 1));
        if (chosen >= previous) chosen++;
      }
      this.lastClip.set(key, chosen);
      const rate = layer.rate[0] + this.random() * (layer.rate[1] - layer.rate[0]);
      const gain = spec.gain * BUS_GAIN[spec.bus] * layer.gain * (0.92 + this.random() * 0.08);
      const start = () => {
        if (!this.enabled || this.disposed || generation !== this.generation || cueGeneration !== (this.cueGeneration.get(id) ?? 0)) return;
        this.start(layer.clips[chosen], id, gain, rate, spec.priority, spec.voices * spec.layers.length);
      };
      const wait = layer.delayMs + Math.max(0, Math.min(5000, Number.isFinite(delayMs) ? delayMs : 0));
      if (wait === 0) start();
      else {
        const timer = setTimeout(() => { this.timers.delete(timer); start(); }, wait);
        this.timers.add(timer);
      }
    });
  }

  private allocate(clip: Clip): Voice | undefined {
    try {
      const player = this.create(clip.module);
      player.volume = 0;
      player.shouldCorrectPitch = false;
      const voice: Voice = { player, module: clip.module, cue: null, until: 0, priority: -1, token: 0, gain: 0 };
      this.voices.push(voice);
      return voice;
    } catch (error) { this.report('effect preparation', error); }
  }

  private start(clip: Clip, id: SoundId, gain: number, rate: number, priority: number, cap: number) {
    const now = this.now();
    const sameCue = this.voices.filter((v) => v.cue === id && v.until > now);
    if (sameCue.length >= cap) {
      const oldest = sameCue.reduce((a, b) => a.until < b.until ? a : b);
      this.silence(oldest);
    }
    let voice = this.voices.find((v) => v.module === clip.module && v.until <= now);
    let fresh = false;
    if (!voice) {
      if (this.voices.length >= MAX_FOLEY_VOICES) {
        const candidate = [...this.voices].sort((a, b) =>
          Number(a.until > now) - Number(b.until > now) || a.priority - b.priority || a.until - b.until)[0];
        if (candidate.until > now && candidate.priority > priority) return;
        this.silence(candidate);
        this.release(candidate.player);
        this.voices.splice(this.voices.indexOf(candidate), 1);
      }
      voice = this.allocate(clip);
      fresh = true;
    }
    if (!voice) return;
    const selected = voice;
    const token = ++selected.token;
    selected.cue = id;
    selected.gain = gain;
    selected.priority = priority;
    selected.until = now + clip.durationMs / rate;
    const begin = () => {
      if (!this.enabled || this.disposed || selected.token !== token) return;
      try {
        selected.player.volume = this.master * gain;
        selected.player.playbackRate = rate;
        selected.player.play();
      } catch (error) { this.silence(selected); this.report(`play ${id}`, error); }
    };
    if (fresh) begin();
    else {
      try {
        selected.player.pause();
        void selected.player.seekTo(0).then(begin, (error) => {
          if (selected.token === token) this.silence(selected);
          this.report(`rewind ${id}`, error);
        });
      } catch (error) { this.silence(selected); this.report(`rewind ${id}`, error); }
    }
  }

  setPouring(next: boolean, fill = this.fill, fillPerSecond = this.fillPerSecond) {
    if (this.disposed) return;
    this.fill = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
    this.fillPerSecond = fillPerSecond;
    if (next === this.pouring) { if (next && this.enabled) this.updatePour(); return; }
    this.pouring = next;
    if (this.flowTimer) clearInterval(this.flowTimer);
    this.flowTimer = null;
    if (!this.enabled) return;
    if (next) {
      this.play('pourStart');
      if (this.loopPlayer) {
        try { this.loopPlayer.play(); this.updatePour(); }
        catch (error) { this.report('start pour', error); }
      }
      const started = this.now();
      const initialFill = this.fill;
      this.flowTimer = setInterval(() => {
        this.setPourFill(initialFill + (this.now() - started) * this.fillPerSecond / 1000);
      }, 100);
    } else {
      this.play('pourStop');
      this.fadePour(0, true);
    }
  }

  setPourFill(fill: number) {
    this.fill = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
    if (this.pouring && this.enabled) this.updatePour();
  }

  private updatePour() {
    if (!this.loopPlayer) return;
    try { this.loopPlayer.playbackRate = 0.96 + this.fill * 0.08; }
    catch (error) { this.report('pour resonance', error); }
    this.fadePour(this.master * POUR_LOOP.gain * (0.8 + this.fill * 0.2));
  }

  private fadePour(target: number, stop = false) {
    if (this.loopTimer) clearInterval(this.loopTimer);
    const player = this.loopPlayer;
    if (!player) return;
    let step = 0;
    const from = player.volume;
    this.loopTimer = setInterval(() => {
      try {
        player.volume = from + (target - from) * (++step / 4);
        if (step < 4) return;
        if (this.loopTimer) clearInterval(this.loopTimer);
        this.loopTimer = null;
        if (stop) player.pause();
      } catch (error) {
        if (this.loopTimer) clearInterval(this.loopTimer);
        this.loopTimer = null;
        this.report('pour envelope', error);
      }
    }, 16);
  }

  private silence(voice: Voice) {
    voice.token++;
    voice.until = 0;
    voice.gain = 0;
    try { voice.player.pause(); voice.player.volume = 0; }
    catch (error) { this.report('stop effect', error); }
  }

  stopAll() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const voice of this.voices) this.silence(voice);
    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = null;
    if (this.flowTimer) clearInterval(this.flowTimer);
    this.flowTimer = null;
    this.pouring = false;
    if (this.loopPlayer) {
      try { this.loopPlayer.pause(); this.loopPlayer.volume = 0; }
      catch (error) { this.report('stop pour', error); }
    }
    this.lastAt.clear();
  }

  dispose() {
    this.stopAll();
    this.disposed = true;
    for (const voice of this.voices) this.release(voice.player);
    this.voices = [];
    if (this.loopPlayer) this.release(this.loopPlayer);
    this.loopPlayer = null;
  }

  private release(player: FoleyPlayer) {
    try { player.remove(); } catch (error) { this.report('release effect', error); }
  }
}
