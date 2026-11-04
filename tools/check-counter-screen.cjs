/* Optional browser check: run Vite, set PLAYWRIGHT_MODULE and CHROME_PATH if needed. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 },
      { width: 568, height: 320 }, { width: 932, height: 430 }, { width: 768, height: 1024 }]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://localhost:5173/?test');
      await page.waitForFunction(() => window.__shop?.uiState.value.ready);
      const reset = async day => {
        await page.evaluate(day => {
          __shop.store.dispatch({ type: 'START_DAY', day });
          __shop.uiState.set({ opening: false }); __shop.goToPage(0, false);
          for (let i = 0; i < 150 && __shop.store.state.slots.some(c => !c); i++) {
            __shop.store.dispatch({ type: 'TICK', dt: 100 });
          }
        }, day);
        await page.waitForTimeout(900);
      };
      const customerPoint = async slot => page.evaluate(slot => {
        const scene = __shop.game().scene.getScene('counter'), l = scene.layout;
        const bounds = __shop.game().canvas.getBoundingClientRect(), camera = scene.cameras.main;
        return { x: bounds.x + camera.x / camera.zoom + l.slots[slot].centre,
          y: bounds.y + camera.y / camera.zoom + l.room.queueY - l.metrics.charHeight * 0.65 };
      }, slot);
      for (const day of [1, 8]) {
        await reset(day);
        const geometry = await page.evaluate(() => {
          const scene = __shop.game().scene.getScene('counter'), l = scene.layout;
          return { count: __shop.store.state.slots.filter(Boolean).length,
            expected: l.slots.length, feet: l.room.queueY, h: l.height,
            bubble: l.stageHeight - l.metrics.bubbleBottom - 68,
            background: scene.backdrop.room.texture.key };
        });
        assert.equal(geometry.count, geometry.expected, 'Fixture has a complete queue');
        assert(geometry.feet > 0 && geometry.feet < geometry.h && geometry.bubble >= 0, 'Queue fits on screen');
        assert(geometry.background.includes('cafe-'), 'The painted cafe is active');
        for (let slot = 0; slot < geometry.count; slot++) {
          const p = await customerPoint(slot); await page.mouse.click(p.x, p.y);
          assert.equal(await page.evaluate(slot => __shop.store.state.slots[slot]?.status, slot), 'ordered',
            `${viewport.width}: customer ${slot} can be tapped`);
        }
        const p = await customerPoint(0); await page.mouse.click(p.x, p.y);
        await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
        assert.equal(await page.locator('.counter-register').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      }
      await reset(8);
      const register = page.locator('.counter-register');
      const box = await register.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.height >= 44,
        'The register shortcut remains visible and has a usable touch height');
      for (let i = 0; i < 3; i++) await register.click();
      assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 3);
      await register.click();
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      await reset(8);
      const start = await customerPoint(1);
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(start.x - viewport.width * 0.43, start.y, { steps: 12 }); await page.mouse.up();
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 0,
        'Swiping over a customer does not take an order');
      // The hand-over: a cup finished in the kitchen is carried out to the mat beside the till, and
      // the register is what gives it to the customer. Both halves, through the real buttons.
      await reset(8);
      await register.click();
      await page.evaluate(() => {
        const { store } = __shop;
        store.dispatch({ type: 'PICK_CUP', size: 'M' });
        store.dispatch({ type: 'POUR', category: 'tea', optionId: 'black', amount: 0.7 });
        store.dispatch({ type: 'LID_CUP' });
        store.dispatch({ type: 'ADD_STRAW' });
        __shop.goToPage(1, false);
      });
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      await page.locator('.prep-serve').click();
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 0);
      assert.equal(await page.evaluate(() => __shop.store.state.build.atCounter), true, 'The serve button carries the cup out to the counter');
      assert.equal(await page.evaluate(() => Boolean(__shop.game().scene.getScene('kitchen').cup)), false, 'And the kitchen mat is empty behind it');
      const handoff = await page.locator('.counter-handoff').boundingBox();
      assert(handoff && handoff.x >= 0 && handoff.y >= 0 && handoff.x + handoff.width <= viewport.width + 1
        && handoff.y + handoff.height <= viewport.height + 1, 'The cup stands on the mat, in full view');
      await page.waitForTimeout(700);
      assert.equal(await register.evaluate(el => el.textContent.startsWith('Trao ly')), true, 'The till offers to hand it over');
      await register.click();
      assert.equal(await page.evaluate(() => __shop.store.state.build.atCounter), false, 'Pressing it serves the drink');
      assert.equal(await page.locator('.counter-handoff').count(), 0, 'And the mat is clear again');

      await reset(8);
      await page.evaluate(() => __shop.store.dispatch({ type: 'SET_PAUSED', paused: true }));
      assert(await register.isDisabled(), 'Pause disables the register');
      await page.evaluate(() => __shop.store.dispatch({ type: 'SET_PAUSED', paused: false }));
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/counter-${viewport.width}.png` });
      assert.deepEqual(errors, []);
      console.log(`check-counter-screen: ${viewport.width}×${viewport.height}: two/three customers, register, navigation, swipe, the hand-over, pause passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
