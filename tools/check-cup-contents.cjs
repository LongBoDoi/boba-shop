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
  const { CUP_OVERFLOW, creamBox } = require('../src/kitchen/creamPainter.ts');

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
    const spread = layout.slice(3);
    assert(spread.some(c => c.x < 40) && spread.some(c => c.x > 73), 'The second scoop spans both sides');
    assert(spread.some(c => c.liquidDepth < 0.25) && spread.some(c => c.liquidDepth > 0.7),
      'The second scoop spans the tea height');
    for (const layers of [0, 1, 2]) {
      for (const fill of [0, 0.01, 0.18, 0.35, 0.65, 0.9, 1, 1.15]) {
        layout.forEach((cube, i) => {
          const dry = cupIceRestPosition(cube.restX, cube.r, cube.restAngle, cube.restLift + layers * 10);
          const pose = fill > 0 && cube.liquidDepth !== undefined
            ? cupIceSpreadPosition(fill, cube.x, cube.r, cube.angle, cube.liquidDepth)
            : cupIcePosition(fill, cube.x, cube.r, cube.angle, cube.depth,
              dry.cx, dry.cy, cube.restAngle, cube.immersion ?? 0.42);
          const points = cupIceOutlinePath(pose.cx, pose.cy, pose.angle, cube.r)
            .match(/-?\d+(?:\.\d+)?/g).map(Number);
          for (let p = 0; p < points.length; p += 2) inside(points[p], points[p + 1], `cube ${i}, fill ${fill}`);
          if (cube.liquidDepth !== undefined && fill >= 0.35) {
            assert(pose.cy >= cupSurface(fill).y, 'Second-scoop centres stay in the tea instead of hovering above it');
          }
          outlines++;
        });
      }
    }
    // At a normal fill, extra cubes must populate the drink, not collapse into a surface cluster.
    const wet = spread.map(cube => cupIceSpreadPosition(0.8, cube.x, cube.r, cube.angle, cube.liquidDepth));
    assert(Math.max(...wet.map(p => p.cy)) - Math.min(...wet.map(p => p.cy)) > 45,
      'The spread covers the liquid body');
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
  // Cream keeps the real tea surface. Its peak can rise over the rim, within the texture.
  const headroom = CUP_OVERFLOW * CUP_ART.h;
  for (let fill = 0; fill <= 1.1501; fill += 0.02) {
    const box = creamBox(fill);
    assert(box.y >= -headroom, 'The complete peak fits the texture');
    assert(box.y + box.h <= CUP_ART.h, 'The cream texture clears the bottom');
    const scale = box.w / 104;
    const surface = cupSurface(fill);
    assert(Math.abs(box.x + 52 * scale - 56.5) < 0.001, 'Cream shares the tea centre');
    assert(Math.abs(box.y + 58 * scale - surface.y) < 0.001, 'Cream rests on the unchanged tea surface');
    assert(Math.abs(42 * scale - surface.rx) < 0.001, 'Cream matches the tea width');
  }

  console.log(`check-cup-contents: ${outlines} ice outlines fit the cup; toppings clear the floor; `
    + 'second scoop spans the tea; cream shares the unchanged tea surface and its peak fits the texture.');

} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
