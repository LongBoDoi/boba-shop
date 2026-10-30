const { shift } = require('./bot.cjs');
let worst = 0, stuck = 0, n = 0;
for (const o of [{}, { take: 'batch' }, { take: 'lazy', lidHop: true }, { take: 'batch', lidHop: true }, { profile: 'sloppy' }, { profile: 'sloppy', lidHop: true, take: 'batch' }, { speed: 4 }, { garbage: true, pour: 'tiny' }])
  for (const day of [1, 7, 30]) for (let i = 0; i < 40; i++) {
    const r = shift({ day, seed: 9 + i * 101, ...o }); n++;
    const t = r.time, sum = t.idle + t.hands + t.read + t.travel + t.machine;
    worst = Math.max(worst, Math.abs(sum - r.total) / r.total);
    if (r.state.build.inLidder) stuck++;
    if (r.served !== r.log.serves.length) throw new Error('serve mismatch');
    if (r.missed !== r.log.missedReq + r.log.missedOrd) throw new Error('miss mismatch ' + r.missed + ' ' + r.log.missedReq + ' ' + r.log.missedOrd);
  }
console.log({ shifts: n, worstAccountingError: worst.toFixed(4), stuckInLidder: stuck });
