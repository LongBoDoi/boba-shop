/*
 * Run with node tools/check-native-audio-api.cjs.
 *
 * Holds the one gap in `expo-audio` that a browser cannot show you: **its web player and its
 * native players do not accept the same writes.**
 *
 * The web player (`AudioPlayer.web.js`) is an ordinary class, so every documented property has a
 * real setter. The native players are declared through `expo-modules-core`, where a property gets
 * a setter only if its declaration carries a `.set { }` — and `playbackRate` does not, on either
 * platform. Assigning to it therefore throws a `TypeError` in the bundle's strict mode.
 *
 * That cost the game every one-shot sound on a real phone. The assignment sat between the volume
 * and the `play()` inside one `try`, so the throw was caught, logged to a console nobody reads on
 * a device, and the `play()` never ran — while the music and the pour loop, which reach `play()`
 * without touching the rate, carried on as though all was well. It is invisible in a diff, it is
 * invisible in `tsc` (the TypeScript types declare `playbackRate` as a plain mutable property on
 * all platforms), and it is invisible in a browser, which is the only thing that can be driven
 * here.
 *
 * So this reads the SDK's own Swift and Kotlin and fails if the game writes a player member that
 * one of them will not accept. It re-checks itself against every SDK upgrade for free.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const SDK = path.join(root, 'node_modules', 'expo-audio');

/**
 * The properties of one `Class(...) { }` block, and whether each one can be written.
 *
 * Both native files declare several classes — `AudioPlayer`, `AudioPlaylist`, `AudioRecorder` —
 * and they share property names while disagreeing about setters: `playbackRate` *is* settable on
 * `AudioPlaylist`. Scoping to the right block is the whole point, so the end of the block is
 * found rather than assumed.
 */
function properties(source, open, nextClass) {
  const from = source.indexOf(open);
  assert.ok(from >= 0, `could not find ${open} — expo-audio's layout changed, so this check needs rewriting`);
  const rest = source.slice(from + open.length);
  const to = rest.search(nextClass);
  const block = to >= 0 ? rest.slice(0, to) : rest;

  const found = new Map();
  // Each declaration runs from its own `Property("x")` to the next one (or the end of the class),
  // so a `.set { }` is attributed to the property it actually belongs to. Reading a fixed number
  // of lines ahead instead is how this was first got wrong: the window ran past the end of
  // `playbackRate` and picked up the setter belonging to `volume` underneath it.
  const declarations = [...block.matchAll(/Property\("(\w+)"\)/g)];
  declarations.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < declarations.length ? declarations[index + 1].index : block.length;
    found.set(match[1], /\.set\s*[({]/.test(block.slice(start, end)));
  });
  assert.ok(found.size > 5, `expected to read several properties from ${open}, got ${found.size}`);
  return found;
}

const kotlin = fs.readFileSync(
  path.join(SDK, 'android/src/main/java/expo/modules/audio/AudioModule.kt'), 'utf8');
const swift = fs.readFileSync(path.join(SDK, 'ios/AudioModule.swift'), 'utf8');
const web = fs.readFileSync(path.join(SDK, 'build/AudioPlayer.web.js'), 'utf8');

const android = properties(kotlin, 'Class(AudioPlayer::class) {', /Class\(Audio\w+::class\)/);
const ios = properties(swift, 'Class(AudioPlayer.self) {', /Class\(Audio\w+\.self\)/);

// ------------------------------------------------------------------ what the game writes
/**
 * Every member the game assigns on an audio player, read out of the source.
 *
 * Collected rather than listed, so a new write added anywhere under `src/audio/` is checked
 * without anyone remembering to come back here. Names that are not properties of the native
 * `AudioPlayer` at all — a `Voice`'s own `token`, `until`, `cue`, `gain` — fall out on their own,
 * because only names the SDK declares are looked up.
 */
const sources = fs
  .readdirSync(path.join(root, 'src', 'audio'))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, text: fs.readFileSync(path.join(root, 'src', 'audio', file), 'utf8') }));

const writes = new Map();
for (const { file, text } of sources) {
  // `...player.x = `, `...Player.x = `, with any chain in between, and not `==`/`=>`.
  for (const match of text.matchAll(/\b(\w*[Pp]layer)(?:\.\w+)*\.(\w+)\s*=(?![=>])/g)) {
    if (!writes.has(match[2])) writes.set(match[2], new Set());
    writes.get(match[2]).add(file);
  }
}
assert.ok(writes.size > 0, 'expected to find some player writes under src/audio/');

const checked = [];
for (const [name, files] of writes) {
  const onAndroid = android.get(name);
  const onIos = ios.get(name);
  if (onAndroid === undefined && onIos === undefined) continue; // not an SDK player property
  const where = `${[...files].join(', ')}`;
  assert.notEqual(
    onAndroid, false,
    `${where} assigns player.${name}, but expo-audio declares it getter-only on Android — ` +
      `the assignment throws and whatever follows it in the same try never runs. ` +
      `Use the set${name[0].toUpperCase()}${name.slice(1)}() method instead.`,
  );
  assert.notEqual(
    onIos, false,
    `${where} assigns player.${name}, but expo-audio declares it getter-only on iOS — ` +
      `the assignment throws and whatever follows it in the same try never runs. ` +
      `Use the set${name[0].toUpperCase()}${name.slice(1)}() method instead.`,
  );
  checked.push(name);
}

// ------------------------------------------------------------------ the one we already paid for
/**
 * Named outright as well as caught by the sweep above, because this is the one that has already
 * shipped silent and the sweep can only see an assignment it recognises. If the rate ever goes
 * back to being set as a property, the message should say what it costs.
 */
assert.equal(android.get('playbackRate'), false, 'expo-audio still declares playbackRate getter-only on Android');
assert.equal(ios.get('playbackRate'), false, 'expo-audio still declares playbackRate getter-only on iOS');
assert.ok(
  !writes.has('playbackRate'),
  'Something under src/audio/ assigns player.playbackRate. It is getter-only on both phones and ' +
    'throws there, taking the play() after it down with it — every one-shot in the game went ' +
    'silent on a device this way. Call setPlaybackRate(rate) instead.',
);
assert.ok(
  sources.some(({ text }) => /\bsetPlaybackRate\(/.test(text)),
  'Nothing calls setPlaybackRate — the recorded cues vary their pitch, so something should',
);

// And the reason it only ever broke on a phone: the web player *does* take the assignment, which
// is why a browser played everything perfectly throughout.
assert.ok(
  /set playbackRate\(/.test(web),
  "expo-audio's web player no longer has a playbackRate setter — the asymmetry this check is " +
    'about has changed shape, so re-read it',
);

const settable = [...android].filter(([, can]) => can).length;
console.log(
  `check-native-audio-api: ${checked.length} written player ${checked.length === 1 ? 'member' : 'members'} ` +
    `(${checked.sort().join(', ')}) are settable on both phones; ` +
    `playbackRate still is not (${settable}/${android.size} Android properties are).`,
);
