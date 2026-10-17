/*
 * Run with node tools/check-reinstall.cjs.
 *
 * The two halves of surviving a reinstall:
 *
 * - **the backup code** (`src/game/saveCode.ts`) — the shop as a line of text the player keeps;
 * - **the new-build offer** (`src/updates/release.ts`) — noticing that a version exists which no
 *   over-the-air update can reach.
 *
 * Both are worth a script for the same reason: they are only ever exercised weeks later, on a
 * different phone, by a player who has just lost something. A code that silently restores half a
 * shop, or an offer that fires on every launch for a version the player already has, would both
 * look fine in a diff and in a browser.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const { createInitialState, gameReducer } = require(path.join(root, 'src/game/reducer.ts'));
const { serializeGame } = require(path.join(root, 'src/game/save.ts'));
const { encodeSaveCode, decodeSaveCode } = require(path.join(root, 'src/game/saveCode.ts'));
const { compareVersions, parseRelease, needsNewBuild } = require(path.join(root, 'src/updates/release.ts'));

// ============================================================ the backup code
/** A shop that has actually been played: a part-built cup, money taken, customers waiting. */
function playedShop() {
  let state = gameReducer(createInitialState(31_337), { type: 'START_DAY', day: 4 });
  state = gameReducer(state, { type: 'TICK', dt: 6_000 });
  const slot = state.slots.findIndex(Boolean);
  assert.ok(slot >= 0, 'a customer arrives');
  state = gameReducer(state, { type: 'TAKE_ORDER', slot });
  state = gameReducer(state, { type: 'POUR', category: 'tea', optionId: state.slots[slot].order.tea, amount: 0.5 });
  state = gameReducer(state, { type: 'ICE_SCOOP' });
  state = gameReducer(state, { type: 'SET_AUDIO', audio: { music: 0.35, sfx: 0.7 } });
  return gameReducer(state, { type: 'TICK', dt: 2_000 });
}

const shop = playedShop();
const code = encodeSaveCode(shop);

assert.match(code, /^TTS1\.[A-Za-z0-9+/=]+\.[a-z0-9]+$/, 'A code is a version, a payload and a fingerprint');
assert.ok(!/\s/.test(code), 'A code has no whitespace of its own to be mangled');

const back = decodeSaveCode(code);
assert.ok(back, 'A code comes back');
assert.equal(back.day, shop.day, 'Same day');
assert.equal(back.clock, shop.clock, 'Same point in the day');
assert.equal(back.money, shop.money, 'Same till');
assert.deepEqual(back.cup, shop.cup, 'Same cup on the coaster');
assert.deepEqual(back.build, shop.build, 'Built the same way');
assert.deepEqual(back.audio, shop.audio, 'As loud as it was left');
// The code is the same bytes storage holds, so the two can never drift apart; a restored shift
// also comes back paused, because it goes through the same `parseGame` a stored one does.
assert.equal(serializeGame(back), serializeGame(shop), 'A code is exactly what the save would have been');
assert.equal(back.paused, true, 'A restored shift comes back behind the pause card');

/**
 * Text outside ASCII survives the trip — the whole reason the payload is base64 over UTF-8 rather
 * than the raw JSON, since a shop is full of diacritics and they go through chat windows.
 *
 * The name is planted rather than taken from whatever the seed drew. The first version of this
 * read the generated customers and asserted one of them was non-ASCII, and the seed obliged with
 * three plain ones — so it passed while proving nothing. Planted, it also reaches the four-byte
 * path: 🧋 is one character in two JavaScript slots, and the surrogate pair has to be put back
 * together on the way in and taken apart again on the way out.
 */
const awkward = 'Nguyễn Thị Hồng Đào 🧋 ăâêôơư';
const slots = [...shop.slots];
const first = slots.findIndex(Boolean);
assert.ok(first >= 0, 'somebody is at the counter');
slots[first] = { ...slots[first], name: awkward };
const awkwardShop = { ...shop, slots };
const named = decodeSaveCode(encodeSaveCode(awkwardShop));
assert.ok(named, 'A shop with awkward text in it still encodes');
assert.equal(named.slots[first].name, awkward, 'Diacritics and a four-byte emoji come back intact');

/**
 * And the payload is **real** base64 of **real** UTF-8, checked against Node's own encoder.
 *
 * A round trip cannot tell you this, which is the point of doing it the hard way: break the
 * surrogate-pair branch in `toBytes` and each half of 🧋 is encoded as its own three-byte
 * sequence — CESU-8, not UTF-8 — and `fromBytes` reverses that just as happily, so the shop comes
 * back perfect and the bytes in between are wrong. Harmless while this decoder is the only reader
 * of them, and a silent trap the moment anything else looks, so it is pinned to the reference.
 */
assert.equal(
  encodeSaveCode(awkwardShop).slice('TTS1.'.length).split('.')[0],
  Buffer.from(serializeGame(awkwardShop), 'utf8').toString('base64'),
  'The payload is base64 of UTF-8, byte for byte what Node would produce',
);

// --- the refusals. Each of these used to be a way to restore something that is not a shop.
assert.equal(decodeSaveCode(''), null, 'Nothing is not a code');
assert.equal(decodeSaveCode('hello'), null, 'Neither is prose');
assert.equal(decodeSaveCode(code.slice(0, -1)), null, 'A code missing its last character is refused');
assert.equal(decodeSaveCode(code.slice(0, code.length / 2)), null, 'A truncated code is refused');
assert.equal(decodeSaveCode(code.replace('TTS1.', 'TTS9.')), null, 'A format this build cannot read is refused');
// Flip one character of the payload: the fingerprint is the only thing that notices, and this is
// the case it exists for — base64 damaged in the middle still decodes into *something*.
const middle = Math.floor(code.length / 2);
const flipped = code.slice(0, middle) + (code[middle] === 'A' ? 'B' : 'A') + code.slice(middle + 1);
assert.equal(decodeSaveCode(flipped), null, 'A code corrupted in the middle is refused, not half-restored');

// --- the forgiveness. A code out of an email arrives wrapped, and a player who has just lost
//     their phone should not have to tidy a string by hand.
const wrapped = `${code.slice(0, 40)}\n  ${code.slice(40, 90)}\r\n${code.slice(90)}  `;
assert.ok(decodeSaveCode(wrapped), 'Line breaks and stray spaces are forgiven');
assert.equal(serializeGame(decodeSaveCode(wrapped)), serializeGame(shop), 'And change nothing about the shop');

// --- a title-screen shop round-trips too, so a player can back up before they have played
assert.ok(decodeSaveCode(encodeSaveCode(createInitialState(1))), 'A brand new shop is still a shop');

// --- RESTORE puts it back wholesale
const elsewhere = gameReducer(createInitialState(9), { type: 'START_DAY', day: 1 });
const restored = gameReducer(elsewhere, { type: 'RESTORE', state: back });
assert.equal(serializeGame(restored), serializeGame(shop), 'RESTORE replaces the shop with the code it was given');

// ============================================================ the new-build offer
assert.ok(compareVersions('1.2.0', '1.1.0') > 0, '1.2.0 is newer than 1.1.0');
assert.ok(compareVersions('1.10.0', '1.9.0') > 0, 'Versions compare as numbers, not as text');
assert.equal(compareVersions('1.2.0', '1.2'), 0, 'A missing segment is a zero');
assert.equal(compareVersions('v1.2.0', '1.2.0'), 0, 'A tag and a version are the same thing');
assert.ok(compareVersions('1.2.0', '1.2.0') === 0, 'Equal versions are equal');

const release = parseRelease({
  tag_name: 'v1.3.0+42',
  html_url: 'https://github.com/LongBoDoi/boba-shop/releases/tag/v1.3.0+42',
  assets: [
    { name: 'boba-shop-1.3.0-unsigned.ipa', browser_download_url: 'https://example.invalid/i', size: 50 },
    { name: 'boba-shop-1.3.0.apk', browser_download_url: 'https://example.invalid/a', size: 99_614_720 },
  ],
});
assert.ok(release, 'A release is read');
assert.equal(release.version, '1.3.0', 'The version comes out of the tag, not out of the prose title');
assert.equal(release.apkUrl, 'https://example.invalid/a', 'The .apk is picked out of the assets');
assert.equal(release.apkBytes, 99_614_720, 'And its size, so the player can be told before a 95 MB download');

assert.equal(parseRelease({ tag_name: 'v2.0.0', html_url: 'u', draft: true }), null, 'A draft is not published');
assert.equal(parseRelease({ tag_name: 'v2.0.0', html_url: 'u', prerelease: true }), null, 'A prerelease is not for players');
assert.equal(parseRelease({ html_url: 'u' }), null, 'A release with no tag is not one');
assert.equal(parseRelease(null), null, 'Neither is nothing');
assert.equal(parseRelease({ tag_name: 'v1.0.0', html_url: 'u' }).apkUrl, null, 'A release with no .apk says so');

// --- when to speak up, and when to stay quiet. The second of these is the one that matters: the
//     offer is a 95 MB download, and firing it at a player who is already current is the failure.
assert.equal(needsNewBuild('1.2.0', release), true, 'A newer release is offered');
assert.equal(needsNewBuild('1.3.0', release), false, 'The version already installed is not offered');
assert.equal(needsNewBuild('1.4.0', release), false, 'Nor is an older release than the one installed');
assert.equal(needsNewBuild(null, release), false, 'An unreadable installed version is never evidence of being behind');
assert.equal(needsNewBuild('1.2.0', null), false, 'And no release is nothing to offer');
// A rebuild at the same version is an update's job, and offering a reinstall for it would ask the
// player for 95 MB to get what they could have had over the air.
assert.equal(
  needsNewBuild('1.3.0', parseRelease({ tag_name: 'v1.3.0+99', html_url: 'u', assets: [] })),
  false,
  'A rebuild at the same version is left to the over-the-air update',
);

// ============================================================ what keeps the shop across an install
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
assert.notEqual(app.android?.allowBackup, false, 'Android has to be allowed to back the shop up');
assert.ok(
  (app.android?.permissions ?? []).includes('android.permission.REQUEST_INSTALL_PACKAGES'),
  'The in-place install needs REQUEST_INSTALL_PACKAGES, and an in-place install is what keeps the data',
);

console.log(
  `check-reinstall: a ${code.length}-character code round-trips (diacritics intact), ` +
    'refuses truncation and corruption; the new-build offer fires only on a genuinely newer version.',
);
