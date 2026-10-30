const fs = require('node:fs');
const { shift, R, getDayConfig, starsFor, PROFILES, MACHINE } = require('./bot.cjs');
const { src } = require('./load.cjs');
const { describeUnlocks } = src('game/levels.ts');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const out = {};
const N = 300;
const days = [1, 3, 7, 14, 30];

function many(opts, n = N) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(shift({ ...opts, seed: 1000 + i * 7919 }));
  return rows;
}
function summary(rows) {
  const flat = (k) => rows.flatMap((r) => r.log[k]);
  const serves = flat('serves');
  const takes = flat('takes');
  const T = (k) => mean(rows.map((r) => r.time[k] / r.total));
  const stars = [0, 1, 2, 3].map((n) => rows.filter((r) => r.stars === n).length / rows.length);
  const orders = rows.map((r) => r.log.orders.length);
  const distinct = rows.map((r) => new Set(r.log.orders.map((o) => JSON.stringify(o))).size);
  const shapes = rows.map((r) => new Set(r.log.orders.map((o) => ['toppings','sweetness','ice','milk','foam'].map((c) => (c === 'toppings' ? o.toppings.length : o[c] ? 1 : 0)).join(''))).size);
  return {
    served: mean(rows.map((r) => r.served)), servedSd: sd(rows.map((r) => r.served)),
    missed: mean(rows.map((r) => r.missed)), missReq: mean(rows.map((r) => r.log.missedReq)), missOrd: mean(rows.map((r) => r.log.missedOrd)),
    anyMiss: rows.filter((r) => r.missed > 0).length / rows.length,
    perfectRate: mean(rows.map((r) => r.perfect)) / Math.max(1e-9, mean(rows.map((r) => r.served))),
    close: serves.filter((x) => x.quality === 'close').length / rows.length,
    wrong: serves.filter((x) => x.quality === 'wrong').length / rows.length,
    stars,
    idle: T('idle'), hands: T('hands'), read: T('read'), travel: T('travel'), machine: T('machine'),
    leftMean: mean(serves.map((x) => x.left)), leftP5: pct(serves.map((x) => x.left), 0.05), leftMin: Math.min(...serves.map((x) => x.left)),
    tip: mean(serves.map((x) => x.tip)), tipShare: mean(rows.map((r) => r.tips)) / Math.max(1e-9, mean(rows.map((r) => r.coins))),
    tip3: serves.filter((x) => x.tip === 3).length / serves.length, tip2: serves.filter((x) => x.tip === 2).length / serves.length, tip1: serves.filter((x) => x.tip === 1).length / serves.length,
    takeLeft: mean(takes.map((x) => x.left)), takeLeftMin: Math.min(...takes.map((x) => x.left)),
    money: mean(rows.map((r) => r.coins)), moneySd: sd(rows.map((r) => r.coins)),
    orders: mean(orders), distinct: mean(distinct), shapes: mean(shapes),
    build: mean(serves.map((x) => x.buildMs)) / 1000, buildP10: pct(serves.map((x) => x.buildMs), .1) / 1000, buildP90: pct(serves.map((x) => x.buildMs), .9) / 1000,
    waited: mean(serves.map((x) => x.waitedMs)) / 1000, waitedMax: Math.max(...serves.map((x) => x.waitedMs)) / 1000,
    full: mean(rows.map((r) => r.log.fullMs / r.total)),
    trips: mean(rows.map((r) => r.log.trips)), pans: mean(rows.map((r) => r.log.pans)),
    slips: mean(rows.map((r) => r.log.slips)), remakes: mean(rows.map((r) => r.log.remakes)), spills: mean(rows.map((r) => r.log.spills)),
    total: mean(rows.map((r) => r.total)) / 1000,
  };
}

// ---------------------------------------------------------------- 1. the headline table
console.log('\n=== 1. FULL SHIFTS, standard mode, upright phone, n=' + N + ' per cell ===');
out.main = {};
const head = ['prof', 'day', 'orders', 'served', 'miss', 'mReq', 'mOrd', 'any%', 'perf%', 'close', 'wrong', 'star3%', 'busy%', 'idle%', 'lid%', 'trav%', 'left', 'p5', 'min', 'tip', 'tip$%', 'takeL', 'tkMin', 'money', 'sd', 'dist', 'shape', 'build', 'wait', 'wMax', 'full%'];
console.log(head.join('\t'));
for (const profile of ['skilled', 'sloppy']) for (const day of days) {
  const s = summary(many({ day, profile }));
  out.main[`${profile}-${day}`] = s;
  console.log([profile, day, f(s.orders), f(s.served), f(s.missed, 2), f(s.missReq, 2), f(s.missOrd, 2), f(s.anyMiss * 100, 0), f(s.perfectRate * 100, 0), f(s.close, 2), f(s.wrong, 2), f(s.stars[3] * 100, 0),
    f((1 - s.idle) * 100, 0), f(s.idle * 100, 1), f(s.machine * 100, 1), f(s.travel * 100, 1), f(s.leftMean, 2), f(s.leftP5, 2), f(s.leftMin, 2), f(s.tip, 2), f(s.tipShare * 100, 0), f(s.takeLeft, 2), f(s.takeLeftMin, 2), f(s.money, 0), f(s.moneySd, 0), f(s.distinct, 1), f(s.shapes, 1), f(s.build), f(s.waited), f(s.waitedMax), f(s.full * 100, 0)].join('\t'));
}
console.log('\nSkilled, landscape (no panning):');
for (const day of [1, 30]) { const s = summary(many({ day, profile: 'skilled', layout: 'landscape' })); console.log(day, 'served', f(s.served), 'build', f(s.build), 'money', f(s.money, 0), 'idle%', f(s.idle * 100, 1)); out[`landscape-${day}`] = s; }

// ---------------------------------------------------------------- 2. the dial
console.log('\n=== 2. THE DAY DIAL ===');
const knobs = ['maxToppings', 'slots', 'durationMs', 'orderPatienceMs', 'patienceMs', 'spawnMinMs', 'spawnMaxMs'];
for (const k of knobs) {
  let last = 1; for (let d = 2; d <= 200; d++) if (getDayConfig(d)[k] !== getDayConfig(d - 1)[k]) last = d;
  console.log(k.padEnd(16), 'day1', getDayConfig(1)[k], 'day30', getDayConfig(30)[k], 'last changes on day', last);
}
const { day: _a, ...c12 } = getDayConfig(12); const { day: _b, ...c30 } = getDayConfig(30); const { day: _c, ...c999 } = getDayConfig(999);
console.log('config 12 === 30 ?', JSON.stringify(c12) === JSON.stringify(c30), '; 12 === 999 ?', JSON.stringify(c12) === JSON.stringify(c999));
let same = 0; for (let i = 0; i < 100; i++) { const a = shift({ day: 12, seed: 5 + i, profile: 'skilled' }); const b = shift({ day: 30, seed: 5 + i, profile: 'skilled' }); if (a.coins === b.coins && a.served === b.served && a.total === b.total) same++; }
console.log('identical shift, same seed, day 12 vs day 30:', same, '/100');
console.log('Days 2..30 with anything to announce:', Array.from({ length: 29 }, (_, i) => i + 2).filter((d) => describeUnlocks(d).length).join(','));

// ---------------------------------------------------------------- 3. does it ever bite
console.log('\n=== 3. HOW SLOW MUST YOU BE? all human timing x speed, no slips, FIFO, n=200 ===');
console.log('day\tspeed\tbuild_s\tserved\tmissed\tmReq\tmOrd\thappy%\tmoney\tstar3%\tidle%');
out.speed = {};
for (const day of [1, 7, 30]) for (const speed of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
  const rows = many({ day, profile: 'skilled', speed, slipOverride: 0 }, 200);
  const s = summary(rows);
  const happy = s.served / (s.served + s.missed);
  out.speed[`${day}-${speed}`] = { ...s, happy };
  console.log([day, speed, f(s.build), f(s.served), f(s.missed, 2), f(s.missReq, 2), f(s.missOrd, 2), f(happy * 100, 0), f(s.money, 0), f(s.stars[3] * 100, 0), f(s.idle * 100, 1)].join('\t'));
}

// ---------------------------------------------------------------- 4. what binds: knobs moved past their floors on day 30
console.log('\n=== 4. COUNTERFACTUAL KNOBS, day 30 config, n=200 ===');
console.log('patch\tprofile\tserved\tmissed\tmReq\tmOrd\tmoney\tstar3%\tleft\tleftP5\tfull%\tidle%');
const patches = [
  ['as shipped', {}],
  ['spawn x0.5 (2-4.5s)', { spawnMinMs: 2000, spawnMaxMs: 4500 }],
  ['spawn x0.25 (1-2.25s)', { spawnMinMs: 1000, spawnMaxMs: 2250 }],
  ['patience 45s', { patienceMs: 45000 }],
  ['patience 30s', { patienceMs: 30000 }],
  ['patience 20s', { patienceMs: 20000 }],
  ['orderPatience 10s', { orderPatienceMs: 10000 }],
  ['slots 4', { slots: 4 }],
  ['slots 5', { slots: 5 }],
  ['slots 6', { slots: 6 }],
  ['slots 5 + patience 30s', { slots: 5, patienceMs: 30000 }],
];
out.knobs = {};
for (const [name, configPatch] of patches) for (const profile of ['skilled', 'sloppy']) {
  const s = summary(many({ day: 30, profile, configPatch }, 200));
  out.knobs[`${name}|${profile}`] = s;
  console.log([name, profile, f(s.served), f(s.missed, 2), f(s.missReq, 2), f(s.missOrd, 2), f(s.money, 0), f(s.stars[3] * 100, 0), f(s.leftMean, 2), f(s.leftP5, 2), f(s.full * 100, 0), f(s.idle * 100, 1)].join('\t'));
}

// ---------------------------------------------------------------- 5. decisions, one at a time
console.log('\n=== 5. DECISIONS, one at a time against the do-nothing default (fifo, eager, normal pour, remake), n=' + N + ' ===');
console.log('decision\tprofile\tday\tserved\tmissed\tperf%\tmoney\tdelta%\ttip\tstar3%\tbuild');
const variants = [
  ['default', {}],
  ['queue: lifo', { queue: 'lifo' }], ['queue: price-first', { queue: 'price' }], ['queue: shortest-first', { queue: 'short' }], ['queue: longest-first', { queue: 'long' }], ['queue: random', { queue: 'random' }],
  ['take: batch', { take: 'batch' }], ['take: lazy one-at-a-time', { take: 'lazy' }],
  ['pour: 3% tap', { pour: 'tiny' }],
  ['mistake: ship it', { fix: 'ship' }],
];
out.decisions = {};
for (const profile of ['skilled', 'sloppy']) for (const day of [3, 30]) {
  let base = null;
  for (const [name, o] of variants) {
    const rows = many({ day, profile, ...o });
    const s = summary(rows);
    if (!base) base = s;
    out.decisions[`${profile}-${day}-${name}`] = s;
    console.log([name, profile, day, f(s.served), f(s.missed, 2), f(s.perfectRate * 100, 0), f(s.money, 0), f((s.money / base.money - 1) * 100, 1), f(s.tip, 2), f(s.stars[3] * 100, 0), f(s.build)].join('\t'));
  }
}

// ---------------------------------------------------------------- 6. the hollow grade
console.log('\n=== 6. GARBAGE BOT: never reads an order, always hands over a plain S Hong tra, n=' + N + ' ===');
for (const day of [1, 7, 30]) {
  const rows = many({ day, profile: 'skilled', garbage: true, pour: 'tiny', slipOverride: 0 });
  const s = summary(rows);
  out[`garbage-${day}`] = s;
  console.log('day', day, 'served', f(s.served), 'missed', f(s.missed, 2), 'perfect%', f(s.perfectRate * 100, 1), 'wrong', f(s.wrong, 1), 'money', f(s.money, 0), 'stars[0..3]%', s.stars.map((x) => f(x * 100, 0)).join('/'));
}

// ---------------------------------------------------------------- 7. variance decomposition
console.log('\n=== 7. WHAT MOVES THE MONEY? main-effect share of variance, balanced factorial ===');
const factors = {
  tempo: [1, 1.5, 2], accuracy: [0.01, 0.05],
  queue: ['fifo', 'price', 'short'], take: ['eager', 'batch', 'lazy'], pour: ['normal', 'tiny'], fix: ['remake', 'ship'],
};
out.anova = {};
for (const day of [3, 30]) for (const metric of ['coins', 'stars', 'served']) {
  if (metric !== 'coins' && day === 3) continue;
}
for (const day of [3, 30]) {
  const SEEDS = 24;
  const data = [];
  for (const tempo of factors.tempo) for (const accuracy of factors.accuracy) for (const queue of factors.queue) for (const take of factors.take) for (const pour of factors.pour) for (const fix of factors.fix)
    for (let i = 0; i < SEEDS; i++) {
      const r = shift({ day, seed: 77 + i * 104729, profile: 'skilled', speed: tempo, slipOverride: accuracy, queue, take, pour, fix });
      data.push({ tempo, accuracy, queue, take, pour, fix, coins: r.coins, stars: r.stars, served: r.served, missed: r.missed });
    }
  for (const metric of ['coins', 'stars', 'served']) {
    const y = data.map((d) => d[metric]); const m = mean(y);
    const ssT = y.reduce((a, b) => a + (b - m) ** 2, 0);
    const line = {};
    let explained = 0;
    for (const k of Object.keys(factors)) {
      let ss = 0;
      for (const level of factors[k]) { const g = data.filter((d) => d[k] === level).map((d) => d[metric]); ss += g.length * (mean(g) - m) ** 2; }
      line[k] = ss / ssT; explained += ss;
    }
    line.rest = 1 - explained / ssT;
    out.anova[`${day}-${metric}`] = line;
    console.log(`day ${day} ${metric.padEnd(7)}`, Object.entries(line).map(([k, v]) => `${k} ${f(v * 100, 1)}%`).join('  '), ` (n=${y.length}, mean ${f(m, 1)})`);
  }
  const key = (d) => [d.queue, d.take, d.pour, d.fix].join('/');
  const groups = {}; for (const d of data.filter((x) => x.tempo === 1 && x.accuracy === 0.01)) (groups[key(d)] ||= []).push(d.coins);
  const ranked = Object.entries(groups).map(([k, v]) => [k, mean(v)]).sort((a, b) => b[1] - a[1]);
  const def = groups['fifo/eager/normal/remake'];
  console.log(`day ${day} best decisions at top execution: ${ranked[0][0]} = ${f(ranked[0][1], 0)}; default = ${f(mean(def), 0)}; worst ${ranked.at(-1)[0]} = ${f(ranked.at(-1)[1], 0)}`);
  const noPour = ranked.filter(([k]) => k.includes('/normal/'));
  console.log(`   excluding the 3%-pour rule abuse: best ${noPour[0][0]} = ${f(noPour[0][1], 0)}, +${f((noPour[0][1] / mean(def) - 1) * 100, 1)}% vs default`);
  const tempoGroups = factors.tempo.map((t) => [t, mean(data.filter((d) => d.tempo === t && d.queue === 'fifo' && d.take === 'eager' && d.pour === 'normal' && d.fix === 'remake' && d.accuracy === 0.01).map((d) => d.coins))]);
  console.log('   same default decisions, tempo x1/1.5/2:', tempoGroups.map(([t, v]) => `${t}: ${f(v, 0)}`).join('  '));
}

// ---------------------------------------------------------------- 8. thirty days in a row
console.log('\n=== 8. A THIRTY-DAY RUN, day after day, carrying the shop, 40 runs ===');
out.campaign = [];
const runs = [];
for (const profile of ['skilled', 'sloppy']) {
  const moneyByDay = Array.from({ length: 30 }, () => []);
  const starsByDay = Array.from({ length: 30 }, () => []);
  const allOrders = [], perRunDistinct = [];
  for (let run = 0; run < 40; run++) {
    let carry = null; const seen = new Set(); let count = 0;
    for (let day = 1; day <= 30; day++) {
      const start = carry ? R(carry, { type: 'START_DAY', day }) : null;
      const r = shift({ day, seed: 31 + run * 6151 + day, profile, start });
      carry = r.state;
      moneyByDay[day - 1].push(r.coins); starsByDay[day - 1].push(r.stars);
      for (const o of r.log.orders) { seen.add(JSON.stringify(o)); count++; }
    }
    runs.push({ profile, till: carry.money, orders: count, distinct: seen.size });
    perRunDistinct.push([count, seen.size]);
  }
  const line = (d) => `day ${d}: money ${f(mean(moneyByDay[d - 1]), 0)} stars ${f(mean(starsByDay[d - 1]), 2)}`;
  console.log(profile, [1, 2, 3, 5, 7, 9, 12, 14, 20, 30].map(line).join(' | '));
  const r = runs.filter((x) => x.profile === profile);
  console.log(profile, 'till after 30 days', f(mean(r.map((x) => x.till)), 0), '(units; 1 unit = 10.000d) | orders', f(mean(r.map((x) => x.orders)), 0), 'distinct', f(mean(r.map((x) => x.distinct)), 0));
  out.campaign.push({ profile, till: mean(r.map((x) => x.till)), byDay: moneyByDay.map(mean), starsByDay: starsByDay.map(mean) });
}

fs.writeFileSync('results.json', JSON.stringify(out, null, 1));
