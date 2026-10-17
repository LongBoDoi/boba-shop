# Tiệm Trà Sữa (boba-shop)

A mobile cooking game run as two swipeable screens: a **Counter** where customers wait and the
player taps each one to take their order, and a **Preparation** screen where the player picks a
taken-order ticket, builds the cup ingredient by ingredient, and serves it before the customer runs
out of patience. One Expo / React Native codebase for iOS, Android and web.
**All player-facing text is Vietnamese.**

Also read `AGENTS.md` (Expo's own rules: check the versioned docs for SDK 57, use
`npx expo install` to add packages, never hand-edit `ios/` or `android/`).

## Commands

```bash
npm install
npx expo start              # dev server; scan the QR with Expo Go (same Wi-Fi as the computer)
npx expo start --web        # run in a browser
npx tsc --noEmit            # typecheck
npx expo lint               # lint (React Compiler rules are on, see Conventions)
npx expo install <package>  # add a dependency at an SDK-compatible version
```

Run `npm run typecheck`, `npm run lint`, and `npm test` before calling a change done.
Lint treats warnings as failures. The regression scripts check serving behavior, saving and
restoring, reading releases, and the scoped UUID dependency override; see "Verifying changes" below and `docs/dependency-health.md`.

### Deploying the web build (EAS Hosting)

The game is published at https://boba-shop.expo.app (Expo account `manhlong`, project
`@manhlong/boba-shop`, id in `app.json`). Pushes to `main` deploy automatically after checks pass;
see `docs/deployment.md`. To deploy locally:

```bash
npx expo export --platform web && npx eas-cli@latest deploy --prod
```

If `eas-cli` fails with `read ECONNRESET` on every request (it uses `node-fetch` over an IPv6 path
some networks reset), prefix the command: `NODE_OPTIONS="--dns-result-order=ipv4first" npx eas-cli@latest deploy --prod`.

`eas-cli` needs `npx eas-cli@latest login` on a new machine. `app.json` uses `web.output: "single"`;
`public/index.html` is the web page template (sets `lang="vi"`).

### Playing on a phone, and the app routes that were ruled out

The phone story is the web page: open https://boba-shop.expo.app in the browser, or add it to the
home screen. There are also real app builds now — `.github/workflows/build-apps.yml` publishes an
`.apk` and an unsigned `.ipa` to a GitHub release, and an installed build offers its own updates
(see "Updating itself"). The routes to a *store* build were each tried and dropped, and are worth
not re-litigating:

- **Expo Go** (publish with `eas update`, hand out one link) is dead on the current client. Expo Go
  57.0.9 cannot launch EAS Updates at all: every runtime string (`exposdk:57.0.0`, `exposdk:57.0.9`,
  bare `57.0.0`), a manifest with `sdkVersion` pinned to the client's own build number, and the
  `exp://u.expo.dev/update/<id>` link form all died with `IOException: Failed to download remote
  update`, while the published update itself was provably intact (manifest `200`, all 84 assets
  downloadable with the `assetRequestHeaders` tokens). The fault is inside the client — it filters
  updates with `sdkVersions.contains(manifest.getExpoGoSDKVersion())` — and the fix (expo/expo#46944)
  had not shipped as of October 2026. **A standalone build is not affected by any of this**, and
  EAS Update is exactly how the installed apps keep themselves current; see "Updating itself".
- **A standalone build** is fine on Android (EAS generates the keystore; nothing to sign up for) but
  iOS needs a paid Apple Developer account for any private route, ad-hoc or TestFlight.
- **The stores' private channels** — Play internal testing (100 testers by email, $25 once) and
  TestFlight internal (100 App Store Connect users, $99/yr) — are the clean answer if that money is
  ever worth spending. Neither needs a public listing or a review.

### The page is a game surface, not a document

`public/index.html` refuses the browser behaviours that a game's holds and drags would otherwise
trigger: the iOS share sheet on a long-pressed image, the selection magnifier on a long-pressed
label, the Android long-press context menu, double-tap and pinch zoom, image dragging, and Safari's
rubber-band / pull-to-refresh.

Two details make it work:

- The selection rules carry `!important`. React Native Web styles its elements with single-class
  rules, which out-rank a bare `*` selector.
- `img { pointer-events: none }` is the one that stops the iOS image menu. RNW lays an invisible
  `<img>` over every picture on purpose — its own source comments it as *"Accessibility image allows
  users to trigger the browser's image context menu"* — so the gesture has to be let through to the
  `View` underneath, which is what owns it.

`touch-action` stays at `manipulation` rather than `none`: `none` would kill the page pager's swipe
along with the zoom.

## Architecture

```
App.tsx                 fonts (Baloo 2), useReducer game state, phase switching + fade transition
src/game/               pure game logic, no React
  reducer.ts            GameState + CupBuild, actions (START_DAY, TICK, TAKE_ORDER, POUR, SCOOP,
                        ICE_SCOOP, SUGAR_PUMP, SERVE, CLEAR_CUP, SET_MODE…), scoring
  levels.ts             getDayConfig(day): unlock schedule, order/serve patience, spawn rate; describeUnlocks
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories,
                        and the hands-on constants (POUR_RATE, DEFAULT_ID…)
  orders.ts             random order generation, price, evaluateDrink (perfect/close/wrong)
  customers.ts          random customer looks (hair, skin, shirt, accessory) and names
  random.ts             seeded RNG; the seed lives in state so the reducer stays pure
  money.ts              formatMoney: 1 game unit = 10.000 ₫, shown as "10k" / "3.180k"
  save.ts               serialize/validate a GameState for storage; see "Saving the shop"
src/updates/            useUpdate.ts: ask EAS Update once a launch, download and restart into it;
                        see "Updating itself"
src/screens/            LoadingScreen (the wait while the artwork comes in), TitleScreen,
                        DayEndScreen, and the in-play screens:
  GameScreen.tsx        orchestrator: HUD, the two-page swipe pager + tab indicator, effects/opening/pause overlays
  CounterPage.tsx       page 1 — the customer stage (take orders here)
  PrepPage.tsx          page 2 — the KitchenStation (the room you work in) edge to edge, plus
                        serve/clear. The orders hang inside the room, not above it.
src/components/         Cup (layered, animated), CustomerStage, OrderBubble, KitchenStation,
                        Hud, Effects (coins/confetti/toss), OpeningSign, SettingsSheet…
src/components/art/     SVG illustrations: Character, IngredientIcon, ShopBackdrop (customer wall),
                        KitchenRoom (the prep room: one painted plate, plus the transform
                        everything in the room is placed through; exports the SHOP palette),
                        kitchenArt.ts (the painted kitchen sprites + their geometry),
                        Counter, CounterTop, Tiles, ToppingShelf
src/assets/kitchen/     the painted sprites themselves — generated, see "The kitchen's artwork"
tools/                  cut-sheets.py: cuts the asset sheets into those sprites
                        cut-tea-jars.ps1: a whole dispenser per tea, off the kitchen sheet
                        cut-cup-design.ps1: the cup and its drink, off the cup design
                        cut-tea-front.ps1: the tea window's greenery, back out of its own plate
                        cut-cup-holder.py: the holder under the cup, out of the kitchen painting
src/motion.ts           shared animation timings/easings
src/theme.ts            colours and font family names
src/useSavedGame.ts     Async Storage read on launch, slow write while playing
src/useArtwork.ts       pulls the painted sprites in before the shop opens; see "Opening the shop"
tools/check-drawing.cjs reads the SVG for the three things a phone draws differently
tools/stamp-build.cjs   writes the CI run number into app.json as versionCode/buildNumber
```

### Saving the shop

The game is picked up and put down mid-shift, so **the whole `GameState` is saved**, not just which
day was reached: reopening puts you back in the same minute of the same day, with the same customers
waiting, the same half-built cup on the coaster and the same takings. `GameState` is already a plain
serializable value, which is what makes this cheap.

`src/game/save.ts` owns the format and `src/useSavedGame.ts` owns the store. Five decisions worth
not re-litigating:

- **The store is Async Storage.** The game ships on the web, where it is `localStorage` and needs no
  configuration, and it is bundled into Expo Go, so a phone still needs no development build.
  `expo-sqlite/kv-store` is the Expo-made drop-in alternative and was passed over: its web support
  is alpha and wants a wasm Metro config plus `Cross-Origin-Embedder-Policy` /
  `Cross-Origin-Opener-Policy` headers on the host, which is a lot of setup for a few kB of JSON.
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
  the menu overwrites the save with a `title` state, which is how a run is abandoned — there is no
  separate "clear save".
- **The seed is validated as any integer, not an int32.** A new shop is seeded off the clock
  (`createInitialState(Date.now())`) and `START_DAY` hands that seed straight on; only the first
  `TICK` reduces it to the RNG's own 32-bit state, and the tick loop is held by the opening sign.
  Bounding it to an int32 discarded every save from launch until that sign was dismissed.
- **Storage failures are reported, never swallowed.** A store that cannot be read is
  indistinguishable from a first launch and a rejected write is invisible, so both warn — the silence
  is what hid the seed bug on a native build, where the shop simply never came back.
- **A read that *fails* is not a shop that isn't there, and it must never be written over.** The
  read is retried (three times, backing off), and if it still fails the game opens a new shop and
  `useSaveGame` is handed `writable: false`, so nothing is stored for the rest of that launch. This
  is the one that cost a player their week: a moment's trouble reading the store looked exactly
  like a first launch, the game opened a fresh shop, and the two-second writer committed it over a
  save that was sitting there intact. Playing a session that will not be kept is the cheaper
  failure, and the next launch gets the real shop back.
- **A save that cannot be parsed is set aside, not deleted.** It is still thrown away rather than
  patched — a fresh shop is a better failure than a half-restored one — but the bytes go to
  `boba-shop.save.v1.broken` first. Nothing reads that key; it is there so that a validator the
  format has outgrown costs a diagnosis instead of a week.
- **Writes go one at a time.** The slow timer and the flush on the way out overlap easily and
  `setItem` makes no promise about which lands last, so they are chained. An older shift settling
  on top of a newer one is indistinguishable, from the player's side, from the game losing a day.
- **A field that is merely new is migrated, not discarded.** `SAVE_VERSION` is the switch that
  throws a save away on sight, and it is for a save this build genuinely cannot read — not for one
  it knows how to finish reading. `money` is the worked example: it is optional in `SavedGame`, and
  a save written before the till opens with today's takings in it. Bumping the version instead
  would have wiped every shop in existence to gain a tidier format, which is the same trade this
  whole section exists to refuse.
- **Everything read back is validated, and a save that doesn't check out is thrown away** rather
  than patched; a fresh shop is a better failure than a half-restored one. On the web the save sits
  in `localStorage`, where it can be edited, and a save from an older build can name an ingredient
  that no longer exists. Ingredient *names* are checked against the catalogue; whether the day still
  *offers* them is not, so a retuned unlock schedule leaves one customer asking for a tea that isn't
  on the shelf rather than wiping the save. `cup.ice` and `cup.sweetness` are re-derived from the
  build's scoops and pumps instead of being trusted, since the reducer treats those as the same fact.

The writer is on a **2 s timer**, not on every state change — a day ticks ten times a second — and
flushes when `AppState` leaves `active`, on the web's `pagehide` (closing a tab doesn't reliably
raise a visibility change), and on unmount. The most a crash can cost is the last couple of seconds.

`tools/check-save.cjs` covers the round trip, the two non-playing phases, the saves that must be
refused and the ones that are tidied up instead.

### Opening the shop

The painted kitchen is about five megabytes of sprites, and nothing used to ask for them until
something drew them: the first swipe to the prep page landed on a room that filled itself in, and
the first scoop of each topping stuttered while its sprite decoded. A shift is two minutes long and
every one of those stutters landed inside one, so the wait is taken up front instead.

`src/useArtwork.ts` pulls in `PRELOAD` from `kitchenArt.ts` — two steps per sprite, because they
are different jobs: `downloadAsync` puts the file where it can be read (on a phone it is already
there; over the dev server or on the web it has to come down) and `Image.prefetch` is what decodes
it. `App.tsx` holds `LoadingScreen` up until the fonts, the saved shop and the artwork are all in,
and the bar is weighted the way the wait actually falls — the artwork is nearly all of it.

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

The cost falls on the web, where the art is a real download — a cold first visit now waits several
seconds on the loading screen instead of opening the menu at once and filling the kitchen in later.
A repeat visit is cached, and on a phone the sprites are already in the app, so it only decodes.

### Updating itself

The shop is handed out as files rather than through a store, so nothing tells a player a new build
exists — the game asks, on **every launch**, and the player decides. `src/updates/useUpdate.ts`
does the asking and `src/components/UpdateDialog.tsx` is the card it puts up.

**It is EAS Update, not a new file.** A published update is the JavaScript and the artwork, a few
hundred kilobytes, swapped in place; the app restarts itself and that is the whole install. Both
platforms, no reinstall, no permission. This replaced reading the repository's GitHub releases and
handing the `.apk` to Android's package installer — a 95 MB download, `REQUEST_INSTALL_PACKAGES`,
and nothing at all for iOS, which cannot install an `.ipa` from inside an app. (The EAS Update
route that is ruled out under "Playing on a phone" is **Expo Go**, whose client cannot launch
updates at all. A standalone build is a different thing and this is the supported path for it.)

Five parts, and the first is the one that bites:

- **The runtime version is the app version** (`runtimeVersion: { policy: "appVersion" }`), and an
  update carries **no native code**. So adding or removing a native dependency without bumping
  `expo.version` publishes an update to apps whose native side cannot run it, and the player gets a
  crash. Nothing in the toolchain notices — it typechecks, it lints, it runs in a browser — so
  `tools/check-updates.cjs` holds the native dependency list and the version it was recorded at,
  and fails when they drift apart. When it fails: bump `expo.version`, re-record `BUILT` in that
  file, and run **Build apps** before pushing. It matches on *names*, which is the case that
  always crashes; **upgrading** a native package is usually survivable but wants the same
  treatment, and nothing will tell you.
- **The player is asked, never updated behind.** `checkAutomatically` is `NEVER` in `app.json`, so
  the library downloads nothing on its own; the game checks once per launch and the dialog decides.
  The default (`ON_LOAD`) would fetch an update quietly and swap it in on the next launch, which is
  precisely the "it changed under me" this is meant to avoid.
- **The dialog is over every screen**, not a card on the menu, because the question comes up once a
  launch wherever the player happens to be. It is held back while a shift is actually running
  (`phase === 'playing' && !paused`) so an unasked-for question cannot drain three patience timers
  while it is read — at launch the day is always either not started or paused, so in practice it
  shows immediately. "Để sau" puts it away until the game is opened again.
- **The save is flushed and awaited before the restart.** `useSaveGame` returns its flush for this
  one caller: `reloadAsync()` replaces the process, and a write still in flight when it goes is a
  lost shift.
- **Both halves of installing one are on a deadline, and the card can always be left.** The dialog
  covers the screen and takes every touch, and while it downloads or restarts there is nothing on
  it to press, so anything that does not finish leaves the player holding a picture of a boba shop
  — a complete freeze, on a real build only, which is why a browser will never show it to you.
  `fetchUpdateAsync` has no timeout of its own and a stalled download never settles, so it gets 60
  seconds; `reloadAsync` replaces the process and therefore *cannot* resolve if it worked, so
  still being here 15 seconds later is itself the error. Either one failing lands on `failed`,
  which has a button. The downloading state has a "Để sau" as well.
- **The channel is set in `app.json`**, as `updates.requestHeaders['expo-channel-name']`, not in
  `eas.json`. The `.apk` is built by EAS Build but the `.ipa` is archived by the workflow itself,
  which would get no channel from a build profile; set here, every build asks for the same one
  whoever built it. It is applied at prebuild, so this only works because the project is CNG.

**Publishing is part of "Deploy web"**: the same push that redeploys the page publishes the update,
so the page and the apps are never running different games. It is skipped when a commit touches
nothing the app is made of — otherwise a docs-only push would put a dialog in front of a player for
nothing.

`tools/stamp-build.cjs` still runs before each build, but only for `android.versionCode` and
`ios.buildNumber` — a newer `.apk` has to install over an older one. It deliberately leaves
`version` alone, because that is the runtime version: a build that stamped it would stop matching
the updates published for it.

**What still needs a new file**, and there is no way around it: anything native. New native
dependency, new Expo SDK, a config plugin that changes the manifest. That is what the version bump
and a fresh **Build apps** run are for.

The menu **scrolls** (`flexGrow` keeps the spread-out layout wherever there is room). It has no
vertical slack — on a 375x667 phone the logo was already sliding under the awning before anything
was put above the card — so nothing that only sometimes appears may crop the shop's own name.

### What the game's clock is allowed to redraw

A shift ticks every `TICK_MS` and each tick is a new `GameState`, so **every tick is a render of
both pages**. On a phone that is the most expensive repeating thing in the app, and it used to
reach everything: `KitchenStation` was not memoized and the object of shared props it spread into
the equipment was rebuilt every time, so six dispensers, six topping containers, the ice machine,
the bottles, their contact shadows and the cup were all reconciled ten times a second — on the
same JavaScript thread that the drag gestures are delivered on. That is why dragging and panning
stuttered on a phone and felt fine in a browser, where there is a JIT and no bridge. Four rules
keep it out:

- **`KitchenStation` is memoized, and every prop it takes has to stay the same between ticks.**
  Adding one that doesn't — an object or arrow function built in `PrepPage`'s body — silently puts
  the whole cascade back, and nothing will fail. The same goes for the `shared` object inside it
  and the `carry` handle `useCarry` returns, which is why `node` is returned *beside* that handle
  rather than on it: the element is new every render, and the equipment must not see it.
- **`tick` hands back the same `slots`, `feedback` and `departures` arrays when nothing in them
  moved** (`unchanged`). Almost every tick changes nothing but the clock, and a fresh copy told
  every list on both screens it had new contents to draw.
- **`patienceLeft` is rounded to a fiftieth.** It is drawn as a 20px ring and a 26px heart, where
  that is half a pixel, and the raw fraction rebuilt both of them on every tick for every customer
  on the counter.
- **`TICK_MS` is how often the shop is redrawn, not how accurately it runs.** Every rule is
  written against the measured `dt`, so this number is free to be as slow as the slowest thing on
  screen can stand — and after the two rules above, nothing clock-driven can show the difference.

### Hands are emptied when the game is put down

A gesture here ends when the finger lifts (see `GRABBY`), and backgrounding the app takes the
finger away without lifting it: Android ends the touch as the window loses focus and makes no
promise of delivering a terminate to the responder, which has in any case refused to hand the
gesture to anyone who might have cleaned up after it. So `KitchenStation` watches `AppState` and,
on the way out, cancels the carry, stands the cup down, clears `dragging`, and bumps the `abort`
its dispensers pass to `useHoldPour`.

None of that is cosmetic. `interacting` is what holds the room still while something is carried
and the pager is frozen for the same reason, so a drag that never ended left the prep page a
picture: the wall would not pan, the swipe back to the counter did nothing, and a scoop was stuck
to the middle of the screen. It looked exactly like the app hanging, and it was reported as that.
The pour is the worst of the three to leave running, because `onCommit` measures how long the tap
was held off the wall clock — a tap still open when the game was put down would tip however long
the player was away into the cup and ruin a drink they never touched, so what had run is
discarded rather than committed.

### The two pages (swipe navigation)
`GameScreen` keeps the reducer state, the tick loop, haptics and the `measureInWindow` refs, and hosts a
horizontal `pagingEnabled` `ScrollView` with `CounterPage` (left) and `PrepPage` (right). The `PageTabs`
indicator under the HUD highlights the active page and badges each side (Quầy = # waiting to order,
Pha chế = # tickets to make); tapping a tab scrolls the pager (swiping is the primary gesture). Because
`PrepPage` is off-screen until swiped to, it re-measures its machine/bin positions when the parent bumps
its `measureToken` on scroll-settle, and reports them up via `onGeometry` for the effects overlay.

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

- **The till survives going back to the menu.** `GO_TO_TITLE` only changes the phase and
  `START_DAY` carries `money` through `buildDay`, so abandoning a run and starting again at day 1
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

### Game modes

`GameState.mode` (`standard` | `relaxed`) says how the shop is run, and it is the one setting the game
has. **Standard** is the whole job as described above. **Relaxed** ("Tự động nhận order") does two
things in `tick()`: a customer arrives already `ordered` (`orderedAt: clock`, so the serve timer starts
at once and the order-taking patience never applies), and `nextSpawnAt` is left at `clock`, so the next
customer walks in as soon as a spot is free rather than after `spawnMin/MaxMs`. The only gap left is
the 1.3 s `DEPARTURE_MS` the leaving customer needs to walk off their spot.

The mode lives in game state, not in a React context or storage: `SET_MODE` can be sent at any time,
`START_DAY` carries it over to the next day, and switching *to* relaxed mid-day also takes the order of
anyone still `requesting` (nobody is coming to take it by hand any more) and pulls the next arrival
forward. It rides along in the save, so the mode a shop was last run in is the one it reopens in
(see "Saving the shop").

`SettingsSheet` is the card that sets it, opened from the title screen's "⚙️ Cài đặt" button and from
the pause menu, so it can be changed between days or in the middle of one. The day-1 instructions on
both the title screen and the opening sign change their first line to match the mode.

The two pages share one shop's palette — warm wood, cream tile and the shop's pink — so swiping feels
like turning around inside it. The Counter uses `ShopBackdrop`; the kitchen is `KitchenRoom`, drawn by
`KitchenStation` itself (it needs the same shelf lines the layout computes) and themed from the `SHOP`
palette it exports.

**The drink is made by hand, not picked from a list.** `KitchenStation`
(`src/components/KitchenStation.tsx`) is a room, not a menu, and **the cup is a physical object you drag
around it** (`PanResponder`; the pager is frozen via `onDragging` while you hold it).
`layoutKitchen(config, w, h)` places everything absolutely, **on the surfaces the painting already
has** (`LEVELS`): the tea dispensers in the open shelf across the top, the toppings in their stand
in the tiled alcove, the ice/sugar/milk/foam on the bench nearer the viewer, and the cup on its
coaster through the middle of the work top. Each dispenser gets a **dock**: the spot the cup is held
while that tap runs into it, just under its shelf.
Dropping the cup still standing on the work top sends it home.

- **Tea tanks are anchored to the panoramic background's second rack on the left.**
  `ROOM_BG_TEA_SHELF` gives the shelf coordinates in `kitchen-background.png`; `fitBackground`
  projects both the image and tanks at the same scale. Tanks are children of the background's
  ScrollView content, so they remain rigidly attached to the shelf. `panOffset` is only used for
  hit testing and positioning the cup/stream, never for moving the tank graphics. Start at the left shelf, with available
  teas growing from left to right along the top shelf and then down to the second, in six fixed
  slots that are the catalogue's own order — so the week unlocks them across the rack and down. The new transparent `tea-tank.png` frame
  supplies the dark lid, glass highlights and lever tap. Shaded tea is rendered behind it and
  `TeaTankMount` supplies a static metal shelf bracket with bolted end plates, a beveled rail,
  bent cradle arms and a contact shadow, behind the tank's lower collar and clear of its tap.
  each tank has its own Vietnamese name tag above the lid, keeping the chamber clear. The tank
  frame is memoized and does not scale, dim, or change opacity when the cup is carried around it. Toppings also share the panorama; the remaining equipment keeps its existing art and layout.
- **Pour directly in the room.** Drag the cup under a visible tank and release to snap beneath
  its spout. The cup scales to the shelf gap and its base rests on the lowest shelf surface,
  with a small contact shadow; picking it up restores its carrying size. `findStation` tests that particular tap in screen coordinates, including the pan
  offset. Hold its tap (`useHoldPour`) to raise the live liquid level; releasing commits the
  amount and leaves the cup docked, ready for another pour. Drag the cup away to undock it.
  A tank cannot pour until the cup is docked beneath it, and a cup holding a different tea locks
  that tank. Panning returns
  a docked cup to its holder; scrolling is frozen during cup/tool dragging or pouring.
  `Stream` draws behind and in front of the cup, split at its scaled lip, with moving highlights
  and a trailing drop on release. `Spill` shows overflow.
  The removed tea-station dialog is no longer part of the game.
- **A small horizontal meter floats beneath the order bubble** while the cup is docked.
  It is a 220×20px overlay, with no separate panel, idle placeholder or reserved scene space.
  `KitchenStation` reports its live shared level to `PrepPage`; the room and taps keep their
  geometry when the bar appears. The order panel stays fixed; the bar floats at the top of the
  room, clear of it.
  Quarter marks and an inline Cạn / Ít / Nửa ly / Gần đầy / Đầy label show the current fill,
  without percentages or a serving target. The gauge fills smoothly from left to right;
  overflow displays Tràn ly! and turns the track border pink. The bar passes all touches through.
  Its animated width uses the cup's `pourLevel` mapping against an inner track, so a full cup
  covers the entire bar without a measured-width scale transform. The bright front of the fill
  fades out over the last few percent: it is the liquid's leading edge, and held on to the end it
  sat between the fill and the track's rounded cap, where it read as a gap the bar never closed.
  **The label's bands are not the quarters the marks are drawn at.** It used to be
  `floor(level * 4)`, which called a cup a quarter full "Cạn" — dry — and only ever said "Đầy" at
  exactly 1, so a held tap ran from "Gần đầy" straight to "Tràn ly!" without passing through full.
  The bands are their own list in `PourFeedback`, and "Đầy" covers the last eighth, where the cup
  is drawn brim-full.
  Band accessibility updates use `useAnimatedReaction`, with no JS polling.
  There is no minimum amount required to serve and no fill-based tip bonus. Overflow still marks
  a messy drink. The cup and its holder remain horizontally centered at rest.
- **Toppings stand in upright glass containers in the middle cabinet**, three across in two
  rows, to the left of the syrup recess. `ROOM_BG_TOPPING_SHELF` measures their positions in
  `kitchen-background.png`; `fitBackground` projects them at the painting's scale. Containers,
  empty slots and each container's cream nameplate are children of the same background
  ScrollView as the tea tanks, so they remain attached while panning. Each available topping
  carries a compact, single-line Vietnamese name on its lid, clear of the ingredients.
  Fixed slots are the catalogue's own order, read like a page: left to right along the back row,
  then the next row forward. The week therefore fills the tray from its back-left corner.
  Each pan carries its name on a small cream card clipped to its near lip, the one band of steel
  the ingredients never reach over (`TOPPING_TAG` in `toppingArt.ts` places it, and the card is
  kept inside its own pan so nine of them never touch). Unlock order stays unchanged; `TOPPING_BOX_EMPTY` fills unavailable
  slots, while `TOPPING_BOX[id]` draws an available container. New sprites are extracted from
  `tools/sheets/topping-shelf-boxes.png` by `tools/cut-topping-boxes.py`; the prompt and workflow
  are in `tools/topping-station-prompt.md`. Legacy `BIN` assets are retained for older art.
  The whole container is a touch target. Grabbing one names it on the hint line and lifts the
  existing painted `SCOOPFUL[id]`. `useCarryGesture` subtracts the panorama's current offset
  before starting the carried tool in screen coordinates; the background and pager freeze
  until release. Drop it on the centered cup to add it. Duplicate and topping-limit guards
  stay unchanged, and existing scoopfuls and cup pieces are reused.
- **Ice is available from day one.** The painted ice machine beneath the tea rack is the touch
  target, measured by `ROOM_BG_ICE_MACHINE`. It and its cream/pink “Đá” plaque live inside the
  panorama, so panning keeps the hit area and scoop origin attached to the machine.
  The machine itself is only the original background painting, with no drawer overlay or count.
  Drag into the cup once for ít đá, twice for đá
  thường; no scoop means không đá. The legacy ice-pan sprite is no longer rendered.
  The compact plaque sizes to its icon and text with 5 panorama pixels of padding on each side,
  without reducing the machine's touch target.
  `PIECE.ice` uses the blue `piece-ice-v2.png` in ingredient icons;
  `SCOOPFUL.ice` is a complete silver scoop with a pink grip and contained blue cubes.
  `CupIce` uses the separate neutral `CUP_ICE` sprite (`piece-ice-clear.png`) inside the drink.
  Twelve varied sizes/angles render from back to front; one scoop uses three cubes, two use
  twelve. Chunky 27–36-unit cube bodies are larger than topping pieces. Four exposed cubes
  sit across the surface with varied immersion, heights
  and tilts; the rest scatter below the surface with room between their centers,
  rather than putting every extra cube in the same narrow band at the surface. Fully submerged
  pieces have no surface contact ring.
  Existing cubes keep their positions when the second scoop is added. Dry ice rests
  on the ingredient bed; liquid raises it to the surface through shared animated SVG geometry.
  `createIceLayout(cupId)` varies the first scoop's floating tilts and samples scattered
  second-scoop placements once per cup, with different
  resting tilts, floating angles, and immersion depths. Samples too close after fitting the glass
  are retried; adding the second scoop keeps the first scoop in place. The seed keeps the layout stable
  through pours, game ticks and reloads, while fresh cups get different arrangements.
  **Where the ice is *now* is worked out once a frame, for the whole tray, by `useIcePlacements`**,
  which `KitchenCup` calls and both sides of the waterline share. Each cube appears four times over
  — drawn above the tea, drawn below it, its contact shadow and its meniscus — so leaving the fit
  inside each of those ran `cupIcePosition`, an eighteen-point fit of the painted outline against
  the tapered glass, forty-eight times a frame for twelve answers. It fits the whole `ICE_LAYOUT`
  rather than the cubes currently in the cup, so an index means the same thing however many scoops
  have gone in and a cube cannot mount off the end of an array that has not caught up with it.
  `cupIceRestPosition` fits the actual rounded cube outline to the curved floor; the first scoop
  touches that floor, while later pieces stack with varied overlap and small contact shadows.
  New cubes settle briefly, then tilt and spread as tea lifts them, without any looping motion.
  Rounded front, top and side faces render with distinct frosted blue-grey shading and dark
  outer edges, independent of the sprite's alpha. The clear painting contributes only subtle
  surface texture. White face seams and broad glints keep ice readable at phone scale in both
  tea and milk tea. The ice above the waterline is drawn **over** the cup's painted front wall
  rather than punched out of it, so the upper dry-pile cubes are as crisp as those on the floor
  while submerged ice keeps the glass wash. `KitchenCup` draws `CupIce` twice for this, once per
  side of the waterline (`layer="submerged"` then the wall then `layer="exposed"`), sharing one
  `createIceLayout`. It used to be a mask built out of `<Use>`d silhouettes, which is the one
  thing in this game that a browser drew and a phone could not — see "Drawing on a phone" below.
  Every cube is split by one shared `cupIceFillPath` **mask** and its even-odd complement; it is a
  mask and not a clip because it moves with the tea, and a clip would have stopped at the level the
  ice was added at. It uses the near
  arc of the same tea oval, while the tea's rear arc stays behind the crowns; contact strokes
  follow that near arc too. Projected depth
  affects cube placement only, so it cannot create a separate liquid level on each face.
  the submerged body is softened and tea/milk-tinted, with a small contact meniscus to anchor
  it to the surface. Cup ripples animate without moving its entire oval independently of the ice
  and glass. `cupIcePosition` seats each cube against the shared oval's front edge, varying its height
  with immersion and a small depth offset,
  without the former upper-height clamp that stopped later pours moving the ice. The live level
  is read unconditionally so every pour remains subscribed. Cubes stay inside the tapered cup
  by fitting their actual rotated outlines to the walls, and remain still on game-clock ticks.
  Their separate `CUP_ICE_WELL` clip allows crowns into the
  clear space below the lip, so a full cup does not trim them into a flat surface cap.
  Sources and built-in imagegen prompts are in `tools/ice-art-prompts.md`; repackage them with
  `python3 tools/cut-ice-art.py`, preserving the source transparency.
- **Everything else — carry it to the cup.** The topping bins, the ice machine, the syrup bottle, the milk
  cartons and the foam tubs are dragged: `useCarry` keeps what's in hand, draws the tool following the
  finger above everything else, and on release either tips it into the cup (`SCOOP` / `ICE_SCOOP` /
  `SUGAR_PUMP`, or `POUR` of `MILK_SPLASH` for a carton) or puts it back. The cup doesn't move for these —
  drop onto it wherever it stands. Syrup shows how many pumps went in on the machine itself.
  Milk takes room in the cup, so a cup filled to the brim with tea has nowhere to put it.
  **While the cup is docked under a tap, none of it can be picked up.** Every carried tool dims
  and answers a touch with `Ly đang ở dưới vòi … — kéo ly ra trước` rather than lifting — it still
  takes the touch, so the room does not pan out from under it. The cup is up at the shelf, nowhere
  near the bench, and a drop counts over the cup's *home* as well as over the cup itself: a scoop
  tipped onto the coaster it left behind went into a cup that was not there.

**Tea slots remain fixed across days**, filling the second rack from left to right. The tank art
is sized to the rack and available space below its spout, independently of the other equipment.
The remaining equipment keeps its existing bench scale and positions: rows can be swiped when they
overflow, while a vertical lift carries the tool. Each `Frame` applies the shared row offset to
its own touch target; the nonanimated row wrapper passes empty-space touches through to the
panorama and topping containers. `carry.cancel` puts a tool back when
the gesture becomes a swipe; row offsets are clamped when a new day changes the available equipment.

**All of this is the raw responder API (`GRABBY`), not `Pressable`**: a `Pressable` cancels its press when
the finger drifts or the browser decides it was a long-press, which cut pours short. These gestures end
only when the finger actually lifts, and the pager is frozen (`onDragging`) for the duration. Equipment
shows no "added ✓" badges — the order slip is the checklist; machines only dim when they're locked out.

A drink can be served once tea has been chosen by pouring any positive amount. Serving and tips
do not depend on a fill threshold. `Spill` shows overflow when the live level goes over the brim.
The docked cup casts a soft elliptical contact shadow matched to its narrow foot.

### Liquid and glass layers
`TeaLiquid` renders the kitchen liquid inside the tank's transparent chamber and the cup's traced
well. The existing glass sprites, linework, cat decal, ice, toppings and foam remain intact.
The cup's existing painted tea textures blend with opaque colour shading and depth gradients.
The cup's painted glass is split by depth: the inner-floor detail draws behind the contents;
the front wall reflections, rim and near base edge draw in front. This lets toppings naturally
occlude the rear base rings instead of having a bright oval painted over the pile. Both parts
reuse the original sprite. Glass opacity follows only actual tea fill (22% over the liquid);
adding toppings never switches glass opacity or changes its masks. The liquid wash likewise
follows only actual tea, with no artificial topping fill level.
The shared inner mask is inset from the painted wall highlights;
the surface follows its taper, and foam uses the same mask and live surface width.
Tank tea instead uses fully opaque vector shading with stronger color and depth; enlarged raster
textures no longer soften its chamber. The original tank glass and hardware remain intact. The surface
is a complete oval with the same perspective as the cup rim, narrowing with its tapered walls.
A painted meniscus, crescent highlight and curved reflection sit at its surface. Cup milk color blends with tea to give a
creamier tint. All liquid stays clipped inside the glass; the cup linework and decal draw last.

`CupToppings` reuses the painted `PIECE` sprites in seventeen smaller, staggered positions per
portion. Back pieces are smaller and softer, front pieces overlap them, and their feet follow
the cup's curved inner floor. `cupToppingPosition` fits the entire rotated sprite inside the
narrower inner-floor opening, with 2.5 sprite pixels of clearance from its walls and curved base.
The pile is packed towards the center so the clipping mask remains a containment safeguard,
not a way to crop oversized pieces. Contact shadows and a liquid-clipped colour wash make submerged
pieces belong to the tea; milk adds a stronger creamy wash. Each additional ingredient adds its
own portion behind the existing pile, preserving the first ingredient's positions. Deterministic
variation keeps pieces stable on clock ticks. A short `withTiming` fall settles a new portion;
ice, foam, the front glass reflections and the cat decal remain in front of the pile.

During pouring, two expanding surface ripples, small rising bubbles and shifting light reflections
respond to the stream. The tank's
surface responds gently. Loops run only while a tap is held and are canceled when it stops; surface
movement settles instead of keeping the kitchen in constant motion. `TankGraphic` is memoized so
unrelated cup gestures don't redraw its image or SVG. No tank frame transforms or locked-opacity
crossfades are applied.

Liquid geometry is a `useDerivedValue` shared directly by every animated SVG layer. Keep those
subscriptions explicit: hiding the level inside a plain helper closure made the surface update only
on the 100ms game-clock renders. Animated SVG hooks include dependencies for web support.
`KitchenCup` and `TeaLiquid` are memoized, and the station memoizes the preview drink so clock ticks
do not rebuild liquid mappers. Docking prepares the selected tea's textures at zero opacity before
the tap is opened, avoiding first-pour image decoding stutter.

`cupGeometry` shares the traced well and surface coordinates between the liquid, foam and stream.
`pourLevel` clamps the actual fill without adding an artificial minimum pool. The surface ellipse
is never sliced off by a flat-topped clip.

**A full cup is drawn full, at `CUP_SURFACE_TOP` — the brim, not the line the design paints.**
The design's full cup (`cut-cup-design.ps1`, `SURFACE_Y = 48`) is a drink made to be carried, with
a fifth of the glass left clear for its lid, and the well was traced to it. Taking that as the
game's brim made the meter lie: it ran to the end of its track, and then warned of tea going over
the side, while the glass plainly still had room in it. The surface now stops where the painted rim
stops it (y 36, its far edge reaching into the mouth of the cup), and `CUP_WELL` is carried up the
glass's own taper to meet it — so `CUP_RX_BOTTOM`/`CUP_RX_TOP` and `CUP_TAPER` are where the inside
of the glass is measured, and the oval, the floating ice and the ice well all read their widths off
that one line. The painted drink texture only has pixels from y 48 down; above it the body is the
vector gradient alone, which is why nothing in there may depend on the sprite to carry a shape.
The small horizontal meter floats beneath the order bubble, outside the cup and kitchen transforms.
The legacy `DRINK`, `DRINK_TOP` and jar assets remain in the repository.

### The kitchen's artwork
Nearly everything in the prep room is a **painted sprite**. `tools/cut-sheets.py` cuts
`tools/sheets/*.png` into `src/assets/kitchen/`; `tools/cut-topping-boxes.py` cuts the new
upright shelf containers. The generated sheet and prompt are kept in `tools/`.

[kitchenArt.ts](src/components/art/kitchenArt.ts) is the only place that names those files. The
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

- a **dispenser** uses the transparent `TEA_TANK` frame over `TeaLiquid`, blending the existing
  painted tea textures with shaded liquid, an oval surface and pour ripples. `JAR_TEA` retains
  the older complete jar sprites; the current shelf does not draw those;
- the **cup** is [KitchenCup](src/components/KitchenCup.tsx), drawn in its 113×174 sprite space:
  faint cool glass backing, then `TeaLiquid` inside the traced `CUP_WELL`, followed by clipped
  ice/toppings and foam, glass reflections, edge highlights and the cat decal.
  Its surface is an elliptical plane whose width follows the tapered glass. The stream and foam
  use the same fill coordinates. Nothing can escape the glass because it stays inside the clip;
- a **scoop of topping** is one whole painted sprite, `SCOOPFUL[id]`, heap and all. It used to be
  the bare `SCOOP` with pieces laid into its bowl by hand, which was the same mistake the teas
  were — the design draws what a scoop of this looks like, so take its word for it. The six are
  drawn to a common **height**, because the scoop is identical in all of them and only what mounds
  over the bowl differs; matched on width instead, a heaped one shrinks beside a flat one.
  Ice uses its own complete `SCOOPFUL.ice` painting. Foam takes the bare `SCOOP` with a blob
  drawn in its bowl;
- the **cartons, syrup, foam tubs and every fitting** (wall, lamps, shelf, steel counter,
  cabinets, rail, coaster, plant, poster, cup stack, towel) are whole sprites
  that [KitchenRoom](src/components/art/KitchenRoom.tsx) and the station place by the layout's
  lines;
- **the room itself is one painted plate**, `room-bg.png` — the tiled wall and its lamps, the
  dispenser shelf, the fridge, the work top, the bench and the pink units at its foot, all of
  it painted rather than assembled. It used to be assembled: a wall tile set to repeat, a shelf
  plank and a stainless counter each sliced into bands and stretched across the room, a run of
  cabinet fronts, a group of props cut out of the mockup — every one of them a line to compute
  and a seam to get wrong. Those sprites are still cut (a station may yet want the stainless),
  but the room no longer draws any of them. Each piece of equipment now sits in a contact
  shadow of its own (`Frame`), because there is no well in a counter to sink it into.
  The active topping cabinet is measured in the panoramic background by
  `ROOM_BG_TOPPING_SHELF`. The portrait plate and `ROOM.tray` remain legacy geometry.

**The prep page is all kitchen.** There is no ticket rail, and no row of shortcut buttons for
walking to a station — the room fills everything between the order panel and the action buttons,
which is what gives the equipment the size it has in the reference. The wall is reached by
swiping it, which is the same gesture everything else in the room is worked with; the buttons
that jumped the view to the tea, milk and topping ends of it were a second way to do one thing,
and they cost the room a band the height of a dispenser.

### The order, spoken back
[OrderBubble.tsx](src/components/OrderBubble.tsx) is the **panel docked across the top of the
prep page** (it was a paper note clipped to a rail inside the room, then a bubble floating over
it): who the drink is for, what it is called, how far along it is, and a tile for every thing that
goes in it, each ticking off as the cup comes together. The heart beside the name is the
customer's patience, emptying from the top and turning amber then red. A 40px portrait, a 17px
title, tiles up to 32px and a progress bar under the name; the empty state keeps the same box and
centres a one-line prompt in it.

Five things about it are deliberate:

- it lists the drink in `SPOKEN` order — tea, milk, sugar, ice, toppings, foam — not `BUILD_ORDER`,
  which runs bottom of the cup upwards. The card is read, not built;
- the tiles stand together at one size and the row runs out from the left. Sharing the card's whole
  width between them leaves a two-thing order as two tiles marooned at either end;
- **its height is fixed** (`ORDER_PANEL_HEIGHT`). The kitchen is laid out from whatever height is
  left under it, so a panel that grew a row when an order was picked would move every dispenser,
  every topping box and the cup with it;
- **the other taken orders stand inside it**, in a queue to the right of the heart — tap one to
  make it next. They used to hang off the card's bottom-right corner, over the room, where a
  seven-thing order had its last two ingredients covered by them;
- the patience heart is emptied by a **`<Mask>`, not a `<ClipPath>`**, because a `View` cannot be
  heart-shaped and a clip path is frozen at its first draw on Android — the heart would have
  stayed as full as the frame it first appeared on. See "Drawing on a phone"; `check-drawing.cjs`
  only catches the animated case, and this one is driven by ordinary renders.

The card itself takes no touches (`box-none`); only the queue portraits are live.

`drinkName` puts "sữa" where Vietnamese puts it, which is not the same place every time: "Trà Thái"
becomes "Trà sữa Thái", "Hồng trà" becomes "Hồng trà sữa".

### Standing things on a painting
The plate is `tools/sheets/room-bg.png`, 941x1672, and `ROOM` in
[kitchenArt.ts](src/components/art/kitchenArt.ts) is **where it draws its surfaces, in its own
pixels**: the shelf's board, the ceiling over it and the face of the board above that (where its
sign is mounted), the ledge, the line a cup stands on along the work top, the bench, the cabinets. Nothing in the room is a fraction of the phone any more —
`fitRoom(w, h)` gives the `px`/`py` that take plate pixels to room pixels, and a dispenser is on
the shelf the painting paints however the phone is shaped.

`fitRoom` deliberately does **not** use `resizeMode="cover"`. Cover centres the image on itself,
and a phone shorter than the painting then loses the work top off the bottom; this centres on
the working band instead (`KEEP`, the shelf down to the bench) and lets the ceiling and the
floor be what goes. Anything that must stay reachable in a short room has to clamp itself into
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

- **Vietnamese UI text** everywhere, including accessibility labels. Money always goes through
  `formatMoney`.
- **Calm motion** (the user asked for this explicitly): use `withTiming` with the helpers in
  `src/motion.ts`. No springs/bounce, no shaking, no looping movement near the play area. The
  only loops are the slow window clouds and the faint tea-surface shimmer. Keep it that way
  unless asked.
- The opening sign at the start of each day closes **only** via its "Bắt đầu" button (no timer,
  no tap-outside).
- Play is split across two swipeable pages (Counter / Prep); the HUD and the tab indicator stay fixed
  above the pager. Keep swipe as the primary navigation (the tabs are a tappable shortcut).
- React Compiler lint rules (eslint-plugin-react-hooks v7) are enforced:
  - in event handlers/callbacks write shared values with `sv.set(...)`, not `sv.value = ...`;
  - don't call `setState` synchronously inside `useEffect` (do it in a timer/callback, or use
    the "adjust state during render" pattern as in `App.tsx` and `useChangeCount` in `Cup.tsx`);
  - no `Math.random()` during render (use the deterministic `noise()` in `Effects.tsx`);
  - don't read refs during render.
- **Drawing on a phone, not in a browser.** `react-native-svg` is not an SVG renderer with a
  React wrapper — it is three renderers, and the web one is the forgiving one. Four gaps have
  already cost a crash, a dead animation, a drink that stopped following its tea and a tray of
  topping pans that would not close up, and every one of them is easy to walk back into.
  `tools/check-drawing.cjs` (in `npm test`) reads the source for all four, because nothing else
  will:
  - **An animated `transform` has to be the array form** — `[{ translateX }, { translateY },
    { rotate: '12deg' }]` — never the SVG string `translate(…) rotate(…)`. The string is turned
    into the `matrix` prop a phone reads by JavaScript, *inside* the element, and an animated prop
    goes straight to the view without passing through it — so a string written by a worklet is
    dropped in silence and the thing never moves. Static transforms are fine either way: they do
    go through the element. A **clip** cannot take even the array form, because a clip is a path:
    give it a path already drawn where it belongs, as `cupIceOutlinePath` does.
  - **A `<ClipPath>` is drawn once and then frozen, so anything that moves is a `<Mask>`.**
    Android builds a clip path's geometry the first time it is used and caches it, and nothing
    inside one can clear that cache: the renderer skips invalidation for any element that has not
    been drawn, and a `<Path>` inside a `<ClipPath>` is never drawn. An animated `d` in there
    therefore arrives in the browser and on iOS and is simply dropped on Android, where the clip
    keeps the shape it had on the frame it first appeared. A **mask's** contents *are* drawn, every
    frame, so an animated `d` inside one lands everywhere — which is why the tea's edge, the glass's
    wet and clear halves, the waterline the ice is split at and the wash on the toppings are all
    masks. Fixed boundaries (`CUP_WELL`, `CUP_ICE_WELL`, the cube's own silhouette) stay clips,
    which are cheaper. Mask contents are filled `#FFFFFF`, and `fillRule="evenodd"` on the path
    itself is read by all three renderers — a clip instead took its rule from whatever referenced
    it, and the platforms disagreed about the default.
  - **An atlas cell is drawn through an SVG viewport, not an oversized `<Image>` in an
    `overflow: hidden` box.** That box is clipped correctly and its CSS reads correctly, but
    Chrome keeps one raster per element for the background and, for cells near the sheet's left
    edge, paints the wrong slice of it: the black pearls pan came out orange and the taro
    dispenser amber, on the *web* build, from a cold load, until something forced the element to
    repaint. This is the one gap that runs the other way — a phone drew it correctly and a
    browser did not — so the only honest check is a screenshot of the exported build.
  - **A 4x4 matrix is not a transform a phone will perform.** Only two of the three renderers do
    a projective transform: React Native hands Android's `View` the matrix through
    `MatrixMathHelper.decomposeMatrix`, which gives it back as `setTranslation`, `setRotation`,
    `setScale` and a camera distance. A `View` has no `setSkew`, and a perspective divide is not a
    camera distance, so both are dropped — the topping pans came out too small and in the wrong
    place, which on a tray reads as a gap between every pan and the next. The pans are drawn as a
    stack of horizontal bands instead (`toppingPanBands`): plain numbers and plain rectangles,
    which all three renderers agree about. `toppingPanMatrix` is still the fit; it is what the
    bands are read off, and what `check-topping-layout.cjs` holds them to.
  - **`<Use>` is not safe.** Asked for the path of a template it cannot find at that moment, it
    hands back nothing — which Android calls a method on and iOS passes to `CFAutorelease`. Draw
    the shape where it is needed, even when that means repeating it.
  None of them shows up in a browser, in `tsc`, or in the lint, and there is no emulator here: the
  only honest check on anything new is a build on a real phone.
- **What a group costs.** The four gaps above are things a phone draws *wrong*. These two it draws
  correctly and ruinously slowly, which is the same bug with a longer fuse — and a desktop browser
  will never show you either, because it has a GPU compositor where `react-native-svg` has
  `android.graphics.Canvas`. Read `GroupView.java` and `RenderableView.java` before arguing:
  - **A `<G>` whose opacity is not 1 allocates a bitmap the size of the whole canvas, throws it
    away, and allocates it again — on every draw.** That is `GroupView.drawGroup`, and nothing
    caches it. The fade belongs on the leaves instead, which cost nothing; that is only a different
    picture where the leaves overlap, so it is a judgement each time. The cup's toppings were
    seventeen faded groups per portion and three portions deep, which is fifty-one canvas-sized
    bitmaps allocated and freed every frame, and it is most of why a finished drink stuttered on a
    phone. Submerged ice keeps *one* group fade, because its cubes genuinely do overlap.
  - **A masked element costs four canvas-sized offscreen layers (`saveLayer`) and draws the mask's
    own contents twice** — once through `luminanceToAlpha` and once for its alpha. So masks are for
    boundaries that *move*, where the rule above forbids a clip, and there should be as few as the
    picture allows. Where a moving boundary can be turned inside out — drawing the boundary and
    clipping it to the static shape, rather than drawing the shape and masking it to the boundary —
    that is the same picture for a canvas clip instead of four layers, and it is what `CupToppings`
    does for the tea wash on each piece.
  Nothing checks either of these; `check-drawing.cjs` is about pictures that come out wrong. The
  honest measurement is still a phone, and what a browser *can* prove is that a change made for a
  phone left the web alone — export before and after and diff the cup, as "Verifying changes" says.
- Reanimated 4 + `react-native-worklets`; the Babel plugin is configured automatically by
  `babel-preset-expo` (no babel config file).
- Custom fonts: set `fontFamily: fonts.*` and don't also set `fontWeight`.
- `Cup` is tapered by drawing triangles in `backgroundColor` over its corners, so pass the colour
  actually behind it. Cups that move over busy backgrounds use `tapered={false}`.
- Everything used must work on the web build — that is where the game actually ships — and in
  Expo Go, which is how it is tried on a real phone while developing. A library with native code
  that Expo Go lacks costs both.

## Verifying changes

- Logic: drive `gameReducer` directly with a small script (e.g. run with `npx tsx`): start a
  day, `TICK` until a customer spawns, `TAKE_ORDER` that slot, `PICK` the order's ingredients and
  `SERVE`, then check coins/stats; also let a `requesting` customer time out (no order taken) and
  confirm `stats.missed` rises. Reaching `dayEnd` needs the counter to empty after closing time.
- Saving: the save is one key, `boba-shop.save.v1`, and on the web it is plain `localStorage` —
  `localStorage.getItem('boba-shop.save.v1')` in the console shows the shop as it stands, and
  removing it is how a first launch is tested. Reload mid-shift and you should come back to the
  same minute of the same day behind the pause card, with the opening sign *not* replayed.
- Updates: `expo-updates` is a stub on the web that always answers "no update", and the API
  rejects outright in Expo Go and dev builds, so none of it runs locally. To see the dialog, fake
  the hook's return in `src/updates/useUpdate.ts` and export — and revert it before committing
  (`grep -rn PREVIEW src/`). Downloading and restarting into a real update can only be tried on a
  phone with a build that has `expo-updates` in it.
- Ice, and anything else drawn in SVG: there is no emulator here, so a browser is the only thing
  that can be driven — and a browser is precisely what will not catch the three gaps under "Drawing
  on a phone" in Conventions. `tools/check-drawing.cjs` reads the source for them; read that list
  too before changing `CupIce`, `CupToppings`, `TeaLiquid` or `KitchenCup`, and say plainly in the
  report that the phone itself was not tried. What a browser *can* prove is that a change meant to
  fix a phone left the web alone: export before and after, drive both to the same cup from the same
  save, and diff the screenshots — the cup should come out identical, and only the HUD clock and
  the looping window clouds should move.
  The quickest way to put a cup in a particular state is the save: write one key to
  `localStorage` from a *blank* page on the same origin (the running game flushes its own save on
  `pagehide` and will write the title screen straight back over anything set while it is up), then
  load the game and dismiss the pause card.
- The loading screen: it is over in a flash on a warm cache, so throttle the network to see it
  (`Network.emulateNetworkConditions` over CDP, or the browser's own throttle).
- Performance: a desktop browser absorbs anything this game does, so measuring it there says
  nothing until the CPU is slowed to roughly phone class (`Emulation.setCPUThrottlingRate`, rate 8
  over CDP). Then `Performance.getMetrics`' `ScriptDuration` over a fixed window of play — idle on
  the prep page, and again while a drag is driven in a loop — is comparable between two exports,
  which is enough to tell a change that removed work from one that only moved it. It is still a
  browser: it cannot tell you how the gesture *feels* on the phone, and it has none of
  `react-native-svg`'s per-view cost on Android.
- Storage failures: `localStorage.getItem` can be made to throw for one key from an init script
  that runs before the bundle, which is the only way to reach the read-failure path above — and
  the thing to assert afterwards is that the save is still there, byte for byte, after several
  write intervals of play.
- UI: `npx expo export --platform web`, serve `dist/`, and look at it at phone sizes
  (390×844 and the small 375×667). The Prep page is reached by swiping left or tapping the "Pha chế"
  tab. To test a later day quickly, temporarily change `START_DAY, day: 1` in `App.tsx` — revert
  before committing. The money shows in three places (the HUD and the opening sign, both the till;
  the day-end screen, which is the only one that reports a single day's takings); the quickest way
  to see any of them against a particular balance is to write a save with the `coins` and `money`
  you want straight to `localStorage`, the way the cup states are set up above.
- Native bundles: `npx expo export --platform ios --platform android` catches native-only
  bundling errors; `npx expo-doctor` checks dependency health.
