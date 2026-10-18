/**
 * The barista's side of the counter, below the customers on the Counter page: a slim wooden
 * counter top crowded with themed props over a row of varied cabinetry. Static.
 * Ported from `src/components/art/CounterTop.tsx`.
 */
import { el, n, svgDoc, uid } from './svg';
import { colors } from './theme';

// Wood + accent tones for the counter and cabinetry.
const WOOD_LIGHT = '#E7BB86';
const WOOD = colors.counter; // #D9A06B
const WOOD_EDGE = colors.counterEdge; // #B97F4C
const WOOD_DARK = '#9A6A3C';
const PANEL = '#C9915A';
const SEAM = '#7A5230';
const MINT = '#9FDCCB';
const MINT_DK = '#6FBFA9';

/** Returns `''` for an empty box, as the original renders nothing. */
export function counterTopSvg(width: number, height: number): string {
  if (height <= 0 || width <= 0) return '';
  const s = Math.min(1.15, width / 390);
  const surfaceH = Math.max(68, Math.min(86, Math.round(height * 0.26)));
  const slab = Math.max(10, Math.round(height * 0.04));
  const faceTop = surfaceH + slab;
  const base = surfaceH; // props sit on the front of the counter top

  const b = [0, 0.3, 0.52, 0.74, 1].map((f) => f * width);
  const cabTop = faceTop + Math.min(16, (height - faceTop) * 0.12);
  const cabBottom = height - 12;

  const surface = uid('ctSurface');
  const face = uid('ctFace');
  const overhang = uid('ctOverhang');
  let out =
    '<defs>' +
    `<linearGradient id="${surface}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WOOD_EDGE}"/><stop offset="1" stop-color="${WOOD_LIGHT}"/></linearGradient>` +
    `<linearGradient id="${face}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WOOD}"/><stop offset="1" stop-color="#B07A48"/></linearGradient>` +
    `<linearGradient id="${overhang}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2410" stop-opacity="0.3"/><stop offset="1" stop-color="#3A2410" stop-opacity="0"/></linearGradient>` +
    '</defs>';

  // Counter top (flat), with straight grain and a lit near edge.
  out += el('rect', { width, height: surfaceH, fill: `url(#${surface})` });
  for (let i = 0; i < 3; i++) {
    out += el('rect', { y: (i + 1) * (surfaceH / 4), width, height: 1.3, fill: WOOD_EDGE, opacity: 0.14 });
  }

  // Slab (the counter's thickness): lit top, shadowed underside.
  out += el('rect', { y: surfaceH, width, height: slab, fill: colors.counterLight });
  out += el('rect', { y: surfaceH, width, height: 2.5, fill: '#FFE6C8', opacity: 0.75 });
  out += el('rect', { y: surfaceH + slab - 2, width, height: 2, fill: SEAM, opacity: 0.6 });

  // Cabinet body + overhang shadow.
  out += el('rect', { y: faceTop, width, height: height - faceTop, fill: `url(#${face})` });
  out += el('rect', { y: faceTop, width, height: Math.min(14, (height - faceTop) * 0.18), fill: `url(#${overhang})` });

  // Varied cabinetry.
  out += doubleCabinet(b[0], b[1], cabTop, cabBottom);
  out += drawerUnit(b[1], b[2], cabTop, cabBottom);
  out += coldBox(b[2], b[3], cabTop, cabBottom, s);
  out += doubleCabinet(b[3], b[4], cabTop, cabBottom);

  // Order tickets pinned to the apron above the drawers; a towel over the first divider.
  out += notes((b[1] + b[2]) / 2, faceTop + 2, s);
  out += towel(b[1], surfaceH + slab, s);

  // Recessed toe-kick.
  out += el('rect', { y: height - 12, width, height: 12, fill: '#5E3C22' });
  out += el('rect', { y: height - 12, width, height: 2, fill: '#3A2410', opacity: 0.6 });

  // Themed props crowding the counter top, left to right.
  out += register(width * 0.11, base, s * 0.88);
  out += cupStack(width * 0.23, base, s * 0.78);
  out += tipJar(width * 0.34, base, s * 0.84);
  out += luckyCat(width * 0.47, base, s * 0.8);
  out += strawCup(width * 0.58, base, s * 0.78);
  out += napkinBox(width * 0.69, base, s * 0.82);
  out += milkCarton(width * 0.85, base, s * 0.88);

  return svgDoc(width, height, out);
}

// ---------------------------------------------------------------------------- cabinetry

function doubleCabinet(x0: number, x1: number, top: number, bottom: number): string {
  const pad = 8;
  const gap = 7;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const doorW = (w - gap) / 2;
  let out = '<g>';
  for (const i of [0, 1]) {
    const dx = x + i * (doorW + gap);
    const handleX = i === 0 ? dx + doorW - 8 : dx + 8;
    out += door(dx, top, doorW, h, handleX);
  }
  return `${out}</g>`;
}

function door(x: number, y: number, w: number, h: number, handleX: number): string {
  const rail = Math.min(12, w * 0.16);
  return (
    '<g>' +
    el('rect', { x, y, width: w, height: h, rx: 5, fill: WOOD }) +
    el('rect', { x, y, width: w, height: 2, fill: '#F0CDA0', opacity: 0.6 }) +
    el('rect', { x, y: y + h - 2, width: w, height: 2, fill: WOOD_DARK, opacity: 0.6 }) +
    el('rect', { x: x + rail, y: y + rail, width: w - rail * 2, height: h - rail * 2, rx: 4, fill: PANEL }) +
    el('rect', { x: x + rail, y: y + rail, width: w - rail * 2, height: 2, fill: WOOD_DARK, opacity: 0.55 }) +
    el('rect', { x: x + rail, y: y + h - rail - 2, width: w - rail * 2, height: 2, fill: '#E7BB86', opacity: 0.55 }) +
    el('rect', { x: handleX - 2, y: y + h * 0.44, width: 4, height: h * 0.12, rx: 2, fill: '#E8DCCB' }) +
    '</g>'
  );
}

function drawerUnit(x0: number, x1: number, top: number, bottom: number): string {
  const pad = 8;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const count = 3;
  const gap = 6;
  const dh = (h - gap * (count - 1)) / count;
  let out = '<g>';
  for (let i = 0; i < count; i++) {
    const y = top + i * (dh + gap);
    out +=
      '<g>' +
      el('rect', { x, y, width: w, height: dh, rx: 5, fill: WOOD }) +
      el('rect', { x, y, width: w, height: 2, fill: '#F0CDA0', opacity: 0.55 }) +
      el('rect', { x, y: y + dh - 2, width: w, height: 2, fill: WOOD_DARK, opacity: 0.6 }) +
      // bar pull
      el('rect', { x: x + w * 0.3, y: y + dh * 0.42, width: w * 0.4, height: 4, rx: 2, fill: '#E8DCCB' }) +
      '</g>';
  }
  return `${out}</g>`;
}

/** A cat-themed cold box / mini-fridge. */
function coldBox(x0: number, x1: number, top: number, bottom: number, s: number): string {
  const pad = 8;
  const x = x0 + pad;
  const w = x1 - x0 - pad * 2;
  const h = bottom - top;
  const cx = x + w / 2;
  let out =
    '<g>' +
    el('rect', { x, y: top, width: w, height: h, rx: 8, fill: MINT }) +
    el('rect', { x, y: top, width: w, height: h, rx: 8, fill: 'none', stroke: MINT_DK, 'stroke-width': 2 }) +
    // lid line
    el('rect', { x: x + 5, y: top + h * 0.34, width: w - 10, height: 2.5, rx: 1, fill: MINT_DK, opacity: 0.7 }) +
    // frosty window
    el('rect', { x: x + w * 0.2, y: top + h * 0.1, width: w * 0.6, height: h * 0.18, rx: 5, fill: '#DFF5EF' });
  for (const i of [0, 1, 2]) {
    out += el('rect', { x: x + w * (0.28 + i * 0.16), y: top + h * 0.13, width: 3, height: h * 0.12, rx: 1.5, fill: MINT_DK, opacity: 0.5 });
  }
  // paw badge
  out +=
    `<g transform="translate(${n(cx)} ${n(top + h * 0.64)}) scale(${n(s)})">` +
    '<ellipse cx="0" cy="2" rx="7" ry="6" fill="#FFFFFF"/>' +
    '<ellipse cx="-5" cy="-5" rx="2" ry="2.6" fill="#FFFFFF"/>' +
    '<ellipse cx="0" cy="-7" rx="2" ry="2.6" fill="#FFFFFF"/>' +
    '<ellipse cx="5" cy="-5" rx="2" ry="2.6" fill="#FFFFFF"/>' +
    '</g>';
  // handle
  out += el('rect', { x: x + w - 12, y: top + h * 0.42, width: 4, height: h * 0.16, rx: 2, fill: '#FFFFFF' });
  return `${out}</g>`;
}

/** Pinned order-ticket cards on the apron. */
function notes(x: number, y: number, s: number): string {
  let out = '<g>';
  for (const d of [-1, 0, 1]) {
    const cx = x + d * 22 * s;
    const cy = y + (d === 0 ? 0 : 1 * s);
    out += '<g>';
    out += el('rect', { x: cx - 9 * s, y: cy, width: 18 * s, height: 22 * s, rx: 2 * s, fill: '#FFFDF2', stroke: colors.line, 'stroke-width': 1 });
    for (const i of [0, 1, 2]) {
      out += el('rect', { x: cx - 6 * s, y: cy + (5 + i * 4) * s, width: 12 * s, height: 1.6 * s, rx: 0.8 * s, fill: colors.inkSoft, opacity: 0.6 });
    }
    // clip
    out += el('rect', { x: cx - 4 * s, y: cy - 3 * s, width: 8 * s, height: 4 * s, rx: 1.5 * s, fill: colors.counterDark });
    out += '</g>';
  }
  return `${out}</g>`;
}

/** A dish towel hanging over the counter edge. */
function towel(x: number, y: number, s: number): string {
  const w = 22 * s;
  const h = 46 * s;
  return (
    '<g>' +
    el('rect', { x: x - w / 2, y: y - 3 * s, width: w, height: h, rx: 4 * s, fill: colors.primary }) +
    el('rect', { x: x - w / 2, y: y - 3 * s, width: w, height: h, rx: 4 * s, fill: 'none', stroke: colors.primaryDark, 'stroke-width': 1.5, opacity: 0.5 }) +
    el('rect', { x: x - w / 2, y: y + h - 10 * s, width: w, height: 2.5 * s, fill: '#FFFFFF', opacity: 0.7 }) +
    el('rect', { x: x - w / 2, y: y + h - 6 * s, width: w, height: 2.5 * s, fill: '#FFFFFF', opacity: 0.7 }) +
    // fold over the edge
    el('rect', { x: x - w / 2, y: y - 4 * s, width: w, height: 6 * s, rx: 3 * s, fill: colors.primaryDark }) +
    '</g>'
  );
}

// ---------------------------------------------------------------------------- counter props

function shadow(cx: number, cy: number, rx: number): string {
  return el('ellipse', { cx, cy, rx, ry: rx * 0.26, fill: '#000000', opacity: 0.1 });
}

function register(cx: number, cy: number, scale: number): string {
  const w = 54 * scale;
  const h = 38 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  let out =
    '<g>' +
    shadow(cx, cy, w * 0.52) +
    el('rect', { x, y: y + 10 * scale, width: w, height: h - 10 * scale, rx: 5 * scale, fill: colors.primary }) +
    el('rect', { x, y: y + h - 8 * scale, width: w, height: 8 * scale, rx: 4 * scale, fill: colors.primaryDark }) +
    el('rect', { x: cx - 3 * scale, y: y - 2 * scale, width: 6 * scale, height: 14 * scale, fill: colors.counterEdge }) +
    el('rect', { x: x + 6 * scale, y: y - 18 * scale, width: w - 12 * scale, height: 20 * scale, rx: 4 * scale, fill: '#3E5A4C' }) +
    el('rect', { x: x + 10 * scale, y: y - 14 * scale, width: w - 20 * scale, height: 12 * scale, rx: 2 * scale, fill: '#9FE6C8' });
  for (const r of [0, 1, 2]) {
    for (const c of [0, 1, 2, 3]) {
      out += el('rect', { x: x + (6 + c * 11) * scale, y: y + (15 + r * 7) * scale, width: 8 * scale, height: 5 * scale, rx: 1.5 * scale, fill: '#FFFFFF', opacity: 0.9 });
    }
  }
  return `${out}</g>`;
}

function tipJar(cx: number, cy: number, scale: number): string {
  const w = 32 * scale;
  const h = 42 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  const k = (v: number) => n(v * scale);
  return (
    '<g>' +
    shadow(cx, cy, w * 0.6) +
    el('rect', { x, y: y + 6 * scale, width: w, height: h - 6 * scale, rx: 6 * scale, fill: '#CDEFFF', opacity: 0.75 }) +
    el('rect', { x, y: y + 6 * scale, width: w, height: h - 6 * scale, rx: 6 * scale, fill: 'none', stroke: '#B4E0F2', 'stroke-width': 2 * scale }) +
    el('rect', { x: x - 2 * scale, y, width: w + 4 * scale, height: 8 * scale, rx: 3 * scale, fill: '#E8F7FF' }) +
    el('ellipse', { cx: cx - 6 * scale, cy: y + h - 10 * scale, rx: 6 * scale, ry: 3 * scale, fill: colors.gold }) +
    el('ellipse', { cx: cx + 6 * scale, cy: y + h - 8 * scale, rx: 6 * scale, ry: 3 * scale, fill: colors.gold }) +
    el('ellipse', { cx, cy: y + h - 14 * scale, rx: 6 * scale, ry: 3 * scale, fill: colors.goldDark }) +
    el('path', {
      d: `M${n(cx)} ${n(y + 20 * scale)} c${k(-3)} ${k(-4)} ${k(-9)} ${k(-1)} ${k(-5)} ${k(4)} l${k(5)} ${k(5)} l${k(5)} ${k(-5)} c${k(4)} ${k(-5)} ${k(-2)} ${k(-8)} ${k(-5)} ${k(-4)} Z`,
      fill: colors.primary,
    }) +
    '</g>'
  );
}

function strawCup(cx: number, cy: number, scale: number): string {
  const w = 26 * scale;
  const h = 30 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  const straws: [number, string][] = [
    [-7, colors.primary],
    [0, colors.mintDark],
    [7, colors.gold],
    [-3, colors.primaryDark],
    [4, colors.mint],
  ];
  let out = `<g>${shadow(cx, cy, w * 0.66)}`;
  straws.forEach(([dx, col], i) => {
    out += el('rect', { x: cx + dx * scale - 1.5 * scale, y: y - 14 * scale + (i % 2) * 3 * scale, width: 3 * scale, height: 22 * scale, rx: 1.5 * scale, fill: col });
  });
  const d = `M${n(x)} ${n(y)} h${n(w)} l${n(-2 * scale)} ${n(h)} h${n(-(w - 4 * scale))} Z`;
  out += el('path', { d, fill: '#FFFFFF' });
  out += el('path', { d, fill: 'none', stroke: colors.line, 'stroke-width': 2 * scale });
  out += el('rect', { x: x + 3 * scale, y: y + 8 * scale, width: w - 6 * scale, height: 6 * scale, rx: 2 * scale, fill: colors.primaryTint });
  return `${out}</g>`;
}

function napkinBox(cx: number, cy: number, scale: number): string {
  const w = 40 * scale;
  const h = 22 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  const d = `M${n(cx - 8 * scale)} ${n(y + 6 * scale)} h${n(16 * scale)} l${n(-3 * scale)} ${n(-9 * scale)} h${n(-10 * scale)} Z`;
  return (
    '<g>' +
    shadow(cx, cy, w * 0.56) +
    el('rect', { x, y, width: w, height: h, rx: 4 * scale, fill: colors.mint }) +
    el('rect', { x, y, width: w, height: h, rx: 4 * scale, fill: 'none', stroke: colors.mintDark, 'stroke-width': 2 * scale }) +
    el('rect', { x: x + 8 * scale, y: y + 6 * scale, width: w - 16 * scale, height: 4 * scale, rx: 2 * scale, fill: colors.mintDark }) +
    el('path', { d, fill: '#FFFFFF' }) +
    el('path', { d, fill: 'none', stroke: colors.line, 'stroke-width': 1.2 * scale }) +
    '</g>'
  );
}

function cupStack(cx: number, cy: number, scale: number): string {
  const w = 30 * scale;
  const h = 34 * scale;
  const x = cx - w / 2;
  const y = cy - h;
  let out = `<g>${shadow(cx, cy, w * 0.64)}`;
  for (const i of [0, 1, 2]) {
    out += el('rect', {
      x: x - i * 2 * scale, y: y + i * 7 * scale, width: w + i * 4 * scale, height: 9 * scale, rx: 4 * scale,
      fill: i % 2 === 0 ? '#FFFFFF' : colors.primaryTint, stroke: colors.line, 'stroke-width': 1.5 * scale,
    });
  }
  out += el('path', {
    d: `M${n(x - 4 * scale)} ${n(y + 16 * scale)} h${n(w + 8 * scale)} l${n(-3 * scale)} ${n(h - 16 * scale)} h${n(-(w + 2 * scale))} Z`,
    fill: '#FFFFFF', stroke: colors.line, 'stroke-width': 1.5 * scale,
  });
  return `${out}</g>`;
}

/** A maneki-neko (lucky cat). */
function luckyCat(cx: number, cy: number, scale: number): string {
  const edge = colors.counterEdge;
  return (
    `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(scale)})">` +
    shadow(0, 0, 20) +
    // body
    `<path d="M-15 0 C-15 -20 -10 -30 0 -30 C10 -30 15 -20 15 0 Z" fill="#FFFFFF" stroke="${edge}" stroke-width="1.5"/>` +
    // head
    `<ellipse cx="0" cy="-30" rx="15" ry="13" fill="#FFFFFF" stroke="${edge}" stroke-width="1.5"/>` +
    // ears
    `<path d="M-14 -38 l-3 -9 l8 4 Z" fill="#FFFFFF" stroke="${edge}" stroke-width="1.5"/>` +
    `<path d="M14 -38 l3 -9 l-8 4 Z" fill="#FFFFFF" stroke="${edge}" stroke-width="1.5"/>` +
    `<path d="M-13 -40 l-1.5 -5 l4.5 2 Z" fill="${colors.primaryTint}"/>` +
    `<path d="M13 -40 l1.5 -5 l-4.5 2 Z" fill="${colors.primaryTint}"/>` +
    // face
    `<path d="M-6 -32 q2 2 4 0" stroke="${colors.ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M2 -32 q2 2 4 0" stroke="${colors.ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M0 -29 l-1.5 2 h3 Z" fill="${colors.primary}"/>` +
    // raised paw
    `<ellipse cx="11" cy="-14" rx="5" ry="6" fill="#FFFFFF" stroke="${edge}" stroke-width="1.5"/>` +
    // gold collar + coin
    `<path d="M-9 -20 q9 7 18 0" stroke="${colors.goldDark}" stroke-width="2.5" fill="none"/>` +
    `<ellipse cx="0" cy="-14" rx="5" ry="6" fill="${colors.gold}" stroke="${colors.goldDark}" stroke-width="1.5"/>` +
    '</g>'
  );
}

/** A tall milk carton. */
function milkCarton(cx: number, cy: number, scale: number): string {
  const w = 34 * scale;
  const bodyH = 48 * scale;
  const roofH = 14 * scale;
  const x = cx - w / 2;
  const y = cy - bodyH;
  const k = (v: number) => n(v * scale);
  return (
    '<g>' +
    shadow(cx, cy, w * 0.62) +
    // body
    el('rect', { x, y, width: w, height: bodyH, rx: 2 * scale, fill: '#FFFFFF', stroke: colors.line, 'stroke-width': 1.5 }) +
    // gable roof
    el('path', { d: `M${n(x)} ${n(y)} L${n(cx)} ${n(y - roofH)} L${n(x + w)} ${n(y)} Z`, fill: '#F3F7FF', stroke: colors.line, 'stroke-width': 1.5 }) +
    el('rect', { x: cx - 2 * scale, y: y - roofH, width: 4 * scale, height: 5 * scale, fill: '#E4ECF7' }) +
    // label
    el('rect', { x: x + 4 * scale, y: y + bodyH * 0.3, width: w - 8 * scale, height: bodyH * 0.42, rx: 3 * scale, fill: colors.primaryTint }) +
    el('path', { d: `M${n(cx - 10 * scale)} ${n(y + bodyH * 0.54)} h${k(20)}`, stroke: colors.primaryDark, 'stroke-width': 3 * scale, 'stroke-linecap': 'round' }) +
    el('path', { d: `M${n(cx - 7 * scale)} ${n(y + bodyH * 0.66)} h${k(14)}`, stroke: colors.primary, 'stroke-width': 2 * scale, 'stroke-linecap': 'round', opacity: 0.8 }) +
    // a splash/drop icon
    el('path', {
      d: `M${n(cx)} ${n(y + bodyH * 0.4)} c${k(-3)} ${k(3)} ${k(-3)} ${k(7)} 0 ${k(7)} c${k(3)} 0 ${k(3)} ${k(-4)} 0 ${k(-7)} Z`,
      fill: '#FFFFFF',
    }) +
    '</g>'
  );
}
