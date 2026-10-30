const { shift } = require('./bot.cjs');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const many = (o, n = 300) => Array.from({ length: n }, (_, i) => shift({ ...o, seed: 1000 + i * 7919 }));
const row = (name, o, base) => {
  const r = many(o); const money = mean(r.map((x) => x.coins));
  console.log(name.padEnd(46), 'served', f(mean(r.map((x) => x.served))), 'mReq', f(mean(r.map((x) => x.log.missedReq)), 2), 'mOrd', f(mean(r.map((x) => x.log.missedOrd)), 2), 'money', f(money, 0), base ? `(${f((money / base - 1) * 100, 1)}%)` : '', 'star3%', f(r.filter((x) => x.stars === 3).length / r.length * 100, 0), 'trips/drink', f(mean(r.map((x) => x.log.trips)) / mean(r.map((x) => x.served)), 2));
  return money;
};
for (const [profile, day] of [['skilled', 30], ['skilled', 3], ['sloppy', 30]]) {
  console.log(`\n--- ${profile} day ${day}, against the default ---`);
  const base = row('default (fifo, eager, watches the tab)', { day, profile });
  row('batch', { day, profile, take: 'batch' }, base);
  row('lazy + hop to counter during lid press', { day, profile, take: 'lazy', lidHop: true }, base);
  row('batch + hop to counter during lid press', { day, profile, take: 'batch', lidHop: true }, base);
  row('batch + hop + 3% pour (the abuse)', { day, profile, take: 'batch', lidHop: true, pour: 'tiny' }, base);
  row('route: natural (card order)', { day, profile, routeOverride: 'natural' }, base);
  row('route: smart (fewest pans)', { day, profile, routeOverride: 'smart' }, base);
  row('eager, never watches the tab', { day, profile, panicOff: true }, base);
  row('batch, never watches the tab', { day, profile, panicOff: true, take: 'batch' }, base);
}
