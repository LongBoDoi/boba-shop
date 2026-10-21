import Phaser from 'phaser';

import { SCOOP_ART, SCOOPFUL, SUGAR_SCOOP, SUGAR_SCOOP_ART, TEA_DISPENSER_ART, TEA_DISPENSERS } from '../art/kitchenArt';
import { TOPPING_PAN_ART, TOPPING_PANS, TOPPING_SCOOP_ART, TOPPING_SCOOPS } from '../art/toppingArt';
import { toppingPanBands, ToppingPanShape } from '../art/toppingGeometry';
import { equipmentFrame, paintEquipment, PaintedEquipmentId } from '../art/equipmentArt';
import { bakeCanvas, canvasFont, svgTexture, tex } from '../game/view';
import { Station } from './layout';
import { paintStraw } from '../art/finishingArt';
import { ingredientMarkSvg } from '../art/ingredientMarks';
import { TEAS } from '../game/ingredients';
import { KITCHEN_TEXT_MIN } from './typography';

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

/** Centred text at or above the shared minimum. Callers wrap long labels instead of shrinking. */
export function fitText(c: CanvasRenderingContext2D, text: string, size: number, weight: 500 | 600 | 700 | 800, color: string,
  x: number, y: number, _width: number) {
  const actualSize = Math.max(KITCHEN_TEXT_MIN, size);
  c.font = canvasFont(actualSize, weight);
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y + actualSize * 0.06);
}

/** Equipment pictures and emblems are shared with the order-panel illustrations. */
export async function prepareEquipmentTextures(scene: Phaser.Scene): Promise<void> {
  for (const id of ['whole', 'oat', 'cheese', 'brulee'] as PaintedEquipmentId[]) {
    const { width, height, atlas } = equipmentFrame(id);
    const image = sourceImage(scene, atlas.image);
    const key = id === 'whole' || id === 'oat' ? `milk-carton-${id}` : `cream-can-${id}`;
    bakeCanvas(scene, key, width * 2, height * 2, c => {
      c.scale(2, 2);
      c.imageSmoothingQuality = 'high';
      paintEquipment(c, image, id);
    });
  }
  await Promise.all([
    ...TEAS.map(tea => svgTexture(scene, `ingredient-mark-tea-${tea.id}`,
      ingredientMarkSvg('tea', tea.id, 96), 96, 96)),
    svgTexture(scene, 'ingredient-mark-sweetness', ingredientMarkSvg('sweetness', '', 96), 96, 96),
  ]);
}

/**
 * What a station puts in your hand — a scoopful, milk, a spoon of sugar or foam —
 * laid out in a `size`×`size` box from its top-left, as `Tool` in KitchenStation.
 */
export function addTool(scene: Phaser.Scene, station: Station, size: number): Phaser.GameObjects.GameObject[] {
  const S = size;
  if (station.kind === 'straw') {
    const key = bakeCanvas(scene, `finish-tool:${station.kind}:${S}`, S, S, (c) => {
      c.scale(S / 150, S / 150);
      c.translate(18, 40);
      paintStraw(c);
    });
    return [scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(S, S)];
  }
  if (station.kind === 'sugar') {
    return [scene.add.image(0, 0, tex(SUGAR_SCOOP)).setOrigin(0)
      .setDisplaySize(S, S * SUGAR_SCOOP_ART.height / SUGAR_SCOOP_ART.width)];
  }
  if (station.kind === 'milk') {
    const key = `milk-carton-${station.id}`;
    if (!scene.textures.exists(key)) return [];
    return [scene.add.image((S - station.w) / 2, 0, key).setOrigin(0).setDisplaySize(station.w, station.h)];
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
  // The cream canister is carried whole, using the same artwork as the counter option.
  const key = `cream-can-${station.id}`;
  if (!scene.textures.exists(key)) return [];
  return [scene.add.image((S - station.w) / 2, 0, key).setOrigin(0).setDisplaySize(station.w, station.h)];
}

