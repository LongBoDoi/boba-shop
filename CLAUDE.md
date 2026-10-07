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
  PrepPage.tsx          page 2 — ticket rail; the order slip; the KitchenStation (the room you work in);
                        serve/clear. The room's own art comes with the station.
src/components/         Cup (layered, animated), CustomerStage, TicketRail, OrderTicket, KitchenStation,
                        Hud, Effects (coins/confetti/toss), OpeningSign…
src/components/art/     SVG illustrations: Character, IngredientIcon, ShopBackdrop (customer wall),
                        KitchenRoom (prep room: tiled wall, pendant lamps, shelves, cabinets;
                        exports the SHOP palette + heartPath used by the equipment art),
                        kitchenArt.ts (the painted kitchen sprites + their geometry),
                        Counter, CounterTop, Tiles, ToppingShelf
src/assets/kitchen/     the painted sprites themselves — generated, see "The kitchen's artwork"
tools/                  cut-kitchen-sheet.py: cuts the asset sheet into those sprites
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
  the tea's colour while pouring, before `POUR` is even dispatched. The `Stream` is drawn over the whole
  kitchen rather than inside the dispenser — otherwise the cup covers it — and it ends at the drink's
  surface, so it visibly shortens as the cup fills. Letting go commits `POUR { category, optionId, amount }` and sets the cup back on its mat
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

### The kitchen's artwork
The dispensers, the topping pans and the cup are **painted sprites**, cut from a single asset sheet by
`tools/cut-kitchen-sheet.py` into `src/assets/kitchen/` and addressed through
[kitchenArt.ts](src/components/art/kitchenArt.ts). The sprites are generated: change the script (or the
sheet), re-run it, don't hand-edit the PNGs. Drop a new sheet at `tools/kitchen-sheet.png` first — it is
not in the repo.

Anything that has to *move* is drawn behind its sprite and shows through a window the script cleared out
of the artwork, which keeps the painted highlights, ticks and the cat decal on top of it:

- a **dispenser** is a tinted block of tea inside `JAR_WINDOW`, with `jar.png` over it; one sprite serves
  every tea;
- the **cup** is [KitchenCup](src/components/KitchenCup.tsx): `cup-base.png` (a flat cream silhouette, so
  the drink reads over a busy shelf), then the drink drawn in the sprite's own 133×199 coordinate space
  and **clipped to `WELL`** — the path round the inside of the glass — then `cup.png` over the top. The
  liquid is a full-height painting of itself inside a container whose height follows the level, so it is
  revealed from the bottom as the cup fills; the pearls, jelly and ice are shaded SVG `Piece`s that sit
  low enough to stay clear of the cat printed on the front. Nothing can escape the glass, because
  everything is inside the clip. (The vector `Cup` is still what the tickets and customers use.)
- the **carried scoop** is `scoop.png` with the pieces drawn into its bowl, so what is in your hand is
  the same scoop that sits in the pan;
- the **pans** are whole sprites, one per topping. Three were painted; the rest (grass jelly, red bean,
  ice) are repainted from those by `repaint()`, which keeps the shading and leaves the red scoop alone.

What is still hand-drawn — the room itself, the milk cartons, the syrup bottle, the foam tubs — matches
the sheet's vocabulary: a dark `INK` outline, a shaded side, warm wood, pink grips, heart knobs
(`heartPath`), wooden name plaques. Keep new equipment in that vocabulary rather than inventing a second
style, or add it to the sheet.

### Game rules worth knowing

- **Manual order-taking, two stages.** Each `Customer` has a `status`: `requesting` (just walked up,
  shows a notepad bubble, no recipe yet) or `ordered` (order taken, recipe revealed as a ticket). On the
  Counter, tapping a `requesting` customer dispatches `TAKE_ORDER` → they become `ordered`; tapping an
  `ordered` one jumps to their ticket on the Prep page. Only `ordered` customers are selectable/serveable.
- **Two patience timers** (both in `DayConfig`): `orderPatienceMs` runs from `arrivedAt` while
  `requesting` (leave annoyed if ignored); a fresh `patienceMs` runs from `orderedAt` while `ordered`
  (leave if the drink is late). The order ring is gold on the Counter; the serve timer is the bar on each
  prep ticket.
- A day lasts 90 s of game time (`state.clock`, advanced by `TICK` every 100 ms from GameScreen,
  paused while the opening sign or pause menu is up). After closing time no new customers come,
  and the day ends once the counter is empty.
- Categories unlock by day: tea + toppings (day 1), ice (2), milk (3), sugar (4), foam and
  double toppings (5). More teas/toppings unlock through day 5.
- Serving: 0 mistakes = full price + tip (faster since ordering = bigger tip), 1 mistake = half price,
  2+ = no pay. Hitting `config.goal` passes the day; stars at 1×, 1.3×, 1.6× the goal.
- **Pouring is a mini-game.** `state.build` (`CupBuild`) tracks the cup as a physical thing: `fill` 0–1,
  `spilled`, `iceScoops`, `sugarPumps`. Serving needs a tea **and** `fill >= MIN_FILL`; filling into the
  clean-pour band (`GOOD_FILL`) without going over pays an extra coin ("Rót chuẩn!"), while holding past
  the brim sets `spilled` — right drink, half price, no tip, and it doesn't count as perfect.
- **One tea per cup.** Once something is poured, the other dispensers are locked (dimmed) until the cup is
  tipped out with "Đổ bỏ"; same for milk, foam and toppings, since nothing comes back out of a cup.
- **You only ever add things**, so "không đá / không sữa / không kem / 0% đường" is simply never adding any:
  `effectiveId` maps a `null` category to its `DEFAULT_ID`, and `categoryMatches` compares those.
- A customer stays in their counter slot from `requesting` through to being served (taking the order does
  not free the slot).

### How animations get their events

The reducer stays pure; the UI animates from state:
- `state.departures` keeps each leaving customer for 1.3 s (outcome, money, the cup they got).
  On the Counter page `CustomerStage` plays the exit (the customer carries the served cup off);
  on the Prep page `EffectsLayer` plays the sale reward — confetti and coins that spring from the
  machine to the HUD wallet — each keyed by the departure id so it plays once on mount. (There is no
  cross-page flying cup: the customer and the machine now live on different pages.)
- `state.cupId` changes when a cup leaves the station (new cup glides in, keyed by it);
  `state.discarded` drives the throw-away toss.
- Effects aim using measured positions (`measureInWindow`): the HUD wallet reports itself, and
  `PrepPage` reports its machine/bin positions up to `GameScreen` through `onGeometry`.

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
