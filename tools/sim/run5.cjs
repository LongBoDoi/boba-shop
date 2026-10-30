/*
 * The whole set at once. `node tools/sim/run5.cjs [n] [sections] [a row of section i]`, sections out of abcdefghijk.
 *
 * Every cell here plays the shop a real player would have on that morning: a new shop is chained up to
 * the day, carrying its regulars, buying gear at each day's end and keeping its streaks, and the state
 * at that morning is kept. Each policy then plays the same mornings on the same seeds, so a difference
 * between two rows is the policy and not the shop. Section i is the chain itself, 30 days in a row.
 */
const fs = require('node:fs');
const path = require('node:path');
const { src } = require('./load.cjs');
const { GEAR } = src('game/gear.ts');
const { USEFUL, REFERENCE, chain, mornings, play } = require('./shop.cjs');
const rules = src('game/rules.ts');

const N = Number(process.argv[2]) || 300;
const SECTIONS = process.argv[3] ?? 'abcdefghijk';
const DAYS = [1, 2, 3, 7, 12, 30];
const PROFILES = ['skilled', 'sloppy'];

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const share = (rows, test) => (rows.length ? rows.filter(test).length / rows.length * 100 : NaN);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const out = (...parts) => console.log(parts.join('\t'));

/** The build before any of this, on the day `baseline/run.out` has no row for, run off a copy of commit 67ae6fd. */
const DAY_2 = { 'skilled-2': { served: '23.6', miss: '0.00', 'star3%': '100', money: '227' }, 'sloppy-2': { served: '15.4', miss: '0.00', 'star3%': '99', money: '120' } };

function baseline() {
  const text = fs.readFileSync(path.join(__dirname, 'baseline/run.out'), 'utf8').split(/\r?\n/);
  const start = text.findIndex((line) => line.startsWith('prof\t'));
  const head = text[start].split('\t');
  const table = { ...DAY_2 };
  for (const line of text.slice(start + 1)) {
    const cells = line.split('\t');
    if (cells.length !== head.length) break;
    const row = Object.fromEntries(head.map((name, i) => [name, cells[i]]));
    table[`${row.prof}-${row.day}`] = row;
  }
  // Day 12 was not in that run. Its config is day 14's, and the same seeds gave the same numbers at 67ae6fd.
  for (const profile of PROFILES) table[`${profile}-12`] = table[`${profile}-14`];
  return table;
}
const BASE = baseline();

/** Three stars and money on each habit, at that same commit. Sloppy, FIFO, n=300. */
const HABIT_BASE = {
  1: { 'as set': [99, 119], 'look 8': [98, 76], 'look 12': [98, 102], 'look 16': [98, 116], never: [99, 119] },
  2: { 'as set': [99, 120], 'look 8': [99, 76], 'look 12': [99, 105], 'look 16': [99, 118], never: [99, 120] },
  3: { 'as set': [100, 120], 'look 8': [98, 77], 'look 12': [99, 107], 'look 16': [100, 119], never: [99, 120] },
  7: { 'as set': [100, 117], 'look 8': [98, 86], 'look 12': [99, 108], 'look 16': [100, 117], never: [97, 118] },
  12: { 'as set': [89, 108], 'look 8': [78, 90], 'look 12': [89, 108], 'look 16': [79, 108], never: [52, 108] },
  30: { 'as set': [89, 108], 'look 8': [78, 90], 'look 12': [89, 108], 'look 16': [79, 108], never: [52, 108] },
};

function cell(rows) {
  const serves = rows.flatMap((r) => r.log.serves);
  return {
    orders: mean(rows.map((r) => r.log.orders.length)),
    served: mean(rows.map((r) => r.served)),
    missed: mean(rows.map((r) => r.missed)),
    req: mean(rows.map((r) => r.log.missedReq)),
    ord: mean(rows.map((r) => r.log.missedOrd)),
    ship: mean(rows.map((r) => r.log.shippersGone)),
    line: mean(rows.map((r) => r.lost)),
    wrong: serves.filter((x) => x.quality === 'wrong' && !x.late).length / rows.length,
    star3: share(rows, (r) => r.stars === 3),
    star2: share(rows, (r) => r.stars === 2),
    money: mean(rows.map((r) => r.coins)),
    idle: mean(rows.map((r) => r.time.idle / r.total)) * 100,
    rounds: mean(rows.map((r) => r.overtime.rounds)),
    burn: share(rows.filter((r) => r.overtime.rounds > 0), (r) => r.overtime.lost),
    pressed: share(rows, (r) => r.overtime.rounds > 0),
    jar: mean(rows.map((r) => r.overtime.jar)),
    paid: mean(rows.map((r) => r.overtime.paid)),
    lateGone: mean(rows.map((r) => r.log.lateGone)),
    asks: mean(rows.map((r) => r.log.asks)),
    guesses: mean(rows.map((r) => r.log.guesses)),
  };
}

const POLICIES = [['never', 'never', 3], ['once', 'always', 1], ['twice', 'always', 2], ['always', 'always', 3], ['hearts.5', 0.5, 3], ['hearts.7', 0.7, 3],
  ['stake', { hearts: 0.5, most: 3 }, 3], ['calm', { hearts: 0.5, most: 2 }, 3], ['calm-2', { hearts: 0.5, most: 2 }, 2]];

/** Takes the day's regular out of a shop, as a morning with nobody due. Only ever around one measurement. */
function noRegular(measure) {
  const keep = { at: rules.REGULAR_AT, first: rules.REGULAR_AT_FIRST_DAY };
  rules.REGULAR_AT = Infinity;
  rules.REGULAR_AT_FIRST_DAY = Infinity;
  const result = measure();
  rules.REGULAR_AT = keep.at;
  rules.REGULAR_AT_FIRST_DAY = keep.first;
  return result;
}

const need = (letters) => [...letters].some((letter) => SECTIONS.includes(letter));
const shops = need('abcdefgjk') ? Object.fromEntries(PROFILES.map((profile) => [profile, mornings(N, DAYS, { profile })])) : null;

if (need('a')) {
  console.log(`\n=== A. EVERYTHING ON, AGAINST THE BASELINE: kinds, waves, regulars, gear, overtime; upright; n=${N} per cell ===`);
  console.log('Each cell is the morning a chained shop has reached. money includes whatever the jar paid. never/calm/always are overtime policies; calm presses only with nobody outside and at most two others on the counter, hearts above half.');
  console.log('base = baseline/run.out as printed, day 12 from its day 14 row, day 2 run off a copy of 67ae6fd.');
  out('prof', 'day', 'queue', 'overtime', 'orders', 'served', 'miss', 'mReq', 'mOrd', 'ship', 'line', 'wrong', 'star3%', 'star2%', 'money', 'idle%', 'rounds', 'burn%', 'asks', 'guess', '| base:', 'served', 'miss', 'star3%', 'money', 'money%');
  for (const profile of PROFILES) for (const day of DAYS) for (const queue of ['fifo', 'kinds']) for (const [name, overtime] of day >= rules.OVERTIME_FROM_DAY ? [['never', 'never'], ['calm', { hearts: 0.5, most: 2 }], ['always', 'always']] : [['never', 'never']]) {
    const c = cell(play(shops[profile], day, { profile, queue, overtime }));
    const b = BASE[`${profile}-${day}`];
    out(profile, day, queue, name, f(c.orders), f(c.served), f(c.missed, 2), f(c.req, 2), f(c.ord, 2), f(c.ship, 2), f(c.line, 2), f(c.wrong, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0), f(c.idle, 1), f(c.rounds, 2), f(c.burn, 0), f(c.asks, 2), f(c.guesses, 2),
      '|', b.served, b.miss, b['star3%'], b.money, f((c.money / Number(b.money) - 1) * 100, 1));
  }
}

if (need('b')) {
  console.log(`\n=== B. IS OVERTIME STILL A DECISION, WITH REGULARS IN? same mornings, same seeds, n=${N} per cell ===`);
  console.log('hearts.x presses only while every heart on the counter is above x. stake leaves shippers out of that. calm also wants nobody outside and at most two others at the counter; calm-2 stops after two rounds. d$ is against never. sd is the spread of a shift.');
  out('prof', 'day', 'queue', 'policy', 'money', 'd$', 'd$%', 'sd', 'rounds', 'press%', 'burn%', 'jar', 'paid', 'lateGone', 'star3%', 'miss');
  for (const profile of PROFILES) for (const day of DAYS.filter((d) => d >= rules.OVERTIME_FROM_DAY)) for (const queue of ['fifo', 'kinds']) {
    let never = 0;
    for (const [name, overtime, overtimeRounds] of POLICIES) {
      const rows = play(shops[profile], day, { profile, queue, overtime, overtimeRounds });
      const c = cell(rows);
      const sd = Math.sqrt(mean(rows.map((r) => (r.coins - c.money) ** 2)));
      if (name === 'never') never = c.money;
      out(profile, day, queue, name, f(c.money, 1), f(c.money - never, 1), f((c.money / never - 1) * 100, 1), f(sd, 0), f(c.rounds, 2), f(c.pressed, 0), f(c.burn, 0), f(c.jar, 1), f(c.paid, 1), f(c.lateGone, 2), f(c.star3, 0), f(c.missed, 2));
    }
  }
}

if (need('c')) {
  console.log(`\n=== C. SHAPE OF A SHIFT, n=${N}, no overtime ===`);
  console.log('mean30: drinks per 30 s bucket across shifts (averaging across shifts smears waves, which do not line up).');
  console.log('within: inside each shift, 10 s buckets of the day proper summed over a sliding 30 s: busiest quarter vs quietest quarter, and the CV.');
  console.log('The build before any of this: skilled day 30 mean30 2.2 3.0 3.0 3.0 3.0 3.0 3.0 3.0, sloppy day 30 0.9 1.6 1.5 1.6 1.6 1.6 1.5 1.5.');
  const windows = (r) => {
    const buckets = Array.from({ length: 24 }, () => 0);
    for (const serve of r.log.serves) if (serve.at < 240_000) buckets[Math.floor(serve.at / 10_000)] += 1;
    const slid = buckets.slice(1).map((_, i) => buckets.slice(i, i + 3).reduce((a, b) => a + b, 0)).slice(0, 22);
    const sorted = [...slid].sort((a, b) => a - b);
    const q = Math.floor(sorted.length / 4);
    const m = mean(slid);
    return { low: mean(sorted.slice(0, q)), high: mean(sorted.slice(-q)), cv: m ? Math.sqrt(mean(slid.map((x) => (x - m) ** 2))) / m : 0 };
  };
  for (const profile of PROFILES) for (const day of DAYS) {
    const rows = play(shops[profile], day, { profile });
    const per30 = Array.from({ length: 8 }, (_, b) => mean(rows.map((x) => x.log.serves.filter((s) => Math.floor(s.at / 30000) === b).length)));
    const w = rows.map(windows);
    console.log(profile, 'day', day, 'mean30', per30.map((v) => f(v, 1)).join(' '), '| within: quietest', f(mean(w.map((x) => x.low)), 2), 'busiest', f(mean(w.map((x) => x.high)), 2), 'cv', f(mean(w.map((x) => x.cv)), 2), '| quiets', f(mean(rows.map((r) => r.log.lulls)), 1), 'idle%', f(mean(rows.map((r) => r.time.idle / r.total)) * 100, 1));
  }
}

if (need('d')) {
  console.log(`\n=== D. HOW SLOW MAY YOU BE? sloppy timing x speed, everything on, no overtime, n=${N} ===`);
  console.log('The build before any of this: day 12 and 30 at 1 / 1.25 / 1.5 / 2 gave 89 / 39 / 12 / 0 % three stars.');
  out('day', 'queue', 'speed', 'served', 'miss', 'line', 'wrong', 'star3%', 'star2%', 'money');
  for (const day of [3, 7, 12, 30]) for (const queue of ['fifo', 'kinds']) for (const speed of [1, 1.25, 1.5, 2]) {
    const c = cell(play(shops.sloppy, day, { profile: 'sloppy', queue, speed }));
    out(day, queue, speed, f(c.served), f(c.missed, 2), f(c.line, 2), f(c.wrong, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0));
  }
}

if (need('e')) {
  console.log(`\n=== E. WHAT THE GEAR DOES, same mornings, gear swapped, no overtime, n=${N} ===`);
  console.log('payback: days for an item to earn back its price against owning nothing that matters.');
  out('prof', 'day', 'gear', 'served', 'miss', 'line', 'star3%', 'money', 'd$', 'payback');
  for (const profile of PROFILES) for (const day of [7, 12, 30]) {
    let none = 0;
    for (const gear of [[], ['bench'], ['board'], ['bench', 'board']]) {
      const c = cell(play(shops[profile], day, { profile, gear }));
      if (!gear.length) none = c.money;
      const price = gear.reduce((sum, id) => sum + GEAR.find((item) => item.id === id).price, 0);
      out(profile, day, gear.join('+') || '-', f(c.served), f(c.missed, 2), f(c.line, 2), f(c.star3, 0), f(c.money, 0), f(c.money - none, 1), gear.length && c.money > none ? f(price / (c.money - none), 0) : '-');
    }
  }
}

if (need('f')) {
  console.log(`\n=== F. THE THIRD STAR AND THE HABIT OF NOTICING: sloppy, everything on, no overtime, n=${N} ===`);
  console.log('As set, the bot knows to the second when the badge rose. look N goes over from the kitchen once the badge is N seconds old. never only comes when its hands are free.');
  console.log('base = the build before any of this on the same habit, sloppy, FIFO: a copy of 67ae6fd with the same noticing added to its bot, which had none.');
  out('day', 'queue', 'noticing', 'mReq', 'miss', 'ship', 'line', 'star3%', 'star2%', 'money', '| base:', 'star3%', 'money');
  for (const day of DAYS) for (const queue of ['fifo', 'kinds']) {
    for (const [name, opts] of [['as set', {}], ['look 8', { noticeMs: 8_000 }], ['look 12', { noticeMs: 12_000 }], ['look 16', { noticeMs: 16_000 }], ['never', { panicOff: true }]]) {
      const c = cell(play(shops.sloppy, day, { profile: 'sloppy', queue, ...opts }));
      out(day, queue, name, f(c.req, 2), f(c.missed, 2), f(c.ship, 2), f(c.line, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0), '|', ...HABIT_BASE[day][name]);
    }
  }
}

if (need('g')) {
  console.log(`\n=== G. DO REGULARS CHANGE ANYTHING? same mornings, same seeds, no overtime, n=${N} ===`);
  console.log('off is a morning with nobody due: the same shop, with the visit taken away. Every other row has the regular, with this answer to a blank card:');
  console.log("ask always, guess always, sure only on a usual that feels right, 0.5/0.8 whenever the chance of having it right is at least that. d$ is against off. A visit is at most one drink a shift.");
  out('prof', 'day', 'usual', 'served', 'miss', 'wrong', 'star3%', 'money', 'd$', 'tips', 'asks', 'guess', '| the visit:', 'came%', 'blank%', 'perfect%', 'wrong%', 'paid');
  for (const profile of PROFILES) for (const day of DAYS) {
    const off = noRegular(() => cell(play(shops[profile], day, { profile })));
    out(profile, day, 'off', f(off.served), f(off.missed, 2), f(off.wrong, 2), f(off.star3, 0), f(off.money, 1), '0.0', f(0));
    for (const usual of ['ask', 'guess', 'sure', 0.5, 0.8]) {
      const rows = play(shops[profile], day, { profile, usual });
      const c = cell(rows);
      const visits = rows.flatMap((r) => r.log.serves.filter((serve) => serve.regular));
      out(profile, day, usual, f(c.served), f(c.missed, 2), f(c.wrong, 2), f(c.star3, 0), f(c.money, 1), f(c.money - off.money, 1), f(mean(rows.map((r) => r.tips)), 1), f(c.asks, 2), f(c.guesses, 2),
        '|', f(visits.length / rows.length * 100, 0), f(share(visits, (v) => v.recall === 'blank'), 0), f(share(visits, (v) => v.quality === 'perfect'), 0), f(share(visits, (v) => v.quality === 'wrong'), 0), f(mean(visits.map((v) => v.earned)), 1));
    }
  }
}

if (need('h')) {
  console.log(`\n=== H. THE BOT THAT READS NO ORDERS: a plain S black tea for everyone, a 3% pour, no slips, n=${N} ===`);
  console.log('The build before any of this earned 0.3 and two stars on every shift, on days 1, 7 and 30.');
  out('day', 'served', 'miss', 'wrong', 'money', 'stars 0/1/2/3 %');
  const stops = mornings(N, DAYS, { queue: 'fifo', overtime: 'never', garbage: true, pour: 'tiny', slipOverride: 0 });
  for (const day of DAYS) {
    const rows = play(stops, day, { garbage: true, pour: 'tiny', slipOverride: 0 });
    const c = cell(rows);
    out(day, f(c.served, 2), f(c.missed, 2), f(c.wrong, 2), f(c.money, 1), [0, 1, 2, 3].map((n) => f(share(rows, (r) => r.stars === n), 0)).join('/'));
  }
}

if (need('i')) {
  console.log(`\n=== I. THIRTY DAYS IN A ROW FROM A NEW SHOP, n=${N} shops per row ===`);
  console.log('till is what is left at the end of that day, after shopping. wishes is what it buys, in order, as soon as the till covers it, one check a day-end.');
  console.log('The build before any of this reached about 7,031 (skilled) with nothing to buy.');
  const ROWS = [
    ['cheapest first', {}],
    ['buys nothing', { wishes: [] }],
    ['saves for what works', { wishes: USEFUL, saving: true }],
    ['triage', { queue: 'kinds' }],
    ['never presses', { overtime: 'never' }],
    ['always presses', { overtime: 'always' }],
    ['presses twice', { overtime: 'always', overtimeRounds: 2 }],
    ['presses once', { overtime: 'always', overtimeRounds: 1 }],
  ].filter(([name]) => !process.argv[4] || name.includes(process.argv[4]));
  const marks = [1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 30];
  for (const profile of PROFILES) for (const [name, patch] of ROWS) {
    const runs = Array.from({ length: N }, (_, run) => chain(run, { ...REFERENCE, profile, ...patch }));
    const at = (day, read) => runs.map((log) => read(log[day - 1]));
    console.log(`\n${profile}, ${name}`);
    console.log('till p50 by day   ', marks.map((d) => `d${d} ${f(pct(at(d, (r) => r.till), 0.5), 0)}`).join('  '));
    console.log('till p10          ', marks.map((d) => `d${d} ${f(pct(at(d, (r) => r.till), 0.1), 0)}`).join('  '));
    console.log('till p90          ', marks.map((d) => `d${d} ${f(pct(at(d, (r) => r.till), 0.9), 0)}`).join('  '));
    console.log('takings a day     ', marks.map((d) => `d${d} ${f(mean(at(d, (r) => r.coins)), 0)}`).join('  '));
    console.log('three stars %     ', marks.map((d) => `d${d} ${f(share(at(d, (r) => r), (r) => r.stars === 3), 0)}`).join('  '));
    const lifetime = runs.map((log) => log.reduce((sum, r) => sum + r.coins, 0));
    const days3 = mean(runs.map((log) => log.filter((r) => r.stars === 3).length));
    console.log('earned in 30 days ', f(mean(lifetime), 0), 'sd', f(Math.sqrt(mean(lifetime.map((x) => (x - mean(lifetime)) ** 2))), 0), '| three-star days', f(days3, 1), 'of 30');
    for (const item of GEAR) {
      const when = runs.map((log) => log.find((r) => r.bought.includes(item.id))?.day ?? Infinity);
      const got = when.filter(Number.isFinite);
      console.log(`  ${item.id.padEnd(8)} ${String(item.price).padStart(5)}  bought by day: p10 ${got.length ? pct(when, 0.1) : '-'}  p50 ${got.length ? pct(when, 0.5) : '-'}  p90 ${pct(when, 0.9)}  owned by day 30: ${f(got.length / N * 100, 0)}%`);
    }
    const final = runs.map((log) => Object.values(log[29].regulars));
    console.log('regulars by day 30', 'met', f(mean(final.map((list) => list.length)), 1), 'visits each', f(mean(final.flatMap((list) => list.map((m) => m.visits))), 1), 'streak mean', f(mean(final.flatMap((list) => list.map((m) => m.streak))), 2), 'p90', pct(final.flatMap((list) => list.map((m) => m.streak)), 0.9),
      '| asks', f(mean(runs.map((log) => log.reduce((sum, r) => sum + r.log.asks, 0))), 1), 'guesses', f(mean(runs.map((log) => log.reduce((sum, r) => sum + r.log.guesses, 0))), 1));
    console.log('overtime          ', 'rounds a day', f(mean(runs.flat().map((r) => r.overtime.rounds)), 2), 'burn% of shifts that pressed', f(share(runs.flat().filter((r) => r.overtime.rounds > 0), (r) => r.overtime.lost), 0));
  }
}

if (need('j')) {
  console.log(`
=== J. HOW MUCH OF THE THIRD PRESS IS THE ASSUMED TIMING? skilled timing x speed, same mornings, n=${N} ===`);
  console.log('third is what always adds on top of twice. Nobody has timed a real drink, and the burn rises steeply around the floor, so this is the sensitivity of the answer.');
  out('day', 'queue', 'speed', 'never', 'twice', 'always', 'third', 'burn% twice', 'burn% always');
  for (const day of [7, 12, 30]) for (const queue of ['fifo', 'kinds']) for (const speed of [0.85, 1, 1.15, 1.3, 1.5]) {
    const [never, twice, always] = [['never', 3], ['always', 2], ['always', 3]].map(([overtime, overtimeRounds]) => cell(play(shops.skilled, day, { profile: 'skilled', queue, speed, overtime, overtimeRounds })));
    out(day, queue, speed, f(never.money, 0), f(twice.money - never.money, 0), f(always.money - never.money, 0), f(always.money - twice.money, 0), f(twice.burn, 0), f(always.burn, 0));
  }
}

if (need('k')) {
  console.log(`
=== K. DOES THE REGULAR CHANGE THE PILL? overtime with and without the day's regular, same mornings, n=${N} ===`);
  console.log('A regular never comes in late, so the only way one could reach overtime is through the day before it. d$ is each policy against never, inside its own column.');
  out('prof', 'day', 'queue', 'policy', 'with: d$', 'burn%', 'without: d$', 'burn%');
  for (const profile of PROFILES) for (const day of [12, 30]) for (const queue of ['fifo', 'kinds']) {
    const row = (overtime, overtimeRounds) => cell(play(shops[profile], day, { profile, queue, overtime, overtimeRounds }));
    const never = row('never', 3);
    const neverOff = noRegular(() => row('never', 3));
    for (const [name, overtime, overtimeRounds] of [['once', 'always', 1], ['twice', 'always', 2], ['always', 'always', 3], ['calm', { hearts: 0.5, most: 2 }, 3]]) {
      const on = row(overtime, overtimeRounds);
      const off = noRegular(() => row(overtime, overtimeRounds));
      out(profile, day, queue, name, f(on.money - never.money, 1), f(on.burn, 0), f(off.money - neverOff.money, 1), f(off.burn, 0));
    }
  }
}
