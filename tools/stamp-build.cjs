/*
 * Write a build number into app.json, so a built app knows which release it is.
 *
 *   node tools/stamp-build.cjs <number>
 *
 * `versionCode` and `buildNumber` are the platforms' own idea of a build, and both have to count
 * up: Android refuses to install an APK whose versionCode went backwards, so leaving every build
 * at the default 1 would make installing a newer file over an older one unreliable. The build
 * workflow runs this with `github.run_number` before building.
 *
 * This is a build-time edit and is never committed. It deliberately leaves `version` alone —
 * that is the update runtime version (see "Updating itself" in CLAUDE.md), and a build that
 * stamped it would stop matching the updates published for it.
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

config.expo.android = { ...config.expo.android, versionCode: build };
config.expo.ios = { ...config.expo.ios, buildNumber: String(build) };

fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(
  `stamp-build: ${config.expo.version} build ${build} ` +
    `(versionCode ${build}, buildNumber ${config.expo.ios.buildNumber}, ` +
    `runtime version ${config.expo.version} — unchanged)`,
);
