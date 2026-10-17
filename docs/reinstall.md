# Updates that need a new file, and keeping the shop across one

The game has two kinds of new version, and they are not interchangeable.

| | over the air | a new file |
| --- | --- | --- |
| what changes | JavaScript, artwork | the native binary |
| how big | a few hundred kB | ~95 MB |
| who does it | `src/updates/useUpdate.ts` | `src/updates/useNewBuild.ts` |
| triggered by | every push to `main` | `expo.version` moving + a **Build apps** run |
| Android | in place, app restarts | installs over the top, **data kept** |
| iOS | in place, app restarts | a link; no app can install an `.ipa` |

## Why the second one had to exist

An update carries no native code. So the moment `expo.version` moves, every installed app at the
old version stops matching the updates being published — `checkForUpdateAsync` answers *nothing
new*, and the player sits several versions behind an app that looks perfectly current. Nothing
told them. That silence is what `useNewBuild` closes.

**It needs no new bookkeeping**, because the repository already keeps the invariant it needs:
`expo.version` moves if and only if a new binary is required, which is exactly what
`tools/check-updates.cjs` enforces. So the whole check is "is the latest GitHub release's version
ahead of `Updates.runtimeVersion`?" — no build numbers, no manifest archaeology, and no extra
native module to read the installed version with. A *rebuild* at the same version is left to the
over-the-air update, which is what it is for.

## The Android path keeps the shop, and that is the point

The `.apk` is downloaded with `expo-file-system`, turned into a `content://` URI through the
FileProvider that `expo-file-system` already declares, and handed to the system installer with
`expo-intent-launcher`. Two details that are easy to get wrong:

- the installer cannot read a `file://` path out of another app's sandbox, and
- the intent needs `FLAG_GRANT_READ_URI_PERMISSION` (flag `1`) along with the URI. Without it the
  installer opens and immediately calls the package invalid, with nothing to explain why.

Because every release is signed with the project's EAS keystore, this is an **update, not a
reinstall** — Android keeps the app's data, so the shop survives untouched and the dialog says so.
That is the only reason a sensitive permission (`REQUEST_INSTALL_PACKAGES`) is worth it here.

`tools/check-updates.cjs` asserts that the installer and the permission are **present**. It used to
assert the opposite, because the APK route was once the whole update mechanism and was dropped for
EAS Update. It is back for the narrow gap above only; the comment in that file says so, so nobody
reverts it on sight.

## iOS cannot do this, and pretending otherwise would cost a shop

No iOS app can install an `.ipa`. There is no API, no entitlement and no permission — this is iOS,
not Expo. So iOS is shown the release page, and because the repository's `.ipa` is unsigned,
re-signing it with Sideloadly or AltStore is usually a *fresh* install, which takes the app's data
with it. That is why the iOS wording is the one place in the game that tells the player to export
a backup **first**. Saying "your shop is kept" on both platforms would have been one sentence of
comfort and a lost week.

## Keeping the shop: three layers

1. **An in-place update keeps the data.** The Android route above, with nothing for the player to
   do. This is the normal case and the one to rely on.
2. **`android.allowBackup`** is written into `app.json` rather than left to Expo's default, because
   the save now leans on it: it is what can bring a shop back after a genuine uninstall.
   Best-effort and tied to the player's Google account, so it is a safety net and not a plan.
3. **A backup code the player keeps**, under "Sao lưu tiệm" in the settings card. The only remedy
   that works on iOS without a paid developer programme, and the only one that survives an
   uninstall for certain.

### The backup code

`src/game/saveCode.ts`. About a kilobyte of text for a mid-week shop:

```
TTS1.<base64 of the save JSON>.<fingerprint>
```

- **It is the same bytes `save.ts` already writes**, wrapped rather than re-described. A second
  serializer would be a second thing to keep in step with `GameState`, and the first one to fall
  behind would be the one nobody tests — and it would fall behind silently, because a code is only
  ever read back weeks later on a different phone.
- **Base64 over UTF-8, hand-rolled.** The save is full of Vietnamese names, and raw JSON of quotes,
  braces and accented letters is the kind of string a chat app helpfully "corrects" in transit.
  It is written out rather than taken from a library because `btoa` is not reliably present in a
  React Native runtime, and the dependency would be native code for forty lines of arithmetic.
- **The fingerprint is not security.** The web save sits in `localStorage` where anyone can edit
  it. It is there because a code copied by hand arrives truncated often enough to matter, and a
  truncated base64 blob usually still parses into *something* — restoring half a shop over a whole
  one is the one outcome worse than refusing.
- **`parseGame` is the same gate a stored save goes through**, so a restored shift comes back
  paused, and a code written by a build whose ingredients no longer exist is refused rather than
  half-applied.
- **Restoring asks twice**, because it replaces the whole shop including a shift in progress, and
  a mis-paste cannot be undone.

The code is shown in a read-only `TextInput` so that copying is the operating system's own job —
long-press, select all, copy — rather than another native dependency for one button. On the web
that needed an exception in `public/index.html`: the blanket `user-select: none !important` that
makes the page a game surface also made the code impossible to select, and the web is the one
platform with no long-press "select all" to fall back on. `input, textarea` now get `user-select:
text !important` back.

## When a change needs which

| change | version bump | new file | reaches installed apps |
| --- | --- | --- | --- |
| game logic, art, text, sounds | no | no | over the air, next launch |
| a new native dependency | **yes** | **yes** | only after the new file is installed |
| a new Expo SDK | **yes** | **yes** | same |
| a config plugin touching the manifest | **yes** | **yes** | same |

The trap worth naming: **a version bump makes the current over-the-air channel unreachable for
every already-installed app.** Published updates are stamped with the new runtime version, so an
app still on the old one sees nothing — including bug fixes that are pure JavaScript and would
otherwise have shipped in minutes. If a fix needs to reach phones *today*, publish it while
`expo.version` still says what those phones were built as, and land the native work after.

## Verification

`npm test` runs `tools/check-reinstall.cjs`, which covers:

- the code round-trips a played shop byte-for-byte against what the save would have written;
- diacritics and a four-byte emoji survive, and the payload is pinned against Node's own base64 —
  a round trip alone cannot tell UTF-8 from CESU-8, because this decoder reverses both;
- a truncated, corrupted, empty, prose or wrong-format code is **refused**, not half-applied;
- line breaks and stray spaces from an email are forgiven;
- `RESTORE` replaces the shop wholesale;
- the new-build offer fires on a genuinely newer version and **stays quiet** otherwise — including
  for a rebuild at the same version, and when the installed version cannot be read at all.

What no script here can check: the install itself. Handing an APK to the package installer, the
"allow from this source" prompt, and whether the data really is still there afterwards can only be
tried on a phone, with two builds signed by the same keystore. **It has not been tried on a device
here.** The iOS half is a `Linking.openURL`, which is as testable as it is interesting.
