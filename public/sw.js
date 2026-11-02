/**
 * The shop, kept on the phone.
 *
 * The game is handed out as a web page, and on a phone that page is the app: added to the home
 * screen it opens without browser chrome, and this is what makes it open at all with no signal and
 * stop re-downloading five megabytes of painted kitchen every time it is opened.
 *
 * Two caches, because the two kinds of file have opposite needs:
 *
 * - **The page itself is network-first.** `index.html` is the one file whose URL never changes, so
 *   caching it first would pin the shop to whatever build was current the day it was installed —
 *   and the deploy that publishes a new game would never reach anyone. Online, the newest page
 *   wins; offline, yesterday's page opens, which is the whole point.
 * - **Everything under `/assets/` is cache-first**, because every one of those filenames carries
 *   a hash of its own contents. They cannot go stale: a changed file is a
 *   different URL. So the first play downloads the artwork and no later one does.
 *
 * Only the page is precached. The build is twenty megabytes, and forcing that on someone who
 * opened a link to look at it would be rude; the game pulls its own artwork in behind the loading
 * screen (see `PreloadScene`), and that pass is what fills the file cache. The page is the one
 * exception, and it has to be, because the visit that installs this worker is not itself handled
 * by it: without that first copy, the shop only became openable offline after a *second* online
 * visit, and nothing about the first one looked wrong.
 *
 * ## The deploy that broke the shop, and the two lines that let it
 *
 * A hashed filename cannot go stale, but **the page that names it is not hashed** — and that is
 * the seam a deploy falls through. Two things have to be right about it and neither was:
 *
 * - **The page has to be asked for over the network, not out of the browser's own cache.**
 *   EAS Hosting sends `index.html` with **no `Cache-Control` at all**, which does not mean "do
 *   not cache": with nothing to go on a browser is free to invent a lifetime, and what it invents
 *   is a tenth of the file's age — so a page last deployed a day ago is kept for hours, and a
 *   launch in those hours never reaches the network to find out a new game exists. `page()` asks
 *   with `cache: 'reload'` for that reason. It costs one request for two kilobytes a launch, and
 *   it is the difference between a deploy arriving and a deploy arriving eventually.
 * - **A file the deployment hasn't got comes back as the page, with status 200.** That is the
 *   single-page-app fallback every static host does, and it is what turns a merely old page into
 *   a broken one: the stale page asks for `index-OLDHASH.js`, the host answers 200 `text/html`,
 *   the browser will not run HTML as a module, and the shop is a white screen. `ok` is therefore
 *   **not enough to cache on** — and caching it was the half that lasted, because these are
 *   served cache-first, so a page stored under a script's name is never asked about again. That
 *   was not a bad launch, it was a permanently broken install, curable only by clearing site data.
 *   `servedThePage()` is the test, and it is exact: there is no `.html` under `/assets/`.
 *
 * **If this ever goes wrong**, it is one file and it is undone from the browser: Settings → site
 * data → clear, or DevTools → Application → Service workers → Unregister. Bumping `VERSION` below
 * throws away everything both caches hold on the next visit — which is also how everyone already
 * holding a poisoned file is got out of it, and why this is `v2`.
 */
const VERSION = 'v2';
const PAGE_CACHE = `boba-shop-page-${VERSION}`;
const FILE_CACHE = `boba-shop-files-${VERSION}`;
const MINE = [PAGE_CACHE, FILE_CACHE];

/** The files whose names carry their own hash, and so can be kept until their name changes. */
const HASHED = /^\/assets\//;

/** The small fixed-name files the page asks for by hand. */
const TRIMMINGS = ['./manifest.webmanifest', './icons/icon-192.png'];

/**
 * Did the host answer a request for a *file* with the page instead?
 *
 * A static host serves `index.html` for any path it does not have, with status **200**, so a
 * missing file arrives looking exactly like a successful download. Nothing under `/assets/` is
 * ever HTML, so asking those two questions together is a complete test and cannot mistake a real
 * file for the fallback.
 */
function servedThePage(url, response) {
  return HASHED.test(url.pathname)
    && (response.headers.get('content-type') || '').toLowerCase().startsWith('text/html');
}

/**
 * What that should have been. The browser reports a 404 as a failed load, which is a thing a page
 * can react to; handing it HTML and letting it fail on the MIME type instead is how this went
 * unnoticed, because a module that will not parse says nothing to anyone but the console.
 */
function gone(url) {
  return new Response(`${url.pathname} is not in the deployment being served`, {
    status: 404,
    statusText: 'Not in this build',
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

self.addEventListener('install', (event) => {
  // Take over at once rather than waiting for every tab to close: a game is one tab, and the
  // alternative is a worker that only starts helping the launch after next.
  event.waitUntil((async () => {
    try {
      const response = await fetch('./', { cache: 'reload' });
      if (response.ok) {
        const html = await response.clone().text();
        const pages = await caches.open(PAGE_CACHE);
        await pages.put('./', response);
        // The icon and the manifest go in beside it. Their names carry no hash, so they are kept
        // here rather than with the hashed files: the fetch rule below asks the network for them
        // first and only falls back to these, which is what a changed icon needs.
        await Promise.all(TRIMMINGS.map(async (file) => {
          try {
            const kept = await fetch(file, { cache: 'reload' });
            if (kept.ok) await pages.put(file, kept);
          } catch (missing) { /* nothing here is worth failing an install over */ }
        }));
        // And whatever that page is made of. The bundle's name carries a hash, so the worker
        // cannot know it in advance — it reads it off the page it has just fetched. Without this
        // the page opened offline and then asked for a script that was never cached, because the
        // visit that installs a worker is not handled by it: a blank screen, on the one launch
        // where the player has been shown the game working.
        const files = await caches.open(FILE_CACHE);
        const sources = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
        await Promise.all(sources.map(async (source) => {
          const url = new URL(source, self.location.href);
          if (url.origin !== self.location.origin) return;
          try {
            const asset = await fetch(url, { cache: 'reload' });
            // The page was fetched a moment ago, so this should be its own bundle — but a deploy
            // landing between the two requests would hand back the new page under the old name,
            // and storing that is the poisoning this worker exists not to do.
            if (asset.ok && !servedThePage(url, asset)) await files.put(url, asset);
          } catch (missing) { /* the next visit will pick it up */ }
        }));
      }
    } catch (unreachable) {
      // Installing with no signal is not a failure worth refusing the worker over; the next
      // navigation it handles will put the page away.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('boba-shop-') && !MINE.includes(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function page() {
  const cache = await caches.open(PAGE_CACHE);
  try {
    // `cache: 'reload'` is the point of this function: see the note at the top of the file. The
    // request is rebuilt from the URL rather than passed through, because a navigation request
    // cannot carry an overridden cache mode, and `./` is the only navigation this game has.
    const fresh = await fetch('./', { cache: 'reload' });
    // Only a real page is worth keeping: a 404 or an error page from a proxy is not the shop.
    if (fresh.ok) await cache.put('./', fresh.clone());
    return fresh;
  } catch (offline) {
    const kept = await cache.match('./');
    if (kept) return kept;
    throw offline;
  }
}

async function file(request) {
  const url = new URL(request.url);
  const cache = await caches.open(FILE_CACHE);
  const kept = await cache.match(request);
  if (kept) return kept;
  const fresh = await fetch(request);
  // Before `ok`, because `ok` is true for the fallback page and this is served cache-first: what
  // is stored here is answered from for good.
  if (servedThePage(url, fresh)) return gone(url);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Anything that is not ours is none of our business — and a worker that answers for another
  // origin is a worker that can break it.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') return event.respondWith(page());
  if (HASHED.test(url.pathname)) return event.respondWith(file(request));
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
});
