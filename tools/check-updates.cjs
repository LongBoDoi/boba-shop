/* Run with node tools/check-updates.cjs. Uses the project's TypeScript compiler for pure game code. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

/**
 * A trimmed copy of what api.github.com actually answered for this repository's latest release.
 * Kept here rather than fetched so the check is offline and does not spend the API's 60/hour.
 */
const LATEST = {
  tag_name: 'v1.0.0+5',
  html_url: 'https://github.com/LongBoDoi/boba-shop/releases/tag/v1.0.0%2B5',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'boba-shop-1.0.0-unsigned.ipa',
      size: 18722288,
      browser_download_url:
        'https://github.com/LongBoDoi/boba-shop/releases/download/v1.0.0%2B5/boba-shop-1.0.0-unsigned.ipa',
    },
    {
      name: 'boba-shop-1.0.0.apk',
      size: 95096020,
      browser_download_url:
        'https://github.com/LongBoDoi/boba-shop/releases/download/v1.0.0%2B5/boba-shop-1.0.0.apk',
    },
  ],
};

try {
  const { parseTag, parseRelease, isNewer, formatBytes, describeBuild, REPO } = require(
    path.join(__dirname, '../src/updates/releases.ts'),
  );

  // ------------------------------------------------------------------ tags
  assert.deepEqual(parseTag('v1.0.0+5'), { version: '1.0.0', build: 5 }, 'The tag the workflow writes');
  assert.deepEqual(parseTag('1.2.3+10'), { version: '1.2.3', build: 10 }, 'The v is optional');
  assert.deepEqual(parseTag('v2.0.0'), { version: '2.0.0', build: 0 }, 'A tag with no build is build 0');
  assert.deepEqual(parseTag(' v1.0.0+5 '), { version: '1.0.0', build: 5 }, 'Trimmed');
  for (const bad of [null, undefined, 42, '', 'latest', 'v1.0.0+', 'v1.0.0+beta', 'v+1', 'vx.y.z']) {
    assert.equal(parseTag(bad), null, `${JSON.stringify(bad)} is not a tag`);
  }

  // ------------------------------------------------------------------ the real payload
  const release = parseRelease(LATEST);
  assert.ok(release, 'The live release payload parses');
  assert.equal(release.tag, 'v1.0.0+5');
  assert.equal(release.version, '1.0.0');
  assert.equal(release.build, 5);
  assert.equal(release.page, LATEST.html_url, 'The page is kept for the platforms that cannot install');
  assert.equal(release.apk.name, 'boba-shop-1.0.0.apk', 'The APK is found by its extension, not its order');
  assert.equal(release.apk.bytes, 95096020);
  assert.equal(release.apk.url, LATEST.assets[1].browser_download_url);
  assert.equal(release.ipa.name, 'boba-shop-1.0.0-unsigned.ipa');
  assert.equal(release.ipa.bytes, 18722288);
  assert.ok(REPO.includes('/'), 'The repo is an owner/name pair');

  // ------------------------------------------------------------------ payloads to refuse
  const without = (mutate) => {
    const copy = JSON.parse(JSON.stringify(LATEST));
    mutate(copy);
    return parseRelease(copy);
  };
  assert.equal(parseRelease(null), null, 'Nothing');
  assert.equal(parseRelease('v1.0.0+5'), null, 'Not an object');
  assert.equal(parseRelease({}), null, 'An empty object');
  assert.equal(without((r) => delete r.tag_name), null, 'No tag');
  assert.equal(without((r) => (r.tag_name = 'nightly')), null, 'A tag that is not a version');
  assert.equal(without((r) => delete r.html_url), null, 'No page to fall back to');
  assert.equal(without((r) => (r.draft = true)), null, 'A draft');
  assert.equal(without((r) => (r.prerelease = true)), null, 'A pre-release');

  // A release can be missing one platform's file and still be worth knowing about.
  const apkOnly = without((r) => (r.assets = [r.assets[1]]));
  assert.ok(apkOnly, 'A release with only an APK still parses');
  assert.equal(apkOnly.ipa, null, 'And reports no IPA');
  const none = without((r) => (r.assets = []));
  assert.ok(none, 'A release with no files at all still parses');
  assert.equal(none.apk, null);
  const odd = without((r) => (r.assets = [{ name: 'notes.txt' }, 7, null, { name: 'x.apk' }]));
  assert.equal(odd.apk, null, 'An asset with no download url is not a file');
  assert.equal(odd.ipa, null);

  // ------------------------------------------------------------------ is it worth offering
  const at = (version, build) => ({ version, build });
  assert.equal(isNewer(at('1.0.0', 4), at('1.0.0', 5)), true, 'A later build of the same version');
  assert.equal(isNewer(at('1.0.0', 5), at('1.0.0', 5)), false, 'The build you are running');
  assert.equal(isNewer(at('1.0.0', 6), at('1.0.0', 5)), false, 'An older build is not an update');
  assert.equal(isNewer(at('1.0.0', 9), at('1.1.0', 2)), true, 'A newer version wins over a higher build');
  assert.equal(isNewer(at('1.1.0', 2), at('1.0.0', 9)), false, 'And an older version never does');
  assert.equal(isNewer(at('1.0.0', 0), at('1.0.0', 5)), true, 'An unstamped build is behind everything');
  assert.equal(isNewer(at('1.0', 1), at('1.0.0', 1)), false, '1.0 and 1.0.0 are the same version');
  assert.equal(isNewer(at('1.0.0', 1), at('1.0.1', 1)), true, 'A patch release counts');
  assert.equal(isNewer(at('1.9.0', 1), at('1.10.0', 1)), true, 'Segments compare as numbers, not text');

  // ------------------------------------------------------------------ what the player reads
  assert.equal(formatBytes(95096020), '95 MB', 'The APK, rounded');
  assert.equal(formatBytes(18722288), '19 MB', 'The IPA, rounded');
  assert.equal(formatBytes(1_500_000), '1,5 MB', 'A comma, the way Vietnamese writes a decimal');
  assert.equal(formatBytes(240_000), '240 KB', 'Small files stay in KB');
  assert.equal(formatBytes(0), '—', 'An unknown size is not "0 MB"');
  assert.equal(formatBytes(-1), '—');
  assert.equal(describeBuild(at('1.0.0', 5)), '1.0.0 (build 5)');
  assert.equal(describeBuild(at('1.0.0', 0)), '1.0.0', 'An unstamped build has no number to show');

  // ------------------------------------------------------------------ the stamp the workflow writes
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.equal(
    appJson.expo.extra.build,
    0,
    'The committed app.json stays at build 0 — that is what turns the check off for dev builds',
  );
  assert.ok(
    appJson.expo.android.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'),
    'Android needs REQUEST_INSTALL_PACKAGES to hand an APK to the installer',
  );

  console.log('check-updates: releases are read and compared correctly');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
