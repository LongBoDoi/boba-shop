import { cupSurface, CUP_FLOOR_FRONT } from '../art/cupGeometry';
import { createRng } from '../game/random';
import { Tea } from '../game/ingredients';
import { blend, shade } from './color';

const paintings = new Map<string, HTMLCanvasElement>();
const TAU = Math.PI * 2;
/** Concentrated pigment and transmitted light sampled visually from the six painted tanks. */
const PALETTES: Record<string, [string, string]> = {
  black: ['#A94310', '#F39C36'], green: ['#809E17', '#CFDA61'],
  thai: ['#EB6710', '#FFC34C'], oolong: ['#C17A10', '#F4BE3E'],
  taro: ['#A16CC3', '#DCA7ED'], matcha: ['#598316', '#B0CA51'],
};

export function cupTeaTint(tea: Tea, milk?: string) {
  const pigment = PALETTES[tea.id]?.[0] ?? tea.color;
  // Milk softens the concentrated tea instead of replacing it with the pale menu swatch.
  return milk ? blend(blend(pigment, tea.milkyColor, 0.42), milk, 0.04) : pigment;
}

export function cupTeaGlow(tea: Tea, milk?: string) {
  return milk ? shade(cupTeaTint(tea, milk), 26) : PALETTES[tea.id]?.[1] ?? shade(tea.color, 35);
}

/** Layered pigment and broken brush edges, baked once rather than randomised each frame. */
function pigment(tint: string, milky: boolean) {
  const key = `${tint}:${milky}`;
  const known = paintings.get(key);
  if (known) return known;
  const canvas = document.createElement('canvas');
  canvas.width = 452; canvas.height = 696;
  const c = canvas.getContext('2d')!;
  c.scale(4, 4);
  const rng = createRng(parseInt(tint.slice(1), 16));
  // Wide, translucent washes interleave with smaller dry-brush marks. No repeating tile.
  for (let i = 0; i < 65; i++) {
    const x = rng.next() * 113, y = rng.next() * 174;
    const rx = 3 + rng.next() * 17, ry = 2 + rng.next() * 13;
    c.save();
    c.translate(x, y); c.rotate(rng.next() * 2 - 1); c.scale(rx, ry);
    const g = c.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    const color = i % 3 ? shade(tint, -46) : blend(shade(tint, 64), '#FFE4A4', 0.25);
    g.addColorStop(0, color + (milky ? '23' : '38'));
    g.addColorStop(0.65, color + '0E');
    g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2);
    c.restore();
  }
  for (let i = 0; i < 180; i++) {
    const x = rng.next() * 113, y = rng.next() * 174;
    const length = 1 + rng.next() * 5;
    c.strokeStyle = i % 3 ? shade(tint, -40) + '18' : '#FFF2C426';
    c.lineWidth = 0.3 + rng.next() * 0.85;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y); c.quadraticCurveTo(x + length * 0.3, y - 0.6, x + length, y + 0.5); c.stroke();
  }
  // Fine irregular pigment, subtle enough to stay painterly at phone scale.
  for (let i = 0; i < 650; i++) {
    c.fillStyle = i % 2 ? shade(tint, -30) + '24' : '#FFF0C22C';
    const r = 0.13 + rng.next() * 0.32;
    c.beginPath(); c.ellipse(rng.next() * 113, rng.next() * 174, r * 1.5, r, rng.next(), 0, TAU); c.fill();
  }
  paintings.set(key, canvas);
  return canvas;
}

/** Called inside the liquid mask, before solids and glass. The painted body keeps its own depth. */
export function paintTeaBody(c: CanvasRenderingContext2D, level: number, tint: string, milky: boolean,
  ambient: number, agitation: number) {
  const s = cupSurface(level), height = CUP_FLOOR_FRONT - s.y;
  const phase = ambient * TAU;
  c.save();
  c.drawImage(pigment(tint, milky), -2 + Math.sin(phase) * 1.5,
    -2 + Math.cos(phase) * 1.5, 117, 178);

  // Broad reflected light sweeps around the round liquid volume, as in the tanks.
  for (let i = 0; i < 2; i++) {
    const p = phase + i * 2.1;
    const y = s.y + height * (0.36 + i * 0.38);
    const drift = Math.sin(p) * (3 + agitation * 4);
    const left = 56.5 - s.rx, right = 56.5 + s.rx;
    const g = c.createLinearGradient(left, y, right, y + height * 0.15);
    const glow = blend(shade(tint, 68), '#FFE0A1', milky ? 0.12 : 0.28);
    g.addColorStop(0, glow + '00');
    g.addColorStop(0.32, glow);
    g.addColorStop(0.74, glow + '90');
    g.addColorStop(1, glow + '00');
    c.strokeStyle = g; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(left - 4, y + 14 + drift);
    c.bezierCurveTo(45, y - 13 + drift, 65, y + 17 - drift, right + 4, y - 19);
    // Successive transparent brush widths feather the wash without a per-frame blur filter.
    for (const [width, alpha] of [[18, 0.035], [12, 0.055], [7, 0.07], [3, 0.04]]) {
      c.lineWidth = width;
      c.globalAlpha = alpha * (milky ? 0.65 : 1);
      c.stroke();
    }
  }
  // Tiny suspended highlights travel slowly and fade at both ends of each cycle.
  // Milk gets diffuse flecks rather than sharply outlined bubbles.
  for (let i = 0; i < 7; i++) {
    const t = (ambient + i * 0.147) % 1;
    const x = 31 + (i * 19 % 51) + Math.sin(phase + i) * 2;
    const y = s.y + s.ry + 5 + (height - s.ry - 12) * (1 - t);
    if (height < 22) continue;
    c.globalAlpha = Math.sin(t * Math.PI) ** 2 * (milky ? 0.15 : 0.32);
    c.fillStyle = '#FFEAC0';
    c.beginPath(); c.ellipse(x, y, 0.5 + i % 3 * 0.25, 0.4 + i % 2 * 0.25, 0, 0, TAU); c.fill();
    if (!milky && i % 3 === 0) {
      c.strokeStyle = '#FFF5DC'; c.lineWidth = 0.3; c.stroke();
    }
  }
  c.restore();
}

/** Short curved glints, fine edge bubbles and a quiet moving sheen on the surface oval. */
export function paintTeaSurface(c: CanvasRenderingContext2D, level: number, tint: string, milky: boolean,
  ambient: number, agitation: number) {
  const s = cupSurface(level);
  c.save();
  c.beginPath(); c.ellipse(56.5, s.y, s.rx - 0.25, s.ry, 0, 0, TAU); c.clip();
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const t = ambient * TAU + i * 1.9;
    c.globalAlpha = 0.2 + 0.08 * Math.sin(t);
    c.strokeStyle = i % 2 ? shade(tint, -24) : '#FFF1C9';
    c.lineWidth = i === 0 ? 1.4 : 0.7;
    c.beginPath();
    c.ellipse(56.5 + Math.sin(t) * 3, s.y + Math.cos(t) * 0.6,
      s.rx * (0.48 + i * 0.16), s.ry * (0.36 + i * 0.15), 0, 0.1 + i * 1.8, 1.45 + i * 1.8);
    c.stroke();
  }
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.16 + i * 0.064);
    const x = 56.5 + Math.cos(a) * (s.rx - 2);
    const y = s.y + Math.sin(a) * (s.ry - 0.9);
    const r = 0.35 + (i * 7 % 5) * 0.15;
    c.globalAlpha = (milky ? 0.22 : 0.38) + agitation * 0.12;
    c.strokeStyle = '#FFF0C4'; c.lineWidth = 0.4;
    c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, TAU); c.stroke();
  }
  c.restore();
}
