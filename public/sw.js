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
 * - **Everything under `/assets/` and `/_expo/` is cache-first**, because every one of those
 *   filenames carries a hash of its own contents. They cannot go stale: a changed file is a
 *   different URL. So the first play downloads the artwork and no later one does.
 *
 * Only the page is precached. The export is twenty megabytes, and forcing that on someone who
 * opened a link to look at it would be rude; the game pulls its own artwork in behind the loading
 * screen (see `useArtwork`), and that pass is what fills the file cache. The page is the one
 * exception, and it has to be, because the visit that installs this worker is not itself handled
 * by it: without that first copy, the shop only became openable offline after a *second* online
 * visit, and nothing about the first one looked wrong.
 *
 * **If this ever goes wrong**, it is one file and it is undone from the browser: Settings → site
 * data → clear, or DevTools → Application → Service workers → Unregister. Bumping `VERSION` below
 * throws away everything both caches hold on the next visit.
 */
const VERSION = 'v1';
const PAGE_CACHE = `boba-shop-page-${VERSION}`;
const FILE_CACHE = `boba-shop-files-${VERSION}`;
const MINE = [PAGE_CACHE, FILE_CACHE];

/** The files whose names carry their own hash, and so can be kept until their name changes. */
const HASHED = /^\/(assets|_expo)\//;

/** The small fixed-name files the page asks for by hand. */
const TRIMMINGS = ['./manifest.webmanifest', './icons/icon-192.png', './favicon.ico'];

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
            if (asset.ok) await files.put(url, asset);
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

async function page(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const fresh = await fetch(request);
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
  const cache = await caches.open(FILE_CACHE);
  const kept = await cache.match(request);
  if (kept) return kept;
  const fresh = await fetch(request);
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

  if (request.mode === 'navigate') return event.respondWith(page(request));
  if (HASHED.test(url.pathname)) return event.respondWith(file(request));
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
});
