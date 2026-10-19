import { Drink, getIngredient, ICE_LEVELS, Tea, Topping } from '../game/ingredients';
import {
  CUP_ART,
  CUP_FLOOR_EDGE,
  CUP_FLOOR_FRONT,
  CUP_FRONT_GLINTS,
  CUP_ICE_WELL,
  CUP_REAR_FLOOR_GLASS,
  CUP_WELL,
  cupFillPath,
  cupIceFillPath,
  cupIceOutlinePath,
  cupIcePosition,
  cupIceRestPosition,
  cupLiquidPath,
  cupSurface,
  cupToppingPosition,
} from '../art/cupGeometry';
import { IcePlacement } from '../art/iceLayout';
import { TOPPING_PIECE_ART } from '../art/toppingArt';
import { blend, shade } from './color';

/**
 * The drink in the cup, painted with the browser's 2D canvas into one texture.
 *
 * The glass, the tea, the ice and the pile of toppings, all in the 113×174 sprite space the
 * design draws them in and all placed by the shared geometry (`cupGeometry.ts`, `iceLayout.ts`).
 * The cup used to be a tree of a few hundred vector nodes a renderer had to keep and
 * re-composite; here it is one picture, repainted only while something in it is actually moving (a
 * pour, a portion landing, ice settling) and blitted as it stands the rest of the time.
 *
 * The moving boundaries that had to be masks there (the tea's edge splitting the glass and the
 * ice) are canvas clips here, which are cheap and move freely.
 */
export interface CupImages {
  /** The painted cup, whose glass is drawn over and under the drink. */
  sprite: CanvasImageSource;
  /** Clear ice texture, faint on each cube. */
  ice: CanvasImageSource;
  /** The toppings' piece atlas. */
  pieces: CanvasImageSource;
  /** The tea's painted body and surface, by tea id; plain and milky. */
  drink: (teaId: string, milky: boolean) => { body?: CanvasImageSource; top?: CanvasImageSource };
}

export interface CupFrame {
  drink: Drink;
  /** Live fill, 0 and up. */
  level: number;
  iceLayout: IcePlacement[];
  /** How far each cube has dropped into place, 0–1, by its index in the layout. */
  iceSettle: number[];
  /** How far each portion of topping has dropped into place, 0–1, by its index in `toppings`. */
  portionSettle: number[];
  /** The pour's ripple clock, 0–1, and how stirred up the surface is, 0–1. */
  phase: number;
  agitation: number;
}

const W = CUP_ART.w;
const H = CUP_ART.h;
const BOX = `M0 0H${W}V${H}H0Z`;
/**
 * How much of the painted glass reads through the tea. `KitchenCup` asks for 22%, but the web build
 * players know drew none — its filled-glass mask never painted in a browser — and the tea there is
 * the clear, saturated colour the shop is played with. That is the picture kept.
 */
const GLASS_FILLED_ALPHA = 0;

// ------------------------------------------------------------------ paths, parsed once
const pathCache = new Map<string, Path2D>();
function path(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    // Live paths change every frame; keep the cache from growing without bound.
    if (pathCache.size > 400) pathCache.clear();
    pathCache.set(d, p);
  }
  return p;
}
const WELL = new Path2D(CUP_WELL);
const ICE_WELL = new Path2D(CUP_ICE_WELL);
const REAR_FLOOR = new Path2D(CUP_REAR_FLOOR_GLASS);
const FLOOR_EDGE = new Path2D(CUP_FLOOR_EDGE);

// ------------------------------------------------------------------ the toppings' bed
const BED = [
  { row: 0, x: 34, depth: 0.18, lift: 11, size: 0.81 },
  { row: 0, x: 45, depth: 0.12, lift: 10, size: 0.85 },
  { row: 0, x: 56, depth: 0.22, lift: 12, size: 0.8 },
  { row: 0, x: 67, depth: 0.17, lift: 10, size: 0.86 },
  { row: 0, x: 78, depth: 0.24, lift: 11, size: 0.83 },
  { row: 1, x: 29, depth: 0.52, lift: 5, size: 0.91 },
  { row: 1, x: 40, depth: 0.58, lift: 5.5, size: 0.94 },
  { row: 1, x: 51, depth: 0.48, lift: 6, size: 0.9 },
  { row: 1, x: 62, depth: 0.62, lift: 5, size: 0.97 },
  { row: 1, x: 73, depth: 0.53, lift: 5.5, size: 0.91 },
  { row: 1, x: 83, depth: 0.6, lift: 5, size: 0.95 },
  { row: 2, x: 30, depth: 0.91, lift: 0, size: 0.97 },
  { row: 2, x: 41, depth: 0.95, lift: 0.5, size: 1.03 },
  { row: 2, x: 52, depth: 1, lift: 0, size: 1 },
  { row: 2, x: 63, depth: 0.94, lift: 0.3, size: 1.05 },
  { row: 2, x: 74, depth: 0.98, lift: 0, size: 0.96 },
  { row: 2, x: 84, depth: 0.9, lift: 0.2, size: 0.93 },
];
const BANDS = [...new Set(BED.map((spot) => spot.row))];

interface Piece { cx: number; cy: number; rx: number; ry: number; angle: number; opacity: number; shadow: number }
interface Band { pieces: Piece[]; wash: number; outline: Path2D }
interface Portion { id: string; bands: Band[] }

const portionCache = new Map<string, Portion>();
/** Where a portion's seventeen pieces sit — `CupToppings`' arithmetic, unchanged. */
function portionFor(id: string, portion: number): Portion {
  const key = `${id}:${portion}`;
  const known = portionCache.get(key);
  if (known) return known;
  const option = getIngredient('toppings', id) as Topping | undefined;
  const cube = option?.shape === 'cube';
  const art = TOPPING_PIECE_ART.cells[id];
  const aspect = art ? art.width / art.height : 1;
  const seed = [...id].reduce((value, letter) => value + letter.charCodeAt(0), 0);
  const pieces = BED.map((spot, i) => {
    const jitter = ((seed + i * 7) % 5 - 2) * 0.55;
    const rx = (cube ? 5.3 : 5.8) * spot.size;
    const ry = rx / aspect;
    const angle = cube ? ((seed + i * 11) % 37) - 18 : 0;
    const { cx, cy } = cupToppingPosition(spot.x + jitter, rx, ry, angle,
      spot.lift + portion * 12.5 + ((seed + i * 3) % 4) * 0.4);
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const at = (px: number, py: number) =>
      `${(cx + px * cos - py * sin).toFixed(2)} ${(cy + px * sin + py * cos).toFixed(2)}`;
    return {
      row: spot.row,
      piece: { cx, cy, rx, ry, angle, opacity: 0.8 + spot.depth * 0.2, shadow: 0.08 + spot.depth * 0.1 },
      wash: 1.25 - spot.depth * 0.55,
      silhouette: cube
        ? `M${at(-rx, -ry * 0.5)} L${at(0, -ry)} L${at(rx, -ry * 0.5)} L${at(rx, ry * 0.55)} L${at(0, ry)} L${at(-rx, ry * 0.55)}Z`
        : `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`,
    };
  });
  const result: Portion = {
    id,
    bands: BANDS.map((row) => {
      const band = pieces.filter((p) => p.row === row);
      return {
        pieces: band.map((p) => p.piece),
        wash: band.reduce((sum, p) => sum + p.wash, 0) / band.length,
        outline: new Path2D(band.map((p) => p.silhouette).join(' ')),
      };
    }),
  };
  portionCache.set(key, result);
  return result;
}

// ------------------------------------------------------------------ one cube of ice, drawn once
const CUBE_SHAPE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L18 14Q18 16 16 17L9 22Q8 23 6 22L-19 15Q-22 14-22 11L-22-8Q-22-10-20-11Z';
const TOP_FACE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L8-2Z';
const SIDE_FACE = 'M8-2L21-10L18 14Q18 16 16 17L9 22Q8 23 6 22Z';
/** Pixels per cube unit in the pre-drawn cube; a cube is at most ~40 units across on screen. */
const CUBE_RES = 5;
const TINT = 0.28;

let cubeArt: HTMLCanvasElement | null = null;
const tintedCubes = new Map<string, HTMLCanvasElement>();

/** The frosted cube of `CupIce`, in its 48-unit box, drawn once and stamped wherever a cube goes. */
function cubeSprite(iceTexture: CanvasImageSource): HTMLCanvasElement {
  if (cubeArt) return cubeArt;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48 * CUBE_RES;
  const c = canvas.getContext('2d')!;
  c.scale(CUBE_RES, CUBE_RES);
  c.translate(24, 24);
  const body = new Path2D(CUBE_SHAPE);
  const grad = (x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  };
  // Gradients run across each face's own bounding box, as `objectBoundingBox` does in SVG.
  c.fillStyle = grad(-22, -21, -22 + 44 * 0.8, 23, [[0, '#EFFAFF'], [0.4, '#C9E6F1'], [1, '#8DBACC']]);
  c.fill(body);
  c.fillStyle = grad(-20, -21, 22, -2, [[0, '#FFFFFF'], [1, '#C5E8F4']]);
  c.fill(new Path2D(TOP_FACE));
  c.fillStyle = grad(6, -10, 21, 23, [[0, '#A9D3E3'], [1, '#6696AE']]);
  c.fill(new Path2D(SIDE_FACE));
  c.save();
  c.clip(body);
  c.globalAlpha = 0.2;
  c.drawImage(iceTexture, -24, -24, 48, 48);
  c.restore();
  c.lineJoin = 'round';
  c.strokeStyle = '#477E99';
  c.lineWidth = 1.6;
  c.stroke(body);
  c.lineCap = 'round';
  c.strokeStyle = '#F8FEFF';
  c.lineWidth = 2.3;
  c.stroke(new Path2D('M-19-9L8-1L6 20 M8-1L19-10'));
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = 3;
  c.stroke(new Path2D('M-18-5L-17 9 M-6-16L4-13'));
  cubeArt = canvas;
  return canvas;
}

/** The same cube under the tea: a wash of the drink's colour over its body. */
function tintedCube(iceTexture: CanvasImageSource, tint: string, wash: number): HTMLCanvasElement {
  const key = `${tint}:${wash.toFixed(3)}`;
  const known = tintedCubes.get(key);
  if (known) return known;
  const base = cubeSprite(iceTexture);
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const c = canvas.getContext('2d')!;
  c.drawImage(base, 0, 0);
  c.scale(CUBE_RES, CUBE_RES);
  c.translate(24, 24);
  c.globalAlpha = Math.min(1, wash);
  c.fillStyle = tint;
  c.fill(new Path2D(CUBE_SHAPE));
  tintedCubes.set(key, canvas);
  return canvas;
}

// ------------------------------------------------------------------ the glints, drawn once
let glintsArt: HTMLCanvasElement | null = null;
/** The painted reflections down the front of the glass, fading out at either end. Never moves. */
export function glintsCanvas(sprite: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  if (glintsArt && glintsArt.width === width && glintsArt.height === height) return glintsArt;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d')!;
  c.scale(width / W, height / H);
  c.drawImage(sprite, 0, 0, W, H);
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 132, 0, CUP_FLOOR_FRONT);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.25, 'rgba(255,255,255,0.32)');
  fade.addColorStop(0.72, 'rgba(255,255,255,0.32)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = fade;
  c.fill(new Path2D(CUP_FRONT_GLINTS));
  glintsArt = canvas;
  return canvas;
}

// ------------------------------------------------------------------ the painter
export class CupPainter {
  readonly canvas: HTMLCanvasElement;
  private readonly c: CanvasRenderingContext2D;

  constructor(private readonly images: CupImages, width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.c = this.canvas.getContext('2d')!;
  }

  paint(frame: CupFrame) {
    const { c, canvas } = this;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    const { drink, level } = frame;
    const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
    const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
    const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
    const ice = ICE_LEVELS.find((option) => option.id === drink.ice);
    const hasTea = Boolean(tea);
    const raw = hasTea ? level : 0;
    const filled = cupFillPath(raw);

    if (tea) this.liquid(tea, milk?.color, level, frame.phase, frame.agitation);
    this.glass(filled, path(CUP_REAR_FLOOR_GLASS), false);

    // The pile, inside the well.
    if (drink.toppings.length) {
      c.save();
      c.clip(WELL);
      this.toppings(drink.toppings, frame.portionSettle, filled, milk?.color ?? tea?.color, Boolean(milk));
      c.restore();
    }

    // Ice under the tea, and the foam.
    const poses = ice ? this.icePoses(frame, raw) : null;
    if (ice && poses) {
      c.save();
      c.clip(ICE_WELL);
      this.ice('submerged', frame, poses, ice.cubes, raw, tea?.color, milk?.color);
      c.restore();
    }
    if (foam) {
      const surface = cupSurface(level);
      c.save();
      c.clip(WELL);
      c.beginPath();
      c.ellipse(56.5, surface.y - 0.2, Math.max(0.1, surface.rx - 0.5), 4.4, 0, 0, Math.PI * 2);
      c.fillStyle = foam.color;
      c.fill();
      c.lineWidth = 0.9;
      c.strokeStyle = shade(foam.color, -16);
      c.stroke();
      c.beginPath();
      c.ellipse(47, surface.y - 1.1, 15, 2, 0, 0, Math.PI * 2);
      c.globalAlpha = 0.5;
      c.fillStyle = '#FFFFFF';
      c.fill();
      c.restore();
    }

    // The front of the glass, then the crowns standing out of the tea over it.
    this.glass(filled, path(`${BOX} ${CUP_REAR_FLOOR_GLASS}`), true);
    if (ice && poses) {
      c.save();
      c.clip(ICE_WELL);
      this.ice('exposed', frame, poses, ice.cubes, raw, tea?.color, milk?.color);
      c.restore();
    }
  }

  // ---------------------------------------------------------------- the painted glass
  /** Full where the glass has air behind it, faint where the drink stands behind it. */
  private glass(filled: string, side: Path2D, evenOdd: boolean) {
    const { c } = this;
    c.save();
    c.clip(side, evenOdd ? 'evenodd' : 'nonzero');
    if (filled) {
      c.save();
      c.clip(path(`${BOX} ${filled}`), 'evenodd');
      c.drawImage(this.images.sprite, 0, 0, W, H);
      c.restore();
      if (GLASS_FILLED_ALPHA > 0) {
        c.save();
        c.clip(path(filled));
        c.globalAlpha = GLASS_FILLED_ALPHA;
        c.drawImage(this.images.sprite, 0, 0, W, H);
        c.restore();
      }
    } else {
      c.drawImage(this.images.sprite, 0, 0, W, H);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- the tea
  private liquid(tea: Tea, milkColor: string | undefined, level: number, phase: number, agitation: number) {
    if (level <= 0) return;
    const { c } = this;
    const tint = milkColor ? blend(tea.color, milkColor, 0.6) : tea.color;
    const art = this.images.drink(tea.id, Boolean(milkColor));
    const s = cupSurface(level);
    const body = path(cupLiquidPath(s.y, s.rx, s.ry));
    const cx = W / 2;
    const left = cx - s.rx;
    const right = cx + s.rx;

    c.save();
    c.clip(WELL);

    // The body, shaded across its own width.
    const across = c.createLinearGradient(left, 0, right, 0);
    across.addColorStop(0, shade(tint, -40));
    across.addColorStop(0.18, shade(tint, 24));
    across.addColorStop(0.4, shade(tint, 6));
    across.addColorStop(0.7, tint);
    across.addColorStop(0.9, shade(tint, -22));
    across.addColorStop(1, shade(tint, -42));
    c.fillStyle = across;
    c.fill(body);

    c.save();
    c.clip(body);
    if (art.body) {
      c.globalAlpha = 0.5;
      c.drawImage(art.body, 0, 0, W, H);
      c.globalAlpha = 1;
    }
    const light = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    light.addColorStop(0, 'rgba(255,241,190,0.28)');
    light.addColorStop(1, 'rgba(255,241,190,0)');
    c.save();
    c.translate(W * 0.38, 150);
    c.scale(22, 12);
    c.fillStyle = light;
    c.beginPath();
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
    const depth = c.createLinearGradient(0, s.y, 0, CUP_FLOOR_FRONT);
    depth.addColorStop(0, 'rgba(255,234,192,0.12)');
    depth.addColorStop(0.45, withAlpha(tint, 0));
    depth.addColorStop(1, `rgba(53,26,17,${milkColor ? 0.12 : 0.3})`);
    c.fillStyle = depth;
    c.fillRect(0, s.y, W, CUP_FLOOR_FRONT - s.y);
    // The reflection running down the near side.
    const x = cx - s.rx * 0.78;
    const bottom = CUP_FLOOR_FRONT - 2;
    const start = Math.min(bottom, s.y + s.ry);
    if (start < bottom) {
      const middle = (start + bottom) / 2;
      const w = 3.5;
      const bend = Math.sin(phase * Math.PI * 2) * agitation * w * 0.5;
      c.globalAlpha = 0.32;
      c.fillStyle = '#FFF8DF';
      c.fill(path(`M${x} ${start} Q${x + w + bend} ${middle} ${x + w} ${bottom} L${x + w * 1.8} ${bottom} Q${x + w * 2 + bend} ${middle} ${x + w} ${start} Z`));
      c.globalAlpha = 1;
    }
    c.globalAlpha = 0.35;
    c.lineWidth = 0.7;
    c.strokeStyle = shade(tint, -28);
    c.stroke(FLOOR_EDGE);
    c.restore();
    c.globalAlpha = 1;

    // The surface: a lit oval in the rim's own perspective.
    const top = c.createLinearGradient(0, s.y - s.ry, 0, s.y + s.ry);
    top.addColorStop(0, shade(tint, -20));
    top.addColorStop(0.45, shade(tint, 30));
    top.addColorStop(1, shade(tint, 8));
    c.beginPath();
    c.ellipse(cx, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    c.fillStyle = top;
    c.fill();
    c.lineWidth = 0.55;
    c.strokeStyle = shade(tint, -24);
    c.stroke();
    if (art.top) {
      c.globalAlpha = 0.7;
      c.drawImage(art.top, cx - s.rx, s.y - s.ry, s.rx * 2, s.ry * 2);
      c.globalAlpha = 1;
    }
    c.globalAlpha = 0.7;
    c.lineWidth = 0.7;
    c.strokeStyle = '#FFEAC2';
    c.stroke(path(`M${cx - s.rx * 0.91} ${s.y + s.ry * 0.2} A${s.rx * 0.93} ${s.ry * 0.9} 0 0 0 ${cx + s.rx * 0.88} ${s.y + s.ry * 0.34}`));
    c.globalAlpha = 0.3 + agitation * 0.12;
    c.beginPath();
    c.ellipse(cx - s.rx * 0.34, s.y - s.ry * 0.33, s.rx * 0.32, Math.max(0.01, s.ry * 0.19), 0, 0, Math.PI * 2);
    c.fillStyle = '#FFF3DA';
    c.fill();

    // While the tap runs: two rings spreading on the surface, and a few bubbles rising.
    if (agitation > 0.001) {
      for (const delay of [0, 0.5]) {
        const p = (phase + delay) % 1;
        c.globalAlpha = Math.sin(p * Math.PI) * (1 - p) * agitation * 0.75;
        c.lineWidth = 0.65;
        c.strokeStyle = '#FFF1CD';
        c.beginPath();
        c.ellipse(cx, s.y, s.rx * (0.08 + p * 0.84), Math.max(0.01, s.ry * (0.08 + p * 0.84)), 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (const delay of [0, 0.33, 0.66]) {
        const p = (phase + delay) % 1;
        const alpha = agitation * Math.sin(p * Math.PI) * 0.5;
        if (alpha <= 0) continue;
        c.globalAlpha = alpha;
        c.beginPath();
        c.arc(cx + Math.sin(delay * 16) * 9, s.y + s.ry + (1 - p) * 16, 0.6 + p * 0.8, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,242,205,0.25)';
        c.fill();
        c.lineWidth = 0.25;
        c.strokeStyle = '#FFF5DC';
        c.stroke();
      }
    }
    c.restore();
  }

  // ---------------------------------------------------------------- the toppings
  private toppings(ids: string[], settle: number[], filled: string, tint: string | undefined, milky: boolean) {
    const { c } = this;
    const liquid = filled ? path(filled) : null;
    // Later portions build up behind the first; existing pieces keep their positions.
    for (let portion = ids.length - 1; portion >= 0; portion--) {
      const id = ids[portion];
      const cell = TOPPING_PIECE_ART.cells[id];
      if (!cell) continue;
      const fall = -14 * (1 - (settle[portion] ?? 1));
      const { bands } = portionFor(id, portion);
      for (const band of bands) {
        c.save();
        c.translate(0, fall);
        for (const piece of band.pieces) {
          c.globalAlpha = piece.shadow;
          c.fillStyle = '#271710';
          c.beginPath();
          c.ellipse(piece.cx + 0.3, piece.cy + piece.ry * 0.78, piece.rx * 0.88, Math.max(0.01, piece.ry * 0.2), 0, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = piece.opacity;
          c.save();
          c.translate(piece.cx, piece.cy);
          if (piece.angle) c.rotate(piece.angle * Math.PI / 180);
          c.drawImage(this.images.pieces, cell.x, cell.y, cell.width, cell.height,
            -piece.rx, -piece.ry, piece.rx * 2, piece.ry * 2);
          c.restore();
        }
        c.globalAlpha = 1;
        // The tea's colour over what of this band is under it: the liquid, clipped to the band's
        // own silhouettes (which fall with it), while the liquid's line stays where the tea is.
        if (tint && liquid) {
          c.clip(band.outline);
          c.translate(0, -fall);
          c.globalAlpha = (milky ? 0.3 : 0.16) * band.wash;
          c.fillStyle = tint;
          c.fill(liquid);
          c.globalAlpha = 1;
        }
        c.restore();
      }
    }
  }

  // ---------------------------------------------------------------- the ice
  private icePoses(frame: CupFrame, raw: number) {
    const toppingLayers = frame.drink.toppings.length;
    return frame.iceLayout.map((cube) => {
      const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift + toppingLayers * 10);
      const pose = cupIcePosition(raw, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle,
        cube.submergedDepth ?? 0, cube.immersion ?? 0.42);
      return { dry, pose };
    });
  }

  private ice(layer: 'submerged' | 'exposed', frame: CupFrame, poses: ReturnType<CupPainter['icePoses']>,
    cubes: number, raw: number, teaColor?: string, milkColor?: string) {
    const { c } = this;
    const submerged = layer === 'submerged';
    const water = cupIceFillPath(raw);
    const standing = frame.iceLayout.slice(0, cubes).map((cube, at) => ({ cube, at }))
      .sort((a, b) => a.cube.depth - b.cube.depth);
    const tint = submerged ? milkColor ?? teaColor : undefined;
    const soften = submerged ? (milkColor ? 0.65 : 0.62) : 1;
    const fade = tint ? 1 - (1 - TINT) * (1 - soften) : soften;
    const sprite = tint ? tintedCube(this.images.ice, tint, TINT / fade) : cubeSprite(this.images.ice);

    // Contact shadows belong to the cup's floor, so they are never clipped to the tea.
    if (submerged) {
      for (const { cube, at } of standing) {
        const { dry, pose } = poses[at];
        const settled = frame.iceSettle[at] ?? 1;
        const alpha = (1 - pose.rise) * settled * 0.18;
        if (alpha <= 0) continue;
        c.globalAlpha = alpha;
        c.fillStyle = '#506576';
        c.beginPath();
        c.ellipse(dry.contactX, dry.contactY, cube.r * 0.7, 1.6, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (!water) return; // nothing is under the tea when there is no tea
    }

    c.save();
    if (submerged) c.clip(path(water));
    else if (water) c.clip(path(`${BOX} ${water}`), 'evenodd');
    // One fade for the whole tray, so overlapping cubes stack and are softened once.
    const target = fade < 1 ? this.scratch() : null;
    const draw = target?.getContext('2d') ?? c;
    if (target) {
      draw.setTransform(c.getTransform());
      draw.clearRect(-1e4, -1e4, 2e4, 2e4);
    }
    for (const { cube, at } of standing) {
      const { pose } = poses[at];
      const fall = 1 - (frame.iceSettle[at] ?? 1);
      // The cube's 48-unit box, scaled by r / 24: 2r across.
      draw.save();
      draw.translate(pose.cx, pose.cy - 10 * fall);
      draw.rotate((pose.angle - 7 * fall) * Math.PI / 180);
      draw.drawImage(sprite, -cube.r, -cube.r, cube.r * 2, cube.r * 2);
      draw.restore();
    }
    if (target) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = fade;
      c.drawImage(target, 0, 0);
      c.globalAlpha = 1;
    }
    c.restore();
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);

    // Every cube breaking the surface is anchored to it by the tea's own near arc.
    if (!submerged && raw > 0) {
      const surfacing = standing.filter(({ cube }) => !cube.submergedDepth);
      if (!surfacing.length) return;
      const surface = cupSurface(raw);
      c.save();
      const outlines = surfacing.map(({ cube, at }) => {
        const { pose } = poses[at];
        const fall = 1 - (frame.iceSettle[at] ?? 1);
        return cupIceOutlinePath(pose.cx, pose.cy - 10 * fall, pose.angle - 7 * fall, cube.r);
      }).join(' ');
      c.clip(path(outlines));
      c.globalAlpha = surface.opacity * 0.55;
      c.lineWidth = 0.8;
      c.strokeStyle = teaColor ?? '#769FAC';
      c.stroke(path(`M${56.5 - surface.rx} ${surface.y} A${surface.rx} ${surface.ry} 0 0 0 ${56.5 + surface.rx} ${surface.y}`));
      c.restore();
    }
  }

  private scratchCanvas: HTMLCanvasElement | null = null;
  /** An offscreen sheet the size of the cup, for drawing a group that is faded as one. */
  private scratch(): HTMLCanvasElement {
    if (!this.scratchCanvas || this.scratchCanvas.width !== this.canvas.width || this.scratchCanvas.height !== this.canvas.height) {
      this.scratchCanvas = document.createElement('canvas');
      this.scratchCanvas.width = this.canvas.width;
      this.scratchCanvas.height = this.canvas.height;
    }
    return this.scratchCanvas;
  }
}

function withAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
