/* Sweeps the rules' named constants without editing them. `node tools/sim/tune.cjs waves|overtime [n] [json grid]`. */
const { src } = require('./load.cjs');
const { shift } = require('./bot.cjs');
const { mornings, play } = require('./shop.cjs');

const rules = src('game/rules.ts');
const WHAT = process.argv[2] ?? 'waves';
const N = Number(process.argv[3]) || 150;
const GRID = process.argv[4] ? JSON.parse(process.argv[4]) : null;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const share = (rows, test) => (rows.length ? rows.filter(test).length / rows.length * 100 : NaN);
const many = (o, n = N) => Array.from({ length: n }, (_, i) => shift({ ...o, seed: 1000 + i * 7919 }));
/** The transpiled module reads its constants off `exports`, so these take effect everywhere at once. */
const set = (patch) => { for (const [key, value] of Object.entries(patch)) rules[key] = value; };
const label = (patch) => Object.entries(patch).map(([key, value]) => `${key.replace(/^(OVERTIME_|WAVE_)/, '')}=${value}`).join(' ');

function waves() {
  const grid = [];
  for (const MAX_WAVE of [4, 5, 6]) for (const WAVE_GROWTH_DAYS of [6, 9, 12]) for (const LINE_MS of [25_000, 35_000]) {
    grid.push({ MAX_WAVE, WAVE_GROWTH_DAYS, LINE_MS });
  }
  for (const [LULL_MIN_MS, LULL_MAX_MS] of [[6_000, 10_000], [4_000, 7_000]]) grid.push({ MAX_WAVE: 5, WAVE_GROWTH_DAYS: 9, LINE_MS: 35_000, LULL_MIN_MS, LULL_MAX_MS });
  console.log(['constants', 'sl.star3 d3/7/12/30', 'sl.line', 'sl.miss12/30', 'sl.money3/30', 'sk.star3 d30', 'sk.line', 'sk.money3/30', 'sk.idle30'].join('\t'));
  for (const patch of GRID ?? grid) {
    set({ LULL_MIN_MS: 6_000, LULL_MAX_MS: 10_000, ...patch });
    const sl = Object.fromEntries([3, 7, 12, 30].map((day) => [day, many({ day, profile: 'sloppy' })]));
    const sk = Object.fromEntries([3, 30].map((day) => [day, many({ day, profile: 'skilled' })]));
    console.log([
      label(patch),
      [3, 7, 12, 30].map((d) => f(share(sl[d], (r) => r.stars === 3), 0)).join('/'),
      [3, 7, 12, 30].map((d) => f(mean(sl[d].map((r) => r.lost)), 1)).join('/'),
      [12, 30].map((d) => f(mean(sl[d].map((r) => r.missed)), 2)).join('/'),
      [3, 30].map((d) => f(mean(sl[d].map((r) => r.coins)), 0)).join('/'),
      f(share(sk[30], (r) => r.stars === 3), 0),
      f(mean(sk[30].map((r) => r.lost)), 1),
      [3, 30].map((d) => f(mean(sk[d].map((r) => r.coins)), 0)).join('/'),
      f(mean(sk[30].map((r) => r.time.idle / r.total)) * 100, 0),
    ].join('\t'));
  }
}

const POLICIES = [['never', 'never', 3], ['once', 'always', 1], ['twice', 'always', 2], ['always', 'always', 3], ['hearts.5', 0.5, 3], ['hearts.7', 0.7, 3], ['calm', { hearts: 0.5, most: 2 }, 3], ['calm1', { hearts: 0.5, most: 1 }, 3], ['calm2x', { hearts: 0.5, most: 2 }, 2]];

/**
 * What each way of pressing is worth, on the mornings a chained shop reaches: regulars and gear in, no
 * longer the bare shift this first ran on. A row grows its own shops, since a day's config is fixed
 * the morning it opens.
 */
function overtime() {
  const grid = [
    {},
    { OVERTIME_PATIENCE: 0.8 },
    { OVERTIME_PATIENCE: 0.6 },
    { OVERTIME_BONUS_PER_ROUND: 0.05 },
    { OVERTIME_BONUS_PER_ROUND: 0.15 },
    { OVERTIME_BONUS_PER_ROUND: 0.3 },
    { OVERTIME_BURN_KEEPS: 0.25 },
    { OVERTIME_BURN_KEEPS: 0 },
  ];
  const patches = GRID ?? grid;
  const defaults = Object.fromEntries(Object.keys(Object.assign({}, ...patches)).map((key) => [key, rules[key]]));
  const days = [3, 7, 12, 30];
  console.log('Each cell: d$ against never on the same mornings and seeds, then burn% of shifts that pressed. Columns are policies.');
  console.log(['constants', 'prof', 'day', 'queue', 'never$', ...POLICIES.map(([name]) => name)].join('	'));
  for (const patch of patches) {
    set({ ...defaults, ...patch });
    for (const profile of ['skilled', 'sloppy']) {
      const shops = mornings(N, days, { profile });
      for (const day of days) for (const queue of ['fifo', 'kinds']) {
        let never = 0;
        const cells = POLICIES.map(([name, policy, overtimeRounds]) => {
          const rows = play(shops, day, { profile, queue, overtime: policy, overtimeRounds });
          const money = mean(rows.map((r) => r.coins));
          if (name === 'never') never = money;
          return `${f(money - never, 0)}/${f(share(rows.filter((r) => r.overtime.rounds > 0), (r) => r.overtime.lost), 0)}%`;
        });
        console.log([label(patch) || 'as set', profile, day, queue, f(never, 0), ...cells].join('	'));
      }
    }
  }
}

({ waves, overtime })[WHAT]();
