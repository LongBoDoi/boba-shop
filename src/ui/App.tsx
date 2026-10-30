import './ui.css';

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { cupLayout, cupSvg } from '../art/cup';
import { colors } from '../art/theme';
import { setGameArea } from '../game/host';
import { useGame, useUi } from '../hooks';
import { store } from '../store';
import { uiState } from '../ui-state';
import { Drink } from '../game/ingredients';
import { GameState, Phase } from '../game/reducer';
import { DayEndScreen } from './DayEndScreen';
import { GameScreen } from './GameScreen';
import { LoadingScreen } from './LoadingScreen';
import { animateSampled, easeInOut } from './motion';
import { RegularBook } from './RegularBook';
import { SettingsSheet } from './SettingsSheet';
import { Svg } from './Svg';
import { TitleScreen } from './TitleScreen';
import { UpdateCard } from './UpdateCard';
import { startUpdates } from '../updates';

const WIPE_MS = 250;
const BADGE_DRINK: Drink = { size: 'M', toppings: ['pearls'], sweetness: null, ice: null, tea: 'black', milk: 'whole', foam: null };

/**
 * The day's sign goes up as a day opens — whenever the shop arrives at a day whose clock has never
 * moved, however it got there (a new day, the next day, a restored backup code). The clock is held
 * while it is up, and listening here, on the store itself, means the clock never takes a step first.
 */
function watchOpenings() {
  return store.subscribe((state: GameState, previous: GameState) => {
    if (state.phase === 'playing' && state.clock === 0 && (previous.phase !== 'playing' || previous.clock !== 0)) {
      uiState.set({ opening: true });
    } else if (state.phase !== 'playing' && uiState.value.opening) {
      uiState.set({ opening: false });
    }
  });
}

/**
 * The whole interface (`App.tsx` at the repository root): the loading screen until the shop is
 * ready, then the screen for the phase, with a wipe between phases. As in the original, the old
 * screen stays up while the wipe covers it and only then is the new one put in.
 */
export function App() {
  const ready = useUi((ui) => ui.ready);
  const phase = useGame((state) => state.phase);
  const settings = useUi((ui) => ui.settings);
  const book = useUi((ui) => ui.book);
  // A card that covers the screen and takes every touch must not be able to drain three patience
  // timers while it is read, so it waits for a lull — which at launch is immediate, because the
  // day is always either not started or paused by then.
  const busy = useGame((state) => state.phase === 'playing' && !state.paused);
  const opening = useUi((ui) => ui.opening);
  const [shown, setShown] = useState<Phase>(phase);
  const wiping = useRef(false);
  const fade = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);

  useEffect(watchOpenings, []);

  // Asking whether there is a new version is an installed app's business; the page is always the
  // newest build already. See `src/updates/`.
  useEffect(() => {
    if (ready) void startUpdates();
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      // Behind the loading screen the saved shop is put in place; it opens on its own phase.
      setShown(phase);
      return;
    }
    if (phase === shown || wiping.current) return;
    wiping.current = true;
    const run = (to: number, delay: number, duration: number) => {
      const from = 1 - to;
      const options = { delay, ease: easeInOut, steps: 12 };
      animateSampled(fade.current!, duration, (p) => ({ opacity: from + (to - from) * p }), options);
      // The cup only shows over the last stretch of pink.
      animateSampled(badge.current!, duration, (p) => {
        const wipe = from + (to - from) * p;
        return { opacity: Math.max(0, Math.min(1, (wipe - 0.6) / 0.4)) };
      }, options);
    };
    run(1, 0, WIPE_MS);
    // Not cleared when the phase moves again mid-wipe: the screen that comes up is whichever phase
    // the shop is in by then, exactly as the original's single `outgoing` did.
    setTimeout(() => {
      wiping.current = false;
      setShown(store.state.phase);
      run(0, 80, WIPE_MS + 100);
    }, WIPE_MS + 20);
    // `shown` changes only from here; the wipe is keyed off the phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready]);

  // A card opened on one screen does not follow the player to the next.
  useEffect(() => {
    uiState.set({ settings: false, book: false });
    if (shown !== 'playing') setGameArea(null);
  }, [shown]);

  const badgeMarkup = useMemo(() => cupSvg(BADGE_DRINK, { width: 64, backgroundColor: colors.primary, straw: true, sealed: true }), []);
  const badgeBox = cupLayout(64, { straw: true, sealed: true });

  if (!ready) return <LoadingScreen />;

  return (
    <div class="app-root">
      {shown === 'title' && <TitleScreen />}
      {shown === 'playing' && <GameScreen />}
      {shown === 'dayEnd' && <DayEndScreen />}
      {settings && <SettingsSheet />}
      {book && <RegularBook />}
      {!busy && !opening && <UpdateCard />}
      <div class="wipe">
        <div ref={fade} class="wipe-fade" />
        <div ref={badge} class="wipe-badge">
          <Svg markup={badgeMarkup} style={{ marginTop: -badgeBox.originY }} />
        </div>
      </div>
    </div>
  );
}
