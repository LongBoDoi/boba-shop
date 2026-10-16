'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/components/art/toppingGeometry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const geometry = { exports: {} };
new Function('exports', code)(geometry.exports);
const { toppingPanBounds, toppingPanMatrix } = geometry.exports;

function near(actual, expected) {
  assert(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);
}
function project(m, x, y) {
  const denominator = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / denominator,
    (m[1] * x + m[5] * y + m[13]) / denominator];
}

// Straight and skewed cells must map all four painted rim corners to their intended boundaries.
for (const shape of [
  { topLeft: 0, topRight: 1, bottomLeft: 0, bottomRight: 1 },
  { topLeft: 0.08, topRight: 0.96, bottomLeft: 0, bottomRight: 1 },
  { topLeft: 0, topRight: 0.95, bottomLeft: 0.04, bottomRight: 1 },
]) {
  for (const scale of [0.35, 0.53, 0.75, 1.5]) {
    const w = 140 * scale, h = 64 * scale;
    const m = toppingPanMatrix(w, h, shape);
    assert.equal(m.length, 16);
    assert(m.every(Number.isFinite));
    for (const [sx, sy, dx, dy] of [
      [0.078, 0, shape.topLeft, 0], [0.926, 0, shape.topRight, 0],
      [-0.004, 1, shape.bottomLeft, 1], [1.002, 1, shape.bottomRight, 1],
    ]) {
      const [x, y] = project(m, sx * w, sy * h);
      near(x, dx * w); near(y, dy * h);
    }
  }
}

const back = { x0: 1127, x1: 1499, y: 456 };
const front = { x0: 1117, x1: 1507, y: 516 };
const bins = [0, 1, 2].map(column => toppingPanBounds(back, front, column));
for (let i = 0; i < 2; i++) {
  for (const [leftCorner, rightCorner] of [['topRight', 'topLeft'], ['bottomRight', 'bottomLeft']]) {
    const right = bins[i].x + bins[i].w * bins[i].shape[leftCorner];
    const left = bins[i + 1].x + bins[i + 1].w * bins[i + 1].shape[rightCorner];
    near(right - left, 2);
  }
}
console.log('Passed: topping rim projection at phone/tablet scales; adjoining bins share covered seams.');
