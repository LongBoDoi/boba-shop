# Sound and music

Effects use a recorded Foley bank, replacing the former procedural synthesizer. There are 29
mono 24 kHz PCM clips (about 600 KB) edited from 14 CC0 recordings. Source credits ship with the
WAVs in [CREDITS.md](../src/assets/audio/CREDITS.md). They cover pouring, ice, a dispenser pump,
cup contacts, spoon scrapes, paper, a door bell, coins, splashes, a bag, footsteps, drops and cream.

## Runtime

- `src/audio/clips.ts`: generated asset IDs and measured durations, with static Metro requires.
- `src/audio/sounds.ts`: actions, alternate takes, layers, timing, levels, variation and priorities.
- `src/audio/foley.ts`: effects scheduling, player pool, cancellation and held-pour envelopes.
- `src/audio/audio.ts`: Expo lifecycle, browser unlock, foreground state, settings and music.
- `src/audio/webAudio.ts`: the web build's players — Web Audio, not `<audio>` elements. See
  "The web plays through Web Audio" below.
- `src/audio/useAudio.ts`: syncs settings, phase and pause without audio props or context.

Six common contacts and one stream player are warmed. Alternate takes load on demand. There
are at most 14 effect players plus the stream; idle players are reused, and lower/equal-priority
voices can be replaced. Quiet UI touches cannot steal critical serving sounds. Alternate takes
do not repeat consecutively within an action layer. Small speed and level variations sound like
different contacts; pitch follows speed naturally, with speech-style pitch correction disabled.

Recordings are mastered offline with low-mid body, presence shaping and look-ahead parallel
compression. Peak headroom is retained, while quieter liquid texture and contact tails come
forward. The compressor and filters use circular state for the stream. Primary gameplay cues
have higher gains, with extra ice settling, syrup liquid and reward layers. Music sits below
these foreground actions. Mastering runs only during asset generation, with no added app CPU cost.

Actions are sequences: cup contact then paper or bell for serving; cup impact then bag rustle
for discarding; receding footsteps for leaving. Cup contacts, bin impact and coins share timing
constants with visual motion. Picking up a cup cancels its pending landing contact.

A held tap has a start contact, a recorded stream, a 64 ms gain envelope and a release/drip tail.
The stream's pitch and level follow fill from elapsed pour time and the game pour rate, without
React renders or per-frame animation reads. An overlapping splice keeps the loop continuous.
Muting, game pause, scene changes, backgrounding and teardown cancel queued and active effects.
Returning never revives an abandoned pour. Settings controls remain audible while paused.
Late rewind promises are invalidated before their player can be reused or removed.

Serving cues follow `state.departures`, not feedback tone: taking an order also posts good
feedback. Arrivals and overflow are seeded from current state when restoring a saved shop.

The two original music loops remain separate and byte-identical. Music loads on demand and
crossfades with phase changes. Mixing with other audio and existing saved-volume
migration/clamping behavior are preserved. Recording and background audio remain disabled.

## The web plays through Web Audio

On the web, `audio.ts` hands `FoleyEngine` and the music `WebAudioPlayer`s instead of
`expo-audio` players. Native is unchanged.

`expo-audio`'s web player is one `HTMLAudioElement` per player, and this engine keeps a player per
voice: twenty-one at launch, past fifty over a shift. Each is a full media pipeline, and every cue
on a recycled voice drove one through pause, an asynchronous seek and a play, while the pour
envelope rewrote an element's volume every 16 ms. That is what made the web build stutter once
sound arrived — on a desktop and on a phone, and **with both volumes at 0 the lag went away**,
which is how it was found. No benchmark here showed it: a headless browser plays into a null
audio device, where all of that is free. The commit that added sound looked identical to the one
before it in every trace; only a real device could tell them apart.

`WebAudioPlayer` implements the slice of `AudioPlayer` the engine uses — `volume`, `loop`,
`playing`, `play`, `pause`, `seekTo`, `setPlaybackRate`, `remove` — with the same meaning:

- each clip is fetched and decoded **once** into an `AudioBuffer`, however many voices share it,
  and a clip that fails to load is silent for the session rather than refetched on every cue;
- a cue is a throwaway `AudioBufferSourceNode` on that buffer, through the voice's own gain node;
- a loop is sample-accurate (the buffer's own), which a media element's `loop` is not;
- rate moves pitch with speed; `shouldCorrectPitch` is accepted and ignored, because every
  caller sets it false.

The context starts suspended, as browsers require, and **which gesture unsuspends it is narrower
than it looks** — on a phone `touchstart` does not count, the `touchend` after it does. So it
listens for every candidate until the context is actually running, rather than trusting the first
event `audio.ts` sees. A hidden page suspends the context, so a background tab lets go of the
audio device.

It is chosen by what the runtime *has* (`AudioContext`), not by `Platform.OS` alone, so a browser
without Web Audio still gets sound the old way — and so do the tests, which have no audio device.
`check-audio-engine.cjs` drives the Web Audio path separately against a fake context.

## Two `expo-audio` traps a browser cannot show you

Both of these shipped a game whose effects were **silent on a real phone** while the whole suite
was green. `tools/check-native-audio-api.cjs` reads the SDK's own Swift and Kotlin to hold them.

**The playback rate is a method, never a property.** `playbackRate` is documented as a property,
and `AudioPlayer.web.js` is a plain class that gives it a real setter — so assigning to it is
flawless in a browser. On iOS and Android it is declared `Property("playbackRate")` with no
`.set`, i.e. getter-only (unlike `volume`, `loop` and `shouldCorrectPitch` beside it), so the
assignment throws a `TypeError` under the bundle's strict mode. In `foley.ts` it sat between the
volume and the `play()` inside a single `try`: the throw was caught, logged to a console nobody
reads on a device, and the `play()` never ran. Every one-shot was silent; the music and the pour
loop kept working because neither touches the rate on the way to `play()`, which is what made it
look like only *some* sounds were broken. Use `setPlaybackRate(rate)` — present on all three
platforms — and call it **before** `play()`, because iOS starts playback at `currentRate` and that
is the only thing that sets it.

**"Silent mode" means two different things.** iOS has a switch meant to silence exactly this kind
of app, so `playsInSilentMode` is `false` there. Android has no such switch: the flag consults
`ringerMode == RINGER_MODE_NORMAL`, which governs calls and notifications, not the media stream a
game plays on — and the check is at the top of the native `play()` and returns early, so a phone
on vibrate produced no sound at all with nothing on screen to explain it. The setting is
`Platform.OS !== 'ios'`.

The engine test's player stub is modelled on the **native** player, not the web one: `playbackRate`
is an accessor with no setter, so it throws in the harness exactly as on a device. A stub that
flatters the code is worse than no stub — this one went green through the whole outage.

## Rebuild or audition

Original public HQ MP3 downloads are in `tools/audio/recordings/`. Author, source page, CC0
license link and SHA-256 are in `tools/audio/recordings.json`. `tools/audio/cuts.json` records
every excerpt and output checksum. The game needs no network or Freesound account for sounds.

```sh
# Offline ffmpeg on PATH, or FFMPEG_PATH pointing to it.
node tools/audio/build-foley.cjs
# Optional: restore missing originals after checking CC0 on each source page.
node tools/audio/fetch-recordings.cjs
# Only rebuild the original music loops.
node tools/make-music.cjs
```

Open `tools/audio/audition.html` for the shop demo, full action sounds at their game mix levels,
and isolated recordings. Rendered previews are checked for clipping and stored outside the app
bundle. Listening on phone speakers and headphones is still needed.

## Verification

Run `npm run lint`, `npm run typecheck` and `npm test`. `check-native-audio-api.cjs` additionally
reads `expo-audio`'s iOS and Android module declarations and fails if the game assigns any player
member that one of them declares getter-only — it re-checks itself against every SDK upgrade for
free. Audio checks validate source/output hashes,
catalogue coverage, no orphaned synth files, the sub-1 MB effect budget, PCM format, levels,
one-shot edges and loop seams. Scheduler checks cover alternate takes, layers, voice limits,
priority, cooldowns, live fill, browser/native startup, mute/pause/background cancellation,
stale/rejected rewind promises and resource cleanup. These checks cannot judge subjective sound quality.
