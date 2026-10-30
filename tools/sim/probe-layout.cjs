const { src } = require('./load.cjs');
const { layoutKitchen } = src('kitchen/layout.ts');
const { getDayConfig } = src('game/levels.ts');
const cfg = getDayConfig(5);
for (const [W, H] of [[390, 554], [375, 380], [932, 300]]) {
  const l = layoutKitchen(cfg, W, H, 'M');
  const room = l.room;
  console.log(`\n=== kitchen ${W}x${H}: room.scale=${room.scale?.toFixed(3)} maxPan=${room.maxPan?.toFixed(0)} homeX=${l.homeX?.toFixed(0)} rack=${JSON.stringify(l.rack?.map(r=>Math.round(r.x)))}`);
  const by = {};
  for (const s of l.stations) (by[s.kind] ||= []).push(Math.round(s.cx));
  for (const [k, v] of Object.entries(by)) console.log(k.padEnd(9), v.join(' '));
  // Which kinds are reachable at a single pan? Sweep the pan and find the widest set on screen at once.
  const all = l.stations;
  let best = 0, bestPan = 0;
  for (let pan = 0; pan <= room.maxPan; pan += 4) {
    const n = all.filter((s) => s.cx - s.w / 2 >= pan && s.cx + s.w / 2 <= pan + W).length;
    if (n > best) { best = n; bestPan = pan; }
  }
  console.log(`widest single view: ${best}/${all.length} stations at pan ${bestPan}; screen shows ${(W / (W + room.maxPan) * 100).toFixed(0)}% of the wall`);
}
