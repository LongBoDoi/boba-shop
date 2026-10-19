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
its whole lifecycle against a fake audio context), the topping tray's geometry and the backup
code; see "Verifying changes" below. There is **no lint step** — the old one was
`eslint-config-expo` and went with Expo; `tsc` is strict and is the gate.

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

Four rules, each of which is the difference between an update and an unusable app:

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

**The cup** (`kitchen/cupPainter.ts`) is painted with Canvas 2D into one texture, using the same
geometry functions the artwork is measured with, and only repainted while something in it moves (a
pour, a portion settling, ice settling). One deliberate difference from the old build: the glass is
**not** laid over the tea at 22% — the web players knew never saw that veil, and its saturated tea
is the look that was kept (`GLASS_FILLED_ALPHA`).

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

- **`PRELOAD` is not every sprite in `kitchenArt.ts`**, because that file still exports the room's
  old planks and counters and the teas' old jars, and nothing draws them (see "The kitchen's
  artwork"). Fetching that lot would about double the wait for sprites that never appear. When
  something in there starts being drawn, add it: a sprite left out still loads, just late, in the
  middle of play, which is the stutter this exists to remove.
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
  the foam tubs and the ice machine on `config.categories`, so all of them stand on the bench on
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
in the tiled alcove, the ice machine under the rack, the syrup, milk and foam on the bench nearer
the viewer, and the cup on its holder through the middle of the work top. Each dispenser gets a
**dock**: where the cup is held while that tap runs into it.

Everything is anchored to the painting rather than to the screen, through `fitBackground` and the
boxes measured in the plate's own pixels — `ROOM_BG_TEA_SHELF`, `ROOM_BG_TOPPING_SHELF`,
`ROOM_BG_ICE_MACHINE`, `ROOM_BG_CUP_HOLDER`. The wall pans; the equipment pans with it because it
is placed in the same space, and `findStation` tests a touch in that space too. The cup does not
pan: it is the one thing that belongs to the player's hand.

- **Everything that can be dragged can be tapped, and a tap does the carrying.** The quick way is
  never a shortcut past the room: whatever the drag would have moved, moves — the cup walks itself
  from the rack to the mat, a tool takes itself over the cup and tips in there, and a tap on a tank
  fetches the cup under its spout. Nothing is teleported and nothing lands on the mat out of thin
  air, which is the whole reason these are carried and not chosen off a list. One thing a tap will
  not do for the player is **hold the tap open**: how long it is held *is* the pour, so a tapped
  tank docks the cup and stops there. `flightTime` sets how long a carry takes from how far it
  goes, between the room's own two durations, so a cup let go of over its own mat settles at once
  and one fetched from the rack takes the longer move.
- **Pour by docking.** Tap a tank, or drag the cup under it and release to snap beneath its spout;
  the cup scales to the shelf gap and stands on the lowest shelf surface with a small contact
  shadow. Hold the tap to raise the live level; releasing commits the amount and leaves the cup
  docked, ready for another pour. Drag it away to undock. A tank cannot pour until the cup is docked
  beneath it, and a cup holding a different tea locks every other tank
  (`Ly đã có trà khác — đổ bỏ để pha lại`). Panning returns a docked cup to its holder. The stream
  draws behind and in front of the cup, split at its lip, and spills over the brim. A tank tapped
  while it is half off the edge of the room **slides the wall into place first** (`panForDock`),
  because a cup fetched to it would otherwise hang off the same edge, reading a meter nobody can
  see; the cup is aimed at where the wall is *going*, so the two travel together.
- **Everything else is carried to the cup.** The topping containers, the ice machine's scoop, the
  syrup bottle, the milk cartons and the foam tubs are dragged or tapped: what is in hand follows
  the finger above everything else, and on release either tips into the cup (`SCOOP` / `ICE_SCOOP`
  / `SUGAR_PUMP`, or `POUR` of `MILK_SPLASH` for a carton) or goes back. The cup does not move for
  these — drop onto it wherever it stands, and a drop counts over the cup's *home* as well as over
  the cup itself, because a scoop tipped onto the coaster it left behind went into a cup that was
  not there. The refusals are one list (`refuseTool`) and the tipping in is one move
  (`tipToolIn`), whichever way the tool got there: a tap is refused before it sets off, so nothing
  crosses the room to be turned away at the cup. Syrup shows how many pumps went in on the machine
  itself. Milk takes room in the cup, so a cup filled to the brim with tea has nowhere to put it.
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

Ice is available from day one: drag the scoop in once for ít đá, twice for đá thường; no scoop
means không đá. One scoop is three cubes, two is twelve.

`createIceLayout(cupId)` (`art/iceLayout.ts`) decides where they all go, once per cup, from the
cup's id — so the arrangement is stable through pours, ticks and reloads, while a fresh cup gets a
different one. It lays out the whole tray rather than the cubes currently in the cup, so adding the
second scoop cannot move the first, and an index means the same thing however many scoops have gone
in. Placements are fitted, not guessed: `cupIceRestPosition` fits the actual rounded cube outline
to the curved floor, `cupIcePosition` seats a floating cube against the front edge of the shared
tea oval with its own immersion and depth, and samples that land too close after fitting are
retried. Dry ice rests on the ingredient bed; tea lifts it to the surface, where four cubes sit
across the waterline with varied immersion and tilt and the rest scatter below it with room
between their centres. Cubes settle briefly when they land, then stay put.

The waterline is where the drawing gets its care: the submerged body is softened and tinted by the
tea (more so with milk), with a small meniscus to anchor it to the surface, and the exposed crown
is drawn over the glass's front wall so it is as crisp as a cube on the floor. Crowns are allowed
up into the clear space below the lip, so a full cup does not trim them into a flat cap.

Sources and the imagegen prompts for the ice art are in `tools/ice-art-prompts.md`; repackage them
with `python3 tools/cut-ice-art.py`, preserving the source transparency.

### Liquid and glass layers

The cup is painted in one pass by `kitchen/cupPainter.ts`, in the design's own 113×174 sprite
space, in this order: the faint cool glass backing, the tea inside the traced `CUP_WELL`, the
submerged ice and the pile of toppings, the exposed ice, foam, then the glass's front reflections,
its edge highlights and the cat decal. Every moving boundary — the tea's surface, the waterline the
ice is split at, the wash over each band of the pile — is a **canvas clip**, which costs nothing
and can move freely.

What the painting is allowed to decide, and what the geometry is:

- **The tea's surface is a complete oval** with the same perspective as the cup's rim, narrowing
  with the tapered walls, carrying a painted meniscus, a crescent highlight and a curved
  reflection. `cupGeometry.ts` is the one place its coordinates come from, and the stream and the
  foam read the same ones.
- **The glass's painted detail is split by depth**: the inner-floor detail is drawn behind the
  contents, the front wall, rim and near base edge in front — so a pile of toppings occludes the
  rear base rings instead of having a bright oval painted over it.
- **Glass opacity follows the tea and nothing else.** Adding toppings never changes it. The veil
  the old build laid over the liquid at 22% is off here (`GLASS_FILLED_ALPHA = 0`): the web players
  knew never saw it, and the saturated tea is the look that was kept.
- **Milk tints the tea** rather than being a layer of its own, and the wash over the toppings is
  drawn once per row of the pile — three rows, which is the grain that keeps the gradient from the
  back of the pile to the front while a near piece still covers a far one's wash.
- **The dispenser's tea** is drawn into the tank's transparent chamber with the same shading, more
  strongly: it is a big volume behind glass, and the raster texture that works in a cup softens it.
  The tank's own glass and hardware are the painted sprite, untouched.

`CupToppings`' pieces are placed by `cupToppingPosition`, which fits the whole rotated sprite
inside the narrower inner-floor opening with a little clearance from the walls and the curved base:
the pile is packed towards the centre so the clip stays a safeguard rather than a way to crop
oversized pieces. Each portion lands behind the pile already there, keeping the first ingredient's
positions, and a short fall settles it. Ice, foam, the front reflections and the decal are in front
of the pile.

**A full cup is drawn full, at `CUP_SURFACE_TOP` — the brim, not the line the design paints.**
The design's full cup (`cut-cup-design.ps1`, `SURFACE_Y = 48`) is a drink made to be carried, with a
fifth of the glass left clear for its lid, and the well was traced to it. Taking that as the game's
brim made the meter lie: it ran to the end of its track, and then warned of tea going over the
side, while the glass plainly still had room in it. The surface now stops where the painted rim
stops it (y 36, its far edge reaching into the mouth of the cup), and `CUP_WELL` is carried up the
glass's own taper to meet it — so `CUP_RX_BOTTOM`/`CUP_RX_TOP` and `CUP_TAPER` are where the inside
of the glass is measured, and the oval, the floating ice and the ice well all read their widths off
that one line. The painted drink texture only has pixels from y 48 down; above it the body is the
gradient alone, which is why nothing in there may depend on the sprite to carry a shape.


### The kitchen's artwork
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

- a **dispenser** uses the transparent `TEA_TANK` frame over its tea, which is shaded, has an oval
  surface and ripples while it pours. `JAR_TEA` retains the older complete jar sprites; the current
  shelf does not draw those;
- the **cup** is painted by [cupPainter.ts](src/kitchen/cupPainter.ts) into one texture in its
  113×174 sprite space — see "Liquid and glass layers" — and drawn by `kitchen/CupView.ts`, which
  repaints it only while something in it is moving;
- a **scoop of topping** is one whole painted sprite, `SCOOPFUL[id]`, heap and all. It used to be
  the bare `SCOOP` with pieces laid into its bowl by hand, which was the same mistake the teas
  were — the design draws what a scoop of this looks like, so take its word for it. The six are
  drawn to a common **height**, because the scoop is identical in all of them and only what mounds
  over the bowl differs; matched on width instead, a heaped one shrinks beside a flat one.
  Ice uses its own complete `SCOOPFUL.ice` painting. Foam takes the bare `SCOOP` with a blob
  drawn in its bowl;
- the **cartons, syrup, foam tubs and every fitting** (wall, lamps, shelf, steel counter,
  cabinets, rail, coaster, plant, poster, cup stack, towel) are whole sprites
  that `kitchen/layout.ts` places by the painting's own lines and `kitchen/equipment.ts` draws;
- **the room itself is one painted plate**, `room-bg.png` — the tiled wall and its lamps, the
  dispenser shelf, the fridge, the work top, the bench and the pink units at its foot, all of
  it painted rather than assembled. It used to be assembled: a wall tile set to repeat, a shelf
  plank and a stainless counter each sliced into bands and stretched across the room, a run of
  cabinet fronts, a group of props cut out of the mockup — every one of them a line to compute
  and a seam to get wrong. Those sprites are still cut (a station may yet want the stainless),
  but the room no longer draws any of them. Each piece of equipment sits in a contact shadow of
  its own, because there is no well in a counter to sink it into. The active topping cabinet is
  measured in the panoramic background by `ROOM_BG_TOPPING_SHELF`. The portrait plate and
  `ROOM.tray` remain legacy geometry.

**The prep page is all kitchen.** There is no ticket rail, and no row of shortcut buttons for
walking to a station — the room fills everything between the order panel and the action buttons,
which is what gives the equipment the size it has in the reference. The wall is reached by
swiping it, which is the same gesture everything else in the room is worked with; the buttons
that jumped the view to the tea, milk and topping ends of it were a second way to do one thing,
and they cost the room a band the height of a dispenser.

### Turning it on its side

The game is drawn upright, and the painting is what decides what happens when it is not.
`ROOM_BG_KEEP` is the band of the plate the room cannot do without — the crown of a tank on the
upper shelf (y 113) down to the front of the cup's holder (y 909), with the taps, the toppings,
the ice machine, the work top and the cup between them. `fitBackground` draws the plate `cover`
and centred, so **a kitchen wider than 1.93 times its own height starts losing that band from
both ends at once**: the dispensers lose their lids and the counter falls off the bottom. That
one ratio, `ROOM_KEEP_ASPECT`, is the whole of the sideways problem.

There is a second, narrower line as well. `ROOM_BG_REACH` is what the room needs to still be
*workable* rather than whole — a tank's name tag down to the line the cup's foot stands on. What
lies between the two bands is the crowns of the tanks' lids and the front lip of the cup's mat:
paint, not furniture. A layout can be worth having at the price of a lid.

`src/responsive.ts` is the only place that answers it, and `prepLayoutFor` gives one of three:

- **`stacked`** — upright. HUD, tabs, the order band, the kitchen, the buttons, down the screen.
- **`band`** — the same arrangement sideways, with every spare pixel taken out of it. The order
  stays across the top and the buttons stay along the bottom, both where the player already looks
  for them; the card is shorter to match (`ORDER_BAND_HEIGHT`, tiles moved up beside the name)
  and the buttons give back a few pixels of height. **This one is measured against
  `ROOM_REACH_ASPECT`, not `ROOM_KEEP_ASPECT`, and that is the trade it is**: two bands cost
  about 180px, which only a 12.9" tablet can give up whole, so below that the tanks are cropped
  to the top of their name tags. Keeping the whole painting would mean moving the buttons, and
  they were wanted where they are.
- **`column`** — sideways and short with it. The order and the buttons stand *beside* the
  kitchen, which spends width instead of height. A phone on its side gets this, and so does an
  iPad mini: there the two bands leave the room a strip no deeper than a dispenser.

Two things not to undo:

- **Each layout's root is keyed** (`key={layout}` in `ui/GameScreen.tsx`). They are all nested
  boxes, so a renderer will otherwise reuse the band's strip *as* the kitchen's box and the kitchen
  as whatever stood beside it: the elements survive, nothing reports a new size, and the scene goes
  on laying the room out for the box it had under the other layout — a room at the wrong scale with
  its hint pill below the bottom of the screen.
- **`PREP_BAND_HEIGHT` and `PREP_ACTIONS_HEIGHT` count their own rules and padding, exactly.**
  Every pixel of both comes off the room, and the room is already down to its reach band on an
  11" tablet; a couple of pixels of border unaccounted for is another row of the painting gone.
  If the crop ever needs buying back, the levers in order of how much they return are: the HUD
  and the tab indicator sharing one row sideways (~26px, and the tabs are a navigation
  affordance, so that is a design call), the card's progress track (18px, but it is the only
  thing that shows progress at a glance), and the card's two-line tile captions (12px, and they
  become unreadable at one line).

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
it): who the drink is for, what it is called, how far along it is, and a tile for every thing that
goes in it, each ticking off as the cup comes together. The heart beside the name is the
customer's patience, emptying from the top and turning amber then red. A 40px portrait, a 17px
title, tiles up to 32px and a progress bar under the name; the empty state keeps the same box and
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

The card itself takes no touches; only the queue portraits are live (`.live`).

`drinkName` puts "sữa" where Vietnamese puts it, which is not the same place every time: "Trà Thái"
becomes "Trà sữa Thái", "Hồng trà" becomes "Hồng trà sữa".

### Standing things on a painting
The plate is `tools/sheets/room-bg.png`, 941x1672, and `ROOM` in
[kitchenArt.ts](src/art/kitchenArt.ts) is **where it draws its surfaces, in its own
pixels**: the shelf's board, the ceiling over it and the face of the board above that (where its
sign is mounted), the ledge, the line a cup stands on along the work top, the bench, the cabinets.
Nothing in the room is a fraction of the phone — `fitBackground(w, h, …)` in `kitchen/layout.ts`
gives the scale and offset that take plate pixels to screen pixels, and a dispenser is on the shelf
the painting paints however the phone is shaped.

`fitBackground` deliberately does **not** centre the plate on itself, the way a `cover` background
would: a phone shorter than the painting then loses the work top off the bottom. It centres on the
working band instead (`ROOM_BG_KEEP`, the crown of a tank down to the front of the cup's holder)
and lets the ceiling and the floor be what goes. Anything that must stay reachable in a short room has to clamp itself into
view — the hint pill does, because the pink units it sits on can be cropped away.

**The holder under the cup is measured there too, and only half used.** `ROOM_BG_CUP_HOLDER` is the
mat's box in the painting's own pixels, and `kitchenHolderFor` projects it like any other surface,
so the holder comes out the size the design draws it. Its **x** is the one measurement thrown away:
the wall pans and the cup standing on the holder does not, so the holder is centred on the screen
instead — which is within a few pixels of where the painting puts it. Sizing it off the cup instead
(it used to be `cupW * 1.5`) gave a mat less than half the painted one. The sprite itself is cut to
twice that box by `tools/cut-cup-holder.py` rather than shipped at the two thousand pixels imagegen
returned, because a woven grid reduced that far is sampled rather than averaged and the weave comes
out as stripes; see `docs/cup-holder-art.md`. The cup's resting place is measured off the holder
rather than off the counter: it is centred in it, standing on `CUP_FOOT` — the middle of its
painted base ring — because the bottom of the cup's sprite box is the *front* of that ring, and a
cup stood on a surface by its box sits forward of whatever it is on by half a ring.

If the plate is re-cut, `ROOM` is what to re-measure: read a column of it for the horizontal
lines and a row for the vertical ones. Two lines that look alike and are not: `shelf.x0`/`x1` are
the **back wall** of the recess, which is narrower than the board in front of it, and every
`base` is the **front** of a board's lit top face. A row of jars divided across the back wall
stands plainly inside the shelf; divided across the board it laps over the ends of it.


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
  and the small 375×667). The Prep page is reached by swiping left or tapping the "Pha chế" tab. To
  reach a later day quickly, load a save with `window.__shop.load`. The money shows in three places
  (the HUD and the opening sign, both the till; the day-end screen, which is the only one that
  reports a single day's takings).
- The phone apps: `npm run sync` copies `dist/` into `android/` and `ios/` and re-writes their
  plugin lists — run it after adding a plugin, and expect `check-updates.cjs` to fail until
  `NATIVE_VERSION` moves with it. A real build needs the **Build apps** workflow or a local
  Android SDK / Xcode; neither is here, so say in the report that the app shell was not built.
- Updating an app: the pure half — which kind of new version it is, what it costs, what a tag and a
  manifest mean — is `tools/check-updates.cjs`. The rest is phone-only and a browser cannot fake
  it: downloading a build into the app, pointing the WebView at it, the rollback when one does not
  boot, and Android's installer prompt all need two real builds on a real device. Say so in the
  report.
