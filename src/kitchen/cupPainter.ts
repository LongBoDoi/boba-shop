import { Drink, getIngredient, ICE_LEVELS, Tea, Topping } from '../game/ingredients';
import { CUP_ART, CUP_MOUTH, CUP_SURFACE_RATIO, cupPlanePosition, cupSurface, pourLevel } from '../art/cupGeometry';
import { IcePlacement } from '../art/iceLayout';
import { blend, shade } from './color';
import { paintCupCream } from './creamPainter';

export interface CupFrame {
  drink: Drink;
  level: number;
  iceLayout: IcePlacement[];
  iceSettle: number[];
  portionSettle: number[];
  phase: number;
  agitation: number;
}

const { w: W, h: H } = CUP_ART;
const TAU = Math.PI * 2;
const BODY = 'M5 42 C6 22 28 6 56.5 6 C85 6 107 22 108 42 L94 93 C92 107 78 117 56.5 117 C35 117 21 107 19 93Z';
const WELL = new Path2D('M10 42 A46.5 32 0 0 1 103 42 L91 89 A34.5 23 0 0 1 22 89Z');

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
}

/** Crisp Canvas art at device density. Every ingredient uses the same overhead projection. */
export class CupPainter {
  readonly canvas = document.createElement('canvas');
  private readonly c: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.c = this.canvas.getContext('2d')!;
  }

  paint(frame: CupFrame) {
    const c = this.c;
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    this.glassBody();

    const { drink } = frame;
    const tea = drink.tea ? getIngredient('tea', drink.tea) as Tea : undefined;
    const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
    const tint = tea ? (milk ? blend(tea.milkyColor, milk.color, 0.12) : tea.color) : milk?.color;
    const level = tint ? pourLevel(frame.level) : 0;
    c.save(); c.clip(WELL);
    if (tint && level > 0) this.liquid(tint, level, frame);
    this.toppings(frame, level, tint, Boolean(milk));
    this.ice(frame, level, tint);
    if (drink.foam && drink.foam !== 'none') paintCupCream(c, level, drink.foam);
    c.restore();
    this.frontGlass();
  }

  private glassBody() {
    const c = this.c;
    const glass = c.createLinearGradient(5, 35, 106, 100);
    glass.addColorStop(0, '#FFFCF17A'); glass.addColorStop(0.35, '#F2ECE126');
    glass.addColorStop(0.8, '#DBD3C252'); glass.addColorStop(1, '#99867259');
    c.fillStyle = glass; c.fill(new Path2D(BODY));
    c.strokeStyle = '#988575'; c.lineWidth = 1.3; c.stroke(new Path2D(BODY));
    // Through the open mouth, the inset floor is visibly smaller than the rim.
    const floor = c.createRadialGradient(46, 79, 2, 56.5, 86, 36);
    floor.addColorStop(0, '#FFFBEE22'); floor.addColorStop(0.82, '#C8B9A72B'); floor.addColorStop(1, '#8C79644D');
    oval(c, 56.5, 86, 34, 34 * CUP_SURFACE_RATIO);
    c.fillStyle = floor; c.fill(); c.strokeStyle = '#A99B8666'; c.lineWidth = 1; c.stroke();
    // Back rim first; the near rim is redrawn over the contents.
    oval(c, CUP_MOUTH.x, CUP_MOUTH.y, 51, 35);
    c.strokeStyle = '#A6927D'; c.lineWidth = 1.9; c.stroke();
    oval(c, CUP_MOUTH.x, CUP_MOUTH.y - 0.8, 49.5, 34);
    c.strokeStyle = '#FFFDF4'; c.lineWidth = 2.8; c.stroke();
    oval(c, CUP_MOUTH.x, CUP_MOUTH.y, 47.7, 32.8);
    c.strokeStyle = '#B5A795A6'; c.lineWidth = 0.85; c.stroke();
  }

  private liquid(tint: string, level: number, frame: CupFrame) {
    const c = this.c, s = cupSurface(level);
    // The short visible front wall retains the drink's color under the open surface.
    const body = new Path2D(`M${s.x - s.rx} ${s.y} A${s.rx} ${s.ry} 0 0 1 ${s.x + s.rx} ${s.y} L91 89 A34.5 23 0 0 1 22 89Z`);
    const depth = c.createLinearGradient(0, s.y, 0, 113);
    depth.addColorStop(0, shade(tint, -6)); depth.addColorStop(1, shade(tint, -34));
    c.fillStyle = depth; c.globalAlpha = 0.85; c.fill(body); c.globalAlpha = 1;
    const surface = c.createRadialGradient(s.x - s.rx * 0.35, s.y - s.ry * 0.4, 1, s.x, s.y, s.rx);
    surface.addColorStop(0, shade(tint, 32)); surface.addColorStop(0.64, tint); surface.addColorStop(1, shade(tint, -28));
    oval(c, s.x, s.y, s.rx, s.ry);
    c.fillStyle = surface; c.fill(); c.strokeStyle = shade(tint, -26); c.lineWidth = 0.75; c.stroke();
    c.save(); c.clip();
    c.strokeStyle = '#FFF3D6'; c.lineWidth = 1; c.globalAlpha = 0.38;
    c.beginPath(); c.ellipse(s.x - 5, s.y - 2, s.rx * 0.82, s.ry * 0.82, 0, 3.4, 4.6); c.stroke();
    if (frame.agitation > 0.001) {
      for (const offset of [0, 0.5]) {
        const p = (frame.phase + offset) % 1;
        c.globalAlpha = Math.sin(p * Math.PI) * (1 - p) * frame.agitation * 0.6;
        oval(c, s.x, s.y, s.rx * (0.1 + p * 0.8), s.ry * (0.1 + p * 0.8)); c.stroke();
      }
    }
    // A few tiny meniscus bubbles follow the back edge of the ellipse.
    for (let i = 0; i < 7; i++) {
      const a = 3.7 + i * 0.22;
      oval(c, s.x + Math.cos(a) * s.rx * 0.91, s.y + Math.sin(a) * s.ry * 0.9, 0.5 + i % 2 * 0.25, 0.45);
      c.globalAlpha = 0.35; c.stroke();
    }
    c.restore();
  }

  private toppings(frame: CupFrame, level: number, tint: string | undefined, milky: boolean) {
    const c = this.c;
    frame.drink.toppings.forEach((id, portion) => {
      const option = getIngredient('toppings', id) as Topping | undefined;
      if (!option) return;
      const progress = frame.portionSettle[portion] ?? 1;
      // A scattered disk on the floor, rather than rows on an upright front wall.
      for (let i = 0; i < 17; i++) {
        const a = i * 2.399963 + portion * 1.7;
        const pearl = option.shape === 'pearl';
        const r = Math.sqrt((i + 0.5) / 17) * (pearl ? 0.72 : 0.78);
        const p = cupPlanePosition(0, Math.cos(a) * r, Math.sin(a) * r, pearl ? 0.24 : 0.21);
        const radius = 4.4 + i % 3 * 0.45;
        c.save(); c.translate(p.x, p.y - (1 - progress) * 12);
        // Pearl centers follow the floor; their spherical bodies retain their roundness.
        c.scale(1 + (1 - progress) * 0.15, pearl ? 0.93 : CUP_SURFACE_RATIO);
        c.rotate(((i * 37 + portion * 53) % 85 - 40) * Math.PI / 180);
        const opacity = tint && level > 0 ? (milky ? 0.38 : 0.76) : 1;
        c.globalAlpha = opacity;
        const color = tint && level > 0 ? blend(option.color, tint, milky ? 0.3 : 0.14) : option.color;
        const paint = c.createRadialGradient(-radius * 0.3, -radius * 0.4, 0.2, 0, 0, radius * 1.2);
        paint.addColorStop(0, shade(color, 38)); paint.addColorStop(0.46, color); paint.addColorStop(1, shade(color, -27));
        c.fillStyle = '#3E2B1C29'; oval(c, 0.8, 1.2, radius + 0.5, radius); c.fill();
        c.fillStyle = paint; c.strokeStyle = shade(color, -24); c.lineWidth = 0.65;
        c.beginPath();
        if (option.shape === 'cube') c.roundRect(-radius, -radius * 0.86, radius * 2, radius * 1.72, id === 'pudding' ? 1.8 : 0.9);
        else c.ellipse(0, 0, radius, radius * (id === 'redbean' ? 0.66 : 1), 0, 0, TAU);
        c.fill(); c.stroke();
        c.strokeStyle = '#FFF8DA99'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-radius * 0.55, -radius * 0.15); c.quadraticCurveTo(-radius * 0.55, -radius * 0.6, 0, -radius * 0.6); c.stroke();
        if (id === 'redbean') {
          c.strokeStyle = '#521B1899'; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(-2, 1); c.quadraticCurveTo(0, -1.5, 2, -1); c.stroke();
        }
        c.restore();
      }
    });
  }

  private ice(frame: CupFrame, level: number, tint?: string) {
    const count = ICE_LEVELS.find(option => option.id === frame.drink.ice)?.cubes ?? 0;
    const c = this.c, s = cupSurface(level);
    frame.iceLayout.slice(0, count).forEach((cube, i) => {
      const p = cupPlanePosition(level, cube.u, cube.v, cube.r);
      const fall = 1 - (frame.iceSettle[i] ?? 1);
      const r = cube.r * s.rx;
      c.save(); c.translate(p.x, p.y - fall * 10);
      c.scale(1, CUP_SURFACE_RATIO); c.rotate((cube.angle - fall * 12) * Math.PI / 180);
      // Almost all of the visible ice is its top face, with just a thin melted lower edge.
      const shape = new Path2D(); shape.roundRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.27);
      c.save(); c.translate(1, 2); c.fillStyle = '#3F55522E'; c.fill(shape); c.restore();
      const ice = c.createLinearGradient(-r, -r, r, r);
      ice.addColorStop(0, '#FCFFFFED'); ice.addColorStop(0.35, '#D5E9E4C9');
      ice.addColorStop(0.7, tint && level > 0 ? blend('#E6F4EF', tint, 0.22) + 'C9' : '#D0E4E6BF');
      ice.addColorStop(1, '#9BBDB7C9');
      c.fillStyle = ice; c.fill(shape); c.strokeStyle = '#728F888F'; c.lineWidth = 0.8; c.stroke(shape);
      c.strokeStyle = '#FFFFFFE6'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-r * 0.5, r * 0.18); c.lineTo(-r * 0.5, -r * 0.32); c.quadraticCurveTo(-r * 0.5, -r * 0.5, -r * 0.25, -r * 0.5); c.lineTo(r * 0.22, -r * 0.5); c.stroke();
      c.strokeStyle = '#F6FFFA88'; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(r * 0.25, r * 0.05); c.lineTo(0, r * 0.2); c.lineTo(-r * 0.1, r * 0.4); c.stroke();
      c.restore();
    });
  }

  private frontGlass() {
    const c = this.c;
    // Reflections continue down the short front wall; the mouth stays open and readable.
    c.strokeStyle = '#FFFFF1B3'; c.lineWidth = 2.7;
    c.beginPath(); c.moveTo(15, 61); c.quadraticCurveTo(19, 87, 29, 103); c.stroke();
    c.strokeStyle = '#FFFAE780'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(100, 60); c.lineTo(89, 97); c.stroke();
    c.beginPath(); c.ellipse(56.5, 42, 51, 35, 0, 0, Math.PI);
    c.strokeStyle = '#A99682'; c.lineWidth = 2.2; c.stroke();
    c.beginPath(); c.ellipse(56.5, 41.3, 49.5, 34, 0, 0, Math.PI);
    c.strokeStyle = '#FFFEF5'; c.lineWidth = 2.1; c.stroke();
    // A small cat print follows the foreshortened front face instead of filling the opening.
    c.save(); c.translate(56.5, 99); c.scale(0.64, 0.42);
    c.fillStyle = '#FFF4DEDD'; c.strokeStyle = '#725141'; c.lineWidth = 1.9;
    const cat = new Path2D('M-13 2 L-12-12 Q-9-16-5-9 Q0-11 5-9 Q10-16 12-12 L13 2 Q13 12 0 12 Q-13 12-13 2Z');
    c.fill(cat); c.stroke(cat);
    c.fillStyle = '#725141'; oval(c, -5, 1, 1.2, 1.5); c.fill(); oval(c, 5, 1, 1.2, 1.5); c.fill();
    c.beginPath(); c.moveTo(-2, 5); c.quadraticCurveTo(0, 7, 2, 5); c.lineWidth = 1.2; c.stroke();
    c.restore();
  }
}
