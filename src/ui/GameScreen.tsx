import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { setGameArea } from '../game/host';
import { goToPage } from '../game/pager';
import { shallow, useGame, useUi } from '../hooks';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { Button } from './Button';
import { EffectsLayer } from './Effects';
import { Hud } from './Hud';
import { OpeningSign } from './OpeningSign';
import { PrepPage } from './PrepPage';
import { prepLayoutFor } from './responsive';
import { useViewport } from './viewport';

/**
 * A shift (`GameScreen.tsx`): the HUD and the page tabs fixed across the top, and under them the
 * pager — the counter and the kitchen side by side. The pager itself is a hole in the HTML: it is
 * measured and handed to the game (`setGameArea`), which lays the canvas over exactly that box and
 * slides its two scenes through it. The kitchen page's own HTML (the order card, the buttons)
 * slides with it; the counter page has none.
 *
 * The overlays — the day's sign, the pause card — stand over all of it. They never stack: the
 * pause card waits until the sign is put away (see "Saving the shop" in CLAUDE.md).
 */
export function GameScreen() {
  const viewport = useViewport();
  const pagerRef = useRef<HTMLDivElement>(null);
  const [pager, setPager] = useState({ width: 0, height: 0 });
  const page = useUi((ui) => ui.page);
  const opening = useUi((ui) => ui.opening);
  const paused = useGame((state) => state.paused);
  const warm = page === 1;
  const layout = prepLayoutFor(viewport.width, viewport.height, pager.height);

  useLayoutEffect(() => {
    // A shift always opens on the counter.
    uiState.set({ page: 0, pageOffset: 0 });
    const element = pagerRef.current!;
    const fit = () => {
      const rect = element.getBoundingClientRect();
      setGameArea({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      setPager((was) => (was.width === rect.width && was.height === rect.height ? was : { width: rect.width, height: rect.height }));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener('resize', fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      setGameArea(null);
    };
  }, []);

  return (
    <div class={`game ${warm ? 'warm' : ''}`}>
      <div class="game-safe-top" />
      <div class="game-side left" />
      <div class="game-side right" />
      <div class="game-body">
        <Hud warm={warm} />
        <PageTabs page={page} />
        <div ref={pagerRef} class="pager">
          {pager.width > 0 && <PrepPage layout={layout} width={pager.width} height={pager.height} />}
        </div>
        <EffectsLayer />
        {opening && <OpeningSign />}
        {paused && !opening && <PauseMenu />}
      </div>
    </div>
  );
}

/** The two-page indicator under the HUD: tap a label to switch screens. Swiping is the main way. */
const PageTabs = memo(function PageTabs({ page }: { page: 0 | 1 }) {
  const { requesting, tickets } = useGame((state) => {
    let requesting = 0;
    let tickets = 0;
    for (const customer of state.slots) {
      if (customer?.status === 'requesting') requesting++;
      else if (customer?.status === 'ordered') tickets++;
    }
    return { requesting, tickets };
  }, shallow);
  return (
    <div class="tabs live" role="tablist">
      <Tab label="Quầy" active={page === 0} badge={requesting} onPress={() => goToPage(0)} />
      <Tab label="Pha chế" active={page === 1} badge={tickets} onPress={() => goToPage(1)} />
    </div>
  );
});

function Tab({ label, active, badge, onPress }: { label: string; active: boolean; badge: number; onPress: () => void }) {
  return (
    <button type="button" class={`tab ${active ? 'active' : ''}`} role="tab" aria-selected={active} onClick={onPress}>
      <span class="tab-dot" />
      <span class="tab-label">{label}</span>
      {badge > 0 && (
        <span class="tab-badge">
          <span class="tab-badge-text">{badge}</span>
        </span>
      )}
    </button>
  );
}

function PauseMenu() {
  return (
    <div class="overlay live">
      <div class="overlay-dim overlay-dim-in" />
      <div class="overlay-center">
        <div class="pause-card card-in">
          <div class="card-title">Tạm dừng</div>
          <Button label="Tiếp tục" onPress={() => dispatch({ type: 'SET_PAUSED', paused: false })} />
          <Button label="⚙️ Cài đặt" variant="secondary" onPress={() => uiState.set({ settings: true })} />
          <Button label="Về menu chính" variant="secondary" onPress={() => dispatch({ type: 'GO_TO_TITLE' })} />
        </div>
      </div>
    </div>
  );
}
