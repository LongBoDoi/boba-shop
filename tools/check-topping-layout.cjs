'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/art/toppingGeometry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const geometry = { exports: {} };
new Function('exports', code)(geometry.exports);
const { toppingPanBands, toppingPanBounds, toppingPanMatrix, TOPPING_TRAY_EDGES } = geometry.exports;

function near(actual, expected) {
  assert(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);
}
function project(m, x, y) {
  const denominator = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / denominator,
    (m[1] * x + m[5] * y + m[13]) / denominator];
}

// Production geometry: outer edges and both column dividers must be straight through every row.
// Independently moving a middle row's corner must fail this check, even if its pans still touch.
const trayBack = TOPPING_TRAY_EDGES[0];
const trayFront = TOPPING_TRAY_EDGES[TOPPING_TRAY_EDGES.length - 1];
// The active 1452×1083 background's pan rims, measured away from rounded corners.
// Check their projection independently of the geometry's logical room coordinates.
const paintedLeftSlope = 25 / 298;
assert(Math.abs(trayFront.x0 - trayBack.x0 - paintedLeftSlope * (trayFront.y - trayBack.y)) < 1,
  'Left topping edge must remain parallel to the painted tray rim');
const paintedRightSlope = 60 / 298;
assert(Math.abs(trayFront.x1 - trayBack.x1 - paintedRightSlope * (trayFront.y - trayBack.y)) < 1,
  'Right topping edge must remain parallel to the painted tray rim');
const paintedRows = [
  { y: 589, left: 1086, right: 1386 },
  { y: 656, left: 1092, right: 1400 },
  { y: 731, left: 1099, right: 1416 },
  { y: 814, left: 1105, right: 1432 },
];
TOPPING_TRAY_EDGES.forEach((edge, index) => {
  const painted = paintedRows[index];
  assert(Math.abs((edge.y + 350) * 1083 / 1430 - painted.y) < 2,
    `Row boundary ${index} follows the painted horizontal rim`);
  assert(Math.abs(edge.x0 * 1452 / 1920 - painted.left) < 2,
    `Row boundary ${index} follows the painted left rim`);
  assert(Math.abs(edge.x1 * 1452 / 1920 - painted.right) < 2,
    `Row boundary ${index} follows the painted right rim`);
});
for (let row = 1; row < 3; row++) {
  assert(TOPPING_TRAY_EDGES[row + 1].y - TOPPING_TRAY_EDGES[row].y
    > TOPPING_TRAY_EDGES[row].y - TOPPING_TRAY_EDGES[row - 1].y,
  'Painted compartments deepen toward the front of the counter');
}
for (let divider = 0; divider <= 3; divider++) {
  const fraction = divider / 3;
  const xAt = edge => edge.x0 + (edge.x1 - edge.x0) * fraction;
  for (const edge of TOPPING_TRAY_EDGES) {
    near((xAt(edge) - xAt(trayBack)) * (trayFront.y - trayBack.y),
      (edge.y - trayBack.y) * (xAt(trayFront) - xAt(trayBack)));
  }
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

// The bands a phone is given instead of the matrix have to be the same tray: they must tile
// without a gap, and no band's rim may sit more than half a point off the fit it stands in for.
for (const shape of [
  { topLeft: 0, topRight: 1, bottomLeft: 0, bottomRight: 1 },
  { topLeft: 0.08, topRight: 0.96, bottomLeft: 0, bottomRight: 1 },
  { topLeft: 0, topRight: 0.95, bottomLeft: 0.04, bottomRight: 1 },
]) {
  for (const scale of [0.35, 0.53, 0.75, 1.5]) {
    const w = 140 * scale, h = 64 * scale;
    const m = toppingPanMatrix(w, h, shape);
    const bands = toppingPanBands(w, h, shape);
    near(bands[0].y, 0);
    near(bands[bands.length - 1].y + bands[bands.length - 1].h, h);
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (i > 0) near(band.y, bands[i - 1].y + bands[i - 1].h);
      near(band.top, i / bands.length);
      near(band.bottom, (i + 1) / bands.length);
      // Both rims, at the top and the bottom of the band, against the exact projective fit.
      for (const [source, edge] of [[0, band.x], [w, band.x + band.w]]) {
        for (const y of [band.y, band.y + band.h]) {
          const exact = project(m, source, y / (m[5] - m[7] * y));
          assert(Math.abs(exact[0] - edge) < 0.6,
            `band ${i} rim ${edge} is ${Math.abs(exact[0] - edge).toFixed(3)} off ${exact[0]}`);
        }
      }
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
console.log('Passed: straight topping columns; rim projection and bands at phone/tablet scales; covered seams.');
