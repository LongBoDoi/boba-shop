/** One wrist bend and its exact return; the foreleg stays anchored to the cat. */
import { alphaBounds, cleanSprite, cropSprite, spriteCanvas } from './titleSprite';

export const FORTUNE_CAT_PERIOD = 1.2;
export const FORTUNE_CAT_SOURCE_FRAMES = [0,1,2,3] as const;
export const FORTUNE_CAT_FRAMES = FORTUNE_CAT_SOURCE_FRAMES.length;
// The resting paw is about 90 px wide; the raised palm should have comparable volume.
export const FORTUNE_CAT_PALM_WIDTH = 80;
export function fortuneCatPose(seconds: number) {
  const phase = seconds/FORTUNE_CAT_PERIOD*Math.PI*2;
  const bend = .5-.5*Math.cos(phase);
  return {frame: Math.floor(bend*(FORTUNE_CAT_FRAMES-1)+.5+1e-9)};
}

export function fortuneCatArt(sheet: HTMLImageElement) {
  const cellW = sheet.naturalWidth/3, cellH = sheet.naturalHeight/2;
  // The raised pose shows the pads; bending the wrist naturally hides them.
  // Retrace this one bend instead of continuing around the atlas's full gesture.
  const raw = Array.from({length: FORTUNE_CAT_FRAMES},(_,i) => {
    const source = FORTUNE_CAT_SOURCE_FRAMES[i];
    const cell = cleanSprite(cropSprite(sheet,{x: source%3*cellW,y: Math.floor(source/3)*cellH,w: cellW,h: cellH}));
    const context = cell.getContext('2d')!, pixels = context.getImageData(0,0,cell.width,cell.height);
    // Generated interior alpha is sometimes 253/254. Make the painted core opaque
    // so the awning and tail cannot show faint lines through the foreleg.
    for (let p = 3; p < pixels.data.length; p += 4) if (pixels.data[p] >= 240) pixels.data[p] = 255;
    context.putImageData(pixels,0,0);
    const bounds = alphaBounds(cell,48);
    // The atlas has a curved shoulder extending left. Anchor that covered end,
    // rather than the underside of an isolated arm standing on the awning.
    return {image: cell,bounds,root: {x: bounds.x+12,y: bounds.y+bounds.h-60}};
  });
  const left = Math.ceil(Math.max(...raw.map(f => f.root.x-f.bounds.x)))+4;
  const right = Math.ceil(Math.max(...raw.map(f => f.bounds.x+f.bounds.w-f.root.x)))+4;
  const up = Math.ceil(Math.max(...raw.map(f => f.root.y-f.bounds.y)))+4;
  const down = Math.ceil(Math.max(...raw.map(f => f.bounds.y+f.bounds.h-f.root.y)))+4;
  const frames = raw.map(f => {
    const image = spriteCanvas(left+right,up+down);
    image.getContext('2d')!.drawImage(f.image,left-f.root.x,up-f.root.y); return image;
  });
  const raised = raw[0];
  const palm = alphaBounds(cropSprite(raised.image,{...raised.bounds,h: Math.ceil(raised.bounds.h*.45)}),48);
  const scale = FORTUNE_CAT_PALM_WIDTH/palm.w;
  return {frames,box: {x: 905-left*scale,y: 138-up*scale,w: (left+right)*scale,h: (up+down)*scale},
    root: {x: 905,y: 138}};
}
