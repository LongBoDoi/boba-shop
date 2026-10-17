/* Offline tonal shaping and look-ahead compression. No per-frame audio DSP in the app. */
const rms = (samples) => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);

function lowBand(samples, cutoff, rate, circular) {
  const a = 1 - Math.exp(-2 * Math.PI * cutoff / rate);
  let state = 0;
  if (circular) for (const x of samples) state += a * (x - state);
  return Float32Array.from(samples, (x) => { state += a * (x - state); return state; });
}

function master(samples, id, rate) {
  const circular = id === 'pourLoop';
  const liquid = /^(milk|pour|plop|foam|splash)/.test(id);
  const delicate = /^(bell|paper|step|bag)/.test(id);
  const target = circular ? 0.2 : delicate ? 0.16 : liquid ? 0.21 : 0.19;
  const body = lowBand(samples, liquid ? 700 : 450, rate, circular);
  const top = lowBand(samples, 2_600, rate, circular);
  let shaped = Float32Array.from(samples, (x, i) =>
    x + body[i] * (liquid ? 0.32 : 0.2) + (x - top[i]) * (id.startsWith('bell') ? -0.18 : 0.12));
  const inputRms = rms(shaped);
  if (inputRms < 1e-7) throw new Error(`Silent mastering input: ${id}`);
  const inputGain = 0.22 / inputRms;
  shaped = Float32Array.from(shaped, (x) => x * inputGain);

  // Anticipate peaks so their surrounding body can come forward without flattening the contact.
  // Circular look-ahead and a priming lap keep the sustained stream's compressor state periodic.
  const ahead = Math.round(rate * 0.003);
  const peaks = Float32Array.from(shaped, (_, i) => {
    let peak = 0;
    for (let j = 0; j < ahead; j++) {
      const at = i + j;
      if (at >= shaped.length && !circular) break;
      peak = Math.max(peak, Math.abs(shaped[at % shaped.length]));
    }
    return peak;
  });
  const attack = Math.exp(-1 / (rate * 0.0005));
  const release = Math.exp(-1 / (rate * (liquid ? 0.055 : 0.035)));
  let envelope = peaks[0];
  const follow = (peak) => {
    const coefficient = peak > envelope ? attack : release;
    envelope = coefficient * envelope + (1 - coefficient) * peak;
  };
  if (circular) for (const peak of peaks) follow(peak);
  const compressed = Float32Array.from(shaped, (x, i) => {
    follow(peaks[i]);
    const gain = envelope > 0.24 ? (0.24 / envelope) ** 0.82 : 1;
    return x * (gain * 0.97 + 0.03); // a little dry transient retains tactile snap
  });
  let peak = 0;
  for (const x of compressed) peak = Math.max(peak, Math.abs(x));
  const gain = Math.min(target / rms(compressed), (circular ? 0.65 : 0.88) / peak);
  const result = Float32Array.from(compressed, (x) => x * gain);
  if (!circular) {
    for (let i = 0; i < result.length; i++) {
      result[i] *= Math.min(1, i / (rate * 0.0007), (result.length - 1 - i) / (rate * 0.008));
    }
  }
  return { samples: result, rms: rms(result), peak: result.reduce((max, x) => Math.max(max, Math.abs(x)), 0) };
}

module.exports = { master };
