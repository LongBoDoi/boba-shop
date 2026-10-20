import { CUP_ART, CUP_SURFACE_RATIO, cupFillPath, cupSurface, pourLevel } from '../art/cupGeometry';

const RX = 42;
const WIDTH = 104, HEIGHT = 80, ORIGIN_X = 52, ORIGIN_Y = 58;
/** Room for the peak above the rim; the cup's near wall is composited in front of the cream. */
export const CUP_OVERFLOW = 40 / CUP_ART.h;
const RESOLUTION = 4;
const creams = new Map<string, HTMLCanvasElement>();
const melting = new Map<string, HTMLCanvasElement>();

/** Painted star-nozzle folds, cached in cup coordinates with a foreshortened contact edge. */
function creamArt(id: string, color: string, sprite: CanvasImageSource, teaColor?: string): HTMLCanvasElement {
  const key = `${id}:${color}:${teaColor ?? 'dry'}`;
  const cached = creams.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;
  const c = canvas.getContext('2d')!;
  c.scale(RESOLUTION, RESOLUTION);
  c.translate(ORIGIN_X, ORIGIN_Y);
  const source = { left: 160, right: 1264, top: 118, contact: 735, bottom: 1014 };
  const scale = 2 * RX / (source.right - source.left);
  const upperHeight = (source.contact - source.top) * scale;
  // Preserve the upright piped folds, projecting the lower contact portion onto
  // the tea's oval. A single uniformly squashed sprite would flatten the curl.
  c.drawImage(sprite, source.left, source.top, source.right - source.left, source.contact - source.top,
    -RX, -upperHeight, 2 * RX, upperHeight);
  c.drawImage(sprite, source.left, source.contact, source.right - source.left, source.bottom - source.contact,
    -RX, 0, 2 * RX, RX * CUP_SURFACE_RATIO);

  // The soft lower edge belongs to the liquid's footprint, including its perspective.
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = '#fff';
  c.fill(new Path2D(`M-52-58H52V0H42 A42 ${RX * CUP_SURFACE_RATIO} 0 0 1-42 0H-52Z`));
  if (id === 'brulee') finishBrulee(c);
  if (teaColor) settleCreamContact(c, teaColor);
  creams.set(key, canvas);
  return canvas;
}

/** Golden custard shading and torched sugar distinguish brûlée at actual cup size. */
function finishBrulee(c: CanvasRenderingContext2D) {
  const pixels = c.getImageData(0, 0, WIDTH * RESOLUTION, HEIGHT * RESOLUTION);
  const shadow = [144, 78, 29], custard = [240, 190, 108], highlight = [255, 246, 214];
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (!pixels.data[i + 3]) continue;
    const light = pixels.data[i] * 0.2126 + pixels.data[i + 1] * 0.7152 + pixels.data[i + 2] * 0.0722;
    const upper = light >= 216;
    const t = Math.max(0, Math.min(1, upper ? (light - 216) / 39 : (light - 90) / 126));
    const from = upper ? custard : shadow, to = upper ? highlight : custard;
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.round(from[channel] * (1 - t) + to[channel] * t);
  }
  c.putImageData(pixels, 0, 0);
  c.save();
  c.globalCompositeOperation = 'source-atop';
  // Thin caramelised patches sit on exposed folds, not over the entire cream.
  const patches = [
    'M-30-8 C-24-5-14-6-9-10 C-15-7-24-10-30-8Z',
    'M5-16 C11-20 15-26 14-30 C18-27 17-19 11-15Z',
    'M-8-31 C-4-36 1-39 6-40 C2-36 0-32-4-29Z',
    'M-17 1 C-7 4 6 1 13-3 C6 4-6 7-17 4Z',
  ];
  c.fillStyle = 'rgba(164,81,20,0.38)';
  for (const patch of patches) c.fill(new Path2D(patch));
  for (const [cx, cy, rx, ry] of [[-19,-9,11,4],[11,-22,6,8],[-2,-34,5,5],[-3,1,14,3]]) {
    for (let i = 0; i < 13; i++) {
      const angle = i * 2.399963;
      const r = Math.sqrt((i + 0.5) / 13);
      const x = cx + Math.cos(angle) * r * rx, y = cy + Math.sin(angle) * r * ry;
      c.fillStyle = i % 3 ? 'rgba(136,67,24,0.48)' : 'rgba(222,139,39,0.7)';
      c.beginPath();
      c.ellipse(x, y, 0.28 + (i % 3) * 0.13, 0.22 + (i % 2) * 0.12, angle, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/**
 * A short, uneven transition at the curved liquid interface. Only the foot is affected:
 * cream absorbs some tea colour, then fades into the real liquid beneath it. The narrow
 * fringe is part of that same edge, not a second oval laid underneath the whole mound.
 */
function settleCreamContact(c: CanvasRenderingContext2D, teaColor: string) {
  const pixels = c.getImageData(0, 0, WIDTH * RESOLUTION, HEIGHT * RESOLUTION);
  const before = new Uint8ClampedArray(pixels.data);
  const tea = [1, 3, 5].map(at => parseInt(teaColor.slice(at, at + 2), 16));
  const stride = pixels.width * 4;
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  for (let px = 0; px < pixels.width; px++) {
    const x = (px + 0.5) / RESOLUTION - ORIGIN_X;
    if (Math.abs(x) >= RX) continue;
    const wallFade = Math.sqrt(1 - (x / RX) ** 2);
    const edge = RX * CUP_SURFACE_RATIO * wallFade
      + (Math.sin(x * 0.42) * 0.3 + Math.sin(x * 0.93) * 0.15) * wallFade;
    const wick = 2.2 * Math.exp(-(((x + 21) / 5) ** 2)) + 1.6 * Math.exp(-(((x - 14) / 6) ** 2));
    const start = edge - 3.8, end = edge + 3 + wick;
    const sampleY = Math.round((ORIGIN_Y + edge - 4.5) * RESOLUTION);
    const sample = sampleY * stride + px * 4;
    for (let py = Math.floor((ORIGIN_Y + start) * RESOLUTION); py < (ORIGIN_Y + end) * RESOLUTION; py++) {
      const y = (py + 0.5) / RESOLUTION - ORIGIN_Y;
      const t = smooth((y - start) / (end - start));
      const i = py * stride + px * 4;
      // Lose the dark cut-out contour at the wet edge, preserving the painted folds above it.
      const wet = smooth((y - (edge - 2.6)) / 3.3);
      const originalAlpha = before[i + 3] / 255;
      const sampleAlpha = before[sample + 3] / 255;
      const alpha = (originalAlpha * (1 - wet) + sampleAlpha * wet) * (1 - t);
      for (let channel = 0; channel < 3; channel++) {
        const cream = before[i + channel] * (1 - wet) + before[sample + channel] * wet;
        pixels.data[i + channel] = Math.round(cream * (1 - t * 0.5) + tea[channel] * t * 0.5);
      }
      pixels.data[i + 3] = Math.round(alpha * 255);
    }
  }
  c.putImageData(pixels, 0, 0);
}

let meltingDensity: Float32Array | undefined;

/** Soft concentration fields, rather than sharp ribbons, model cream diffusing into liquid. */
function creamDensity() {
  if (meltingDensity) return meltingDensity;
  const width = WIDTH * RESOLUTION, height = 56 * RESOLUTION;
  const density = new Float32Array(width * height);
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  const sources = [
    { x: -31, width: 3.8, depth: 28, bend: 4 },
    { x: -17, width: 4.5, depth: 36, bend: -5 },
    { x: 1, width: 2.7, depth: 24, bend: 5 },
    { x: 19, width: 4.1, depth: 32, bend: -4 },
    { x: 32, width: 3, depth: 22, bend: -3 },
  ].map(source => ({ ...source,
    y: RX * CUP_SURFACE_RATIO * Math.sqrt(1 - (source.x / RX) ** 2) - 1,
  }));
  for (let px = 0; px < width; px++) {
    const x = (px + 0.5) / RESOLUTION - ORIGIN_X;
    if (Math.abs(x) >= RX) continue;
    const edge = RX * CUP_SURFACE_RATIO * Math.sqrt(1 - (x / RX) ** 2);
    const bottom = edge + 7.2 + Math.sin(x * 0.16) * 0.65 + Math.sin(x * 0.39 + 1) * 0.3;
    for (let py = 0; py < height; py++) {
      const y = (py + 0.5) / RESOLUTION - 4;
      if (y < edge - 4) continue;
      const cap = 0.97 * (1 - smooth((y - (bottom - 2)) / 4.8));
      let concentration = 0;
      for (const source of sources) {
        const t = (y - source.y) / source.depth;
        if (t < 0 || t > 1) continue;
        const cx = source.x + source.bend * Math.sin(t * Math.PI * 0.85)
          + Math.sin(t * Math.PI * 2.1) * 1.1;
        // The stream blooms gently into a soft cloud before dissolving, instead of
        // narrowing to a pointed flame. A faint offshoot adds irregular marbling.
        const spread = source.width * (1 - t * 0.72) + 1.3
          + 1.2 * Math.exp(-(((t - 0.64) / 0.19) ** 2));
        const dx = (x - cx) / spread;
        const fade = Math.pow(1 - t, 1.05) * (1 - smooth((t - 0.72) / 0.28));
        concentration += (1.9 * Math.exp(-dx * dx * 1.5) + 0.55 * Math.exp(-dx * dx * 8)) * fade;
        const branchX = cx + source.bend * t + Math.sin(t * 9) * 1.5;
        const branch = (x - branchX) / (spread * 0.43);
        concentration += 0.26 * Math.exp(-branch * branch) * Math.sin(t * Math.PI) * fade;
      }
      const plume = 1 - Math.exp(-concentration);
      density[py * width + px] = cap + plume * (1 - cap);
    }
  }
  meltingDensity = density;
  return density;
}

/** A continuous settled cap with shaded volume and translucent, softly feathered mixing trails. */
function meltingArt(id: string, teaColor: string) {
  const key = `${id}:${teaColor}`;
  const cached = melting.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = 56 * RESOLUTION;
  const c = canvas.getContext('2d')!;
  const pixels = c.createImageData(canvas.width, canvas.height);
  const density = creamDensity();
  const cream = id === 'brulee' ? [255, 218, 151] : [255, 246, 225];
  const tea = [1, 3, 5].map(at => parseInt(teaColor.slice(at, at + 2), 16));
  for (let px = 0; px < canvas.width; px++) {
    const x = (px + 0.5) / RESOLUTION - ORIGIN_X;
    const edge = RX * CUP_SURFACE_RATIO * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2));
    for (let py = 0; py < canvas.height; py++) {
      const alpha = density[py * canvas.width + px];
      if (alpha < 0.003) continue;
      const y = (py + 0.5) / RESOLUTION - 4;
      const depth = Math.max(0, y - edge);
      const mix = Math.min(0.48, 0.03 + depth * 0.009 + (1 - alpha) * 0.13);
      // Gentle side lighting and a slightly shaded underside round the cream layer.
      const shade = 1 - (x / RX + 1) * 0.024 - Math.min(1, depth / 12) * 0.024;
      const i = (py * canvas.width + px) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[i + channel] = Math.round(cream[channel] * shade * (1 - mix) + tea[channel] * mix);
      }
      pixels.data[i + 3] = Math.round(alpha * 255);
    }
  }
  c.putImageData(pixels, 0, 0);
  c.scale(RESOLUTION, RESOLUTION);
  c.translate(ORIGIN_X, 4);
  // Sparse shaded microbubbles give the cap a moist, aerated surface, not a flat stripe.
  for (const [x, offset, r] of [[-33,2,0.65],[-24,4,0.4],[-12,2,0.7],[3,4,0.4],[19,2,0.6],[31,3,0.45]]) {
    const y = RX * CUP_SURFACE_RATIO * Math.sqrt(1 - (x / RX) ** 2) + offset;
    const bubble = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    bubble.addColorStop(0, 'rgba(255,255,247,0.65)');
    bubble.addColorStop(0.65, 'rgba(255,250,232,0.15)');
    bubble.addColorStop(1, 'rgba(151,118,72,0.16)');
    c.fillStyle = bubble;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    c.fill();
  }
  melting.set(key, canvas);
  return canvas;
}

/** Bake during the loading screen so a scoop only draws an existing image. */
export function prepareCupCream(id: string, color: string, sprite: CanvasImageSource) {
  creamDensity();
  creamArt(id, color, sprite);
}

export function paintCupCream(c: CanvasRenderingContext2D, level: number, id: string, color: string, sprite: CanvasImageSource, teaColor?: string) {
  const { x, y, w, h } = creamBox(level);
  if (teaColor && level > 0) {
    const surface = creamSurface(level);
    const scale = surface.rx / RX;
    c.save();
    c.clip(new Path2D(cupFillPath(level)));
    c.drawImage(meltingArt(id, teaColor), 56.5 - ORIGIN_X * scale, surface.y - 4 * scale,
      WIDTH * scale, 56 * scale);
    c.restore();
  }
  c.drawImage(creamArt(id, color, sprite, teaColor), x, y, w, h);
}

/** Lift the mound as the cup fills; its curved lower edge still overlaps the tea. */
export function creamSurface(level: number) {
  const surface = cupSurface(level);
  return { ...surface, y: surface.y - 8 * pourLevel(level) };
}

/** Cream keeps the tea's width and perspective while standing mostly above the rim at full. */
export function creamBox(level: number) {
  const surface = creamSurface(level);
  const scale = surface.rx / RX;
  const foot = Math.min(surface.y, CUP_ART.h - (HEIGHT - ORIGIN_Y) * scale - 1);
  return { x: 56.5 - ORIGIN_X * scale, y: foot - ORIGIN_Y * scale, w: WIDTH * scale, h: HEIGHT * scale };
}
