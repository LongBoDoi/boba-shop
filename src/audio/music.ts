import { AudioSettings, DEFAULT_AUDIO } from '../game/reducer';
import { MusicChoice, MUSIC_TRACKS, MusicTrackId } from '../game/music';

export interface MusicPlayer {
  volume: number;
  loop: boolean;
  play(): void;
  pause(): void;
  remove(): void;
  onPlaying: (() => void) | null;
  onEnded: (() => void) | null;
  onError: (() => void) | null;
}
export interface MusicSnapshot {
  track: MusicTrackId | null;
  state: 'waiting' | 'loading' | 'playing' | 'paused' | 'muted' | 'error';
}
const TRACK_GAIN = 0.55;
const FADE_MS = 900;

/** One playlist for the whole app. Screen changes never reach this player. */
export class MusicEngine {
  private settings: AudioSettings = DEFAULT_AUDIO;
  private audible = false;
  private current: { id: MusicTrackId; player: MusicPlayer } | null = null;
  private bag: MusicTrackId[] = [];
  private fades = new Map<MusicPlayer, ReturnType<typeof setInterval>>();
  private retiring: MusicPlayer | null = null;
  private failed = false;
  private snapshot: MusicSnapshot = { track: null, state: 'waiting' };

  constructor(private makePlayer: (id: MusicTrackId) => MusicPlayer,
    private changed: (snapshot: MusicSnapshot) => void,
    private random: () => number = Math.random) {}

  setState(settings: AudioSettings, audible: boolean) {
    const changedChoice = this.settings.musicChoice !== settings.musicChoice;
    this.settings = settings;
    this.audible = audible;
    if (changedChoice) {
      this.bag = settings.musicChoice === 'shuffle' && this.current
        ? this.shuffled().filter((id) => id !== this.current?.id) : [];
    }
    if (changedChoice && this.current && settings.musicChoice !== 'cycle' && settings.musicChoice !== 'shuffle'
      && settings.musicChoice !== this.current.id) {
      this.start(settings.musicChoice);
    }
    if (!audible || settings.music <= 0) {
      this.clearRetiring();
      if (this.current) {
        this.cancelFade(this.current.player);
        this.current.player.pause();
      }
      this.report(settings.music <= 0 ? 'muted' : 'paused');
      return;
    }
    if (!this.current) this.start(this.first(settings.musicChoice));
    else {
      this.current.player.loop = this.fixed();
      if (this.failed) { this.report('error'); return; }
      // A volume change answers immediately, including in the middle of a crossfade.
      if (this.snapshot.state === 'playing') {
        this.cancelFade(this.current.player);
        this.current.player.volume = settings.music * TRACK_GAIN;
      }
      this.current.player.play();
    }
  }

  retry() {
    if (this.current) this.start(this.current.id);
    else if (this.audible && this.settings.music > 0) this.start(this.first(this.settings.musicChoice));
  }

  dispose() {
    this.clearRetiring();
    if (this.current) {
      this.cancelFade(this.current.player);
      this.current.player.remove();
    }
    this.current = null;
    this.report('waiting');
  }

  private fixed() { return this.settings.musicChoice !== 'cycle' && this.settings.musicChoice !== 'shuffle'; }
  private first(choice: MusicChoice): MusicTrackId {
    return choice === 'cycle' ? MUSIC_TRACKS[0].id : choice === 'shuffle' ? this.nextRandom(null) : choice;
  }
  private nextRandom(previous: MusicTrackId | null): MusicTrackId {
    if (this.bag.length === 0) {
      this.bag = this.shuffled();
      // A fresh shuffled round must not begin with the song that just ended.
      if (this.bag[this.bag.length - 1] === previous) {
        [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag[this.bag.length - 1], this.bag[0]];
      }
    }
    return this.bag.pop()!;
  }
  private shuffled(): MusicTrackId[] {
    const tracks = MUSIC_TRACKS.map((track) => track.id);
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    return tracks;
  }
  private start(id: MusicTrackId, ended = false) {
    this.clearRetiring();
    const old = this.current;
    if (old) {
      old.player.onEnded = old.player.onError = old.player.onPlaying = null;
      this.cancelFade(old.player);
      if (ended || this.failed || !this.audible || this.settings.music <= 0) old.player.remove();
      else this.retiring = old.player;
      if (this.retiring && this.snapshot.state === 'loading') this.retiring.pause();
    }
    this.failed = false;
    const player = this.makePlayer(id);
    this.current = { id, player };
    player.loop = this.fixed();
    player.volume = 0;
    player.onPlaying = () => {
      if (this.current?.player !== player || !this.audible || this.settings.music <= 0) return;
      this.report('playing');
      this.fade(player, this.settings.music * TRACK_GAIN);
      if (this.retiring) this.fade(this.retiring, 0, true);
    };
    player.onEnded = () => {
      if (this.current?.player !== player || !this.audible || this.settings.music <= 0) return;
      const index = MUSIC_TRACKS.findIndex((track) => track.id === id);
      const next = this.settings.musicChoice === 'shuffle' ? this.nextRandom(id)
        : this.fixed() ? id : MUSIC_TRACKS[(index + 1) % MUSIC_TRACKS.length].id;
      this.start(next, true);
    };
    player.onError = () => {
      if (this.current?.player !== player) return;
      this.clearRetiring();
      this.failed = true;
      this.report('error');
    };
    this.report('loading');
    if (this.audible && this.settings.music > 0) player.play();
  }
  private report(state: MusicSnapshot['state']) {
    const track = this.current?.id ?? null;
    if (state === this.snapshot.state && track === this.snapshot.track) return;
    this.snapshot = { track, state };
    this.changed(this.snapshot);
  }
  private cancelFade(player: MusicPlayer) {
    const timer = this.fades.get(player);
    if (timer) clearInterval(timer);
    this.fades.delete(player);
  }
  private clearRetiring() {
    if (!this.retiring) return;
    this.cancelFade(this.retiring);
    this.retiring.remove();
    this.retiring = null;
  }
  private fade(player: MusicPlayer, to: number, remove = false) {
    this.cancelFade(player);
    const from = player.volume;
    let elapsed = 0;
    this.fades.set(player, setInterval(() => {
      elapsed += 50;
      player.volume = from + (to - from) * Math.min(1, elapsed / FADE_MS);
      if (elapsed < FADE_MS) return;
      this.cancelFade(player);
      if (remove && this.retiring === player) this.clearRetiring();
    }, 50));
  }
}
