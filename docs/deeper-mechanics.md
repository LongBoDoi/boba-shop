# Making the shop deeper: a proposal

**Status: built, and nobody has played any of it.** The prerequisites, Kiểu khách with its spoken
line, Tăng ca, Sắm cho tiệm, Đợt khách and the first version of Như cũ nhé are all in the game.
**CLAUDE.md is the record of what exists: where it and this document differ, CLAUDE.md is right.**
They were built one after another, but not shipped and played one at a time as §4 asks: nobody timed
a real drink first, and none of §4's keep-going tests has been run. A bot has played the whole set
(`tools/sim/baseline/mechanics-final.out`), and no bot can say whether any of this is fun.

Everything below this status is the proposal as it was written, and its analysis has not been
rewritten. §1 measures the game before any of this. The rule values in §3 were starting guesses:
"half patience", "triple tip" and the prices stood, and what tuning did move is in the list below.
The numbers are in `src/game/rules.ts` and `src/game/gear.ts`.

**Left out of this version, and why:**

- **The pour target band (decision 1).** It reverses a pinned rule, "Payment has no hidden fill
  threshold", and it was not in the build order.
- **The throwaway no-hints build (decision 8).** It is a test with players, and there have been none.
- **One-change visits, patience scaling and absences for regulars.** §3C's first version leaves them
  out, which leaves a learned drink free to become a lookup.
- **Chiêu trong tuần.** Held until the rest has been played, as §4 says.
- **Everything in §6**, for the reasons given there.
- **The minimum-build field for backup codes** (§7). The trap stands: a code from a newer build
  pasted into an older install still silently loses purchases and regulars.

**Decisions taken:** 2 (losing half the jar is compatible with "a day cannot be failed"), 3 (a usual
is capped at four tiles, its size included), 4 (a wrong drink stops counting as served), 5 (rushes are
tuned for the slower player), 6 (the mechanics are live from day 1, overtime still from day 3 as §3D
says) and 7 (relaxed is warmth without pressure), all as recommended. 1 and 8 are the two above.

**Where the build overrode this document, or decided what it left open:**

- A wrong drink also adds to `missed`. Leaving it out of `served` alone keeps one perfect cup and
  twenty-five wrong ones at three stars. An office worker's `close` pays nothing but counts as served.
- The overtime pill is low on the screen and not over the tabs, which are at the top. §3D says both.
- A customer who came in after a press never touches `stats`, in any outcome. That is how "the normal
  day's stars are never touched" is kept.
- A shipper leaving does not burn the jar, which §3D asked to have ruled on.
- Going relaxed with a round running forfeits that day's bonus and any further press, even if the
  shop switches back; otherwise relaxed is a free way to a safe bonus.
- A press brings one group at once, cancelling any quiet, and no other wave starts after it, which
  §3B said to decide. That holds in relaxed too: nobody new comes in once a round has been pressed,
  or going relaxed after a press would pay better than the bonus it forfeits.
- A regular takes only a seat announced as plain or not announced at all, so that the lull's preview
  stays true, and none comes after a press. `Customer.asked?` became `Customer.recall`.
- The introductions run kinds, regulars, waves, overtime, so a new shop hears about regulars on day
  2 and overtime on day 3, the days they first happen.
- Where tuning landed: the late-round floor is 25 s and not §3D's about 31 s, a round leaves ×0.7 of
  patience, the jar's bonus is 0.1 a round, someone outside waits 35 s, and the day's own shortest wait
  for a drink is 65 s and not 60.

**Three deviations nobody ruled on, built that way and listed here for the owner to accept or reverse:**

- **The lull pill is on the counter page only.** The build brief put it at the top of the pager on
  both pages. On the prep page it lay over the empty order card and its own words, so the card now
  says the same two lines itself: the player reads them on both pages, but only one of them has a pill.
- **A group's kinds are rolled when the quiet starts, and its faces as each customer arrives.** The
  brief rolled looks and kinds together. Only kinds are previewed and only kinds are kept (`incoming`),
  so nothing on screen can tell the difference.
- **Sideways starts at 560 wide, not 760**, on both pages. Nobody asked for it, and it changes the
  layout of every landscape window from 560 to 759. It went in because a phone on its side (667, 736,
  740) was being laid out upright, with a room 17 to 111px tall. See "Turning it on its side" in
  CLAUDE.md.

**Two things below no longer hold.** The opening sign scrolls now, so "cannot grow" in §2 and §7 is
resolved, and there is no spawn rate left to tune (§1, §8): customers come in groups.

**Every line reference below is stale.** They were taken against commit `208cffc` with the frontal-cup
work uncommitted on top, and those files have moved a long way since. Some of what they point at has
changed file, like `starsFor`, which is in `rules.ts` now, and some is gone, like the spawn block.
Read them as where things were.

It exists because the two people who play this game both said the same thing: it feels like
something is missing, it is too simple, and it gets boring after a few minutes.

---

## 1. What the measurements found

A bot was written against the real reducer — real rules, spawns, timeouts and tips — with assumed
human timing (tap 0.4 s skilled / 0.8 s sloppy, pour to 70%, slip 1% / 5% per step, all ±20%
jitter). The pager slide of 320 ms, the lid press of 600 + 1100 ms and `POUR_RATE` were read out of
the code rather than assumed. n = 300 shifts per cell unless noted.

**The player copies; they do not decide.**

- Tempo explains **81–85%** of the variance in a shift's money. Accuracy explains 4–5%, queue
  order **0.0–0.1%**, when to take orders 0.7–0.8%, pour depth 1.3–3.0%.
- The best legitimate decision is worth **+1.0% on day 3 and +6.3% on day 30**. Playing 1.5×
  slower costs 25%.
- Serving out of arrival order never pays: LIFO −0.4%, price-first −1.2%, shortest-first −1.5%,
  longest-first −2.7%, random −2.1%.
- Orders look varied and are not: **758 distinct orders out of 773** over 30 days, but the work is
  always 8–12 taps, about 10 s, about 26 times a shift.
- The card ticks itself off, the serve button names the next step
  (`src/ui/PrepPage.tsx:160-180`), and `resolveSelection` picks the next ticket for the player.

**Nothing changes over time.**

- A skilled player serves **3.0 drinks per 30 s from 0:30 to 4:00** — no peak, no lull. 2.8
  customers present, flat.
- Idle time is not the problem: from day 7 a skilled player waits **0.7%** of a shift. The split
  per drink is hands 6.2 s, reading 0.9 s, page travel 1.2 s, forced lid wait 1.7 s.
- Pressure cannot build. The counter is capped and arrivals only fill free spots, so **spawn rate
  is inert**: day 30 at ×0.25 spawn served 26.0 drinks and earned 233, versus 26.0 and 234 as
  shipped.
- **Every day knob stops by day 12.** `getDayConfig(12)` equals `getDayConfig(30)` equals
  `getDayConfig(999)` but for the day number. Same seed, day 12 and day 30 played identically
  100 times out of 100. Only days 2 and 5 announce anything.
- Difficulty does not bite, and then it bites as a wall. Day 30 3-star rate by tempo: ×2 (14.1 s a
  drink) 100%, ×2.5 (18.8 s) 100%, ×3 (22.5 s) 83%, ×4 (28.6 s) 0%. One inequality governs it:
  `slots × cycle time ≤ patience`.
- **90% of the 24 askable ingredients have appeared by drink 17** — about minute 3 for a fast
  player, 5.5 for a slow one. That matches when the boredom was reported, which is suggestive
  rather than proof.

**Nothing carries over, and the rules reward the wrong things.**

- The till reaches **7,031 units by day 30** (skilled, 30 chained days) with nothing to spend it
  on. Customers never return. Stars vanish on the next screen.
- A **3% tap instead of a real pour pays +9.7% skilled and +12.4% sloppy**, and still gets 100%
  3 stars. The one analog skill in the game is best skipped.
- **Ignoring the counter pays +9.6%** (batch order-taking without watching the tab, day 30).
- **A bot that never read an order** and handed everyone the same plain small black tea earned
  **0 money and still got 2 stars on every shift**, on days 1, 7 and 30. `starsFor`
  (`src/ui/DayEndScreen.tsx:18-24`) reads `served / (served + missed)`, and a wrong drink counts as
  served.

**What the bot cannot see**, and a possible fourth cause: nobody in the shop speaks, reacts or
knows you. "Missing something" may not mean "too few rules". Consider that before building a lot.

---

## 2. Build these three things first

Each is small, each is needed by more than one mechanic, and skipping them means every later
mechanic hand-edits the same two lines.

1. **One `patienceFor(state, look)` with a floor, and one payout function.** Every patience and pay
   modifier lands on `src/game/reducer.ts:384` (spawn) and `:578` (serve) and they stack with no
   floor. Worked example from the critique: a peak-hour ×0.45, a shipper ×0.5 and an overtime round
   ×0.512 multiply out to about 5 s of patience, when a skilled drink takes 10 s.
2. **A teaching channel: `dayNews(day)`, separate from `describeUnlocks`.** `describeUnlocks` is
   pinned by `tools/check-serving.cjs` (including `describeUnlocks(3)` being empty), and the
   opening sign is a fixed 280 px board with no scrolling (`src/ui/ui.css:615,:640`) whose only way
   off is "Bắt đầu" at its foot — a taller sign soft-locks sideways at 932×430. **Key each
   introduction to first-seen, not to `day`:** the two real shops are already past day 1, and a
   save on day 20 would otherwise meet every mechanic at once.
3. **Stop counting a wrong drink as served.** One line in `serve` and one edit at
   `tools/check-save.cjs:73`; tested in a scratch copy. Everything that makes stars matter rests on
   this. It changes what the stars mean, so it is decision 4 in §5.

A fourth, if any hidden-order mechanic is built: **one `orderVisible` helper**. The answer leaks in
four places — the counter bubble (`src/counter/CustomerView.ts:284`), the drink title
(`src/ui/OrderBubble.tsx:171`), the done count (`:173`) and the ready dot (`:258`).

---

## 3. The four mechanics, plus a money sink

They are chosen to work on four different scales — who is next, the rhythm of a shift, the end of a
shift, and one day to the next — and to argue with each other rather than collapse into one rule.
The reshapes from the three critics are already folded into the "first version" lines.

### A. Kiểu khách — faces that mean something

**Size S. No art.** Three looks the game already draws always mean the same thing:

| Look | Who | Patience | Pay |
|---|---|---|---|
| `cap` | Shipper (delivery rider) | Half | Triple tip; **if he leaves it costs no star** |
| `balding` | Bác (an elder) | Much longer | No tip |
| `glasses` | Office worker | Slightly less | Bonus on perfect, nothing on close |

Measured share of customers: shipper 14.4%, elder 14.3%, office 17.9%.

**The decision after every cup: who is next, and who can I afford to lose?**

*Spec.* Pure `kindOf(look)` in `src/game/customers.ts`, derived from `hairStyle` and `accessory` —
no new state and **no save work at all**. Scale patience in the spawn block
(`src/game/reducer.ts:375-385`); `parseCustomer` already saves those fields. In the timeout loop
(`:353-367`) skip `missed += 1` for a shipper but still push the departure, which keeps the `stats`
shape pinned at `tools/check-serving.cjs:247`. Pay changes in `serve` (`:572-589`). A patience ring
on `OrderPin` via a CSS conic-gradient, in its own selector so the memo still holds — today a
queued ticket's deadline is invisible. **Plus a kind mark:** a cap will not read on a 24–32 px head.
First match wins, in the order cap, balding, glasses. **Do not** sort `resolveSelection` by
deadline; that makes the decision for the player.

*Risks.* The free shipper walkout is load-bearing: an earlier version where shippers counted as
misses dropped a slow player's 3-star rate to 35%. Skilled players may reduce this to "cap first",
which is a rule and not a decision — which is why it ships with something arguing against it.
Keep the wording respectful (Bác, Anh); these are stereotypes.

*Relaxed mode:* faces, lines and tips stay; patience differences off. *Start on day 1* (day 1 has
2 slots, so it becomes a real choice when the third opens on day 2).

### B. Đợt khách — rushes and a breath between them

**Size M. No art** in the first version; the line is a number on the tab.

A group arrives instead of a trickle, and whoever has no spot waits outside as `+2` on the Quầy
badge. **The next group comes only once the counter clears**, so a slower player gets fewer groups
rather than more pressure. Then a short quiet beat — "Quán vắng một chút", no countdown — showing
how many are coming and of what kind. Group size keeps growing past day 12, which gives the frozen
day dial something to do.

**The decision in a rush: stay on the oldest ticket, or make a quick two-item drink to free a spot
before someone outside gives up?**

*Spec.* `waveSize`, `lullMinMs/MaxMs`, `lineMs` in `getDayConfig`. Replace the spawn block
(`src/game/reducer.ts:370-391`) with `waveLeft`, `lullUntil` and `line: Customer[]`. **Line
timeouts go to a new optional top-level `lost`, not `stats.missed`** — stars grade only customers
who reached the counter, and `DayStats` is deep-equalled at `tools/check-serving.cjs:247`.
`dayOver` must also require an empty line. `save.ts`: optional `waveLeft`, `lullUntil`, `line`
parsed through `parseCustomer`. Announce through `dayNews`, leaving `describeUnlocks` alone.

*Risks and tuning.* **Clearing the counter has to be the trigger** — a fixed-clock rush was
simulated and failed, leaving output flat at 3.0 while a slow player lost 13 customers. Wave of 3
on day 1, growing slowly. **Tune wave size against the slow player first** so their 3-star rate
stays near today's ~91%, not the 57–66% a combined run produced. A walkout from the line costs no
star and draws no scolding. If the lull feels empty, shorten it (6–10 s) — do not fill it with
chores. Decide what a wave does during overtime rounds.

*Relaxed mode:* unchanged, keeping its current auto path.

### C. Như cũ nhé — regulars

**Size L. No paintings** (`characterSvg` draws any fixed `CustomerLook`), but Vietnamese
personality lines to write.

**Four** named regulars with fixed faces and a short usual drink, rolled once per shop. The first
visit shows normal tiles. After that the card says "Như cũ nhé!" and **the tile row is blank** —
make it from memory, or tap "Hỏi lại" to see it at the cost of the tip. Perfect visits in a row
build a streak that pays more. In a second slice, a regular on a streak changes one thing ("Như cũ,
nhưng ít đá thôi"), which is what stops a learned drink from becoming a lookup. A missed visit only
pauses the streak; nobody stays away to punish you. A **Sổ khách** on the day-end and title screens
shows what you know — deliberately **not** on the pause card, where the clock is stopped and a peek
would be free.

**The decision: how sure am I? A wrong guess costs far more than asking, and the longer the streak,
the more there is to lose.**

*Spec.* New `src/game/regulars.ts`: `REGULARS` (id, name, fixed look, one line) and
`RegularMemory { usual, visits, streak, lastDay }`. Fill `usual` from `generateOrder` at the first
meeting — **rerolled until it names at most 4 things** — so the owner's independent category rolls
stay the source. `GameState.regulars`, threaded through `createInitialState`, `buildDay`,
`START_DAY` **and `GO_TO_TITLE`** so it survives the menu. `Customer.regularId?` and
`Customer.asked?`, because `Customer.id` resets daily (`reducer.ts:227`). New `ASK_AGAIN { slot }`.
**The save trap:** `regulars?` optional in `SavedGame`, `serializeGame` and a new `parseRegulars`
through `parseDrink`, and `regularId`/`asked` copied in `parseCustomer` (`:272-282`) or they vanish
on reload; default `{}` so old saves and backup codes still load.

*First version:* 4 regulars, a usual, the blank row, "Hỏi lại", a simple streak bonus. Leave out
the one-change visits, patience scaling and absences. First regular late on day 1, first
"Như cũ nhé!" on day 2.

*Risks.* The largest change here — new persistent state across reducer, save, counter and card.
Whether remembering is pleasant is a guess: with one visit a shift a player may simply forget, and
someone returning after a week meets faces they cannot place, so Sổ khách is essential and
"Hỏi lại" must stay gently priced. Eight faces from one SVG generator may look alike; test at
40 px. The blank row removes the progress track some players rely on.

*Relaxed mode:* identical; only the taking is automatic.

### D. Tăng ca — stay open late

**Size M. No art**: an HTML pill and a jar label.

In the last 15 s a pill appears low on the screen, near the thumb: "Mở thêm 30 giây". Press it and
one more group comes in, patience shorter each round down to a floor (about 31 s), at most three
rounds. Money earned after closing goes into a visible jar. Close clean and the jar pays into the
till with a bonus. If a customer at the counter walks out, **you lose the multiplier and half the
jar**, you cannot press again, and later sales pay normally into the till. A shipper leaving, or
someone giving up in the line, does not count. **The normal day's money and stars are never
touched.**

**The decision: press or close, judged by the hearts on the counter right now.** It also gives two
players something to ask each other: "tăng ca mấy?"

*Spec.* `overtime: { rounds, jar, lost }` in `GameState`, reset in `buildDay`. Export
`closesAt(state) = config.durationMs + rounds * 30_000` and use it for `isOpen` in `tick`. New
`EXTEND_SHIFT`, valid only while active and within 15 s of `closesAt`. `HudClock` reads `closesAt`
instead of `config.durationMs`. In `serve`, when `rounds > 0 && clock >= config.durationMs`, route
`earned` to `overtime.jar` with its own coin anchor. On `dayOver`, pay the jar plus a bonus into
`coins` and `money`. An absolutely positioned `.live` pill over the tabs row, so the pinned layout
heights do not move. Optional `overtime?` in the save, following the `money` pattern. **From day 3.
Hidden in relaxed mode**, whose promise is no pressure.

*Risks.* The fast bot's expected value came out at +168, about 72% of a base shift — **the
multiplier is too generous and must come down**. The half-jar softening was never simulated and may
make pressing always correct, so **re-run the bot on it**. A thumb holding a pour cannot press,
which is why the window is 15 s rather than 5. Rule on whether a free-walkout shipper can burn the
jar.

### Companion: Sắm cho tiệm — things to buy

**Size S–M.** One-off purchases on the day-end card (which already scrolls), through the unused
`SPEND` and `canAfford`. **No bays, no running fees, no resale** — all three were cut as admin.
Each item is either visible on the SVG counter backdrop or changes a verb: benches (the line waits
longer), an order board at one spot (that customer orders themselves), a plant, a lantern. Effects
are read from `state.gear` **at the point of use, not through `DayConfig`**, which avoids the
config re-derivation rule in CLAUDE.md. Optional `gear?` in the save, ids checked against the
catalogue.

Price it for tills that already hold thousands. Leave out the faster tap and the faster press: they
shorten the part worth keeping. **Why it is needed:** tips, the jar and every other money stake
mean nothing until money buys something.

---

## 4. Build order

**Before any code: time one real drink each, start to serve, and ask each other what felt
missing** — without suggesting rules. A skilled shift averages ~10 s a drink and things break above
~19 s, so a real tempo reading retunes everything below. If the answer is "it feels lifeless", move
regulars up the list.

Everything here is web-only, so each step reaches installed apps without moving `NATIVE_VERSION`.
Ship one at a time and play it.

1. **The three prerequisites, then Kiểu khách**, with one spoken line per customer on arrival.
   *Keep going if* you both tap portraits by choice and talk about customers. *Change course if*
   nobody overrides the default after a few shifts, or everyone settles on one fixed rule.
2. **Tăng ca and the first purchases.** *Keep going if* you hesitate over the pill. *Retune or
   remove if* you always press, or never do.
3. **Đợt khách** — but run a bot pass over the whole set first, because nothing has been tested
   together. *Reduce the wave if* the slower player stops getting 3-star days.
4. **Như cũ nhé**, then the one-change visits. *Keep going if* you remember a name or a drink
   unprompted. *Shorten the usuals, or drop the blank row, if* you tap "Hỏi lại" every time.

Then stop and play. The strongest idea held back is **Chiêu trong tuần** — a weekly promotion card
you draft, which stacks over a week; it needs the opening sign to scroll first.

---

## 5. Decisions for the owner

1. **Should the pour count?** Today the smallest pour is the best one. *Recommendation: yes* — a
   target band on the existing pour meter with **only the tip** riding on it. It is the one change
   that touches all 26 drinks a shift. It reverses a documented rule pinned at
   `tools/check-serving.cjs:188-198` ("Payment has no hidden fill threshold"), and milk also raises
   the fill, so that needs a rule too.
2. **Is losing half the jar compatible with "a day cannot be failed"?** *Recommendation: yes* — it
   is opt-in and the base day is protected. Your call, since it sits on that line.
3. **May a regular's usual be capped at four things?** It is still `generateOrder`, just rerolled.
   *Recommendation: yes*, as a distinct kind of order.
4. **Should a wrong drink stop counting as served?** *Recommendation: yes, first.* It changes what
   the stars mean.
5. **Who sets the difficulty if you two play at different speeds?** *Recommendation:* tune rushes
   for the slower player and let Tăng ca stretch the faster one.
6. **Do new mechanics start on day 1?** The critics disagreed. *Recommendation: yes* — the boredom
   arrives in the first shift.
7. **What does relaxed mode promise?** *Recommendation:* warmth without pressure — it keeps
   regulars, faces and purchases, and drops Tăng ca and the patience differences.
8. **Do you want one throwaway build with the auto-ticks and the serve button's step hints
   removed?** It is the cheapest test of whether the copying itself is the problem.
   *Recommendation: yes, once*, and do not ship it unless it clearly helps.

---

## 6. Considered and left out

| Idea | Why |
|---|---|
| Khách vội (deadline customers) | Merged into Kiểu khách. |
| Chiêu trong tuần (weekly promotion draft) | The strongest idea held back; larger than estimated and needs the sign to scroll. |
| Túi tiền (customer with a budget) | Best idea for changing the work itself, but it needs sums or prices and bends the independent-category order rule. If revived, use "ba món" rather than a budget. |
| Chuỗi cùng cỡ (same-size chain) | Critics split: a combo with no story. Bring it back only if Kiểu khách hardens into one rule; then show it in the ServeButton label, not a new HUD pill. |
| Bảng giá và Tiếng lành (price board, reputation) | A difficulty slider on the same routine. Its stars repair is kept as a prerequisite. |
| Bảng tin hôm nay (daily notice) | Feels like homework, and it marks correct-looking service wrong. Could become a promotion card. |
| Ngày lớn và Bảng hiệu (Sunday, keepsake sign) | Depends on the promotion draft. |
| Máy đậy nắp chạy riêng (free-running lid press) | Targets the 16.8% lid wait but is a deep rewrite of the one-cup design, and it reduces pressure. |
| Mặt bằng (bays, fees, resale) | Admin. Replaced by Sắm cho tiệm. |
| Tủ mát sáng nay (morning fridge) | A 13-line planning sheet every morning. |
| Kho trà và topping (stock that runs out) | Restocking chores, and a dry tank interrupts the pour. |
| Xin đổi món (substitutions) | Exists only to serve a stock shortage. |
| Bảng tin sáng (morning board) | Useless without the fridge. |
| Áo đôi (matching shirts) | Charming once, weak as a rule. Could return as a sweet line. |
| Ca chung (shared shift) | Speed would decide it, and it touches the save path. Reconsider later, without a second save key. |
| A tap that keeps running | Simulated; never beat holding the tap. |
| A fourth counter spot | Measured at 0 for a skilled player, −18 for a slow one, −50 at 27 s a drink. |
| Full auto order-taking | Best in every context (+39) and it empties the counter page. Narrowed into the one-spot order board. |
| Group orders, vague spoken orders | Groups need a held door; vague words become a lookup table. |

**One untried idea worth keeping:** a text code, like the existing backup code, that sends a
hand-made customer into your partner's shop. No server, no art, and it is built for two people.

---

## 7. Traps found while checking the code

Each of these was confirmed against the source and will bite whoever implements this.

- **`buildDay` does not run once per day.** "Về menu chính" on the day-end screen builds the next
  day (`reducer.ts:245`) and the menu button builds it again (`:238`). Anything added to `buildDay`
  must be idempotent — no decay, charges or forecast rolls there.
- **Patience and pay modifiers stack with no floor** (`reducer.ts:384`, `:578`). See §2.
- **The opening sign cannot grow.** Fixed 280 px, no scrolling (`ui.css:615`, `:640`), "Bắt đầu" at
  its foot; a taller sign soft-locks sideways at 932×430. The game can afford about one morning
  decision, and the day-end card — which does scroll — is where purchases belong.
- **Existing shops are the test shops.** Key every introduction to first-seen, not to `day`.
- **No regression script reaches `KitchenScene` gestures or the HTML**, so any new scene branch is
  browser-only verification. A new `tools/check-*.cjs` must also be added to `package.json`'s test
  script by hand or it never runs.
- **Backup codes across versions:** `parseGame` ignores unknown fields and `SAVE_VERSION` will not
  move, so a code from the newest page restored into an older installed app silently loses
  purchases or memory. Consider a minimum-build field in the save.
- `describeUnlocks(3)` is pinned empty at `tools/check-serving.cjs:88-90`; `DayStats` is
  deep-equalled at `:247`. Both constrain where new fields may go.

---

## 8. The measurement harness

`tools/sim/` holds the bot the numbers came from. It is **not** part of `npm test` and was written
for this study, not reviewed to the standard of a `check-*.cjs`. It transpiles the TypeScript the
same way the regression scripts do, drives `gameReducer` through whole shifts with modelled human
timing, and prints the tables quoted in §1. `tools/sim/README.md` says how to run it and what each
section measures.

Re-run it after any change to patience, slots or spawn, and **before** shipping two mechanics
together — every number in §1 is single-mechanic or no-mechanic.
