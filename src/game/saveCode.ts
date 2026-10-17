import { GameState } from './reducer';
import { parseGame, serializeGame } from './save';

/**
 * The shop, as a line of text the player keeps.
 *
 * `save.ts` writes the shop into storage that the device owns; this writes it into something the
 * *player* owns. The difference matters at exactly one moment: a reinstall. An Android update
 * installed over the top keeps its data, and `android.allowBackup` may bring it back from Google's
 * backup — but a true uninstall takes it, and on iOS a build re-signed with Sideloadly is a fresh
 * install every time. Neither of those can be fixed from inside the app, and the only remedy that
 * needs no account, no server and no paid developer programme is a code the player can paste back.
 *
 * Four decisions:
 *
 * - **It is the same bytes `save.ts` already writes**, wrapped rather than re-described. A second
 *   serializer would be a second thing to keep in step with `GameState`, and the first one to fall
 *   behind would be the one nobody tests — and it would fall behind silently, because a code is
 *   only ever read back weeks later on a different phone.
 * - **Base64 over UTF-8, hand-rolled.** The save carries customer names with Vietnamese
 *   diacritics, and raw JSON full of quotes, braces and accented letters is the kind of string
 *   that a chat app helpfully "corrects" on the way through. Base64 reduces it to sixty-four
 *   characters that survive being pasted anywhere. It is written out below rather than taken from
 *   a library because `btoa` is not reliably present in a React Native runtime and the dependency
 *   would be native code for forty lines of arithmetic.
 * - **It carries a checksum.** A code is copied by hand and arrives truncated often enough to
 *   matter. A truncated base64 blob usually still parses into *something*, and restoring half a
 *   shop over a whole one is the one outcome worse than refusing.
 * - **A code is refused rather than patched**, exactly as a save in storage is: `parseGame` is the
 *   same gate, so a code from a build whose ingredients no longer exist is turned down here too.
 */

/** The prefix is the format's version, and the full stop keeps it from reading as part of the blob. */
const PREFIX = 'TTS1.';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 bytes, without `TextEncoder` — Hermes has it, but a worklet-era runtime is not promised it. */
function toBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // A surrogate pair is one character in two slots; put it back together before encoding.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function fromBytes(bytes: number[]): string {
  let text = '';
  for (let i = 0; i < bytes.length; ) {
    const byte = bytes[i];
    let code: number;
    let width: number;
    if (byte < 0x80) { code = byte; width = 1; }
    else if ((byte & 0xe0) === 0xc0) { code = byte & 0x1f; width = 2; }
    else if ((byte & 0xf0) === 0xe0) { code = byte & 0x0f; width = 3; }
    else if ((byte & 0xf8) === 0xf0) { code = byte & 0x07; width = 4; }
    else return ''; // a byte that cannot start a character: the code is not what it claims to be
    if (i + width > bytes.length) return '';
    for (let k = 1; k < width; k++) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) return '';
      code = (code << 6) | (next & 0x3f);
    }
    i += width;
    if (code > 0xffff) {
      code -= 0x10000;
      text += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else text += String.fromCharCode(code);
  }
  return text;
}

function encode64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const c = i + 2 < bytes.length ? bytes[i + 2] : -1;
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | (b < 0 ? 0 : b >> 4)];
    out += b < 0 ? '=' : ALPHABET[((b & 15) << 2) | (c < 0 ? 0 : c >> 6)];
    out += c < 0 ? '=' : ALPHABET[c & 63];
  }
  return out;
}

function decode64(text: string): number[] | null {
  const body = text.replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let held = 0;
  for (const character of body) {
    const value = ALPHABET.indexOf(character);
    if (value < 0) return null;
    held = (held << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((held >> bits) & 0xff);
    }
  }
  return bytes;
}

/**
 * A short, case-insensitive fingerprint of the payload (FNV-1a, base-36).
 *
 * Not a security measure — nothing here is secret, and a player who wants to hand themselves a
 * million units of money can edit `localStorage` on the web far more easily. It is only there to
 * tell a code that arrived whole from one that lost its tail in a chat window.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0').slice(-7);
}

/** The shop as one line of text. */
export function encodeSaveCode(state: GameState): string {
  const payload = encode64(toBytes(serializeGame(state)));
  return `${PREFIX}${payload}.${fingerprint(payload)}`;
}

/**
 * A pasted code back into a shop, or `null` if it is not one.
 *
 * Whitespace is forgiven throughout, because a code that has been through a chat window or an
 * email arrives with line breaks in it — and a player who has just lost their phone should not
 * also have to clean up a string by hand.
 */
export function decodeSaveCode(code: string): GameState | null {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(PREFIX)) return null;
  const rest = trimmed.slice(PREFIX.length);
  const split = rest.lastIndexOf('.');
  if (split <= 0) return null;
  const payload = rest.slice(0, split);
  if (fingerprint(payload) !== rest.slice(split + 1).toLowerCase()) return null;
  const bytes = decode64(payload);
  if (!bytes) return null;
  const json = fromBytes(bytes);
  if (!json) return null;
  // The same gate storage goes through, so a code from a build this one cannot read is refused
  // here rather than half-restored. `parseGame` also brings a running shift back paused.
  return parseGame(json);
}