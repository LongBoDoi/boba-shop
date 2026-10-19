# Dependency health

The game is built from five runtime packages — `phaser`, `preact` and the three `@capacitor/*`
pieces — plus Vite and TypeScript to build it. `npm audit` reports **0 vulnerabilities**, and the
two decisions that keep it there are worth not undoing by accident:

- **`xcode`'s `uuid` is pinned through a scoped override** (`"overrides": { "xcode": { "uuid":
  "11.1.1" } }`). `@capacitor/cli` depends on `xcode`, which asks for a `uuid` old enough to carry
  the [buffer bounds advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). `xcode` only
  uses `uuid.v4()`, which the pinned version still provides as CommonJS. Remove the override when
  `xcode` updates its own dependency.
- **`@capacitor/assets` is not a dependency.** It generates the app icons and splash screens from
  `assets/icon-*.png` and `assets/logo.png`, which is an occasional job, and it drags in `sharp`,
  its own nested `@capacitor/cli` and `tar` — most of the advisories this project ever had. Run it
  when the artwork changes and let it go again:

  ```sh
  npx @capacitor/assets@3 generate --android --ios
  ```

  The generated icons are committed under `android/` and `ios/`, so a normal build never needs it.

`@capacitor/cli` itself is a devDependency: it is `cap sync`, which copies `dist/` into the two
native projects. Nothing in the shipped bundle comes from it.
