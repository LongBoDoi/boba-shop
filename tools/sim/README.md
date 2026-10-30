# tools/sim — the bot that plays whole shifts

**This is not part of `npm test`**, and it is not a `check-*.cjs`: nothing here asserts anything.
It is the measurement harness behind `docs/deeper-mechanics.md`, kept because that document's plan
says to re-measure before shipping two mechanics together. It was written for that study and has
not been reviewed to the standard of the regression scripts.

It loads the game's own TypeScript in memory the way the regression scripts do (`load.cjs`, which
finds the repo root from its own path), so **the rules, spawns, timeouts, prices and tips are the
shipped `gameReducer`**. Only the human is modelled.

```bash
node tools/sim/sanity.cjs        # 960 shifts; prints the accounting error, should stay under ~1%
node tools/sim/run.cjs           # the main tables (sections 1-8). Slow: several minutes
node tools/sim/run2.cjs          # time split per drink, shape of a shift, slip sensitivity
node tools/sim/run3.cjs          # what each decision is worth, against a do-nothing default
node tools/sim/probe-layout.cjs  # where the stations sit, and how much wall fits on screen
```

`baseline/` holds the output of those three runs as of commit `208cffc`, so a change can be
compared against what the game did before it. Reproduced from this directory, `run3.cjs` prints the
same numbers as `baseline/run3.out`.

## What is assumed, and what is read from the code

Everything assumed lives in `PROFILES` and `MACHINE` at the top of `bot.cjs`, and every number
quoted in the design document rests on it:

- **Assumed** (two profiles, `skilled` and `sloppy`, all with ±20% jitter): tap 0.4 / 0.8 s, repeat
  tap 0.25 / 0.45, swipe 0.35 / 0.7, tab tap 0.3 / 0.6, card read 0.25 + 0.12 per tile / 0.5 + 0.35
  per tile, pour to 70% / 80% full, slip per step 1% / 5%, slip noticed 100% / 60%.
- **Read from the code**: the pager slide (320 ms), the lid press (600 + 1100 ms), `POUR_RATE`, and
  the station positions, which come from the real `layoutKitchen` at 390×554.

**Time one real drink before trusting any tuning done with this.** A skilled shift here averages
about 10 s a drink; if a real player is at 16 s, every margin in the study shifts.

The bot can tell you whether a decision is worth anything, where the difficulty wall is, and
whether a knob does nothing. It cannot tell you whether the game is fun.
