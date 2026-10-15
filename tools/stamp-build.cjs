/*
 * Write a build number into app.json, so a built app knows which release it is.
 *
 *   node tools/stamp-build.cjs <number>
 *
 * `app.json`'s `version` is the marketing one and barely changes; releases are tagged
 * `v<version>+<run number>`, so the version alone cannot tell `v1.0.0+4` from `v1.0.0+5`. The
 * build workflow runs this with `github.run_number` before building, and the game reads it back
 * through `expo-constants` to compare itself against the latest release. See "Updating itself" in
 * CLAUDE.md.
 *
 * This is a build-time edit and is never committed: the checked-in value stays 0, which is what
 * marks a dev server or a local export as "not a release" and turns the update check off.
 *
 * `versionCode` and `buildNumber` are stamped from the same number because they are the platforms'
 * own idea of a build: Android refuses to install an APK whose versionCode went backwards, so
 * leaving every build at the default 1 would make upgrading by file unreliable.
 */
const fs = require('node:fs');
const path = require('node:path');

const build = Number(process.argv[2]);
if (!Number.isInteger(build) || build <= 0) {
  console.error(`stamp-build: need a positive whole number, got ${JSON.stringify(process.argv[2])}`);
  process.exit(1);
}

const file = path.join(__dirname, '../app.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!config.expo) {
  console.error('stamp-build: app.json has no "expo" key');
  process.exit(1);
}

config.expo.extra = { ...config.expo.extra, build };
config.expo.android = { ...config.expo.android, versionCode: build };
config.expo.ios = { ...config.expo.ios, buildNumber: String(build) };

fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(
  `stamp-build: ${config.expo.version} build ${build} ` +
    `(versionCode ${build}, buildNumber ${config.expo.ios.buildNumber})`,
);
