# Tiệm Trà Sữa (boba-shop)

A mobile cooking game run as two swipeable pages: a **Counter** where customers wait and the
player taps each one to take their order, and a **Preparation** room where the player picks a
taken-order ticket, builds the cup ingredient by ingredient, and serves it before the customer runs
out of patience. **All player-facing text is Vietnamese.**

It is a **web game**: Phaser 4 draws the world on one canvas, Preact draws everything with words on
it as HTML over that canvas, Vite builds it, and the page is what ships. The phone apps are the
same build in a Capacitor shell. There is no React Native and no Expo in it any more — the one
thing left with Expo's name on it is EAS Hosting, which serves the page (see
`docs/deployment.md`), and `app.json`, which is only that hosting project's identity.

Why it was rebuilt, since it is the one piece of history that still binds: drawn through
`react-native-svg`, every shape in the game was an Android `View` — the prep screen was about 1,430
of them, 630 of which were the cup, and the count grew with every scoop. That is what "it lags
after adding ingredients" was, and two rounds of cutting the *drawing* cost did not help, because
the cost was per view and not per pixel. On the same scripted play at an 8x CPU slowdown (carry a
scoop over a loaded cup, carry the cup, idle, add a topping, add ice) the old build averaged ~17 ms
a frame with 70–200 ms stalls on every grab and drop; this one averages 7–11 ms with its worst
frame around 50–120 ms.

## Commands

```bash
npm install
npm run dev          # Vite on the LAN (--host); open it on a phone on the same Wi-Fi
npm run build        # typecheck, then build into dist/
npm run preview      # serve the built dist/ (--host)
npm run typecheck    # tsc --noEmit
npm test             # the regression scripts
npm run sync         # cap sync: copy dist/ into android/ and ios/
```

Run `npm run typecheck` and `npm test` before calling a change done. The regression scripts check
serving behaviour, saving and restoring, patience, pay and the opening sign's news, staying open and
buying for the shop, groups and the line, the regulars, the cup sizes, the sound (its assets, its
catalogue and its whole lifecycle against a fake audio context), the topping tray's geometry, the
sideways layouts and the backup code; see "Verifying changes" below. `package.json`'s `test` script
names every one of them by hand, so a new `tools/check-*.cjs` does not run until it is added there.
`tools/sim/` is a bot that plays whole shifts and it is not part of `npm test`; see "What the bot
found". There is **no lint step** — the old one was
`eslint-config-expo` and went with Expo; `tsc` is strict and is the gate, and it is the gate for
dead code too: `noUnusedLocals` and `noUnusedParameters` are on, so an import or a local nothing
reads is a build error rather than something that accumulates for a year. An unused *export* is
the one thing it cannot see — nothing in the toolchain can — so that still needs somebody to walk
the import graph; see "Verifying changes".

`/art-test.html` on the dev server draws every piece of SVG art in `src/art/` with a spread of
parameters, including rasterised through an `Image` the way a texture is made. It is not part of
the game.

### Deploying (EAS Hosting)

The game is published at https://boba-shop.expo.app (Expo account `manhlong`, project
`@manhlong/boba-shop`, id in `app.json`). Pushes to `main` deploy automatically after the checks
pass; see `docs/deployment.md`. To deploy locally:

```bash
npx vite build && NODE_OPTIONS="--dns-result-order=ipv4first" npx eas-cli@latest deploy --prod
```

That `NODE_OPTIONS` is not decoration: `eas-cli` uses `node-fetch` over an IPv6 path some networks
reset, and without it every request dies with `read ECONNRESET`. It also needs
`npx eas-cli@latest login` on a new machine.

**One deployment, one link.** `--prod` publishes to the production alias and that is the only
address the shop has; `--alias <name>` would add another (there was a `boba-shop--phaser.expo.app`
while this was a preview — it is deleted). An installed page is pinned to the address it was
installed from, so a second link is a second game to keep in step.

### Playing on a phone

**The phone app is the web page, installed.** Open https://boba-shop.expo.app and add it to the
home screen: it opens with no browser chrome, keeps its own storage, plays with no signal and is
always the newest build (see "The page as the app"). Nothing to install, nothing to update.

The native builds are the same `dist/` in a Capacitor shell:
`.github/workflows/build-apps.yml` is run by hand and publishes an `.apk` and an unsigned `.ipa` to
a GitHub release. Three things about them:

- **The app id is `com.manhlong.bobashop.phaser`, not the old app's `com.manhlong.bobashop`**, and
  it has to stay that way. Android installs a build over another only when the id *and* the signing
  key match, and the old app's key lives in the build service that made it. So this installs beside
  it rather than over it. Everyone who installed the preview keeps their shop, because for them
  nothing changed.
- **The `.apk`'s signing key is committed** (`android/app/preview-signing.p12`, password in
  `android/app/build.gradle`) on purpose: the file is handed out directly, and a key that stays the
  same is what lets a newer `.apk` install over an older one and keep the player's shop. A store
  release would need a key that is a secret.
- **An installed app keeps itself up to date**, and asks before it does — see "Updating itself".
  The rare change it cannot take that way is one to its own native shell, and then it says so and
  offers the file.

A shop moves between the page, the app and the old app with the **backup code** in the settings
card (`src/game/saveCode.ts`): each install keeps its own storage and nothing syncs them.

### The page as the app

Installed to a home screen the page is the game: its own icon, no browser chrome, its own storage,
and no signal needed. Four small things in `public/` do it, and Vite copies that folder into
`dist` as it stands.

- **`manifest.webmanifest`** names it (`display: standalone`, so no address bar), paints the
  surround `#FFE3EC` and lists the icons. `orientation` is `any` — sideways is a layout this game
  has (see "Turning it on its side").
- **`icons/`** is generated by `tools/make-web-icons.cjs` from the app's own icon and its Android
  adaptive icon. Two square and one **maskable**, which is the one that matters: a launcher may
  crop an icon to whatever shape it likes, and without a maskable one Chrome puts the square icon
  on a white circle. The adaptive *foreground* is already drawn inside a safe circle, which is why
  it is the one flattened for it. The script reads and writes PNG with `zlib` and nothing else —
  resizing is the only thing the toolchain cannot already do, and that is not worth a dependency.
- **`sw.js`** keeps the shop on the phone. Two caches, because the two kinds of file want opposite
  things: the page is **network-first** (its URL never changes, so caching it first would pin the
  game to the build that was current the day it was installed), and everything under `/assets/` is
  **cache-first** (Vite puts a hash of the contents in every one of those filenames, so they
  cannot go stale). The install step fetches the page, *reads the bundle's name out of it* and
  caches that too — the visit that installs a worker is not handled by it, so without that the
  first launch offline was a blank screen asking for a script nobody had kept. The twenty
  megabytes of artwork are **not** precached; the game pulls its own in behind the loading screen
  (`PreloadScene`) and that pass fills the cache, which is about 17 MB after one play. Bumping
  `VERSION` in that file empties both caches on the next visit, and the whole thing is undone from
  the browser's own site-data screen.
- **`index.html`** at the repository root is the page itself (Vite's entry, not a template): it
  carries the iOS meta tags, which read none of the manifest, links the manifest and the icons,
  adds `viewport-fit=cover`, refuses the browser gestures that CSS cannot (see below), and asks for
  `navigator.storage.persist()` so the shop is not evicted when the phone is short of room.

Verifying it needs a browser, not a reader: build, serve `dist/`, load it once, play as far as the
menu, then **go offline and reload**. The shop should open on the pause card with the kitchen
painted. Check the console for failed requests, which is how a missing bundle and a missing icon
were both found.

### Updating itself

The page is always the newest build — it fetches it every launch — but an app carries the game
inside it, so it has to be told. `src/updates/` does the telling, **once a launch**, and the player
decides; nothing is ever swapped behind them. There are two kinds of new version and the difference
between them is the whole design:

- **The web build** — the HTML, the JavaScript, the artwork. Downloaded into the app and served
  from there (`live.ts`). No reinstall, no store, and the shop is untouched.
- **The native shell** — a Capacitor plugin, a permission, the Gradle or Xcode projects. An update
  cannot carry native code, so the app is told to install a file instead (`install.ts`).

**Why the first one works at all.** A Capacitor app is this same page, served to its WebView by a
local server out of the app's own files. `WebView.setServerBasePath` points that server at a
directory in the app's data instead and reloads it. So an update is: fetch the files, write them
down, point the server at them. The page's **origin does not change**, which is why the shop
survives — the save is `localStorage` on that origin.

These rules are each the difference between an update and an unusable app:

- **The site is read in native code, not with `fetch`.** The WebView's origin is
  `https://localhost` (`capacitor://localhost` on iOS), so asking the site is a cross-origin
  request, and a static file on EAS Hosting carries no `Access-Control-Allow-Origin` — its CORS
  defaults are for API routes, and a static deploy has none. The browser refuses the response
  before the game sees it, the check reads the `TypeError` as "the site could not be asked", and
  the result is not an error anybody notices: it is **silence**, which is indistinguishable from
  an app that is up to date. Two releases shipped with a check that could never find anything and
  nothing in any log said so. `readSite` in `live.ts` asks through `CapacitorHttp`, which is part
  of Capacitor's core on both platforms — so it costs no shell change — and which works without
  `CapacitorHttp.enabled`, the config that patches `window.fetch` and would send the twenty
  megabytes of artwork through a native round trip as well. The app's **own** `update.json`, read
  back off the local server, is same-origin and stays a `fetch`. The GitHub releases API is the
  other way round: it sends `Access-Control-Allow-Origin: *`, so the new-file half is a plain
  `fetch` and works.
- **A file of the build comes down through `CapacitorHttp` too, not `Filesystem.downloadFile`.**
  That is the second thing the app could not do and said nothing useful about. The plugin's
  `downloadFile` is deprecated (it points at `@capacitor/file-transfer`, which is native code and
  so needs the app installed again), it is the one method still served by the plugin's *legacy*
  implementation, and it writes straight into a `FileOutputStream` — so it fails on any directory
  nobody made first and cannot make one itself. `downloadInto` in `live.ts` asks for the file as a
  blob, which arrives as base64, and hands it to `writeFile`, which takes base64 when it is given
  no encoding and makes its own parent directories. The directories are still made up front as
  well, because `Filesystem.copy` refuses when the destination's parent is missing — and `mkdirp`
  no longer swallows a failure that is not "it already exists", which is how a missing directory
  used to turn into a confusing complaint about a missing file.
- **A failure names the step and the file, and the card shows it.** `doing(what, …)` wraps every
  native call in an update, and `UpdateOffer.reason` carries what it threw onto the card. Nobody
  can read a phone's log: without this the whole account of a failure is "Chưa tải được bản
  mới", which costs a build and an install to turn into a diagnosis — it has already cost one.
  It is the only English in the game, and it is there to be repeated, not read, which is why it is
  also the one piece of text that is selectable.
- **"Which build is running" is not "what the base path says".** An app serving the build inside
  its own package reports a base path of `public` — the name of a folder in the APK, not a path,
  and **not empty**. Read as a directory on disk it names one that has never existed, so every
  file the update meant to copy out of it is missing and the update dies on the first copy, which
  is the first font. That is what the first two updates anybody tried actually died of; the
  downloader was only the suspect. `servedBuild` in `live.ts` is the one place that answers it:
  an absolute path ending in a directory under `ROOT`, or null. iOS says `public` too, as an
  absolute path inside its bundle, which is why the test is both halves and not either.
- **A copy that cannot be made is a download, not a failed update.** Copying is only ever an
  optimisation — the same file, already on the device, under the same content-hashed name — so
  whatever has become of the build on disk, the site still has every byte. `applyUpdate` falls
  back to fetching and says in the log how many it had to.
- **iOS keeps builds where iOS will look for them, and the name is Capacitor's.** Android
  remembers the whole persisted path and checks the directory exists before serving it. iOS keeps
  only the path's **last component** and roots it at `Library/NoCloud/ionic_built_snapshots` on
  the next launch, with no check that anything is there. So a build written anywhere else serves
  for exactly one launch and comes back to a white screen that a force-close cannot clear — the
  one failure the rollback cannot catch, because that build *did* boot and so *was* persisted.
  `ROOT` and `HOME` at the top of `live.ts` are per-platform for that reason alone.
- **A rate limit is a wait, not a failure.** An update is a hundred and fifty requests as fast as
  the connection will carry them, and a host happy with that from a browser over a minute of play
  is not necessarily happy with it in twenty seconds: ours let 99 files through and refused the
  hundredth with a 429, and the update threw away 9 MB of work it had already done. So a refusal
  that could pass is asked for again — `Retry-After` when the host says, a long wait for a rate
  limit and a short one for a hiccup (`waitFor`) — and a 429 also raises `pacing`, which slows
  every remaining file rather than only the one that was turned away. A 404 is none of those and
  is asked for exactly once.
- **Nothing is swapped until every file is written.** A half-written directory served to the
  WebView is a white screen with no way back.
- **A build is made permanent only once it has booted.** `setServerBasePath` lasts for the launch;
  `persistServerBasePath` is what survives a restart, and `settle()` calls it *from the new build*,
  after the shop is on screen. A build that cannot boot is therefore never persisted: the player
  force-closes the app and the next launch comes up on the last one that did boot. That is the
  whole rollback, and it needs no native code — which is why it is arranged this way rather than
  the obvious way round.
- **Installing a file resets the app to the build inside it**, and that is Capacitor's doing
  rather than ours: both platforms forget the persisted path when the binary's version changes. It
  is the only safe answer — the downloaded build was made for the shell that was just replaced —
  and it is why `settle()` throws away the downloads when it finds itself running the bundled
  build. Don't re-implement it; do remember it exists.
- **A site caught mid-deploy is a wait, not an update.** The host caches each file for an hour and
  takes no notice of a query string (that was tried), so for a few minutes after a deploy
  `update.json` can be the new build while `index.html` is still the old one. Taking that pair
  would write down a build whose page asks for a script that is not in it — a white screen, and an
  app that believes it is already up to date. So the page is held against the manifest before
  anything is offered (`isWhole` in `manifest.ts`), and when they disagree the next launch asks
  again.
- **Only what changed comes down.** Everything under `assets/` carries a hash of its contents in
  its name, so a file with the same name is the same file and is copied across from the build
  already on disk (`plan` in `manifest.ts`). The usual update is a few hundred kilobytes; the
  first one after installing a file is the whole twenty megabytes, because what that app has is
  inside its own package where nothing can be copied from.
- **Every state of the card has a way off it.** It covers the screen and takes every touch, so a
  download that stalls would otherwise leave the player holding a picture of a boba shop. The card
  is also held back while a shift is actually running, so an unasked-for question cannot drain
  three patience timers while it is read.

**`NATIVE_VERSION` (`src/updates/native.ts`) is how the other half works**, and it is a number
somebody has to remember to move. The site publishes it in `update.json`; an app whose own number
is lower knows that no update can reach it. `tools/check-updates.cjs` holds a fingerprint of
everything an update cannot carry — the `@capacitor/*` versions, `capacitor.config.ts`, the
manifests, the Gradle and SPM files, the Java and Swift — and **fails when they drift without it
moving**, because nothing else will: it typechecks, it builds, and it runs perfectly in a browser.
When it fails: bump the number, re-record `BUILT` beside it, and run **Build apps** before the next
deploy.

The file itself comes from the GitHub release, and the **release tag says which shell it contains**
— "Build apps" tags `v<nativeVersion>.<run>`, so `v2.57` is run 57 of shell 2. An app offers the
file only when that first number is higher than its own. Reading it off the release rather than off
the site is what keeps the offer honest in the window between a deploy and a build: the site may
already want shell 3 while the newest file anyone can install is still shell 2, and in that window
the right thing to say is nothing at all.

The two halves are not equal on the two platforms, and the card says so rather than pretending:
Android downloads the `.apk` and hands it to the system installer (`InstallPlugin.java`, which is
the one plugin this app has of its own) — same signing key, so it installs over the top and the
shop survives. iOS cannot install an `.ipa` from inside an app at all, so it is handed the release
page, and because the repository's `.ipa` is unsigned, re-signing it is usually a *fresh* install:
that is why the iOS wording is the one place in the game that tells the player to export a backup
first.

**None of this runs in a browser.** `Capacitor.isNativePlatform()` is false there, so the check
never starts and the card never shows. To see the card, set `uiState`'s `update` by hand from
`window.__shop` (that is how the states in this repository were looked at); to see an update
actually apply, you need a phone with two builds.

### The page is a game surface, not a document

`index.html` and `src/styles.css` refuse the browser behaviours that a game's holds and drags would
otherwise trigger: the iOS share sheet on a long-pressed image, the selection magnifier on a
long-pressed label, the Android long-press context menu, double-tap and pinch zoom, image dragging,
and Safari's rubber-band / pull-to-refresh.

- Selection is off on `*` and back on for `input, textarea` — the backup code has to be selectable,
  and the web is the one platform with no long-press "select all" to fall back on.
- `img { pointer-events: none }` is what stops the iOS image menu.
- `body` is `position: fixed`, which is what stops Safari rubber-banding the game away.
- The canvas gets `touch-action: none`; the HTML over it is `pointer-events: none` except where it
  has something to press (`.live`), so a touch meant for the room is not caught by a transparent
  box above it.
- `contextmenu`, `dragstart` and the iOS `gesture*` events are refused in `index.html`'s own
  script, because no CSS covers them.

### The screen stays on

A shift is four minutes of watching customers arrive and tea run into a cup, a good deal of it with
a finger resting on the glass rather than moving across it. A phone with a thirty-second timeout
dims mid-pour and then locks, which is the shop closing itself.

`src/screen.ts` holds a **screen wake lock** for as long as the game is in front. It is the Screen
Wake Lock API and nothing else: no plugin, no permission, no change to the native shell, so it
costs no reinstall and the installed page gets it exactly as the app does. Two things decide its
shape, and both are the API's rather than ours:

- **The browser takes the lock away whenever the page is hidden**, and never hands it back. A lock
  taken once at boot is gone the first time the player answers a message, so it is asked for again
  on the way back in (`visibilitychange`). It is also let go of deliberately on the way out, which
  is the one way this could flatten a battery.
- **It can simply be refused** — battery saver, a WebView older than Chrome 84, an iPhone before
  16.4. The screen then behaves as it always did, and the player is told nothing; the console is
  told once.

A browser can show it works: patch `navigator.wakeLock.request` from an init script that runs
before the bundle, load the page, then override `document.visibilityState` and fire
`visibilitychange` by hand. One request on load, a release on hiding, a second request on return.

## Who draws what

One Phaser canvas sits under the HTML and over nothing: the counter (`scenes/CounterScene.ts`,
`counter/`) and the kitchen (`scenes/KitchenScene.ts`, `kitchen/`) are two scenes side by side,
each through its own camera, laid out in CSS pixels with the camera zoomed by `DPR`. Everything
with words on it — HUD, tabs, order card, pour meter, menus, settings, day end, coin and confetti
effects — is Preact HTML over it (`ui/`). The vector art is SVG strings in `art/`, rasterised once
into textures.

They meet in three places and nowhere else: `store.ts` (the shared reducer), `ui-state.ts` (screen
state: which page, the sign, the meter, the hint, the kitchen's rectangle, where the cup is) and
`game/host.ts` (the UI tells the canvas where the pager and the kitchen are).

**The cup** (`kitchen/cupPainter.ts`) uses the original frontal 113 x 174 geometry and new
high-resolution transparent PET and whipped-cream artwork. It paints the animated drink into
one device-density texture and only repaints during a pour, settling, or ingredient change.
See `docs/frontal-cup.md` for source assets, prompts, material treatment, and visual checks.

**Rules learned building it — each one cost a measured frame budget or a bug:**

- **No `Graphics` left on screen.** Phaser 4 re-tessellates and re-uploads a `Graphics` every frame
  it is drawn, changed or not; a few plaques and shadows were 70% of the kitchen's frame time on a
  slowed CPU. Bake static shapes with `bakeCanvas` (`game/view.ts`) or `svgTexture`.
- **The room is one atlas** (`kitchen/atlas.ts`): every tank, pan, card, bottle, plaque and the
  syrup's four labels are frames of one texture, so the wall draws in one batch. A station's state
  is a frame swap or an alpha, never a redraw.
- **One texture per batch** (`setMaxParallelTextureUnits(1)` in `game.ts`). Phaser compiles a shader
  per number of textures a batch mixes, the first time it meets it — a third of a second on the GPU
  the first time a scoop was lifted. Phones get one per batch anyway; desktop now matches them, so
  what a desktop measures is what a phone draws.
- **Tell Phaser when the canvas moves** (`scale.updateBounds()` in `setGameArea`). It maps touches
  through bounds measured at the last resize; a canvas moved but not resized took every touch at an
  offset — near enough for a big target, a miss for the cup.
- **A finger owns the cup.** Lifting the cup starts an ease back to full size; the first move must
  stop its position half, or a quick drag is pulled back to where it started (`owned` in the cup
  gesture).
- **Never read layout from the DOM per frame** — `gameArea()` holds where the canvas is.
- **Text in a rasterised SVG falls back to a system font** (an SVG drawn through an `Image` cannot
  use page fonts): lettering that matters is drawn on top with Phaser text or Canvas 2D.
- **A sprite is its own URL.** `import cup from '../assets/kitchen/cup.png'` gives the string Vite
  serves it at, and that string is both the texture's key and where it is loaded from (`tex()` in
  `game/view.ts`). There is no asset id and no bundler shim.

**Testing it.** In development (and in a build opened with `?test`) `window.__shop` exposes
`{ store, uiState, goToPage, load(json), game }`: `load` puts a saved shop on screen exactly as a
launch would read it, which is how a test reaches a particular cup. Don't write the save from a
page on the same origin and reload — any page on the dev server is the game, and it flushes its own
save as it unloads.

## Architecture

```
index.html              the page: meta tags, the canvas and UI roots, the gestures CSS can't refuse
src/main.tsx            boot: fonts, the saved shop, the clock, the sound, the canvas, the UI
src/store.ts            the shop as one value: gameReducer + subscribers (no component state)
src/ui-state.ts         screen state the rules don't own: page, sign, cards, meter, hint, rectangles
src/clock.ts            the day's tick
src/persist.ts          localStorage: the read at launch and the slow write; see "Saving the shop"
src/sound.ts            watches the shop and tells the engine what to play
src/screen.ts           the screen wake lock: the phone stays awake while the game is in front
src/hooks.ts            useGame/useUi: the only way the HTML reads either store
src/game/               the rules, and the canvas they run on
  reducer.ts            GameState + CupBuild, actions (START_DAY, TICK, TAKE_ORDER, ASK_AGAIN, POUR,
                        SCOOP, ICE_SCOOP, SUGAR_PUMP, SERVE, CLEAR_CUP, SET_MODE, EXTEND_SHIFT,
                        BUY_GEAR, NOTE_NEWS…): what happens, with what it is worth read from rules.ts
  rules.ts              every tuned constant, and the pure rules that read them: patienceFor,
                        payoutFor, walkoutFor, starsFor, closesAt, jarPayout, dayNews…
  levels.ts             getDayConfig(day): the whole menu, order/serve patience, slots, group size,
                        the quiet, the line; describeUnlocks (the pace, never an ingredient)
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories,
                        and the hands-on constants (POUR_RATE, DEFAULT_ID…)
  orders.ts             random order generation (MENTION_CHANCE: what an order asks for and what it
                        leaves out), price, orderTiles, evaluateDrink (perfect/close/wrong)
  customers.ts          random customer looks (hair, skin, shirt, accessory) and names, kindOf and
                        what each kind says on arrival
  regulars.ts           the four regulars, what the shop remembers of them, orderVisible, who is due
  gear.ts               what the till can buy, one purchase each
  random.ts             seeded RNG; the seed lives in state so the reducer stays pure
  money.ts              formatMoney: 1 game unit = 10.000 ₫, shown as "10k" / "3.180k"
  save.ts               serialize/validate a GameState for storage; see "Saving the shop"
  saveCode.ts           the same save as a line of text the player can keep
  game.ts               the Phaser game: scenes, scale, the one-texture-per-batch rule
  host.ts               where the canvas is, as the UI measures it
  pager.ts              the two pages and the swipe between them
  view.ts               textures, baked canvases, text, DPR — what every scene draws through
src/updates/            keeping an installed app current: manifest.ts (what a build is and which
                        kind of new version this is), live.ts (the web build, downloaded into
                        place), install.ts + release.ts (the new file, when the shell moved),
                        native.ts (NATIVE_VERSION); see "Updating itself"
src/scenes/             PreloadScene (the artwork, before the shop opens), CounterScene, KitchenScene
src/counter/            the customer stage: backdrop, customers, floating text, layout
src/kitchen/            the room you work in: layout, equipment, the cup and its painter, pours
src/ui/                 the HTML over the canvas: App, TitleScreen, GameScreen, PrepPage, Hud,
                        OrderBubble, PourMeter, OpeningSign, SettingsSheet, RegularBook (Sổ khách),
                        DayEndScreen, Effects, LoadingScreen, responsive.ts (the three prep layouts),
                        ui.css
src/art/                the artwork: SVG strings (character, counter, counterTop, cup, icons,
                        ingredientIcon, kitchenEquipment, shopBackdrop) and the measurements of the
                        painted sprites (kitchenArt.ts, toppingArt.ts, toppingGeometry.ts,
                        cupGeometry.ts, iceLayout.ts)
src/audio/              sounds.ts (the cue catalogue and the mix), audio.ts (the engine — players,
                        voices, fades), foley.ts (the scheduler), webAudio.ts (the players);
                        see "The shop's sound" and docs/audio.md
src/assets/kitchen/     the painted sprites themselves — generated, see "The kitchen's artwork"
src/assets/audio/       the sounds and the two music loops — generated, see "The shop's sound"
src/assets/fonts/       Baloo 2, four weights, with its licence
public/                 what makes the page installable: manifest.webmanifest, sw.js, icons/
                        — see "The page as the app"
android/, ios/          the Capacitor projects: the same dist/ in a native shell
capacitor.config.ts     the app id, name and web directory
app.json                not an app config — only the EAS Hosting project the page is published to
tools/                  make-music.cjs: music only; audio/build-foley.cjs: recorded effects
                        cut-sheets.py: cuts the asset sheets into those sprites
                        cut-tea-jars.ps1: a whole dispenser per tea, off the kitchen sheet
                        cut-cup-design.ps1: the cup and its drink, off the cup design
                        cut-tea-front.ps1: the tea window's greenery, back out of its own plate
                        cut-cup-holder.py: the holder under the cup, out of the kitchen painting
                        make-web-icons.cjs: the home-screen icons, off the app's own
tools/check-rules.cjs   patience and its floors, kinds, what a cup pays, wrong drinks, the sign's news
tools/check-overtime.cjs      closing time, the jar and its burn, relaxed, buying, the board, the wall
tools/check-waves.cjs         groups and the quiet, the line and its bench, a press, a rush saved
tools/check-regulars.cjs      who comes and when, the usual, Hỏi lại, the streak, the book, a visit saved
tools/check-audio.cjs   loop seams, cue wiring, and the volumes through a save
tools/check-audio-engine.cjs  the scheduler and the whole browser lifecycle, against a fake context
tools/check-prep-layout.cjs   the sideways layouts, against the painting's own band
tools/check-backup-code.cjs   the backup code's round trip and its refusals
tools/check-updates.cjs       the native shell's fingerprint, and which new version is which
tools/sim/              the bot that plays whole shifts through the real reducer; not in `npm test`
```


### Saving the shop

The game is picked up and put down mid-shift, so **the whole `GameState` is saved**, not just which
day was reached: reopening puts you back in the same minute of the same day, with the same customers
waiting, the same half-built cup on the coaster and the same takings. `GameState` is already a plain
serializable value, which is what makes this cheap.

`src/game/save.ts` owns the format and `src/persist.ts` owns the store. The decisions worth not
re-litigating:

- **The store is `localStorage`, under one key, `boba-shop.save.v1`.** The save is a few kB of JSON
  and the read has to happen before the first frame, which rules out anything asynchronous; in the
  Capacitor shell it is the same `localStorage`, in the app's own origin.
- **`config` is not saved**, because it is `getDayConfig(day)`. Re-deriving it means a save made
  before the levels were retuned comes back on the current numbers, and `parseGame` fits the
  restored counter to today's `config.slots`.
- **The transient UI state is dropped** (`feedback`, `departures`, `discarded`). Those drive
  animations measured in a second or two; restoring a walk-off that started last week would hold a
  counter spot for nothing and replay a payment that already happened.
- **A restored shift comes back paused**, whatever it was saved as, so reopening the game shows the
  pause card instead of dropping you into three patience timers already running down. The day's
  `OpeningSign` is keyed off `clock === 0` for the same reason: a resumed day has already opened, so
  it is not announced twice. The two rules meet at a day whose clock has *never* moved — saved while
  its sign was still up — and there the sign wins and the day is **not** paused: pausing it as well
  stacked two cards, and dismissing the sign left the day stopped behind the second one. Quitting to
  the menu overwrites the save with a `title` state, which keeps the shop: see "Which day the menu
  opens" — the week is in `day`, and the menu is where a shop that has been closed down comes back
  to. There is no "clear save", and no way from inside the game to start the week over.
- **The seed is validated as any integer, not an int32.** A new shop is seeded off the clock
  (`createInitialState(Date.now())`) and `START_DAY` hands that seed straight on; only the first
  `TICK` reduces it to the RNG's own 32-bit state, and the tick loop is held by the opening sign.
  Bounding it to an int32 discarded every save from launch until that sign was dismissed.
- **Storage failures are reported, never swallowed.** A store that cannot be read is
  indistinguishable from a first launch and a rejected write is invisible, so both warn — the
  silence is what hid the seed bug on a phone, where the shop simply never came back.
- **A read that *fails* is not a shop that isn't there, and it must never be written over.** The
  read is retried (three times), and if it still fails the game opens a new shop and the writer is
  switched off (`writable = false`), so nothing is stored for the rest of that launch. This
  is the one that cost a player their week: a moment's trouble reading the store looked exactly
  like a first launch, the game opened a fresh shop, and the two-second writer committed it over a
  save that was sitting there intact. Playing a session that will not be kept is the cheaper
  failure, and the next launch gets the real shop back.
- **A save that cannot be parsed is set aside, not deleted.** It is still thrown away rather than
  patched — a fresh shop is a better failure than a half-restored one — but the bytes go to
  `boba-shop.save.v1.broken` first. Nothing reads that key; it is there so that a validator the
  format has outgrown costs a diagnosis instead of a week.
- **A field that is merely new is migrated, not discarded.** `SAVE_VERSION` is the switch that
  throws a save away on sight, and it is for a save this build genuinely cannot read — not for one
  it knows how to finish reading. `money` is the worked example: it is optional in `SavedGame`, and
  a save written before the till opens with today's takings in it. Bumping the version instead
  would have wiped every shop in existence to gain a tidier format, which is the same trade this
  whole section exists to refuse.
- **Every mechanic since went in the same way, and `SAVE_VERSION` is still 1.** `seen`, `gear`,
  `regulars`, `overtime`, `waveLeft`, `lullUntil`, `incoming`, `line` and `lost` are all optional in
  `SavedGame` and defaulted on read, so a save or a backup code from before any of them opens as a
  shop that has been told nothing, owns nothing, has met nobody and is not in a rush. What a bad
  value costs depends on what it holds. What can only cost a line on a sign or a preview is
  **tidied**: an id `seen` or `gear` does not know is dropped, a kind `incoming` does not know is
  dropped, and a regular who does not check out costs that one acquaintance and not the shop. What
  holds money or people is **refused** with the rest of the save: a malformed `overtime`, a bad
  `waveLeft`, a customer in `line` that `parseCustomer` turns away. The one exception is the count of
  rounds, held to today's `OVERTIME_MAX_ROUNDS` rather than refused, because that limit is a number
  tuning will move.
- **Whoever is still to come is held to what a shop can really be in.** They hold the day open
  (`dayOver` wants `waveLeft` at 0) and only the next arrival can let go of it, so `parseGame` clamps
  `waveLeft` (none in a relaxed shop, and no more than a group with every round's on top) and
  `nextSpawnAt` (never further off than the stagger). Unchecked, a code could carry a day that never
  ends, and the menu goes straight back to it.
- **`parseCustomer` has to copy every `Customer` field, in the order the reducer writes them.** A
  field it leaves out vanishes on reload, which for `recall` would make a reload a free look at a
  usual. The order is there because a backup code promises to be exactly what the save would have
  been, and key order is part of the bytes (`check-backup-code.cjs`): `stranger` in `tick` builds its
  keys in `parseCustomer`'s order, `queuedAt` goes last in both because a change of mode is what adds
  it, and `regulars` keeps the order they were met in. A `regularId` this shop has no memory of is
  dropped along with its `recall`, since nothing could settle up for a hidden card: that customer is
  just someone at the counter. An order naming an ingredient since gone still refuses the save,
  theirs as much as a stranger's.
- **A code from this build pasted into an older install loses what that build cannot read, and
  nothing says so.** `parseGame` ignores fields it does not know and `SAVE_VERSION` did not move, so
  gear and regulars would simply not be there. A minimum-build field in the save would catch it, and
  was left out on purpose.
- **Everything read back is validated, and a save that doesn't check out is thrown away** rather
  than patched; a fresh shop is a better failure than a half-restored one. The save sits in
  `localStorage`, where it can be edited, and a save from an older build can name an ingredient
  that no longer exists. Ingredient *names* are checked against the catalogue, so a save whose cup or
  customer names a tea since taken out of it is refused whole and set aside. Whether the day still
  *offers* a name is not checked, and every day offers everything now. A regular's remembered usual
  is the one exception: a lost name there costs only that acquaintance (`parseRegulars`).
  `cup.ice` and `cup.sweetness` are re-derived from the build's scoops and pumps instead of being
  trusted, since the reducer treats those as the same fact.

The writer is on a **2 s timer**, not on every state change — a day ticks several times a second —
and flushes when the page is hidden and on `pagehide` (closing a tab doesn't reliably raise a
visibility change). The most a crash can cost is the last couple of seconds.

`tools/check-save.cjs` covers the round trip, the two non-playing phases, the saves that must be
refused and the ones that are tidied up instead. Each mechanic's own check script saves and reloads
it in the middle: a rush in `check-waves.cjs`, a visit in `check-regulars.cjs`.

### Going to the menu, and coming back

**"Về menu chính" puts the shop down; it does not close it.** `GO_TO_TITLE` changes the phase and
nothing else, so the clock, the counter, the half-built cup and the day's takings are all still in
the state while the menu is up — and the menu's one button hands them straight back
(`RESUME_DAY`). Leaving and returning costs the player nothing, which is the whole point: the day
is where they were, not where the game would like to start them.

The button used to dispatch `START_DAY, day: 1` outright. That rebuilt day 1 over the top of
whatever was there, so a player who paused, went to the menu and came back lost both their week and
the shift they were in the middle of — reported, accurately, as the game resetting itself. Four
rules now, all of them in `tools/check-save.cjs`:

- **A suspended shift is resumed, not rebuilt.** `suspendedShift(state)` is the test — a day is
  under way once its clock has moved, or (for a shift only a few frames old) once there is a cup
  out or a customer at the counter — and the button reads `Tiếp tục ngày 7` when it is true.
- **It comes back running, not paused**, unlike a shop reopened from a save. The clock cannot tick
  at the menu (`tickable` is false for any phase but `playing`), so nothing ran down while the
  player was away, and they have just pressed a button that says carry on. Making them dismiss a
  pause card after that is one press too many.
- **`day` is the day the shop opens next**, and the button says which (`Mở cửa ngày 7`) once it is
  past the first. A player has no other way to tell, before pressing, that their week survived —
  and that uncertainty is what the bug left behind even once the day was right.
- **Leaving a *finished* day builds the next one** (`phase === 'dayEnd'` → `buildDay(day + 1)`).
  There is nothing to resume at the end of a day, and the alternative — keeping the finished shift
  around — would offer the player their way back into a day that is already over.

A running jar, a line outside and a quiet with its group are all in the state, so they come back with
the rest. What outlives a day is one list, `Carried` (`mode`, `money`, `audio`, `seen`, `gear`,
`regulars`), read in one place, `carried(state)`, so that `START_DAY` and leaving a finished day
cannot disagree: a field in one and not the other would be lost on one of the two roads to the next
morning. **`buildDay` does not run once a day**: leaving a finished day builds the next one for the
menu, and the menu's button builds it again. So nothing in there may roll, charge or decay anything.

### Opening the shop

The painted kitchen is about five megabytes of sprites, and nothing used to ask for them until
something drew them: the first swipe to the prep page landed on a room that filled itself in, and
the first scoop of each topping stuttered while its sprite decoded. A shift is four minutes long and
every one of those stutters landed inside one, so the wait is taken up front instead.

`src/scenes/PreloadScene.ts` hands `PRELOAD` from `kitchenArt.ts` to Phaser's loader, which both
fetches and decodes each sprite into a texture. `main.tsx` holds `LoadingScreen` up until the fonts,
the saved shop and the artwork are all in, and the bar is weighted the way the wait actually falls
— the artwork is nearly all of it (85%).

Three things not to undo:

- **`PRELOAD` is what is actually drawn, and `kitchenArt.ts` now names nothing else.** It used to
  be the smaller of two lists, because that file still exported the room's old planks, counters,
  rails and the teas' old jars, and fetching that lot would about double the wait for sprites that
  never appear. Those are gone — both the exports and the forty PNGs they named — so the file and
  the preload list say the same thing again. Keep it that way: when a sprite starts being drawn,
  add it to `PRELOAD`, because one left out still loads, just late, in the middle of play, which
  is the stutter this exists to remove.
- **It gives up after ten seconds** and opens the shop anyway, with a warning naming how many
  arrived. A slow connection must never be able to lock a player out of their own game; the
  stragglers carry on loading behind the menu, which is exactly what used to happen to all of them.
- **The loading screen uses no Baloo 2.** The fonts are part of what it is waiting for, so anything
  set in the display face would be drawn in the system one and jump when the real one arrived.

A cold first visit waits several seconds on the loading screen instead of opening the menu at once
and filling the kitchen in later. A repeat visit is served by the worker's cache, and in the
Capacitor shell the files are already on the device, so it only decodes.

### Keeping the shop across a reinstall

Three layers, in the order they are relied on:

1. **A newer `.apk` installs over the old one and keeps its data** — same app id, same committed
   signing key (see "Playing on a phone"). This is the normal case, and on the installed page there
   is nothing to install at all.
2. **`android:allowBackup="true"`** in `android/app/src/main/AndroidManifest.xml`, because the save
   leans on it: it is what can bring a shop back after a genuine uninstall. Best-effort and
   account-dependent, so it is a safety net and not a plan.
3. **A backup code the player keeps** (`src/game/saveCode.ts`, offered under "Sao lưu tiệm" in the
   settings card). The only remedy that works on iOS, the only one that survives an uninstall for
   certain, and the way a shop moves between the installed page, the app, and the old app.

An over-the-air update is none of these: it changes the files the app is served, not the app, and
the save is on the page's own origin either way. See "Updating itself".

The code is **the same bytes `save.ts` already writes**, base64 over UTF-8 with a fingerprint on
the end — wrapped rather than re-described, because a second serializer would be a second thing to
keep in step with `GameState` and the first to fall behind would be the one nobody tests. Base64
because the save is full of Vietnamese names and raw JSON is the kind of string a chat app
helpfully "corrects"; hand-rolled because `btoa` mangles anything outside Latin-1, which is most of
a Vietnamese save. The fingerprint is not security — the save sits in `localStorage` — it is there
because a code copied by hand arrives truncated often enough to matter, and a truncated base64 blob
still parses into *something*. `parseGame` is the same gate a stored save goes through, so a
restored shift comes back paused and a code from a build whose ingredients are gone is refused
rather than half-applied. `tools/check-backup-code.cjs` covers the round trip, the refusals, and
pins the payload against Node's own base64 — a round trip alone cannot tell UTF-8 from CESU-8,
because this decoder reverses both.

The blanket `user-select: none` that makes the page a game surface also made the code impossible to
copy, so `input, textarea` get an exception in `src/styles.css`.

The menu **scrolls**. It has no vertical slack — on a 375x667 phone the logo was already sliding
under the awning before anything was put above the card — so nothing that only sometimes appears
may crop the shop's own name.

### What the game's clock is allowed to redraw

A shift ticks every `TICK_MS` (`src/clock.ts`) and each tick is a new `GameState`. Nothing is
"re-rendered" by it: the scenes and the HTML both **subscribe** and update only what they own.

- **A subscriber compares the slice it cares about** (`useGame(select, equal)`, `useUi`, and the
  `onState(state, previous)` methods in the scenes). Almost every tick changes nothing but the
  clock, so almost every tick ends there.
- **`tick` hands back the same `slots`, `feedback`, `departures` and `line` arrays when nothing in
  them moved** (`unchanged` in the reducer). A fresh copy would tell every subscriber that the
  contents had changed, and those comparisons are what the rule above rests on.
- **A selector that would build something answers with something stable instead.** `canExtend` is a
  boolean, so only the moments it flips reach the pill. `lullGroup` hands back the state's own
  `incoming`, or one shared empty list, never a new array.
- **`patienceLeft` is rounded to a fiftieth.** It is drawn as a 20px ring and a 26px heart, where
  that is half a pixel. The ring round a queued order pin has a component of its own for the same
  reason, so that following the clock does not take the pin's `memo` with it.
- **`TICK_MS` is how often the shop's state moves, not how accurately it runs.** Every rule in the
  reducer is written against the measured `dt`, so this number is free to be as slow as the slowest
  thing on screen can stand.
- **The clock does not drive the canvas.** Phaser runs its own frames; a pour's liquid, a settling
  cube and a sliding page are tweens and `update()`, not reducer ticks. What the tick does is move
  the rules on, and anything watching a number it changed.
- **A hidden page pauses the shift** (`clock.ts`), which is what the app did when it was
  backgrounded: a player does not lose three patience timers to a phone call.

### Hands are emptied when the game is put down

Hiding the page takes the finger away without lifting it, and a pointer that never came up leaves
the kitchen holding something. So `KitchenScene` watches `visibilitychange` and, on the way out,
`abortAll()`: the pour is stopped and *discarded* rather than committed, the carried tool goes
back, and the cup is stood down.

None of that is cosmetic. While something is carried the panorama is held still and the pager is
frozen, so a drag that never ended left the prep page a picture: the wall would not pan, the swipe
back to the counter did nothing, and a scoop was stuck to the middle of the screen. It looked
exactly like the game hanging, and it was reported as that. The pour is the worst of the three to
leave running, because how long the tap was held is measured off the wall clock — a tap still open
when the game was put down would tip however long the player was away into the cup and ruin a drink
they never touched.

### The two pages (swipe navigation)

`src/game/pager.ts` owns one number, `uiState.pageOffset` (0 = counter, 1 = kitchen, in between
mid-swipe): the two scenes' cameras and the HTML of both pages follow it, so a page slides as one
piece. A finger drags it (`dragPage`), letting go settles on whichever page is nearer or wherever a
flick was aimed (`releasePage`), and a tab taps straight to one (`goToPage`). The `PageTabs`
indicator under the HUD highlights the active page and badges each side (Quầy = # waiting to order,
with a `+N` beside it for anyone in the line outside, Pha chế = # tickets to make). Swiping is the
primary gesture; the tabs are the shortcut.

The kitchen's own horizontal swipes belong to its panorama — the wall is reached by dragging it —
so the counter is reached from the kitchen by the tab, while the kitchen is reached from the
counter either way.


### The shop's money

**A day cannot be failed.** There used to be a target — `DayConfig.goal`, a number of units the
day had to take — and falling short meant replaying it. That is gone, and with it the HUD's
progress bar towards it, the sign's "Mục tiêu", the day-end screen's pass/fail and its "Chơi lại
ngày N" button. What the shop takes it keeps, and tomorrow always opens.

In its place are **two numbers, which are not the same thing**:

- **`coins` is what was taken today.** `START_DAY` resets it, and the **day-end screen is the only
  place it is shown** ("Tiền bán hôm nay"). It is deliberately not in the HUD: two money numbers
  side by side there read as one number and its target, which is the thing this replaced.
- **`money` is the shop's till** — everything it has ever earned and not spent. It carries from
  day to day, it rides in the save, and it is what "Sắm cho tiệm" is paid out of. It is the one money
  number during play: the HUD counts it up and the flying coins land on it, the opening sign reads
  it, and the day-end screen shows where the day's takings went. The exception is a sale after
  closing, whose coins land on the overtime jar, which is not the till until the shop has shut. The
  menu shows no money at all.

Both are added to in exactly two places: `serve`, and the one tick that ends the day, where the
overtime jar pays out (see "Tăng ca"). `spend` is the only thing that takes any out, and its caller
is `buyGear`; `canAfford` is the refusal, so that it lives in the game's logic rather than in
whichever screen happened to ask, and the balance has one way down. A purchase is `BUY_GEAR`, which
is `spend` plus the rules about what can be bought. Prices are whole units — `canAfford` refuses
half of one, along with anything negative or not finite.

Four decisions worth not re-litigating:

- **The till survives going back to the menu**, as the week does. `GO_TO_TITLE` changes the phase
  and `START_DAY` carries `money` through `buildDay`, so leaving a day and opening the next one
  keeps the money. It is the player's, not the run's; anything they had bought with it would
  otherwise be confiscated for quitting.
- **The stars rate the service now, not the money.** With no target there is nothing for the
  takings to fall short of, so `starsFor` (`rules.ts`) reads `DayStats` instead: how many customers
  left with a drink that was at least nearly theirs (`served` against `served + missed`), and how
  many got the one they asked for. The money is the reward; the stars are the grade.
- **A wrong drink is a customer let down, not a sale.** It stays out of `served` and it **also adds
  one to `missed`**. The proposal asked only for the first, and that alone leaves one perfect cup and
  twenty-five wrong ones at served 1, perfect 1, missed 0, which is three stars. So `missed` no longer
  means "gave up", and the day-end row says "Khách không hài lòng" rather than "Khách bỏ đi". This is
  what gives the stars any meaning: the bot that hands everyone the same plain tea used to take two
  stars on every shift, and now takes none on 85–89% of them and one on the rest. An office worker's
  `close` pays nothing and **still counts as `served`**: the stars measure whether a customer got a
  drink, and the penalty is the lost money. A late customer reaches `stats` in no outcome at all (see
  "Tăng ca"), so a day can end with money in the till and no stars, and the verdict line allows for it.
- **`formatMoney` groups thousands with a dot** (`3.180k`), by hand rather than through
  `toLocaleString` — the locale data that needs is the one thing here a phone's JavaScript engine
  may not carry. A drink costs eight units and a tip is one, so nothing used to reach four digits;
  a till that keeps everything does so within a week.

### What the day changes

**The whole menu is open on day one.** Every category — tea, topping, ice, milk, sugar, foam — and
every tea and topping in `ingredients.ts` is available from the first shift. There used to be an
unlock schedule: `CATEGORY_UNLOCK_DAY` held milk back to day 3, sugar to day 4 and foam to day 5,
and `getDayConfig` sliced `TEAS` and `TOPPINGS` down to `2 + day` and `1 + day`, so a week of play
was spent filling the rack and the topping stand. That is gone. `getDayConfig` hands back all of
`BUILD_ORDER` and every option in each category, whatever the day.

What that changes beyond the shelf, since the day config feeds more than the room:

- **A day-1 order can ask for anything**, because `generateOrder` walks `config.categories` and
  picks out of `config.options`. The first drink of a new shop is as involved as the last — which
  is also why an order asks for only some of what is on the shelf; see "What an order asks for".
- **The kitchen is fully furnished from the start.** `layoutKitchen` gates the syrup, the cartons,
  the cream dispensers and the ice machine on `config.categories`, so all of them stand on the bench on
  day 1, and no tea tank or topping bin is drawn empty.
- **The serve window starts at its widest.** `patienceMs` still adds `categories.length * 4_000`,
  which is now the constant 24 s rather than something that grew with the week — a full build needs
  the full window on day 1, which is exactly what it gets.
- **`describeUnlocks` is not removed, it is narrowed.** It reports only what the day still moves:
  the third counter spot on day 2 and the second topping per drink on day 5. Everything that reads
  it — the opening sign's "Mới hôm nay", the day-end screen's "Mở khóa cho ngày N" — already hides
  itself on an empty list, so the quiet days simply say nothing. Introducing a mechanic is a
  different channel; see "What the opening sign introduces".

**The day is still a difficulty dial, just not a menu.** `slots` (2 on day 1, 3 after),
`maxToppings` (1, then 2 from day 5), `orderPatienceMs`, `patienceMs` and `waveSize` all still
tighten with the day. If the whole progression is ever wanted gone, those are the numbers to flatten
— the ingredients no longer have anything to do with it. Both patiences stop on day 11, `patienceMs`
on `DAY_PATIENCE_FLOOR_MS`. `waveSize` is the one dial that runs on past that, a customer more every
`WAVE_GROWTH_DAYS` until `MAX_WAVE`, which it reaches on day 16; from there every day is the same
config, so that is where to look if the day number should go on meaning something.

**There is no spawn rate any more.** The counter is capped and arrivals only fill free spots, so that
number was measured to do nothing: day 30 at a quarter of it served the same 26.0 drinks. Customers
come in groups now (see "Đợt khách"), and `spawnMinMs`/`spawnMaxMs` went with the trickle.

**Everything added since is live from day 1**, because the boredom it answers arrives in the first
shift. The one exception is overtime, from `OVERTIME_FROM_DAY`, so that a new player learns the day
before stretching it; and the first regular comes later on day 1 than on any other day.

**Old saves need nothing.** The day config is not saved (see "Saving the shop"), so it is re-derived
on every launch; a shop saved on day 2 of the old build reopens with the full shelf.

### What a customer will put up with, and what they pay

The next few sections are the mechanics out of `docs/deeper-mechanics.md`, "the proposal" below,
whose numbered decisions they refer to. Each says where it overrode that document.

`src/game/rules.ts` holds every number they are tuned by, and the pure functions that read them. **A
rule value is a named constant there, never a literal at the point of use, and a
new modifier lands in `patienceFor` or `payoutFor`.** Spawning and serving call those two and work
nothing out for themselves. That is not tidiness: modifiers stacked at the point of use multiply out
with nobody looking, and a rush, a shipper and a late round together came to about five seconds of
patience for a drink that takes ten to make. It is also what lets `tools/sim/tune.cjs` sweep a
constant without editing it.

- **`patienceFor` is the only source of a customer's two limits.** The day's number, times the
  kind's `KIND_PATIENCE`, times `OVERTIME_PATIENCE` once for each round they came in on; relaxed
  skips both. The floors, `SERVE_PATIENCE_FLOOR_MS` (25 s) and `ORDER_PATIENCE_FLOOR_MS` (12 s), go
  on last, after every modifier, which is the only thing that makes them floors. The round belongs
  to the customer (`lateRound`) and not to the shop: whoever was already standing there when the
  player pressed keeps the patience they arrived with.
- **Serve patience has two floors, and they do different jobs.** `DAY_PATIENCE_FLOOR_MS` (65 s, in
  `getDayConfig`) is where the day itself stops, before kinds and rounds. `SERVE_PATIENCE_FLOOR_MS`
  is under everything, and the day proper never reaches it: its lowest is a shipper's 32.5 s, so all
  it decides is how hard the late rounds get. The order floor is not like that: a shipper stands on
  it from day 7.
- **`payoutFor` is the only source of what a cup pays**, of what the counter says about it and of
  what it does to a regular's streak; `serve` only decides where the money goes. A perfect cup's tip
  is how much patience was left, `MIN_TIP` to `MAX_TIP`, times the kind's `KIND_TIP`, plus an office
  worker's bonus or a regular's streak. A perfect cup poured over the brim is half price from
  everyone, with nothing on top. `walkoutFor` does the same for someone out of patience: whether the
  stats hold it against the shop, whether it burns a jar, and what is said.

### Kiểu khách: a face means something

**Three looks the game already drew now always mean the same thing.** `kindOf(look)` in
`customers.ts` reads the kind off the face, first match wins — cap, then balding, then glasses — so it
needs no state and no save of its own, and a cap and glasses on one head is a shipper because the
cap is what reads at that size. What it exists to create is a decision after every cup: who is next,
and who can I afford to lose?

- **`shipper`, the cap.** Half patience, triple tip, and leaving costs nothing: a timeout does not
  reach `missed` and does not burn the overtime jar, the counter says `Anh shipper đi rồi` with no
  😤, and he walks off without the angry face or the steam. This is load-bearing rather than kind.
  With shippers counted as misses a slow player's three-star days fell to about a third, and "who
  can I afford to lose?" stopped having an answer.
- **`elder`, balding.** 1.6× patience, and no tip.
- **`office`, glasses.** 0.85× patience, `OFFICE_BONUS` on a perfect cup poured neatly, and **a
  `close` pays 0**. It still counts as `served` (see "The shop's money"). `leftContent` is what says a
  customer went off pleased, so the mood, the steam and the cue do not argue with the `Chưa đúng
  món…` beside them.

Three things not to undo:

- **`resolveSelection` is not sorted by deadline.** It hands the player whoever has waited longest
  and nothing cleverer. Sorted by what is about to run out, it would make the one decision this
  mechanic exists to leave to them.
- **A change of mode keeps a customer's share of patience, in both directions.** Relaxed keeps the
  tips and the lines and drops the patience differences, so `setMode` re-derives everyone at the
  counter: going relaxed leaves no half-patience shipper in a shop that promised no pressure, and
  coming back leaves no relaxed customer in a standard one, or a trip through the settings would
  take the pressure off a whole counter for nothing. `changeShop` scales the time already waited with
  the limit, so nobody walks out because the player opened the settings. That moves `orderedAt`, so
  `queuedAt` keeps their place in the queue: going relaxed must not bring the most urgent ticket to
  the front, which would be `resolveSelection` sorted by the back door.
- **Everyone says something as they reach the counter**, because the proposal's own worry was that
  nobody in the shop speaks. `ARRIVAL_LINES`, by kind and picked with the state's RNG, as a `Feedback`
  entry with tone `say`: not when they join the line, since nobody can hear them out there, and in
  a regular's case their own line. It lasts `SAY_MS` where feedback lasts 1.4 s, wraps inside its own
  slot at 13px, stands clear above the bubble (`chipShift` keeps a wide chip on the stage), and
  `hushed` takes it off the moment the order is taken or a cup handed over, so it never fights
  `Đã nhận order ✓`. The words stay respectful, Anh and Bác: these are stereotypes.

A taken order's patience and kind are on the card and its queue; see "The order, spoken back". The
bot's `queue: 'kinds'` triages by deadline and tip. In the day proper that is worth at most 5 units a
shift to a skilled player, and 9 to 31 when pressing every round.

### Đợt khách: groups, and the quiet between them

**Customers come in groups, and the next group waits for the counter to clear.** The counter
clearing is the trigger, and a clock is not, and that is the one thing here not to undo: a rush on a
fixed clock was simulated, and the shop's output stayed flat while a slow player lost thirteen
customers. This way a slower player gets fewer groups rather than more pressure. The proposal's
decision in a rush is whether to stay on the oldest ticket or make a quick drink to free a spot
before someone outside gives up.

Once the counter and the line are clear, `waveLeft` is 0, no round of overtime has been pressed and
it is not yet `durationMs`, a group of `config.waveSize` is rolled. Its kinds go in `incoming`, and
`lullUntil` starts the quiet, 6–10 s. When that passes they come in one at a time, `WAVE_GAP_MIN_MS`
to `WAVE_GAP_MAX_MS` apart (`nextSpawnAt` is that stagger now), each taking a free spot or joining
`line`. All of it resets with the day and all of it is optional in the save.

- **The day's first group is the shop opening**, with no quiet and no preview. `nextId > 1` is how
  `tick` tells, because an id is only ever spent on a customer or on something one of them caused.
- **The line is first come, first served, and waiting there is not waiting at the counter.** Someone
  steps up as soon as a spot is really free, and a spot someone is walking away from is not. Their
  `arrivedAt` starts again when they arrive and their patience is worked out again, because the shop
  may have changed how it runs while they were outside.
- **The line costs no star, no jar and no sound.** After `lineWaitMs` (`LINE_MS`, 35 s) someone
  outside goes home: `lost` goes up, and that is all. No `missed`, no feedback, no departure, no burn,
  because the stars grade customers who reached the counter. The day-end card has a row for it,
  `Khách về trước`, only if there is something to report.
- **Kinds are rolled when the quiet starts and faces when they arrive** (`generateLookOf`), by the
  same dice until one fits, because the preview says who is coming and it has to stay true. A round
  of overtime comes unannounced, which is why `waveLeft` can be more than `incoming`.
- **The quiet has no countdown.** It is a breath, and a number running down would turn it into a
  wait. If it ever feels empty, shorten it; do not fill it with chores. It reads `Quán vắng một chút`
  and `Sắp có 3 khách · 🛵 1 · 🧓 1`, plain customers being only in the count.
- **The pill is on the counter page only, and the prep page's is the order card.** It was meant for
  both pages. But a quiet only starts with the counter clear, so the card is empty, and it says this
  itself rather than have a pill laid over what it says.
- **Closing cancels a group that has not come through the door**, and one already coming in finishes
  coming in. That is read off the clock the tick started from: a tick stepping over closing and the
  end of the quiet together would otherwise find the quiet over and let the whole group in late.
  `dayOver` also wants the line empty and `waveLeft` at 0.

Relaxed has none of it and keeps its own path; see "Game modes". Going relaxed mid-group clears
`waveLeft`, `lullUntil` and `incoming`, and whoever is outside steps up as spots free, with their
order taken for them.

The bot, on the numbers as they stand. The rhythm is real: a skilled day 30 runs about 2.2 and 3.4
drinks per 30 s by turns where the old game ran 3.0 flat. The quiets cost something for it: skilled
with no overtime takes 206 on day 3 against the old 238, though it is within 3% of the old game from
day 7. The rushes are tuned for the slower player (decision 5), and two constants moved for them.
`DAY_PATIENCE_FLOOR_MS` went from 60 s to 65 s, because at 60 s their third star on days 12 and 30
was 78–87% whatever the group size. `LINE_MS` went from 25 s to 35 s: fewer people give up outside
as it grows, and past about that the fuller counter starts to cost the same third star. And
`queue: 'line'`, making the shortest drink to free a spot, **never paid**: the decision the proposal
says a rush creates is, in the bot, no better than triage and sometimes worse.

### Tăng ca: staying open

**In the last 15 s of a day, from day 3, a pill offers thirty more seconds.** Press it and one more
group comes in, each round more impatient than the last, up to three rounds. What is sold after the
day's own closing time goes into a jar, and a clean close pays the jar into the till with a bonus.
If someone at the counter walks out, half the jar goes, the bonus goes, and there are no more
presses. It is the mechanic for the end of a shift, and decision 5 gave it a job: the rushes are
tuned for the slower player, and this is what stretches the faster one.

`overtime: { rounds, jar, lost, paid, forfeited? }` is reset by `buildDay` and optional in the save.
`closesAt(state)` is read by `tick`'s `isOpen`, by `canExtend` and by `HudClock`. `canExtend` is
shared by the pill and the reducer, the way `canServe` is. The rulings, each of which is the
difference between this and something else:

- **A sale goes in the jar only once `inOvertime`**: `rounds > 0` and the clock past `durationMs`.
  The seconds between a press and the day's own closing time are the day's, and pay the till. The
  tip goes in the jar too and stays out of `stats.tips`. `Departure.toJar` sends the coins to the jar
  label rather than the wallet.
- **Customers who came in after a press never touch `stats`, in any outcome.** `Customer.lateRound` is
  how "the normal day's stars are never touched" is kept. Whoever was there before the press counts
  normally, whenever they are served, and that includes those served after closing.
- **The burn.** Any walkout from the counter while `rounds > 0`, by anyone but a shipper, late
  customer or not, and even before the day's own closing time with nothing in the jar yet, sets
  `lost`, halves the jar and cancels the bonus. Later sales pay the till and `canExtend` is false. A
  walkout from the line never burns, and nor does a wrong drink. Only the first one costs.
- **A shipper does not burn the jar.** The proposal asked; the kind that hurries the most cannot be
  what loses it.
- **A press brings one group, at once.** `EXTEND_SHIFT` adds `config.waveSize` and cancels any quiet,
  and a group waiting behind a quiet *is* that group rather than a second one on top of it. No other
  wave starts once `rounds > 0`, so what the player pressed for is all that is coming, and it can be
  judged.
- **No regular comes once `rounds > 0`**: a visit should always count, and a late customer does not.
- **Closing pays once.** The tick that sets `dayOver` is the only one that ends a day, and it adds
  `jarPayout` to `coins` and `money`: the jar times `1 + OVERTIME_BONUS_PER_ROUND × rounds`, or the
  jar as it stands if it was burnt or forfeited. `jar` stays as it was and `paid` is set beside it,
  so the day-end row, shown only if `rounds > 0`, can say what was bonus.
- **Going relaxed forfeits.** The offer is hidden and refused in relaxed, whose promise is no
  pressure, and a walkout there does not burn. Those two alone let a player press three times, go
  relaxed from the pause card with the risk gone, and flip back before closing for the bonus. So
  going relaxed with `rounds > 0` **latches `overtime.forfeited`**, in `overtime` and not read off
  `mode`, because the mode can be changed back: that day's bonus and any further press are gone even
  if they do. The jar itself still pays at close, unhalved, since a relaxed shop takes nothing away,
  and the label says `không thưởng` and never claims a burn.
- **No one new comes in after a press, in either mode.** "No other wave starts" holds for the relaxed
  shop's own arrivals too, so the auto path in `tick` also wants `rounds === 0`. It used to check only
  `isOpen`, and pressing once and going relaxed kept a full-patience customer in every free spot until
  the extended closing, which paid more than the bonus it forfeited. Going relaxed also calls off
  what is left of the pressed group, as it does any group, so that shop serves who is there and then
  stands empty until the round runs out, as a standard one does once its group has gone.
- **The pill is low, not on the tabs.** The proposal says both "near the thumb" and "over the tabs
  row", and the tabs are at the top. Thumb reach was the reason, so low won, and the 15 s window is
  there for the same thumb: one holding a pour cannot press. It stands on the pager and not on a
  page, so it is there on both, and it is laid over the room, because the room is measured against
  every pixel of the bars around it and a pill that came and went would move the whole kitchen.
  `overtimeDockRight` keeps it off the order: in the `column` it stands at the foot of the room,
  beside the card, and `.prep-wide .hint-row` is always clear of that spot, since a hint that jumped
  aside for it would be a thing moving near the cup.

**A day still cannot be failed.** The half jar is the one thing in the game that can be lost, and it
sits on that line on purpose (decision 2): it is opted into, and the day's own takings and stars are
out of its reach.

The constants that tuning moved: `OVERTIME_PATIENCE` from 0.8 to 0.7, `OVERTIME_BONUS_PER_ROUND` from
0.15 to 0.1, and `SERVE_PATIENCE_FLOOR_MS` from 30 s to 25 s. What a future tuner needs from that:

- **The multiplier cannot make pressing a decision, and nor can the half jar.** The extra sales pay
  for themselves. Halving or tripling the bonus moved `always` by tens of units without changing
  which policy won, and a burn is cheap because it tends to come early, while the jar is small.
- **Patience is what makes a press losable**, and in the end the floor. At 30 s the third press was
  free for a skilled player, about +35 a shift on days 12 and 30. At 25 s it is the first floor where
  how the counter is run changes the answer: −15 and −18 working the queue in order, +9 and +5
  triaging it. Over a month skilled FIFO takes 6,767 never pressing, 7,828 once, 8,777 twice and
  8,549 always.
- **The first two presses are free for a skilled player**, +54 to +87 a shift, and day 3 is free
  all the way: a group of three is too small to lose. Only the third is a question, and that is
  about 15% of tempo: at ×0.85 of the assumed skilled timing it is worth +19 to +39 again on every
  day measured.
- **A sloppy player gets next to nothing from any of it.** A month is 3,274 never pressing, 3,378
  once, 3,291 twice and 3,239 always, with `always` burning about 99% of the jars it presses for.
- **Hearts do not decide the pill.** The proposal has the player judge by the hearts on the counter,
  and no policy that reads the counter beats a plain count by more than noise. The decision it
  poses is how many, not whether this counter looks calm.

### Sắm cho tiệm: what the till is for

**Tips, the jar and every other money stake mean nothing until money buys something.** `GEAR` in
`gear.ts` is four things, bought once each off the day-end card and kept: `plant` Chậu cây 200 and
`lantern` Đèn lồng 400, which only show, `bench` Băng ghế chờ 800, under which the line waits half as
long again, and `board` Bảng gọi món 1500, under which whoever arrives at `BOARD_SLOT` arrives
`ordered`. There are no running fees and no resale, both cut as admin, and the faster tap and faster
press were left out because they shorten the part worth keeping. The board is what is left of full
auto order-taking, which was the best thing in every context and emptied the counter page.

- **`BUY_GEAR` is valid only at `phase === 'dayEnd'`**, and refused for what is owned, unknown or
  unaffordable. It cannot be done with a customer waiting, and it pays through `spend`.
- **An effect is read where it happens, from `state.gear`, never through `DayConfig`.** The config is
  `getDayConfig(day)` and nothing else, which is what brings a save back on today's numbers. The
  bench is in `lineWaitMs`, the board in `toCounter`, the plant and lantern in `shopBackdropSvg`.
- **The picture is rebuilt only when it changes.** The two that show stand on the backdrop's `front`
  layer, `wallGear(gear)` is that layer's identity in its texture key, and `Backdrop.furnish`
  rebuilds only when it moves, so buying the bench redraws nothing. The window's sill already has a
  small plant, so the bought one is drawn as its opposite: tall, broad-leaved, on the floor.

The bot on the prices, and neither of these was reached by any constant: **no one price suits both
players.** Skilled, buying as it can, has the board on day 11 and holds 5,279 by day 30 with nothing
left to buy, which is the complaint the shop was built to answer. Sloppy has it on day 27, and earns
3,363 in the month against the 2,900 the four cost, so anything over about 15% dearer puts the last
of them past day 30. More things to buy would help where a price rise could not, and that is a design
call. And **the gear is a sink, not an investment**: a skilled player gets nothing from the bench and
the board, −2 to 0 a shift without overtime. A sloppy one earns the board back in 228 to 313 days and
the bench in 60 on day 30 and 316 on day 12, and on day 7 the bench never pays, at −0.2 a shift.

### Như cũ nhé: the regulars

**Four people have a face that never changes and a drink that is theirs.** Everyone else at the
counter is a stranger made up on the spot; `REGULARS` in `regulars.ts` (Chị Thư, Anh Bảo, Bé Na, Chú
Tư) come back, and on a second visit the card says `Như cũ nhé!` and leaves the player to remember
what that was, or to tap `Hỏi lại` and see it for the price of the tip. **The decision is how sure
am I**: a wrong guess costs far more than asking, and the longer the streak, the more there is to
lose. Every look is `kindOf === 'plain'` on purpose, because a kind's patience and tip are a rule of
the face, and the streak is the only thing a regular's pay should be read for.

`GameState.regulars` keeps what the shop remembers by `Regular.id`, because `Customer.id` starts
again every day: `{ usual, visits, streak, lastDay }`. It is carried, and optional in the save.
`Customer.regularId` finds the memory and `Customer.recall` says how the card stands: `blank` is a
usual to remember, `asked` one they gave up on, and a stranger or a regular nobody has served yet
has neither.

- **At most one regular a shift, in both modes, with no dice** (`regularDue`). The next customer
  through the door becomes the day's regular once none has `lastDay === day` and the clock is past
  `REGULAR_AT` of the day (`REGULAR_AT_FIRST_DAY` on day 1, so that a new player has met the shop
  first). Odd days bring the first unmet regular if there is one, else whoever has been away longest;
  even days bring back whoever has been away longest, if anyone has been met. So day 1's stranger is
  day 2's "Như cũ nhé!", and a player gets a second visit before a third face.
- **`lastDay` is written on arrival and `visits` on being served.** `recall: 'blank'` needs
  `visits > 0`, so a regular who walked out before ever being served still shows their tiles next
  time. A shift that ends with no regular having come changes nothing.
- **A regular takes only a plain seat, with a spot to sit in.** The preview has to stay honest, so
  one may only take a place announced as plain, or an unannounced one. A spot has to be free as well,
  because someone who gave up in the line would be a visit nobody saw. So that this does not starve
  a visit, a group rolled while a regular is due is forced to have a plain among those who will find a
  spot. None comes once `rounds > 0`.
- **`orderVisible(customer)` is the only answer to whether the screen may show an order, and
  everything that draws one goes through it.** The answer was readable from the counter's bubble, the
  card's title, its count, its progress and tiles, a queue pin's ready dot and that pin's `aria-label`,
  which names the size, and any one of those is the whole of it. The bubble stays a pad until asked,
  and the cup in it is not even drawn. Anything new that shows `customer.order` has to ask.
- **Hỏi lại is asked at the ticket, not at the door.** `ASK_AGAIN` wants the order taken and the card
  `blank`, and sets `asked`. What it costs is settled when the cup is handed over.
- **Pay and streak are `payoutFor`'s.** Perfect and neat on a blank card: the normal tip plus
  `min(streak, STREAK_CAP)`, then the streak goes up. A first visit, perfect and neat, starts it at 1.
  `asked` is a tip of 0 however quick the cup was, with the streak left alone. A spill is half price,
  streak left alone: the drink was remembered and only the hand slipped. `close` or `wrong` ends it,
  asked or not, because the card was there to be read. A timeout leaves it where it stood: a missed
  visit only pauses, and nobody stays away to punish the player. Any cup at all adds to `visits`.

**Sổ khách** (`RegularBook.tsx`, on the settings card's frame) lists whoever has been met, with
their face, name, visits, streak and the tiles of their usual, and the rest as `Chưa gặp`. It is
essential rather than a nicety: someone back after a week meets faces they cannot place. It opens
from the menu and the day-end card and **not from the pause card**, where the clock is stopped and a
look would be free. A shift can wait at the menu with the same stopped clock, so `usualHidden` keeps
back the usual of anyone standing at the counter on a blank card and, with a shift under way at the
menu, of whoever is still to come today (`regularToCome`), which is everyone it could be a peek at.
Between days, and on the day-end card, the whole book is open.

Left out of this first version, on purpose: visits that change one thing ("Như cũ, nhưng ít đá
thôi"), which is what would stop a learned drink becoming a lookup; patience scaling; and absences.

The bot: the regulars do not touch the pill, an overtime policy landing within 3 units with and
without one in 31 cells of 32. What they add is one decision that changes as a player learns a face.
A blank card on day 2 pays a sloppy player 2.7 for guessing and 5.2 for asking, and by day 30, 7.9
and 5.3. It is small money, at most about 7 units a shift, and a sloppy player who always guesses
loses 3 to 5 points of third star. All of it rests on a memory model that is the softest number in
the harness, with no forgetting in it at all.

### What the opening sign introduces

`dayNews(state)` in `rules.ts` is the sign's teaching channel, kept apart from `describeUnlocks`,
which is about the day's dial and is pinned by `check-serving.cjs`. The sign shows the unlocks and
then the news under "Mới hôm nay".

- **It is keyed to what this shop has seen, never to the day.** `GameState.seen` holds the ids. The
  shops that already exist are past day 1, and one on day 20 would otherwise never be told, or be told
  everything at once. Day 1 has the how-to-play to get through and says nothing else.
- **`MAX_NEWS` is 2 a sign, in the order `kinds, regulars, waves, overtime`.** That overrides the
  order first planned, `kinds, waves, overtime, regulars`: this way a new shop hears about regulars
  on day 2, the day the first "Như cũ nhé!" comes in, and about overtime on day 3, the day it first
  opens. Groups can wait for that sign, because the quiet's pill and the `+N` on the tab explain
  them. One that does not apply yet is skipped and not marked seen: `waves` and `overtime` wait
  for a shop that is not relaxed, and `overtime` for day 3. The `kinds` line has no such test, so a
  relaxed shop reads that a shipper hurries and a bác can wait, which in that shop is only manner.
- **The sign takes what it says once, as it goes up.** `NOTE_NEWS` is dispatched when "Bắt đầu" is
  pressed, and a sign reading `dayNews` live would lose those lines while it fades. It is keyed by
  day in `GameScreen`, so another day is another sign.
- **It scrolls.** `.sign-scroll` sits inside `.sign-overlay` with the dim fixed behind it. Its one
  button is at its foot, so a sign taller than a phone on its side would otherwise have no way off:
  a soft lock at 932×430, which is why nothing could be added to it until this was done.

### What the bot found, and what nobody knows

`tools/sim/` plays whole shifts through the shipped `gameReducer`, so the rules are the game's and
only the human is modelled. `tools/sim/README.md` has the whole account and
`tools/sim/baseline/mechanics-final.out` the whole run, and each section above carries what a tuner
of that mechanic needs. What cuts across them:

- **Nobody has played any of this, and no real drink has been timed.** Every margin rests on the
  assumed timing in `PROFILES` in `bot.cjs`. The bot can say whether a decision is worth anything,
  where the wall is, and whether a knob does nothing. It cannot say whether the game is fun.
- **The slower player's third star held.** Sloppy, chained from a new shop, 27.7 three-star days of
  30, which is what the build before any of this got. That is the bar for decision 5, and the
  thing to re-measure after moving anything.
- **The wall is steep, though better than it was.** At 1.25× the sloppy timing, 60–72% three-star
  days on days 12 and 30, against 39% before any of this. At 1.5×, 19–39% against 12%.
- **Noticing a customer from the kitchen matters and is not new.** On days 12 and 30 the third star
  moves from about 90% for a player who keeps track to 68–80% for one who never goes over for the
  badge, and the build before this falls further, to 52%. There is no ring and no face for someone
  not asked yet, only a count on the tab.
- **Pressing can cost a sloppy player stars**, though late customers never touch them. At `always`
  on days 12 and 30, `kinds` falls from 90–91% to 85%, because triage serves a late tip ahead of a
  day customer. FIFO falls a point, from 91% to 90%, which has not been traced.

After changing anything in `rules.ts` or `getDayConfig`, run `node tools/sim/sanity.cjs` and then
`node tools/sim/run5.cjs`, and put new results in a new file under `baseline/` rather than over one.

### The shop's sound

Effects are recorded Foley: 29 edited WAV clips from 14 CC0 sources. `src/audio/clips.ts` names the
files; `sounds.ts` defines action layers, alternate takes, buses, priorities and cooldowns;
`foley.ts` schedules a bounded player pool, live fill for pours and cancellation; `audio.ts` is the
lifecycle and the music crossfades. `src/sound.ts` is the only thing that watches the shop and
decides what to play — the scenes and the UI never reach for the engine themselves.

**Everything plays through Web Audio** (`src/audio/webAudio.ts`): one decoded `AudioBuffer` per
clip, and a throwaway source node per cue. The obvious alternative is an `<audio>` element per
player — over fifty in a shift — and cycling those through pause, seek and play on every grab and
drop is what made the game lag once sound arrived, on desktop and phone alike. Headless benchmarks
cannot see it (their audio goes to a null device); turning both volumes to 0 on a real device is
what found it. A runtime with no `AudioContext` gets no sound at all, says so once, and plays on —
there is no second kind of player any more. See `docs/audio.md`.

The originals and the license/checksum manifest live in `tools/audio/`. Rebuild effects with
`node tools/audio/build-foley.cjs` (offline ffmpeg required). The two original music loops stay
byte-identical and are built by `tools/make-music.cjs`. Open `tools/audio/audition.html` to
audition shipped clips.

Keep these behaviours: the first gesture is what unlocks sound (a browser will not play before one,
and there is no way to ask whether it will); a hidden page stops everything and lets go of the audio
device; nothing stale restarts on return; and music is built outside the effect warmup. Serve cues
read `departures` rather than `feedback`, and a `close` that paid nothing cues `serveBad`, because it
was no sale; saved volumes migrate and clamp without increasing `SAVE_VERSION`. Cue delays share the
visual motion constants in `src/game/effectTiming.ts`.

**The trap that is worth keeping written down**, because the shape of it outlives the library it
came from: the player the game used to run on documented `playbackRate` as a property, gave it a
real setter in its web class, and declared it getter-only on both phones. In `foley.ts` the
assignment sat between the volume and the `play()` inside one `try`, so on a phone the throw was
caught, logged to a console nobody reads, and **the `play()` never ran** — every one-shot in the
game was silent while the music and the pour loop carried on, because neither touches the rate on
its way to playing. So `FoleyPlayer` asks for `setPlaybackRate(rate)` as a **method**, with nothing
to assign to, and the player stub in `check-audio-engine.cjs` keeps `playbackRate` an accessor with
no setter. A stub that flatters the code is worse than no stub: that one went green through the
whole outage.

Audio arithmetic checks do not replace listening on a phone.


### Game modes

`GameState.mode` (`standard` | `relaxed`) says how the shop is run, and it is one of the two
settings the game has — the other is how loud it is, above. **Standard** is the whole job as
described above. **Relaxed** ("Tự động nhận order") **promises warmth without pressure** (decision
7): it keeps the faces, the spoken lines, the tips, the regulars and everything the shop has bought,
and gives up what exists only to press on the player:

- **Nobody new is kept waiting or kept out.** In `tick()` a customer arrives already `ordered`
  (`orderedAt: clock`, so the serve timer starts at once and the order-taking patience never
  applies), and `nextSpawnAt` is left at `clock`, so the next customer walks in as soon as a spot is
  free. There are no groups, no quiet and no line of its own. The only gap left is the 1.3 s
  `DEPARTURE_MS` the leaving customer needs to walk off their spot. The one line it can have is
  inherited: whoever was outside when the shop switched to relaxed steps up as spots free, and if
  every spot stays held for `lineWaitMs` they still go home and the day-end card says so.
- **Nobody has less time than anybody else.** `patienceFor` ignores kind and overtime round. A
  shipper still tips triple and a bác still tips nothing.
- **There is no staying open.** `canExtend` wants `standard`, so the pill is not offered, and going
  relaxed with a round running forfeits that day's bonus and brings nobody else in; see "Tăng ca".
- **A regular is exactly a regular**, blank card and Hỏi lại included. Only the taking is automatic.

The mode lives in game state, not in a React context or storage: `SET_MODE` can be sent at any time,
`START_DAY` carries it over to the next day, and switching *to* relaxed mid-day also takes the order of
anyone still `requesting` (nobody is coming to take it by hand any more), drops any group still to
come in favour of the next arrival, and lets whoever is already outside step up as spots free. A
change either way re-derives everyone at the counter; see "Kiểu khách". It rides along in the save,
so the mode a shop was last run in is the one it reopens in (see "Saving the shop").

`SettingsSheet` is the card that sets it — and the two volumes — opened from the title screen's
"⚙️ Cài đặt" button and from the pause menu, so either can be changed between days or in the
middle of one. **It scrolls**, which it did not need to while the mode was the only setting: the
card is centred with no slack, and sideways on a short phone the sound section and the button out
of it fell off the bottom. The day-1 instructions on both the title screen and the opening sign
change their first line to match the mode.

The two pages share one shop's palette — warm wood, cream tile and the shop's pink — so swiping
feels like turning around inside it. The counter's wall is SVG (`art/shopBackdrop.ts`, drawn by
`counter/Backdrop.ts`); the kitchen is one painted plate (see "Standing things on a painting").

### The room you work in

**The drink is made by hand, not picked from a list.** `KitchenScene` is a room, not a menu, and
**the cup is a physical object you drag around it**. A cup comes off the rack by tapping its size or
by dragging it to the mat, where a drop anywhere on the mat counts.
`layoutKitchen(config, w, h)` (`kitchen/layout.ts`) places everything **on the surfaces the
painting already has**: the tea dispensers in the shelf across the top, the toppings in their stand
in the tiled alcove, the ice box, sugar jar, milk and foam on the rear counter,
and the cup on its holder through the middle of the work top. Each dispenser gets a
**dock**: where the cup is held while that tap runs into it.

Everything is anchored to the painting rather than to the screen, through `fitBackground` and the
boxes measured in the plate's own pixels — `ROOM_BG_TEA_SHELF`, `ROOM_BG_TOPPING_SHELF`,
`ROOM_BG_ICE_MACHINE`, `ROOM_BG_CUP_HOLDER`. The wall pans; the equipment pans with it because it
is placed in the same space, and `findStation` tests a touch in that space too. The cup does not
pan: it is the one thing that belongs to the player's hand.

- **Everything that can be dragged can be tapped, and a tap does the carrying.** The quick way is
  never a shortcut past the room: whatever the drag would have moved, moves — the cup walks itself
  from the rack to the mat, a tool takes itself over the cup and tips in there, and a tap on a tank
  fetches the cup under its spout. One thing a tap will not do for the player is **hold the tap
  open**: how long it is held *is* the pour, so a tapped tank docks the cup and stops there.
- **The shop changes first and the flight is only the picture of it**, which is the rule that makes
  the quick way quick: `tipToolIn` dispatches and *then* hands the tool off, `cupToMat` dispatches
  `PICK_CUP` and then walks the shop's own cup in from the rack, and `dockCup` sets the dock before
  the cup has moved an inch. So nothing in the room is ever waiting on an animation — a second
  station can be tapped while the first scoop is still in the air, a cup can be grabbed, docked or
  scooped into while it is still walking to its mat, and a tank's tap can be held for the pour
  before the cup has arrived under it. It did used to wait, and worse: one shared tool meant the
  second tap destroyed the first one mid-flight, and with it the dispatch hanging off its
  `onComplete` — two quick taps put one ingredient in the cup. `sendToolToCup` is the fix and the
  reason it is written the way it is: the sprite is cut loose with its own tweens and forgotten,
  so the next grab builds a fresh one rather than stealing it out of the sky.
- **`TAP_DISTANCE` (8px) is the only thing between the quick way and a drag.** The tool is in hand
  from the press either way — a press that shows nothing reads as a station that cannot be picked
  up, which is exactly how it was reported — and what the release does is the only difference:
  under the threshold it flies to the cup, over it the drop has to land on the cup. **Drags keep
  their motion**: the tool follows the finger and tips in where it is let go.
- **Pour by docking.** Tap a tank, or drag the cup under it and release to snap beneath its spout;
  the cup scales to the shelf gap and stands on the lowest shelf surface with a small contact
  shadow. Hold the tap to raise the live level; releasing commits the amount and leaves the cup
  docked, ready for another pour. The cup counts as docked from the moment the tank is tapped,
  whatever the slide is still doing. Drag it away to undock, or touch the room, and it glides back
  down to its mat — **having given the dock up before it sets off**, so the glide holds nothing
  up either: a tool can be lifted or another tank tapped while the cup is still coming down.
  A tank cannot pour until the cup is docked
  beneath it, and a cup holding a different tea locks every other tank
  (`Ly đã có trà khác — đổ bỏ để pha lại`). Panning returns a docked cup to its holder. The stream
  draws behind and in front of the cup, split at its lip, and spills over the brim. A tank tapped
  while it is half off the edge of the room **slides the wall into place first** (`panForDock`),
  because a cup fetched to it would otherwise hang off the same edge, reading a meter nobody can
  see; the cup is aimed at where the wall is *going*, so the two travel together.
- **Everything else is carried to the cup.** The topping containers, the ice machine's scoop, the
  sugar jar, the milk cartons and the cream dispensers are dragged or tapped: what is in hand follows
  the finger above everything else, and on release either tips into the cup (`SCOOP` / `ICE_SCOOP`
  / `SUGAR_PUMP`, or `POUR` of `MILK_SPLASH` for a carton) or goes back. The cup does not move for
  these — drop onto it wherever it stands, and a drop counts over the cup's *home* as well as over
  the cup itself, because a scoop tipped onto the coaster it left behind went into a cup that was
  not there. The refusals are one list (`refuseTool`) and the tipping in is one move
  (`tipToolIn`), whichever way the tool got there: a tap is refused before it sets off, so nothing
  crosses the room to be turned away at the cup. Sugar carries a spoonful while its jar stays on
  the counter. Milk takes room in the cup, so a cup filled to the brim with tea has nowhere to put it.
- **A carton and a cream dispenser are carried whole, so their place on the counter stands empty.** The room
  has one of each, and `holdStation` hides the station's sprite and its contact shadow from the
  moment it is lifted until the carried one is off the screen — tipped in, put back, or dropped
  when the game was put down, which is why the release is in `update` where `show` reaches 0 rather
  than in each of those three. A topping bin, the ice machine and the sugar jar stay where they
  are, because what leaves them is a scoopful and not the container.
- **While the cup is docked under a tap, nothing can be picked up.** A touch on any tool answers
  `Ly đang ở dưới vòi … — kéo ly ra trước` rather than lifting, and still takes the touch, so the
  room does not pan out from under it. The cup is up at the shelf, nowhere near the bench.
- **The slots are fixed.** Teas fill the rack left to right and then down, toppings fill their
  stand like a page — left to right along the back row, then the row in front — both in the
  catalogue's own order. Every one of them is filled from day one (see "What the day changes"),
  and a slot with no ingredient behind it is still drawn empty rather than closed up, so adding a
  tea or a topping to the catalogue moves nothing that was already on the shelf. Each one carries
  its Vietnamese name: a tank's above its lid, a container's on a cream
  card clipped to its near lip (`TOPPING_TAG` in `toppingArt.ts` places it, inside its own pan, so
  nine of them never touch).
- **A gesture ends when the finger lifts**, never because it drifted or was held too long — that
  cut pours short — and the room is held still for the duration. What a release does depends on how
  far the finger went: under 8px it is a tap, and that threshold is the only thing separating the
  quick way from the drag. Equipment shows no "added ✓"
  badges: the order slip is the checklist, and machines only dim when they are locked out.

A drink can be served once tea has been chosen by pouring any positive amount. Serving and tips do
not depend on how full the cup is; overflow still marks a messy drink.

### The pour meter

A small horizontal meter floats beneath the order card while the cup is docked (`ui/PourMeter.tsx`)
— an overlay, with no panel, no idle placeholder and no reserved space in the room, and it passes
every touch through. Quarter marks and an inline Cạn / Ít / Nửa ly / Gần đầy / Đầy label show the
fill, without percentages and without a serving target; overflow says Tràn ly! and turns the track
border pink. The fill animates from the left against an inner track, using the cup's own
`pourLevel` mapping, so a full cup covers the whole bar. The bright leading edge fades out over the
last few percent: held to the end it sat between the fill and the track's rounded cap, where it
read as a gap the bar never closed.

**The label's bands are not the quarters the marks are drawn at.** They used to be
`floor(level * 4)`, which called a cup a quarter full "Cạn" — dry — and only ever said "Đầy" at
exactly 1, so a held tap ran from "Gần đầy" straight to "Tràn ly!" without passing through full.
The bands are their own list, and "Đầy" covers the last eighth, where the cup is drawn brim-full.

### Ice in the cup

One scoop is three cubes, two is twelve. `createIceLayout(cupId)` retains stable placements
through pours and reloads, and adding a scoop leaves the existing cubes in place. The first
cubes float at the surface; the second scoop fills a shallow varied band below it.

Whole rotated outlines fit the mouth, tapered walls, and curved floor before clipping. Dry
cubes settle on the floor or topping bed, then rise continuously as liquid reaches them.
`check-cup-contents.cjs` checks 11,520 outlines, spacing, dry-to-wet continuity, floor clearance,
and cream contact. The active ice uses `ice-natural-front.png`, the untouched full-resolution
clear-ice painting at low opacity beneath broad, translucent facets. Cool blue-grey side shading,
crisp slate contours and bright wet edges keep each cube readable. Submerged cubes pick up a
restrained tea-colour wash; depth and milk soften them without erasing the faces. Glass reflections
remain in front of both exposed and submerged ice. Topping washes use each sprite’s actual alpha,
with smaller, softer rear pieces and stronger front pieces. Syrup pools on the floor before a pour
and dissolves into the first shallow fill; freshly poured milk briefly forms translucent swirls.

### Liquid and glass layers

The frontal cup uses a 113 x 174 coordinate box, a shallow mouth, and base contact y157.5.
`referenceCupArt.ts` registers the painted cup, cat-ear lid, straw and separate silicone holder
from `cup-reference-painted.png` (1536×1024 RGBA). The display aspect is 113×154 while the live
contents retain their 113×174 coordinate system. `frontalCupArt.ts` registers the shell at six
pixels per unit; no extra vector outline or cat-face decal covers it.
The finishing texture reserves 100 units above the rim, independently of cream's 40-unit
headroom. The straw passes through the lid at x56.5/y−35 and extends to y155. Its inner segment is
painted after the far cup rim and between rear and near ice/topping rows, behind cream and the near cup wall, with separate
air/tea/milk opacity. Its wet boundary crosses the centre of the tea oval, with a small meniscus
and refractive shift; both sections lean slightly through the fixed lid hole, with stronger
wet edges keeping the tinted submerged tube readable in milk. Only
the exposed segment is in the finishing overlay. The lid’s far sealing arc is behind the cream;
its dome reflections and near rim stay in front. Finishing changes mark the contents texture dirty.
Order-size icons, customer cups and carried straws use the same painted crops.
The holder's top plane is expanded and its front wall shortened with a continuous row projection.
`HOLDER_SEAT` derives from that projection; all cup sizes stand on the measured recess center.
A padded silhouette shadow grounds the holder on the marble. A separate oval contact shadow
matches the cup base and disappears on pickup. `HOLDER_RECESS` also defines a painted front-lip
layer above the resting cup, with `CUP_SEAT_DEPTH` giving the small seated overlap; that layer
hides immediately on carry or docking elsewhere. The lower glass split stays inside the well so
it cannot cut gaps out of the cup's wall contours. See `docs/cat-cup-design.md`.

`cupPainter.ts` paints rear floor glass, live liquid, syrup, submerged ice, painted toppings,
exposed ice, rear glass, cream, then the near glass and actual rolled lip. Everything stays behind the
shared curved contents boundary. No old low-resolution cup backing, edge, or extra glint layer
is loaded. See `docs/frontal-cup.md`.

- **Liquid and ice share `cupSurface(level)`.** Empty is y157.5/rx29.5/ry9.5; full is y28/rx42.9/ry10.08.
  The lower surface meets the same rounded floor as the contents; a small three-unit clear plastic band remains below it. The stream and fill meter use the same endpoints.
- **Cup tea matches the tanks’ rich pigment and transmitted light.** `teaPainter.ts` owns six
  clear-tea palettes, cached irregular brush washes/grain, soft flowing highlights, surface glints
  and tiny rising bubbles. Milk blends the concentrated pigment toward its creamy palette instead
  of replacing it with a pale swatch, retaining each tea’s hue and diffuse texture. A nine-second
  ambient loop refreshes at 24 fps independently of faster pouring ripples; it stops while paused,
  off the kitchen page, or under reduced motion. All motion stays clipped to the real liquid fill
  and behind ingredients, glass and finishing parts. No fill-level or gameplay change is involved.
- **Glass has warm, natural material detail.** Clear PET reflections cross filled regions at
  62%; reflections continue across ice and the topping bed. A cached front-wall texture replaces
  only the back-floor painting with continuous wall material, so the rear base ellipse stays
  behind the contents. A rolled rim and the outer base contour stay crisp at device density.
- **Ingredients are identified by pictures, without name tags.** Tea tanks have distinct
  leaf, jasmine, anise, rolled-leaf, taro and matcha emblems (`art/ingredientMarks.ts`). Topping
  pans show their contents unobscured. Sugar uses a cube motif; the ice box keeps its original
  background artwork and lettering without an added tag or graphic. Milk cartons show a cow
  or oats; cream dispensers show cheese or a caramel spiral, without printed words.
- **Equipment and orders share hand-painted artwork.** `art/equipmentArt.ts` defines package
  crops, printed ingredient close-ups and proportional placement from `dairy-boards-overhead-v2.png`
  for cream and boards, and `milk-overhead-forward.png` for the cartons. Milk faces straight toward
  the player with horizontal front edges while retaining the steep roof view. Folded cartons and brushed-metal cream dispensers share the room's elevated viewpoint;
  cream cans have rigid plastic valves and short outlet spouts.
  Canvas prepares counter/hand textures once; SVG wrappers use the same sprites on orders.
  `PRELOAD` includes both atlases. See `docs/milk-forward-board-edges.md` and `docs/dairy-steep-overhead.md` for imagegen prompts.
  `EQUIPMENT_FRAMES` owns the tighter overhead frames: milk 72×110, foot106; cream 64×100, foot100.
  Carton frames are 104×159 room units at x565/710 on the left compact board, with 76×119 cream frames at
  x996/1116 on the right board. Each pair's feet stagger slightly at y884/890, leaving space
  on the wooden top for the cast shadows before its front edge.
  Carton and cream silhouettes project down-left. Both use each source column's
  measured opaque lower rim instead of a flat baseline; the contact stroke follows that same
  curve. The profile is cached once per source texture. Source-in shading clips to its own
  atlas frame. Overlapping dairy touch targets select the nearest container center.
  Soft directional shadows and tight contact shading ground the packages. Their proportions and positions
  follow the background scale in every orientation, and stay the same when picked up. Cream counter objects
  hide while held. See `docs/milk-cartons.md`, `docs/cream-options.md` and `docs/visual-orders.md`.
- **Functional kitchen lettering keeps an 11 CSS pixel minimum** (`kitchen/typography.ts`):
  cup-size badges, quantities and hints. The ivory cup rack has painted S/M/L cat medallions,
  with no separate plaque overlays. Its clear stacks and the matching wrapped-straw box use
  two small local patches; all other background pixels remain original. Touch targets follow
  their measured footprints. See `docs/cat-organizers.md`. The cup-size badge compensates for
  docking scale. Ingredient names remain available to screen readers; there are no visible
  ingredient name captions or plaques.
- **Cream is a natural painted swirl** (`kitchen/creamPainter.ts`), using the new transparent
  `cup-cream-natural-front.png` with finer moist grooves, soft ivory folds, and a curled peak.
  Brulee gets golden custard shading, caramel patches, and flecks. The swirl sits at the liquid
  surface with a narrow foam bed around it and three short dissolving trails below the wet edge.
  Its foot extends behind the near rim. Cream leaves tea level and ice
  positions unchanged; 40 units of texture headroom preserve the peak. The new source crop is
  x130..1324, y82..1046, with contact y753. See `docs/frontal-cup.md` for prompts
  and `docs/cup-contents-rendering.md` for compositing and browser checks.
- **The dispenser's tea** is drawn into the tank's transparent chamber with the same shading, more
  strongly: it is a big volume behind glass, and the raster texture that works in a cup softens it.
  The tank's own glass and hardware are the painted sprite, untouched.

**A full cup is drawn full.** Liquid reaches y28 at fill 1. `cupMarks.ts` and the visible
stream derive endpoints from the same geometry. No artificial starting fill or upper plateau
is applied. S/M/L share the frontal projection and original relative widths, and stand by
`CUP_FOOT` on the shared mat. Lid, straw, lidding press, ingredient landing, and shadow use
the frontal dimensions. The dome has thin reflective edges; the inserted straw fades below
the lid instead of painting opaquely across the front of the cup.

### The kitchen's artwork
The active room keeps `kitchen-room-counter-cups.png` for the upper room. The lower counter
renders directly from the untouched first `kitchen-overhead.png`, starting at native source y343.
Both wooden boards use independent transparent sprites from `dairy-boards-overhead-v2.png`,
420×206 and 366×206 logical units at x440/882, y760. The top-to-front projection eases smoothly
through the rounded lower edge, using every source row. The old six-unit compressed edge looked
clipped; reserve 14 units for its complete front profile and cast the outer shadow once after
assembling the board. A masked marble removal source fills only their old footprints
and shadow margins. Raised ice/sugar use separate rounded rim crops and their existing small
old-ice clearing patch. See `docs/central-boards.md` and `docs/restored-original-boards.md`.
**Preserve background sharpness:** the user requires unrelated artwork to remain untouched.
Keep original PNGs immutable. Future edits must use isolated object sprites or tightly scoped
crops/masks; never replace broad counter strips or the full background with regenerated output.
Restore original pixels when available rather than sharpening or regenerating them repeatedly.
`tea-dispensers-overhead.png`, `counter-props-overhead.png` and
`topping-pans-overhead.png` supply matching equipment, shared with order illustrations.
The original plate uses 1920×1080 coordinates; its counter anchors are offset by a 350-unit upper extension,
for a 1920×1430 room. The original file remains untouched as a design reference.
All six tanks keep the first top-down design's apparent size, with 180-unit reference widths
compensated for the taller room. `roomGeometry.ts` owns those dimensions. `kitchenRoomArt.ts` supplies
one imagegen-repaired room, including the tall rack and continuous sunlit wall. Do not reintroduce
separate wall strips or stretched-row fades; they caused a blurry horizontal join. The press head
crops from the same active background. The compact cup organizer rests directly on the counter;
the long shelf behind it is removed. Its lower selection targets and size badges follow
`ROOM_BG_CUP_STATION`. See [cup station](docs/counter-cup-station.md) and [wall repair](docs/continuous-kitchen-wall.md) for their
prompt, and [tall tea shelf](docs/tall-tea-shelf.md) for the room and tank anchors.
See [overhead kitchen artwork](docs/overhead-kitchen.md) for the original asset provenance.
The counter pans by swiping; there are no bottom station shortcuts or reserved shortcut bar.
One compact foreground mat serves preparation and finishing; lidded cups return to that same mat.
The ice and liquid-sugar trays share straight aligned edges. Their existing source crop is raised
160 source pixels, placing ice level with the topping station; `KITCHEN_ROOM_TRAY_RAISE` moves
both the artwork and touch bounds. A local marble patch clears the old ice footprint. Their station
bounds share x/width/height, separated by eight logical pixels. Only touch highlights and carried
scoops/ladles are dynamic; do not preload a separate sugar-tray sprite. See
[raised trays](docs/raised-ice-sugar.md) for placement, source artwork and validation.

Nearly everything in the prep room is a **painted sprite**. `tools/cut-sheets.py` cuts
`tools/sheets/*.png` into `src/assets/kitchen/`; `tools/cut-topping-boxes.py` cuts the new
upright shelf containers. The generated sheet and prompt are kept in `tools/`.

[kitchenArt.ts](src/art/kitchenArt.ts) is the only place that names those files. The
sprites are generated — change the script (or the sheet), re-run it, never hand-edit a PNG.

`pan-ice.png` came from a 1024px rendering of the kitchen sheet that no longer exists; those crops
live in `tools/sheets/pans/` as source art — four of the seven are recolours that exist nowhere
else — and `unclip()` finishes them off. Every one was cut too tight, losing the cap of the scoop
standing in it and the foot of its tray, and the sheet still draws one pan whole: the same steel
and the same red in all seven, so that one fills in for the lot. Only the ice pan is written now —
the toppings have `tools/sheets/toppings.png` to themselves — but the box is still measured across
all seven crops, and they are all kept, because four of them exist nowhere else.

**The toppings come off two sheets, cut two different ways.**

`toppings.png` is three rows of six painted on transparency, and it is cut by `islands()`: the
sprites lean into their neighbours' boxes without ever touching them, so a crop would bring a
slice of the next one with it, and `islands()` lifts each as its own connected run of pixels
instead and hands them back in reading order. Only two of its rows are used now — the scoopful you
carry, which is carried at nearly the size it is drawn and keeps it, and one piece for the cup,
which is a dozen pixels across there and is cut down rather than shipping ten times the pixels it
is drawn with. Its top row, the topping as a loose heap, is left on the sheet.

`topping-bins.png` is the six bins whole, and it is cut by `bins()` on a **measured grid**: the six
abut on that sheet, so there are no islands to find, and the columns are taken where the trays'
lower bodies part. They are the same bin drawn six times, so any difference between their boxes is
noise in the drawing — each is padded until the tray's rim starts at the same fraction down the
sprite, then all six are resized together, which leaves one `ART.bin` and one `BIN_HEAD` for the
station to place them by instead of six of each.

The **empty** bin is a seventh, off `topping-bin-empty.png`, and it is drawn a good deal shallower
than the full ones — 1.95 wide to tall against 1.38. It is brought into the same box as the rest
rather than keeping its own shape, which stretches it about two fifths taller. That is deliberate:
a row in which the empty bins are shallower than the ones beside them reads as two different trays,
and a steel box this size has no perspective cue strong enough for the stretch to show.

Both sheets' columns are the toppings in *their* own order, which is not the game's list order —
the mapping is the `TOPPINGS` list in `cut-sheets.py`. The dispensers and the cup have scripts of
their own. The kitchen now uses `TeaLiquid` for shaded, animated liquid; see "Liquid and glass layers".

Anything that has to *move* is drawn against a window the script cleared out of the artwork, which
keeps the painted ticks, highlights and the cat decal on top of it:

- a **dispenser** is a cell of `TEA_DISPENSERS` (`TEA_DISPENSER_ART`, drawn by `KitchenScene`)
  over its tea, which is shaded, has an oval surface and ripples while it pours. The single
  `TEA_TANK` frame and the teas' older complete jars are gone, with the sprites behind them;
- the **cup** is painted by [cupPainter.ts](src/kitchen/cupPainter.ts) into one texture in its
  113 x 174 frontal space — see "Liquid and glass layers" — and drawn by `kitchen/CupView.ts`, which
  repaints it only while something in it is moving;
- a **scoop of topping** is one whole painted sprite, `SCOOPFUL[id]`, heap and all. It used to be
  the bare `SCOOP` with pieces laid into its bowl by hand, which was the same mistake the teas
  were — the design draws what a scoop of this looks like, so take its word for it. The six are
  drawn to a common **height**, because the scoop is identical in all of them and only what mounds
  over the bowl differs; matched on width instead, a heaped one shrinks beside a flat one.
  Ice uses its own complete `SCOOPFUL.ice` painting. Foam takes the bare `SCOOP` with a blob
  drawn in its bowl;
- the **cartons, syrup, cream dispensers and every fitting** (wall, lamps, shelf, steel counter,
  cabinets, rail, coaster, plant, poster, cup stack, towel) are whole sprites
  that `kitchen/layout.ts` places by the painting's own lines and `kitchen/equipment.ts` draws;
- **the room itself is one painted plate**, `room-bg.png` — the tiled wall and its lamps, the
  dispenser shelf, the fridge, the work top, the bench and the pink units at its foot, all of
  it painted rather than assembled. It used to be assembled: a wall tile set to repeat, a shelf
  plank and a stainless counter each sliced into bands and stretched across the room, a run of
  cabinet fronts, a group of props cut out of the mockup — every one of them a line to compute
  and a seam to get wrong. **Those sprites have been deleted**, along with the exports that named
  them: the cutters in `tools/` still know how to make them, so a station that one day wants the
  stainless re-runs `cut-sheets.py` rather than keeping four megabytes against the chance. Each
  piece of equipment sits in a contact shadow of its own, because there is no well in a counter to
  sink it into. The active topping cabinet is measured in the panoramic background by
  `ROOM_BG_TOPPING_SHELF`.

**The prep page is all kitchen.** There is no ticket rail, and no row of shortcut buttons for
walking to a station — the room fills everything between the order panel and the action buttons,
which is what gives the equipment the size it has in the reference. The wall is reached by
swiping it, which is the same gesture everything else in the room is worked with; the buttons
that jumped the view to the tea, milk and topping ends of it were a second way to do one thing,
and they cost the room a band the height of a dispenser.

### Turning it on its side

The game is drawn upright, and the painting is what decides what happens when it is not.
`ROOM_BG_KEEP` is the band of the plate the room cannot do without — the crown of a tank on the
upper shelf (y 101) down to the front of the cup's holder (y 723) of a plate 814 deep, with the
taps, the toppings, the ice machine, the work top and the cup between them. `fitBackground` draws
the plate `cover` and centred, so **a kitchen wider than about 3.06 times its own height starts
losing that band**: the dispensers lose their lids and the counter falls off the bottom. That one
ratio, `ROOM_KEEP_ASPECT`, is the whole of the sideways problem.

`roomAspect` is where it is worked out, and the easy way to work it out is wrong. The plate is
centred **on itself**, not on the band, and the band is not in the middle of the plate — there is
more painting above the shelf than there is below the work top. So what a short room can hold is
twice the band's farther edge from the middle of the plate, not the band's own height; measured
the other way the limit comes out a fifth too generous, and a room exactly at it still loses the
front of the cup's mat.

There is a second, narrower line as well. `ROOM_BG_REACH` is what the room needs to still be
*workable* rather than whole — a tank's name tag down to the line the cup's foot stands on. What
lies between the two bands is the crowns of the tanks' lids and the front lip of the cup's mat:
paint, not furniture. Nothing settles for it by choice any more; it is the floor a window too
squat for anything else is held to.

`src/ui/responsive.ts` is the only place that answers it, and `prepLayoutFor` gives one of three:

- **`stacked`** — upright. HUD, tabs, the order band, the kitchen, the buttons, down the screen.
- **`band`** — the same arrangement sideways, with every spare pixel taken out of it. The order
  stays across the top and the buttons stay along the bottom, both where the player already looks
  for them; the card is shorter to match (`ORDER_BAND_HEIGHT`, tiles moved up beside the name)
  and the buttons give back a few pixels of height. **It is taken only while it costs the
  painting nothing** — `ROOM_KEEP_ASPECT`, measured against what is left after the two bands'
  ~180px. Tablets have that height to spare and keep the arrangement the game is drawn for; a
  short landscape window does not. It used to be allowed down to the *reach* band instead, and
  what that looked like in a 1284x610 window was the order panel sitting on top of the tea tanks
  with their lids cut off — reported as exactly that. The constant for that looser line is gone
  with the rule; `ROOM_BG_REACH` is still measured, as the floor a window too squat for anything
  else is held to.
- **`column`** — sideways and short with it. The order and the buttons stand *beside* the
  kitchen, which spends width the wall can pan back instead of height it cannot. A phone on its
  side gets this, and so does any window too short for the band.
  **The column is as narrow as the card can be read at** (`panelWidthFor`: about a quarter of the
  screen, between 248 and 340px), because every pixel of it is a pixel of room. The card is built
  to shrink — `fitTiles` sizes its tiles from the width it is given and its two lines of text
  ellipsise — so the floor is reading comfort and nothing else. The one thing that widens it back
  out is the room: if the room left over would be squatter than its workable band, the card takes
  the difference, up to two fifths of the screen. Past that the window is past helping and the
  cure is worse.

Two things not to undo:

- **Each layout's root is keyed** (`key={layout}` in `ui/PrepPage.tsx`). They are all nested
  boxes, so a renderer will otherwise reuse the band's strip *as* the kitchen's box and the kitchen
  as whatever stood beside it: the elements survive, nothing reports a new size, and the scene goes
  on laying the room out for the box it had under the other layout — a room at the wrong scale with
  its hint pill below the bottom of the screen.
- **`PREP_BAND_HEIGHT` and `PREP_ACTIONS_HEIGHT` count their own rules and padding, exactly.**
  Every pixel of both comes off the room, and they are what decides whether a screen gets the band
  at all; a couple of pixels of border unaccounted for is a tablet dropped into the column.
  If the crop ever needs buying back, the levers in order of how much they return are: the HUD
  and the tab indicator sharing one row sideways (~26px, and the tabs are a navigation
  affordance, so that is a design call), the card's progress track (18px, but it is the only
  thing that shows progress at a glance), and the card's two-line tile captions (12px, and they
  become unreadable at one line).

`tools/check-prep-layout.cjs` holds all of it: it lays out every shape the game is played at,
works the cover fit out the way `fitBackground` does, and fails if the room that falls out of it
has lost the painting's band. It fails on the old rule, naming the window it was reported from.

**Sideways starts at `SIDEWAYS_MIN_WIDTH`, 560, just under the shortest phone on its side (568).** It was 760,
and a phone narrower than that (667, 736, 740) was laid out upright, with the card and the buttons
stacked into its height: a room 17 to 111px tall, the tanks above the top of it and the cup's mat
below the bottom.

The counter page has its own sideways form, which is a different question — `isWideLayout` alone,
since the counter has no painting to crop, only customers to make bigger and to centre. It keeps its
own copy of that test so that a scene need not import the interface's module, and
`check-prep-layout.cjs` holds the two together.

### What an order asks for

**A size and a tea, and then whatever this customer felt like.** Every other category —
toppings, sugar, ice, milk, foam — is mentioned or left out on a roll of its own
(`MENTION_CHANCE` in `orders.ts`), so an order is anything from a plain cup of tea to a
seven-thing drink, and about a third of them name three of the five. That is the variety that had
to come from somewhere once the whole menu was on the shelf from day one: an order that named
every category named every category every time, and one order read much like the next.

**A category that is left out is left unset, not set to its none/0 option.** This is the decision
the rest of it hangs on, and the two halves of it are:

- **To the cup they are the same thing.** `effectiveId` already reads an unset category as the
  none/0 option, so an ingredient nobody asked for still has to arrive absent: tipping foam into a
  drink that said nothing about foam is a mistake, counted exactly as a wrong tea is. Not asking
  for foam *is* asking for no foam, and `evaluateDrink` never had to change for any of this.
- **To the panel they are not.** `asksFor(drink, category)` (`ingredients.ts`) is the one place
  that answers "did they actually ask for this?", and the card lists what it says yes to and
  nothing else — so a drink with no milk in it has no milk tile, rather than a crossed-out one
  reading "Không sữa". That crossed-out tile is gone: `generateOrder` never writes an explicit
  `none` any more, and `asksFor` treats one in an older save as the silence it means, so no card
  can show it.

`askable()` is the other side of the same rule: the options a customer can pick are what the day
offers *less* the one that means "none", because asking for the absence of a thing is what saying
nothing already does.

Two consequences worth knowing before retuning those chances: the count under the customer's name
(`xong 2/4`) is out of what the order actually asks for, so it is now a different denominator from
one order to the next; and a shorter order is a cheaper one, since `drinkPrice` sums what was
asked for — the average drink is about 7% cheaper than when every category was named.

**A regular's usual is an order like any other, cut to what a person can hold in their head.**
`rollUsual` keeps `generateOrder`'s own independent rolls and rerolls until `fitsUsual` says yes: at
most `USUAL_MAX_TILES` (4) tiles on the card, its size included (`orderTiles`), so a size, a tea and
two things more, and one the shop can actually hand over, with no more toppings than `maxToppings`
and none twice. About one order in five qualifies. The tries are bounded with a plain M of the first
tea to fall back on, and `parseGame` puts a saved usual through `fitsUsual` again, because a memory
outlives every visit and a usual that could not be made is a regular nobody can ever get right.

### The order, spoken back
[OrderBubble.tsx](src/ui/OrderBubble.tsx) is the **panel docked across the top of the
prep page** (it was a paper note clipped to a rail inside the room, then a bubble floating over
it): who the drink is for, what it is called, how far along it is, and a picture for every thing that
goes in it, each ticking off as the cup comes together. Toppings tick individually when added. The heart beside the name is the
customer's patience, emptying from the top and turning amber then red. A 40px portrait, a 17px
title, picture tiles up to 48px (60px in a roomy column) and a progress bar under the name; the empty state keeps the same box and
centres a one-line prompt in it, and during a quiet its title and subtitle say so and who is coming.

Eight things about it are deliberate:

- **it lists only what was asked for.** `chipsFor` keeps a category when `asksFor` says the order
  names it, so the row is as long as the order is and anything missing from it goes in no cup. See
  "What an order asks for";
- it lists the drink in `SPOKEN` order — tea, milk, sugar, ice, toppings, foam — not `BUILD_ORDER`,
  which runs bottom of the cup upwards. The card is read, not built;
- the tiles stand together at one size and the row runs out from the left. Sharing the card's whole
  width between them leaves a two-thing order as two tiles marooned at either end;
- **its height is fixed** (`ORDER_PANEL_HEIGHT`, and `ORDER_BAND_HEIGHT` laid out sideways). The
  kitchen is laid out from whatever height is left under it, so a panel that grew a row when an
  order was picked would move every dispenser, every topping box and the cup with it. Sideways it
  is shorter rather than taller, because there the card has width it cannot use and height it
  cannot spare — the tiles move up beside the name. See "Turning it on its side". Standing in a side
  column it is the one exception, because nothing is laid out from it there;
- **the other taken orders stand inside it**, in a queue to the right of the heart — tap one to
  make it next. They used to hang off the card's bottom-right corner, over the room, where a
  seven-thing order had its last two ingredients covered by them. Each pin wears its customer's
  patience as a ring, because the deadlines of the orders not on the card are what the choice of who
  is next is made from: `PinPatience`, a CSS conic-gradient in a component of its own, selecting
  only `patienceLeft`, so that the pin's `memo` holds;
- **a portrait carries a kind mark**, on the card and on every pin: 🛵 shipper, 🧓 elder, 💼 office,
  nothing for plain (`KindMark`, reading `KIND_MARK`). A cap does not read on a 24px head. The
  subtitle stays `Cho {name} · xong a/b`;
- **a regular's usual is not on it, until the player gives up on remembering.** See "Như cũ nhé".
  The title reads `Như cũ nhé!`, the subtitle `Cho {name}` with no count, the bar stays empty and
  the tile row gives way to a `.live` button, `Hỏi lại` with `mất tip` small beside it. Everything on
  the card reads `shown`, which is only the order if `orderVisible` says so. The height does not
  change in any layout: a side column has no fixed height to hold, so a usual's card there is held at
  what the longest usual would take, before and after asking, because sized to this usual its height
  would be a clue to what is in it. On a column too short for the button, `askHeightFor` gives up
  the empty bar and most of the padding before the button's own height;
- the patience heart empties from the top through a clip on its own SVG. It and the rings on the
  pins are the only pieces of the card that are redrawn as the day runs.

`ingredientIconSvg` uses the actual tea-tank and topping-scoop atlas frames, the shared
milk/cream packages, and the painted sugar scoop and ice. Milk and cream get enlarged ingredient
insets; tea and topping tiles carry a small diagram of their shelf/tray location. There are no
visible name captions. Only S/M/L, sugar percentage and ice scoop count remain as small badges;
full Vietnamese ingredient names and completion states remain in accessible labels. The compact
side column puts its waiting portraits into the header so they never push recipe pictures out
of the card. See `docs/visual-orders.md`; `check-order-art.cjs` checks artwork mappings.

The card itself takes no touches; only the queue portraits and Hỏi lại are live (`.live`).

`drinkName` puts "sữa" where Vietnamese puts it, which is not the same place every time: "Trà Thái"
becomes "Trà sữa Thái", "Hồng trà" becomes "Hồng trà sữa".

### Standing things on a painting
The active room uses `ROOM_BG_SIZE` (1920×1430 logical coordinates), with the original
1920×1080 counter plate offset below the upper extension.
`fitBackground` covers and centers the working band; room equipment shares its scale,
vertical offset and horizontal pan.
Re-measure `ROOM_BG_*` anchors and topping tray edges when changing the active plate.

`kitchenHolderFor` places one silicone holder on the clear foreground marble, with space before
the counter edge and beside the sugar tray. Its preferred width is 250 logical units. Its height
and recessed seat come from the same tabletop projection in `referenceCupArt.ts`.
The holder stays fixed while the room pans. Preparation and finished cups stand by `CUP_FOOT`
at `HOLDER_SEAT`; there is no separate finishing home. See [holder](docs/cat-cup-design.md).
The room opens panned all the way to the left.

The background contains empty pans, so the topping atlas fills their measured plane. Each row
shares its boundaries with the next; `toppingGeometry.ts` projects the painted rims as horizontal
bands. Row boundaries follow the active background's compartments at logical y427/516/616/725
before the wall offset, rather than equal thirds. These same bounds place the topping touch
targets. See [topping alignment](docs/topping-bin-alignment.md). The press head is cropped from
the active room and moves to the inserted cup's rim.


## Conventions

- **Vietnamese UI text** everywhere, including the labels a screen reader would read. Money always
  goes through `formatMoney`.
- **Calm motion** (the user asked for this explicitly): short, eased, no springs or bounce, no
  shaking, no looping movement near the play area. The durations and easings are in
  `src/ui/motion.ts` (CSS) and `src/kitchen/motion.ts` (tweens); the only loops are the slow window
  clouds and the faint tea-surface shimmer. Keep it that way unless asked.
- The opening sign at the start of each day closes **only** via its "Bắt đầu" button (no timer, no
  tap-outside), and it scrolls, so however long it gets that button can be reached.
- **A rule value is a named constant in `src/game/rules.ts`**, and a modifier lands in `patienceFor`
  or `payoutFor`, never at the point of use. See "What a customer will put up with".
- Play is split across two swipeable pages (Counter / Prep); the HUD and the tab indicator stay
  fixed above the pager. Keep swipe as the primary navigation (the tabs are a tappable shortcut).
- **The HTML over the canvas lets touches through.** `#ui` is `pointer-events: none`; anything
  interactive opts back in with the `.live` class. A full-screen box that forgets this takes every
  touch meant for the room, and nothing on screen shows why.
- **A subscriber reads a slice, not the state.** `useGame(select, equal)` and `useUi(select, equal)`
  in the HTML, `onState(state, previous)` in the scenes. See "What the game's clock is allowed to
  redraw" — a subscriber that takes the whole state updates several times a second for a clock it
  does not draw.
- **The scenes own what they draw; the UI owns what has words on it.** They talk through `store`,
  `ui-state` and `game/host`, and nothing else. A scene that reaches into the DOM, or HTML that
  reaches into a scene, is how a layout ends up measured twice.
- **No `Graphics` left on screen, one texture per batch, and never read layout from the DOM per
  frame** — see "Who draws what", where each of those has a measured frame cost behind it.
- **Lettering in a rasterised SVG is drawn on top**, with Phaser text or Canvas 2D: an SVG drawn
  through an `Image` cannot use the page's fonts and falls back to a system face.
- **Everything has to work in a browser**, because the browser *is* the game — and in the Capacitor
  shell, which is the same page in a WebView. A dependency with native code costs both.

## Verifying changes

- Logic: drive `gameReducer` directly with a small script (the regression scripts in `tools/` do
  this — they transpile the TypeScript with `typescript` and `require` it, so no build step): start
  a day, `TICK` until a customer spawns, `TAKE_ORDER` that slot, pour and scoop the order's
  ingredients and `SERVE`, then check coins/stats; also let a `requesting` customer time out (no
  order taken) and confirm `stats.missed` rises, unless they are in a cap: a shipper leaving is not a
  miss. Reaching `dayEnd` needs the counter and the line to be empty after closing time, with no group
  still coming in.
- The mechanics: `tools/check-rules.cjs`, `check-overtime.cjs`, `check-waves.cjs` and
  `check-regulars.cjs` drive the reducer and the save through each of them, and `check-prep-layout.cjs`
  holds the arithmetic of the overtime dock and the Hỏi lại button. **None of them reaches the HTML or
  a scene**, so whether the hidden card leaks, whether the pill covers anything and whether the spoken
  line wraps are browser checks, at the four sizes under "UI" below. To put any moment on screen,
  `window.__shop.store.dispatch({ type: 'RESTORE', state: { ...window.__shop.store.state, clock, slots } })`
  takes a whole state as it stands. What only a person can tell is whether any of it is fun; see
  "What the bot found, and what nobody knows".
- Saving: the save is one key, `boba-shop.save.v1`, in plain `localStorage` —
  `localStorage.getItem('boba-shop.save.v1')` in the console shows the shop as it stands, and
  removing it is how a first launch is tested. **`localStorage` is per origin, and the port is part
  of the origin**: a shop played at `localhost:5173` is not there at `localhost:5174` or at the LAN
  address `--host` prints, and the game rightly opens a new one. So a second dev server — one left
  running by someone else, which pushes `npm run dev` to 5174 — looks exactly like the save being
  wiped, and it has already been reported as that. Check the address before believing a reset, and
  move a shop between origins with the backup code rather than hunting for a bug. Reload mid-shift and you should come back to the
  same minute of the same day behind the pause card, with the opening sign *not* replayed.
- The backup code: `tools/check-backup-code.cjs` covers the round trip and the refusals, all of
  which are pure. What it cannot cover is a real move between two installs — say so in the report.
- Putting a cup in a particular state: `window.__shop.load(json)` in development or with `?test`,
  which reads a save exactly as a launch would. Do **not** write the save from a page on the same
  origin and reload: any page on the dev server is the game, and it flushes its own save as it
  unloads, over whatever was just set.
- The loading screen: it is over in a flash on a warm cache, so throttle the network to see it
  (`Network.emulateNetworkConditions` over CDP, or the browser's own throttle).
- Sound and music: `tools/check-audio.cjs` is arithmetic on sample values — it proves the loops
  join, the one-shots do not click, every cue is wired to something and the volumes survive a save,
  and it proves **nothing about whether any of it sounds good**.
  `tools/check-audio-engine.cjs` drives the engine's whole lifecycle against a fake audio context.
  A browser shows that it plays: build, serve `dist/`, press "Bắt đầu" and the menu theme should
  come up under it. Nothing may play before that first gesture, which is the browser's rule and not
  a bug. Mixing with the player's own music, the silent switch and the real latency of a cue fired
  from a drag are phone-only — say plainly in the report when a change has not been heard on one.
  To hear a single cue in isolation, play its file from `src/assets/audio/` directly.
- Performance: a desktop browser absorbs anything this game does, so measuring it there says
  nothing until the CPU is slowed to roughly phone class (`Emulation.setCPUThrottlingRate`, rate 8
  over CDP). Then `Performance.getMetrics`' `ScriptDuration` over a fixed window of play — idle on
  the prep page, and again while a drag is driven in a loop — is comparable between two builds,
  which is enough to tell a change that removed work from one that only moved it. The frame times
  in the header of this file were measured that way. It is still a browser: it cannot tell you how
  the gesture *feels* on the phone.
- Storage failures: `localStorage.getItem` can be made to throw for one key from an init script
  that runs before the bundle, which is the only way to reach the read-failure path under "Saving
  the shop" — and the thing to assert afterwards is that the save is still there, byte for byte,
  after several write intervals of play.
- UI: `npm run build`, serve `dist/` (`npm run preview`), and look at it at phone sizes (390×844
  and the small 375×667) and sideways (932×430, and a short desktop window like 1284×610, which is
  where the order panel last went wrong — `tools/check-prep-layout.cjs` is the desk half of that). The Prep page is reached by swiping left or tapping the "Pha chế" tab. To
  reach a later day quickly, load a save with `window.__shop.load`. The money shows in four places
  (the HUD and the opening sign, both the till; the day-end screen, which is the only one that
  reports a single day's takings, and shows the till twice because its shopping can scroll the first
  out of sight; and the overtime jar's label beside the pill, which is not the till yet).
- Dead code and dead art: `tsc` catches an unused import or local, and **nothing catches an unused
  export** — it typechecks, it builds, and it ships. Finding those means walking the import graph
  from the entry points (`src/main.tsx` and `src/art/art-test.ts`, plus whatever the scripts in
  `tools/` require out of `src/`) and asking two questions of what the walk did not reach: is this
  name imported anywhere, and is this file imported anywhere. A sprite is an import like any other
  ("A sprite is its own URL"), so the same walk answers for the artwork — and the artwork is where
  the weight is: the last sweep took 42 exports and 40 PNGs out and `dist` fell from 29 MB to 25.
  Two traps in doing it: an asset can be reached from CSS rather than from TypeScript (the fonts
  are, through `@font-face`), and a file nothing imports is not necessarily dead — `src/env.d.ts`
  is read by the compiler, and the licence beside the fonts and `CREDITS.md` beside the audio are
  there for reasons no import graph knows about. The big paintings under `src/assets/kitchen/` are
  in the same class: they are the imagegen sources the sprites were cut out of, they do not ship
  (Vite bundles only what is imported), and they stay.
- The phone apps: `npm run sync` copies `dist/` into `android/` and `ios/` and re-writes their
  plugin lists — run it after adding a plugin, and expect `check-updates.cjs` to fail until
  `NATIVE_VERSION` moves with it. A real build needs the **Build apps** workflow or a local
  Android SDK / Xcode; neither is here, so say in the report that the app shell was not built.
- Updating an app: the pure half — which kind of new version it is, what it costs, what a tag and a
  manifest mean — is `tools/check-updates.cjs`, which also drives `fetchManifest` **and the whole
  apply** against a fake device: a stub of the two plugins that is strict where the device is
  strict, so that a write or a copy into a directory nobody made is refused there too. It covers
  the first update (nothing on disk to copy from, because the base path says `public`), the second
  (only the changed files come down), a file the build on disk has lost, what a failure says, that
  what is being served does not move when one fails, and where each platform puts a build. One thing more
  a desk can check, and it is the one that was missed: whether the app is allowed to read the site
  at all. Serve a page on `http://localhost:<port>` — any origin that is not the site — and
  `fetch` the site's `update.json` from it; blocked there is blocked in the app, for the same
  reason. The rest is phone-only and a browser cannot fake it: downloading a build into the app, pointing the WebView at it, the rollback when one does not
  boot, and Android's installer prompt all need two real builds on a real device. Say so in the
  report.
