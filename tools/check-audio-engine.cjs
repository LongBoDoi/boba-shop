/* Behavior regressions for the recorded sound scheduler and its browser lifecycle. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
require.extensions['.wav'] = (module, file) => { module.exports = path.basename(file); };
require.extensions['.m4a'] = require.extensions['.wav'];
let clock = 1000, serial = 0;
const timers = new Map();
const original = { timeout: global.setTimeout, interval: global.setInterval, clearTimeout: global.clearTimeout, clearInterval: global.clearInterval, now: Date.now };
global.setTimeout = (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: clock + ms, repeat: 0 }); return id; };
global.setInterval = (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: clock + ms, repeat: ms }); return id; };
global.clearTimeout = global.clearInterval = (id) => timers.delete(id);
Date.now = () => clock;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
/**
 * Let every fetch, decode and the play that waits on them finish. Real timer turns, not a fixed
 * number of microtasks: a clip's buffer arrives through a chain of promises several deep, and a
 * count that is one short leaves a source starting during the *next* step, which reads as a cue
 * the engine played twice.
 */
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => original.timeout(resolve, 0)); };
async function advance(ms) {
  const target = clock + ms;
  while (true) {
    const [id, timer] = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0] || [];
    if (!timer) break;
    clock = timer.at;
    if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
    timer.fn();
    await flush();
  }
  clock = target;
  await flush();
}

/**
 * A stand-in for `WebAudioPlayer`, used where `FoleyEngine` is driven on its own — it takes a
 * player factory, and these blocks are about the scheduling above a player rather than the
 * player itself. It is faithful to the real one on the point that has bitten: **the rate is a
 * method**. `WebAudioPlayer` has `setPlaybackRate` and no settable `playbackRate`, and so does
 * this; a stub that flattered the code once let the whole suite go green while every one-shot in
 * the game was silent on a phone.
 */
class Player {
  constructor(source) {
    Object.assign(this, { source, volume: 0, loop: false, shouldCorrectPitch: true,
      playing: false, removed: false, starts: 0, seeks: 0, rate: 1 });
    players.push(this);
  }
  get playbackRate() { return this.rate; }
  setPlaybackRate(rate) { assert.ok(!this.removed); this.rate = rate; }
  play() { assert.ok(!this.removed); this.playing = true; this.starts++; }
  pause() { assert.ok(!this.removed); this.playing = false; }
  seekTo() { assert.ok(!this.removed); this.seeks++; return Promise.resolve(); }
  remove() { assert.ok(!this.removed, 'double release'); this.removed = true; this.playing = false; }
}
let players = [], listeners = [];
const starts = () => players.reduce((n, p) => n + p.starts, 0);
const find = (name) => players.filter((p) => p.source === name);
const live = () => players.filter((p) => !p.removed);

/**
 * The page the engine runs on. Everything the game plays goes through Web Audio — one decoded
 * buffer per clip and a throwaway source per cue — so this is the browser's side of the real
 * lifecycle, not a stub of the engine's own.
 */
let contexts = [], fetched = [], decodes = 0, failing = null, docListeners = [];
let mediaPlayers = [], blobs = new Map(), revoked = [];
const originalBlob = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
class FakeMedia {
  constructor() { this.paused = true; this.loop = false; this.starts = 0; this.currentTime = 0; mediaPlayers.push(this); }
  play() { if (this.paused) this.starts++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
  get file() { return blobs.get(this.src); }
}
class Param { constructor(value) { this.value = value; } }
class FakeContext {
  constructor() {
    Object.assign(this, { state: 'suspended', currentTime: 0, destination: {}, gains: [], sources: [] });
    contexts.push(this);
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() {
    const node = { gain: new Param(1), connected: false,
      connect() { this.connected = true; }, disconnect() { this.connected = false; } };
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const node = { buffer: null, loop: false, playbackRate: new Param(1), started: false, stopped: false,
      ended: false, onended: null, out: null, connect(to) { this.out = to; }, disconnect() { this.out = null; },
      start(_, offset) {
        this.started = true; this.offset = offset;
        // A clip that is not looping runs out, and the browser says so. Without that, a cue that
        // simply finished would be indistinguishable here from one still sounding.
        if (this.loop) return;
        const left = ((this.buffer ? this.buffer.duration : 0) - offset) * 1000 / (this.playbackRate.value || 1);
        setTimeout(() => {
          if (this.stopped || this.ended) return;
          this.ended = true;
          if (this.onended) this.onended();
        }, Math.max(0, left));
      },
      stop() { this.stopped = true; } };
    this.sources.push(node);
    return node;
  }
  createMediaElementSource(media) {
    const node = { media, out: null, connect(to) { this.out = to; }, disconnect() { this.out = null; },
      get buffer() { return { file: media.file }; },
      get started() { return media.starts > 0; }, get stopped() { return media.paused; },
      get loop() { return media.loop; } };
    (this.streams ??= []).push(node);
    return node;
  }
  decodeAudioData(bytes, ok) { decodes++; const buffer = { duration: 0.5, file: bytes.file }; ok(buffer); return Promise.resolve(buffer); }
}

function openPage({ webAudio = true } = {}) {
  contexts = []; fetched = []; decodes = 0; failing = null; docListeners = []; listeners = [];
  mediaPlayers = []; blobs = new Map(); revoked = [];
  global.Audio = FakeMedia;
  URL.createObjectURL = (blob) => { const url = `blob:music-${blobs.size}`; blobs.set(url, blob.file); return url; };
  URL.revokeObjectURL = (url) => revoked.push(url);
  if (webAudio) global.AudioContext = FakeContext; else delete global.AudioContext;
  global.fetch = async (uri) => {
    fetched.push(uri);
    // Each buffer remembers which file it was, so a source can be told by what it plays.
    return uri === failing ? { ok: false, status: 404 }
      : { ok: true, headers: { get: () => 'audio/mp4' }, blob: async () => ({ file: uri }),
        arrayBuffer: async () => Object.assign(new ArrayBuffer(4), { file: uri }) };
  };
  global.document = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => docListeners.push({ type, fn }),
    removeEventListener: (type, fn) => { const i = docListeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) docListeners.splice(i, 1); },
  };
  global.window = {
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
    removeEventListener: (type, fn) => { listeners = listeners.filter((l) => l.type !== type || l.fn !== fn); },
  };
}
function closePage() {
  delete global.AudioContext; delete global.fetch; delete global.document; delete global.window;
  delete global.Audio;
  URL.createObjectURL = originalBlob.create; URL.revokeObjectURL = originalBlob.revoke;
}
function fresh(options) {
  assert.equal(timers.size, 0, 'Previous engine left timers behind');
  players = [];
  openPage(options);
  for (const key of Object.keys(require.cache)) if (key.includes(path.sep + 'src' + path.sep + 'audio' + path.sep)) delete require.cache[key];
  return require('../src/audio/audio.ts');
}

async function main() {
  // End to end: the browser's gesture gate, settings, the game's pause, a hidden page, and the
  // whole life of a music track — all of it through the real Web Audio player.
  {
    const engine = fresh();
    engine.playSound('tap');
    assert.equal(contexts.length, 0, 'Nothing is built before the engine is started');
    const stop = engine.initAudio();
    await settle();
    const { WARM_CLIPS } = require('../src/audio/sounds.ts');
    assert.equal(contexts.length, 1, 'One audio context for the whole game');
    const ctx = contexts[0];
    const sounding = () => [...ctx.sources, ...(ctx.streams ?? [])].filter((n) => n.started && !n.stopped && !n.ended);
    const playing = (file) => sounding().find((n) => n.buffer && n.buffer.file === file);
    // How many sources have ever been started. A cue that is *refused* starts none, which is
    // what the suppression rules below are read off; a cue that answers starts one or more — a
    // voice still running its last clip is rewound, which is a fresh source for the same cue — so
    // "it answered" is counted as more than none rather than as exactly one.
    const begun = () => ctx.sources.filter((n) => n.started).length;
    assert.equal(ctx.gains.length, WARM_CLIPS.length + 1, 'Only common contacts plus the pour are warmed');
    assert.equal(new Set(fetched).size, fetched.length, 'Each clip is fetched once, however many voices share it');
    assert.equal(decodes, fetched.length, 'And decoded once');

    engine.playSound('order'); engine.setPouring(true, 0.2);
    await settle();
    assert.equal(sounding().length, 0, 'Nothing sounds before the page has been interacted with');
    assert.ok(listeners.every((l) => l.capture), 'The unlocking listeners cannot be swallowed');
    listeners[0].fn();
    assert.equal(ctx.state, 'running', 'The first gesture resumes the context');
    await advance(1000); await settle();
    assert.equal(listeners.length, 0, 'And takes the listeners off again');
    const music = playing('clear-skies.m4a');
    assert.ok(music && !music.loop, 'The shared playlist starts with Clear Skies');
    assert.ok(!fetched.some((file) => file !== 'clear-skies.m4a' && file.endsWith('.m4a')), 'Only the active song loads');
    assert.equal(decodes, fetched.filter((file) => file.endsWith('.wav')).length, 'Music never fills the PCM effect cache');
    const pour = playing('pourLoop.wav');
    assert.ok(pour && pour.loop, 'The held pour loops');
    assert.ok(pour.playbackRate.value > 0.976, 'Held stream resonance follows elapsed fill');
    engine.setPouring(false);
    await advance(80); await settle();
    assert.ok(pour.stopped, 'Release envelope ends the sustained stream');
    assert.ok(!music.stopped, 'And leaves the music alone');

    const before = ctx.sources.length;
    engine.playSound('ice'); await settle();
    const cue = ctx.sources.slice(before).find((n) => n.started && !n.loop);
    assert.ok(cue, 'A cue is a fresh source on an already-decoded buffer');
    assert.ok(cue.out && cue.out.gain.value > 0, 'Played through its voice, at its volume');
    assert.equal(fetched.filter((u) => u.startsWith('ice')).length, new Set(fetched.filter((u) => u.startsWith('ice'))).size,
      'Playing it again fetches nothing');

    engine.playSound('order'); await settle();
    const count = begun(); engine.playSound('order'); await settle();
    assert.equal(begun(), count, 'Cooldown suppresses duplicated taps');
    await advance(130); engine.playSound('order'); await settle();
    assert.ok(begun() > count, 'And lets the next one through once the gap has passed');

    engine.playSound('serveGood'); await settle();
    engine.setGamePaused(true);
    const paused = begun();
    await advance(200); await settle();
    engine.playSound('ice'); await settle();
    assert.equal(begun(), paused, 'Pause cancels delayed layers and suppresses game actions');
    const held = begun();
    engine.playSound('tap'); await settle();
    assert.ok(begun() > held, 'Pause/settings controls still answer');
    engine.setGamePaused(false);

    engine.playSound('trash'); await settle();
    engine.setAudioSettings({ music: 0.5, sfx: 0 });
    const muted = begun(); await advance(250); await settle();
    assert.equal(begun(), muted, 'Muting cancels queued layers');
    assert.ok(sounding().every((n) => n.buffer.file.endsWith('.m4a')), 'And silences every effect, leaving the music');
    engine.setAudioSettings({ music: 0.5, sfx: 0.8 });

    engine.setPouring(true, 0.1); engine.playSound('ice'); await settle();
    // Both halves of the engine watch the page: `audio.ts` for whether the shop is in front, and
    // `webAudio.ts` to let go of the audio device. The browser tells them both.
    const visibility = async (state) => {
      global.document.visibilityState = state;
      for (const listener of docListeners.filter((l) => l.type === 'visibilitychange')) listener.fn();
      await settle();
    };
    await visibility('hidden');
    assert.equal(sounding().length, 0, 'A hidden page stops effects, pour and music');
    assert.equal(ctx.state, 'suspended', 'And lets go of the audio device');
    const away = begun(); await advance(300); await settle();
    assert.equal(begun(), away, 'Nothing is played to a page nobody is looking at');
    await visibility('visible'); await advance(1000); await settle();
    assert.equal(ctx.state, 'running', 'It takes the device back on return');
    assert.ok(!playing('pourLoop.wav'), 'No stale pour restarts on return');

    engine.stopGameEffects();
    await advance(1200); await settle();
    assert.equal(playing('clear-skies.m4a'), music, 'Screen transitions keep the very same song and player');
    engine.setAudioSettings({ music: 0, sfx: 0.8 }); await advance(1200); await settle();
    assert.ok(!playing('clear-skies.m4a'), 'Turning music off pauses it immediately');
    engine.setAudioSettings({ music: 0.5, sfx: 0.8 });
    engine.playSound('dayEnd'); await settle();

    // A clip that cannot be fetched is silent, not an exception, and is not fetched again per cue.
    const warns = []; const warn = console.warn; console.warn = (...a) => warns.push(a);
    failing = 'bell1.wav';
    engine.playSound('order'); await advance(300); await settle();
    engine.playSound('order'); await advance(300); await settle();
    console.warn = warn;
    assert.ok(fetched.filter((u) => u === 'bell1.wav').length <= 1, 'A failed clip is not refetched on every cue');

    stop();
    await advance(1500); await settle();
    assert.ok(ctx.gains.every((g) => !g.connected), 'Every voice is disconnected on teardown');
    assert.equal(sounding().length, 0);
    assert.ok(mediaPlayers.every((media) => media.paused && !media.src), 'Music media pipelines are released');
    assert.equal(revoked.length, blobs.size, 'Every compressed-track blob is released');
    closePage();
  }
  // The playlist is independent of game screens. Drive real completion callbacks, not durations.
  {
    const { MusicEngine } = require('../src/audio/music.ts');
    const { MUSIC_TRACKS } = require('../src/game/music.ts');
    const { DEFAULT_AUDIO } = require('../src/game/reducer.ts');
    let songs = [], snapshots = [];
    class Song {
      constructor(id) { this.id = id; this.volume = 0; this.playing = false; this.removed = false; songs.push(this); }
      play() { if (this.playing) return; this.playing = true; this.onPlaying?.(); }
      pause() { this.playing = false; }
      remove() { assert.ok(!this.removed, 'Song released twice'); this.removed = true; this.playing = false; }
      end() { this.playing = false; this.onEnded?.(); }
    }
    const make = () => new MusicEngine((id) => new Song(id), (s) => snapshots.push(s), () => 0.42);
    let playlist = make();
    playlist.setState(DEFAULT_AUDIO, false);
    assert.equal(songs.length, 0, 'No music pipeline or download before a gesture');
    playlist.setState(DEFAULT_AUDIO, true);
    for (let i = 0; i < 30; i++) songs.at(-1).end();
    assert.deepEqual(songs.map((song) => song.id), [...MUSIC_TRACKS.map((t) => t.id), MUSIC_TRACKS[0].id], 'Cycle plays all chapters then wraps');
    playlist.dispose();

    songs = []; playlist = make();
    const shuffled = { ...DEFAULT_AUDIO, musicChoice: 'shuffle' };
    playlist.setState(shuffled, true);
    for (let i = 0; i < 60; i++) songs.at(-1).end();
    for (const start of [0, 30]) assert.equal(new Set(songs.slice(start, start + 30).map((s) => s.id)).size, 30, 'No repeats within a shuffled round');
    assert.ok(songs.every((song, i) => !i || song.id !== songs[i - 1].id), 'No adjacent repeat between shuffled rounds');
    playlist.dispose();

    songs = []; playlist = make();
    const fixed = { ...DEFAULT_AUDIO, musicChoice: MUSIC_TRACKS[4].id };
    playlist.setState(fixed, true);
    const originalSong = songs[0];
    assert.ok(originalSong.loop, 'A chosen song loops itself');
    await advance(1000);
    playlist.setState({ ...fixed, sfx: 0 }, true);
    assert.equal(songs.length, 1, 'Effects settings do not restart the playlist');
    playlist.setState({ ...fixed, music: 0 }, true);
    assert.ok(!originalSong.playing, 'Mute pauses immediately');
    playlist.setState(fixed, false); await advance(2000);
    assert.ok(!originalSong.playing, 'Backgrounding cannot restart a muted song');
    playlist.setState(fixed, true);
    assert.equal(songs.at(-1), originalSong, 'Returning and unmuting keep the same song and position');
    playlist.setState(shuffled, true);
    assert.equal(songs.at(-1), originalSong, 'Changing a playlist mode preserves the song in progress');
    for (let i = 0; i < 29; i++) songs.at(-1).end();
    assert.equal(new Set(songs.map((song) => song.id)).size, 30, 'Entering shuffle counts the playing song as already heard');
    playlist.dispose();

    songs = []; playlist = make();
    playlist.setState(DEFAULT_AUDIO, true);
    const stale = songs[0].onEnded;
    for (let i = 1; i < 8; i++) {
      playlist.setState({ ...DEFAULT_AUDIO, musicChoice: MUSIC_TRACKS[i].id }, true);
      assert.ok(songs.filter((s) => !s.removed).length <= 2, 'Rapid switching retains at most the current and outgoing pipeline');
    }
    const count = songs.length; stale();
    assert.equal(songs.length, count, 'An old song finishing cannot advance the new selection');
    await advance(1000);
    assert.equal(songs.filter((s) => !s.removed).length, 1, 'The outgoing player is freed after its fade');
    const failed = songs.at(-1);
    failed.onError();
    playlist.setState({ ...DEFAULT_AUDIO, musicChoice: failed.id }, false);
    playlist.setState({ ...DEFAULT_AUDIO, musicChoice: failed.id }, true);
    assert.equal(snapshots.at(-1).state, 'error', 'A failed download remains visible after backgrounding');
    playlist.retry();
    assert.equal(songs.at(-1).id, failed.id, 'Retry keeps the chosen song');
    assert.ok(failed.removed);
    playlist.dispose();
    assert.ok(songs.every((s) => s.removed));
    assert.equal(timers.size, 0, 'No playlist fades survive disposal');
  }
  // A track arriving after pause/teardown must never start by itself. Phones may reject the
  // first media play even when their Web Audio context has accepted the same gesture.
  {
    fresh();
    const { StreamMusicPlayer } = require('../src/audio/musicPlayer.ts');
    let resolveLoad;
    global.fetch = () => new Promise((resolve) => { resolveLoad = resolve; });
    const player = new StreamMusicPlayer('late.m4a');
    const media = mediaPlayers.at(-1);
    player.play(); player.pause();
    resolveLoad({ ok: true, headers: { get: () => 'audio/mp4' }, blob: async () => ({ file: 'late.m4a' }) });
    await settle();
    assert.equal(media.starts, 0, 'Loading after a pause cannot create ghost music');
    const play = media.play;
    media.play = () => Promise.reject(new DOMException('A gesture is needed', 'NotAllowedError'));
    player.play(); await settle();
    assert.ok(media.paused, 'A rejected autoplay stays silent');
    media.play = play;
    for (const listener of docListeners.filter((l) => l.type === 'touchend')) listener.fn();
    await settle();
    assert.equal(media.starts, 1, 'A later accepted phone gesture retries the music');
    player.pause();
    let resolvePlay;
    media.play = () => new Promise((resolve) => { resolvePlay = resolve; });
    player.play(); player.pause(); media.paused = false; resolvePlay(); await settle();
    assert.ok(media.paused, 'A late successful play promise cannot undo a pause');
    player.remove();
    const disposed = new StreamMusicPlayer('removed.m4a');
    assert.equal(mediaPlayers.at(-1), media, 'Chapter changes reuse the media element already unlocked by the player');
    disposed.play(); disposed.remove();
    const before = blobs.size;
    resolveLoad({ ok: true, headers: { get: () => 'audio/mp4' }, blob: async () => ({ file: 'removed.m4a' }) });
    await settle();
    assert.equal(blobs.size, before, 'No blob or playback is created for a removed player');
    global.fetch = async (uri) => ({ ok: true, headers: { get: () => 'audio/mp4' }, blob: async () => ({ file: uri }) });
    let resolveOldPlay;
    media.play = () => new Promise((resolve) => { resolveOldPlay = resolve; });
    const old = new StreamMusicPlayer('old.m4a');
    old.play(); await settle(); old.remove();
    media.play = play;
    const replacement = new StreamMusicPlayer('replacement.m4a');
    replacement.play(); await settle();
    assert.ok(!media.paused);
    resolveOldPlay(); await settle();
    assert.ok(!media.paused, 'An old play promise cannot pause a media element recycled for another song');
    replacement.remove();
    assert.ok(contexts[0].gains.every((g) => !g.connected));
    closePage();
  }
  // Scheduler: alternate real takes, playback bounds, global cap and priority pressure.
  {
    players = [];
    const { FoleyEngine, MAX_FOLEY_VOICES } = require('../src/audio/foley.ts');
    const errors = [];
    const foley = new FoleyEngine((source) => new Player(source), (...e) => errors.push(e), () => 0.5, () => clock);
    foley.prepare(); foley.setState(1, true);
    const chosen = [];
    for (let i = 0; i < 5; i++) {
      const before = players.map((p) => p.starts);
      foley.play('ice'); await flush();
      const played = players.find((p, j) => p.starts > (before[j] || 0));
      chosen.push(played.source);
      assert.ok(played.playbackRate >= 0.97 && played.playbackRate <= 1.03);
      assert.equal(played.shouldCorrectPitch, false);
      await advance(120);
    }
    assert.ok(chosen.every((name, i) => i === 0 || name !== chosen[i - 1]), 'No adjacent repeated ice take');
    const all = Object.keys(require('../src/audio/sounds.ts').SOUNDS);
    all.forEach((id) => foley.play(id)); await advance(200);
    assert.ok(live().length <= MAX_FOLEY_VOICES + 1, 'Global player cap includes every cue bank');
    foley.stopAll();
    foley.play('cupDown', 250);
    await advance(100);
    foley.play('cupPickup'); await flush();
    const afterPickup = starts();
    await advance(200);
    assert.equal(starts(), afterPickup, 'Lifting again cancels the pending cup landing');
    foley.stopAll();
    const beforeCoin = starts();
    foley.play('coin', 1100);
    await advance(1000);
    assert.equal(starts(), beforeCoin, 'Coin contact waits for its visual flight');
    await advance(100);
    assert.equal(starts(), beforeCoin + 1);
    foley.stopAll();
    const spec = require('../src/audio/sounds.ts').SOUNDS.serveGood;
    const saved = { minGapMs: spec.minGapMs, voices: spec.voices };
    spec.minGapMs = 0; spec.voices = MAX_FOLEY_VOICES;
    for (let i = 0; i < MAX_FOLEY_VOICES; i++) foley.play('serveGood');
    await flush();
    const critical = live().filter((p) => p.source !== 'pourLoop.wav');
    assert.equal(critical.length, MAX_FOLEY_VOICES);
    const beforeLowPriority = starts();
    foley.play('tap'); await flush();
    assert.equal(starts(), beforeLowPriority, 'A low priority tap is dropped when all voices carry a critical action');
    assert.ok(critical.every((p) => !p.removed), 'Critical voices survive lower priority pressure');
    Object.assign(spec, saved);
    foley.dispose(); await advance(1000);
    assert.equal(errors.length, 0);
    assert.ok(players.every((p) => p.removed));
  }
  // Race: a rewind that resolves after mute/teardown must never start a ghost sound.
  {
    players = [];
    const { FoleyEngine } = require('../src/audio/foley.ts');
    let resolveSeek;
    const errors = [];
    const foley = new FoleyEngine((source) => new Player(source), (...e) => errors.push(e), () => 0);
    foley.prepare(); foley.setState(1, true);
    const cup = find('cup1.wav')[0];
    cup.seekTo = () => new Promise((resolve) => { resolveSeek = resolve; });
    foley.play('tap'); foley.setState(0, true); resolveSeek(); await flush();
    assert.equal(cup.starts, 0);
    foley.setState(1, true); foley.play('tap'); foley.dispose(); resolveSeek(); await flush();
    assert.equal(cup.starts, 0, 'Late promise cannot play a released player');
    assert.equal(errors.length, 0);
  }
  // A rejected rewind is handled, rather than becoming an unhandled rejection.
  {
    players = [];
    const { FoleyEngine } = require('../src/audio/foley.ts');
    const errors = [];
    const foley = new FoleyEngine((source) => new Player(source), (...e) => errors.push(e), () => 0);
    foley.prepare(); foley.setState(1, true);
    find('cup1.wav')[0].seekTo = () => Promise.reject(new Error('decoder unavailable'));
    foley.play('tap'); await flush();
    assert.equal(errors.length, 1);
    foley.play('ice'); await flush();
    assert.ok(starts() > 0, 'Other materials survive a failed player');
    foley.dispose();
  }
  // Web Audio is the only player there is, so a runtime without it plays nothing — and the game
  // carries on. This is the path the regression scripts themselves take.
  {
    const engine = fresh({ webAudio: false });
    const warns = []; const warn = console.warn; console.warn = (...a) => warns.push(a);
    const stop = engine.initAudio();
    engine.playSound('order'); engine.setPouring(true, 0.3);
    await advance(1200);
    engine.setGamePaused(true); engine.setAudioSettings({ music: 1, sfx: 1 }); engine.setPourFill(0.8);
    engine.setGamePaused(false);
    stop();
    console.warn = warn;
    assert.equal(contexts.length, 0, 'No context, no players, nothing to play');
    assert.equal(fetched.length, 0, 'And not a byte of audio downloaded');
    assert.ok(warns.some(([line]) => String(line).includes('no Web Audio')), 'It says so once, rather than silently');
    closePage();
  }
  assert.equal(timers.size, 0, 'No timer leaks');
  console.log('check-audio-engine: recorded variation, layers, voice cap, cancellation, fill, the browser lifecycle, rejected seeks and teardown.');
}
main().then(() => {
  global.setTimeout = original.timeout; global.setInterval = original.interval;
  global.clearTimeout = original.clearTimeout; global.clearInterval = original.clearInterval;
  Date.now = original.now;
}, (error) => { console.error(error); process.exit(1); });
