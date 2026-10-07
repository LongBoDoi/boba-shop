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
src/components/         Cup (layered, animated), CustomerStage, TicketRail, OrderTicket, KitchenStation,
                        Hud, Effects (coins/confetti/toss), OpeningSign…
src/components/art/     SVG illustrations: Character, IngredientIcon, ShopBackdrop (customer wall),
                        KitchenRoom (prep room: tiled wall, pendant lamps, shelves, cabinets;
                        exports the SHOP palette + heartPath used by the equipment art),
                        kitchenArt.ts (the painted kitchen sprites + their geometry),
                        Counter, CounterTop, Tiles, ToppingShelf
src/assets/kitchen/     the painted sprites themselves — generated, see "The kitchen's artwork"
tools/                  cut-sheets.py: cuts the asset sheets into those sprites
                        cut-tea-jars.ps1: a whole dispenser per tea, off the kitchen sheet
                        cut-cup-design.ps1: the cup and its drink, off the cup design
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
`layoutKitchen(config, w, h)` places everything absolutely, top to bottom: a wooden shelf of glass tea
dispensers, then the **work top** with the cup's coaster through the middle, then the stainless topping
bar and the ice/sugar/milk/foam counter, then the pink cabinet doors (the hint pill sits on them). Each
dispenser gets a **dock**: the spot the cup is held while that tap runs into it, just under its shelf.
Dropping the cup still standing on the work top sends it home; lifting it up to a dispenser docks it
there (`findStation` only considers teas), and only the docked one pours.

- **Tea dispensers — carry the cup to them.** Drag the cup up under the spout to dock it,
  then press *and hold* (`useHoldPour`): how long you hold is how much goes in (`POUR_RATE` per second).
  The level rises live because the station owns the cup's liquid level as a shared value and the cup shows
  the tea's colour while pouring, before `POUR` is even dispatched. The `Stream` is drawn across the
  kitchen rather than inside the dispenser, and it ends at the drink's surface, so it visibly shortens
  as the cup fills. It is drawn in **two halves split at the cup's lip** — `side="back"` before the cup
  and `side="front"` after it — because neither alone is right: all in front and it runs down the
  *outside* of the glass over the cat, all behind and tea still falling through open air is dimmed by
  a cup it has not reached. Letting go commits `POUR { category, optionId, amount }` and sets the cup back on its mat
  (so a docked cup never ends up hiding a shelf).
- **Everything else — carry it to the cup.** The topping pans, the ice pan, the syrup bottle, the milk
  cartons and the foam tubs are dragged: `useCarry` keeps what's in hand, draws the tool following the
  finger above everything else, and on release either tips it into the cup (`SCOOP` / `ICE_SCOOP` /
  `SUGAR_PUMP`, or `POUR` of `MILK_SPLASH` for a carton) or puts it back. The cup doesn't move for these —
  drop onto it wherever it stands. Ice and syrup show how many scoops or pumps went in on the machine
  itself. Milk takes room in the cup, so a cup filled to the brim with tea has nowhere to put it.

**All of this is the raw responder API (`GRABBY`), not `Pressable`**: a `Pressable` cancels its press when
the finger drifts or the browser decides it was a long-press, which cut pours short. These gestures end
only when the finger actually lifts, and the pager is frozen (`onDragging`) for the duration. Equipment
shows no "added ✓" badges — the order slip is the checklist; machines only dim when they're locked out.

`Cup` draws the "đủ" line (`MIN_FILL`) and the clean-pour band (`GOOD_FILL`) on the glass, and the station
drips tea down the side when the live level goes over the brim. The order slip (`OrderTicket`) is a compact
strip above the room, so the whole scene is workspace.

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

The **"đủ" line** is the one guide printed on the glass, and it is a dashed **ring**, not a bar —
`CUP_ROUND` gives it the same perspective as the surface, so pour to it and the drink's own surface
ellipse lands straight on it. It is drawn as two arcs meeting at the ring's widest points, where the
glass turns away: the near half is on this side of everything and stays sharp, and the far half is
read **through** whatever is in the cup. Empty glass is clear, so it starts sharp too and only goes
soft — `FeGaussianBlur`, with its filter region set by hand, because the default crops a line this
thin off square at both ends — once the tea is over the line. That crossfade is two `FarGuide`
layers under animated view styles rather than one element under `useAnimatedProps`, for the reason
below.

Both are plain `<Image>`s moved by `useAnimatedStyle`. An earlier attempt slid one taller sprite
inside an SVG clip by animating the image's `y` through `useAnimatedProps`, which looked right in
every mock-up and did not hold up in the app — the drink sat at the top of its own box and stopped
short of the base. Keep the drink on view styles.

### The kitchen's artwork
Nearly everything in the prep room is a **painted sprite**. `tools/cut-sheets.py` cuts
`tools/sheets/*.png` into `src/assets/kitchen/`, and
[kitchenArt.ts](src/components/art/kitchenArt.ts) is the only place that names those files. The
sprites are generated — change the script (or the sheet), re-run it, never hand-edit a PNG. The one
exception is the `pan-*.png` set, cut from a 1024px rendering of the kitchen sheet that no longer
exists; they are checked in and the script leaves them alone. The dispensers and the cup have
scripts of their own — see "Liquids are cut, never drawn".

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
- the **carried scoop** is `scoop.png` with the pieces heaped into its bowl, over the sprite —
  the bowl is solid chrome, so anything behind it is invisible;
- the **pans, cartons, syrup, foam tubs and every fitting** (wall, lamps, shelf, steel counter,
  cabinets, rail, coaster, plant, poster, chalkboard, cup stack, straws, towel) are whole sprites
  that [KitchenRoom](src/components/art/KitchenRoom.tsx) and the station place by the layout's
  lines. Three pans and two pieces had no art of their own and are repainted from the ones that do,
  by `repaint()`, which keeps the shading and leaves the red scoop alone.

**The prep page is all kitchen.** There is no ticket rail or order slip above it: the room fills
everything between the tabs and the action buttons, which is what gives the equipment the size it has
in the reference. The order lives on a note clipped to the shop's rail
([OrderNote.tsx](src/components/OrderNote.tsx)) — the printed "Ly mới" slip when nothing is taken,
otherwise the customer's name on the header with the drink listed underneath, ticking off as the cup
comes together. The other taken orders are pegged up beside it as `TicketPin`s; tap one to switch.
`layoutKitchen` sizes each row to what stands on it and gives most of the slack to the cup's band, so
the room packs the way the reference does rather than leaving empty wall.

The layout follows `tools/sheets/reference.png`: lamps and tiled wall, the dispenser shelf (with
the plant and the poster at its ends when there is room for them), the notes rail, the work top
with the cup on its coaster, the stainless topping bar, then the pink cabinets. `layoutKitchen`
reserves `sideRoom` at the ends of the dispenser shelf only while there are four teas or fewer.


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
- Everything used must run in Expo Go (current libs all do). Adding a library with native code
  that Expo Go lacks means switching to a development build.

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
