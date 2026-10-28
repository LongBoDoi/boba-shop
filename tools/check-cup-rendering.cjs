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
      const drySyrup = difference(render({ sweetness: '100' }, 0), empty, [30, 150, 83, 165]);
      const dissolved = difference(render({ sweetness: '100', tea: 'black' }, 0.2),
        render({ tea: 'black' }, 0.2), [25, 130, 88, 168]);
      const start = performance.now();
      for (let i = 0; i < 100; i++) painter.paint({ ...frame,
        drink: { ...EMPTY_DRINK, tea: 'black', milk: 'whole', ice: 'regular',
          toppings: ['pearls', 'pudding'], foam: 'cheese' },
        level: 0.65 + i * 0.003, agitation: 1, phase: i / 100 });
      // Include the final raster flush, without forcing a GPU readback between every frame.
      painter.canvas.getContext('2d').getImageData(0, 0, 1, 1);
      const averagePaintMs = (performance.now() - start) / 100;
      return { checked, leaks, clearIce: iceContrast(null), milkyIce: iceContrast('whole'),
        drySyrup, dissolved, averagePaintMs };
    });
    assert.deepEqual(result.leaks, [], 'Ingredients must never change pixels outside the cup interior');
    assert(result.clearIce > result.milkyIce, 'Milk obscures submerged ice more than clear tea');
    assert(result.drySyrup > 1, 'Syrup is visible before adding tea');
    assert.equal(result.dissolved, 0, 'Syrup has dissolved once tea covers the floor');
    console.log('check-cup-rendering:', JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
