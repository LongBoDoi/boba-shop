/* Reducer-level FIFO checks, including legacy saves and automatic order taking. */
const assert = require('node:assert/strict');
const { src } = require('./sim/load.cjs');
const { createInitialState, gameReducer: R, frontSlot, queueSlots, canServe, patienceLeft } = src('game/reducer.ts');
const { serializeGame, parseGame } = src('game/save.ts');
const { layoutCounter, queuePosition } = src('counter/layout.ts');
let state = R(createInitialState(731), { type: 'START_DAY', day: 30 });
for (let i = 0; i < 150 && (state.slots.some(c => !c) || state.waveLeft > 0); i++) state = R(state, { type: 'TICK', dt: 100 });
assert(state.line.length > 0, 'The queue includes customers all the way back to the door');
const order = queueSlots(state.slots), head = order[0], behind = order[1];
assert.equal(R(state, { type: 'TAKE_ORDER', slot: behind }), state, 'Cannot take orders behind the head');
state = R(state, { type: 'TAKE_ORDER', slot: head });
assert.equal(state.slots.filter(c => c?.status === 'ordered').length, 1);
assert.equal(R(state, { type: 'SELECT_SLOT', slot: behind }), state, 'Cannot switch away from the active customer');
const before = state, ticked = R(state, { type: 'TICK', dt: 5000 });
assert.equal(patienceLeft(ticked.slots[behind], ticked.clock), patienceLeft(before.slots[behind], before.clock), 'Waiting does not consume service patience');
assert(patienceLeft(ticked.slots[head], ticked.clock) < patienceLeft(before.slots[head], before.clock));
const ready = { ...state, cup: state.slots[head].order,
  build: { ...state.build, fill: 0.65, lidded: true, straw: true, atCounter: true } };
const legacy = { ...ready, slots: ready.slots.map(c => c && { ...c, status: 'ordered', orderedAt: state.clock }), selectedSlot: behind };
assert(!canServe(legacy), 'Legacy selected orders cannot bypass the front');
assert.equal(R(legacy, { type: 'SERVE' }), legacy);
const restored = parseGame(serializeGame(legacy));
assert(restored && restored.selectedSlot !== behind, 'A legacy save cannot restore a rear service target');
const savedIds = queueSlots(restored.slots).map(i => restored.slots[i].id);
assert.deepEqual(savedIds, order.map(i => state.slots[i].id), 'Arrival order survives save/reload');
assert(canServe(ready));
const served = R(ready, { type: 'SERVE' });
assert.equal(served.stats.served, state.stats.served + 1);
assert.equal(frontSlot(served.slots), behind, 'Exactly the next arrival advances after service');
assert.equal(served.selectedSlot, null, 'The next order must be taken');
assert.equal(R(served, { type: 'TAKE_ORDER', slot: behind }).selectedSlot, behind);
const timed = R({ ...state, slots: state.slots.map((c, i) => i === head ? { ...c, patienceMs: 1, orderedAt: state.clock } : c) }, { type: 'TICK', dt: 100 });
assert.equal(frontSlot(timed.slots), behind, 'A timeout advances the same FIFO line');
for (const extra of [{ mode: 'relaxed' }, { gear: ['board'] }]) {
  const auto = R({ ...served, ...extra }, { type: 'TICK', dt: 100 });
  assert.equal(auto.slots[behind].status, 'ordered');
  assert.equal(auto.slots.filter(c => c?.status === 'ordered').length, 1, 'Auto ordering applies only to the front');
}
for (const [w, h] of [[375, 540], [390, 700], [568, 240], [932, 350], [768, 850]]) {
  const l = layoutCounter(w, h, w, h, 3);
  assert.equal(l.room.queueX, w / 2, 'The front customer is on the screen centerline');
  assert.equal(l.room.doorX, w / 2, 'The entrance is on the same centerline');
  assert.equal(l.room.handoff.x, w / 2, 'The serving cup stays on that centerline too');
  let last = queuePosition(l, 0);
  for (let rank = 1; rank < 9; rank++) {
    const next = queuePosition(l, rank);
    assert.equal(next.x, w / 2, 'The line stays vertical at every depth');
    assert(next.feet < last.feet && next.scale < last.scale, 'Queue recedes toward the door');
    assert(next.feet > l.room.doorY && next.x > 0 && next.x < w);
    last = next;
  }
}
console.log('check-customer-queue: FIFO, guarded ordering/selection/service, waiting clocks, save compatibility, advancement, auto orders and perspective.');
