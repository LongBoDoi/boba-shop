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
Lint treats warnings as failures. The regression scripts check serving behavior and the scoped
UUID dependency override; see "Verifying changes" below and `docs/dependency-health.md`.

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
home screen. There is no app build, and the routes to one were each tried and dropped — worth not
re-litigating:

- **Expo Go** (publish with `eas update`, hand out one link) is dead on the current client. Expo Go
  57.0.9 cannot launch EAS Updates at all: every runtime string (`exposdk:57.0.0`, `exposdk:57.0.9`,
  bare `57.0.0`), a manifest with `sdkVersion` pinned to the client's own build number, and the
  `exp://u.expo.dev/update/<id>` link form all died with `IOException: Failed to download remote
  update`, while the published update itself was provably intact (manifest `200`, all 84 assets
  downloadable with the `assetRequestHeaders` tokens). The fault is inside the client — it filters
  updates with `sdkVersions.contains(manifest.getExpoGoSDKVersion())` — and the fix (expo/expo#46944)
  had not shipped as of October 2026.
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
  levels.ts             getDayConfig(day): unlock schedule, order/serve patience, spawn rate, goal; describeUnlocks
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories,
                        and the hands-on constants (POUR_RATE, DEFAULT_ID…)
  orders.ts             random order generation, price, evaluateDrink (perfect/close/wrong)
  customers.ts          random customer looks (hair, skin, shirt, accessory) and names
  random.ts             seeded RNG; the seed lives in state so the reducer stays pure
  money.ts              formatMoney: 1 game unit = 10.000 ₫, shown as "10k"
src/screens/            TitleScreen, DayEndScreen, and the in-play screens:
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
src/motion.ts           shared animation timings/easings
src/theme.ts            colours and font family names
```

### The two pages (swipe navigation)
`GameScreen` keeps the reducer state, the tick loop, haptics and the `measureInWindow` refs, and hosts a
horizontal `pagingEnabled` `ScrollView` with `CounterPage` (left) and `PrepPage` (right). The `PageTabs`
indicator under the HUD highlights the active page and badges each side (Quầy = # waiting to order,
Pha chế = # tickets to make); tapping a tab scrolls the pager (swiping is the primary gesture). Because
`PrepPage` is off-screen until swiped to, it re-measures its machine/bin positions when the parent bumps
its `measureToken` on scroll-settle, and reports them up via `onGeometry` for the effects overlay.

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
forward. It is not persisted across app launches — there is no storage dependency.

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
  teas growing from left to right in six fixed slots. The new transparent `tea-tank.png` frame
  supplies the dark lid, glass highlights and lever tap. Shaded tea is rendered behind it and
  `TeaTankMount` supplies a static metal shelf bracket with bolted end plates, a beveled rail,
  bent cradle arms and a contact shadow, behind the tank's lower collar and clear of its tap.
  each tank has its own Vietnamese name tag above the lid, keeping the chamber clear. The tank
  frame is memoized and does not scale, dim, or change opacity when the cup is carried around it. Other equipment keeps its existing art and layout.
- **Pour directly in the room.** Drag the cup under a visible tank and release to snap beneath
  its spout. The cup scales to the shelf gap and its base rests on the lowest shelf surface,
  with a small contact shadow; picking it up restores its carrying size. `findStation` tests that particular tap in screen coordinates, including the pan
  offset. Hold its tap (`useHoldPour`) to raise the live liquid level; releasing commits the
  amount and sends the cup back to its centered holder after 420ms. A tank cannot pour until the
  cup is docked beneath it, and a cup holding a different tea locks that tank. Panning returns
  a docked cup to its holder; scrolling is frozen during cup/tool dragging or pouring.
  `Stream` draws behind and in front of the cup, split at its scaled lip, with moving highlights
  and a trailing drop on release. `Spill` shows overflow.
  The removed tea-station dialog is no longer part of the game.
- **A large vertical meter appears as soon as the cup docks**, before any tea is poured. It is
  a `GameScreen` overlay at the screen edge, outside the kitchen/panorama and cup transforms.
  `KitchenStation` reports its live shared level through `PrepPage.onMeterChange`. The marks are
  Cạn / Ít / Nửa ly / Gần đầy / Đầy, without percentage labels or a serving target. The gauge fills
  smoothly from bottom to top and highlights milestones; overflow displays Tràn ly. It remains
  until the cup undocks and is hidden on the counter page. The overlay passes all touches through.
  Milestone accessibility updates use `useAnimatedReaction`, with no JS polling.
  There is no minimum amount required to serve and no fill-based tip bonus. Overflow still marks
  a messy drink. The cup and its holder remain horizontally centered at rest.
- **The toppings are in the bins the room is painted with.** They used to be loose pans along the
  ledge, a row that ran off the room and was swiped back; then a painted stand of their own
  (`TOPPING_STAND`) standing on the work top. Both are gone. The plate now paints the whole
  station — the tray under the fridge, its six steel bins, its `Topping` sign and the shadow
  around them — so there is no furniture left to place and a topping is simply a **heap of
  itself standing in one of those bins** (`ROOM.bins`, measured off the plate like every other
  line in the room). `fillBins` puts the day's toppings into them.
  Three things it has to get right:
  **A full bin is one sprite** (`BIN[id]`) — steel tray, what is in it and the scoop standing in
  it. The six are **not** fitted to the bins the plate happens to paint under the fridge: they are
  laid out to fill the **cubby** the plate paints under the fridge (`ROOM.tray`): three across
  shoulder to shoulder at `BIN_GRID.pitch`, read off their own sheet, and sized to the run the
  cubby gives them. How far the front row stands in front of the back one is not a number — the
  two rows **divide the cubby's own depth**, the back row's trays starting at its ceiling and the
  front row's ending at the lip of its floor, so they fill it however deep it is painted. A place
  the week has not reached yet gets `BIN_EMPTY` instead (`layout.emptyBins`), laid down before the
  rows so a bin the day *does* have is simply drawn over the one standing where it goes. That is
  safe in both directions because a row only reaches the back one once the front is full, so a
  full bin is never drawn over an empty one standing in front of it.
  Each is hung by the **tray's own rim** (`BIN_HEAD`), not by the top of the sprite: above that
  line is the scoop, which reaches well over the back of the bin.
  Before the sprites arrived this was built out of parts, and the parts are worth not rebuilding:
  a loose heap laid in the bin is a golf ball in a shoe box, grown to fill it it laps over the
  rims, squashed to the bin's foreshortened depth it turns pearls into ovals, and tiled into a bed
  and clipped to the opening it is only as good as the grain survives — which at 2x it does not.
  Ask for the sprite.
  **Which bins.** Up to three toppings stand in the **front** row, the nearer and the easier to
  reach, and the rest fill from the back; a row that is not full sits as near its middle as three
  bins allow, so a day with one topping uses the middle bin and a day with two the left and the
  middle. The back row is pushed first, so where a front heap laps the bin behind it the front one
  is drawn over — which is what a second row standing behind a first one looks like anyway.
  **The touch target** is the whole bin, not the heap in it: the bins tile along the tray exactly,
  so there is no dead steel between two of them and none of them reaches over its neighbour.
  They wear **no name plaques** (the tray is named, and six Vietnamese topping names would not fit
  under six bins this size) and cast **no pool of their own** (`shadow={false}` — the tray is
  painted with its own shadow). What a bin holds is said on the hint line the moment it is picked
  up instead, which is what `onGrab` on `useCarryGesture` is for.
- **Everything else — carry it to the cup.** The topping bins, the ice pan, the syrup bottle, the milk
  cartons and the foam tubs are dragged: `useCarry` keeps what's in hand, draws the tool following the
  finger above everything else, and on release either tips it into the cup (`SCOOP` / `ICE_SCOOP` /
  `SUGAR_PUMP`, or `POUR` of `MILK_SPLASH` for a carton) or puts it back. The cup doesn't move for these —
  drop onto it wherever it stands. Ice and syrup show how many scoops or pumps went in on the machine
  itself. Milk takes room in the cup, so a cup filled to the brim with tea has nowhere to put it.

**Tea slots remain fixed across days**, filling the second rack from left to right. The tank art
is sized to the rack and available space below its spout, independently of the other equipment.
The remaining equipment uses the existing `MAX_WIDTH` and `SwipeRow` layout: rows can be swiped
when they overflow, while a vertical lift carries the tool. `carry.cancel` puts a tool back when
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
The cup's existing painted tea textures blend with translucent shading and depth gradients.
Tank tea instead uses fully opaque vector shading with stronger color and depth; enlarged raster
textures no longer soften its chamber. The original tank glass and hardware remain intact. The surface
is a complete oval with the same perspective as the cup rim, narrowing with its tapered walls.
A painted meniscus, crescent highlight and curved reflection sit at its surface. Cup milk color blends with tea to give a
creamier tint. All liquid stays clipped inside the glass; the cup linework and decal draw last.

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
The vertical milestone meter floats outside the cup and kitchen transforms.
The legacy `DRINK`, `DRINK_TOP` and jar assets remain in the repository.

### The kitchen's artwork
Nearly everything in the prep room is a **painted sprite**. `tools/cut-sheets.py` cuts
`tools/sheets/*.png` into `src/assets/kitchen/`, and
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
  faint cool glass backing and the original cup sprite, then `TeaLiquid` inside the traced
  `CUP_WELL`, followed by clipped ice/toppings, foam, edge highlights and the cat decal.
  Its surface is an elliptical plane whose width follows the tapered glass. The stream and foam
  use the same fill coordinates. Nothing can escape the glass because it stays inside the clip;
- a **scoop of topping** is one whole painted sprite, `SCOOPFUL[id]`, heap and all. It used to be
  the bare `SCOOP` with pieces laid into its bowl by hand, which was the same mistake the teas
  were — the design draws what a scoop of this looks like, so take its word for it. The six are
  drawn to a common **height**, because the scoop is identical in all of them and only what mounds
  over the bowl differs; matched on width instead, a heaped one shrinks beside a flat one. Ice and
  foam still take the bare `SCOOP`, ice with pieces heaped in its bowl and foam with a blob drawn
  in it — the bowl is solid chrome, so anything behind it is invisible;
- the **ice pan, cartons, syrup, foam tubs and every fitting** (wall, lamps, shelf, steel counter,
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
  The **open cubby under the fridge** is painted into it too — empty, with no bins in it, which is
  why there is no stand sprite any more; `ROOM.tray` is that cubby, and the six bins are laid out
  to fill it.

**The prep page is all kitchen.** There is no ticket rail or order slip above it: the room fills
everything between the tabs and the action buttons, which is what gives the equipment the size it has
in the reference.

### The order, spoken back
[OrderBubble.tsx](src/components/OrderBubble.tsx) is a **speech bubble floating over the top of the
room** (it used to be a paper note clipped to a rail inside it): who the drink is for, what it is
called, and a tile for every thing that goes in it, each ticking off as the cup comes together. The
heart at the end is the customer's patience, emptying from the top and turning amber then red — the
`ClipPath` over the heart path is how, because a `View` cannot be heart-shaped.

Three things about it are deliberate:

- it lists the drink in `SPOKEN` order — tea, milk, sugar, ice, toppings, foam — not `BUILD_ORDER`,
  which runs bottom of the cup upwards. The card is read, not built;
- the tiles stand together at one size and the row runs out from the left. Sharing the card's whole
  width between them leaves a two-thing order as two tiles marooned at either end;
- the card takes **no touches at all** (`pointerEvents="none"`), so on a short phone, where it laps
  over the dispenser shelf, nothing it covers stops being draggable. Only the pegged orders under
  its right corner — the other taken tickets, tap one to switch — are live.

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
- UI: `npx expo export --platform web`, serve `dist/`, and look at it at phone sizes
  (390×844 and the small 375×667). The Prep page is reached by swiping left or tapping the "Pha chế"
  tab. To test a later day quickly, temporarily change `START_DAY, day: 1` in `App.tsx` (and the goal
  in `levels.ts`) — revert before committing.
- Native bundles: `npx expo export --platform ios --platform android` catches native-only
  bundling errors; `npx expo-doctor` checks dependency health.
