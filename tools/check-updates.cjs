/*
 * Run with node tools/check-updates.cjs.
 *
 * Two jobs, and the first is the one that bites.
 *
 * **An update carries the web build and nothing else.** So the moment the native shell changes —
 * a Capacitor plugin, a permission, the Gradle or Xcode projects, the config — every installed app
 * is one that no update can reach, and the only honest thing to do is tell the player to install a
 * file. `NATIVE_VERSION` in `src/updates/native.ts` is how they find out, and nothing in the
 * toolchain notices when it stands still while the shell moves: it typechecks, it builds, and it
 * runs perfectly in a browser. So this holds a fingerprint of the shell and fails when the two
 * drift apart. When it fails: look at what changed, bump `NATIVE_VERSION`, re-record `BUILT`
 * below, and run **Build apps** before the next deploy.
 *
 * The second is the decision itself — which of the two kinds of new version this is, and what it
 * costs — which is pure and so can be driven straight from here.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);

const { decide, parseManifest, plan, directories, isWhole, pageAsks } = require(path.join(root, 'src/updates/manifest.ts'));
const { parseRelease, needsNewBuild, compareVersions } = require(path.join(root, 'src/updates/release.ts'));
const { NATIVE_VERSION } = require(path.join(root, 'src/updates/native.ts'));

// ============================================================ the shell, and the number for it
/**
 * Everything an update cannot carry. A file is listed by name so that one appearing or
 * disappearing is itself a change; the `@capacitor/*` versions are in here because a plugin
 * upgrade is native code too.
 */
const SHELL = [
  'capacitor.config.ts',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/res/xml/file_paths.xml',
  'android/app/build.gradle',
  'android/app/capacitor.build.gradle',
  'android/capacitor.settings.gradle',
  'android/variables.gradle',
  'android/app/src/main/java/com/manhlong/bobashop/phaser/MainActivity.java',
  'android/app/src/main/java/com/manhlong/bobashop/phaser/InstallPlugin.java',
  'ios/App/App/Info.plist',
  'ios/App/App/AppDelegate.swift',
  'ios/App/CapApp-SPM/Package.swift',
];

function fingerprint() {
  const hash = crypto.createHash('sha256');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const native = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter(([name]) => name.startsWith('@capacitor/'))
    .sort();
  hash.update(JSON.stringify(native));
  for (const file of SHELL) {
    const full = path.join(root, file);
    hash.update(file);
    hash.update(fs.existsSync(full) ? fs.readFileSync(full) : Buffer.from('(missing)'));
  }
  return hash.digest('hex').slice(0, 16);
}

/** The shell as it was when NATIVE_VERSION last moved. Re-record both together, never one. */
const BUILT = { nativeVersion: 2, fingerprint: 'd479ea84c330c611' };

const now = fingerprint();
assert.equal(NATIVE_VERSION, BUILT.nativeVersion,
  `NATIVE_VERSION is ${NATIVE_VERSION} but this check was recorded at ${BUILT.nativeVersion}. ` +
  'Re-record BUILT in tools/check-updates.cjs when you bump it.');
assert.equal(now, BUILT.fingerprint,
  'The native shell changed but NATIVE_VERSION did not.\n' +
  `  Bump NATIVE_VERSION in src/updates/native.ts, set BUILT = { nativeVersion: <that>, fingerprint: '${now}' } here,\n` +
  '  and run the "Build apps" workflow before the next deploy — an update cannot carry this change,\n' +
  '  and until a file exists, installed apps are told there is nothing they can do.');

// The workflow reads the number out of that file with this exact shape. A refactor that breaks it
// would tag every release with the wrong shell, which is the one thing worse than not tagging it.
const declared = /NATIVE_VERSION = (\d+)/.exec(fs.readFileSync(path.join(root, 'src/updates/native.ts'), 'utf8'));
assert.ok(declared && Number(declared[1]) === NATIVE_VERSION, 'The workflow can read NATIVE_VERSION out of native.ts');

// ============================================================ which kind of new version it is
const manifest = (webBuild, nativeVersion, files) => ({ webBuild, nativeVersion, files });
const FILES = { 'index.html': 100, 'assets/index-aaa.js': 1000, 'assets/cup-bbb.png': 5000, 'sw.js': 50 };
const here = { webBuild: 'commit-1', nativeVersion: 2 };

assert.deepEqual(decide(here, null), { kind: 'none' }, 'A site that cannot be reached is not news');
assert.deepEqual(decide(here, manifest('commit-1', 2, FILES)), { kind: 'none' }, 'The build this app is running is not news');
assert.equal(decide(here, manifest('commit-2', 2, FILES)).kind, 'live', 'A newer web build is an update');
assert.equal(decide(here, manifest('commit-2', 3, FILES)).kind, 'newFile',
  'A build that wants a newer shell cannot be delivered over the air');
assert.equal(decide(here, manifest('commit-2', 1, FILES)).kind, 'live',
  'A site still on an older shell than this app is nothing to install, only something to update to');

// --- what an update actually costs
const next = manifest('commit-2', 2, { ...FILES, 'assets/index-ccc.js': 1200, 'assets/index-aaa.js': undefined });
delete next.files['assets/index-aaa.js'];
const work = plan(manifest('commit-1', 2, FILES), next);
assert.deepEqual(work.copy, ['assets/cup-bbb.png'], 'A hashed file with the same name is the same file, and is copied');
assert.deepEqual(work.fetch.sort(), ['assets/index-ccc.js', 'index.html', 'sw.js'],
  'The page and the fixed names are always fetched; so is a hashed name this build has not got');
assert.equal(work.bytes, 1200 + 100 + 50, 'And that is what the download is');
const fresh = plan(null, next);
assert.equal(fresh.copy.length, 0, 'An app running the build inside its own package can copy nothing');
assert.equal(fresh.fetch.length, Object.keys(next.files).length, 'so the first update is the whole build');
// A file that changed under the same name is not reused: same name, different size is not the
// same file, and `index.html` changes every build without ever changing its name.
const resized = plan(manifest('commit-1', 2, FILES), manifest('commit-2', 2, { ...FILES, 'assets/cup-bbb.png': 5001 }));
assert.ok(resized.fetch.includes('assets/cup-bbb.png'), 'A different size under the same name is fetched again');

assert.deepEqual(directories(manifest('x', 1, { 'index.html': 1, 'assets/a/b.js': 2 })), ['assets', 'assets/a'],
  'Every directory the files need, outermost first');

// --- the manifest off the wire is not to be trusted
assert.equal(parseManifest(null), null);
assert.equal(parseManifest({ webBuild: 'x', nativeVersion: 2 }), null, 'A manifest with no files is not one');
assert.equal(parseManifest({ webBuild: 'x', nativeVersion: 2, files: { 'assets/a.js': 1 } }), null,
  'A build with no page is not one');
assert.equal(parseManifest({ webBuild: 'x', nativeVersion: 0, files: { 'index.html': 1 } }), null,
  'A shell version below the first one is not one');
for (const bad of ['../../etc/passwd', '/etc/passwd', 'a\\b', '']) {
  assert.equal(parseManifest({ webBuild: 'x', nativeVersion: 2, files: { 'index.html': 1, [bad]: 1 } }), null,
    `A path that leaves the update's own directory is refused: ${JSON.stringify(bad)}`);
}
assert.ok(parseManifest({ webBuild: 'x', nativeVersion: 2, files: { 'index.html': 1 } }), 'A plain one reads back');

// --- a site caught mid-deploy is not an update
const page = '<script type="module" src="/assets/index-aaa.js"></script><link rel="stylesheet" href="/assets/app.css">';
const whole = manifest('commit-1', 2, { 'index.html': 1, 'assets/index-aaa.js': 2, 'assets/app.css': 3 });
assert.deepEqual(pageAsks(page), ['assets/index-aaa.js', 'assets/app.css'], 'The page names the files it needs');
assert.equal(isWhole(page, whole), true, 'A page whose files are all in the manifest is that build');
assert.equal(isWhole(page, manifest('commit-2', 2, { 'index.html': 1, 'assets/index-bbb.js': 2, 'assets/app.css': 3 })), false,
  'A page asking for a bundle the manifest has never heard of is the old page beside the new manifest');
assert.equal(isWhole('<html>nothing here</html>', whole), false, 'A page that asks for nothing is not a build either');
// The page this repository actually builds has to pass its own check.
const dist = path.join(root, 'dist');
if (fs.existsSync(path.join(dist, 'update.json'))) {
  assert.ok(isWhole(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'),
    JSON.parse(fs.readFileSync(path.join(dist, 'update.json'), 'utf8'))),
    'The built page and the manifest written beside it agree');
}

// ============================================================ the file, when one is needed
const release = parseRelease({
  tag_name: 'v3.58',
  html_url: 'https://github.com/LongBoDoi/boba-shop/releases/tag/v3.58',
  assets: [{ name: 'tiem-tra-sua-58.apk', browser_download_url: 'https://example/app.apk', size: 48 * 1024 * 1024 }],
});
assert.ok(release, 'A release reads');
assert.equal(release.nativeVersion, 3, 'The tag says which shell the file contains');
assert.equal(release.apkBytes, 48 * 1024 * 1024);
assert.equal(needsNewBuild(2, release), true, 'A file with a newer shell is offered');
assert.equal(needsNewBuild(3, release), false, 'The shell already installed is not offered');
assert.equal(needsNewBuild(4, release), false, 'Nor is an older one');
assert.equal(needsNewBuild(2, null), false, 'And no release is nothing to offer');
assert.equal(parseRelease({ tag_name: 'v3.58', html_url: 'u', draft: true }), null, 'A draft is not published');
assert.equal(parseRelease({ tag_name: 'v3.58', html_url: 'u', prerelease: true }), null, 'A prerelease is not for players');
assert.equal(parseRelease({ html_url: 'u' }), null, 'A release with no tag is not one');
assert.equal(parseRelease({ tag_name: 'v3.58', html_url: 'u' }).apkUrl, null, 'A release with no .apk says so');
assert.ok(compareVersions('2.10', '2.9') > 0, 'Versions order by number, not by text');

// ============================================================ asking the site, from inside the app
let siteChecks = Promise.resolve();
/**
 * The site is read in **native** code, and this is the check that keeps it that way.
 *
 * `fetch` cannot read it from inside the app: the WebView's origin is `https://localhost`, every
 * request to the site is therefore cross-origin, and a static file on the host carries no
 * `Access-Control-Allow-Origin`. The browser refuses the response, `fetchManifest` catches the
 * `TypeError` and answers "nothing to report" — which is indistinguishable from an app that is
 * up to date, and is why two releases went by with no card on anybody's phone and nothing in any
 * log. There is no test a browser can run that would have caught it, so what is pinned here is
 * the shape of the fix: the request goes through `CapacitorHttp`, and both of the response shapes
 * the two platforms hand back are read.
 */
const liveSource = fs.readFileSync(path.join(root, 'src/updates/live.ts'), 'utf8');
assert.match(liveSource, /CapacitorHttp\.get\(/, 'The site is asked through native HTTP');
assert.doesNotMatch(liveSource, /fetch\(\s*`\$\{SITE\}/,
  'A site read through `fetch` is blocked by CORS in the app and fails silently — use `readSite`.');

{
  const Module = require('node:module');
  const served = {
    'update.json': { status: 200, data: { webBuild: 'commit-2', nativeVersion: 2, files: { 'index.html': 1, 'assets/index-aaa.js': 2 } } },
    'index.html': { status: 200, data: '<script type="module" src="/assets/index-aaa.js"></script>' },
  };
  const asked = [];
  const core = {
    Capacitor: { isNativePlatform: () => true },
    CapacitorHttp: {
      get: async ({ url }) => {
        const file = url.replace(/^.*\//, '');
        asked.push(file);
        // Anything not laid out above is a 404, the same as it would be off the real host.
        return served[file] ?? { status: 404, data: '' };
      },
    },
    WebView: { getServerBasePath: async () => ({ path: '' }) },
  };
  const filesystem = { Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' }, Filesystem: {} };
  const load = Module._load;
  Module._load = (request, ...rest) => {
    if (request === '@capacitor/core') return core;
    if (request === '@capacitor/filesystem') return filesystem;
    return load(request, ...rest);
  };
  let live;
  try {
    live = require(path.join(root, 'src/updates/live.ts'));
  } finally {
    Module._load = load;
  }

  // Its own complaints are part of what it does: a check that goes quiet has to say why, because
  // the quiet itself is what cannot be told apart from an app that is up to date.
  const said = [];
  const read = async () => {
    const warn = console.warn;
    console.warn = (...parts) => said.push(parts.join(' '));
    try {
      const found = await live.fetchManifest();
      return found && found.webBuild;
    } finally {
      console.warn = warn;
    }
  };

  siteChecks = (async () => {
    // Android parses a JSON response before it reaches the page; iOS hands back the text. The
    // manifest has to read the same either way, and only one of the two can be tried on a desk.
    assert.equal(await read(), 'commit-2', 'The manifest reads when the response arrives parsed');
    served['update.json'].data = JSON.stringify(served['update.json'].data);
    assert.equal(await read(), 'commit-2', 'and when it arrives as text');
    assert.deepEqual(asked.slice(0, 2), ['update.json', 'index.html'], 'The page is held against the manifest');

    // The two silences that are not an update, told apart from each other only in the log.
    served['index.html'].data = '<script type="module" src="/assets/index-bbb.js"></script>';
    assert.equal(await read(), null, 'A site caught mid-deploy is a wait, not an update');
    served['index.html'].data = '<script type="module" src="/assets/index-aaa.js"></script>';
    served['update.json'] = { status: 503, data: '' };
    assert.equal(await read(), null, 'A site that answers badly is nothing to report');

    assert.match(said.join('\n'), /mid-deploy/, 'and a deploy in flight says so');
    assert.match(said.join('\n'), /answered 503/, 'as does a host that will not answer');
  })();
}

siteChecks.then(() => {
  console.log(`check-updates: the shell is ${now} at native version ${NATIVE_VERSION}; ` +
    'updates, new files and what each costs.');
}, (error) => {
  console.error(error);
  process.exit(1);
});
