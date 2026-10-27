import { paintReferencePart } from './referenceCupArt';
export const CUP_FINISH_RISE = 100;
export const CUP_LID_HOLE_Y = -35;

export function paintLid(c: CanvasRenderingContext2D, source: CanvasImageSource) {
  paintReferencePart(c, source, 'lid');
}

export function paintStraw(c: CanvasRenderingContext2D, source: CanvasImageSource, inDrink = false) {
  if (!inDrink) { paintReferencePart(c, source, 'straw'); return; }
  c.save(); c.beginPath(); c.rect(0, CUP_LID_HOLE_Y, 113, 210); c.clip();
  c.globalAlpha *= 0.3; paintReferencePart(c, source, 'straw'); c.restore();
  c.save(); c.beginPath(); c.rect(0, -CUP_FINISH_RISE, 113, CUP_FINISH_RISE + CUP_LID_HOLE_Y); c.clip();
  paintReferencePart(c, source, 'straw'); c.restore();
}
