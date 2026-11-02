/**
 * The deploy that cannot break the shop.
 *
 * A hashed filename cannot go stale, but the page that names it is not hashed, and a static host
 * answers a file it has not got with that same page — status 200, `text/html`. Put those two
 * together and a deploy hands a returning player a page asking for a script that no longer
 * exists, the browser will not run HTML as a module, and the shop is a white screen. Worse, the
 * worker used to *keep* that answer, and `/assets/` is served cache-first, so the install was
 * broken for good rather than for a launch.
 *
 * This drives the real `public/sw.js` against a fake device: a fake `CacheStorage`, and a fake
 * host that does what EAS Hosting was measured doing — including a **browser HTTP cache** that
 * holds a stale page and is only bypassed by `cache: 'reload'`, which is the whole of the first
 * half of the fix. Each check is written so that it fails if its guard is taken out again.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://boba-shop.expo.app/';

const SOURCE = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

/**
 * The worker's own cache names, read off the worker.
 *
 * Spelling `boba-shop-files-v2` into these checks instead would make two of them pass by
 * accident the next time `VERSION` moves: a lookup of a cache that no longer exists hands back
 * nothing, and "nothing was poisoned" is exactly what nothing looks like.
 */
const VERSION = /const VERSION = '(v\d+)'/.exec(SOURCE)?.[1];
assert.ok(VERSION, 'public/sw.js has no VERSION to read');
const PAGE_CACHE = `boba-shop-page-${VERSION}`;
const FILE_CACHE = `boba-shop-files-${VERSION}`;

const PAGE = (bundle) => `<!DOCTYPE html><html><head>`
  + `<link rel="stylesheet" href="/assets/${bundle}.css">`
  + `</head><body><script type="module" src="/assets/${bundle}.js"></script></body></html>`;

/**
 * Where one of the worker's requests points.
 *
 * It asks with all three of a string, a `URL` and a request object, and both stubs below have to
 * land them in the same place. Reading `.url` off a `URL` gives `undefined`, which quietly files
 * every asset under one key and makes these checks pass for the wrong reason — it did.
 */
const href = (request) => (typeof request === 'string'
  ? request
  : (request instanceof URL ? request.href : request.url));

/** What the host has, and what a browser already kept of it. */
function device({ bundle, kept }) {
  const site = new Map();
  const put = (at, body, type) => site.set(at, { body, type, status: 200 });
  put('/', PAGE(bundle), 'text/html');
  put(`/assets/${bundle}.js`, 'export const shop = 1;', 'application/javascript');
  put(`/assets/${bundle}.css`, 'body{}', 'text/css');
  put('/manifest.webmanifest', '{}', 'application/manifest+json');
  put('/icons/icon-192.png', 'PNG', 'image/png');

  // The browser's own cache. `index.html` comes with no `Cache-Control` at all, so a browser
  // invents a lifetime for it (a tenth of its age) and serves it without asking — which is how a
  // player reaches a new deployment still holding the old page.
  const http = new Map();
  if (kept) http.set('/', { body: PAGE(kept), type: 'text/html', status: 200 });

  const asked = [];
  let offline = false;

  const answer = (found) => new (globalThis.Response)(found.body, {
    status: found.status,
    headers: { 'content-type': found.type },
  });

  const fetch = async (input, init) => {
    const url = new URL(href(input), BASE);
    const reload = Boolean(init && init.cache === 'reload');
    asked.push({ at: url.pathname, reload });
    if (!reload && http.has(url.pathname)) return answer(http.get(url.pathname));
    if (offline) throw new TypeError('Failed to fetch');
    // **The fallback.** Measured on the live host: any path it has not got comes back as the page,
    // with status 200 and `content-type: text/html`, not as a 404.
    const found = site.get(url.pathname) ?? { body: PAGE(bundle), type: 'text/html', status: 200 };
    http.set(url.pathname, found);
    return answer(found);
  };

  return {
    site, http, asked, fetch,
    go: (state) => { offline = !state; },
    forget: (at) => site.delete(at),
  };
}

/** Enough of the Cache API for the worker to be itself. */
function storage(seed = {}) {
  const made = new Map(Object.entries(seed).map(([name, held]) => [name, new Map(Object.entries(held))]));
  const key = (request) => new URL(href(request), BASE).href;
  const cache = (held) => ({
    async put(request, response) { held.set(key(request), response.clone()); },
    async match(request) { const kept = held.get(key(request)); return kept ? kept.clone() : undefined; },
  });
  return {
    held: made,
    async open(name) {
      if (!made.has(name)) made.set(name, new Map());
      return cache(made.get(name));
    },
    async keys() { return [...made.keys()]; },
    async delete(name) { return made.delete(name); },
    async match(request) {
      for (const held of made.values()) {
        const kept = held.get(key(request));
        if (kept) return kept.clone();
      }
      return undefined;
    },
  };
}

/** Load the real worker and hand back its listeners. */
function worker(box) {
  const listeners = new Map();
  const self = {
    addEventListener: (name, run) => listeners.set(name, run),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    location: { href: BASE, origin: 'https://boba-shop.expo.app' },
  };
  const context = vm.createContext({
    self, caches: box.caches, fetch: box.fetch,
    Response: globalThis.Response, URL: globalThis.URL, console,
  });
  vm.runInContext(SOURCE, context);
  const fire = async (name, event) => {
    const waits = [];
    const raised = { ...event, waitUntil: (p) => waits.push(p), respondWith: (p) => waits.push(p) };
    listeners.get(name)(raised);
    const [answered] = await Promise.all(waits);
    return answered;
  };
  return {
    install: () => fire('install', {}),
    activate: () => fire('activate', {}),
    get: (url, mode) => fire('fetch', { request: { url: new URL(url, BASE).href, method: 'GET', mode } }),
  };
}

const bench = (seed, held) => {
  const box = device(seed);
  box.caches = storage(held);
  return { box, sw: worker(box) };
};

// Quiet while it passes, like the rest of the checks: what a failure needs is in the assertions.
let checks = 0;
const check = (what, run) => { run(); checks += 1; };
const checkAsync = async (what, run) => { await run(); checks += 1; };

async function main() {

  await checkAsync('a deploy reaches a browser holding the old page', async () => {
    // The player's browser kept the page from build "old"; the host is now serving "new".
    const { box, sw } = bench({ bundle: 'new', kept: 'old' });
    const got = await sw.get('/', 'navigate');
    const html = await got.text();
    assert.match(html, /assets\/new\.js/,
      'the navigation was answered out of the browser cache: page() must fetch with cache: reload');
    assert.ok(box.asked.some((one) => one.at === '/' && one.reload), 'the page was not asked for afresh');
  });

  await checkAsync('with no signal, yesterday\'s page still opens', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    await sw.get('/', 'navigate');
    box.go(false);
    const got = await sw.get('/', 'navigate');
    assert.match(await got.text(), /assets\/new\.js/, 'the kept page was not served offline');
  });


  await checkAsync('the fallback page is refused rather than run as a script', async () => {
    const { sw } = bench({ bundle: 'new' });
    const got = await sw.get('/assets/old.js');
    assert.strictEqual(got.status, 404,
      'a 200 of text/html was passed off as the bundle; the browser fails on the MIME type instead');
    assert.doesNotMatch(await got.text(), /<!DOCTYPE/i, 'the page itself was handed back');
  });

  await checkAsync('and is not kept, so the install is not broken for good', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    await sw.get('/assets/old.js');
    const held = box.caches.held.get(FILE_CACHE);
    assert.ok(held, `the worker never opened ${FILE_CACHE}`);
    assert.deepStrictEqual([...held.keys()], [],
      'the fallback page was cached under a script name — and /assets/ is cache-first, so it is '
      + 'answered from for ever');
  });

  await checkAsync('a file that comes back later is picked up', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    await sw.get('/assets/late.js');                       // mid-deploy: not there yet
    box.site.set('/assets/late.js', { body: 'export const shop = 2;', type: 'application/javascript', status: 200 });
    box.http.delete('/assets/late.js');
    const got = await sw.get('/assets/late.js');
    assert.strictEqual(got.status, 200, 'the earlier refusal was cached and never re-asked');
    assert.match(await got.text(), /shop = 2/);
  });

  await checkAsync('a real file is still kept and served from the cache', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    const first = await sw.get('/assets/new.js');
    assert.strictEqual(first.status, 200);
    box.forget('/assets/new.js');
    box.http.delete('/assets/new.js');
    const again = await sw.get('/assets/new.js');
    assert.match(await again.text(), /shop = 1/, 'the hashed file was not served cache-first');
  });


  await checkAsync('a deploy landing mid-install is not stored as the bundle', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    box.forget('/assets/new.js');                          // the page names it; the host has moved on
    await sw.install();
    const held = box.caches.held.get(FILE_CACHE);
    assert.ok(held, `the worker never opened ${FILE_CACHE}`);
    assert.ok(![...held.keys()].some((at) => at.endsWith('new.js')),
      'the fallback page was prefetched as the bundle');
  });

  await checkAsync('the page and its trimmings are precached', async () => {
    const { box, sw } = bench({ bundle: 'new' });
    await sw.install();
    const pages = [...box.caches.held.get(PAGE_CACHE).keys()];
    assert.ok(pages.some((at) => at === BASE), 'the page was not precached');
    assert.ok(pages.some((at) => at.endsWith('manifest.webmanifest')));
    const files = [...box.caches.held.get(FILE_CACHE).keys()];
    assert.ok(files.some((at) => at.endsWith('new.js')), 'the bundle was not read off the page');
  });


  await checkAsync('activating throws away an older version\'s caches', async () => {
    const before = `boba-shop-files-v${Number(VERSION.slice(1)) - 1}`;
    const { box, sw } = bench({ bundle: 'new' }, {
      [before]: { [`${BASE}assets/old.js`]: new Response('<!DOCTYPE html>') },
    });
    await sw.activate();
    assert.ok(!box.caches.held.has(before),
      'the version was not bumped, so a player with HTML cached under a script name stays broken');
  });

  check('the worker\'s version is ahead of the one that poisoned caches', () => {
    assert.ok(Number(VERSION.slice(1)) >= 2,
      `VERSION must be v2 or later for a poisoned install to be swept, saw ${VERSION}`);
  });


  check('the repair is inline, before the bundle it is there to survive', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const repair = html.indexOf('boba-shop.repaired');
    const bundle = html.indexOf('src="/src/main.tsx"');
    assert.ok(repair > 0, 'index.html carries no recovery for a bundle that will not load');
    assert.ok(repair < bundle, 'the recovery is after the script it has to outlive');
    assert.match(html, /addEventListener\('error'[\s\S]{0,400}true\)/,
      'a resource error does not bubble: the listener has to capture');
    assert.match(html, /fetch\('\.\/', \{ cache: 'reload' \}\)/,
      'reloading without refreshing the browser\'s copy of the page is served the same stale page');
    assert.match(html, /Thử lại/, 'there is no way off the message');
  });


  check('a page served for a file is not written into a build', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/updates/live.ts'), 'utf8');
    assert.match(src, /function servedThePage/, 'live.ts does not test for the host\'s fallback');
    assert.match(src, /if \(servedThePage\(file, answer\.headers \?\? \{\}\)\)/,
      'the test exists but the downloader does not consult it');
    const guard = src.indexOf('servedThePage(file, answer.headers');
    const write = src.indexOf('Filesystem.writeFile({ path: to');
    assert.ok(guard > 0 && guard < write, 'the file is written before it is checked');
  });

  console.log(`check-web-cache: a deploy cannot pin the page or poison the file cache; `
    + `${checks} checks against ${VERSION} of the worker.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
