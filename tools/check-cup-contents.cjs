/* Whole ingredient footprints fit the overhead cup at every fill, without relying on clipping. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);

try {
  const { createIceLayout } = require('../src/art/iceLayout.ts');
  const { CUP_ART, CUP_FOOT, CUP_MOUTH, cupPlanePosition, cupSurface } = require('../src/art/cupGeometry.ts');
  const { WELL_TOP, WELL_BOTTOM, WELL_RUN } = require('../src/kitchen/cupMarks.ts');
  assert(CUP_MOUTH.ry / CUP_MOUTH.rx > 0.6, 'The opening shows the broad overhead plane');
  assert(CUP_ART.h / CUP_ART.w < 1.2, 'The glass body is foreshortened');
  assert(CUP_FOOT > CUP_MOUTH.y && CUP_FOOT < CUP_ART.h, 'The base sits below the mouth within the sprite');
  let outlines = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const layout = createIceLayout(seed);
    assert.equal(layout.length, 12);
    assert.deepEqual(layout, createIceLayout(seed), 'A reload preserves the arrangement');
    for (const raw of [-0.1, 0, 0.0001, 0.18, 0.35, 0.65, 0.9, 1, 1.15]) {
      const s = cupSurface(raw);
      const fill = Math.max(0, Math.min(1, raw));
      assert(Math.abs((WELL_BOTTOM - fill * WELL_RUN) * CUP_ART.h - s.y) < 1e-8,
        'The visible pour stream ends at the same surface as the ice and liquid');
      assert(s.y >= WELL_TOP * CUP_ART.h - 1e-8 && s.y <= WELL_BOTTOM * CUP_ART.h + 1e-8);
      layout.forEach(cube => {
        const p = cupPlanePosition(raw, cube.u, cube.v, cube.r);
        assert(Number.isFinite(p.x) && Number.isFinite(p.y));
        for (let step = 0; step < 32; step++) {
          const a = step / 32 * Math.PI * 2;
          const x = p.x + Math.cos(a) * cube.r * s.rx;
          const y = p.y + Math.sin(a) * cube.r * s.ry;
          assert(((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 < 1,
            'The entire rotated ice footprint clears the wall, even before clipping');
        }
        outlines++;
      });
    }
    // Filling moves the existing pieces continuously instead of resampling their positions.
    for (const cube of layout) {
      let previous = cupPlanePosition(0, cube.u, cube.v, cube.r);
      for (let step = 1; step <= 100; step++) {
        const next = cupPlanePosition(step / 100, cube.u, cube.v, cube.r);
        assert(next.y < previous.y, 'Every top-up raises every cube, including the last part of the fill');
        assert(Math.hypot(next.x - previous.x, next.y - previous.y) < 0.7, 'Ice rises continuously');
        previous = next;
      }
    }
    const xs = layout.map(p => p.u), ys = layout.map(p => p.v);
    assert(Math.max(...xs) - Math.min(...xs) > 1 && Math.max(...ys) - Math.min(...ys) > 1,
      'Both scoops use the depth and width of the opening');
    for (const u of [-1, -0.5, 0, 0.5, 1]) for (const v of [-1, 0, 1]) {
      const p = cupPlanePosition(0, u, v, 0.2), s = cupSurface(0);
      assert(Math.hypot((p.x-s.x)/s.rx, (p.y-s.y)/s.ry) + 0.2 < 1,
        'Topping footprints also fit the floor plane at the corners');
    }
  }
  console.log(`check-cup-contents: ${outlines} overhead ice footprints fit; stable scoops rise continuously; pour endpoints share the surface.`);
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
