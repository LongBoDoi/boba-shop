import { useEffect, useRef } from 'react';

import { GameState, Phase } from '../game/reducer';
import { initAudio, playSound, setAudioSettings, setGamePaused, setMusic } from './audio';
import { MusicId } from './sounds';

/**
 * The only two places React touches the audio.
 *
 * Everything else calls `playSound` straight from wherever the thing happened — see the note at
 * the top of `audio.ts` for why that is imperative rather than a context.
 */

/**
 * Which loop belongs under each screen. The day-end screen goes back to the menu's theme rather
 * than having one of its own: it is the same shop with the shutters down, and a third track would
 * be another 400 kB to say so.
 */
const TRACKS: Record<Phase, MusicId> = { title: 'menu', playing: 'shop', dayEnd: 'menu' };

/** Build the players and keep them for the life of the app. Call once, at the very top. */
export function useAudioEngine() {
  useEffect(() => initAudio(), []);
}

/**
 * Keep the engine in step with the shop: the player's volumes, and the track for the screen they
 * are on.
 *
 * This reads the *live* state and not the frozen screen the phase transition is still wiping
 * over. The wipe is 250 ms and a crossfade is 900, so starting the fade when the phase actually
 * changes means the new music is already coming up as the new screen is revealed; following the
 * wipe instead would leave a quarter second of the old shop's music under the new one's.
 */
export function useGameAudio(state: GameState) {
  const { music, sfx } = state.audio;
  useEffect(() => {
    setAudioSettings({ music, sfx });
  }, [music, sfx]);

  const { phase, day } = state;
  const paused = state.phase === 'playing' && state.paused;
  useEffect(() => {
    setGamePaused(paused);
    return () => setGamePaused(false);
  }, [paused]);
  useEffect(() => {
    setMusic(TRACKS[phase]);
  }, [phase]);

  // The day's own fanfare, once per day. Keyed on the day and not only on the phase, because
  // `START_DAY` and the walk back to `dayEnd` can both happen without the component remounting.
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'dayEnd') {
      announced.current = null;
      return;
    }
    if (announced.current === day) return;
    announced.current = day;
    playSound('dayEnd');
  }, [phase, day]);
}
