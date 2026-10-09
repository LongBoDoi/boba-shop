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

Run typecheck and lint before calling a change done. There is no unit-test suite; see
"Verifying changes" below.

### Deploying the web build (EAS Hosting)

The game is published at https://boba-shop.expo.app (Expo account `manhlong`, project
`@manhlong/boba-shop`, id in `app.json`). To redeploy:

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
                        ICE_SCOOP, SUGAR_PUMP, SERVE, CLEAR_CUP…), scoring
  levels.ts             getDayConfig(day): unlock schedule, order/serve patience, spawn rate, goal; describeUnlocks
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories,
                        and the hands-on constants (MIN_FILL, GOOD_FILL, POUR_RATE, DEFAULT_ID…)
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
                        Hud, Effects (coins/confetti/toss), OpeningSign…
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

- **The tea shelf is one station, and it opens.** The whole shelf is a single target (`teaBay`):
  lift the cup anywhere onto it — it no longer has to be lined up under a particular jar — and
  `TeaWindow` comes up over the room to pour in, on the tap nearest where the cup was let go
  (`findStation` picks it). Touching a jar where it stands opens the same window on that tea. The
  cup is still sent to that dispenser's dock underneath, so letting the window go leaves it standing
  where it was carried; closing it (either button, or the dimmed room behind) stands it back down on
  its mat. The window keeps clear of the order card the page floats over the room — `PrepPage`
  measures the card and passes `topInset`, because the card grows with the recipe.
  Like the room behind it the window **is one painting** (`TEA_BG`, cut by `lift_window` in
  `cut-sheets.py`, which lifts it off the black it is painted on so its rounded corners and the
  vines past them read against the room): the frame, the board the name is written across, three
  shelves and the work top are all in the plate, and everything else is placed on the lines
  `TEA_ROOM` measures off it, the same way `ROOM` works: the dispensers stand on its **second**
  shelf, the cup in the middle of its work top (taller than the gap above that top, because it
  stands in *front* of the shelves and is drawn after them), and the card on the right carries the
  measure.
  **One painting is not one layer.** The vines down either side of that window and the potted
  plant on the right hang in *front* of the shelves, so a jar swiped out to an end was climbing
  over them. `tools/cut-tea-front.ps1` cuts them back out of the finished plate — by colour, since
  a leaf is the only thing on it with green level with red and no blue to speak of; the pot is
  terracotta, which is the shelf's own colour, so that one is a traced silhouette — and `TeaWindow`
  draws them again (`TEA_FRONT`) over the shelf. They are the plate's own pixels, cut out of the
  plate's own output, so laid back on it they are invisible; placing them is the one thing to be
  careful of, which is why their boxes are in `TEA_ROOM.front` and are placed with `span` rather
  than `at` — rounding a sprite's corner and its width apart puts it half a pixel out, and a seam
  would run down the edge of every leaf.
- **Tea is poured in that window, and only there.** The shelf is a **carousel** the width of the
  board: the day's teas stand in a row a `JAR_GAP` apart, each with its name on a plaque hung off
  the front edge of the board, and the row runs the whole way across and moves with the finger,
  stopping at its ends — it does not wrap round. **Only the jar over the cup pours**; the others
  are brought across first, by swiping the shelf or by touching one, and nothing marks the live
  one but where it is standing — that, and `SIDE_DIM`, which takes a little opacity off the jars
  either side of it so the middle one reads as the one in hand. It is a slot's worth of travel and
  goes no further, so the row is quiet together rather than tailing away, and it follows the swipe:
  the jar coming over rises as the one leaving goes down.
  A jar on its way off the end goes soft rather than being cut off
  by the edge: `HAZE` fades it out and crossfades a blurred copy of the same sprite over the sharp
  one, because `blurRadius` cannot be animated but one image lying over another can, and the fade
  is read off the swipe so it follows the finger. The run holds as many **whole** jars as the
  window will take either side of the cup — a run that ends mid-jar cuts the outermost one in half
  — and it is measured **symmetrically about the cup**, not off the board's own middle, since the
  two are a good 50 plate pixels apart and a lopsided run fades one side sooner than the other.
  A jar is `JAR_FIT` times the headroom its shelf has — **over** 1, so it stands proud of the
  board above rather than tucked under it; the plate's second shelf gives only 233 of its 1286
  pixels, which makes for a very small dispenser.
  Press *and hold* the middle tap (`useHoldPour`, in `pour.tsx` with `Stream` and `Spill`): how
  long you hold is how much goes in (`POUR_RATE` per second). The level
  rises live because `KitchenStation` owns the cup's liquid level as a shared value and hands it to
  the window, and the cup shows the tea's colour while pouring, before `POUR` is even dispatched.
  The `Stream` is drawn across the window rather than inside the dispenser, and it ends at the
  drink's surface, so it visibly shortens as the cup fills. It is drawn in **two halves split at
  the cup's lip** — `side="back"` before the cup and `side="front"` after it — because neither
  alone is right: all in front and it runs down the *outside* of the glass over the cat, all behind
  and tea still falling through open air is dimmed by a cup it has not reached. Letting go commits
  `POUR { category, optionId, amount }`.
  Things standing on a board have their feet at the *front* of its painted top face
  (`TEA_ROOM.shelves[].stand`), not at the back edge against the wall, which reads as floating.
  **Hold and swipe are one gesture**, decided from the first few pixels the way the counters'
  lift-or-swipe is: sideways is a swipe, and the pour that had already started is thrown away
  rather than committed. A tap that cannot pour — one off to the side, or a cup that already holds
  another tea — says so (or slides over) on the way *up*, so that a touch which turns into a swipe
  says nothing at all.
- **How full the cup is, is read off the card on the right** (`Measure`), not off the glass: a tube
  that fills with the tea's colour, with the red line across it that the order has to reach
  (`MIN_FILL`). The tea stands *inside* the tube, so full is the tube less its wall at both ends.
  A dashed ring printed round a cup this small was never easy to read against the drink behind it,
  so the glass is left clear.
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

**Every box is the same size however many there are, and a row scrolls instead of shrinking.**
Each is as big as its own art goes under the surface above it (`MAX_WIDTH`, and the row's height
by its own art, so a bottle stays a bottle); a day that brings more of them is a longer row, not
a row of thumbnails. The dispensers **divide their shelf into `TEA_SHELF` equal places and fill
them from the left** — the spacing is set by a full shelf, not by the day, so a jar is the same
size and in the same place on day one as on day seven, the row simply grows along the board as the
week goes on, and the places the week has not reached yet are bare board at the right-hand end.
`TEA_GAP` is the board left between two of them when the shelf is full. What they divide is the
part of the shelf **that is on screen**: a phone taller than the painting crops it at the sides,
and the end of the shelf can go with it, so on most phones the first jar stands against the left
edge of the screen rather than the painted end of the board. They stand under a little wooden
`ShelfSign` reading "Trà", which is centred over the jars that are there rather than over the
board, so it follows the row along; and
they carry no name plaques — the colour of the tea is what tells them apart. The shelf is the one
row that cannot be swiped, so it is also the only one held to its own run: a seventh tea would
shrink all seven rather than stand out over the fridge. The rows below start at
the left and run off the right — the way it is read and the way it is swiped —
and when a day brings more than the room is wide it becomes a `SwipeRow` you drag sideways. That swipe and the lift are **one gesture**, decided from
the first few pixels: sideways swipes the row, anything else lifts the tool. The tool is picked up
on touch either way — that is what lets a tap on a bin say what to do with it — and a swipe simply
puts it back (`carry.cancel`). A swiped row offsets where the carried tool starts (`carry.begin`
takes it), and the offsets are pulled back into range whenever a new day rearranges the counters.

**All of this is the raw responder API (`GRABBY`), not `Pressable`**: a `Pressable` cancels its press when
the finger drifts or the browser decides it was a long-press, which cut pours short. These gestures end
only when the finger actually lifts, and the pager is frozen (`onDragging`) for the duration. Equipment
shows no "added ✓" badges — the order slip is the checklist; machines only dim when they're locked out.

`Cup` — the little one on the counter page — draws the "đủ" line (`MIN_FILL`) and the clean-pour
band (`GOOD_FILL`) on the glass. `KitchenCup`, the one you pour into, does not: that is the
window's `Measure`, and the station drips tea down the side (`Spill`) when the live level goes over
the brim.

### Liquids are cut, never drawn
**No tea or drink is rendered in code.** Both are sprites cut off the design — the dispensers from
`tools/sheets/kitchen.png` by `tools/cut-tea-jars.ps1`, the cup and its drink from
`tools/sheets/cup-design.png` by `tools/cut-cup-design.ps1` — and teas the design doesn't paint are
those same sprites re-coloured, shading and all.

It was drawn in code for a long time and never matched, through many rounds of it. The sheet's
liquid sits under an **oval** surface, holds **one tone** the whole way down rather than any
top-to-bottom gradient, shades **across** the glass instead, and runs to the very **foot** of it.
Each of those had to be found the hard way. If a liquid looks wrong, fix the cut — do not reach for
a gradient.

The **cup** and its **drink** both come from `tools/sheets/cup-design.png` — the same cup drawn
twice, empty and full — via `tools/cut-cup-design.ps1`. The glass is solved off the empty one, so
it is genuinely see-through; the drink is the full one's own pixels, glass and all. That is why
`KitchenCup` draws the cup *first* and lays the drink over it: wherever the drink covers, what you
see is simply the design. The cat is printed on the **front** of the glass, so it is cut out of
`cup.png` into `cup-decal.png` and drawn **last**, over the drink — leave it in the glass and the
drink pours straight over it. The drink's own shape is the full cup's liquid footprint, base and
all, found by hue rather than fitted to a path; `WELL` only clips the ice and toppings.

The two cups on that sheet are drawn separately, not copies, so they differ everywhere. Don't try
to find the liquid by subtracting one from the other — it reports the whole cup.

Earlier versions solved the liquid back out from behind the glass and re-composited it under ours.
Don't: it passes through two lots of error and comes out blotchy and off-colour.

The drink ends where the design's own tea ends, at **y 162**, in the soft arc the sheet paints
there. Carrying it further down into the glass's base — the obvious-looking fix for a flat-bottomed
pour — only hangs a dark tapering wedge off the bottom of it, because below that the design is
drawing the *foot*, which closes fast. Each row fills its **whole span** rather than testing pixel
by pixel, so the glass's moulded ticks don't punch holes through it, and `cup-edge.png` — the
glass's dark linework — is drawn **over** the drink, so the drink can't eat into the outline.

Every body row is drawn from **one clean row** (y 66), stretched across whatever the glass holds
there. The design's body is one tone from y 61 to 84, so nothing is lost; it matters at the other
end, where the sheet's lowest rows carry the base's own bright rim and dark band. Those only read as
a base seen through a full cup — revealed on their own as a shallow pour they become stacked discs
with ledges between them.

The drink is **two** sprites, because the level moves: `DRINK` is the glass filled to the brim and
cut to the liquid's own footprint, revealed from the bottom up by an animated height, and
`DRINK_TOP` is the surface alone, stood on that reveal line and stretched to however wide the glass
is there. Revealing one sprite with the surface in it slices it off flat at every level but full.

`DRINK_TOP` is a **whole ellipse**, ten rows above the line where the liquid meets the glass and
twelve below, and three things about it are load-bearing:

- the **shape is drawn, not masked** off the sheet. The far rim is painted nearly the colour of the
  glass, so no test separates them cleanly and the arc comes out lopsided;
- the colour is read **along the arc**, not straight across — down the middle the ellipse is at its
  deepest and the sheet's rows map one for one, out at the sides they squeeze into fewer. Copied row
  for row, the near rim's bright band runs across as a flat stripe and the surface reads as a disc
  inside a disc;
- the **lower half fades out** as it closes, melting into the body behind it instead of ending on a
  rim of its own, and being an ellipse it closes faster than the glass's foot does — which is what
  keeps it inside the walls at low fill, where the sprite is stretched to the width of the line all
  the way down. `MIN_POUR` covers the rest: a pour never shows less than a tenth, because below that
  the glass has nothing like twelve rows left under the surface.

`pourLevel` is how that floor is reached, and it is **eased, not clamped** — the first `POUR_EASE`
of the level is squeezed into the room above the floor. Clamped with a `Math.max`, the drink snaps
to a tenth and then stands still for the ~180ms it takes to actually pour that much, which reads in
the hand as the tap stalling before it gets going. Everything that follows the surface goes through
it, the pour stream in `KitchenStation` included, or the stream ends where the drink isn't.

`KitchenCup` prints **no guide on the glass**. It used to carry the "đủ" line as a dashed ring in
the surface's own perspective, with its far half blurred by however much tea stood in front of it;
the station window's `Measure` says the same thing in a place that can be read at a glance, so the
ring came off. The fill is still `MIN_FILL`, and `Cup` on the counter page still draws its own.

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
their own — see "Liquids are cut, never drawn".

Anything that has to *move* is drawn against a window the script cleared out of the artwork, which
keeps the painted ticks, highlights and the cat decal on top of it:

- a **dispenser** is one whole sprite per tea, `JAR_TEA[id]`, glass and tea together, cut off the
  design sheet by `tools/cut-tea-jars.ps1`. **The tea is not drawn in code.** It used to be — a
  shape with a gradient behind an empty jar — and it never matched: on the sheet the tea sits under
  an oval surface, holds one tone the whole way down, and runs to the foot of the glass behind the
  tap. Reproducing that was a long series of near-misses, so don't; if a dispenser looks wrong, fix
  the cut. Teas the sheet doesn't paint are the same sprite re-coloured, shading and all;
- the **cup** is [KitchenCup](src/components/KitchenCup.tsx): a faint tint of its silhouette (the
  cup is clear plastic, so this only lifts it off the room — backing it solidly reads as milky), then the
  drink drawn in the sprite's own 185×237 space and **clipped to `WELL`** — the path round the
  inside of the glass — then `cup.png` over the top. The liquid is a gradient painting of itself
  inside a container whose height follows the level, so it is revealed from the bottom as the cup
  fills; the toppings and ice are the sheet's own pieces, placed low enough to clear the cat.
  Nothing can escape the glass, because everything is inside the clip;
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
