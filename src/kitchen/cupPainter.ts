import { Drink, getIngredient, ICE_LEVELS, Tea, Topping } from '../game/ingredients';
import {
  CUP_ART,
  CUP_CONTENTS,
  CUP_FLOOR_EDGE,
  CUP_FLOOR_FRONT,
  CUP_NEAR_GLASS,
  CUP_NEAR_LIP_BAND,
  CUP_REAR_FLOOR_GLASS,
  CUP_SURFACE_TOP,
  CUP_WELL,
  cupFillPath,
  cupIceFillPath,
  cupIceOutlinePath,
  cupIcePosition,
  cupIceRestPosition,
  cupIceSpreadPosition,
  cupLiquidPath,
  cupSurface,
  cupToppingPosition,
} from '../art/cupGeometry';
import { IcePlacement } from '../art/iceLayout';
import { TOPPING_PIECE_ART } from '../art/toppingArt';
import { shade } from './color';
import { CUP_OVERFLOW, paintCupCream } from './creamPainter';
import { CUP_LID_HOLE_Y, paintInsertedStraw, paintLid } from '../art/finishingArt';
import { cupTeaGlow, cupTeaTint, paintTeaBody, paintTeaSurface } from './teaPainter';

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
  /** Original atlas for the lid's rear rim and the straw inside the drink. */
  reference: CanvasImageSource;
  /** Painted cream with transparent edges. */
  cream: CanvasImageSource;
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
  lidded?: boolean;
  straw?: boolean;
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
  /** Slow ambient loop, independent of the faster pouring ripples. */
  ambientPhase?: number;
}

const W = CUP_ART.w;
const H = CUP_ART.h;
const BOX = `M0 0H${W}V${H}H0Z`;
/** The texture includes space above the rim for the cream peak. */
const PAINT_H = H * (1 + CUP_OVERFLOW);
/** The painted body begins at the original design's fill line, below the current full level. */
const BODY_ART_TOP = 48;
/**
 * A light material reflection over the drink, leaving its color and the submerged ingredients clear.
 */
const GLASS_FILLED_ALPHA = 0.62;

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
const CONTENTS = new Path2D(CUP_CONTENTS);
// Let the peak rise above the mouth while keeping the wet edge behind the inner walls.
const CREAM_CONTENTS = new Path2D(CUP_CONTENTS);
CREAM_CONTENTS.rect(0, -H * CUP_OVERFLOW, W, 28 + H * CUP_OVERFLOW);
/** Near half of the mouth and the front wall. The far half stays behind the contents. */
const FRONT_GLASS = CUP_NEAR_GLASS;
const FRONT = new Path2D(FRONT_GLASS);
const REAR = new Path2D(`${BOX} ${FRONT_GLASS}`);
const FLOOR_EDGE = new Path2D(CUP_FLOOR_EDGE);
const frontWalls = new WeakMap<object, HTMLCanvasElement>();
type ContentsDepth = 'all' | 'rear' | 'front';
const wetStraws = new Map<string, HTMLCanvasElement>();

/** A wet tube carries the tea's colour while preserving the painted hollow edges. */
function wetStraw(source: CanvasImageSource, tint: string) {
  const known = wetStraws.get(tint);
  if (known) return known;
  const canvas = document.createElement('canvas');
  canvas.width = W * 4; canvas.height = H * 4;
  const c = canvas.getContext('2d')!;
  c.scale(4, 4);
  paintInsertedStraw(c, source, 'inside');
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = 0.24;
  c.fillStyle = tint;
  c.fillRect(0, 0, W, H);
  wetStraws.set(tint, canvas);
  return canvas;
}

/** The back base ellipse is behind the ingredients. Continue only the wall material over it. */
function frontWall(sprite: CanvasImageSource) {
  const cached = frontWalls.get(sprite);
  if (cached) return cached;
  const source = document.createElement('canvas');
  source.width = W * 6;
  source.height = H * 6;
  source.getContext('2d')!.drawImage(sprite, 0, 0, source.width, source.height);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const c = canvas.getContext('2d')!;
  c.scale(6, 6);
  c.drawImage(source, 0, 0, W, H);
  c.clip(path(CUP_REAR_FLOOR_GLASS));
  c.clearRect(0, 132, W, H - 132);
  // This strip ends above both painted back arcs. Its continuous glints follow the
  // same wall down to the curved inner floor; the actual outer base is untouched.
  c.drawImage(source, 0, 132 * 6, W * 6, 13 * 6, 0, 132, W, CUP_FLOOR_FRONT - 132);
  frontWalls.set(sprite, canvas);
  return canvas;
}

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
interface Band { pieces: Piece[]; depth: number }
interface Portion { id: string; bands: Band[] }

const portionCache = new Map<string, Portion>();
/** A loose bed, with smaller rear pieces and stable variation between portions. */
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
    const jitter = ((seed + i * 17 + portion * 11) % 13 - 6) * 0.4;
    const rx = (cube ? 5.3 : 5.8) * spot.size * (0.9 + ((i * 13 + seed) % 7) * 0.025);
    const ry = rx / aspect;
    const angle = ((seed + i * 11 + portion * 7) % (cube ? 37 : 21)) - (cube ? 18 : 10);
    const { cx, cy } = cupToppingPosition(spot.x + jitter, rx, ry, angle,
      spot.lift + portion * 11.5 + ((seed + i * 3) % 7) * 0.48);
    return {
      row: spot.row,
      piece: { cx, cy, rx, ry, angle, opacity: 0.8 + spot.depth * 0.2, shadow: 0.08 + spot.depth * 0.1 },
      depth: 1 - spot.depth,
    };
  });
  const result: Portion = {
    id,
    bands: BANDS.map((row) => {
      const band = pieces.filter((p) => p.row === row);
      return {
        pieces: band.map((p) => p.piece),
        depth: band.reduce((sum, p) => sum + p.depth, 0) / band.length,
      };
    }),
  };
  portionCache.set(key, result);
  return result;
}

// ------------------------------------------------------------------ one cube of ice, drawn once
const CUBE_SHAPE = 'M-20-11L-7-20Q-5-21-3-20L19-14Q22-13 21-10L18 14Q18 16 16 17L9 22Q8 23 6 22L-19 15Q-22 14-22 11L-22-8Q-22-10-20-11Z';
/** Pixels per cube unit in the pre-drawn cube; a cube is at most ~40 units across on screen. */
const CUBE_RES = 5;

let cubeArt: HTMLCanvasElement | null = null;
const tintedCubes = new Map<string, HTMLCanvasElement>();

/** Clear melted ice with warm neutral refraction, drawn once for every pose. */
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
  c.fillStyle = grad(-22, -21, 22, 23, [[0, '#F2F8F2C0'], [0.4, '#C5D8D35C'], [1, '#718D8A70']]);
  c.fill(body);
  c.save();
  c.clip(body);
  // Keep the painted texture subtle: strong fine cracks read as wire cages at cup size.
  c.globalAlpha = 0.16;
  c.drawImage(iceTexture, -24, -24, 48, 48);
  c.restore();
  c.lineJoin = 'round';
  c.fillStyle = grad(-10, -20, 6, 0, [[0, '#FFFFFFB8'], [1, '#E5F2EC24']]);
  c.fill(new Path2D('M-20-11L-5-20L20-13L8-1Z'));
  c.fillStyle = grad(8, 0, 20, 12, [[0, '#77999130'], [1, '#607F7C60']]);
  c.fill(new Path2D('M8-1L20-12L17 16L7 22Z'));
  c.strokeStyle = '#6D848046';
  c.lineWidth = 0.5;
  c.stroke(body);
  c.lineCap = 'round';
  c.strokeStyle = '#FCFFF59C';
  c.lineWidth = 0.85;
  c.stroke(new Path2D('M-19-9L8-1L6 20 M8-1L19-10'));
  c.strokeStyle = 'rgba(255,255,247,0.65)';
  c.lineWidth = 1.8;
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
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = Math.min(1, wash);
  c.fillStyle = tint;
  c.fillRect(0, 0, canvas.width, canvas.height);
  tintedCubes.set(key, canvas);
  return canvas;
}

// ------------------------------------------------------------------ the painter
export class CupPainter {
  readonly canvas: HTMLCanvasElement;
  private readonly c: CanvasRenderingContext2D;

  constructor(private readonly images: CupImages, width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height * (1 + CUP_OVERFLOW)));
    this.c = this.canvas.getContext('2d')!;
    // The glass is much larger than a cup on screen; proper downsampling avoids jagged glints.
    this.c.imageSmoothingQuality = 'high';
  }

  paint(frame: CupFrame) {
    const { c, canvas } = this;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    // Shared cup coordinates keep every ingredient behind the same glass boundary.
    c.setTransform(canvas.width / W, 0, 0, canvas.height / PAINT_H, 0, 0);
    c.translate(0, H * CUP_OVERFLOW);

    const { drink, level } = frame;
    const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea) : undefined;
    const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
    const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
    const ice = ICE_LEVELS.find((option) => option.id === drink.ice);
    const raw = tea || milk ? level : 0;
    const filled = cupFillPath(raw);
    const tint = tea ? cupTeaTint(tea, milk?.color) : milk?.color;

    if (frame.lidded) paintLid(c, this.images.reference, 'rear');
    // The part in the dome's air space is behind the cream and the lid's front reflection.
    if (frame.straw) {
      c.save();
      c.clip(path(`M0 ${CUP_LID_HOLE_Y}H113V174H0Z ${CUP_CONTENTS}`), 'evenodd');
      c.globalAlpha = 0.78;
      paintInsertedStraw(c, this.images.reference, 'inside');
      c.restore();
    }

    // Shared interior bounds contain every ingredient, including settling frames and composites.
    c.save();
    c.clip(CONTENTS);
    // The back of the moulded floor is behind the drink, never a translucent band over it.
    this.glass('', path(CUP_REAR_FLOOR_GLASS), false);
    if (tint) this.liquid(tea, milk?.color, raw, frame.phase, frame.agitation, frame.ambientPhase ?? 0);
    this.syrup(drink.sweetness, raw);

    const poses = ice ? this.icePoses(frame, raw) : null;
    const depths: ContentsDepth[] = frame.straw ? ['rear', 'front'] : ['all'];
    for (const depth of depths) {
      // The straw occupies the middle of the drink: some solids behind it, others in front.
      if (depth === 'front') this.innerStraw(raw, tint, Boolean(milk));
      if (ice && poses) this.ice('submerged', frame, poses, ice.cubes, raw, tint, Boolean(milk), depth);
      if (drink.toppings.length) {
        c.save();
        c.clip(WELL);
        this.toppings(drink.toppings, frame.portionSettle, filled, tint, Boolean(milk), depth);
        c.restore();
      }
      if (ice && poses) this.ice('exposed', frame, poses, ice.cubes, raw, tint, Boolean(milk), depth);
    }
    c.restore();
    const glass = this.images.sprite;

    // Split the cup into a rear and a near wall. Cream belongs between them, just
    // like the tea: painting it after both walls makes it look pasted on the glass.
    const walls = path(`${BOX} ${CUP_REAR_FLOOR_GLASS}`);
    c.save();
    c.clip(REAR, 'evenodd');
    this.glass(filled, walls, true, glass);
    c.restore();
    if (foam) {
      c.save();
      c.clip(CREAM_CONTENTS);
      paintCupCream(c, raw, foam.id, foam.color, this.images.cream, tint);
      c.restore();
    }
    c.save();
    c.clip(FRONT);
    // Foam also sits behind clear plastic. Use one continuous reflection down to the floor,
    // rather than cutting the cream with the much stronger empty-glass shading.
    this.glass(foam ? cupFillPath(1) : filled, path(BOX), false, frontWall(glass));
    if (foam) {
      // The near lip is solid glass even where the liquid mask reaches the brim.
      // It must cross in front of the cream, rather than disappear under its base.
      c.save();
      c.clip(path(CUP_NEAR_LIP_BAND));
      c.drawImage(this.images.sprite, 0, 0, W, H);
      c.restore();
    }
    c.restore();
  }

  /** The tube enters the MIDDLE of the surface, not the far edge of the liquid silhouette. */
  private innerStraw(level: number, tint: string | undefined, milky: boolean) {
    const { c } = this;
    const surface = cupSurface(level);
    const waterY = surface.y + surface.ry * 0.15;
    const filled = level > 0 && Boolean(tint);
    for (const wet of filled ? [false, true] : [false]) {
      c.save();
      if (filled) {
        c.beginPath();
        c.rect(0, wet ? waterY : -40, W, wet ? H - waterY : waterY + 40);
        c.clip();
      }
      c.globalAlpha = wet ? (milky ? 0.46 : 0.64) : 0.78;
      if (wet) {
        // A slight refractive shift at the waterline locates the tube within the liquid.
        c.drawImage(wetStraw(this.images.reference, tint!), 0.8, 0, W, H);
      } else paintInsertedStraw(c, this.images.reference, 'inside');
      c.restore();
    }
    if (filled && waterY < 150) {
      c.save();
      c.lineWidth = 0.6;
      c.strokeStyle = shade(tint!, -25) + '88';
      c.beginPath(); c.ellipse(56.9, waterY + 0.3, 4.1, 1.2, 0, 0, Math.PI); c.stroke();
      c.strokeStyle = '#FFF1D58C';
      c.beginPath(); c.ellipse(56.9, waterY - 0.1, 3.9, 1, 0, Math.PI, Math.PI * 1.65); c.stroke();
      c.restore();
    }
  }

  // ---------------------------------------------------------------- the painted glass
  /** Full where the glass has air behind it, faint where the drink stands behind it. */
  private glass(filled: string, side: Path2D, evenOdd: boolean, sprite = this.images.sprite) {
    const { c } = this;
    c.save();
    c.clip(side, evenOdd ? 'evenodd' : 'nonzero');
    if (filled) {
      c.save();
      c.clip(path(`${BOX} ${filled}`), 'evenodd');
      c.drawImage(sprite, 0, 0, W, H);
      c.restore();
      if (GLASS_FILLED_ALPHA > 0) {
        c.save();
        c.clip(path(filled));
        c.globalAlpha *= GLASS_FILLED_ALPHA;
        c.drawImage(sprite, 0, 0, W, H);
        c.restore();
      }
    } else {
      c.drawImage(sprite, 0, 0, W, H);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- the tea
  private liquid(tea: Tea | undefined, milkColor: string | undefined, level: number, phase: number, agitation: number, ambient: number) {
    if (level <= 0) return;
    const { c } = this;
    const tint = tea ? cupTeaTint(tea, milkColor) : milkColor!;
    const art = tea ? this.images.drink(tea.id, Boolean(milkColor)) : {};
    const s = cupSurface(level);
    const body = path(cupLiquidPath(s.y, s.rx, s.ry));
    const cx = W / 2;
    const left = cx - s.rx;
    const right = cx + s.rx;

    c.save();
    c.clip(WELL);

    // The body, shaded across its own width.
    const across = c.createLinearGradient(left, 0, right, 0);
    across.addColorStop(0, shade(tint, tea ? -43 : -23));
    across.addColorStop(0.19, tea ? cupTeaGlow(tea, milkColor) : shade(tint, 22));
    across.addColorStop(0.38, shade(tint, 8));
    across.addColorStop(0.62, tea ? shade(tint, -12) : tint);
    across.addColorStop(0.85, shade(tint, -22));
    across.addColorStop(1, shade(tint, tea ? -45 : -25));
    c.fillStyle = across;
    c.fill(body);

    c.save();
    c.clip(body);
    if (art.body) {
      c.globalCompositeOperation = 'soft-light';
      c.globalAlpha = 0.25;
      // Map only the painted body into the current well; its transparent upper padding would
      // otherwise leave a second horizontal edge below a raised liquid surface.
      c.drawImage(art.body, 0, BODY_ART_TOP, W, CUP_FLOOR_FRONT - BODY_ART_TOP,
        0, CUP_SURFACE_TOP, W, CUP_FLOOR_FRONT - CUP_SURFACE_TOP);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    const light = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    light.addColorStop(0, 'rgba(255,217,132,0.22)');
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
    depth.addColorStop(1, `rgba(53,26,17,${milkColor ? 0.14 : 0.32})`);
    c.fillStyle = depth;
    c.fillRect(0, s.y, W, CUP_FLOOR_FRONT - s.y);
    if (tea) paintTeaBody(c, level, tint, Boolean(milkColor), ambient, agitation);
    if (milkColor && agitation > 0.001) {
      // A fresh splash blooms through the drink, then disappears as it mixes.
      // These translucent ribbons never create a second, horizontal liquid level.
      const swirl = c.createLinearGradient(0, s.y, 0, CUP_FLOOR_FRONT);
      swirl.addColorStop(0, withAlpha(milkColor, agitation * 0.23));
      swirl.addColorStop(0.65, withAlpha(milkColor, agitation * 0.08));
      swirl.addColorStop(1, withAlpha(milkColor, 0));
      const reach = CUP_FLOOR_FRONT - s.y;
      const bend = Math.sin(phase * Math.PI * 2) * 5;
      c.fillStyle = swirl;
      c.fill(path(`M40 ${s.y} C${30 + bend} ${s.y + reach * 0.3} 79 ${s.y + reach * 0.48} 46 ${CUP_FLOOR_FRONT}
        C93 ${s.y + reach * 0.5} ${48 + bend} ${s.y + reach * 0.3} 64 ${s.y}Z`));
    }
    // The reflection running down the near side.
    const x = cx - s.rx * 0.78;
    const bottom = CUP_FLOOR_FRONT - 2;
    const start = Math.min(bottom, s.y + s.ry);
    if (start < bottom) {
      const middle = (start + bottom) / 2;
      const w = 3.5;
      const bend = Math.sin(phase * Math.PI * 2) * agitation * w * 0.5;
      c.globalAlpha = 0.065;
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
    top.addColorStop(0, shade(tint, -27));
    top.addColorStop(0.4, tea ? cupTeaGlow(tea, milkColor) : shade(tint, 32));
    top.addColorStop(0.78, shade(tint, 12));
    top.addColorStop(1, shade(tint, -8));
    c.beginPath();
    c.ellipse(cx, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
    c.fillStyle = top;
    c.fill();
    c.lineWidth = 0.55;
    c.strokeStyle = withAlpha(shade(tint, -14), 0.5);
    c.stroke();
    if (art.top) {
      c.globalAlpha = 0.4;
      c.drawImage(art.top, cx - s.rx, s.y - s.ry, s.rx * 2, s.ry * 2);
      c.globalAlpha = 1;
    }
    if (tea) paintTeaSurface(c, level, tint, Boolean(milkColor), ambient, agitation);
    c.globalAlpha = 0.28;
    c.lineWidth = 0.7;
    c.strokeStyle = '#FFEAC2';
    c.stroke(path(`M${cx - s.rx * 0.91} ${s.y + s.ry * 0.2} A${s.rx * 0.93} ${s.ry * 0.9} 0 0 0 ${cx + s.rx * 0.88} ${s.y + s.ry * 0.34}`));
    c.globalAlpha = 0.14 + agitation * 0.12;
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

  /** A small syrup pool wets the floor, then disappears into the first shallow pour. */
  private syrup(sweetness: string | null, level: number) {
    const amount = Number(sweetness);
    const opacity = Math.max(0, 1 - level / 0.14);
    if (!amount || !opacity) return;
    const { c } = this;
    const rx = 12 + amount * 0.1;
    c.save();
    c.globalAlpha = opacity * 0.75;
    const honey = c.createLinearGradient(0, 151, 0, 163);
    honey.addColorStop(0, '#E9BB6790');
    honey.addColorStop(0.4, '#DE9E39B8');
    honey.addColorStop(1, '#AD702C94');
    c.fillStyle = honey;
    c.beginPath();
    c.ellipse(56.5, 157, rx, 4 + amount * 0.015, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#FFF2C3A0';
    c.lineWidth = 0.65;
    c.beginPath();
    c.ellipse(56.5, 157, rx - 1, 3 + amount * 0.015, 0, Math.PI * 0.2, Math.PI * 0.8);
    c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- the toppings
  private readonly wetPieces = new Map<string, HTMLCanvasElement>();

  /** Colour only the actual painted pixels; approximate silhouette washes leave bright halos. */
  private toppingSprite(id: string, tint?: string, wash = 0) {
    const key = `${id}:${tint ?? 'dry'}:${wash.toFixed(2)}`;
    const cached = this.wetPieces.get(key);
    if (cached) return cached;
    const cell = TOPPING_PIECE_ART.cells[id];
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = Math.round(96 * cell.height / cell.width);
    const c = canvas.getContext('2d')!;
    c.drawImage(this.images.pieces, cell.x, cell.y, cell.width, cell.height, 0, 0, canvas.width, canvas.height);
    if (tint) {
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = wash;
      c.fillStyle = tint;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.wetPieces.set(key, canvas);
    return canvas;
  }

  private toppings(ids: string[], settle: number[], filled: string, tint: string | undefined, milky: boolean, depth: ContentsDepth) {
    const { c } = this;
    // Rear portions and rear rows are seen through more liquid than pieces against the front wall.
    for (let portion = ids.length - 1; portion >= 0; portion--) {
      const id = ids[portion];
      if (!TOPPING_PIECE_ART.cells[id]) continue;
      const fall = -14 * (1 - (settle[portion] ?? 1));
      for (const [row, band] of portionFor(id, portion).bands.entries()) {
        if (depth !== 'all' && (row === 2) !== (depth === 'front')) continue;
        const distance = Math.min(1, band.depth + portion * 0.08);
        const wash = milky ? 0.28 + distance * 0.36 : 0.12 + distance * 0.25;
        const wet = tint && filled;
        for (const submerged of wet ? [false, true] : [false]) {
          c.save();
          if (wet) c.clip(path(submerged ? filled : `${BOX} ${filled}`), submerged ? 'nonzero' : 'evenodd');
          c.translate(0, fall);
          const sprite = this.toppingSprite(id, submerged ? tint : undefined, submerged ? wash : 0);
          for (const piece of band.pieces) {
            c.globalAlpha = piece.shadow * (submerged ? 0.5 : 1);
            c.fillStyle = '#30251D';
            c.beginPath();
            c.ellipse(piece.cx, piece.cy + piece.ry * 0.72, piece.rx * 0.82, piece.ry * 0.24, 0, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = piece.opacity * (submerged ? (milky ? 0.86 - distance * 0.22 : 0.96 - distance * 0.12) : 1);
            c.save();
            c.translate(piece.cx, piece.cy);
            c.rotate(piece.angle * Math.PI / 180);
            c.drawImage(sprite, -piece.rx, -piece.ry, piece.rx * 2, piece.ry * 2);
            c.restore();
          }
          c.restore();
        }
      }
    }
  }

  // ---------------------------------------------------------------- the ice
  private icePoses(frame: CupFrame, raw: number) {
    const toppingLayers = frame.drink.toppings.length;
    return frame.iceLayout.map((cube) => {
      const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift + toppingLayers * 10);
      const pose = cube.liquidDepth !== undefined
        ? cupIceSpreadPosition(raw, cube.x, cube.r, cube.angle, cube.liquidDepth, dry.cx, dry.cy, cube.restAngle)
        : cupIcePosition(raw, cube.x, cube.r, cube.angle, cube.depth, dry.cx, dry.cy, cube.restAngle,
          cube.immersion ?? 0.42);
      return { dry, pose };
    });
  }

  private ice(layer: 'submerged' | 'exposed', frame: CupFrame, poses: ReturnType<CupPainter['icePoses']>,
    cubes: number, raw: number, liquidTint: string | undefined, milky: boolean, depth: ContentsDepth) {
    const { c } = this;
    const submerged = layer === 'submerged';
    const water = cupIceFillPath(raw);
    const standing = frame.iceLayout.slice(0, cubes).map((cube, at) => ({ cube, at }))
      .filter(({ cube }) => depth === 'all' || (cube.depth > 0.3) === (depth === 'front'))
      .sort((a, b) => poses[a.at].pose.cy - poses[b.at].pose.cy);
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
    const surface = cupSurface(raw);
    for (const { cube, at } of standing) {
      const { pose } = poses[at];
      const fall = 1 - (frame.iceSettle[at] ?? 1);
      // Submerged facets lose contrast with depth, especially in opaque milk tea.
      // Quantized washes keep cached sprites bounded while the liquid level animates.
      const depth = Math.max(0, Math.min(1, (pose.cy - surface.y) / 48));
      const wash = Math.round((milky ? 0.42 + depth * 0.3 : 0.2 + depth * 0.24) * 12) / 12;
      const sprite = submerged && liquidTint ? tintedCube(this.images.ice, liquidTint, wash) : cubeSprite(this.images.ice);
      c.save();
      c.globalAlpha = submerged ? (milky ? 0.64 - depth * 0.29 : 0.8 - depth * 0.2) : 0.94;
      c.translate(pose.cx, pose.cy - 10 * fall);
      c.rotate((pose.angle - 7 * fall) * Math.PI / 180);
      c.drawImage(sprite, -cube.r, -cube.r, cube.r * 2, cube.r * 2);
      c.restore();
    }
    c.restore();

    // Every cube breaking the surface is anchored to it by the tea's own near arc.
    if (!submerged && raw > 0) {
      const surfacing = standing.filter(({ cube }) => cube.liquidDepth === undefined);
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
      c.strokeStyle = liquidTint ?? '#769FAC';
      c.stroke(path(`M${56.5 - surface.rx} ${surface.y} A${surface.rx} ${surface.ry} 0 0 0 ${56.5 + surface.rx} ${surface.y}`));
      c.restore();
    }
  }
}

function withAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
