/* Existing rule/recipe tests model a headless counter. Explicitly acknowledge physical arrival
 * immediately; walking, save-mid-arrival and timer gating are tested with the RAW reducer in
 * check-customer-presence.cjs and the browser animation checks. Never used by the shipped app. */
function withInstantArrivals(reduce) {
  return (state, action) => {
    const next = reduce(state, action);
    if (next.phase !== 'playing' || next.paused) return next;
    const head = next.slots.filter(Boolean).sort((a, b) => a.id - b.id)[0];
    return head?.atCounter === false ? reduce(next, { type: 'CUSTOMER_AT_COUNTER', id: head.id }) : next;
  };
}
module.exports = { withInstantArrivals };
