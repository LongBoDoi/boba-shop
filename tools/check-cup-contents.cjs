/* Whole ingredient silhouettes must fit the glass, rather than relying on clips to crop them. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);

try {
  const { createIceLayout } = require('../src/art/iceLayout.ts');
  const { CUP_ART, cupIcePosition, cupIceRestPosition, cupIceSpreadPosition, cupIceOutlinePath,
    cupInteriorAt, cupSurface, cupToppingPosition } = require('../src/art/cupGeometry.ts');
  const { CUP_OVERFLOW, creamBox, creamSurface } = require('../src/kitchen/creamPainter.ts');

  function inside(x, y, label) {
    const glass = cupInteriorAt(x);
    assert(Number.isFinite(x) && Number.isFinite(y), `${label} has finite coordinates`);
    assert(x >= 13.6 && x <= 99.4 && y >= glass.top - 0.02 && y <= glass.bottom + 0.02,
      `${label} is outside the glass at ${x.toFixed(2)}, ${y.toFixed(2)}`);
  }

  let outlines = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const layout = createIceLayout(seed);
    assert.equal(layout.length, 12);
    assert.deepEqual(layout, createIceLayout(seed), 'A reload preserves the arrangement');
    const spread = layout.slice(3).filter(cube => cube.liquidDepth !== undefined);
    assert.equal(layout.filter(cube => cube.liquidDepth === undefined).length, 4,
      'The second scoop adds one surface crown and keeps the others spread below it');
    assert(spread.some(c => c.x < 40) && spread.some(c => c.x > 73), 'The second scoop spans both sides');
    assert(spread.some(c => c.liquidDepth < 0.4) && spread.some(c => c.liquidDepth > 0.7),
      'The second scoop uses varied depths within the surface band');
    for (const layers of [0, 1, 2]) {
      for (const fill of [0, 0.01, 0.18, 0.35, 0.65, 0.9, 1, 1.15]) {
        layout.forEach((cube, i) => {
          const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift + layers * 10);
          const pose = cube.liquidDepth !== undefined
            ? cupIceSpreadPosition(fill, cube.x, cube.r, cube.angle, cube.liquidDepth, dry.cx, dry.cy, cube.restAngle)
            : cupIcePosition(fill, cube.x, cube.r, cube.angle, cube.depth,
              dry.cx, dry.cy, cube.restAngle, cube.immersion ?? 0.42);
          const points = cupIceOutlinePath(pose.cx, pose.cy, pose.angle, cube.r)
            .match(/-?\d+(?:\.\d+)?/g).map(Number);
          for (let p = 0; p < points.length; p += 2) inside(points[p], points[p + 1], `cube ${i}, fill ${fill}`);
          if (cube.liquidDepth !== undefined && pose.rise === 1 && fill >= 0.35) {
            assert(pose.cy >= cupSurface(fill).y, 'Second-scoop centres stay in the tea instead of hovering above it');
          }
          outlines++;
        });
      }
    }
    // Keep ice near the surface through later pours, with gaps after fitting it to the walls.
    const wet = spread.map(cube => {
      const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift);
      return cupIceSpreadPosition(0.8, cube.x, cube.r, cube.angle, cube.liquidDepth, dry.cx, dry.cy, cube.restAngle);
    });
    const surfaceFront = cupSurface(0.8).y + cupSurface(0.8).ry;
    assert(wet.every(p => p.cy >= surfaceFront && p.cy <= surfaceFront + 40),
      'Submerged centres stay in the shallow surface band instead of filling the tea body');
    assert(Math.max(...wet.map(p => p.cx)) - Math.min(...wet.map(p => p.cx)) > 30,
      'Ice uses the width of the cup rather than clumping in the middle');
    wet.forEach((p, i) => wet.slice(0, i).forEach(other => {
      assert(Math.hypot(p.cx - other.cx, p.cy - other.cy) > 9.5,
        'Fitted submerged cubes retain distinct centres instead of stacking at nearly the same position');
    }));
    if (seed <= 5) for (const layers of [0, 2]) for (const cube of spread) {
      const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift + layers * 10);
      const at = fill => cupIceSpreadPosition(fill, cube.x, cube.r, cube.angle, cube.liquidDepth,
        dry.cx, dry.cy, cube.restAngle);
      let previous = at(0);
      assert.deepEqual(previous, { cx: dry.cx, cy: dry.cy, angle: cube.restAngle, rise: 0 },
        'Ice starts in the same dry pose regardless of its later floating layout');
      assert.deepEqual(at(1e-6), previous, 'The first trace of tea cannot reposition the dry pile');
      for (let step = 1; step <= 500; step++) {
        const next = at(step / 500);
        assert(Math.hypot(next.cx - previous.cx, next.cy - previous.cy) < 2,
          'Every cube moves continuously throughout the first pour and later top-ups');
        assert(Math.abs(next.angle - previous.angle) < 3, 'Resting cubes turn gradually as tea reaches them');
        previous = next;
      }
    }
  }

  // The whole rotated piece, including tall bean and jelly sprites, clears the curved floor.
  for (const x of [24, 34, 56.5, 78, 89]) {
    for (const [rx, ry] of [[6, 6], [5.8, 7], [6, 4.8]]) {
      for (const angle of [-18, 0, 18]) {
        for (const lift of [0, 12, 25]) {
          const { cx, cy } = cupToppingPosition(x, rx, ry, angle, lift);
          const a = angle * Math.PI / 180;
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            inside(cx + sx * rx * Math.cos(a) - sy * ry * Math.sin(a),
              cy + sx * rx * Math.sin(a) + sy * ry * Math.cos(a), 'topping corner');
          }
        }
      }
    }
  }
  // Cream rises above the tea without losing contact; its peak still fits the texture.
  const headroom = CUP_OVERFLOW * CUP_ART.h;
  for (let fill = 0; fill <= 1.1501; fill += 0.02) {
    const box = creamBox(fill);
    assert(box.y >= -headroom, 'The complete peak fits the texture');
    assert(box.y + box.h <= CUP_ART.h, 'The cream texture clears the bottom');
    const scale = box.w / 104;
    const surface = cupSurface(fill);
    const contact = creamSurface(fill);
    assert(Math.abs(box.x + 52 * scale - 56.5) < 0.001, 'Cream shares the tea centre');
    assert(Math.abs(box.y + 58 * scale - contact.y) < 0.001, 'Cream and its mixing edge share the raised contact');
    assert(contact.y <= surface.y, 'Cream stands above the tea instead of lowering it');
    assert(contact.y + contact.ry >= surface.y, 'The raised cream still touches the tea');
    if (fill >= 1) assert(contact.y + contact.ry <= 31, 'At full, the cream sits almost entirely above the near lip');
    assert(Math.abs(42 * scale - surface.rx) < 0.001, 'Cream matches the tea width');
  }

  console.log(`check-cup-contents: ${outlines} ice outlines fit the cup; toppings clear the floor; `
    + 'second scoop stays spaced near the surface; raised cream keeps contact with the tea and its peak fits the texture.');

} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
