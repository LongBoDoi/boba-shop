# tools/sim — the bot that plays whole shifts

**This is not part of `npm test`**, and it is not a `check-*.cjs`: nothing here asserts anything.
It is the measurement harness behind `docs/deeper-mechanics.md`, kept because that document's plan
says to re-measure before shipping two mechanics together, and now the measurements behind the
constants in `src/game/rules.ts`. It was written for that study and has not been reviewed to the
standard of the regression scripts.

It loads the game's own TypeScript in memory the way the regression scripts do (`load.cjs`, which
finds the repo root from its own path), so **the rules, arrivals, timeouts, prices and tips are the
shipped `gameReducer`**. Only the human is modelled.

```bash
node tools/sim/sanity.cjs        # 2,280 shifts; the accounting error, should stay under ~1%, and throws if the books disagree
node tools/sim/run.cjs           # the main tables (sections 1-8). A few minutes, and it leaves a results.json in the current directory
node tools/sim/run2.cjs          # time split per drink, shape of a shift, slip sensitivity
node tools/sim/run3.cjs          # what each decision is worth, against a do-nothing default
node tools/sim/run4.cjs          # the mechanics together, on a shift dropped onto a new shop
node tools/sim/run5.cjs          # the whole set, on the shop a player really has that morning
node tools/sim/tune.cjs          # sweeps the constants in rules.ts without editing them
node tools/sim/probe-layout.cjs  # where the stations sit, and how much wall fits on screen
```

`bot.cjs` is the bot, `shop.cjs` chains one shop through the days for `run5.cjs` and `tune.cjs`, and
`load.cjs` does the loading.

`baseline/` is what the game did at each point, so a change can be compared against it:

- `run.out`, `run2.out` and `run3.out` are those three runs as of commit `208cffc`, the game before
  any of this. At that commit `run3.cjs` printed the same numbers as `baseline/run3.out`; the game has
  moved on since, so it no longer does.
- `mechanics-stage3.out` is kinds, overtime and waves together, with the sweeps that set them.
- `mechanics-final.out` is the whole set on the final constants, and **the one to compare against**.
  Each file's header says which part ran on what.

Keep `baseline/` as it is. New results go in a new file, with a note here.

`shift()` takes an `overtime` policy for the pill: `'never'` (the default), `'always'`, a number from
0 to 1, which presses only if every heart on the counter is above it, or `{ hearts, most }`, the same
judgement by someone who knows the rule: shippers left out of it, nobody outside, at most `most` at
the counter. `overtimeRounds` caps the presses. A press is a tap and waits for free hands. The result
carries the day's `overtime` and `lost`, and `coins` already includes whatever the jar paid at closing.
`queue: 'kinds'` triages by deadline and tip; `'line'` is that, taking the shortest drink while
anyone is outside. `gear` puts the shop's purchases on the shift. `noticeMs` changes how the bot
notices someone waiting from the kitchen, and `panicOff` stops it noticing; see below.

`usual` is what the bot does with a regular's blank card: `'ask'` every time, `'guess'` every time,
`'sure'` (the default) guesses only on a usual that feels right, and a number from 0 to 1 guesses whenever
the assumed chance of remembering is at least that. A wrong memory is really built and really served, so
what it costs is the game's own answer. `known: { visits, streak }` drops a shift into the middle of a
shop's life, with all four regulars met that often; a shift chained through `start` keeps its own. The
result carries `regulars`, `log.asks` and `log.guesses`, and each serve says `regular` and `recall`.

**The bot decides from what is on screen.** From the kitchen, someone not asked yet is a count on
the Quầy tab, with no ring and no face, so `hearts` policies read only the rings a taken order shows,
a kind is known only for a face seen at the counter, and a customer never seen is taken for a plain
one on the patience of the round they came in on. The first version read every customer's exact
deadline from any page, which was harmless while everyone had the same order patience and stopped
being harmless with kinds. The `baseline/` runs from before kinds are unaffected. The rest of what it
knows is still generous, and that is the first item in the list of untidy results.

## The mechanics together: `baseline/mechanics-stage3.out`

```bash
node tools/sim/run4.cjs [n] [abcdef]       # against baseline/run.out; overtime; shape; slow play; the bench; noticing
node tools/sim/tune.cjs waves|overtime [n] [json grid]   # sweeps the constants in rules.ts without editing them
```

**The `run*.out` files in `baseline/` no longer reproduce**, since waves replaced the trickle:
`run.cjs`, `run2.cjs` and `run3.cjs` still work and now measure the waves. The numbers in
`docs/deeper-mechanics.md` section 1 are the game before any of this. `run.cjs`'s spawn-rate knobs
became lull knobs, because nothing reads a spawn rate any more.

This section is that stage as it stood. A floor moved after it, and its noticing result turned out to
have been measured against the wrong bar: see the next section.

What the tuning found, on the upright phone, at the assumed timing below:

- **The multiplier cannot make pressing a decision, and nor can the half jar.** The extra sales pay
  for themselves. At the starting constants, pressing three times every day was worth +47-52% to a
  skilled FIFO player, with a burn rate of 0-10%. Halving or tripling the bonus moved that by tens of units
  without changing which policy won. For skilled, the half jar is close to irrelevant: `always` is
  +85 / +83 / +80 at a burn keeping 0.5 / 0.25 / 0 of the jar on day 7. A burn is cheap because it tends to
  come early, while the jar is small, and later sales pay the till at full price.
- **Patience is what makes a press losable**, so that is what moved: 0.8 to 0.7. A bigger group per
  round added nothing that patience did not, so a round stays `waveSize`. The bonus came down to 0.1
  because it was generous, not because that decided anything.
- **The half jar stays**, as decision 2 ruled, and the cost is known: at 0.5 `always` is never
  negative for a sloppy player, at +2 to +29 units. Stopping after one or two rounds beats it in all
  eight cells, by 12 units on day 3 FIFO, by 4-7 elsewhere, and by 1 on day 12 FIFO, which is within
  the noise: a mean here has a standard error near 1.
- **`always` loses to stopping early, but not to `hearts.5`.** For a sloppy player those two are a
  dead heat, within about 2 units in all eight cells. Pressing only on healthy hearts is not caution
  at that speed: it still burns 37-89% of the time. So the target that `always` be clearly worse is
  met against stopping early and nothing else, and not on day 12 FIFO.
- **A 60 s day floor could not hold the sloppy player's third star** once kinds and wrong drinks were
  in (78-87% on days 12 and 30), whatever the group size. 65 s does (89-94%), and no kind value had to move.

Some results are less tidy than the targets, and are not hidden by anything above:

- **The sloppy player's third star rests on how they notice a waiting customer**, though the build before
  any of this rests on it too, which this paragraph did not know: see the next section. The 89-94% on days
  12 and 30 assumes a player who knows to the second when the badge rose and goes over with 8 s left
  on the patience they assume, which is why `mReq` is nearly zero throughout section A. Swap that for
  a habit (section F) and it moves: going over once the badge is 12 s old gives 83-92%, at 8 s 79-85%
  and a lot of wasted trips, at 16 s 81-86%, and never going over for it 76-83%. The target of about
  91% is met by a player who keeps track, and nobody has measured whether one does.
- `always` is level with `hearts.5` for a skilled FIFO player, within 4 units, but it **beats** it for
  a skilled `kinds` player, by 4-20 units, at a burn of 3-37%. Hearts are shares, and triage runs them low.
- The peak and lull are plain for a skilled player and on short groups. For a sloppy player on days
  12 and 30 the 30 s buckets barely resolve them: one drink in 19 s is noisy at that width, and a
  group of five keeps them busy through most of a shift. Quiets per shift and idle share (6% against
  0.5%) show the rhythm exists; the within-shift variation does not.
- **`queue: 'line'` never paid.** Making the shortest drink to free a spot, the decision the proposal
  says a rush creates, is no better than `kinds` and is sometimes worse. And the **bench** costs a
  sloppy player 3-4 points of three-star days on days 12 and 30 while earning more: fewer people give
  up outside, so the counter stays full.
- **Pressing can cost a sloppy player stars**, though late customers never touch the stats: at
  `always` on day 30, `kinds` falls from 89% to 84%, and FIFO from 94% to 91%. With `kinds` the
  reason is that triage serves a late tip ahead of a day customer; FIFO's has not been traced.

Everything here rests on the assumed timing, and the wall is steep: at 1.25× the sloppy timing, three
stars on days 12 and 30 fall from about 94% to about 65%.

## The whole set: `baseline/mechanics-final.out`

```bash
node tools/sim/run5.cjs [n] [abcdefghijk] [a row of i]   # everything on at once. The file's header says which is which
```

`shop.cjs` chains a new shop up to a morning, regulars, streaks, gear and all, because a shift dropped
onto a new shop has met nobody on day 30. Every policy in `run5.cjs` then plays the same mornings on
the same seeds. **`tune.cjs overtime` now runs on those mornings too.** The baseline's missing cells
were run off a copy of `67ae6fd`, and are in the file's PART 2.

One constant moved: `SERVE_PATIENCE_FLOOR_MS` from 30 s to 25 s, because a skilled player's three presses
were free. Nothing in the day proper reaches that floor, whose lowest is a shipper's 32.5 s, so no star moved.
Patience, the bonus and the burn had not been able to do it, for the reason given above: a burn cost little
because it came early. A floor that bites in the third round makes it come late, on a full jar. The third
press adds this on top of two, for a skilled player on days 12 and 30:

| floor | 30 s | 27 s | 26 s | 25 s | 24 s |
|---|---|---|---|---|---|
| FIFO | +35, +34 | +12, +11 | -3, -5 | **-15, -18** | -21, -29 |
| `kinds` | +34, +28 | +14, +15 | +13, +7 | **+9, +5** | +5, +2 |

25 s is the first where how the counter is being run changes the answer. On a month, skilled FIFO earns
6,767 never pressing, 7,828 once, **8,777 twice** and 8,549 always. Before the move `always` took 10,048.

- **The third star holds.** Sloppy, FIFO, on days 1 / 2 / 3 / 7 / 12 / 30: 98 / 97 / 99 / 98 / 91 / 91, against
  99 / 99 / 100 / 100 / 89 / 89. **27.7 three-star days of 30, and the build before any of this also got 27.7.**
- **The noticing result above was measured against the wrong bar.** It set each habit against the as-set
  number. The build before this has the same dependence: on days 12 and 30 it gives 89 / 78 / 89 / 79 / 52
  for as set, look 8, 12, 16 and never, once that bot is given the same habit. Against those the whole
  set gives 91 / 79 / 89 / 85 / 80 and 91 / 83 / 88 / 77 / 68, on FIFO. Noticing still matters, but it is not new.
- **Regulars do not touch the pill**: with and without one, an overtime policy lands within 3 units in 31 cells
  of 32, and the last is 7, which is about the noise at that spread (section K). What they add is one decision that changes as a player learns a face. A blank card on
  day 2 pays a sloppy player 2.7 for guessing and 5.2 for asking; by day 30, 7.9 and 5.3. It is small
  money, at most about 7 units a shift, and a sloppy player who always guesses loses 3-5 points of third star.
- **The bot that reads no orders fails**: no stars on 85-89% of shifts, one on the rest, 0.5 units at most on average.
- **The wall is still steep, and better than it was**: at 1.25× the sloppy timing, 60-72% on days 12 and 30
  against 39% before any of this. At 1.5×, 19-39% against 12%.

What stayed unmet, and no constant reached it:

- **Hearts do not decide the pill.** No policy that reads the counter beats a plain count by more than noise.
  The decision the pill poses is how many, not whether this counter looks calm.
- **The first two presses are free for a skilled player**, at +54 to +87 a shift and a burn of 0-17%. Only
  the third is a question, and not on day 3, where a group of three is too small to lose (+95, burn 1%).
- **That third press is a matter of about 15% of tempo** (section J): at ×0.85 of the skilled timing it is
  worth +19 to +39 again on every day measured. Nobody has timed a real drink, so read it as a direction.
- **No one price suits both players.** Skilled, buying as it can, has the board on day 11 (9 if it saves for it)
  and holds 5,279 by day 30 with nothing to spend it on, which is the complaint the shop was built to
  answer. Sloppy has it on day 27 (21 if it saves for it), and earns 3,363 in the month against the 2,900
  the four cost, so anything over about 15% dearer puts the last of them past day 30. More things to buy would help a price
  rise could not, and that is a design call.
- **The gear is a sink and not an investment.** A skilled player gets nothing from the bench and the board,
  -2 to 0 a shift without overtime. A sloppy one earns the board back in 228-313 days and the bench in 60
  on day 30 and 316 on day 12; on day 7 the bench never pays, at -0.2 a shift.
- The `line` queue was not played again here: it had never paid, and nothing in this pass gave it reason to.

## What is assumed, and what is read from the code

Everything assumed lives in `PROFILES` and `MACHINE` at the top of `bot.cjs`, and every number
quoted in the design document rests on it:

- **Assumed** (two profiles, `skilled` and `sloppy`, all with ±20% jitter): tap 0.4 / 0.8 s, repeat
  tap 0.25 / 0.45, swipe 0.35 / 0.7, tab tap 0.3 / 0.6, card read 0.25 + 0.12 per tile / 0.5 + 0.35
  per tile, pour to 70% / 80% full, slip per step 1% / 5%, slip noticed 100% / 60%, and a perfect
  memory for every face seen at the counter and for when each badge rose. The memory for a usual is
  its own block in `PROFILES`, and it is the softest number here: right after one visit 60% / 35%,
  +12 points a visit up to 95% / 85%, a usual trusted when wrong 15% / 30%, doubted when right 10% / 20%,
  two things wrong when wrong, and no forgetting over time at all.
- **Read from the code**: the pager slide (320 ms), the lid press (600 + 1100 ms), `POUR_RATE`, and
  the station positions, which come from the real `layoutKitchen` at 390×554.

**Time one real drink before trusting any tuning done with this.** A skilled shift here averages
about 10 s a drink; if a real player is at 16 s, every margin in the study shifts.

The bot can tell you whether a decision is worth anything, where the difficulty wall is, and
whether a knob does nothing. It cannot tell you whether the game is fun.
