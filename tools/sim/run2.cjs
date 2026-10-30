const { shift, tilesOf, stepsOf, PROFILES, getDayConfig } = require('./bot.cjs');
const { src } = require('./load.cjs');
const { generateOrder, drinkPrice } = src('game/orders.ts');
const { createRng } = src('game/random.ts');
const ING = src('game/ingredients.ts');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const many = (o, n = 300) => Array.from({ length: n }, (_, i) => shift({ ...o, seed: 1000 + i * 7919 }));

console.log('=== A. WHERE A SHIFT GOES (share of the whole shift) ===');
for (const [profile, day] of [['skilled', 3], ['skilled', 30], ['sloppy', 30]]) {
  const r = many({ day, profile });
  const sh = (k) => mean(r.map((x) => x.time[k] / x.total)) * 100;
  const drinks = mean(r.map((x) => x.served));
  const per = (k) => mean(r.map((x) => x.time[k])) / drinks / 1000;
  console.log(profile, 'day', day, `hands ${f(sh('hands'))}% read ${f(sh('read'))}% travel ${f(sh('travel'))}% lid-wait ${f(sh('machine'))}% idle ${f(sh('idle'))}%`,
    `| per drink s: hands ${f(per('hands'))} read ${f(per('read'))} travel ${f(per('travel'))} lid ${f(per('machine'))} idle ${f(per('idle'))} | cycle ${f(mean(r.map((x) => x.total)) / drinks / 1000)}s | trips/drink ${f(mean(r.map((x) => x.log.trips)) / drinks, 2)} pans/drink ${f(mean(r.map((x) => x.log.pans)) / drinks, 2)}`);
}

console.log('\n=== B. WHAT AN ORDER IS (100k orders straight from generateOrder) ===');
for (const day of [1, 7]) {
  const cfg = getDayConfig(day); const rng = createRng(99); const os = Array.from({ length: 100000 }, () => generateOrder(cfg, rng));
  const tiles = os.map(tilesOf), steps = os.map(stepsOf), price = os.map(drinkPrice);
  const mp = mean(price), ms = mean(steps);
  const corr = mean(price.map((p, i) => (p - mp) * (steps[i] - ms))) / (sd(price) * sd(steps));
  const hist = {}; for (const t of tiles) hist[t] = (hist[t] || 0) + 1;
  console.log(`day ${day}: tiles mean ${f(mean(tiles), 2)} sd ${f(sd(tiles), 2)} p10-p90 ${pct(tiles, .1)}-${pct(tiles, .9)} | taps mean ${f(ms, 1)} sd ${f(sd(steps), 1)} p10-p90 ${pct(steps, .1)}-${pct(steps, .9)} max ${Math.max(...steps)} | price mean ${f(mp, 2)} sd ${f(sd(price), 2)} p10-p90 ${pct(price, .1)}-${pct(price, .9)} | corr(price,taps) ${f(corr, 2)}`);
  console.log('  tile histogram %:', Object.entries(hist).map(([k, v]) => `${k}:${f(v / 1000, 1)}`).join(' '));
  const shapes = new Set(os.map((o) => JSON.stringify(o))).size;
  console.log('  distinct exact orders in 100k:', shapes);
}
console.log('order space: days1-4', 3*6*10*4*3*3*3, ' days5+', 3*6*46*4*3*3*3);

console.log('\n=== C. SHAPE OF A SHIFT: customers at the counter by 30 s bucket, and drinks served per 30 s ===');
for (const [profile, day] of [['skilled', 3], ['skilled', 30], ['sloppy', 30]]) {
  const r = many({ day, profile });
  const occ = Array.from({ length: 8 }, (_, b) => mean(r.map((x) => (x.log.occ[b] ? x.log.occ[b].sum / x.log.occ[b].n : 0))));
  const srv = Array.from({ length: 8 }, (_, b) => mean(r.map((x) => x.log.serves.filter((s) => Math.floor(s.at / 30000) === b).length)));
  console.log(profile, 'day', day, 'occupancy', occ.map((v) => f(v, 2)).join(' '), '| served', srv.map((v) => f(v, 1)).join(' '));
}

console.log('\n=== D. FAIR TEST OF SCHEDULING: hybrids and triage, day 30, skilled timing x speed, no slips, n=200 ===');
console.log('speed\tqueue\tbuild\tserved\tmissed\tmoney\tstar3%');
for (const speed of [1, 2, 3, 4, 5]) {
  for (const queue of ['fifo', 'smartprice', 'smartshort', 'lifo', 'triage']) {
    const r = many({ day: 30, profile: 'skilled', speed, slipOverride: 0, queue, take: 'batch' }, 200);
    console.log([speed, queue, f(mean(r.flatMap((x) => x.log.builds)) / 1000), f(mean(r.map((x) => x.served))), f(mean(r.map((x) => x.missed)), 2), f(mean(r.map((x) => x.coins)), 0), f(r.filter((x) => x.stars === 3).length / 2, 0)].join('\t'));
  }
}

console.log('\n=== E. ORDER-TAKING PATIENCE WITH NO PANIC: only ever looks up between drinks, n=300 ===');
for (const [profile, day] of [['skilled', 30], ['sloppy', 30]]) for (const speed of [1, 1.5, 2]) for (const take of ['eager', 'batch']) {
  const r = many({ day, profile, speed, panicOff: true, take });
  console.log(profile, 'x' + speed, take, 'mReq', f(mean(r.map((x) => x.log.missedReq)), 2), 'mOrd', f(mean(r.map((x) => x.log.missedOrd)), 2), 'served', f(mean(r.map((x) => x.served))), 'minTakeLeft', f(Math.min(...r.flatMap((x) => x.log.takes.map((t) => t.left))), 2));
}

console.log('\n=== F. NOVELTY: which drink shows you the last ingredient you have not seen? (day 1 order stream) ===');
{
  const cfg = getDayConfig(1);
  const total = ['tea','toppings','milk','foam','sweetness','ice'].reduce((n, c) => n + cfg.options[c].filter((id) => !ING.getIngredient(c, id)?.isNone && id !== ING.DEFAULT_ID[c]).length, 0);
  const firsts = [], at = { 50: [], 80: [], 90: [] };
  for (let run = 0; run < 2000; run++) {
    const rng = createRng(run * 31 + 7); const seen = new Set(); let n = 0;
    const marks = {};
    while (seen.size < total && n < 500) {
      const o = generateOrder(cfg, rng); n++;
      for (const c of ['tea','milk','foam','sweetness','ice']) if (ING.asksFor(o, c)) seen.add(c + ':' + o[c]);
      for (const id of o.toppings) seen.add('top:' + id);
      for (const p of [50, 80, 90]) if (!marks[p] && seen.size >= total * p / 100) marks[p] = n;
    }
    firsts.push(n); for (const p of [50, 80, 90]) at[p].push(marks[p]);
  }
  console.log(`askable ingredients: ${total}. 50% seen by drink ${f(mean(at[50]))}, 80% by ${f(mean(at[80]))}, 90% by ${f(mean(at[90]))}, all by ${f(mean(firsts))} (p90 ${pct(firsts, .9)})`);
}

console.log('\n=== G. HOW MANY SLIPS BEFORE THE THIRD STAR GOES? skilled tempo, ship the mistake, day 7, n=200 ===');
for (const slip of [0, 0.01, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2]) {
  const r = many({ day: 7, profile: 'skilled', slipOverride: slip, fix: 'ship' }, 200);
  const drinks = mean(r.map((x) => x.served));
  console.log('slip/step', slip, 'perfect%', f(mean(r.map((x) => x.perfect)) / drinks * 100, 0), 'star3%', f(r.filter((x) => x.stars === 3).length / 2, 0), 'money', f(mean(r.map((x) => x.coins)), 0));
}
console.log('same with remake:');
for (const slip of [0.01, 0.05, 0.1, 0.15]) {
  const r = many({ day: 7, profile: 'skilled', slipOverride: slip, fix: 'remake' }, 200);
  const drinks = mean(r.map((x) => x.served));
  console.log('slip/step', slip, 'perfect%', f(mean(r.map((x) => x.perfect)) / drinks * 100, 0), 'served', f(drinks), 'star3%', f(r.filter((x) => x.stars === 3).length / 2, 0), 'money', f(mean(r.map((x) => x.coins)), 0), 'remakes', f(mean(r.map((x) => x.log.remakes))));
}

console.log('\n=== H. STAYS TRUE WHEN THE TIMING GUESSES MOVE? day 30 default play, tap time varied ===');
for (const tap of [300, 400, 600, 800, 1000]) {
  PROFILES.skilled.tap = tap;
  const r = many({ day: 30, profile: 'skilled', slipOverride: 0 }, 200);
  const dr = mean(r.map((x) => x.served));
  console.log('tap', tap, 'build', f(mean(r.flatMap((x) => x.log.builds)) / 1000), 'served', f(dr), 'missed', f(mean(r.map((x) => x.missed)), 2), 'money', f(mean(r.map((x) => x.coins)), 0), 'star3%', f(r.filter((x) => x.stars === 3).length / 2, 0));
}
PROFILES.skilled.tap = 400;
