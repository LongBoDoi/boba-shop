/**
 * The simple vector cup — the one on the title screen, in the customers' bubbles, in a leaving
 * customer's hand and tossed into the bin.
 *
 * What a string cannot be is a moving picture, so none of this moves:
 * - `animated` — the pour stream, the falling sugar, the dropping ice and toppings, the foam
 *   landing and the sticker popping in are all transient and are drawn at their resting value
 *   (streams and sugar gone, everything settled where it lands). The one piece of `animated` that
 *   *rests visibly* is the shimmer rolling across the liquid's surface (`Surface`), which is
 *   opt-in here as `surface` with its loop position as `surfacePhase` (0–1).
 * - `levelSv` — the station's live level while a spigot is held; pass the level as `fill`.
 * - The milk fading in (`milkiness`) rests at fully milky when there is milk.
 *
 * Kept: the `tapered` trick. A tapered cup is a rectangle with two triangles painted over its
 * lower corners in `backgroundColor`, so pass the colour actually behind the cup (or
 * `tapered: false` over anything busy).
 */
import { Drink, getIngredient, ICE_LEVELS, Tea, TOPPINGS } from '../game/ingredients';
import { borderedRect, el, n, svgDoc, uid } from './svg';
import { colors, FONT, FONT_WEIGHT } from './theme';

export interface CupOptions {
  width: number;
  /** Colour behind the cup — used to mask the body into a tapered shape. */
  backgroundColor: string;
  straw?: boolean;
  sealed?: boolean;
  /** Tapered by masking with `backgroundColor` (default). `false`: a straight, rounded body. */
  tapered?: boolean;
  /** How full the cup is (0–1). Left out, a stock level for whatever is in it. */
  fill?: number;
  /** Draw the shimmer line across the liquid's surface (`Cup`'s `animated` + `detailed`). */
  surface?: boolean;
  /** Where the shimmer is in its four-second loop, 0–1. */
  surfacePhase?: number;
}

export interface CupLayout {
  /** The SVG document's size. */
  svgWidth: number;
  svgHeight: number;
  /**
   * Where the cup's own layout box (`width` wide, `boxHeight` tall) starts inside the SVG. The rim overhangs it by 2px either side and a seal
   * without a straw rises above it, so the document is a little bigger than the box.
   */
  originX: number;
  originY: number;
  boxWidth: number;
  boxHeight: number;
}

const ICE_SPOTS = [
  { x: 0.2, y: 0.36, rotate: -12 },
  { x: 0.52, y: 0.44, rotate: 18 },
  { x: 0.34, y: 0.56, rotate: 8 },
  { x: 0.56, y: 0.25, rotate: -20 },
];

function metrics(width: number, straw?: boolean, tapered = true) {
  const height = Math.round(width * 1.3);
  const strawRise = straw ? Math.round(height * 0.2) : 0;
  const rimHeight = Math.max(3, Math.round(width * 0.07));
  const bodyHeight = height - rimHeight;
  const inset = tapered ? Math.round(width * 0.12) : 0;
  const stroke = Math.max(1.5, width * 0.025);
  return { height, strawRise, rimHeight, bodyHeight, inset, stroke, detailed: width >= 60 };
}

/** The SVG's size and where the cup's layout box sits in it. */
export function cupLayout(width: number, opts: { straw?: boolean; sealed?: boolean } = {}): CupLayout {
  const { height, strawRise, rimHeight } = metrics(width, opts.straw);
  const padTop = opts.sealed && !opts.straw ? Math.ceil(rimHeight * 0.6) : 0;
  return {
    svgWidth: width + 4,
    svgHeight: height + strawRise + padTop,
    originX: 2,
    originY: padTop,
    boxWidth: width,
    boxHeight: height + strawRise,
  };
}

/** A rectangle whose bottom two corners are rounded by `r` (top square). */
function bottomRounded(x0: number, y0: number, x1: number, y1: number, r: number): string {
  if (r <= 0) return `M${n(x0)} ${n(y0)} H${n(x1)} V${n(y1)} H${n(x0)} Z`;
  return (
    `M${n(x0)} ${n(y0)} H${n(x1)} V${n(y1 - r)} A${n(r)} ${n(r)} 0 0 1 ${n(x1 - r)} ${n(y1)} ` +
    `H${n(x0 + r)} A${n(r)} ${n(r)} 0 0 1 ${n(x0)} ${n(y1 - r)} Z`
  );
}

/** Rough width of a run of Baloo 2 Bold, since a string cannot measure text. */
function textWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of Array.from(text)) {
    if (/\d/.test(ch)) em += 0.56;
    else if (ch === '%') em += 0.82;
    else if (ch.codePointAt(0)! > 0x2000) em += 1.15; // emoji
    else em += 0.55;
  }
  return em * fontSize;
}

export function cupSvg(drink: Drink, opts: CupOptions): string {
  const { width, backgroundColor, straw, sealed, tapered = true, fill, surface, surfacePhase = 0 } = opts;
  const { height, strawRise, rimHeight, bodyHeight, inset, stroke, detailed } = metrics(width, straw, tapered);
  const layout = cupLayout(width, { straw, sealed });

  const tea = drink.tea ? (getIngredient('tea', drink.tea) as Tea | undefined) : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk', drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam', drink.foam) : undefined;
  const ice = ICE_LEVELS.find((level) => level.id === drink.ice);
  const sweetness = drink.sweetness ? getIngredient('sweetness', drink.sweetness) : undefined;

  const baseColor = tea?.color ?? milk?.color;
  const milkyColor = tea ? tea.milkyColor : milk?.color;
  const targetLevel = fill !== undefined ? fill : tea ? 0.72 : milk ? 0.3 : 0;

  // The inner `View` (the cup proper) starts below the straw's rise.
  const oy = strawRise;
  const bodyTop = oy + rimHeight;
  const side = tapered ? 0 : stroke; // left/right border width
  // The body's padding box — what its absolutely positioned children are placed in and clipped to.
  const px0 = side;
  const px1 = width - side;
  const pw = px1 - px0;
  const pBottom = bodyTop + bodyHeight - stroke;
  const outerRadius = tapered ? 0 : width * 0.18;
  const innerRadius = Math.max(0, outerRadius - stroke);

  const clipId = uid('cupbody');
  const depthId = uid('cupdepth');
  const strawClipId = uid('cupstraw');
  let defs = '';
  let out = '';

  // --- Straw, behind the body (the body's glass is 60% white, so it shows faintly through).
  if (straw && tea) {
    const sw = width * 0.08;
    const sh = height * 0.95;
    const sx = width * 0.55;
    const sy = oy - strawRise;
    const r = Math.min(3, sw / 2);
    const rot = `rotate(10 ${n(sx + sw / 2)} ${n(sy + sh / 2)})`;
    defs += `<clipPath id="${strawClipId}">${el('rect', { x: sx, y: sy, width: sw, height: sh, rx: r })}</clipPath>`;
    out +=
      `<g transform="${rot}">` +
      el('rect', { x: sx, y: sy, width: sw, height: sh, rx: r, fill: '#FF8FB1' }) +
      el('rect', { x: sx, y: sy, width: Math.min(2, sw), height: sh, fill: '#FFC2D4', 'clip-path': `url(#${strawClipId})` }) +
      '</g>';
  }

  // --- Body: the glass, then its contents clipped to the inside of its border.
  out += el('path', { d: bottomRounded(0, bodyTop, width, bodyTop + bodyHeight, outerRadius), fill: 'rgba(255,255,255,0.6)' });
  defs += `<clipPath id="${clipId}">${el('path', { d: bottomRounded(px0, bodyTop, px1, pBottom, innerRadius) })}</clipPath>`;

  let inner = '';
  const level = Math.min(1, targetLevel);
  if (baseColor) {
    const lh = level * bodyHeight;
    const ly = pBottom - lh;
    inner += el('rect', { x: px0, y: ly, width: pw, height: lh, fill: baseColor });
    if (milk && milkyColor) inner += el('rect', { x: px0, y: ly, width: pw, height: lh, fill: milkyColor });
    if (detailed) {
      defs +=
        `<linearGradient id="${depthId}" x1="0" y1="0" x2="0" y2="1">` +
        '<stop offset="0" stop-color="#000000" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#000000" stop-opacity="0.16"/>' +
        '</linearGradient>';
      inner += el('rect', { x: px0, y: ly, width: pw, height: lh, fill: `url(#${depthId})` });
    }
    if (detailed && surface) {
      const wave = Array.from({ length: 4 }, (_, i) => {
        const x = (i * width) / 2;
        return `M${n(x)} 4 Q${n(x + width / 8)} 0 ${n(x + width / 4)} 4 T${n(x + width / 2)} 4`;
      }).join(' ');
      const wx = px0 - surfacePhase * width;
      const wy = ly - 3;
      const waveClip = uid('cupwave');
      defs += `<clipPath id="${waveClip}">${el('rect', { x: 0, y: 0, width: width * 2, height: 8 })}</clipPath>`;
      inner +=
        `<g transform="translate(${n(wx)} ${n(wy)})"><g clip-path="url(#${waveClip})">` +
        el('path', { d: wave, stroke: '#FFFFFF', 'stroke-opacity': 0.35, 'stroke-width': 1.5, fill: 'none' }) +
        '</g></g>';
    }
  }

  if (foam && targetLevel > 0) {
    const fh = bodyHeight * 0.14;
    const bottom = Math.min(0.88, targetLevel) * bodyHeight - 3;
    const fTop = pBottom - bottom - fh;
    inner += el('rect', { x: px0, y: fTop, width: pw, height: fh, fill: foam.color });
    const bump = fh * 0.8;
    const count = Math.ceil(width / (bump * 0.75));
    for (let i = 0; i < count; i++) {
      inner += el('circle', {
        cx: px0 + i * bump * 0.75 - bump * 0.2 + bump / 2,
        cy: fTop - bump * 0.4 + bump / 2,
        r: bump / 2,
        fill: foam.color,
      });
    }
  }

  if (ice) {
    const size = width * 0.24;
    for (const spot of ICE_SPOTS.slice(0, ice.cubes)) {
      const x = px0 + width * spot.x;
      const y = pBottom - bodyHeight * spot.y - size;
      const pad = 1 + 0.18 * (size - 2);
      const shineH = size * 0.12;
      inner +=
        `<g transform="rotate(${spot.rotate} ${n(x + size / 2)} ${n(y + size / 2)})">` +
        borderedRect(x, y, size, size, size * 0.2, 'rgba(255,255,255,0.55)', 1, 'rgba(255,255,255,0.95)') +
        el('rect', { x: x + pad, y: y + pad, width: size * 0.35, height: shineH, rx: shineH / 2, fill: 'rgba(255,255,255,0.9)' }) +
        '</g>';
    }
  }

  if (drink.toppings.length > 0) {
    const particle = Math.max(3, width * 0.11);
    const perRow = Math.max(1, Math.floor((width - inset * 2) / (particle * 1.05)));
    for (let i = 0; i < perRow * 2; i++) {
      const row = Math.floor(i / perRow);
      const topping = TOPPINGS.find((t) => t.id === drink.toppings[i % drink.toppings.length]);
      const left = inset + (i % perRow) * particle * 1.05 + (row % 2) * particle * 0.5;
      const bottom = stroke + row * particle * 0.85;
      const x = px0 + left;
      const y = pBottom - bottom - particle;
      const pearl = topping?.shape === 'pearl';
      inner += borderedRect(x, y, particle, particle, pearl ? particle / 2 : particle * 0.22, topping?.color ?? '#000', 1, 'rgba(0,0,0,0.15)');
      if (particle >= 6) {
        const r = particle * 0.15;
        inner += el('circle', {
          cx: x + 1 + 0.2 * (particle - 2) + r,
          cy: y + 1 + 0.15 * (particle - 2) + r,
          r,
          fill: 'rgba(255,255,255,0.55)',
        });
      }
    }
  }

  if (detailed) {
    const gx = px0 + inset + width * 0.06;
    const gy = bodyTop + bodyHeight * 0.08;
    const gw = width * 0.07;
    const gh = bodyHeight * 0.7;
    inner +=
      `<g transform="rotate(4 ${n(gx + gw / 2)} ${n(gy + gh / 2)})">` +
      el('rect', { x: gx, y: gy, width: gw, height: gh, rx: Math.min(6, gw / 2), fill: 'rgba(255,255,255,0.38)' }) +
      '</g>';
  }

  if (inner) out += `<g clip-path="url(#${clipId})">${inner}</g>`;

  // The body's border: the bottom alone on a tapered cup, a rounded U on a straight one.
  if (tapered) {
    out += el('rect', { x: 0, y: bodyTop + bodyHeight - stroke, width, height: stroke, fill: colors.cupOutline });
  } else {
    out += el('path', {
      d: `${bottomRounded(0, bodyTop, width, bodyTop + bodyHeight, outerRadius)} ${bottomRounded(px0, bodyTop, px1, pBottom, innerRadius)}`,
      fill: colors.cupOutline,
      'fill-rule': 'evenodd',
    });
  }

  // --- Background-coloured triangles taper the rectangle into a cup.
  if (tapered) {
    const bottomY = bodyTop + bodyHeight;
    out +=
      el('path', { d: `M0 ${n(bodyTop)} L0 ${n(bottomY)} L${n(inset)} ${n(bottomY)} Z`, fill: backgroundColor }) +
      el('path', { d: `M${n(width)} ${n(bodyTop)} L${n(width)} ${n(bottomY)} L${n(width - inset)} ${n(bottomY)} Z`, fill: backgroundColor });
    const sideLength = Math.sqrt(bodyHeight * bodyHeight + inset * inset);
    const sideAngle = (Math.atan2(inset, bodyHeight) * 180) / Math.PI;
    for (const dir of [-1, 1]) {
      const cx = dir < 0 ? inset / 2 : width - inset / 2;
      const cy = bodyTop + bodyHeight / 2;
      out += el('rect', {
        x: cx - stroke / 2,
        y: cy - sideLength / 2,
        width: stroke,
        height: sideLength,
        fill: colors.cupOutline,
        transform: `rotate(${n(dir * sideAngle)} ${n(cx)} ${n(cy)})`,
      });
    }
  }

  // --- Rim, or the sealed lid.
  if (sealed) {
    const sh = rimHeight * 1.9;
    const sy = oy - rimHeight * 0.6;
    out += borderedRect(-2, sy, width + 4, sh, rimHeight, '#FFF3F7', 1.5, colors.primary);
    const dotTop = sy + 1.5 + (sh - 3 - rimHeight) / 2;
    for (const x of [0.2, 0.5, 0.8]) {
      const left = -2 + 1.5 + x * (width + 4 - 3);
      out += el('circle', { cx: left + rimHeight / 2, cy: dotTop + rimHeight / 2, r: rimHeight / 2, fill: colors.primary, opacity: 0.7 });
    }
  } else {
    out += borderedRect(-2, oy, width + 4, rimHeight, rimHeight / 2, '#FFFFFF', 1, colors.cupOutline);
  }

  // --- The sweetness sticker. Its size is estimated, not measured (see `textWidth`).
  if (sweetness && detailed) {
    const label = `🍯${sweetness.name}`;
    const fontSize = Math.max(10, width * 0.11);
    const sw = textWidth(label, fontSize) + 8 + 2;
    const sh = fontSize * 1.602 + 2;
    const sx = inset + 2;
    const sy = oy + rimHeight + bodyHeight * 0.1;
    out +=
      `<g transform="rotate(-8 ${n(sx + sw / 2)} ${n(sy + sh / 2)})">` +
      borderedRect(sx, sy, sw, sh, 6, '#FFFFFF', 1, colors.cupOutline) +
      el('text', {
        x: sx + 1 + 4,
        y: sy + 1 + fontSize * 1.078,
        'font-family': FONT,
        'font-weight': FONT_WEIGHT.bold,
        'font-size': fontSize,
        fill: colors.ink,
      }, label.replace(/&/g, '&amp;').replace(/</g, '&lt;')) +
      '</g>';
  }

  const viewBox = `${n(-layout.originX)} ${n(-layout.originY)} ${n(layout.svgWidth)} ${n(layout.svgHeight)}`;
  return svgDoc(layout.svgWidth, layout.svgHeight, (defs ? `<defs>${defs}</defs>` : '') + out, viewBox);
}
