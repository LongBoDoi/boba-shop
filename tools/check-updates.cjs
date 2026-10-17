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
  version: '1.2.0',
  native: [
    '@react-native-async-storage/async-storage',
    'expo',
    'expo-asset',
    'expo-audio',
    'expo-file-system',
    'expo-font',
    'expo-haptics',
    'expo-intent-launcher',
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

// ------------------------------------------------------------------ the update an update cannot carry
/**
 * **These two assertions used to say the opposite**, and the reversal is deliberate rather than a
 * regression — read this before "fixing" it back.
 *
 * Handing an `.apk` to Android's package installer was once the *whole* update mechanism, and it
 * was dropped for EAS Update: a 95 MB download and a scary permission for something a few hundred
 * kilobytes over the air does better. What that left behind was a gap nobody was told about. An
 * update carries no native code, so the moment `expo.version` moves, every installed app at the
 * old version stops matching the published updates — `checkForUpdateAsync` answers "nothing new"
 * and the player sits several versions behind an app that looks perfectly current.
 *
 * So the installer is back, for that gap only: `src/updates/useNewBuild.ts` offers it when the
 * latest release's version is ahead of this build's, which — because of the rule enforced further
 * down this very file — is exactly when a new binary is genuinely required. Ordinary changes still
 * go over the air and never raise this dialog.
 *
 * It is Android-only, and not for want of trying: no iOS app can install an `.ipa`, so that half
 * is a link to the release page and a reminder to export a backup code first.
 */
assert.ok(
  pkg.dependencies['expo-intent-launcher'],
  'The new-build offer hands the .apk to the system installer, which needs expo-intent-launcher',
);
assert.ok(
  pkg.dependencies['expo-file-system'],
  'Downloading the .apk and turning it into a content:// URI needs expo-file-system',
);
assert.ok(
  (app.android?.permissions ?? []).includes('android.permission.REQUEST_INSTALL_PACKAGES'),
  'Installing the .apk from inside the app needs REQUEST_INSTALL_PACKAGES in app.json',
);
/**
 * The one thing that makes an in-place install safe for the player's shop. Android keeps an app's
 * data across an update signed with the same key, and every release is signed with the project's
 * EAS keystore — so the `.apk` route above *keeps the shop*, and the dialog says so. `allowBackup`
 * is the second line for the case the first cannot cover (a true uninstall), and it is written
 * down here rather than left to Expo's default because the save now leans on it.
 */
assert.notEqual(app.android?.allowBackup, false, 'The shop has to survive a reinstall where it can');
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
