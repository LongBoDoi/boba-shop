import { cupSurface, CUP_SURFACE_RATIO } from '../art/cupGeometry';
import { shade } from './color';

/** A soft foam cap seen from above, with a shallow piped spiral and caramel flecks. */
export function paintCupCream(c: CanvasRenderingContext2D, level: number, id: string) {
  const s = cupSurface(level);
  c.save();
  c.translate(s.x, s.y - 1.5);
  c.scale(1, CUP_SURFACE_RATIO);
  const radius = s.rx - 1;
  const base = id === 'brulee' ? '#F6D69A' : '#FFF1D0';
  const cream = c.createRadialGradient(-radius * 0.3, -radius * 0.4, 1, 0, 0, radius);
  cream.addColorStop(0, '#FFF9E7'); cream.addColorStop(0.66, base); cream.addColorStop(1, shade(base, -30));
  c.fillStyle = cream;
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.fill();
  c.save(); c.clip();
  if (id === 'brulee') {
    for (const [u, v, size] of [[-0.46, -0.34, 0.23], [0.32, -0.23, 0.3], [-0.18, 0.46, 0.25], [0.55, 0.4, 0.17]]) {
      const x = u * radius, y = v * radius, r = size * radius;
      const toasted = c.createRadialGradient(x, y, 0, x, y, r);
      toasted.addColorStop(0, '#AC581E80'); toasted.addColorStop(0.5, '#D5913859'); toasted.addColorStop(1, '#E4A54F00');
      c.fillStyle = toasted; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
  // Each fold follows the surface plane, rather than standing upright in front of the drink.
  c.lineCap = 'round';
  for (const [offset, color, width] of [[0, '#B9946638', 3.7], [-1.4, '#FFFDF1D9', 2.2]] as const) {
    c.beginPath();
    for (let i = 0; i <= 180; i++) {
      const t = i / 180, a = t * Math.PI * 5.3 - 0.7;
      const r = radius * (0.78 * (1 - t) + 0.045);
      const x = Math.cos(a) * r, y = Math.sin(a) * r + offset;
      if (!i) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.lineWidth = width; c.strokeStyle = color; c.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 2.399963, r = Math.sqrt((i + 0.5) / 40) * radius * 0.91;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    c.fillStyle = id === 'brulee' ? (i % 3 ? '#A85E2B9C' : '#DA943FCC') : '#C7A57545';
    c.beginPath(); c.ellipse(x, y, i % 4 === 0 ? 1.4 : 0.65, 0.6, a, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.lineWidth = 0.7; c.strokeStyle = '#BA955D66';
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke();
  c.restore();
}
