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
    // Normalised to LF before hashing. Every one of these is a text file, git is left to
    // check them out with whatever line ending the machine prefers (there is no .gitattributes),
    // and on Windows that is CRLF — so the bytes on disk differ from the bytes in the commit
    // while the shell is plainly identical. Hashing them raw made this fail on one developer's
    // machine and pass in CI, which is the worst way for a check like this to be wrong: it cries
    // native change at somebody who has not touched the shell, and the way to make it stop is to
    // bump NATIVE_VERSION and ship a build nobody needed.
    const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '(missing)';
    hash.update(text.replace(/\r\n/g, '\n'));
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

// ============================================================ asking the site, and applying it
/**
 * The update mechanism against a **fake device**: a stub of the two plugins it works through.
 *
 * Everything from here down is phone-only in the sense that it cannot be driven in a browser, and
 * that is exactly why it is worth faking. Both bugs this file has caught so far were of a shape no
 * typechecker and no browser can see:
 *
 * - the site was read with `fetch`, which is blocked by CORS in a WebView served from
 *   `https://localhost`, and the check reads a refusal as "nothing to report" — so the mechanism
 *   was **silent**, which is what an app that is up to date looks like;
 * - the files were fetched with `Filesystem.downloadFile`, which writes straight to a stream and
 *   fails on a directory nobody made first.
 *
 * So the stub is written to be **strict where the device is strict**: a write or a copy into a
 * directory that does not exist is refused, exactly as the plugin refuses it. A stub that flatters
 * the code is worse than no stub (see the audio engine's `playbackRate`, which went green through
 * a whole outage).
 */
let siteChecks = Promise.resolve();
{
  const Module = require('node:module');

  const FILES = { 'index.html': 1, 'assets/index-aaa.js': 2, 'assets/cup-bbb.png': 3, 'sw.js': 4 };
  const SERVED = { webBuild: 'commit-2', nativeVersion: 2, files: FILES };
  const PAGE = '<script type="module" src="/assets/index-aaa.js"></script>';
  // One site serves one index.html, and both halves read it: the check holds it against the
  // manifest, and the update then writes that same page down as a file of the build.
  const body = (file) => (file === 'index.html' ? PAGE : `base64:${file}`);
  const site = { 'update.json': { status: 200, data: SERVED } };
  for (const path of Object.keys(FILES)) site[path] = { status: 200, data: body(path) };

  // The app's filesystem: directories it has, files it holds, and the order things happened in.
  // What the app's data directory is called on the device: `setServerBasePath` is handed the
  // absolute path, which is `getUri`'s answer with the `file://` taken off it.
  const HOME = '/data/user/0/com.manhlong.bobashop.phaser/files';
  const dirs = new Set();
  const disk = new Map();
  const order = [];
  const parentOf = (path) => path.split('/').slice(0, -1).join('/');
  const haveParent = (path) => parentOf(path) === '' || dirs.has(parentOf(path));
  // Every request the app makes, with what it asked the response to be: the check reads text, a
  // file of the build comes down as a blob, and telling them apart is how both are pinned.
  const asked = [];
  const downloaded = () => asked.filter(([, type]) => type === 'blob').map(([file]) => file);
  // **What a freshly installed app answers**, and the reason two updates failed: an app serving
  // the build inside its package reports its asset folder's name, which is neither a path nor
  // empty. The stub starts there, because that is where every app starts.
  let basePath = 'public';
  let persisted = 0;
  let mkdirWorks = true;

  let platform = 'android';
  const core = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => platform },
    CapacitorHttp: {
      get: async ({ url, responseType }) => {
        const file = url.replace(/^https:\/\/[^/]+\//, '');
        asked.push([file, responseType]);
        const answer = site[file] ?? { status: 404, data: '' };
        // A host that refuses once and relents, the way a rate limit does.
        if (answer.refuseOnce) {
          delete answer.refuseOnce;
          return { status: 429, data: '', headers: { 'Retry-After': '0' } };
        }
        return answer;
      },
    },
    WebView: {
      getServerBasePath: async () => ({ path: basePath }),
      setServerBasePath: async ({ path }) => { basePath = path; order.push(`serve ${path}`); },
      persistServerBasePath: async () => { persisted += 1; },
    },
  };
  const where = new Set();
  const filesystem = {
    Directory: { Data: 'DATA', Library: 'LIBRARY' },
    Encoding: { UTF8: 'utf8' },
    Filesystem: {
      mkdir: async ({ path, recursive }) => {
        if (!mkdirWorks) return;
        if (dirs.has(path)) throw new Error('Directory already exists');
        if (!recursive && !haveParent(path)) throw new Error('Parent directory does not exist');
        const parts = path.split('/');
        for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
      },
      rmdir: async ({ path }) => {
        if (!dirs.has(path)) throw new Error('Directory does not exist');
        for (const held of [...dirs]) if (held === path || held.startsWith(`${path}/`)) dirs.delete(held);
        for (const held of [...disk.keys()]) if (held.startsWith(`${path}/`)) disk.delete(held);
      },
      readdir: async ({ path }) => {
        if (!dirs.has(path)) throw new Error('Directory does not exist');
        const inside = new Set();
        for (const held of dirs) if (parentOf(held) === path) inside.add(held.split('/').pop());
        return { files: [...inside].map((name) => ({ name })) };
      },
      writeFile: async ({ path, data, recursive, directory }) => {
        where.add(directory);
        if (!haveParent(path)) {
          if (!recursive) throw new Error('File does not exist');
          const parts = parentOf(path).split('/');
          for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
        }
        disk.set(path, data);
        order.push(`write ${path}`);
      },
      copy: async ({ from, to }) => {
        // Recorded before it can fail, because "was a copy even attempted" is the question.
        order.push(`copy ${to}`);
        if (!disk.has(from)) throw new Error(`'copy' failed because file at '${from}' does not exist.`);
        // The real plugin refuses rather than making the destination's parent. See `mkdirp`.
        if (!haveParent(to)) throw new Error('Parent directory does not exist');
        disk.set(to, disk.get(from));
      },
      getUri: async ({ path }) => ({ uri: `file://${HOME}/${path}` }),
    },
  };

  // The app's **own** page, off its local server. `running()` asks for `update.json` relatively,
  // and the server answers out of whatever it is hosting: the package's own build while that is
  // `public`, and the downloaded directory once one is being served. Modelling that is the whole
  // point — an app reading its package's manifest and taking it for a directory on disk is the
  // bug this file exists to keep out.
  const BUNDLED = { webBuild: 'commit-1', nativeVersion: 2, files: FILES };
  globalThis.fetch = async (url) => {
    assert.equal(url, 'update.json', 'The app reads its own manifest relatively, off its own server');
    const held = basePath === 'public'
      ? JSON.stringify(BUNDLED)
      : disk.get(`${basePath.replace(`${HOME}/`, '')}/update.json`);
    return held === undefined ? { ok: false } : { ok: true, json: async () => JSON.parse(held) };
  };

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

  // --- the site is read in native code, and this is the check that keeps it that way
  const liveSource = fs.readFileSync(path.join(root, 'src/updates/live.ts'), 'utf8');
  assert.match(liveSource, /CapacitorHttp\.get\(/, 'The site is asked through native HTTP');
  assert.doesNotMatch(liveSource, /fetch\(\s*`\$\{SITE\}/,
    'A site read through `fetch` is blocked by CORS in the app and fails silently — use `readSite`.');
  assert.doesNotMatch(liveSource, /Filesystem\.downloadFile\(/,
    '`Filesystem.downloadFile` is the deprecated legacy path and writes into no directory of its own.');

  // Its own complaints are part of what it does: a check that goes quiet has to say why, because
  // the quiet itself is what cannot be told apart from an app that is up to date.
  const said = [];
  const quietly = async (run) => {
    const warn = console.warn;
    console.warn = (...parts) => said.push(parts.join(' '));
    try {
      return await run();
    } finally {
      console.warn = warn;
    }
  };
  const read = async () => {
    const found = await quietly(() => live.fetchManifest());
    return found && found.webBuild;
  };

  siteChecks = (async () => {
    // --- what the site is
    // Android parses a JSON response before it reaches the page; iOS hands back the text. The
    // manifest has to read the same either way, and only one of the two can be tried on a desk.
    assert.equal(await read(), 'commit-2', 'The manifest reads when the response arrives parsed');
    site['update.json'].data = JSON.stringify(SERVED);
    assert.equal(await read(), 'commit-2', 'and when it arrives as text');

    // The two silences that are not an update, told apart from each other only in the log.
    site['index.html'].data = '<script type="module" src="/assets/index-ccc.js"></script>';
    assert.equal(await read(), null, 'A site caught mid-deploy is a wait, not an update');
    site['index.html'].data = PAGE;
    site['update.json'] = { status: 503, data: '' };
    assert.equal(await read(), null, 'A site that answers badly is nothing to report');
    site['update.json'] = { status: 200, data: JSON.stringify(SERVED) };
    assert.match(said.join('\n'), /mid-deploy/, 'and a deploy in flight says so');
    assert.match(said.join('\n'), /answered 503/, 'as does a host that will not answer');

    // --- the first update an installed app does: nothing of its own to copy from
    // It has 22 MB of artwork inside its own package and not one byte of it can be copied, because
    // those files are in the APK rather than on the filesystem. An app that believes otherwise
    // tries to copy out of `builds/<the build it is running>`, which has never been a directory.
    const manifest = await live.fetchManifest();
    const seen = [];
    await live.applyUpdate(manifest, (progress) => seen.push(progress.done), () => false);

    assert.deepEqual(downloaded().sort(), Object.keys(FILES).sort(),
      'Every file of the build is fetched, because an app has nothing on disk to copy from');
    assert.deepEqual(order.filter((what) => what.startsWith('copy ')), [],
      'and nothing is copied out of the package it is running, which is not a directory');
    assert.deepEqual(asked.filter(([, type]) => type === 'text').map(([file]) => file).slice(-2),
      ['update.json', 'index.html'],
      'The check itself reads as text, and reads the page to hold it against the manifest');
    for (const file of Object.keys(FILES)) {
      assert.equal(disk.get(`builds/commit-2/${file}`), body(file), `${file} is written as itself`);
    }
    assert.equal(order.at(-1), `serve ${HOME}/builds/commit-2`,
      'The build is served, by its absolute path, only once it is all there');
    assert.equal(order.at(-2), 'write builds/commit-2/update.json',
      'and its manifest is the last file written, so a directory holding one is a whole build');
    assert.equal(seen.at(-1), 1, 'The bar reaches the end');

    // --- it boots, so it is kept, and the build it replaced is thrown away
    await quietly(() => live.settle());
    assert.equal(persisted, 1, 'A build that has booted is made permanent');

    // --- the next update copies what has not changed and fetches what has
    const NEXT = {
      webBuild: 'commit-3',
      nativeVersion: 2,
      files: { ...FILES, 'assets/index-ddd.js': 9, 'assets/index-aaa.js': undefined },
    };
    delete NEXT.files['assets/index-aaa.js'];
    for (const file of Object.keys(NEXT.files)) site[file] = { status: 200, data: body(file) };
    asked.length = 0;
    order.length = 0;
    await live.applyUpdate(NEXT, () => {}, () => false);
    assert.deepEqual(downloaded().sort(), ['assets/index-ddd.js', 'index.html', 'sw.js'],
      'Only the new bundle and the unhashed files come down; the artwork is copied across');
    assert.deepEqual(order.filter((what) => what.startsWith('copy ')), ['copy builds/commit-3/assets/cup-bbb.png'],
      'and the copy lands in a directory that was made first, which is why `mkdirp` may not fail quietly');
    assert.equal(disk.get('builds/commit-3/assets/cup-bbb.png'), 'base64:assets/cup-bbb.png',
      'A copied file is the file');

    // --- a file that cannot be copied comes down again rather than failing the update
    asked.length = 0;
    order.length = 0;
    disk.delete('builds/commit-3/assets/cup-bbb.png');
    await quietly(() => live.applyUpdate({ ...NEXT, webBuild: 'commit-6' }, () => {}, () => false));
    assert.ok(downloaded().includes('assets/cup-bbb.png'),
      'A file the build on disk has lost is fetched instead of failing the whole update');
    assert.equal(disk.get('builds/commit-6/assets/cup-bbb.png'), body('assets/cup-bbb.png'),
      'and it lands all the same');
    assert.match(said.join('\n'), /could not be copied/, 'and the log says how many and which');

    // --- a rate limit is a wait, not a failure
    // The host let 99 files through and refused the hundredth, and the update threw away 12 MB of
    // work over it. `Retry-After` is nothing here so the test does not sit about; what is pinned
    // is that the file is asked for again and that the update carries on through it.
    asked.length = 0;
    // `index.html` carries no hash, so it is always one of the files that comes down.
    site['index.html'].refuseOnce = true;
    await quietly(() => live.applyUpdate({ ...NEXT, webBuild: 'commit-7' }, () => {}, () => false));
    assert.equal(downloaded().filter((file) => file === 'index.html').length, 2,
      'A file the host turned away is asked for a second time');
    assert.equal(disk.get('builds/commit-7/index.html'), body('index.html'),
      'and the update finishes with it');

    // How long to wait is its own small decision, and the host gets the last word on it.
    assert.equal(live.waitFor(429, { 'Retry-After': '12' }, 1), 12_000, 'Retry-After is obeyed');
    assert.equal(live.waitFor(429, { 'retry-after': '2' }, 4), 2_000, 'whatever its capitals');
    assert.equal(live.waitFor(429, { 'Retry-After': '9999' }, 1), 60_000, 'but not past a minute');
    assert.ok(live.waitFor(429, {}, 1) >= 5_000, 'A rate limit with no advice waits a while');
    assert.ok(live.waitFor(503, {}, 1) < 1_000, 'where a hiccup asks again almost at once');
    assert.ok(live.waitFor(503, {}, 4) > live.waitFor(503, {}, 1), 'and each refusal waits longer');
    assert.equal(live.waitFor(503, {}, 20), 30_000, 'up to a cap');

    // --- a failure says which file and why, because the card is the only place anyone reads it
    // Neither on disk nor on the server: the fallback is not an excuse to finish without it.
    // `Retry-After: 0` only so this test does not sit through its own backoff.
    asked.length = 0;
    site['assets/index-ddd.js'] = { status: 500, data: '', headers: { 'Retry-After': '0' } };
    disk.delete(`${basePath.replace(`${HOME}/`, '')}/assets/index-ddd.js`);
    dirs.delete('builds/commit-4');
    await assert.rejects(
      () => quietly(() => live.applyUpdate({ ...NEXT, webBuild: 'commit-4' }, () => {}, () => false)),
      (error) => {
        assert.match(error.message, /assets\/index-ddd\.js/, 'The failure names the file');
        assert.match(error.message, /500/, 'and what the server said about it');
        return true;
      },
      'A file that cannot be fetched fails the update rather than half-applying it',
    );
    assert.equal(basePath, `${HOME}/builds/commit-7`, 'and what is being served does not move');
    assert.equal(downloaded().filter((file) => file === 'assets/index-ddd.js').length, 5,
      'A host having a moment is given every attempt before the update is called off');

    // A file the host does not have is not a moment, and asking four more times is just rude.
    asked.length = 0;
    site['assets/index-ddd.js'] = { status: 404, data: '' };
    await assert.rejects(
      () => quietly(() => live.applyUpdate({ ...NEXT, webBuild: 'commit-8' }, () => {}, () => false)),
      /404/,
      'A file that is not there fails the update');
    assert.equal(downloaded().filter((file) => file === 'assets/index-ddd.js').length, 1,
      'and is asked for exactly once');

    // --- the parents are made twice over, on purpose
    // `mkdirp` makes them for the copies, and every write asks for them again (`recursive`). The
    // belt is there because the braces are what broke: the downloader this replaced wrote straight
    // into a stream and failed on any directory that was not already there. So the writes have to
    // stand up on a device where nothing made one — which is what this pretends to be.
    site['assets/index-ddd.js'] = { status: 200, data: body('assets/index-ddd.js') };
    basePath = '';
    mkdirWorks = false;
    dirs.clear();
    await live.applyUpdate({ ...NEXT, webBuild: 'commit-5' }, () => {}, () => false);
    for (const file of Object.keys(NEXT.files)) {
      assert.equal(disk.get(`builds/commit-5/${file}`), body(file),
        `${file} lands even where no directory was made for it`);
    }

    // --- and an app back on the build inside its package keeps nothing
    // `public` must never be persisted as though it were a directory, and downloads nobody is
    // being served are dead weight. This is last because it empties the whole of `builds`.
    mkdirWorks = true;
    basePath = 'public';
    dirs.add('builds/leftover');
    const persistedBefore = persisted;
    await quietly(() => live.settle());
    assert.equal(persisted, persistedBefore, 'An app serving its own package persists nothing');
    assert.equal(dirs.has('builds/leftover'), false, 'and throws away what it is not serving');
    assert.deepEqual([...where], ['DATA'], 'Android keeps its builds in the app data directory');

    // --- iOS keeps its builds where iOS will look for them
    // It throws away everything but the last component of the persisted path and roots that at
    // `Library/NoCloud/ionic_built_snapshots`, without checking anything is there. A build written
    // anywhere else serves for one launch and comes back to a white screen. The strings matter:
    // they are Capacitor's, not ours.
    platform = 'ios';
    delete require.cache[require.resolve(path.join(root, 'src/updates/live.ts'))];
    Module._load = (request, ...rest) => {
      if (request === '@capacitor/core') return core;
      if (request === '@capacitor/filesystem') return filesystem;
      return load(request, ...rest);
    };
    let onIos;
    try {
      onIos = require(path.join(root, 'src/updates/live.ts'));
    } finally {
      Module._load = load;
    }
    where.clear();
    order.length = 0;
    basePath = 'public';
    await quietly(() => onIos.applyUpdate(NEXT, () => {}, () => false));
    assert.equal(order.at(-1), `serve ${HOME}/NoCloud/ionic_built_snapshots/commit-3`,
      'An iOS build is served out of the one directory iOS will come back to');
    assert.deepEqual([...where], ['LIBRARY'], 'which is under Library, not Documents');
  })();
}

siteChecks.then(() => {
  console.log(`check-updates: the shell is ${now} at native version ${NATIVE_VERSION}; ` +
    'updates, new files and what each costs.');
}, (error) => {
  console.error(error);
  process.exit(1);
});
