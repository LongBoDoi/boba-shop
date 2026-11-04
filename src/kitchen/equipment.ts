import Phaser from 'phaser';

import { SCOOP_ART, SCOOPFUL, SUGAR_SCOOP, SUGAR_SCOOP_ART } from '../art/kitchenArt';
import { TOPPING_SCOOP_ART, TOPPING_SCOOPS } from '../art/toppingArt';
import { equipmentFrame, paintEquipment, PaintedEquipmentId } from '../art/equipmentArt';
import { bakeCanvas, tex } from '../game/view';
import { Station } from './layout';
import { REFERENCE_CUP, REFERENCE_CUP_PARTS } from '../art/referenceCupArt';
import { INSERTED_STRAW_BOX, paintInsertedStraw, paintLid, paintStraw } from '../art/finishingArt';
import { CUP_ART } from '../art/cupGeometry';

/** One topping's scoopful, as a frame of its atlas. */
export function scoopFrame(scene: Phaser.Scene, id: string): string | null {
  const cell = TOPPING_SCOOP_ART.cells[id];
  if (!cell) return null;
  const texture = scene.textures.get(tex(TOPPING_SCOOPS));
  if (!texture.has(id)) texture.add(id, 0, cell.x, cell.y, cell.width, cell.height);
  return id;
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

/** Carried equipment uses the same source artwork as the order-panel illustrations. */
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

}

/**
 * A finishing part — a lid, a straw — baked at exactly the size the cup wears it, in the cup's own
 * 113x174 units. What flies onto the cup and what the cup then draws for itself are the same
 * picture at the same size, which is what lets the swap at the end of the flight go unseen, the
 * way the rack's cup is handed over where the rack's one stood.
 */
export function finishPartTexture(scene: Phaser.Scene, part: 'lid' | 'straw', cupW: number, cupH: number, fitted = false) {
  // A straw on its way in is painted as the cup will wear it — leaning through the lid, and long
  // enough to reach the floor — so that the two line up exactly when it lands. One carried in the
  // hand is the plain straw it still is, drawn in the same box so that letting go of it over the
  // cup swaps one for the other where it stands.
  const box = part === 'straw' ? INSERTED_STRAW_BOX : REFERENCE_CUP_PARTS[part].target;
  const width = box.width * cupW / CUP_ART.w;
  const height = box.height * cupH / CUP_ART.h;
  const key = bakeCanvas(scene, `finish-part:${part}:${fitted}:${width.toFixed(1)}x${height.toFixed(1)}`, width, height, (c) => {
    c.scale(width / box.width, height / box.height);
    c.translate(-box.x, -box.y);
    const source = sourceImage(scene, REFERENCE_CUP);
    if (part === 'lid') paintLid(c, source);
    else if (!fitted) paintStraw(c, source);
    else {
      paintInsertedStraw(c, source, 'outside');
      paintInsertedStraw(c, source, 'inside');
    }
  });
  return { key, width, height, box };
}

/**
 * What a station puts in your hand — a scoopful, milk, a spoon of sugar or foam —
 * laid out in a `size`×`size` box from its top-left, as `Tool` in KitchenStation.
 */
export function addTool(scene: Phaser.Scene, station: Station, size: number, cup: { w: number; h: number }): Phaser.GameObjects.GameObject[] {
  const S = size;
  // The straw is held at the size the cup wears it and centred on the box, so that letting go of
  // it over the cup hands its flight the same picture in the same place.
  if (station.kind === 'straw') {
    const { key, width, height } = finishPartTexture(scene, 'straw', cup.w, cup.h);
    return [scene.add.image((S - width) / 2, (S - height) / 2, key).setOrigin(0).setDisplaySize(width, height)];
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

