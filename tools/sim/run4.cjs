/* The whole set played together, against baseline/run.out. `node tools/sim/run4.cjs [n] [sections]`. */
const fs = require('node:fs');
const path = require('node:path');
const { shift } = require('./bot.cjs');

const N = Number(process.argv[2]) || 200;
const SECTIONS = process.argv[3] ?? 'abcdef';
const DAYS = [1, 3, 7, 12, 30];
const PROFILES = ['skilled', 'sloppy'];

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const share = (rows, test) => rows.filter(test).length / rows.length * 100;
const many = (o, n = N) => Array.from({ length: n }, (_, i) => shift({ ...o, seed: 1000 + i * 7919 }));

/** Today's game before any of this, read back out of the baseline so the two cannot drift apart. */
function baseline() {
  const text = fs.readFileSync(path.join(__dirname, 'baseline/run.out'), 'utf8').split(/\r?\n/);
  const start = text.findIndex((line) => line.startsWith('prof\t'));
  const head = text[start].split('\t');
  const table = {};
  for (const line of text.slice(start + 1)) {
    const cells = line.split('\t');
    if (cells.length !== head.length) break;
    const row = Object.fromEntries(head.map((name, i) => [name, cells[i]]));
    table[`${row.prof}-${row.day}`] = row;
  }
  // Day 12 was not in that run, and it did not need to be: its config is day 14's and day 30's.
  for (const profile of PROFILES) table[`${profile}-12`] = table[`${profile}-14`];
  return table;
}
const BASE = baseline();

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
    total: mean(rows.map((r) => r.total)) / 1000,
    rounds: mean(rows.map((r) => r.overtime.rounds)),
    burn: share(rows.filter((r) => r.overtime.rounds > 0), (r) => r.overtime.lost),
    pressed: share(rows, (r) => r.overtime.rounds > 0),
    jar: mean(rows.map((r) => r.overtime.jar)),
    paid: mean(rows.map((r) => r.overtime.paid)),
    lateGone: mean(rows.map((r) => r.log.lateGone)),
  };
}

const out = (...parts) => console.log(parts.join('\t'));

if (SECTIONS.includes('a')) {
  console.log(`\n=== A. AGAINST THE BASELINE: standard mode, upright, no overtime, n=${N} per cell ===`);
  console.log('base = baseline/run.out as printed; day 12 there is day 14, whose config it shares.');
  console.log('queue: fifo never touches the ticket; kinds triages by deadline and tip; line is kinds, taking the shortest drink while anyone is outside.');
  out('prof', 'day', 'queue', 'orders', 'served', 'miss', 'mReq', 'mOrd', 'ship', 'line', 'wrong', 'star3%', 'star2%', 'money', 'idle%', '| base:', 'served', 'miss', 'star3%', 'money', 'money%');
  for (const profile of PROFILES) for (const day of DAYS) for (const queue of ['fifo', 'kinds', 'line']) {
    const c = cell(many({ day, profile, queue }));
    const b = BASE[`${profile}-${day}`];
    out(profile, day, queue, f(c.orders), f(c.served), f(c.missed, 2), f(c.req, 2), f(c.ord, 2), f(c.ship, 2), f(c.line, 2), f(c.wrong, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0), f(c.idle, 1),
      '|', b.served, b.miss, b['star3%'], b.money, f((c.money / Number(b.money) - 1) * 100, 1));
  }
}

const POLICIES = [['never', 'never', 3], ['once', 'always', 1], ['twice', 'always', 2], ['always', 'always', 3], ['hearts.5', 0.5, 3], ['hearts.7', 0.7, 3],
  ['stake', { hearts: 0.5, most: 3 }, 3], ['calm', { hearts: 0.5, most: 2 }, 3], ['calm-2', { hearts: 0.5, most: 2 }, 2]];

if (SECTIONS.includes('b')) {
  console.log(`\n=== B. OVERTIME: what each way of pressing is worth, n=${N} per cell ===`);
  console.log('hearts.x presses only while every heart on the counter is above x. stake leaves shippers out of that, who cannot burn the jar.');
  console.log('calm is stake with nobody outside and at most two others at the counter; calm-2 stops after two rounds. d$ is against never, same seeds. sd is the spread of a shift.');
  out('prof', 'day', 'queue', 'policy', 'money', 'd$', 'd$%', 'sd', 'rounds', 'press%', 'burn%', 'jar', 'paid', 'lateGone', 'star3%', 'miss');
  for (const profile of PROFILES) for (const day of DAYS.slice(1)) for (const queue of ['fifo', 'kinds']) {
    let never = 0;
    for (const [name, overtime, overtimeRounds] of POLICIES) {
      const rows = many({ day, profile, queue, overtime, overtimeRounds });
      const c = cell(rows);
      const sd = Math.sqrt(mean(rows.map((r) => (r.coins - c.money) ** 2)));
      if (name === 'never') never = c.money;
      out(profile, day, queue, name, f(c.money, 1), f(c.money - never, 1), f((c.money / never - 1) * 100, 1), f(sd, 0), f(c.rounds, 2), f(c.pressed, 0), f(c.burn, 0), f(c.jar, 1), f(c.paid, 1), f(c.lateGone, 2), f(c.star3, 0), f(c.missed, 2));
    }
  }
}

if (SECTIONS.includes('c')) {
  console.log(`\n=== C. SHAPE OF A SHIFT, n=${N} ===`);
  console.log('mean30: drinks per 30 s bucket across shifts (averaging across shifts smears waves, which do not line up).');
  console.log('within: inside each shift, 10 s buckets of the day proper summed over a sliding 30 s, averaged: busiest quarter vs quietest quarter, and the CV.');
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
    const rows = many({ day, profile });
    const per30 = Array.from({ length: 8 }, (_, b) => mean(rows.map((x) => x.log.serves.filter((s) => Math.floor(s.at / 30000) === b).length)));
    const w = rows.map(windows);
    console.log(profile, 'day', day, 'mean30', per30.map((v) => f(v, 1)).join(' '), '| within: quietest', f(mean(w.map((x) => x.low)), 2), 'busiest', f(mean(w.map((x) => x.high)), 2), 'cv', f(mean(w.map((x) => x.cv)), 2), '| quiets', f(mean(rows.map((r) => r.log.lulls)), 1), 'idle%', f(mean(rows.map((r) => r.time.idle / r.total)) * 100, 1));
  }
}

if (SECTIONS.includes('e')) {
  console.log(`\n=== E. THE BENCH: line patience x1.5, sloppy, n=${N} ===`);
  out('day', 'gear', 'served', 'miss', 'line', 'star3%', 'money');
  for (const day of [7, 12, 30]) for (const gear of [[], ['bench']]) {
    const c = cell(many({ day, profile: 'sloppy', gear }));
    out(day, gear.join() || '-', f(c.served), f(c.missed, 2), f(c.line, 2), f(c.star3, 0), f(c.money, 0));
  }
}

if (SECTIONS.includes('f')) {
  console.log(`
=== F. WHAT THE THIRD STAR RESTS ON: noticing someone waiting, from the kitchen, sloppy, n=${N} ===`);
  console.log('From the kitchen a customer not yet asked is a count on the tab, with no ring. As set, the bot knows to the second when the badge rose, and the kinds of faces it has seen.');
  console.log('look N goes over once the badge is N seconds old, whoever it is. never does not go over for that at all, and only comes when its hands are free.');
  out('day', 'queue', 'noticing', 'mReq', 'miss', 'ship', 'line', 'star3%', 'star2%', 'money');
  for (const day of [7, 12, 30]) for (const queue of ['fifo', 'kinds']) {
    for (const [name, opts] of [['as set', {}], ['look 8', { noticeMs: 8_000 }], ['look 12', { noticeMs: 12_000 }], ['look 16', { noticeMs: 16_000 }], ['never', { panicOff: true }]]) {
      const c = cell(many({ day, profile: 'sloppy', queue, ...opts }));
      out(day, queue, name, f(c.req, 2), f(c.missed, 2), f(c.ship, 2), f(c.line, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0));
    }
  }
}

if (SECTIONS.includes('d')) {
  console.log(`\n=== D. HOW SLOW MAY YOU BE? sloppy timing x speed, n=${N} ===`);
  out('day', 'speed', 'served', 'miss', 'line', 'star3%', 'star2%', 'money');
  for (const day of [3, 12, 30]) for (const speed of [1, 1.25, 1.5, 2]) {
    const c = cell(many({ day, profile: 'sloppy', speed }));
    out(day, speed, f(c.served), f(c.missed, 2), f(c.line, 2), f(c.star3, 0), f(c.star2, 0), f(c.money, 0));
  }
}
