import Phaser from 'phaser';

import { SCOOP_ART, SCOOPFUL, SUGAR_SCOOP, SUGAR_SCOOP_ART } from '../art/kitchenArt';
import { TOPPING_PAN_ART, TOPPING_SCOOP_ART, TOPPING_SCOOPS } from '../art/toppingArt';
import { toppingPanBands, ToppingPanShape } from '../art/toppingGeometry';
import { equipmentFrame, paintEquipment, PaintedEquipmentId } from '../art/equipmentArt';
import { bakeCanvas, svgTexture, tex } from '../game/view';
import { Station } from './layout';
import { paintStraw } from '../art/finishingArt';
import { ingredientMarkSvg } from '../art/ingredientMarks';
import { TEAS } from '../game/ingredients';

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

/** Room light projects the package silhouette down-left from its actual foot. */
export function equipmentShadowExtent(w: number, h: number, foot: number) {
  const pad = Math.max(3, w * 0.1);
  const originY = pad + w * 0.15;
  return { left: -h * 0.24 - pad, top: foot - originY,
    width: w + h * 0.24 + pad * 2, height: h * 0.15 + originY + pad, originY };
}

const equipmentBaseProfiles = new WeakMap<CanvasImageSource, { base: Float32Array; image: HTMLCanvasElement }>();

/** Read the painted lower rim once per source texture, including its curved sides. */
function equipmentBaseProfile(image: CanvasImageSource, id: PaintedEquipmentId) {
  const cached = equipmentBaseProfiles.get(image);
  if (cached) return cached;
  const frame = equipmentFrame(id);
  const canvas = document.createElement('canvas');
  canvas.width = frame.width * 4; canvas.height = frame.height * 4;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const base = new Float32Array(canvas.width).fill(-1);
  for (let x = 0; x < canvas.width; x++) {
    for (let y = canvas.height - 1; y >= canvas.height * 0.8; y--) {
      if (pixels[(y * canvas.width + x) * 4 + 3] >= 128) {
        base[x] = (y + 0.5) / canvas.height;
        break;
      }
    }
  }
  const profile = { base, image: canvas };
  equipmentBaseProfiles.set(image, profile);
  return profile;
}

export function drawEquipmentShadow(c: CanvasRenderingContext2D, image: CanvasImageSource,
  id: PaintedEquipmentId, w: number, h: number, foot: number) {
  const box = equipmentShadowExtent(w, h, foot);
  const frame = equipmentFrame(id);
  const bodyWidth = w * frame.target.width / frame.width;
  const cx = -box.left + w / 2, cy = box.originY;
  const profile = equipmentBaseProfile(image, id);
  const base = profile?.base;
  // source-in must stay inside this atlas frame; otherwise it erases earlier equipment frames.
  c.save();
  c.beginPath(); c.rect(0, 0, box.width, box.height); c.clip();
  c.save();
  c.shadowColor = '#000'; c.shadowBlur = Math.max(1.6, w * 0.06);
  c.translate(-box.left, box.originY);
  if (profile && base) {
    // Each strip starts at its own painted bottom, rather than reflecting the curved rim
    // below a flat baseline. At y=ground the projected point stays exactly on that rim.
    const strip = 0.5;
    for (let x = 0; x < w; x += strip) {
      const index = Math.min(base.length - 1, Math.floor((x + strip / 2) / w * base.length));
      if (base[index] < 0) continue;
      const ground = base[index] * h;
      c.save();
      c.transform(1, 0, 0.24, -0.15, -ground * 0.24, ground * 1.15 - foot);
      // Draw only this source strip; source coordinates share the cached rim's resolution.
      c.drawImage(profile.image, x / w * profile.image.width, 0,
        Math.min(strip, w - x) / w * profile.image.width, profile.image.height,
        x, 0, Math.min(strip, w - x), h);
      c.restore();
    }
  } else {
    c.transform(1, 0, 0.24, -0.15, -foot * 0.24, foot * 0.15);
    c.drawImage(image, 0, 0, w, h);
  }
  c.restore();
  c.save();
  c.globalCompositeOperation = 'source-in';
  const fade = c.createLinearGradient(0, box.originY, 0, box.height);
  fade.addColorStop(0, 'rgba(65,55,44,0.18)');
  fade.addColorStop(1, 'rgba(65,55,44,0.02)');
  c.fillStyle = fade; c.fillRect(0, 0, box.width, box.height);
  c.restore();
  c.save();
  c.shadowColor = 'rgba(58,48,37,0.25)'; c.shadowBlur = Math.max(0.4, w * 0.012);
  if (base) {
    c.beginPath();
    let started = false;
    for (let i = 0; i < base.length; i++) {
      if (base[i] < 0) continue;
      const x = (i + 0.5) / base.length * w - box.left;
      const y = base[i] * h - foot + cy;
      if (started) c.lineTo(x, y); else { c.moveTo(x, y); started = true; }
    }
    c.strokeStyle = 'rgba(58,48,37,0.27)'; c.lineWidth = Math.max(0.5, bodyWidth * 0.025); c.stroke();
  } else {
    c.fillStyle = 'rgba(58,48,37,0.32)';
    roundRect(c, cx - bodyWidth * 0.44, cy - bodyWidth * 0.025,
      bodyWidth * 0.88, bodyWidth * 0.065, bodyWidth * 0.025);
    c.fill();
  }
  c.restore();
  c.restore();
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

