/* Optional browser check: run Vite, set PLAYWRIGHT_MODULE and CHROME_PATH if needed. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 667 }, { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 568, height: 320 }, { width: 932, height: 430 }, { width: 768, height: 1024 }].filter(v => !process.env.VIEWPORT_WIDTH || v.width === Number(process.env.VIEWPORT_WIDTH))) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://localhost:5173/?test');
      await page.waitForFunction(() => window.__shop?.uiState.value.ready);
      const reset = async day => {
        await page.evaluate(day => __shop.store.dispatch({ type: 'START_DAY', day }), day);
        await page.waitForTimeout(100);
        await page.evaluate(() => {
          __shop.uiState.set({ opening: false }); __shop.goToPage(0, false);
          for (let i = 0; i < 150 && (__shop.store.state.slots.some(c => !c) || __shop.store.state.waveLeft > 0); i++) {
            __shop.store.dispatch({ type: 'TICK', dt: 100 });
          }
        });
        await page.waitForTimeout(1200);
        // Settle the longer doorway choreography in visual time without burning service patience.
        await page.evaluate(async () => {
          const stage = __shop.game().scene.getScene("counter").stage;
          for (let i = 0; i < 1600; i++) {
            if (![...stage.customers.values()].some(g => g.walk?.phase && g.walk.isPlaying())) break;
            stage.updateMotion(50, false, true);
            if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
          }
        });
        await page.waitForFunction(() => [...__shop.game().scene.getScene('counter').stage.customers.values()].every(g => !g.walk?.isPlaying()));
      };
      const customerPoint = async rank => page.evaluate(rank => {
        const scene = __shop.game().scene.getScene('counter'), l = scene.layout;
        const guest = [...scene.stage.customers.values()].find(g => g.rank === rank);
        const bounds = __shop.game().canvas.getBoundingClientRect(), camera = scene.cameras.main;
        return { x: bounds.x + camera.x / camera.zoom + guest.root.x,
          // Waiting faces overlap in perspective; tap their exposed crown, not a nearer guest.
          y: bounds.y + camera.y / camera.zoom + guest.root.y + (l.room.queueY - l.metrics.charHeight * (rank === 0 ? 0.65 : 0.97)) * guest.root.scaleX,
          slot: guest.slot };
      }, rank);
      for (const day of [1, 30]) {
        await reset(day);
        const geometry = await page.evaluate(() => {
          const scene = __shop.game().scene.getScene('counter'), l = scene.layout;
          return { count: scene.stage.customers.size,
            expected: __shop.store.state.slots.filter(Boolean).length + __shop.store.state.line.length,
            feet: l.room.queueY, h: l.height, coveredFeet: scene.stage.slotAt(l.room.queueX, l.room.queueY - 1),
            foregroundDepth: scene.backdrop.foreground.depth, bubble: l.stageHeight - l.metrics.bubbleBottom - 68,
            roomX: l.room.x, roomWidth: l.room.width, width: l.width, tableY: l.room.counterY,
            positions: [...scene.stage.customers.values()].sort((a,b) => a.rank - b.rank).map(g => ({
              y: g.root.y + l.room.queueY * g.root.scaleX, scale: g.root.scaleX, depth: g.root.depth,
              bubble: g.view.bubble.visible })), background: scene.backdrop.room.texture.key };
        });
        assert.equal(geometry.count, geometry.expected, 'Every waiting customer is rendered');
        assert.equal(geometry.coveredFeet, null, 'The counter surface cannot select the customer behind it');
        assert(geometry.foregroundDepth > geometry.positions[0].depth, 'The counter draws in front of the customer');
        assert(geometry.feet > 0 && geometry.feet < geometry.h && geometry.bubble >= 0);
        assert.equal(geometry.roomX, 0, 'The left side of the room is not cropped');
        assert.equal(geometry.roomWidth, geometry.width, 'The right side of the room is not cropped');
        assert(geometry.tableY / geometry.h >= 0.41 && geometry.tableY / geometry.h <= 0.51, 'Counter is near halfway down');
        assert(geometry.background.includes('cafe-peach-'));
        assert.equal(geometry.positions.filter(p => p.bubble).length, 1, 'Only one order bubble');
        geometry.positions.slice(1).forEach((p, i) => {
          assert(p.y < geometry.positions[i].y && p.scale < geometry.positions[i].scale && p.depth < geometry.positions[i].depth,
            'Each customer stands farther back, smaller, and behind the previous one');
        });
        const rear = await customerPoint(geometry.count - 1); await page.mouse.click(rear.x, rear.y);
        assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 0,
          'Tapping the rear customer cannot take their order');
        const front = await customerPoint(0); await page.mouse.click(front.x, front.y, { delay: 50 });
        await page.waitForFunction(slot => __shop.store.state.slots[slot]?.status === 'ordered', front.slot);
        assert.equal(await page.evaluate(slot => __shop.store.state.slots[slot]?.status, front.slot), 'ordered');
        assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 1);
        await page.mouse.click(front.x, front.y);
        await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
        assert.equal(await page.locator('.counter-register').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        // Finish and carry the real selected recipe, then use the register to serve it.
        const expectedNext = await page.evaluate(() => {
          const s = __shop.store.state, slot = s.selectedSlot;
          const next = s.slots.filter(Boolean).sort((a,b) => a.id-b.id)[1].id;
          __shop.store.dispatch({ type: 'RESTORE', state: { ...s, cup: s.slots[slot].order,
            build: { ...s.build, fill: 0.65, lidded: true, straw: true, atCounter: true } } });
          __shop.goToPage(0, false); return next;
        });
        await page.locator('.counter-register').click();
        await page.waitForTimeout(1000);
        assert.equal(await page.evaluate(() => [...__shop.game().scene.getScene('counter').stage.customers.values()].find(g => g.rank === 0).view.customer.id), expectedNext,
          'The next guest walks up after the register serves the cup');
        assert.equal(await page.evaluate(() => __shop.store.state.stats.served), 1);
      }
      await reset(30);
      const register = page.locator('.counter-register'), box = await register.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.height >= 44);
      await register.click();
      await register.click();
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 1,
        'Repeated register clicks cannot take another waiting order');
      await reset(30);
      const start = await customerPoint(0);
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(start.x - viewport.width * 0.43, start.y, { steps: 12 }); await page.mouse.up();
      await page.waitForFunction(() => __shop.uiState.value.pageOffset === 1);
      assert.equal(await page.evaluate(() => __shop.store.state.slots.filter(c => c?.status === 'ordered').length), 0);
      await reset(30);
      await page.evaluate(() => __shop.store.dispatch({ type: 'SET_PAUSED', paused: true }));
      assert(await register.isDisabled());
      await page.evaluate(() => __shop.store.dispatch({ type: 'SET_PAUSED', paused: false }));
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/counter-${viewport.width}.png` });
      assert.deepEqual(errors, []);
      console.log(`check-counter-screen: ${viewport.width}×${viewport.height}: FIFO line, service, register, navigation, swipe, pause passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
