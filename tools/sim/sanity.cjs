const { shift } = require('./bot.cjs');
let worst = 0, stuck = 0, n = 0, rounds = 0, burnt = 0;
for (const o of [{}, { take: 'batch' }, { take: 'lazy', lidHop: true }, { take: 'batch', lidHop: true }, { profile: 'sloppy' }, { profile: 'sloppy', lidHop: true, take: 'batch' }, { speed: 4 }, { garbage: true, pour: 'tiny' }, { overtime: 'always' }, { overtime: 0.5 }, { profile: 'sloppy', overtime: 'always' }, { queue: 'kinds' }, { queue: 'line', overtime: { hearts: 0.5, most: 2 } }, { profile: 'sloppy', queue: 'line', gear: ['bench'] }, { known: { visits: 3, streak: 2 } }, { known: { visits: 3 }, usual: 'guess' }, { known: { visits: 1 }, usual: 'ask', profile: 'sloppy' }, { known: { visits: 5, streak: 4 }, usual: 0.8, queue: 'kinds' }, { known: { visits: 3 }, garbage: true, pour: 'tiny' }])
  for (const day of [1, 7, 30]) for (let i = 0; i < 40; i++) {
    const r = shift({ day, seed: 9 + i * 101, ...o }); n++;
    const t = r.time, sum = t.idle + t.hands + t.read + t.travel + t.machine;
    worst = Math.max(worst, Math.abs(sum - r.total) / r.total);
    if (r.state.build.inLidder) stuck++;
    rounds += r.overtime.rounds;
    if (r.overtime.lost) burnt++;
    // A late customer is nothing to the stats, so they are left out of both of these.
    const counted = r.log.serves.filter((serve) => !serve.late);
    // A wrong drink is handed over, but it counts as a customer let down rather than a sale.
    const wrong = counted.filter((serve) => serve.quality === 'wrong').length;
    if (r.served !== counted.length - wrong) throw new Error('serve mismatch');
    if (r.missed !== r.log.missedReq + r.log.missedOrd + wrong) throw new Error('miss mismatch ' + r.missed + ' ' + r.log.missedReq + ' ' + r.log.missedOrd + ' ' + wrong);
  }
console.log({ shifts: n, worstAccountingError: worst.toFixed(4), stuckInLidder: stuck, overtimeRounds: rounds, jarsBurnt: burnt });
