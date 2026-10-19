/**
 * Shared helpers for the SVG-markup ports of the game's vector artwork.
 *
 * Every drawing in `art/` is a pure function returning a complete, standalone
 * `<svg xmlns="http://www.w3.org/2000/svg" …>` document as a string. That string is used two
 * ways: rasterised into a Phaser texture through an `Image` loaded from a `data:image/svg+xml`
 * URL, and dropped into HTML with `innerHTML`. The second is why every gradient, clip path and
 * mask id goes through `uid()`: two copies of one drawing on the same page must not share ids.
 *
 * No DOM, no React — these run anywhere.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** A number written compactly: at most two decimals, no trailing zeros, never `-0`. */
export function n(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

let counter = 0;

/** A document-unique id for a gradient, clip path or mask (`ba-sky-12`). */
export function uid(prefix: string): string {
  counter += 1;
  return `ba-${prefix}-${counter}`;
}

/** Escape text or an attribute value for XML. */
export function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export type AttrValue = string | number | undefined | null | false;

/**
 * Attributes as markup: ` x="1" fill="#FFF"`. Numbers are written with `n()`; `undefined`,
 * `null` and `false` leave the attribute out. Keys are written as given, so use the SVG
 * spelling (`stroke-width`, not `strokeWidth`).
 */
export function attrs(values: Record<string, AttrValue>): string {
  let out = '';
  for (const key in values) {
    const value = values[key];
    if (value === undefined || value === null || value === false) continue;
    out += ` ${key}="${typeof value === 'number' ? n(value) : esc(value)}"`;
  }
  return out;
}

/** One element: `el('rect', { x: 1 })` → `<rect x="1"/>`; with children, a closed pair. */
export function el(tag: string, values: Record<string, AttrValue>, children?: string): string {
  return children === undefined || children === ''
    ? `<${tag}${attrs(values)}/>`
    : `<${tag}${attrs(values)}>${children}</${tag}>`;
}

/** The root element, with the namespace a standalone (data-URL) document needs. */
export function svgDoc(width: number, height: number, body: string, viewBox?: string, extra: Record<string, AttrValue> = {}): string {
  return `<svg${attrs({ xmlns: SVG_NS, width, height, viewBox, ...extra })}>${body}</svg>`;
}

/** A `data:` URL for an SVG string, for `Image.src` or a Phaser loader. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Lighten (positive) or darken (negative) a #RRGGBB colour by a percentage. (From `Character.tsx`.) */
export function shade(hex: string, percent: number): string {
  const value = parseInt(hex.slice(1), 16);
  const adjust = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel + (percent / 100) * (percent < 0 ? channel : 255 - channel))));
  const r = adjust((value >> 16) & 255);
  const g = adjust((value >> 8) & 255);
  const b = adjust(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Mix two #RRGGBB colours, `amount` of the way from `a` to `b`. (From `TeaLiquid.tsx`.) */
export function blend(a: string, b: string, amount: number) {
  const channels = [1, 3, 5].map((at) => Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - amount)
    + parseInt(b.slice(at, at + 2), 16) * amount).toString(16).padStart(2, '0'));
  return `#${channels.join('')}`;
}

/**
 * A rounded rectangle whose border is drawn *inside* the box, the way CSS draws one — SVG centres
 * a stroke on the edge, so the outline is inset by half its width.
 */
export function borderedRect(
  x: number, y: number, w: number, h: number, radius: number,
  fill: string, border: number, borderColor: string, extra: Record<string, AttrValue> = {},
): string {
  const r = Math.min(radius, w / 2, h / 2);
  const fillRect = el('rect', { x, y, width: w, height: h, rx: r, fill, ...extra });
  if (border <= 0) return fillRect;
  const half = border / 2;
  return fillRect + el('rect', {
    x: x + half, y: y + half, width: w - border, height: h - border, rx: Math.max(0, r - half),
    fill: 'none', stroke: borderColor, 'stroke-width': border, ...extra,
  });
}
