import { paintReferencePart, REFERENCE_CUP_PARTS } from './referenceCupArt';
export const CUP_FINISH_RISE = 100;
export const CUP_LID_HOLE_Y = -35;
export const CUP_STRAW_BOTTOM = 155;
/** A slight lean through the fixed lid opening separates the tube from wall reflections. */
const STRAW_LEAN = 0.055;
export const insertedStrawX = (y: number) => 56.5 + (y - CUP_LID_HOLE_Y) * STRAW_LEAN;
/** Only the far arc of the sealing ring belongs behind the cream. */
export const CUP_LID_REAR_RING = 'M8 15C26 -2 88 -2 105 15L104 20C85 8 28 8 9 20Z';

export function paintLid(c: CanvasRenderingContext2D, source: CanvasImageSource, layer: 'whole' | 'rear' | 'front' = 'whole') {
  c.save();
  if (layer === 'rear') c.clip(new Path2D(CUP_LID_REAR_RING));
  if (layer === 'front') c.clip(new Path2D(`M0-100H113V174H0Z ${CUP_LID_REAR_RING}`), 'evenodd');
  paintReferencePart(c, source, 'lid');
  c.restore();
}

/** Carried straw; insertion extends the straight shaft to the cup floor. */
export function paintStraw(c: CanvasRenderingContext2D, source: CanvasImageSource) {
  paintReferencePart(c, source, 'straw');
}

export function paintInsertedStraw(c: CanvasRenderingContext2D, source: CanvasImageSource, section: 'inside' | 'outside') {
  const { source: s, target: t } = REFERENCE_CUP_PARTS.straw;
  c.save();
  c.beginPath();
  if (section === 'inside') c.rect(0, CUP_LID_HOLE_Y, 113, CUP_STRAW_BOTTOM - CUP_LID_HOLE_Y);
  else c.rect(0, -CUP_FINISH_RISE, 113, CUP_FINISH_RISE + CUP_LID_HOLE_Y);
  c.clip();
  // Both sections share the same axis and meet exactly at the lid opening.
  c.transform(1, 0, STRAW_LEAN, 1, -CUP_LID_HOLE_Y * STRAW_LEAN, 0);
  // Preserve both rounded ends; extend only the straight part of the tube.
  const end = 4, endPixels = s.height * end / t.height;
  c.drawImage(source, s.x, s.y, s.width, endPixels, t.x, t.y, t.width, end);
  c.drawImage(source, s.x, s.y + endPixels, s.width, s.height - endPixels * 2,
    t.x, t.y + end, t.width, CUP_STRAW_BOTTOM - t.y - end * 2);
  c.drawImage(source, s.x, s.y + s.height - endPixels, s.width, endPixels,
    t.x, CUP_STRAW_BOTTOM - end, t.width, end);
  c.restore();
}
