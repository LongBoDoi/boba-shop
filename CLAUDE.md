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
  reducer.ts            GameState, actions (START_DAY, TICK, TAKE_ORDER, PICK, SERVE, CLEAR_CUP…), scoring
  levels.ts             getDayConfig(day): unlock schedule, order/serve patience, spawn rate, goal; describeUnlocks
  ingredients.ts        all ingredients (Vietnamese names, colours, prices), Drink type, categories
  orders.ts             random order generation, price, evaluateDrink (perfect/close/wrong)
  customers.ts          random customer looks (hair, skin, shirt, accessory) and names
  random.ts             seeded RNG; the seed lives in state so the reducer stays pure
  money.ts              formatMoney: 1 game unit = 10.000 ₫, shown as "10k"
src/screens/            TitleScreen, DayEndScreen, and the in-play screens:
  GameScreen.tsx        orchestrator: HUD, the two-page swipe pager + tab indicator, effects/opening/pause overlays
  CounterPage.tsx       page 1 — the customer stage (take orders here)
  PrepPage.tsx          page 2 — ticket rail, order detail, machine/cup, ingredient panel, serve/clear
src/components/         Cup (layered, animated), CustomerStage, TicketRail, OrderTicket, IngredientPanel,
                        Hud, SealingMachine, Effects (coins/confetti/toss), OpeningSign…
src/components/art/     SVG illustrations: Character, IngredientIcon, ShopBackdrop, Counter, Tiles, ToppingShelf
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
- Serving requires a tea. Picking an ingredient auto-advances to the next unfilled tab. A customer stays
  in their counter slot from `requesting` through to being served (taking the order does not free the slot).

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
