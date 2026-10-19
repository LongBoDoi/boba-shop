import { CUP_ART, CUP_FLOOR_FRONT, cupSurface } from '../art/cupGeometry';
import { blend, shade } from './color';

const RX = 42;
const WIDTH = 104, HEIGHT = 80, ORIGIN_X = 52, ORIGIN_Y = 60;
/**
 * How much room a mound needs above the cup's own box, as a fraction of its height. Cream is piped
 * to its full height onto wherever the tea stands, so on a full cup the peak is over the rim and
 * the sprite's top edge is not the top of the picture: `cupPainter` paints into a texture this much
 * taller, and `CupView` draws it lifted by the same amount. `check-cup-contents.cjs` holds it
 * against `creamBox`, because a texture half a mound too short shears the peak flat in silence.
 */
export const CUP_OVERFLOW = 24 / CUP_ART.h;
const RESOLUTION = 4;
const creams = new Map<string, HTMLCanvasElement>();

/** A continuous piped spiral, baked once per flavour for the shared web/app cup painter. */
function creamArt(id: string, color: string): HTMLCanvasElement {
  const key = `${id}:${color}`;
  const cached = creams.get(key);
  if (cached) return cached;
  const toasted = id === 'brulee';
  const base = blend(color, '#FFF9EC', toasted ? 0.72 : 0.3);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;
  const c = canvas.getContext('2d')!;
  c.scale(RESOLUTION, RESOLUTION);
  c.translate(ORIGIN_X, ORIGIN_Y);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // The broad bottom turn touches the tea; the following turns overlap it as one narrowing ribbon.
  const coils = [
    {
      top: -14, bottom: 13,
      shape: 'M-39 0 C-44-6-28-13-9-14 C12-16 34-11 40-5 C47 1 37 8 24 11 C4 16-25 13-38 7 C-41 5-43 2-39 0Z',
      fold: 'M-34 1 C-22 10 9 10 27 2 C34-1 33-5 27-7',
      ridges: ['M-31-5 C-37-1-30 5-22 7', 'M-16-10 C-25-6-18 3-8 6', 'M6-11 C-5-6 3 2 12 4'],
      toast: [-23, -3, 11, 5],
    },
    {
      top: -28, bottom: -3,
      shape: 'M-29-13 C-34-19-20-26-3-28 C15-30 29-24 31-18 C35-11 22-5 8-3 C-9 0-25-5-29-13Z',
      fold: 'M-24-13 C-14-5 9-6 23-15 C29-19 20-23 13-24',
      ridges: ['M-18-22 C-26-18-18-10-10-9', 'M-1-26 C-12-21-6-12 3-11', 'M16-23 C7-20 12-13 18-13'],
      toast: [13, -17, 10, 5],
    },
    {
      top: -39, bottom: -18,
      shape: 'M-19-26 C-24-31-13-38-3-39 C9-41 21-34 22-29 C25-23 11-18 1-18 C-9-17-18-21-19-26Z',
      fold: 'M-15-26 C-7-19 9-21 16-28 C20-31 10-35 6-35',
      ridges: ['M-9-35 C-16-32-10-25-4-24', 'M5-37 C-3-33 1-26 7-25'],
      toast: [-4, -29, 8, 4],
    },
    {
      top: -49, bottom: -30,
      shape: 'M-8-34 C-10-39 0-40 4-43 C7-46 3-48 2-49 C12-47 17-41 12-36 C8-31-1-29-6-31Z',
      fold: 'M-4-35 C5-34 12-40 7-44',
      ridges: ['M-2-40 C-5-37-1-34 3-35'],
      toast: [7, -40, 4, 3],
    },
  ];

  c.save();
  c.scale(1, 0.25);
  const contact = c.createRadialGradient(0, 28, 4, 0, 28, 43);
  contact.addColorStop(0, 'rgba(95,60,32,0.22)');
  contact.addColorStop(1, 'rgba(95,60,32,0)');
  c.fillStyle = contact;
  c.fillRect(-46, 8, 92, 45);
  c.restore();

  for (const [index, coil] of coils.entries()) {
    const shape = new Path2D(coil.shape);
    const volume = c.createLinearGradient(-17, coil.top, 13, coil.bottom);
    volume.addColorStop(0, '#FFFDF3');
    volume.addColorStop(0.3, shade(base, 32));
    volume.addColorStop(0.66, base);
    volume.addColorStop(0.9, blend(base, '#BDA174', 0.25));
    volume.addColorStop(1, blend(base, '#AD8E61', 0.34));
    c.save();
    c.shadowColor = 'rgba(128,95,55,0.2)';
    c.shadowBlur = 2.2;
    c.shadowOffsetY = 1.4;
    c.fillStyle = volume;
    c.fill(shape);
    c.restore();

    c.save();
    c.clip(shape);
    // A shaded winding crease and raised nozzle ridges make the turns read as piped cream.
    c.strokeStyle = toasted ? 'rgba(168,111,44,0.25)' : 'rgba(173,145,100,0.2)';
    c.lineWidth = 1.6;
    c.stroke(new Path2D(coil.fold));
    c.save();
    c.translate(-0.3, -1.1);
    c.strokeStyle = 'rgba(255,255,247,0.86)';
    c.lineWidth = 1.35;
    c.stroke(new Path2D(coil.fold));
    c.restore();
    for (const ridge of coil.ridges) {
      c.strokeStyle = 'rgba(255,255,249,0.66)';
      c.lineWidth = 1.8;
      c.stroke(new Path2D(ridge));
    }
    if (toasted) {
      const [x, y, rx, ry] = coil.toast;
      c.save();
      c.translate(x, y);
      c.scale(rx, ry);
      const caramel = c.createRadialGradient(-0.1, -0.2, 0.05, 0, 0, 1);
      caramel.addColorStop(0, 'rgba(186,107,27,0.42)');
      caramel.addColorStop(0.55, 'rgba(216,153,65,0.28)');
      caramel.addColorStop(1, 'rgba(230,168,67,0)');
      c.fillStyle = caramel;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
      for (let i = 0; i < 11; i++) {
        const x = ((i * 0.618034 + index * 0.27) % 1 - 0.5) * (80 - index * 18);
        const y = coil.top + 4 + ((i * 0.414214) % 1) * (coil.bottom - coil.top - 5);
        c.fillStyle = i % 3 ? 'rgba(160,95,35,0.3)' : 'rgba(255,237,183,0.8)';
        c.beginPath();
        c.ellipse(x, y, 0.28 + (i % 3) * 0.08, 0.2, -0.4, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }
  creams.set(key, canvas);
  return canvas;
}

/**
 * Keep the upright spiral's proportions, with its foot on the tea wherever the tea happens to be.
 * Nothing shortens it to fit: piped onto a full cup the peak stands clear of the rim, which is what
 * the painter's headroom (`CUP_OVERFLOW`) is for.
 */
export function paintCupCream(c: CanvasRenderingContext2D, level: number, id: string, color: string) {
  const { x, y, w, h } = creamBox(level);
  c.drawImage(creamArt(id, color), x, y, w, h);
}

/** Where the baked spiral is drawn, in the cup's own coordinates: the whole image box. */
export function creamBox(level: number) {
  const surface = cupSurface(level);
  const scale = (surface.rx - 2) / RX;
  // It stands on the tea, and on the floor of a cup with nothing in it.
  const foot = Math.min(surface.y, CUP_FLOOR_FRONT - 14 * scale - 1);
  return { x: 56.5 - ORIGIN_X * scale, y: foot - ORIGIN_Y * scale, w: WIDTH * scale, h: HEIGHT * scale };
}
