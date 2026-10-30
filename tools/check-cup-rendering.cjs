/* Optional browser check: run Vite first. PLAYWRIGHT_MODULE and CHROME_PATH can select local installs. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BASE_URL || 'http://localhost:5173/?test');
    const result = await page.evaluate(async () => {
      const { CupPainter } = await import('/src/kitchen/cupPainter.ts');
      const art = await import('/src/art/kitchenArt.ts');
      const { TOPPING_PIECES } = await import('/src/art/toppingArt.ts');
      const { CUP_GLASS, frontalCupGlass } = await import('/src/art/frontalCupArt.ts');
      const { createIceLayout } = await import('/src/art/iceLayout.ts');
      const { EMPTY_DRINK, TOPPINGS, TEAS, FOAMS } = await import('/src/game/ingredients.ts');
      const { CUP_CONTENTS, CUP_NEAR_LIP_BAND } = await import('/src/art/cupGeometry.ts');
      const { insertedStrawX, paintInsertedStraw, paintLid } = await import('/src/art/finishingArt.ts');
      const load = async url => { const img = new Image(); img.src = url; await img.decode(); return img; };
      const [sprite, cream, ice, pieces] = await Promise.all([
        load(CUP_GLASS), load(art.CUP_CREAM), load(art.CUP_ICE), load(TOPPING_PIECES),
      ]);
      const urls = [...Object.values(art.DRINK), ...Object.values(art.DRINK_MILKY),
        ...Object.values(art.DRINK_TOP), ...Object.values(art.DRINK_MILKY_TOP)];
      const drinks = new Map(await Promise.all(urls.map(async url => [url, await load(url)])));
      const painter = new CupPainter({ reference: sprite, sprite: frontalCupGlass(sprite), cream, ice, pieces,
        drink: (id, milky) => ({ body: drinks.get((milky ? art.DRINK_MILKY : art.DRINK)[id]),
          top: drinks.get((milky ? art.DRINK_MILKY_TOP : art.DRINK_TOP)[id]) }) }, 226, 348);
      const frame = { iceLayout: createIceLayout(7), iceSettle: [], portionSettle: [], phase: 0.2, agitation: 0 };
      const render = (drink, level, extra = {}) => {
        painter.paint({ ...frame, drink: { ...EMPTY_DRINK, size: 'M', ...drink }, level, ...extra });
        return painter.canvas.getContext('2d').getImageData(0, 0, 226, 428).data;
      };
      const empty = render({}, 0);
      const mask = document.createElement('canvas'); mask.width = 226; mask.height = 428;
      const c = mask.getContext('2d'); c.scale(2, 2); c.translate(0, 40);
      const allowed = foam => {
        c.clearRect(0, -40, 113, 214);
        const well = new Path2D(CUP_CONTENTS);
        c.fill(well); c.lineWidth = 2; c.stroke(well);
        if (foam) {
          c.fillRect(0, -40, 113, 68);
          const lip = new Path2D(CUP_NEAR_LIP_BAND); c.fill(lip); c.stroke(lip);
        }
        return c.getImageData(0, 0, 226, 428).data;
      };
      const normalMask = allowed(false), creamMask = allowed(true);
      const cases = [
        ...TOPPINGS.map(t => ({ toppings: [t.id] })),
        { ice: 'less' }, { ice: 'regular' }, { sweetness: '100' },
        ...TEAS.map(t => ({ tea: t.id, toppings: ['pearls', 'aloe'], ice: 'regular' })),
        { milk: 'whole', toppings: ['redbean'] }, { tea: 'black', milk: 'oat', ice: 'regular' },
        ...FOAMS.filter(f => !f.isNone).map(f => ({ tea: 'matcha', foam: f.id, ice: 'regular', toppings: ['pearls'] })),
      ];
      let checked = 0;
      const leaks = [];
      for (const drink of cases) for (const level of [0, 0.02, 0.18, 0.5, 0.85, 1]) {
        const pixels = render(drink, level, { iceSettle: Array(12).fill(0.3), portionSettle: [0.4, 0.7] });
        const boundary = drink.foam ? creamMask : normalMask;
        for (let i = 0; i < pixels.length; i += 4) {
          if (boundary[i + 3]) continue;
          if ([0, 1, 2, 3].some(ch => Math.abs(pixels[i + ch] - empty[i + ch]) > 3)) {
            leaks.push({ drink, level, x: i / 4 % 226, y: Math.floor(i / 4 / 226) }); break;
          }
        }
        checked++;
      }
      const difference = (a, b, box) => {
        let sum = 0, n = 0;
        for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
          const at = ((y + 40) * 2 * 226 + x * 2) * 4;
          for (let ch = 0; ch < 3; ch++) sum += Math.abs(a[at + ch] - b[at + ch]);
          n += 3;
        }
        return sum / n;
      };
      const iceContrast = milk => difference(render({ tea: 'black', milk, ice: 'regular' }, 0.8),
        render({ tea: 'black', milk }, 0.8), [28, 80, 85, 106]);
      const iceVisibility = TEAS.map(tea => ({ id: tea.id,
        contrast: difference(render({ tea: tea.id, milk: 'whole', ice: 'regular' }, 0.8),
          render({ tea: tea.id, milk: 'whole' }, 0.8), [28, 80, 85, 106]),
      }));
      const drySyrup = difference(render({ sweetness: '100' }, 0), empty, [30, 150, 83, 165]);
      const dissolved = difference(render({ sweetness: '100', tea: 'black' }, 0.2),
        render({ tea: 'black' }, 0.2), [25, 130, 88, 168]);
      const finishOverlay = straw => {
        const c = painter.canvas.getContext('2d');
        paintLid(c, sprite, 'front');
        if (straw) paintInsertedStraw(c, sprite, 'outside');
        return c.getImageData(0, 0, 226, 428).data;
      };
      const finished = (milk, straw, foam = null) => {
        render({ tea: 'black', milk, foam }, 0.8, { lidded: true, straw });
        return finishOverlay(straw);
      };
      const shaftDifference = (a, b, y0, y1, wet = false) => {
        let sum = 0;
        for (let y = y0; y < y1; y++) {
          const x = Math.round(insertedStrawX(y) + (wet ? 0.8 : 0));
          sum += difference(a, b, [x - 3, y, x + 3, y + 1]);
        }
        return sum / (y1 - y0);
      };
      const strawAir = shaftDifference(finished(null, true), finished(null, false), -25, -10);
      const strawTea = shaftDifference(finished(null, true), finished(null, false), 112, 138, true);
      const strawMilk = shaftDifference(finished('whole', true), finished('whole', false), 112, 138, true);
      const strawCream = difference(finished(null, true, 'cheese'), finished(null, false, 'cheese'), [53, 27, 60, 45]);
      const belowStraw = difference(finished(null, true), finished(null, false), [48, 157, 76, 173]);
      // Compare against the tube painted directly over the far rim: no far-wall pixels may
      // cover it. The near wall remains a later layer, retaining the cup's depth cue.
      render({ tea: 'black' }, 0.8, { lidded: true });
      const rimContext = painter.canvas.getContext('2d');
      rimContext.save(); rimContext.globalAlpha = 0.78;
      paintInsertedStraw(rimContext, sprite, 'inside'); rimContext.restore();
      const expectedRim = finishOverlay(true);
      const rearRimOcclusion = shaftDifference(finished(null, true), expectedRim, 3, 7);
      const teaFrame = ambientPhase => render({ tea: 'oolong' }, 0.8, { ambientPhase });
      const ambientMotion = difference(teaFrame(0.2), teaFrame(0.65), [30, 65, 85, 145]);
      const loopSeam = difference(teaFrame(0), teaFrame(1), [30, 65, 85, 145]);
      const chroma = pixels => {
        let sum = 0, n = 0;
        for (let y = 80; y < 130; y++) for (let x = 35; x < 80; x++) {
          const at = ((y + 40) * 2 * 226 + x * 2) * 4;
          const rgb = [pixels[at], pixels[at + 1], pixels[at + 2]];
          sum += Math.max(...rgb) - Math.min(...rgb); n++;
        }
        return sum / n;
      };
      const milkColour = TEAS.map(tea => {
        const plain = chroma(render({ tea: tea.id }, 0.8));
        const milk = chroma(render({ tea: tea.id, milk: 'whole' }, 0.8));
        return { id: tea.id, retainedChroma: milk / plain };
      });
      const start = performance.now();
      for (let i = 0; i < 100; i++) painter.paint({ ...frame,
        drink: { ...EMPTY_DRINK, tea: 'black', milk: 'whole', ice: 'regular',
          toppings: ['pearls', 'pudding'], foam: 'cheese' },
        level: 0.65 + i * 0.003, agitation: 1, phase: i / 100 });
      // Include the final raster flush, without forcing a GPU readback between every frame.
      painter.canvas.getContext('2d').getImageData(0, 0, 1, 1);
      const averagePaintMs = (performance.now() - start) / 100;
      return { checked, leaks, clearIce: iceContrast(null), milkyIce: iceContrast('whole'),
        iceVisibility, drySyrup, dissolved, strawAir, strawTea, strawMilk, strawCream, belowStraw, rearRimOcclusion,
        ambientMotion, loopSeam, milkColour, averagePaintMs };
    });
    assert.deepEqual(result.leaks, [], 'Ingredients must never change pixels outside the cup interior');
    assert(result.clearIce > result.milkyIce, 'Milk obscures submerged ice more than clear tea');
    assert(result.iceVisibility.every(tea => tea.contrast > 12),
      'Ice remains readable in every milk-tea palette');
    assert(result.drySyrup > 1, 'Syrup is visible before adding tea');
    assert.equal(result.dissolved, 0, 'Syrup has dissolved once tea covers the floor');
    assert(result.strawAir > 10, 'The straw remains visible through the complete lid overlay');
    assert(result.strawTea > result.strawMilk, 'Milk softens the submerged straw more than clear tea');
    assert(result.strawMilk > 12, 'The submerged straw stays readable in milk tea');
    assert(result.milkColour.every(tea => tea.retainedChroma > 0.55),
      'Every milk tea retains its pigment instead of washing out to near-white');
    assert(result.strawCream < 1, 'Opaque cream occludes the inserted straw');
    assert.equal(result.belowStraw, 0, 'The straw ends above the curved floor');
    assert(result.rearRimOcclusion < 2, 'The far cup rim stays behind the inserted straw (raster tolerance)');
    assert(result.ambientMotion > 0.1, 'Settled tea has visible ambient movement without pouring');
    assert(result.loopSeam < 0.05, 'Ambient tea loops without a visible jump');
    console.log('check-cup-rendering:', JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
