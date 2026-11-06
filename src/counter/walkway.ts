import type { CounterLayout } from './layout';
import { doorPlacement } from './doorGeometry';

/** Floor waypoints stay inside the ropes and clear of chairs, signs and the counter props. */
export function exitWalkway(layout: CounterLayout, start: { x: number; feet: number; scale: number }, t: number) {
  const p = doorPlacement(layout), room = layout.room;
  const span = start.feet - p.thresholdY;
  const lane = p.passageX;
  const points = [
    { x: start.x, feet: start.feet },
    { x: room.queueX - layout.metrics.charWidth * .42, feet: start.feet - span * .18 },
    { x: lane - 20 * room.scale, feet: p.thresholdY + span * .52 },
    { x: lane, feet: p.thresholdY + span * .25 },
    { x: lane, feet: p.thresholdY + 28 * room.scale },
  ];
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.feet - points[i].feet));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let distance = Math.max(0, Math.min(1, t)) * total;
  let i = 0;
  while (i < lengths.length - 1 && distance > lengths[i]) distance -= lengths[i++];
  const f = Math.min(1, distance / Math.max(.001, lengths[i]));
  const x = points[i].x + (points[i + 1].x - points[i].x) * f;
  const feet = points[i].feet + (points[i + 1].feet - points[i].feet) * f;
  const depth = Math.max(0, Math.min(1, (feet - p.thresholdY - 28 * room.scale) / Math.max(1, span - 28 * room.scale)));
  const facing = Math.atan2(-(points[i + 1].x - points[i].x), points[i + 1].feet - points[i].feet) * 180 / Math.PI;
  return { x, feet, facing, scale: p.scale + (start.scale - p.scale) * depth };
}
