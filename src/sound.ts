import { initAudio, playSound, setAudioSettings, setGamePaused, stopGameEffects } from './audio/audio';
import { CARRY_MS, COIN_FLIGHT_MS, COIN_START_MS } from './game/effectTiming';
import { GameState, Outcome } from './game/reducer';
import { leftContent } from './game/rules';
import { store } from './store';

export { playSound, setPourFill, setPouring } from './audio/audio';

/**
 * The shop's sound. `src/audio/` is the engine — the cue catalogue, the scheduler and the Web
 * Audio players; this is the part that watches the shop and tells it which track to play, how
 * loud, and which moments deserve a cue.
 */

const DEPARTURE_CUE: Record<Outcome, 'serveGood' | 'serveOk' | 'serveBad' | 'leave'> = {
  perfect: 'serveGood',
  close: 'serveOk',
  wrong: 'serveBad',
  timeout: 'leave',
};

function highestCustomer(state: GameState) {
  return state.slots.reduce((max, customer) => Math.max(max, customer?.id ?? 0), 0);
}

export function startSound() {
  initAudio();
  const sync = (state: GameState, previous: GameState | null) => {
    if (!previous || state.audio !== previous.audio) setAudioSettings(state.audio);
    const paused = state.phase === 'playing' && state.paused;
    if (!previous || paused !== (previous.phase === 'playing' && previous.paused)) setGamePaused(paused);
    if (previous && state.phase !== previous.phase) stopGameEffects();
    if (!previous) return;

    if (state.phase === 'dayEnd' && (previous.phase !== 'dayEnd' || previous.day !== state.day)) playSound('dayEnd');

    // Somebody served or gave up: one cue for how it went, and the till if they paid.
    if (state.departures !== previous.departures) {
      const seen = previous.departures.reduce((max, d) => Math.max(max, d.id), 0);
      for (const departure of state.departures) {
        if (departure.id <= seen) continue;
        // A close that paid nothing was no sale, so it does not sound like one.
        playSound(departure.outcome === 'close' && !leftContent(departure) ? 'serveBad' : DEPARTURE_CUE[departure.outcome]);
        if (departure.earned > 0) playSound('coin', COIN_START_MS + COIN_FLIGHT_MS);
      }
    }
    // Somebody new at the counter — but not a whole restored counter announcing itself.
    if (state.slots !== previous.slots && previous.phase === state.phase
      && highestCustomer(state) > highestCustomer(previous)) playSound('customer');
    // Over the brim, once per ruined drink.
    if (!previous.build.spilled && state.build.spilled) playSound('spill');
    // The finished cup carried out to the counter: lifted off the mat here, set down on the till
    // there, a flight later. See `CARRY_MS` and `HandoffCup`.
    if (!previous.build.atCounter && state.build.atCounter) {
      playSound('cupPickup');
      playSound('cupDown', CARRY_MS);
    }
  };
  sync(store.state, null);
  store.subscribe(sync);
}
