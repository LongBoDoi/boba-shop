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
crossfades with phase changes. Silent-switch, mixing with other audio, and existing saved-volume
migration/clamping behavior are preserved. Recording and background audio remain disabled.

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

Run `npm run lint`, `npm run typecheck` and `npm test`. Audio checks validate source/output hashes,
catalogue coverage, no orphaned synth files, the sub-1 MB effect budget, PCM format, levels,
one-shot edges and loop seams. Scheduler checks cover alternate takes, layers, voice limits,
priority, cooldowns, live fill, browser/native startup, mute/pause/background cancellation,
stale/rejected rewind promises and resource cleanup. These checks cannot judge subjective sound quality.
