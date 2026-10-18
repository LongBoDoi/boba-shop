import { initAudio, playSound, setAudioSettings, setGamePaused, setMusic } from '../../src/audio/audio';
import { MusicId } from '../../src/audio/sounds';
import { COIN_FLIGHT_MS, COIN_START_MS } from '../../src/game/effectTiming';
import { GameState, Outcome, Phase } from '../../src/game/reducer';
import { store } from './store';

export { playSound, setPourFill, setPouring } from '../../src/audio/audio';

/**
 * The shop's sound is the Expo build's own engine (`src/audio/audio.ts` with its Web Audio
 * players) run unchanged; the shims in `src/shims/` stand in for the bits of Expo it touches. This
 * file is what `useAudio.ts` and `GameScreen`'s effects were: it watches the shop and tells the
 * engine which track to play, how loud, and which moments deserve a cue.
 */
const TRACKS: Record<Phase, MusicId> = { title: 'menu', playing: 'shop', dayEnd: 'menu' };

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
    if (!previous || state.phase !== previous.phase) setMusic(TRACKS[state.phase]);
    if (!previous) return;

    if (state.phase === 'dayEnd' && (previous.phase !== 'dayEnd' || previous.day !== state.day)) playSound('dayEnd');

    // Somebody served or gave up: one cue for how it went, and the till if they paid.
    if (state.departures !== previous.departures) {
      const seen = previous.departures.reduce((max, d) => Math.max(max, d.id), 0);
      for (const departure of state.departures) {
        if (departure.id <= seen) continue;
        playSound(DEPARTURE_CUE[departure.outcome]);
        if (departure.earned > 0) playSound('coin', COIN_START_MS + COIN_FLIGHT_MS);
      }
    }
    // Somebody new at the counter — but not a whole restored counter announcing itself.
    if (state.slots !== previous.slots && previous.phase === state.phase
      && highestCustomer(state) > highestCustomer(previous)) playSound('customer');
    // Over the brim, once per ruined drink.
    if (!previous.build.spilled && state.build.spilled) playSound('spill');
  };
  sync(store.state, null);
  store.subscribe(sync);
}
