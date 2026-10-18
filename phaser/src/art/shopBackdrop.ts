/**
 * The wall behind the customers: striped wallpaper, a window with slowly drifting clouds, lamps
 * and a menu board. Ported from `src/components/art/ShopBackdrop.tsx`.
 *
 * The clouds move, so they are not in the picture: a scene draws `cloudSvg` itself, at
 * `cloudX(progress, …)` inside `backdropWindow(…)`, cropped to that window's rounded rectangle
 * (the original puts them in a `View` with `overflow: hidden` and `borderRadius: 7`).
 *
 * In the original the clouds pass *behind* the window's cross-bars, sill, plant and lamps, so the
 * drawing comes in two layers: `'back'` (everything under the clouds) and `'front'` (a transparent
 * sheet with what goes over them). `'all'` is both at once, for a still with no clouds.
 */
import { el, n, svgDoc, uid } from './svg';
import { colors, FONT, FONT_WEIGHT } from './theme';

export type BackdropLayer = 'all' | 'back' | 'front';

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius of the glass, which is what the clouds are cropped to. */
  radius: number;
}

export interface CloudSpec {
  /** Top of the cloud, in the window's own coordinates. */
  top: number;
  /** The cloud is `size * 1.5` wide and `size * 0.8` tall. */
  size: number;
  /** One full pass across the window, in ms (linear). */
  duration: number;
  /** Where in its pass the cloud starts, 0–1. It finishes that pass, then loops from 0. */
  offset: number;
}

const AWNING = 16;

/** The window's glass, in backdrop coordinates. */
export function backdropWindow(width: number, height: number): WindowRect {
  return { x: width * 0.05, y: AWNING + 16, w: Math.min(120, width * 0.3), h: height * 0.42, radius: 7 };
}

/** The two clouds the original drifts across the window. */
export function backdropClouds(width: number, height: number): CloudSpec[] {
  const win = backdropWindow(width, height);
  return [
    { top: win.h * 0.12, size: 30, duration: 16000, offset: 0.15 },
    { top: win.h * 0.5, size: 22, duration: 22000, offset: 0.65 },
  ];
}

/** A cloud's left edge, in the window's coordinates, at `progress` (0–1) through its pass. */
export function cloudX(progress: number, windowWidth: number, size: number): number {
  const travel = windowWidth + size * 2;
  return progress * travel - size * 1.5;
}

/** One cloud, `size * 1.5` × `size * 0.8`. */
export function cloudSvg(size: number, fill = '#FFFFFF'): string {
  return svgDoc(size * 1.5, size * 0.8,
    `<path d="M6 15 C1 15 1 9 6 9 C6 4 13 2 15 6 C17 2 25 3 24 9 C29 9 29 15 24 15 Z" fill="${fill}"/>`,
    '0 0 30 16');
}

export function shopBackdropSvg(width: number, height: number, layer: BackdropLayer = 'all'): string {
  let body = '';
  if (layer !== 'front') body += back(width, height);
  if (layer !== 'back') body += front(width, height);
  return svgDoc(width, height, body);
}

function back(width: number, height: number): string {
  const stripe = 22;
  const awning = AWNING;
  const win = backdropWindow(width, height);
  const board = { w: Math.min(104, width * 0.27), h: height * 0.4 };
  const boardX = width - board.w - width * 0.05;
  const boardY = awning + 14;
  const wainscot = height * 0.6;
  const sky = uid('sky');

  let out =
    `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${colors.sky}"/><stop offset="1" stop-color="${colors.skyLow}"/>` +
    '</linearGradient></defs>';
  out += el('rect', { width, height, fill: colors.wall });
  for (let i = 0; i < Math.ceil(width / stripe / 2); i++) {
    out += el('rect', { x: i * stripe * 2, width: stripe, height: wainscot, fill: colors.wallStripe });
  }
  out += el('rect', { y: wainscot, width, height: height - wainscot, fill: '#F9C9D8' });
  out += el('rect', { y: wainscot, width, height: 4, fill: '#F3B3C7' });

  out += el('rect', { x: win.x - 4, y: win.y - 4, width: win.w + 8, height: win.h + 8, rx: 10, fill: '#FFFFFF' });
  out += el('rect', { x: win.x, y: win.y, width: win.w, height: win.h, rx: 7, fill: `url(#${sky})` });
  out += el('circle', { cx: win.x + win.w * 0.78, cy: win.y + win.h * 0.3, r: 8, fill: '#FFE27A' });

  let boardInner =
    el('rect', { x: boardX, y: boardY, width: board.w, height: board.h, rx: 8, fill: colors.counterEdge }) +
    el('rect', { x: boardX + 4, y: boardY + 4, width: board.w - 8, height: board.h - 8, rx: 5, fill: '#3E5A4C' }) +
    el('text', {
      x: boardX + board.w / 2,
      y: boardY + 20,
      fill: '#FFFFFF',
      'font-size': 13,
      'font-family': FONT,
      'font-weight': FONT_WEIGHT.display,
      'text-anchor': 'middle',
    }, 'MENU');
  for (const row of [0, 1, 2]) {
    boardInner +=
      '<g>' +
      el('rect', { x: boardX + 10, y: boardY + 28 + row * 10, width: board.w * 0.42, height: 2.5, rx: 1, fill: '#FFFFFF', opacity: 0.75 }) +
      el('rect', { x: boardX + board.w - 26, y: boardY + 28 + row * 10, width: 14, height: 2.5, rx: 1, fill: '#FFD36E', opacity: 0.9 }) +
      '</g>';
  }
  out += `<g transform="rotate(-3 ${n(boardX + board.w / 2)} ${n(boardY + board.h / 2)})">${boardInner}</g>`;

  // Scalloped awning along the top.
  out += el('rect', { width, height: awning * 0.6, fill: colors.primary });
  for (let i = 0; i < Math.ceil(width / 24); i++) {
    out += el('path', {
      d: `M${i * 24} ${n(awning * 0.55)} h24 a12 12 0 0 1 -24 0 Z`,
      fill: i % 2 === 0 ? colors.primary : '#FFFFFF',
    });
  }
  return out;
}

function front(width: number, height: number): string {
  const win = backdropWindow(width, height);
  let out = '';
  out += el('rect', { x: win.x + win.w / 2 - 2, y: win.y, width: 4, height: win.h, fill: '#FFFFFF' });
  out += el('rect', { x: win.x, y: win.y + win.h / 2 - 2, width: win.w, height: 4, fill: '#FFFFFF' });
  out += el('rect', { x: win.x - 8, y: win.y + win.h + 2, width: win.w + 16, height: 7, rx: 3, fill: '#FFFFFF' });
  out += plant(win.x + win.w - 22, win.y + win.h - 20);
  out += lamp(width * 0.4, AWNING - 2);
  out += lamp(width * 0.6 - 22, AWNING - 2);
  return out;
}

/** A hanging lamp, 22×40, as a group at (left, top). */
function lamp(left: number, top: number): string {
  return (
    `<g transform="translate(${n(left)} ${n(top)})">` +
    '<rect x="10.25" y="0" width="1.5" height="20" fill="#9C6638"/>' +
    '<circle cx="11" cy="33" r="7" fill="#FFF3B0" opacity="0.6"/>' +
    '<path d="M3 30 L7 20 H15 L19 30 Z" fill="#FFFFFF" stroke="#F3B3C7" stroke-width="1"/>' +
    '<circle cx="11" cy="31" r="3" fill="#FFE27A"/>' +
    '</g>'
  );
}

/** The potted plant on the sill, 20×22, as a group at (left, top). */
function plant(left: number, top: number): string {
  return (
    `<g transform="translate(${n(left)} ${n(top)})">` +
    '<path d="M10 12 C4 10 3 4 5 2 C9 4 10 8 10 12 Z" fill="#7CC47F"/>' +
    '<path d="M10 12 C16 10 17 4 15 2 C11 4 10 8 10 12 Z" fill="#5FAE63"/>' +
    '<path d="M10 13 C8 7 10 3 10 1 C12 5 12 9 10 13 Z" fill="#8FD392"/>' +
    '<path d="M4 12 H16 L14 21 H6 Z" fill="#E98E6B"/>' +
    '</g>'
  );
}
