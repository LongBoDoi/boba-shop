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
serving behaviour, saving and restoring, the cup sizes, the sound (its assets, its catalogue and
its whole lifecycle against a fake audio context), the topping tray's geometry, the sideways
layouts and the backup code; see "Verifying changes" below. There is **no lint step** — the old one was
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

A shift is two minutes of watching customers arrive and tea run into a cup, a good deal of it with
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

**The cup** (`kitchen/cupPainter.ts`) is painted at device density into one texture, using
`art/cupGeometry.ts` for its elevated overhead projection. Glass, tea, ice, toppings, and cream
share the same broad opening and short visible front wall. It only repaints while a pour or a
portion is moving. See `docs/overhead-cup.md` for geometry and visual checks.

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
src/ui-state.ts         screen state the rules don't own: page, sign, meter, hint, rectangles
src/clock.ts            the day's tick
src/persist.ts          localStorage: the read at launch and the slow write; see "Saving the shop"
src/sound.ts            watches the shop and tells the engine what to play
src/screen.ts           the screen wake lock: the phone stays awake while the game is in front
src/hooks.ts            useGame/useUi: the only way the HTML reads either store
src/game/               the rules, and the canvas they run on
  reducer.ts            GameState + CupBuild, actions (START_DAY, TICK, TAKE_ORDER, POUR, SCOOP,
                        ICE_SCOOP, SUGAR_PUMP, SERVE, CLEAR_CUP, SET_MODE…), scoring
  levels.ts             getDayConfig(day): the whole menu, order/serve patience, spawn rate, slots;
                        describeUnlocks (the pace, never an ingredient)
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories,
                        and the hands-on constants (POUR_RATE, DEFAULT_ID…)
  orders.ts             random order generation (MENTION_CHANCE: what an order asks for and what it
                        leaves out), price, evaluateDrink (perfect/close/wrong)
  customers.ts          random customer looks (hair, skin, shirt, accessory) and names
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
                        OrderBubble, PourMeter, OpeningSign, SettingsSheet, DayEndScreen, Effects,
                        LoadingScreen, responsive.ts (the three prep layouts), ui.css
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
tools/check-audio.cjs   loop seams, cue wiring, and the volumes through a save
tools/check-audio-engine.cjs  the scheduler and the whole browser lifecycle, against a fake context
tools/check-prep-layout.cjs   the sideways layouts, against the painting's own band
tools/check-backup-code.cjs   the backup code's round trip and its refusals
tools/check-updates.cjs       the native shell's fingerprint, and which new version is which
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
- **Everything read back is validated, and a save that doesn't check out is thrown away** rather
  than patched; a fresh shop is a better failure than a half-restored one. The save sits in
  `localStorage`, where it can be edited, and a save from an older build can name an ingredient
  that no longer exists. Ingredient *names* are checked against the catalogue; whether the day still
  *offers* them is not — every day offers everything now, and a save that named a tea since taken
  out of the catalogue leaves one customer asking for it rather than wiping the save. `cup.ice` and `cup.sweetness` are re-derived from the
  build's scoops and pumps instead of being trusted, since the reducer treats those as the same fact.

The writer is on a **2 s timer**, not on every state change — a day ticks several times a second —
and flushes when the page is hidden and on `pagehide` (closing a tab doesn't reliably raise a
visibility change). The most a crash can cost is the last couple of seconds.

`tools/check-save.cjs` covers the round trip, the two non-playing phases, the saves that must be
refused and the ones that are tidied up instead.

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

### Opening the shop

The painted kitchen is about five megabytes of sprites, and nothing used to ask for them until
something drew them: the first swipe to the prep page landed on a room that filled itself in, and
the first scoop of each topping stuttered while its sprite decoded. A shift is two minutes long and
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
- **`tick` hands back the same `slots`, `feedback` and `departures` arrays when nothing in them
  moved** (`unchanged` in the reducer). A fresh copy would tell every subscriber that the contents
  had changed, and those comparisons are what the rule above rests on.
- **`patienceLeft` is rounded to a fiftieth.** It is drawn as a 20px ring and a 26px heart, where
  that is half a pixel.
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
Pha chế = # tickets to make). Swiping is the primary gesture; the tabs are the shortcut.

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
  day to day, it rides in the save, and it is what the shopping still to be built will be paid out
  of. It is the one money number during play: the HUD counts it up and the flying coins land on
  it, the opening sign reads it, and the day-end screen shows where the day's takings went. The
  menu shows no money at all.

Both are added to in exactly one place (`serve`), and `SPEND` is the only thing that takes any
out. Nothing dispatches `SPEND` yet: it and `canAfford` are there so that when a shop screen is
built, the refusal already lives in the game's logic rather than in whichever screen happened to
ask, and so the balance has one way up and one way down. Prices are whole units — `canAfford`
refuses half of one, along with anything negative or not finite.

Three decisions worth not re-litigating:

- **The till survives going back to the menu**, as the week does. `GO_TO_TITLE` changes the phase
  and `START_DAY` carries `money` through `buildDay`, so leaving a day and opening the next one
  keeps the money. It is the player's, not the run's; anything they had bought with it would
  otherwise be confiscated for quitting.
- **The stars rate the service now, not the money.** With no target there is nothing for the
  takings to fall short of, so `starsFor` reads `DayStats` instead: how many customers got a drink
  at all (`served` against `served + missed`), and how many got the one they asked for. The money
  is the reward; the stars are the grade.
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
  itself on an empty list, so the quiet days simply say nothing.

**The day is still a difficulty dial, just not a menu.** `slots` (2 on day 1, 3 after),
`maxToppings` (1, then 2 from day 5), `orderPatienceMs`, `patienceMs` and the spawn rate all still
tighten with the day. If the whole progression is ever wanted gone, those are the numbers to flatten
— the ingredients no longer have anything to do with it.

**Old saves need nothing.** The day config is not saved (see "Saving the shop"), so it is re-derived
on every launch; a shop saved on day 2 of the old build reopens with the full shelf.

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
read `departures` rather than `feedback`; saved volumes migrate and clamp without increasing
`SAVE_VERSION`. Cue delays share the visual motion constants in `src/game/effectTiming.ts`.

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
described above. **Relaxed** ("Tự động nhận order") does two
things in `tick()`: a customer arrives already `ordered` (`orderedAt: clock`, so the serve timer starts
at once and the order-taking patience never applies), and `nextSpawnAt` is left at `clock`, so the next
customer walks in as soon as a spot is free rather than after `spawnMin/MaxMs`. The only gap left is
the 1.3 s `DEPARTURE_MS` the leaving customer needs to walk off their spot.

The mode lives in game state, not in a React context or storage: `SET_MODE` can be sent at any time,
`START_DAY` carries it over to the next day, and switching *to* relaxed mid-day also takes the order of
anyone still `requesting` (nobody is coming to take it by hand any more) and pulls the next arrival
forward. It rides along in the save, so the mode a shop was last run in is the one it reopens in
(see "Saving the shop").

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

Ice is available from day one: one scoop is three cubes, two is twelve. `createIceLayout(cupId)`
(`art/iceLayout.ts`) chooses stable normalized positions in the overhead plane. The second
scoop fills gaps without rearranging the first. A reload preserves the arrangement.

`cupPlanePosition` projects every footprint into the actual liquid ellipse. Ice is viewed mostly
from its top face, with rounded melted edges, a faint tea tint, and short contact shadows.
It rises continuously as the tea fills, and the plane widens with the glass taper.
`check-cup-contents.cjs` checks complete footprints, spacing, continuous rise, and the stream
endpoint across cup seeds and fills. The active cup draws its ice directly at device density.

### Liquid and glass layers

The preparation cup uses a 113 x 125 coordinate box, with its mouth centered at (56.5, 42),
radii 48 x 33, and its base contact at y92. `CupView` draws a single device-density canvas,
a transparent overhead lid/straw when finished, and the size badge.

`cupPainter.ts` paints rear glass and an inset floor, the live tea surface and short front body,
scattered toppings on the floor, ice on the liquid plane, the foam cap, then near glass, rim,
highlights, and a small foreshortened cat print. Contents stay behind the front rim. The old
front-view cup layers and tea crops are no longer loaded for preparation.

- **Tea, ice, and cream share `cupSurface(level)`.** Empty is y86/rx34; full is y42/rx48.
  Every surface keeps the mouth perspective of 33/48. The stream uses the same endpoints.
- **Milk changes liquid color and softens submerged toppings.** No liquid is invented for an
  empty cup. Toppings cover a scattered disk; later portions retain earlier positions.
- **The glass is transparent, with warm contours and narrow reflections.** The broad mouth and
  short body match the elevated room. The cat print stays on the front wall.
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
  cup-size badges, quantities and hints. Small warm-paper S/M/L plaques sit centered beneath the
  painted stacks on the rack's wooden front; their anchors follow `ROOM_BG_CUP_STATION.labels`,
  independently of touch-target minimums. The cup-size badge compensates for
  docking scale. Ingredient names remain available to screen readers; there are no visible
  ingredient name captions or plaques.
- **Cream is an overhead cap** (`kitchen/creamPainter.ts`), sharing the liquid ellipse with a
  shallow piped spiral, contact shading, and small bubbles. Cheese stays ivory; brulee has
  golden custard shading, caramel patches, and toasted flecks. The near rim crosses in front.
  Adding cream leaves tea level and ice positions unchanged. The older upright cream PNG
  and its prompts in `docs/cream-art.md` are retained as design history.
- **The dispenser's tea** is drawn into the tank's transparent chamber with the same shading, more
  strongly: it is a big volume behind glass, and the raster texture that works in a cup softens it.
  The tank's own glass and hardware are the painted sprite, untouched.

**A full cup is drawn full.** Liquid reaches the mouth center at `CUP_SURFACE_TOP` when fill
is 1. `cupMarks.ts` and the visible stream derive endpoints from the same geometry. No artificial
starting fill or upper plateau is applied. S/M/L share this projection, with the original relative
width scales, and stand by `CUP_FOOT` on the single mat. Lid, straw, lidding press contact,
ingredient landing point, and contact shadow use these coordinates. See `docs/overhead-cup.md`.

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
  113 x 125 overhead space — see "Liquid and glass layers" — and drawn by `kitchen/CupView.ts`, which
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

`src/responsive.ts` is the only place that answers it, and `prepLayoutFor` gives one of three:

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

- **Each layout's root is keyed** (`key={layout}` in `ui/GameScreen.tsx`). They are all nested
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

The counter page has its own sideways form, which is a different question — `isWideLayout` alone,
since the counter has no painting to crop, only customers to make bigger and to centre.

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

### The order, spoken back
[OrderBubble.tsx](src/ui/OrderBubble.tsx) is the **panel docked across the top of the
prep page** (it was a paper note clipped to a rail inside the room, then a bubble floating over
it): who the drink is for, what it is called, how far along it is, and a picture for every thing that
goes in it, each ticking off as the cup comes together. Toppings tick individually when added. The heart beside the name is the
customer's patience, emptying from the top and turning amber then red. A 40px portrait, a 17px
title, picture tiles up to 48px (60px in a roomy column) and a progress bar under the name; the empty state keeps the same box and
centres a one-line prompt in it.

Six things about it are deliberate:

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
  cannot spare — the tiles move up beside the name. See "Turning it on its side";
- **the other taken orders stand inside it**, in a queue to the right of the heart — tap one to
  make it next. They used to hang off the card's bottom-right corner, over the room, where a
  seven-thing order had its last two ingredients covered by them;
- the patience heart empties from the top through a clip on its own SVG, which is the one piece of
  the card that is redrawn as the day runs.

`ingredientIconSvg` uses the actual tea-tank and topping-scoop atlas frames, the shared
milk/cream packages, and the painted sugar scoop and ice. Milk and cream get enlarged ingredient
insets; tea and topping tiles carry a small diagram of their shelf/tray location. There are no
visible name captions. Only S/M/L, sugar percentage and ice scoop count remain as small badges;
full Vietnamese ingredient names and completion states remain in accessible labels. The compact
side column puts its waiting portraits into the header so they never push recipe pictures out
of the card. See `docs/visual-orders.md`; `check-order-art.cjs` checks artwork mappings.

The card itself takes no touches; only the queue portraits are live (`.live`).

`drinkName` puts "sữa" where Vietnamese puts it, which is not the same place every time: "Trà Thái"
becomes "Trà sữa Thái", "Hồng trà" becomes "Hồng trà sữa".

### Standing things on a painting
The active room uses `ROOM_BG_SIZE` (1920×1430 logical coordinates), with the original
1920×1080 counter plate offset below the upper extension.
`fitBackground` covers and centers the working band; room equipment shares its scale,
vertical offset and horizontal pan.
Re-measure `ROOM_BG_*` anchors and topping tray edges when changing the active plate.

`kitchenHolderFor` places one shared mat near the center of the clear foreground marble, with
space before the counter edge and beside the sugar tray. Its preferred width is 250 logical
units; it preserves the painted aspect ratio and enough clearance around an L cup on short screens.
The mat stays fixed while the room pans. Both preparation and finished cups stand by `CUP_FOOT`
at the same mat center; there is no separate finishing home. See [single mat](docs/single-cup-mat.md).
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
  tap-outside).
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
  order taken) and confirm `stats.missed` rises. Reaching `dayEnd` needs the counter to empty after
  closing time.
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
  reach a later day quickly, load a save with `window.__shop.load`. The money shows in three places
  (the HUD and the opening sign, both the till; the day-end screen, which is the only one that
  reports a single day's takings).
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
