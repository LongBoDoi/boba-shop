/* Build the shipped sample bank from checked-in CC0 recordings. Requires ffmpeg, offline. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { master } = require('./mastering.cjs');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'src/assets/audio/foley');
const rate = 24_000;
// ffmpeg on PATH, FFMPEG_PATH, or a copy dropped beside this script (it is gitignored).
const ffmpeg = process.env.FFMPEG_PATH || (fs.existsSync(path.join(__dirname, 'bin/ffmpeg.exe'))
  ? path.join(__dirname, 'bin/ffmpeg.exe') : 'ffmpeg');
const sources = require('./recordings.json');
const decoded = new Map();
function recording(id) {
  if (decoded.has(id)) return decoded.get(id);
  const file = path.join(__dirname, 'recordings', `${id}.mp3`);
  const bytes = fs.readFileSync(file);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== sources.find((s) => s.id === id).sha256) {
    throw new Error(`Source checksum changed: ${id}`);
  }
  const pcm = cp.execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate),
    '-af', 'highpass=f=100,lowpass=f=8500', '-f', 'f32le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  const samples = Float32Array.from({ length: pcm.length / 4 }, (_, i) => pcm.readFloatLE(i * 4));
  decoded.set(id, samples);
  return samples;
}

// Each alternate is a separate moment of the recording, not a pitch-shifted copy.
const cuts = {
  cup1: ['cup', 0.01, 0.42], cup2: ['cupAlternate', 0.18, 0.42],
  ice1: ['ice', 1.55, 0.48], ice2: ['ice', 5.35, 0.48], ice3: ['ice', 9.8, 0.48],
  pump1: ['pump', 1.98, 0.65], pump2: ['pump', 7.0, 0.65], pump3: ['pump', 12.2, 0.65],
  paper1: ['paper', 0.4, 0.3], paper2: ['paper', 1.3, 0.3],
  spoon1: ['spoon', 0.85, 0.3], spoon2: ['spoon', 2.35, 0.3],
  bell1: ['bell', 0, 1.8],
  coin1: ['coin', 0.47, 0.75],
  splash1: ['splash', 0, 0.48], splash2: ['splash', 1.46, 0.6],
  bag1: ['bag', 0.2, 0.4], bag2: ['bag', 1, 0.4],
  step1: ['steps', 0.2, 0.25], step2: ['steps', 0.6, 0.25],
  plop1: ['plop', 5.95, 0.25], plop2: ['plop', 21.35, 0.25],
  foam1: ['foam', 0.4, 0.28], foam2: ['foam', 1.1, 0.28],
  milk1: ['pour', 0.6, 0.5], milk2: ['pour', 1.4, 0.5],
  pourStart: ['pour', 0.45, 0.18], pourStop: ['pour', 3.15, 0.25],
  pourLoop: ['pour', 1.05, 1.7],
};

fs.mkdirSync(out, { recursive: true });
const manifest = [];
for (const [id, [source, start, duration]] of Object.entries(cuts)) {
  const original = recording(source);
  const offset = Math.round(start * rate);
  const count = Math.round(duration * rate);
  if (offset + count > original.length) throw new Error(`${id} exceeds its recording`);
  let samples = original.slice(offset, offset + count);
  // A short overlapping splice preserves natural stream energy across the loop boundary.
  if (id === 'pourLoop') {
    const overlap = Math.round(0.08 * rate);
    const length = samples.length - overlap;
    for (let i = 0; i < overlap; i++) {
      const a = i / overlap;
      samples[i] = samples[length + i] * (1 - a) + samples[i] * a;
    }
    samples = samples.slice(0, length);
    let splice = 1;
    for (let i = 2; i < samples.length; i++) {
      if (Math.abs(samples[i]) > 0.0001 && Math.abs(samples[i] - samples[i - 1]) < Math.abs(samples[splice] - samples[splice - 1])) splice = i;
    }
    samples = Float32Array.from(samples, (_, i) => samples[(i + splice) % samples.length]);
  } else {
    // Trim leading dead air so the contact answers the finger immediately.
    let peak = 0;
    for (const x of samples) peak = Math.max(peak, Math.abs(x));
    const onset = samples.findIndex((x) => Math.abs(x) > peak * 0.08);
    samples = samples.slice(Math.max(0, onset - Math.round(0.004 * rate)));
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= Math.min(1, i / (rate * 0.002), (samples.length - 1 - i) / (rate * 0.02));
    }
  }
  const mastered = master(samples, id, rate);
  samples = mastered.samples;
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => {
    if (!Number.isFinite(x)) throw new Error(`${id}: invalid sample`);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2);
  });
  fs.writeFileSync(path.join(out, `${id}.wav`), wav);
  manifest.push({ id, source, start, duration, durationMs: Math.round(samples.length / rate * 1000),
    mastering: 'body-presence-compression-v1', rms: mastered.rms, peak: mastered.peak,
    sha256: crypto.createHash('sha256').update(wav).digest('hex') });
}
fs.writeFileSync(path.join(__dirname, 'cuts.json'), JSON.stringify(manifest, null, 2) + '\n');
// A clip is the URL its file is served at, which is what an imported asset gives us.
fs.writeFileSync(path.join(root, 'src/audio/clips.ts'),
  manifest.map((c) => `import ${c.id} from '../assets/audio/foley/${c.id}.wav';`).join('\n') + '\n\n' +
  '// Generated by tools/audio/build-foley.cjs. Source credits: tools/audio/recordings.json.\n' +
  'export interface Clip { module: string; durationMs: number }\n\nexport const CLIPS = {\n' +
  manifest.map((c) => `  ${c.id}: { module: ${c.id}, durationMs: ${c.durationMs} },`).join('\n') +
  '\n} satisfies Record<string, Clip>;\n');
fs.writeFileSync(path.join(root, 'src/assets/audio/CREDITS.md'),
  '# Recorded sound credits\n\nAll effect sources are CC0 1.0. Shipped WAVs are trimmed, filtered, mixed to mono and levelled excerpts\n' +
  'of the public high-quality MP3 previews. Original downloads, checksums and edit decisions are\n' +
  'preserved under `tools/audio/`. Music is generated separately by `tools/make-music.cjs`.\n\n' +
  sources.map((s) => `- **${s.id}** — [${s.author}](${s.source}), [CC0](${s.licenseUrl}).`).join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'audition.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boba shop — recorded sound bank</title>
<style>body{font:16px system-ui;background:#faf5ed;color:#37291f;max-width:850px;margin:auto;padding:24px}h1{font-size:28px}section{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:white;border:1px solid #e3d5c2;border-radius:12px;padding:14px;margin:10px 0}strong{min-width:120px}audio{max-width:100%}small{color:#695746}</style>
<h1>Boba shop: recorded sound bank</h1>
<p>Audition the shipped recordings in isolation. Use the game to hear their action timing, alternate takes and mix.</p>
${manifest.map((c) => `<section><strong>${c.id}</strong><audio controls preload="none" ${c.id === 'pourLoop' ? 'loop' : ''} src="../../src/assets/audio/foley/${c.id}.wav"></audio><small>${c.durationMs} ms · ${c.source}</small></section>`).join('\n')}
<script>document.addEventListener('play',e=>{document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()});e.target.volume=0.5},true)</script></html>`);
console.log(`Built ${manifest.length} recorded clips (${Math.round(manifest.reduce((n, c) => n + c.durationMs * 48, 0) / 1024)} KB).`);
require('./build-audition.cjs')();
