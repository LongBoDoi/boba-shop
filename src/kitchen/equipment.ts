import Phaser from 'phaser';

import { ART, FOAM, SCOOP, SCOOP_ART, SCOOP_BOWL, SCOOPFUL, SUGAR_SCOOP, SUGAR_SCOOP_ART, TEA_DISPENSER_ART, TEA_DISPENSERS } from '../art/kitchenArt';
import { TOPPING_PAN_ART, TOPPING_PANS, TOPPING_SCOOP_ART, TOPPING_SCOOPS } from '../art/toppingArt';
import { toppingPanBands, ToppingPanShape } from '../art/toppingGeometry';
import { kitchenBottleSvg } from '../art/kitchenEquipment';
import { bakeCanvas, canvasFont, svgTexture, tex } from '../game/view';
import { Station } from './layout';

/** Warm tones the hand-drawn bits borrow so they sit with the painted ones (`SHOP` in KitchenRoom). */
export const SHOP = {
  plaque: '#F7DCAE',
  woodEdge: '#C9924F',
  ink: '#5C5660',
};

/** One tea's dispenser, as a frame of the shared atlas. */
export function teaFrame(scene: Phaser.Scene, teaId: string): string {
  const texture = scene.textures.get(tex(TEA_DISPENSERS));
  if (!texture.has(teaId)) {
    const cell = TEA_DISPENSER_ART.cells[teaId];
    texture.add(teaId, 0, cell.x, cell.y, TEA_DISPENSER_ART.width, TEA_DISPENSER_ART.height);
  }
  return teaId;
}

/** One topping's scoopful, as a frame of its atlas. */
export function scoopFrame(scene: Phaser.Scene, id: string): string | null {
  const cell = TOPPING_SCOOP_ART.cells[id];
  if (!cell) return null;
  const texture = scene.textures.get(tex(TOPPING_SCOOPS));
  if (!texture.has(id)) texture.add(id, 0, cell.x, cell.y, cell.width, cell.height);
  return id;
}

/**
 * One pan, fitted to its cell of the tray so its painted rims meet its neighbours'. The fit is a
 * trapezoid, drawn as the same stack of horizontal bands `ToppingPanArt` uses. It is a little wider
 * than the cell, so the rims reach its edges: `left` is where the drawing starts relative to it.
 */
export function panExtent(width: number, height: number, shape: ToppingPanShape | undefined) {
  const bands = shape ? toppingPanBands(width, height, shape)
    : [{ x: 0, y: 0, w: width, h: height, top: 0, bottom: 1 }];
  const left = Math.min(...bands.map((band) => band.x));
  const right = Math.max(...bands.map((band) => band.x + band.w));
  return { bands, left, width: right - left };
}

/** Draw that pan with its own left edge at x = 0. */
export function drawPan(c: CanvasRenderingContext2D, image: CanvasImageSource, id: string, width: number, height: number,
  shape: ToppingPanShape | undefined) {
  const cell = TOPPING_PAN_ART.cells[id] ?? TOPPING_PAN_ART.cells.empty;
  const { bands, left } = panExtent(width, height, shape);
  // Trim the transparent top/bottom gutter before fitting the painted rims to their edges.
  const cropHeight = cell.height - 6;
  c.save();
  c.translate(-left, 0);
  for (const band of bands) {
    const sy = cell.y + 3 + band.top * cropHeight;
    const sh = (band.bottom - band.top) * cropHeight;
    // A hair of overlap, so the seam between two bands never opens into a bright line.
    c.drawImage(image, cell.x, sy, cell.width, sh, band.x, band.y - 0.25, band.w, band.h + 0.5);
  }
  c.restore();
}

export function sourceImage(scene: Phaser.Scene, asset: string): CanvasImageSource {
  return scene.textures.get(tex(asset)).getSourceImage() as CanvasImageSource;
}

/** A rounded rectangle as a path, for Canvas 2D. */
export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

/** A card: a rounded box with its border drawn inside it, the way CSS draws one. */
export function card(c: CanvasRenderingContext2D, w: number, h: number, radius: number, fill: string, border: number, stroke: string) {
  roundRect(c, 0, 0, w, h, radius);
  c.fillStyle = fill;
  c.fill();
  if (border > 0) {
    roundRect(c, border / 2, border / 2, w - border, h - border, Math.max(0, radius - border / 2));
    c.lineWidth = border;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

const measurer = document.createElement('canvas').getContext('2d')!;
export function measure(text: string, font: string) {
  measurer.font = font;
  return measurer.measureText(text).width;
}

/** Words wrapped to `width`, at most `max` lines (the last one keeps whatever is left). */
export function wrap(text: string, font: string, width: number, max = 2): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, font) > width && lines.length < max - 1) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The soft pool a thing standing on a surface casts around its foot: nested ellipses, each barely
 * there, piling up towards the middle (`Shadow` in KitchenRoom), filling a `2rx`×`2ry` box.
 */
export function drawShadow(c: CanvasRenderingContext2D, rx: number, ry: number) {
  for (const k of [1, 0.86, 0.72, 0.58, 0.44, 0.3]) {
    c.fillStyle = 'rgba(92,58,24,0.055)';
    c.beginPath();
    c.ellipse(rx, ry, rx * k, ry * k, 0, 0, Math.PI * 2);
    c.fill();
  }
}

const PLAQUE_FONT = canvasFont(9, 600);
/** A name on a little wooden plaque (9px, two lines at most): its size, and how to draw it. */
export function plaque(label: string, maxWidth: number, box?: { w: number; h: number }) {
  // The plaque may be as wide as its slot; its 5px padding and border come out of that.
  const lines = wrap(label, PLAQUE_FONT, maxWidth - 10);
  const w = box?.w ?? Math.min(maxWidth, Math.max(...lines.map((line) => measure(line, PLAQUE_FONT))) + 13);
  const h = box?.h ?? lines.length * 12 + 3;
  return {
    w, h,
    draw: (c: CanvasRenderingContext2D) => {
      card(c, w, h, 4, SHOP.plaque, 1.5, SHOP.woodEdge);
      c.font = PLAQUE_FONT;
      c.fillStyle = '#6B4422';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      lines.forEach((line, i) => c.fillText(line, w / 2, (h - lines.length * 12) / 2 + 6.5 + i * 12));
    },
  };
}

/** Text centred on (x, y), shrunk (to 70% at most) if it would not fit across `width`. */
export function fitText(c: CanvasRenderingContext2D, text: string, size: number, weight: 500 | 600 | 700 | 800, color: string,
  x: number, y: number, width: number) {
  let font = canvasFont(size, weight);
  const natural = measure(text, font);
  if (natural > width) font = canvasFont(size * Math.max(0.7, width / natural), weight);
  c.font = font;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y + size * 0.06);
}

/** Milk bottles, rasterised once per colour. */
const BOTTLE_ART = { width: 120, height: 300 };
export function bottleTexture(scene: Phaser.Scene, color: string): Promise<string> {
  return svgTexture(scene, `bottle-${color}`, kitchenBottleSvg(BOTTLE_ART.width, BOTTLE_ART.height, color),
    BOTTLE_ART.width, BOTTLE_ART.height);
}

export function bottleColor(station: Pick<Station, 'kind' | 'id'>) {
  return station.id === 'oat' ? '#EBD4A7' : '#FFF2D3';
}

/**
 * What a station puts in your hand — a scoopful, milk, a spoon of sugar or foam —
 * laid out in a `size`×`size` box from its top-left, as `Tool` in KitchenStation.
 */
export function addTool(scene: Phaser.Scene, station: Station, size: number): Phaser.GameObjects.GameObject[] {
  const S = size;
  if (station.kind === 'sugar') {
    return [scene.add.image(0, 0, tex(SUGAR_SCOOP)).setOrigin(0)
      .setDisplaySize(S, S * SUGAR_SCOOP_ART.height / SUGAR_SCOOP_ART.width)];
  }
  if (station.kind === 'milk') {
    const key = `bottle-${bottleColor(station)}`;
    if (!scene.textures.exists(key)) return [];
    return [scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(S * 0.45, S * 1.1)];
  }
  if (station.kind === 'ice') {
    const height = S * 0.9;
    return [scene.add.image(0, 0, tex(SCOOPFUL.ice)).setOrigin(0).setDisplaySize(height * SCOOP_ART.ice, height)];
  }
  if (station.kind === 'topping') {
    const frame = scoopFrame(scene, station.id);
    const cell = TOPPING_SCOOP_ART.cells[station.id];
    if (!frame || !cell) return [];
    return [scene.add.image(0, 0, tex(TOPPING_SCOOPS), frame).setOrigin(0).setDisplaySize(S, S * cell.height / cell.width)];
  }
  // Foam: the empty scoop with the cream drawn into its bowl.
  const SH = S / ART.scoop;
  const scoop = scene.add.image(0, 0, tex(SCOOP)).setOrigin(0).setDisplaySize(S, SH);
  const bowl = { x: S * SCOOP_BOWL.cx, y: SH * SCOOP_BOWL.cy, r: S * SCOOP_BOWL.r };
  const w = bowl.r * 2;
  const h = bowl.r * 1.5;
  const key = bakeCanvas(scene, `foam-cream:${station.color}:${w.toFixed(1)}`, w, h, (c) => card(c, w, h, bowl.r, station.color, 1.4, SHOP.ink));
  return [scoop, scene.add.image(bowl.x - bowl.r, bowl.y - bowl.r * 0.95, key).setOrigin(0).setDisplaySize(w, h)];
}

export function foamTexture(id: string): string {
  return tex(FOAM[id] ?? FOAM.cheese);
}
