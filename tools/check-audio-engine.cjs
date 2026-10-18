/* Behavior regressions for the recorded sound scheduler and Expo lifecycle adapter. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
require.extensions['.wav'] = (module, file) => { module.exports = path.basename(file); };
let clock = 1000, serial = 0;
const timers = new Map();
const original = { timeout: global.setTimeout, interval: global.setInterval, clearTimeout: global.clearTimeout, clearInterval: global.clearInterval, now: Date.now, load: Module._load };
global.setTimeout = (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: clock + ms, repeat: 0 }); return id; };
global.setInterval = (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: clock + ms, repeat: ms }); return id; };
global.clearTimeout = global.clearInterval = (id) => timers.delete(id);
Date.now = () => clock;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
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
let players = [], appHandlers = [], listeners = [], audioMode;
/**
 * The stub is faithful to the **native** player, not to the web one, because the web one is the
 * forgiving of the two and a stub that flatters the code is worse than no stub at all.
 *
 * `playbackRate` is the case in point: `expo-audio` declares it getter-only on both iOS and
 * Android (only its web player gives it a setter), so assigning to it throws in the bundle's
 * strict mode. This stub used to carry it as an ordinary writable field — so the whole suite went
 * green while every one-shot in the game was silent on a real phone. It is now an accessor with
 * no setter, which throws here exactly as it throws on a device, and `setPlaybackRate` is the one
 * way through. See `tools/check-native-audio-api.cjs`, which holds the same rule against the SDK.
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
let os = 'web';
Module._load = function(request, ...rest) {
  // The web player resolves a clip to its URL through expo-asset; a .wav here is its own name.
  if (request === 'expo-asset') return { Asset: { fromModule: (module) => ({ uri: String(module) }) } };
  if (request === 'expo-audio') return { createAudioPlayer: (source) => new Player(source), setAudioModeAsync: (mode) => { audioMode = mode; return Promise.resolve(); } };
  if (request === 'react-native') return {
    Platform: { OS: os },
    AppState: { currentState: 'active', addEventListener: (_, fn) => { appHandlers.push(fn); return { remove: () => { appHandlers = appHandlers.filter((h) => h !== fn); } }; } },
  };
  return original.load.call(this, request, ...rest);
};
function fresh(platform) {
  assert.equal(timers.size, 0, 'Previous engine left timers behind');
  os = platform; players = []; appHandlers = []; listeners = [];
  global.window = {
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
    removeEventListener: (type, fn) => { listeners = listeners.filter((l) => l.type !== type || l.fn !== fn); },
  };
  for (const key of Object.keys(require.cache)) if (key.includes(path.sep + 'src' + path.sep + 'audio' + path.sep)) delete require.cache[key];
  return require('../src/audio/audio.ts');
}
const starts = () => players.reduce((n, p) => n + p.starts, 0);
const find = (name) => players.filter((p) => p.source === name);
const live = () => players.filter((p) => !p.removed);

async function main() {
  // End-to-end adapter: browser policy, settings, game pause, backgrounding and music lifecycle.
  {
    const engine = fresh('web');
    engine.playSound('tap');
    assert.equal(players.length, 0);
    const stop = engine.initAudio();
    const { WARM_CLIPS } = require('../src/audio/sounds.ts');
    assert.equal(players.length, WARM_CLIPS.length + 1, 'Only common contacts plus the pour are warmed');
    assert.deepEqual(audioMode, { playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false },
      'Off iOS there is no silent switch to respect, only a ringer that has nothing to do with media');
    engine.setMusic('menu'); engine.playSound('order'); engine.setPouring(true, 0.2);
    assert.equal(starts(), 0, 'No audio before browser gesture');
    assert.ok(listeners.every((l) => l.capture));
    listeners[0].fn();
    await advance(1000);
    assert.equal(listeners.length, 0);
    assert.equal(find('music-menu.wav')[0].playing, true);
    const stream = find('pourLoop.wav')[0];
    assert.equal(stream.playing, true);
    assert.ok(stream.playbackRate > 0.976, 'Held stream resonance follows elapsed fill');
    engine.setPouring(false);
    await advance(80);
    assert.equal(stream.playing, false, 'Release envelope ends the sustained stream');
    engine.playSound('order'); await flush();
    const count = starts(); engine.playSound('order'); await flush();
    assert.equal(starts(), count, 'Cooldown suppresses duplicated taps');
    await advance(130); engine.playSound('order'); await flush();
    assert.equal(starts(), count + 1);
    engine.playSound('serveGood'); await flush();
    engine.setGamePaused(true);
    const pausedCount = starts();
    await advance(200);
    engine.playSound('ice'); await flush();
    assert.equal(starts(), pausedCount, 'Pause cancels delayed layers and suppresses game actions');
    engine.playSound('tap'); await flush();
    assert.equal(starts(), pausedCount + 1, 'Pause/settings controls still answer');
    engine.setGamePaused(false);
    engine.playSound('trash'); await flush();
    engine.setAudioSettings({ music: 0.5, sfx: 0 });
    const mutedCount = starts(); await advance(250);
    assert.equal(starts(), mutedCount, 'Muting cancels queued layers');
    assert.ok(live().filter((p) => !p.source.startsWith('music-')).every((p) => !p.playing));
    engine.setAudioSettings({ music: 0.5, sfx: 0.8 });
    engine.setPouring(true, 0.1); engine.playSound('ice'); await flush();
    appHandlers.forEach((h) => h('background'));
    assert.ok(live().every((p) => !p.playing), 'Backgrounding immediately stops effects, pour and music');
    const awayCount = starts(); await advance(300);
    assert.equal(starts(), awayCount);
    appHandlers.forEach((h) => h('active')); await advance(1000);
    assert.equal(stream.playing, false, 'No stale pour restarts on return');
    engine.setMusic('shop');
    await advance(1200);
    assert.ok(find('music-menu.wav').every((p) => p.removed));
    assert.equal(find('music-shop.wav')[0].playing, true);
    engine.setAudioSettings({ music: 0, sfx: 0.8 }); await advance(1200);
    assert.ok(find('music-shop.wav').every((p) => p.removed));
    engine.setAudioSettings({ music: 0.5, sfx: 0.8 });
    engine.setMusic('menu');
    engine.playSound('dayEnd'); await flush(); stop();
    await advance(1500);
    assert.ok(players.every((p) => p.removed), 'Every native player is released');
    assert.equal(appHandlers.length, 0);
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
  // The web build plays through Web Audio, not <audio> elements: one decoded buffer per clip and a
  // throwaway source per cue. A dozen media elements cycled through pause, seek and play were what
  // made the web build stutter once it had sound, and a headless browser — audio into a null
  // device — never showed it. This is the browser's side of the same lifecycle as above.
  {
    let fetched = [], decodes = 0, failing = null;
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
          onended: null, out: null, connect(to) { this.out = to; }, disconnect() { this.out = null; },
          start(_, offset) { this.started = true; this.offset = offset; }, stop() { this.stopped = true; } };
        this.sources.push(node);
        return node;
      }
      decodeAudioData(bytes, ok) { decodes++; const buffer = { duration: 0.5, file: bytes.file }; ok(buffer); return Promise.resolve(buffer); }
    }
    const contexts = [];
    const docListeners = [];
    global.AudioContext = FakeContext;
    global.fetch = async (uri) => {
      fetched.push(uri);
      // Each buffer remembers which file it was, so a source can be told by what it plays.
      return uri === failing ? { ok: false, status: 404 }
        : { ok: true, arrayBuffer: async () => Object.assign(new ArrayBuffer(4), { file: uri }) };
    };
    global.document = {
      visibilityState: 'visible',
      addEventListener: (type, fn) => docListeners.push({ type, fn }),
      removeEventListener: (type, fn) => { const i = docListeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) docListeners.splice(i, 1); },
    };
    const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    const sounding = () => contexts.flatMap((c) => c.sources).filter((n) => n.started && !n.stopped);

    const engine = fresh('web');
    const stop = engine.initAudio();
    await settle();
    const { WARM_CLIPS } = require('../src/audio/sounds.ts');
    assert.equal(players.length, 0, 'No <audio>-backed expo-audio player is made on a browser with Web Audio');
    assert.equal(contexts.length, 1, 'One audio context for the whole game');
    const ctx = contexts[0];
    assert.equal(ctx.gains.length, WARM_CLIPS.length + 1, 'The same voices are warmed: common contacts plus the pour');
    assert.equal(new Set(fetched).size, fetched.length, 'Each clip is fetched once, however many voices share it');
    assert.equal(decodes, fetched.length, 'And decoded once');

    engine.setMusic('menu'); engine.playSound('order'); engine.setPouring(true, 0.2);
    await settle();
    assert.equal(sounding().length, 0, 'Nothing sounds before the page has been interacted with');
    listeners[0].fn();
    assert.equal(ctx.state, 'running', 'The first gesture resumes the context');
    await advance(1000); await settle();
    const playing = (file) => sounding().find((n) => n.buffer && n.buffer.file === file);
    const music = playing('music-menu.wav');
    assert.ok(music && music.loop, 'The menu theme loops on its own buffer');
    const pour = playing('pourLoop.wav');
    assert.ok(pour && pour.loop, 'The held pour loops');
    assert.ok(pour.playbackRate.value > 0.976, 'And its resonance still follows the fill');
    engine.setPouring(false);
    await advance(80); await settle();
    assert.ok(pour.stopped, 'Releasing the tap ends the pour');
    assert.ok(!music.stopped, 'And leaves the music alone');

    const before = ctx.sources.length;
    engine.playSound('ice'); await settle();
    const cue = ctx.sources.slice(before).find((n) => n.started && !n.loop);
    assert.ok(cue, 'A cue is a fresh source on an already-decoded buffer');
    assert.ok(cue.out && cue.out.gain.value > 0, 'Played through its voice, at its volume');
    assert.equal(fetched.filter((u) => u.startsWith('ice')).length, new Set(fetched.filter((u) => u.startsWith('ice'))).size,
      'Playing it again fetches nothing');

    const hide = docListeners.find((l) => l.type === 'visibilitychange');
    global.document.visibilityState = 'hidden'; hide.fn(); await settle();
    assert.equal(ctx.state, 'suspended', 'A hidden page lets go of the audio device');
    global.document.visibilityState = 'visible'; hide.fn(); await settle();
    assert.equal(ctx.state, 'running', 'And takes it back on return');

    appHandlers.forEach((h) => h('background')); await settle();
    assert.equal(sounding().length, 0, 'Backgrounding still stops effects, pour and music');
    appHandlers.forEach((h) => h('active')); await advance(1200); await settle();

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
    delete global.AudioContext; delete global.fetch; delete global.document;
  }
  {
    const engine = fresh('ios');
    const stop = engine.initAudio();
    assert.equal(listeners.length, 0, 'Native has no browser gate');
    // The one platform with a switch meant for silencing games.
    assert.equal(audioMode.playsInSilentMode, false, 'iOS respects the silent switch');
    engine.playSound('order'); await flush(); assert.ok(starts() > 0);
    stop();
  }

  {
    // Android's ringer is not that switch, and gating on it muted the game for anyone on vibrate.
    const engine = fresh('android');
    const stop = engine.initAudio();
    assert.equal(audioMode.playsInSilentMode, true, 'Android does not gate media on the ringer');
    engine.playSound('order'); await flush(); assert.ok(starts() > 0, 'A cue sounds on Android');
    stop();
  }
  assert.equal(timers.size, 0, 'No timer leaks');
  console.log('check-audio-engine: recorded variation, layers, voice cap, cancellation, fill, browser/native lifecycle, rejected seeks, the Web Audio path and teardown.');
}
main().then(() => {
  global.setTimeout = original.timeout; global.setInterval = original.interval;
  global.clearTimeout = original.clearTimeout; global.clearInterval = original.clearInterval;
  Date.now = original.now; Module._load = original.load;
}, (error) => { console.error(error); process.exit(1); });
