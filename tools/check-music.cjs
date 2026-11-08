/* The shipped chapter library and settings migration. No network or audio device required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
require.extensions['.m4a'] = (module, file) => { module.exports = file; };
const { MUSIC_TRACKS } = require('../src/game/music.ts');
const { MUSIC_ASSETS } = require('../src/audio/musicAssets.ts');
const manifest = require('./audio/music-source.json');
const { createInitialState, gameReducer, DEFAULT_AUDIO, clampAudio } = require('../src/game/reducer.ts');
const { serializeGame, parseGame } = require('../src/game/save.ts');
assert.equal(MUSIC_TRACKS.length, 30);
assert.equal(new Set(MUSIC_TRACKS.map((t) => t.id)).size, 30);
assert.deepEqual(Object.keys(MUSIC_ASSETS).sort(), MUSIC_TRACKS.map((t) => t.id).sort());
const dir = path.resolve(__dirname, '../src/assets/audio/music');
assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.m4a')).sort(), MUSIC_TRACKS.map((t) => t.id + '.m4a').sort());
let total = 0;
for (const [index, track] of MUSIC_TRACKS.entries()) {
  const edit = manifest.tracks[index];
  assert.equal(track.id, edit.id);
  assert.equal(track.number, index + 1);
  assert.equal(track.title, edit.title);
  assert.equal(track.start, index ? MUSIC_TRACKS[index - 1].start + MUSIC_TRACKS[index - 1].duration : 0);
  assert.equal(track.duration, edit.end - edit.start);
  const bytes = fs.readFileSync(MUSIC_ASSETS[track.id]);
  assert.equal(bytes.length, edit.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), edit.sha256, track.id + ' differs from chapter manifest');
  // The complete MP4 container must be present, with its seek table ahead of compressed audio.
  const atoms = [];
  for (let offset = 0; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    assert.ok(size >= 8 && offset + size <= bytes.length, track.id + ' has a truncated MP4 atom');
    atoms.push(bytes.toString('ascii', offset + 4, offset + 8));
    offset += size;
  }
  assert.equal(atoms[0], 'ftyp');
  assert.ok(atoms.includes('moov') && atoms.includes('mdat'));
  assert.ok(atoms.indexOf('moov') < atoms.indexOf('mdat'), 'Fast-start metadata comes before the audio');
  const movieHeader = bytes.indexOf(Buffer.from('mvhd'));
  assert.ok(movieHeader > 0);
  assert.equal(bytes[movieHeader + 4], 0, 'Expected a version-0 movie header');
  const duration = bytes.readUInt32BE(movieHeader + 20) / bytes.readUInt32BE(movieHeader + 16);
  assert.ok(Math.abs(duration - track.duration) <= 0.5, track.id + ' was cut short');
  total += bytes.length;
}
assert.equal(MUSIC_TRACKS.at(-1).start + MUSIC_TRACKS.at(-1).duration, 7223, 'The entire two-hour source is covered once');
assert.ok(total < 100 * 1024 * 1024, 'Long-form mobile music stays compressed');

for (const musicChoice of ['cycle', 'shuffle', ...MUSIC_TRACKS.map((track) => track.id)]) {
  const initial = createInitialState(35);
  const selected = gameReducer(initial, { type: 'SET_AUDIO', audio: { musicChoice } });
  assert.equal(selected.audio.musicChoice, musicChoice);
  assert.equal(gameReducer(selected, { type: 'START_DAY', day: 2 }).audio.musicChoice, musicChoice);
  assert.equal(gameReducer(selected, { type: 'GO_TO_TITLE' }).audio.musicChoice, musicChoice);
  assert.deepEqual(parseGame(serializeGame(selected)).audio, selected.audio, musicChoice + ' survives a save');
}
const older = JSON.parse(serializeGame(createInitialState(9)));
older.audio = { music: 0.35, sfx: 0.7 };
assert.deepEqual(parseGame(JSON.stringify(older)).audio, { ...DEFAULT_AUDIO, music: 0.35, sfx: 0.7 }, 'Old shops keep both volumes and gain the playlist default');
for (const bad of [null, {}, 'menu', 'shop', 'missing-track', 7, ['shuffle']]) {
  older.audio.musicChoice = bad;
  assert.equal(parseGame(JSON.stringify(older)).audio.musicChoice, 'cycle', 'Invalid music choices recover without losing the shop');
}
assert.equal(clampAudio({ ...DEFAULT_AUDIO, musicChoice: 'not-a-song' }).musicChoice, 'cycle');
console.log(`check-music: 30 complete chapters, ${Math.round(total / 1024 / 1024)} MB AAC, fast-start containers, hashes, all 32 saved choices and migration.`);
