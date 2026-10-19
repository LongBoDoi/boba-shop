/**
 * What this app's **native shell** is, as a number that only moves when the shell changes.
 *
 * An update carries the web build — HTML, JavaScript, artwork — and nothing else, so a change to
 * the Capacitor projects, the plugins they contain or the permissions they ask for cannot travel
 * in one. This number is how an installed app finds out: the site publishes the version it was
 * built against in `update.json`, and an app whose own number is lower knows that no update can
 * reach it and says so (see `src/updates/install.ts`).
 *
 * **Bump it when the native side changes**: a Capacitor plugin added or removed, a change to
 * `capacitor.config.ts`, `AndroidManifest.xml`, `Info.plist`, the Gradle files or the Java/Swift in
 * `android/` and `ios/`. `tools/check-updates.cjs` holds a fingerprint of all of those and fails
 * when they drift without this moving, because nothing else will notice — it typechecks, it
 * builds, and it runs perfectly in a browser.
 *
 * 1 — the first Capacitor shell.
 * 2 — `@capacitor/filesystem`, the installer plugin and `REQUEST_INSTALL_PACKAGES`: the shell that
 *     can update itself. An app from before this cannot be updated over the air at all, and is
 *     told to install a new file once.
 */
export const NATIVE_VERSION = 2;
