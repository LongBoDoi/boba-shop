/* Render catalogue layers at their actual game gains, without preview-only normalization. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

module.exports = function buildAudition() {
  const root = path.resolve(__dirname, '../..');
  const previousTs = require.extensions['.ts'], previousWav = require.extensions['.wav'];
  let catalogue;
  try {
    require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
    }).outputText, file);
    require.extensions['.wav'] = (module, file) => { module.exports = file; };
    catalogue = require(path.join(root, 'src/audio/sounds.ts'));
  } finally {
    if (previousTs) require.extensions['.ts'] = previousTs; else delete require.extensions['.ts'];
    if (previousWav) require.extensions['.wav'] = previousWav; else delete require.extensions['.wav'];
  }
  const { SOUNDS, BUS_GAIN, POUR_LOOP } = catalogue;
  const rate = 24000, previews = path.join(__dirname, 'previews');
  fs.mkdirSync(previews, { recursive: true });
  const read = (file) => {
    const bytes = fs.readFileSync(file);
    return Float32Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32767);
  };
  function mix(dst, src, seconds, speed, gain, loop = false) {
    const start = Math.round(seconds * rate);
    const count = loop ? dst.length - start : Math.ceil(src.length / speed);
    for (let i = 0; i < count && start + i < dst.length; i++) {
      const at = i * speed, index = Math.floor(at);
      const a = src[index % src.length], b = src[(index + 1) % src.length];
      dst[start + i] += (a + (b - a) * (at - index)) * gain;
    }
  }
  function action(dst, id, at = 0) {
    const spec = SOUNDS[id];
    for (const layer of spec.layers) mix(dst, read(layer.clips[0].module), at + layer.delayMs / 1000,
      (layer.rate[0] + layer.rate[1]) / 2, spec.gain * BUS_GAIN[spec.bus] * layer.gain * 0.96);
  }
  function write(id, samples) {
    const peak = samples.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
    if (peak >= 0.98) throw new Error(`Audition mix ${id} clips: peak ${peak.toFixed(3)}`);
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((x, i) => wav.writeInt16LE(Math.round(x * 32767), 44 + i * 2));
    fs.writeFileSync(path.join(previews, `${id}.wav`), wav);
    return { id, peak };
  }
  const results = [];
  for (const [id, spec] of Object.entries(SOUNDS)) {
    const ms = Math.max(...spec.layers.map((l) => l.delayMs + l.clips[0].durationMs / l.rate[0])) + 40;
    const dst = new Float32Array(Math.ceil(ms * rate / 1000));
    action(dst, id);
    results.push(write(id, dst));
  }
  // A deliberately busy, plausible run: ice and milk added while tea is running.
  const scene = new Float32Array(rate * 7);
  const stream = read(POUR_LOOP.module);
  const held = new Float32Array(Math.round(rate * 2.1));
  mix(held, stream, 0, 1, POUR_LOOP.gain * 0.9, true);
  for (let i = 0; i < held.length; i++) held[i] *= Math.min(1, i / (rate * 0.064), (held.length - 1 - i) / (rate * 0.064));
  mix(scene, held, 0.3, 1, 1);
  for (const [id, at] of [['pourStart', 0.3], ['ice', 0.85], ['milk', 1.5], ['pourStop', 2.4],
    ['scoop', 2.8], ['sugar', 3.25], ['foam', 3.9], ['serveGood', 4.5], ['coin', 5.3]]) action(scene, id, at);
  results.push(write('shop-demo', scene));
  fs.writeFileSync(path.join(__dirname, 'mix-levels.json'), JSON.stringify(results, null, 2) + '\n');
  const file = path.join(__dirname, 'audition.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('<p>Audition the shipped recordings in isolation. Use the game to hear their action timing, alternate takes and mix.</p>',
    '<p>Full action sounds at their game mix levels. Start with the shop demo, then try individual actions.</p>' +
    results.slice().reverse().map(({ id }) => `<section><strong>${id}</strong><audio controls preload="none" src="previews/${id}.wav"></audio></section>`).join('\n') +
    '<h2>Isolated recordings</h2>');
  fs.writeFileSync(file, html);
  console.log(`Audition: ${results.length} action/scene mixes, highest peak ${Math.max(...results.map((r) => r.peak)).toFixed(3)}.`);
};
