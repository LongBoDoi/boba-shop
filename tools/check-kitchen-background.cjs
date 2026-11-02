/* Optional browser check: run Vite, then set PLAYWRIGHT_MODULE / CHROME_PATH if needed. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 932, height: 430 }]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://localhost:5173/?test');
      await page.waitForFunction(() => window.__shop?.uiState.value.ready);
      await page.evaluate(() => {
        __shop.store.dispatch({ type: 'START_DAY', day: 8 });
        __shop.uiState.set({ opening: false });
        __shop.goToPage(1, false);
      });
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      const stations = await page.evaluate(() => {
        const scene = __shop.game().scene.getScene('kitchen');
        return scene.layout.stations.map(({ kind, id }) => ({ kind, id }));
      });
      const point = async (kind, id) => {
        await page.evaluate(({ kind, id }) => {
          const scene = __shop.game().scene.getScene('kitchen');
          const target = kind === 'rack' ? scene.layout.rack.find(s => s.size === id)
            : scene.layout.stations.find(s => s.kind === kind && s.id === id);
          scene.panVelocity = 0;
          scene.setPan(Math.max(0, Math.min(scene.layout.room.maxPan, target.x + target.w / 2 - scene.W / 2)));
        }, { kind, id });
        await page.waitForTimeout(40);
        return page.evaluate(({ kind, id }) => {
          const scene = __shop.game().scene.getScene('kitchen');
          const target = kind === 'rack' ? scene.layout.rack.find(s => s.size === id)
            : scene.layout.stations.find(s => s.kind === kind && s.id === id);
          const bounds = __shop.game().canvas.getBoundingClientRect(), camera = scene.cameras.main;
          return { x: bounds.x + camera.x / camera.zoom + target.x + target.w / 2 - scene.pan,
            y: bounds.y + camera.y / camera.zoom + target.y + target.h * 0.5 };
        }, { kind, id });
      };
      const click = async (kind, id) => { const p = await point(kind, id); await page.mouse.click(p.x, p.y); };
      for (const size of ['S', 'M', 'L']) {
        await page.evaluate(() => __shop.store.dispatch({ type: 'CLEAR_CUP' }));
        await click('rack', size);
        assert.equal(await page.evaluate(() => __shop.store.state.cup.size), size);
      }
      for (const { kind, id } of stations) {
        await page.evaluate(kind => {
          __shop.store.dispatch({ type: 'CLEAR_CUP' });
          __shop.store.dispatch({ type: 'PICK_CUP', size: 'M' });
          if (kind !== 'tea') __shop.store.dispatch({ type: 'POUR', category: 'tea', optionId: 'black', amount: 0.55 });
          if (kind === 'straw') __shop.store.dispatch({ type: 'LID_CUP' });
        }, kind);
        await click(kind, id);
        if (kind === 'tea') {
          const p = await point(kind, id);
          await page.mouse.move(p.x, p.y); await page.mouse.down();
          await page.waitForTimeout(450); await page.mouse.up();
        }
        const state = await page.evaluate(() => ({ cup: __shop.store.state.cup, build: __shop.store.state.build }));
        if (kind === 'tea' || kind === 'milk' || kind === 'foam') assert.equal(state.cup[kind], id, `${kind}:${id}`);
        if (kind === 'topping') assert(state.cup.toppings.includes(id), id);
        if (kind === 'ice') assert.equal(state.build.iceScoops, 1);
        if (kind === 'sugar') assert.equal(state.build.sugarPumps, 1);
        if (kind === 'lid') assert.equal(state.build.lidded, true);
        if (kind === 'straw') assert.equal(state.build.straw, true);
      }
      await page.evaluate(() => {
        __shop.store.dispatch({ type: 'CLEAR_CUP' });
        const scene = __shop.game().scene.getScene('kitchen');
        scene.setPan(scene.layout.room.maxPan);
      });
      await page.waitForTimeout(1100);
      const rendered = await page.evaluate(() => {
        const scene = __shop.game().scene.getScene('kitchen');
        return scene.room.list.filter(item => item.visible && item.alpha > 0).map(item => item.texture?.key);
      });
      assert.equal(rendered.length, 1, 'At rest the room is exactly one image, with no station or patch sprites');
      assert(rendered[0].includes('kitchen-unified'), 'The visible room is the complete painting');
      assert.deepEqual(errors, []);
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/kitchen-unified-${viewport.width}.png` });
      console.log(`Passed ${viewport.width}×${viewport.height}: S/M/L, all ${stations.length} station targets, one room image, no browser errors.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
