/* Optional browser regression: Vite running, PLAYWRIGHT_MODULE and CHROME_PATH as needed. */
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
      page.on('console', m => { if (m.text().includes('could not draw')) errors.push(m.text()); });
      await page.goto(process.env.BASE_URL || 'http://localhost:5173/?test');
      await page.waitForFunction(() => window.__shop?.uiState.value.ready);
      await page.evaluate(() => __shop.store.dispatch({ type: 'START_DAY', day: 1 }));
      await page.waitForTimeout(150);
      await page.evaluate(() => __shop.uiState.set({ opening: false }));
      await page.waitForFunction(() => __shop.game().scene.getScene('counter').layout);
      await page.evaluate(() => {
        for (let i = 0; i < 60 && !__shop.store.state.slots.some(Boolean); i++) __shop.store.dispatch({ type: 'TICK', dt: 100 });
        __shop.store.dispatch({ type: 'SET_PAUSED', paused: true });
      });
      await page.waitForTimeout(200);
      await page.addStyleTag({ content: '.overlay { display:none!important }' });
      const screenshot = async name => { if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/cat-${name}-${viewport.width}.png` }); };
      const advance = ms => page.evaluate(async ms => {
        const stage = __shop.game().scene.getScene('counter').stage;
        for (let t = 0; t < ms; t += 25) {
          stage.updateMotion(25, false, true);
          if (t % 250 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
      }, ms);
      const entry = () => page.evaluate(() => {
        const s = __shop.game().scene.getScene('counter').stage, g = [...s.customers.values()].find(g => g.rank === 0);
        return { phase: g.walk?.phase, alpha: g.root.alpha, masked: !!g.root.getData('outside'), ready: __shop.uiState.value.counterReady,
          door: s.door.opening, owner: s.door.owner, id: g.view.customer.id, legs: [g.view.figure.joints.leftLeg.angle, g.view.figure.joints.rightLeg.angle] };
      });
      const untilEntry = async phase => {
        for (let i = 0; i < 180 && (await entry()).phase !== phase; i++) await advance(100);
        assert.equal((await entry()).phase, phase);
      };
      assert.equal((await entry()).ready, false, 'Customer cannot be served outside');
      assert.equal(await page.locator('.counter-register').isDisabled(), true);
      const gardenKey = await page.evaluate(async () => {
        const { DOOR_ART } = await import('/src/counter/doorGeometry.ts');
        const s = __shop.game().scene.getScene('counter'), d = s.stage.door;
        const art = DOOR_ART[s.layout.room.orientation];
        const original = d.walls[0].texture.getSourceImage();
        const c = document.createElement('canvas'); c.width = art.width; c.height = art.height;
        const ctx = c.getContext('2d'); ctx.drawImage(original, art.x, art.y, art.width, art.height, 0, 0, art.width, art.height);
        const source = ctx.getImageData(0, 0, art.width, art.height).data;
        const garden = d.garden.texture.getSourceImage().getContext('2d').getImageData(0, 0, art.width, art.height).data;
        const rightStart = art.width / 2;
        for (let y = 0; y < art.height; y++) for (let x = rightStart; x < art.width; x++) {
          const at = (y * art.width + x) * 4;
          for (let channel = 0; channel < 4; channel++) if (source[at+channel] !== garden[at+channel])
            throw new Error('The fixed right leaf or its scenery changed');
        }
        const glassX = art.glass.x + 20, glassY = art.glass.y + 45;
        const glassAt = (glassY * art.width + glassX) * 4;
        for (let channel=0;channel<4;channel++) if (source[glassAt+channel]!==garden[glassAt+channel])
          throw new Error('Visible outdoor scenery changed');
        const leaf = d.leftLeaf.texture.getSourceImage().getContext('2d').getImageData(0, 0, art.width, art.height).data;
        if (leaf[glassAt+3] !== 0) throw new Error('Moving door carries outdoor scenery');
        for (const [x,y] of [[art.handle.x + art.handle.width / 2, art.handle.y + art.handle.height / 2],
          [art.paw[0][0], art.paw[0][1]]]) {
          const at = (Math.floor(y) * art.width + Math.floor(x)) * 4;
          if (leaf[at+3] === 0) throw new Error('Handle or paw decal missing from moving door');
          if (source[at] === garden[at] && source[at+1] === garden[at+1] && source[at+2] === garden[at+2])
            throw new Error('Handle or paw decal remains fixed in the scenery');
        }
        return d.garden.texture.key;
      });
      await untilEntry('approach'); await advance(700);
      let e = await entry();
      await screenshot('approach');
      assert(e.masked && e.alpha === 1 && e.door === 0, 'Approach stays outside behind closed glass, with no fade: ' + JSON.stringify(e));
      assert(e.legs[0] * e.legs[1] < 0, 'Paws alternate while walking');
      await untilEntry('opening'); await advance(350);
      e = await entry();
      assert.equal(await page.evaluate(() => __shop.game().scene.getScene('counter').stage.door.garden.texture.key), gardenKey, 'Opening keeps the exact same garden');
      assert(e.door > 0 && e.door < 1 && e.owner === e.id, 'The arriving cat opens its reserved door gradually');
      await screenshot('opening');
      await untilEntry('crossing');
      assert((await entry()).door >= .99, 'The door is open before crossing');
      await advance(700);
      assert.equal((await entry()).masked, false, 'Crossing into the room clears the exterior wall mask');
      await screenshot('crossing');
      await untilEntry('aisle'); await advance(1800);
      await screenshot('aisle');
      assert.equal((await entry()).ready, false, 'The walk to the counter is deliberately unhurried');
      assert.equal((await entry()).alpha, 1);
      await untilEntry('done');
      assert.equal((await entry()).ready, true);
      assert.equal((await entry()).door, 0, 'Door closes after arrival');
      await screenshot('counter');
      const idle = () => page.evaluate(() => {
        const f = [...__shop.game().scene.getScene('counter').stage.customers.values()][0].view.figure;
        return { time: f.elapsed, body: f.joints.torso.y, tail: f.joints.tail.angle };
      });
      const frozen = await idle(); await page.waitForTimeout(250);
      assert.deepEqual(await idle(), frozen, 'Real scene updates respect pause');
      await advance(500); assert.notEqual((await idle()).body, frozen.body);
      await page.evaluate(() => {
        __shop.store.dispatch({ type: 'SET_PAUSED', paused: false });
        const stage = __shop.game().scene.getScene('counter').stage, g = [...stage.customers.values()].find(g => g.rank === 0);
        window.__catRig = g.view.figure;
        stage.updateMotion(25, false, true);
        if (__shop.store.state.slots[g.slot].atCounter !== true) throw new Error('Stage did not acknowledge physical arrival');
        __shop.store.dispatch({ type: 'TAKE_ORDER', slot: g.slot });
        const state = __shop.store.state;
        __shop.store.dispatch({ type: 'RESTORE', state: { ...state, cup: state.slots[g.slot].order,
          build: { ...state.build, fill: .65, lidded: true, straw: true, atCounter: true } } });
        __shop.store.dispatch({ type: 'SERVE' });
        __shop.store.dispatch({ type: 'SET_PAUSED', paused: true });
      });
      const exit = () => page.evaluate(() => {
        const s = __shop.game().scene.getScene('counter').stage, e = [...s.leaving.values()][0];
        if (!e) return null;
        return { phase: e.view.phase, alpha: e.root.alpha, facing: e.view.figure.facing, masked: !!e.root.getData('outside'),
          same: e.view.figure === window.__catRig, cup: e.view.figure.hand.length, door: s.door.opening,
          x: e.root.x, width: s.ctx.layout.metrics.charWidth * e.root.scaleX, wall: s.door.placement.x };
      });
      const untilExit = async phase => {
        for (let i = 0; i < 220 && (await exit())?.phase !== phase; i++) {
          assert.equal((await exit())?.alpha, 1, 'Leaving cat remains fully opaque');
          await advance(100);
        }
        assert.equal((await exit())?.phase, phase);
      };
      assert((await exit()).same && (await exit()).cup === 1, 'Live rig and drink transfer without a pop');
      await untilExit('turning'); await advance(200);
      const turning = await exit();
      await screenshot('turning');
      assert(turning.facing > 20 && turning.facing < 160, 'Turn progresses through profile instead of snapping to the back');
      const turnAngles = new Set();
      for (let i = 0; i < 20; i++) {
        await advance(25);
        turnAngles.add(await page.evaluate(() => window.__catRig.drawAngle));
      }
      assert(turnAngles.size >= 6, 'Remaining turn uses distinct intermediate illustrations');
      await untilExit('aisle'); await advance(2000);
      await screenshot('exit-aisle');
      assert.equal((await exit()).phase, 'aisle', 'Leaving cat takes a slow walk to the door');
      await untilExit('opening'); await advance(350);
      assert((await exit()).door > 0 && (await exit()).door < 1);
      await untilExit('crossing'); assert((await exit()).door >= .99);
      await advance(1000); assert.equal((await exit()).masked, true, 'Outside walls conceal the departing cat after the threshold');
      await untilExit('outside'); await advance(1200);
      const outside = await exit(); assert(outside && outside.alpha === 1, 'Cat walks away outside, still opaque');
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/door-exit-${viewport.width}.png` });
      await advance(1600);
      assert.equal(await exit(), null, 'Rig is removed only after walking behind the outside wall');
      assert.equal(await page.evaluate(() => window.__catRig.root.active), false);
      await advance(1000);
      assert.equal(await page.evaluate(() => __shop.game().scene.getScene('counter').stage.door.opening), 0);
      assert.deepEqual(errors, []);
      console.log(`check-customer-animation: ${viewport.width}: approach, handle, hinged door, crossing, slow walk, service gate, progressive turn, opaque exit, pause and cleanup passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
