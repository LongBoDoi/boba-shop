/* Run with node tools/check-updates.cjs. Checks the update mechanism's configuration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

/**
 * The native dependencies as they stood when the apps were last built, and the version they were
 * built as. **This is the one thing here that cannot be checked any other way.**
 *
 * The update runtime version is `app.json`'s `version` (the `appVersion` policy), so every build
 * carrying version 1.0.0 accepts every update published while it says 1.0.0. An update is only
 * JavaScript and assets — it cannot bring native code with it — so adding, removing or upgrading a
 * native module without moving the version publishes an update to apps whose native side cannot
 * run it, and the first thing the player sees is a crash. Nothing else in the toolchain notices:
 * it typechecks, it lints, it runs in a browser, and it only breaks on a phone that already has
 * the app.
 *
 * This matches on names, not versions: a module that is simply *missing* from the installed binary
 * is the case that always crashes. Upgrading one of these packages is usually survivable and is
 * not caught here — it still deserves a rebuild.
 *
 * **When this fails:** bump `expo.version` in app.json, re-record the two values below, and build
 * the apps again (Build apps) before pushing — the push publishes an update.
 */
const BUILT = {
  version: '1.1.0',
  native: [
    '@react-native-async-storage/async-storage',
    'expo',
    'expo-asset',
    'expo-audio',
    'expo-font',
    'expo-haptics',
    'expo-status-bar',
    'expo-updates',
    'react-native',
    'react-native-reanimated',
    'react-native-safe-area-context',
    'react-native-svg',
    'react-native-worklets',
  ],
};

/** A dependency that ships native code: it has a platform folder or a podspec. */
function nativeDependencies() {
  return Object.keys(pkg.dependencies)
    .filter((name) => {
      const dir = path.join(root, 'node_modules', name);
      if (!fs.existsSync(dir)) return false;
      if (fs.existsSync(path.join(dir, 'android')) || fs.existsSync(path.join(dir, 'ios'))) return true;
      return fs.readdirSync(dir).some((file) => file.endsWith('.podspec'));
    })
    .sort();
}

// ------------------------------------------------------------------ where updates come from
assert.equal(
  app.updates?.url,
  `https://u.expo.dev/${app.extra?.eas?.projectId}`,
  'updates.url must point at this EAS project',
);
assert.equal(
  app.runtimeVersion?.policy,
  'appVersion',
  'The runtime version is the app version; the list below is recorded against it',
);
assert.equal(
  app.updates?.checkAutomatically,
  'NEVER',
  'The game asks the player and installs on their say-so, so the library must not fetch on its own',
);
assert.equal(
  app.updates?.requestHeaders?.['expo-channel-name'],
  'production',
  'The iOS app is archived by the workflow rather than EAS Build, so the channel has to come from app.json',
);
assert.ok(pkg.dependencies['expo-updates'], 'expo-updates is what does the updating');

// ------------------------------------------------------------------ what used to do the updating
assert.ok(
  !pkg.dependencies['expo-intent-launcher'],
  'Nothing hands an APK to the package installer any more',
);
assert.ok(
  !(app.android?.permissions ?? []).includes('android.permission.REQUEST_INSTALL_PACKAGES'),
  'Installing an APK from inside the app is gone, and so is the permission for it',
);
assert.equal(app.extra?.build, undefined, 'The stamped build number was only read to compare against a release');

// ------------------------------------------------------------------ native code and the runtime version
const native = nativeDependencies();
if (native.join('\n') !== BUILT.native.join('\n')) {
  const added = native.filter((name) => !BUILT.native.includes(name));
  const gone = BUILT.native.filter((name) => !native.includes(name));
  assert.notEqual(
    app.version,
    BUILT.version,
    'The native dependencies changed while app.json still says version ' +
      `${BUILT.version}: ${[...added.map((n) => `+${n}`), ...gone.map((n) => `-${n}`)].join(', ')}. ` +
      'An update carries no native code, so publishing this would reach apps that cannot run it. ' +
      'Bump expo.version, re-record BUILT in tools/check-updates.cjs, and build the apps again.',
  );
  console.log(`check-updates: native dependencies changed and the version moved to ${app.version} — re-record BUILT`);
}

console.log('check-updates: the shop updates itself from EAS Update, and the runtime version still matches');
