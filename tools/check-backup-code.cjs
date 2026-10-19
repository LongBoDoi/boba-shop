/*
 * Run with node tools/check-backup-code.cjs.
 *
 * **The backup code** (`src/game/saveCode.ts`) — the shop as a line of text the player keeps, and
 * the only way to carry a shop from one install to another, or from the installed page to the
 * installed app. It is worth a script of its own because it is only ever used weeks later, on a
 * different phone, by a player who has just lost something: a code that silently restores half a
 * shop would look fine in a diff and fine in a browser.
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

console.log(
  `check-backup-code: a ${code.length}-character code round-trips (diacritics intact) ` +
    'and refuses truncation and corruption.',
);
