/* Deterministic music-only generator. Effects are recorded: tools/audio/build-foley.cjs. */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'src', 'assets', 'audio');
const RATE_MUSIC = 16_000;

// ------------------------------------------------------------------ determinism
/** A seeded LCG. Re-running the script must produce the same bytes; see the header. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}
const rng = makeRng(3_182_683_190);
const between = (lo, hi) => lo + rng() * (hi - lo);

// ------------------------------------------------------------------ buffers
const buffer = (seconds, rate) => new Float32Array(Math.max(1, Math.round(seconds * rate)));

/** Add `src` into `dst` starting at `seconds`, at `gain`. Anything past the end is dropped. */
function mix(dst, src, seconds, rate, gain = 1) {
  const start = Math.round(seconds * rate);
  for (let i = 0; i < src.length; i++) {
    const at = start + i;
    if (at < 0 || at >= dst.length) continue;
    dst[at] += src[i] * gain;
  }
}

/**
 * Scale so the loudest sample sits at `peak`. Every file is levelled here, so the gains in the
 * game's catalogue are about balance between cues rather than about whatever this synth happened
 * to add up to.
 */
function normalize(buf, peak = 0.9) {
  let max = 0;
  for (const sample of buf) max = Math.max(max, Math.abs(sample));
  if (max < 1e-6) return buf;
  const scale = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= scale;
  return buf;
}

/** Keeps a summed mix inside the rails without the flat top that hard clipping gives it. */
function softClip(buf, drive = 1) {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) / Math.tanh(drive);
  return buf;
}

/** A one-shot has to start and end at zero, or the player hears the discontinuity as a click. */
function fadeEdges(buf, rate, inMs = 3, outMs = 12) {
  const a = Math.max(1, Math.round((inMs / 1000) * rate));
  const b = Math.max(1, Math.round((outMs / 1000) * rate));
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

function lowpass(buf, cutoff, rate, passes = 1) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  for (let p = 0; p < passes; p++) {
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      y += a * (buf[i] - y);
      buf[i] = y;
    }
  }
  return buf;
}

function highpass(buf, cutoff, rate) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] -= y;
  }
  return buf;
}

const bandpass = (buf, lo, hi, rate) => lowpass(highpass(buf, lo, rate), hi, rate);

/** Schroeder reverb: four combs into two allpasses. Enough to put a cue in a warm little room. */
function reverb(buf, rate, wet = 0.3, room = 0.8) {
  const out = new Float32Array(buf.length);
  for (const ms of [29.7, 37.1, 41.1, 43.7]) {
    const line = new Float32Array(Math.max(1, Math.round((ms / 1000) * rate)));
    let at = 0;
    for (let i = 0; i < buf.length; i++) {
      const old = line[at];
      line[at] = buf[i] + old * room * 0.88;
      at = (at + 1) % line.length;
      out[i] += old * 0.25;
    }
  }
  for (const ms of [5.0, 1.7]) {
    const line = new Float32Array(Math.max(1, Math.round((ms / 1000) * rate)));
    let at = 0;
    const g = 0.7;
    for (let i = 0; i < out.length; i++) {
      const old = line[at];
      const input = out[i];
      out[i] = -g * input + old;
      line[at] = input + g * out[i];
      at = (at + 1) % line.length;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - wet * 0.35) + out[i] * wet;
  return buf;
}

function foldTail(buf, loopSeconds, rate) {
  const n = Math.round(loopSeconds * rate);
  if (buf.length <= n) return buf.slice(0, n);
  const out = buf.slice(0, n);
  for (let i = 0; i < buf.length - n; i++) out[i % n] += buf[n + i];
  return out;
}

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `A5`, `Bb3`, `C#6` to hertz. */
function hz(name) {
  const match = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`not a note: ${name}`);
  const [, letter, accidental, octave] = match;
  const semitone = STEPS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const midi = (Number(octave) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

// ------------------------------------------------------------------ instruments
/**
 * One struck voice, built out of sines. `partials` are `[multiple, level, decay share]` against
 * the fundamental, and they are deliberately a little inharmonic — that is what makes a bell a
 * bell rather than an organ — with the higher ones decaying faster, the way a real bar does.
 */
function struck({ freq, seconds, rate, partials, attackMs = 2, gain = 1 }) {
  const buf = buffer(seconds, rate);
  const attack = Math.max(1, Math.round((attackMs / 1000) * rate));
  const nyquist = rate / 2;
  for (const [ratio, level, decayShare] of partials) {
    const f = freq * ratio;
    if (f > nyquist * 0.92) continue; // never fold a partial back down into the melody
    const decay = seconds * decayShare;
    const w = 2 * Math.PI * f;
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < buf.length; i++) {
      const t = i / rate;
      buf[i] += Math.sin(w * t + phase) * level * Math.exp(-t / decay) * (i < attack ? i / attack : 1);
    }
  }
  return normalize(buf, 0.9 * gain);
}

const bell = (note, seconds, rate, gain = 1) =>
  struck({
    freq: hz(note),
    seconds,
    rate,
    gain,
    partials: [[1, 1, 0.42], [2.01, 0.34, 0.26], [3.02, 0.16, 0.17], [4.21, 0.07, 0.1], [5.43, 0.03, 0.07]],
  });

const marimba = (note, seconds, rate, gain = 1) =>
  struck({
    freq: hz(note),
    seconds,
    rate,
    gain,
    attackMs: 4,
    partials: [[1, 1, 0.3], [3.94, 0.2, 0.12], [9.2, 0.06, 0.06]],
  });

/** A soft held chord tone: slow in, slow out, slightly detuned against itself for warmth. */
function pad(note, seconds, rate, gain = 1) {
  const buf = buffer(seconds, rate);
  const freq = hz(note);
  const nyquist = rate / 2;
  for (const [ratio, level, detune] of [[1, 1, 0], [1, 0.5, 0.6], [2, 0.22, -0.4], [3, 0.08, 0.3]]) {
    const f = freq * ratio + detune;
    if (f > nyquist * 0.92) continue;
    const w = 2 * Math.PI * f;
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < buf.length; i++) {
      const t = i / rate;
      // Slow swell in, long fall away — nothing in this game is allowed to arrive abruptly.
      const env = Math.min(1, t / (seconds * 0.35)) * Math.exp(-t / (seconds * 0.6));
      buf[i] += Math.sin(w * t + phase) * level * env;
    }
  }
  return normalize(buf, 0.9 * gain);
}

/** A low sine with a soft knee: the floor under the shop theme. */
function bass(note, seconds, rate, gain = 1) {
  const buf = buffer(seconds, rate);
  const w = 2 * Math.PI * hz(note);
  for (let i = 0; i < buf.length; i++) {
    const t = i / rate;
    buf[i] = Math.sin(w * t) * Math.min(1, t / 0.02) * Math.exp(-t / (seconds * 0.45));
  }
  return normalize(buf, 0.9 * gain);
}

/** A brushed shaker: a short burst of high noise, no pitch at all. */
function shaker(seconds, rate, gain = 1) {
  const buf = buffer(seconds, rate);
  for (let i = 0; i < buf.length; i++) {
    const t = i / rate;
    buf[i] = between(-1, 1) * Math.exp(-t / (seconds * 0.18)) * Math.min(1, t / 0.004);
  }
  bandpass(buf, 3_200, 9_000, rate);
  return normalize(buf, 0.9 * gain);
}

const written = [];

function writeWav(name, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw new Error(`${name}: non-finite sample at ${i}`);
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([header, data]));
  written.push({ name, seconds: samples.length / rate, kb: (44 + data.length) / 1024 });
}

function music() {
  const R = RATE_MUSIC;

  // --- the menu: 4 bars at 76 bpm, no percussion, nothing in a hurry ---
  {
    const beat = 60 / 76;
    const bar = beat * 4;
    const loop = bar * 4;
    const buf = buffer(loop + 3.5, R);
    const at = (barIndex, beatIndex) => barIndex * bar + (beatIndex - 1) * beat;

    const chords = [
      ['F3', 'A3', 'C4', 'E4'], // Fmaj7
      ['D3', 'F3', 'A3', 'C4'], // Dm7
      ['Bb3', 'D4', 'F4', 'G4'], // Bb6
      ['C3', 'E3', 'G3', 'Bb3'], // C7, turning it back round
    ];
    chords.forEach((chord, barIndex) => {
      for (const note of chord) mix(buf, pad(note, bar * 1.5, R), at(barIndex, 1), R, 0.2);
    });

    // The melody, in F pentatonic, landing off the beat more often than on it.
    const melody = [
      [0, 1, 'A5'], [0, 2.5, 'C6'], [0, 4, 'A5'],
      [1, 1, 'F5'], [1, 2, 'A5'], [1, 3.5, 'D5'],
      [2, 1, 'G5'], [2, 2.5, 'Bb5'], [2, 4, 'D6'],
      [3, 1, 'C6'], [3, 2.5, 'A5'], [3, 3.5, 'G5'],
    ];
    for (const [barIndex, beatIndex, note] of melody) {
      mix(buf, bell(note, beat * 2.4, R), at(barIndex, beatIndex), R, 0.5);
    }

    for (const [barIndex, note] of [[0, 'F2'], [1, 'D2'], [2, 'Bb2'], [3, 'C2']]) {
      mix(buf, bass(note, bar * 0.9, R), at(barIndex, 1), R, 0.3);
    }

    reverb(buf, R, 0.3, 0.84);
    writeWav('music-menu.wav', normalize(softClip(foldTail(buf, loop, R), 1.1), 0.78), R);
  }

  // --- the shift: 8 bars at 92 bpm, a marimba ostinato and a soft shaker ---
  {
    const beat = 60 / 92;
    const bar = beat * 4;
    const loop = bar * 8;
    const buf = buffer(loop + 3.0, R);
    const at = (barIndex, beatIndex) => barIndex * bar + (beatIndex - 1) * beat;

    // Eight bars, two turns of the same four chords, with Am7 in place of F the second time so
    // the loop does not land in exactly the same spot twice.
    const chords = [
      { pad: ['F3', 'A3', 'C4'], arp: ['F4', 'A4', 'C5', 'A4'], low: 'F2' },
      { pad: ['D3', 'F3', 'A3'], arp: ['D4', 'F4', 'A4', 'F4'], low: 'D2' },
      { pad: ['Bb3', 'D4', 'F4'], arp: ['Bb4', 'D5', 'F5', 'D5'], low: 'Bb2' },
      { pad: ['C3', 'E3', 'G3'], arp: ['C4', 'E4', 'G4', 'E4'], low: 'C2' },
      { pad: ['F3', 'A3', 'C4'], arp: ['F4', 'A4', 'C5', 'A4'], low: 'F2' },
      { pad: ['A3', 'C4', 'E4'], arp: ['A4', 'C5', 'E5', 'C5'], low: 'A2' },
      { pad: ['Bb3', 'D4', 'F4'], arp: ['Bb4', 'D5', 'F5', 'D5'], low: 'Bb2' },
      { pad: ['C3', 'E3', 'G3'], arp: ['C4', 'G4', 'Bb4', 'G4'], low: 'C2' },
    ];

    chords.forEach((chord, barIndex) => {
      for (const note of chord.pad) mix(buf, pad(note, bar * 1.4, R), at(barIndex, 1), R, 0.13);
      mix(buf, bass(chord.low, bar * 0.55, R), at(barIndex, 1), R, 0.26);
      mix(buf, bass(chord.low, bar * 0.4, R), at(barIndex, 3), R, 0.16);
      // The ostinato: eighth notes, the arpeggio twice over, quieter on the off-beats so it has a
      // pulse without a drum.
      for (let eighth = 0; eighth < 8; eighth++) {
        const note = chord.arp[eighth % chord.arp.length];
        mix(buf, marimba(note, beat * 1.1, R), at(barIndex, 1) + eighth * beat * 0.5, R, eighth % 2 ? 0.14 : 0.24);
      }
      // Shaker on 2 and 4, well under everything else.
      mix(buf, shaker(0.2, R), at(barIndex, 2), R, 0.085);
      mix(buf, shaker(0.2, R), at(barIndex, 4), R, 0.085);
    });

    // A sparse music-box line over the top, so the eight bars have a shape and not just a groove.
    const melody = [
      [0, 1, 'C6'], [0, 3.5, 'A5'],
      [1, 2, 'D6'], [1, 4, 'A5'],
      [2, 1, 'F6'], [2, 2.5, 'D6'],
      [3, 1.5, 'C6'], [3, 3, 'G5'],
      [4, 1, 'A5'], [4, 3.5, 'C6'],
      [5, 2, 'E6'], [5, 4, 'C6'],
      [6, 1, 'D6'], [6, 2.5, 'F6'],
      [7, 1.5, 'G5'], [7, 3, 'A5'],
    ];
    for (const [barIndex, beatIndex, note] of melody) {
      mix(buf, bell(note, beat * 2.2, R), at(barIndex, beatIndex), R, 0.33);
    }

    reverb(buf, R, 0.26, 0.8);
    writeWav('music-shop.wav', normalize(softClip(foldTail(buf, loop, R), 1.1), 0.74), R);
  }
}

fs.mkdirSync(OUT, { recursive: true });
music();
console.log(`make-music: ${written.length} music loops`);
