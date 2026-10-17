/* Validate recorded assets, provenance, mastering, catalogue and saved volume behavior. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
require.extensions['.wav'] = (module, file) => { module.exports = file; };
const { CLIPS } = require('../src/audio/clips.ts');
const { SOUNDS, PRELOAD, MUSIC, POUR_LOOP } = require('../src/audio/sounds.ts');
const sources = require('./audio/recordings.json');
const cuts = require('./audio/cuts.json');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
for (const source of sources) {
  assert.equal(source.license, 'CC0-1.0');
  assert.match(source.source, /^https:\/\/freesound.org\/people\//);
  assert.equal(hash(fs.readFileSync(path.join(__dirname, 'audio/recordings', source.id + '.mp3'))), source.sha256, source.id + ' original changed');
}
assert.equal(Object.keys(CLIPS).length, cuts.length, 'Every clip has an edit record');
const all = [...Object.values(CLIPS).map((c) => c.module), ...Object.values(MUSIC)];
assert.equal(new Set(all).size, all.length, 'No duplicate asset entries');
const folder = path.join(root, 'src/assets/audio');
const disk = fs.readdirSync(folder, { recursive: true }).filter((f) => f.endsWith('.wav')).map((f) => path.join(folder, f));
assert.deepEqual(disk.sort(), all.slice().sort(), 'No missing or orphaned audio, including old synth cues');
assert.ok(Object.values(MUSIC).every((file) => !PRELOAD.includes(file)), 'Music stays outside effect warmup');
const used = new Set();
for (const [id, cue] of Object.entries(SOUNDS)) {
  assert.ok(cue.layers.length > 0, id + ' is empty');
  assert.ok(cue.gain > 0 && cue.gain <= 1);
  for (const layer of cue.layers) {
    assert.ok(layer.clips.length > 0);
    assert.ok(layer.delayMs >= 0 && layer.delayMs < 500);
    assert.ok(layer.rate[0] >= 0.75 && layer.rate[1] <= 1.25);
    layer.clips.forEach((c) => used.add(c.module));
  }
}
used.add(POUR_LOOP.module);
assert.deepEqual([...used].sort(), Object.values(CLIPS).map((c) => c.module).sort(), 'Every recording is used');
const rms = (s, from, count) => Math.sqrt(s.slice(from, from + count).reduce((n, x) => n + x * x, 0) / count);
let size = 0;
const measuredRms = new Map();
for (const file of all) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.readUInt32LE(40) + 44, bytes.length);
  const music = Object.values(MUSIC).includes(file);
  const rate = bytes.readUInt32LE(24);
  assert.equal(rate, music ? 16000 : 24000);
  const s = Float32Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32767);
  const peak = s.reduce((n, x) => Math.max(n, Math.abs(x)), 0);
  assert.ok(peak > 0.03 && peak < 0.99, file + ' is silent or clipped');
  assert.ok(Math.abs(s.reduce((n, x) => n + x, 0) / s.length) < 0.02, file + ' DC offset');
  if (!music) {
    measuredRms.set(file, rms(s, 0, s.length));
    size += bytes.length;
    const cut = cuts.find((c) => CLIPS[c.id].module === file);
    assert.ok(cut && sources.some((source) => source.id === cut.source), file + ' has no source');
    assert.equal(hash(bytes), cut.sha256, file + ' differs from edit manifest');
    assert.equal(Math.round(s.length / rate * 1000), cut.durationMs);
    assert.ok(s.length / rate <= 2, 'Effects stay short on mobile');
  }
  if (music || file === POUR_LOOP.module) {
    const delta = Math.sqrt(s.slice(1).reduce((n, x, i) => n + (x - s[i]) ** 2, 0) / (s.length - 1));
    assert.ok(Math.abs(s[0] - s[s.length - 1]) < delta, file + ' loop seam');
    const width = Math.round(s.length * 0.005), overall = rms(s, 0, s.length);
    assert.ok(rms(s, 0, width) > overall * 0.2 && rms(s, s.length - width, width) > overall * 0.2, file + ' faded loop');
  } else {
    assert.equal(s[0], 0, file + ' abrupt start');
    assert.equal(s[s.length - 1], 0, file + ' abrupt end');
  }
}
assert.ok(size < 1024 * 1024, 'Recorded effect bank must stay under 1 MB');

// Peak normalization alone previously left liquids and rewards almost inaudible in the mix.
// Measure the shipped PCM at its actual primary-layer gain, not the mastering manifest's values.
for (const [id, floor] of [['milk', 0.09], ['ice', 0.09], ['sugar', 0.05], ['foam', 0.1], ['coin', 0.06], ['scoop', 0.075]]) {
  const cue = SOUNDS[id], layer = cue.layers[0];
  const { BUS_GAIN } = require('../src/audio/sounds.ts');
  const level = measuredRms.get(layer.clips[0].module) * cue.gain * layer.gain * BUS_GAIN[cue.bus];
  assert.ok(level >= floor, `${id} has lost its body in the mix (${level.toFixed(3)} RMS)`);
}
assert.ok(measuredRms.get(POUR_LOOP.module) * POUR_LOOP.gain * 0.8 >= 0.045, 'Held pour must remain clearly present');

// ------------------------------------------------------------------ the volumes, saved and clamped
const { createInitialState, gameReducer, clampAudio, DEFAULT_AUDIO } = require(path.join(root, 'src/game/reducer.ts'));
const { parseGame, serializeGame } = require(path.join(root, 'src/game/save.ts'));

let state = createInitialState(99);
assert.deepEqual(state.audio, DEFAULT_AUDIO, 'A new shop opens at the default volumes');

state = gameReducer(state, { type: 'SET_AUDIO', audio: { music: 0 } });
assert.deepEqual(state.audio, { music: 0, sfx: DEFAULT_AUDIO.sfx }, 'One volume can be set without the other');

state = gameReducer(state, { type: 'SET_AUDIO', audio: { sfx: 4, music: -1 } });
assert.deepEqual(state.audio, { music: 0, sfx: 1 }, 'Out-of-range volumes are clamped rather than refused');
assert.deepEqual(clampAudio({ music: NaN, sfx: Infinity }), { music: 0, sfx: 0 }, 'Nonsense clamps to silence');

// Carried to the next day, and over a trip to the menu and back, the way `mode` and `money` are.
state = gameReducer(state, { type: 'SET_AUDIO', audio: { music: 0.35, sfx: 0.7 } });
const quiet = { music: 0.35, sfx: 0.7 };
assert.deepEqual(gameReducer(state, { type: 'START_DAY', day: 2 }).audio, quiet, 'The volumes carry to the next day');
assert.deepEqual(
  gameReducer(gameReducer(state, { type: 'GO_TO_TITLE' }), { type: 'START_DAY', day: 1 }).audio,
  quiet,
  'The volumes survive quitting to the menu',
);

// --- the round trip
state = gameReducer(createInitialState(7), { type: 'START_DAY', day: 1 });
state = gameReducer(state, { type: 'SET_AUDIO', audio: quiet });
const restored = parseGame(serializeGame(state));
assert.ok(restored, 'A save with volumes in it comes back');
assert.deepEqual(restored.audio, quiet, 'A shop reopens as loud as it was left');

// --- a save from before the volumes existed is migrated, not thrown away. This is the case the
//     whole optional-field rule exists for: bumping SAVE_VERSION instead would wipe every shop.
const older = JSON.parse(serializeGame(state));
delete older.audio;
const migrated = parseGame(JSON.stringify(older));
assert.ok(migrated, 'A save written before the volumes existed is still readable');
assert.deepEqual(migrated.audio, DEFAULT_AUDIO, 'It opens at the defaults');

// --- and a hand-edited one is clamped rather than refused, unlike an unknown ingredient
const edited = JSON.parse(serializeGame(state));
edited.audio = { music: 'loud', sfx: 99 };
const fixed = parseGame(JSON.stringify(edited));
assert.ok(fixed, 'A save with nonsense volumes is not thrown away over them');
assert.deepEqual(fixed.audio, { music: DEFAULT_AUDIO.music, sfx: 1 }, 'The volumes are brought back into range');


console.log('check-audio: '+cuts.length+' recorded clips, provenance verified, '+Math.round(size/1024)+' KB, clean loops and saved volumes.');
