/**
 * The small inline drawings scattered through the screens, as SVG markup:
 *
 * - the counter — the bubble's pointer, the order pad, the patience ring, the rising heart and the
 *   puff of steam;
 * - `OrderBubble.tsx` — the patience heart that empties from the top;
 * - `Hud.tsx` — the clock;
 * - `DayEndScreen.tsx` — the stars and the sun rays;
 * - `TitleScreen.tsx` — the striped wallpaper, the scattered pearls and the awning;
 * - `Effects.tsx` — the coin and a confetti piece.
 *
 * Anything whose shape the original animates through ordinary renders (the ring's arc, the
 * heart's level, the clock's hand) takes that value as a parameter: re-render at the new value.
 */
import { el, n, svgDoc, uid } from './svg';
import { colors, FONT, FONT_WEIGHT } from './theme';

// ------------------------------------------------------------------ CustomerStage

/** The little downward arrow over a customer's bubble, 16×10. Gold while asking, pink once picked. */
export function bubblePointerSvg(color: string): string {
  return svgDoc(16, 10, `<path d="M1 1 H15 L8 9 Z" fill="${color}"/>`, '0 0 16 10');
}

/** `bubblePointerSvg`'s colour, as the stage picks it. */
export function bubblePointerColor(requesting: boolean): string {
  return requesting ? colors.gold : colors.primary;
}

/** The order pad shown over a customer who wants to order. 26×30 at the default width. */
export function orderPadSvg(width = 26): string {
  return svgDoc(width, (width * 30) / 26,
    `<path d="M5 3 H21 A2 2 0 0 1 23 5 V27 H3 V5 A2 2 0 0 1 5 3 Z" fill="#FFFDF6" stroke="${colors.primary}" stroke-width="1.6"/>` +
    `<path d="M7 1 V5 M13 1 V5 M19 1 V5" stroke="${colors.primaryDark}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M7 12 H19 M7 17 H19 M7 22 H15" stroke="${colors.line}" stroke-width="1.6" stroke-linecap="round"/>`,
    '0 0 26 30');
}

/** The patience ring's colour for a given fraction left, as the stage picks it. */
export function patienceRingColor(fraction: number): string {
  return fraction > 0.6 ? colors.good : fraction > 0.3 ? colors.ok : colors.bad;
}

/** The ring of patience left on a customer's bubble, 20×20 at the default size. */
export function patienceRingSvg(fraction: number, color: string, size = 20): string {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  return svgDoc(size, size,
    '<circle cx="10" cy="10" r="9.5" fill="#FFFFFF"/>' +
    `<circle cx="10" cy="10" r="${radius}" stroke="#EFE3D8" stroke-width="3" fill="none"/>` +
    el('circle', {
      cx: 10, cy: 10, r: radius, stroke: color, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round',
      'stroke-dasharray': `${n(circumference)} ${n(circumference)}`,
      'stroke-dashoffset': circumference * (1 - fraction),
      transform: 'rotate(-90 10 10)',
    }),
    '0 0 20 20');
}

/** The heart that rises off a delighted customer, 18×16. */
export function risingHeartSvg(): string {
  return svgDoc(18, 16,
    '<path d="M8 13 C2 9 0 6 0 3.8 C0 1.6 1.8 0 3.9 0 C5.6 0 7 1 8 2.4 C9 1 10.4 0 12.1 0 C14.2 0 16 1.6 16 3.8 C16 6 14 9 8 13 Z" fill="#FF5C8A"/>',
    '0 0 16 14');
}

/** The puff of steam that rises off an angry customer, 24×14. */
export function steamPuffSvg(): string {
  return svgDoc(24, 14,
    '<path d="M6 15 C1 15 1 9 6 9 C6 4 13 2 15 6 C17 2 25 3 24 9 C29 9 29 15 24 15 Z" fill="#9AA0A6"/>',
    '0 0 30 16');
}

// ------------------------------------------------------------------ OrderBubble

const HEART =
  'M12 21.1 C5.6 16.8 2.2 13.2 2.2 9.3 C2.2 6.2 4.6 3.9 7.6 3.9 C9.5 3.9 11.1 4.8 12 6.3 ' +
  'C12.9 4.8 14.5 3.9 16.4 3.9 C19.4 3.9 21.8 6.2 21.8 9.3 C21.8 13.2 18.4 16.8 12 21.1 Z';

/** The patience heart's colour for a given fraction left. */
export function patienceHeartColor(left: number): string {
  const p = Math.max(0, Math.min(1, left));
  return p > 0.55 ? colors.primary : p > 0.28 ? colors.ok : colors.bad;
}

/** The customer's patience on the order card, as a heart emptying from the top (`left` 0–1). */
export function patienceHeartSvg(left: number, size: number): string {
  const p = Math.max(0, Math.min(1, left));
  const tone = patienceHeartColor(p);
  const mask = uid('patience');
  return svgDoc(size, size,
    `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">` +
    el('rect', { x: 0, y: 24 * (1 - p), width: 24, height: 24 * p, fill: '#FFFFFF' }) +
    '</mask></defs>' +
    `<path d="${HEART}" fill="#FFFFFF"/>` +
    `<path d="${HEART}" fill="${tone}" mask="url(#${mask})"/>` +
    `<path d="${HEART}" fill="none" stroke="${tone}" stroke-width="1.8" stroke-linejoin="round"/>`,
    '0 0 24 24');
}

// ------------------------------------------------------------------ Hud

/** The HUD's clock: the hand sweeps once as the day's `fraction` runs from 1 to 0. 18×18 by default. */
export function clockIconSvg(fraction: number, warm: boolean, size = 18): string {
  const angle = (1 - fraction) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  return svgDoc(size, size,
    el('circle', { cx: 10, cy: 10, r: 8.5, fill: '#FFFFFF', stroke: warm ? '#AC8655' : colors.primaryDark, 'stroke-width': 2 }) +
    el('path', {
      d: `M10 10 L${n(10 + Math.cos(rad) * 5.5)} ${n(10 + Math.sin(rad) * 5.5)}`,
      stroke: warm ? '#7B874B' : colors.primary, 'stroke-width': 2.2, 'stroke-linecap': 'round',
    }) +
    `<circle cx="10" cy="10" r="1.5" fill="${colors.ink}"/>`,
    '0 0 20 20');
}

// ------------------------------------------------------------------ DayEndScreen

/** A day-end star, earned (gold, with a glint) or not. The original is 64 (big) or 48. */
export function starSvg(earned: boolean, size: number): string {
  return svgDoc(size, size,
    el('path', {
      d: 'M12 1.8 L15 8.3 L22 9.1 L16.8 13.9 L18.3 20.9 L12 17.3 L5.7 20.9 L7.2 13.9 L2 9.1 L9 8.3 Z',
      fill: earned ? colors.gold : '#EADBCB',
      stroke: earned ? colors.goldDark : '#D9C6B3',
      'stroke-width': 1.4,
      'stroke-linejoin': 'round',
    }) +
    (earned ? '<path d="M9 9.5 L10.5 6.5" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>' : ''),
    '0 0 24 24');
}

/**
 * The faint sun rays behind the day-end card. The original sizes them `screenWidth * 1.8` and
 * centres them at (screenWidth / 2, 130).
 */
export function sunRaysSvg(size: number): string {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 24;
    const r = 50;
    return `M50 50 L${n(50 + Math.cos(a) * r)} ${n(50 + Math.sin(a) * r)} L${n(50 + Math.cos(b) * r)} ${n(50 + Math.sin(b) * r)} Z`;
  }).join(' ');
  return svgDoc(size, size, `<path d="${rays}" fill="#FFFFFF" opacity="0.45"/>`, '0 0 100 100');
}

// ------------------------------------------------------------------ TitleScreen

/** The title screen's wallpaper: 22px stripes every 44px, over the wall colour unless `background` is false. */
export function titleWallpaperSvg(width: number, height: number, background = true): string {
  let body = background ? el('rect', { width, height, fill: colors.wall }) : '';
  for (let i = 0; i < Math.ceil(width / 44); i++) body += el('rect', { x: i * 44, width: 22, height, fill: colors.wallStripe });
  return svgDoc(width, height, body);
}

/** The few still tapioca pearls scattered over the title wallpaper (they are `View`s there). */
export function titlePearlsSvg(width: number, height: number): string {
  let body = '';
  for (let i = 0; i < 10; i++) {
    const x = (((i * 53) % 100) / 100) * width;
    const y = (((i * 29 + 11) % 100) / 100) * height;
    const size = 10 + ((i * 7) % 14);
    body +=
      '<g opacity="0.12">' +
      el('circle', { cx: x + size / 2, cy: y + size / 2, r: size / 2, fill: '#3A2318' }) +
      el('circle', { cx: x + size * 0.22 + size * 0.15, cy: y + size * 0.18 + size * 0.15, r: size * 0.15, fill: '#FFFFFF' }) +
      '</g>';
  }
  return svgDoc(width, height, body);
}

/** The title screen's scalloped awning, `width` × 44. */
export function titleAwningSvg(width: number): string {
  let body = el('rect', { width, height: 22, fill: colors.primary });
  for (let i = 0; i < Math.ceil(width / 32); i++) {
    body += el('path', { d: `M${i * 32} 20 h32 a16 16 0 0 1 -32 0 Z`, fill: i % 2 === 0 ? colors.primary : '#FFFFFF' });
  }
  return svgDoc(width, 44, body);
}

// ------------------------------------------------------------------ Effects

/**
 * A coin with "đ" on it (`Coin` in `Effects.tsx`, a `View` there). The glyph is in Baloo 2 when
 * the SVG is inline; rasterised through an `Image`, it falls back to the system face.
 */
export function coinSvg(size: number): string {
  const border = Math.max(1.5, size * 0.1);
  return svgDoc(size, size,
    el('circle', { cx: size / 2, cy: size / 2, r: size / 2, fill: colors.gold }) +
    el('circle', { cx: size / 2, cy: size / 2, r: size / 2 - border / 2, fill: 'none', stroke: colors.goldDark, 'stroke-width': border }) +
    el('text', {
      x: size / 2,
      // Baloo 2's ascent (1.078em) and descent (0.524em) centred in a 0.75 × size line box.
      y: size / 2 + size * 0.152,
      'text-anchor': 'middle',
      'font-family': FONT,
      'font-weight': FONT_WEIGHT.display,
      'font-size': size * 0.55,
      fill: colors.goldDark,
    }, 'đ'));
}

/** The serve confetti's colours, in the order pieces take them. */
export const CONFETTI_COLORS = [colors.primary, colors.gold, '#7EC8E3', '#B7E07A', '#B79CF2', '#FF9A76'];

/** One confetti piece: a 7×7 dot when `round`, otherwise a 6×10 strip. */
export function confettiPieceSvg(color: string, round: boolean): string {
  const w = round ? 7 : 6;
  const h = round ? 7 : 10;
  return svgDoc(w, h, el('rect', { width: w, height: h, rx: round ? 3.5 : 1.5, fill: color }));
}
