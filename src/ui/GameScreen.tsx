import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import { setGameArea } from '../game/host';
import { formatMoney } from '../game/money';
import { goToPage } from '../game/pager';
import { canExtend } from '../game/reducer';
import { lullGroup, lullPreview, OVERTIME_ROUND_MS } from '../game/rules';
import { shallow, useGame, useUi } from '../hooks';
import { playSound } from '../sound';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { Button } from './Button';
import { EffectsLayer } from './Effects';
import { COIN_ARRIVAL_MS, Hud, useCountUp } from './Hud';
import { OpeningSign } from './OpeningSign';
import { PrepPage } from './PrepPage';
import { overtimeDockRight, PrepLayout, prepLayoutFor } from './responsive';
import { anchors, useViewport } from './viewport';

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
  const day = useGame((state) => state.day);
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
          {pager.width > 0 && <OvertimeDock layout={layout} right={overtimeDockRight(layout, pager.width, pager.height)} />}
          {pager.width > 0 && <LullPill />}
        </div>
        <EffectsLayer />
        {/* Keyed: a sign takes what it says as it goes up, so another day is another sign. */}
        {opening && <OpeningSign key={day} />}
        {paused && !opening && <PauseMenu />}
      </div>
    </div>
  );
}

/** The two-page indicator under the HUD: tap a label to switch screens. Swiping is the main way. */
const PageTabs = memo(function PageTabs({ page }: { page: 0 | 1 }) {
  const { requesting, tickets, outside } = useGame((state) => {
    let requesting = 0;
    let tickets = 0;
    for (const customer of state.slots) {
      if (customer?.status === 'requesting') requesting++;
      else if (customer?.status === 'ordered') tickets++;
    }
    return { requesting, tickets, outside: state.line.length };
  }, shallow);
  return (
    <div class="tabs live" role="tablist">
      <Tab label="Quầy" active={page === 0} badge={requesting} outside={outside} onPress={() => goToPage(0)} />
      <Tab label="Pha chế" active={page === 1} badge={tickets} onPress={() => goToPage(1)} />
    </div>
  );
});

function Tab({ label, active, badge, outside = 0, onPress }: { label: string; active: boolean; badge: number; outside?: number; onPress: () => void }) {
  return (
    <button type="button" class={`tab ${active ? 'active' : ''}`} role="tab" aria-selected={active} onClick={onPress}>
      <span class="tab-dot" />
      <span class="tab-label">{label}</span>
      {badge > 0 && (
        <span class="tab-badge">
          <span class="tab-badge-text">{badge}</span>
        </span>
      )}
      {outside > 0 && <span class="tab-line" aria-label={`${outside} khách đợi ngoài cửa`}>+{outside}</span>}
    </button>
  );
}

/**
 * The offer to stay open, and the jar it fills. It stands on the pager and not on a page, so it is
 * there whichever one the player is on, low down where a thumb already is. It is laid over the room
 * rather than in the page's flow, because the room's size is measured against every pixel of the
 * bars around it, and a pill that came and went would move the whole kitchen.
 */
const OvertimeDock = memo(function OvertimeDock({ layout, right }: { layout: PrepLayout; right: number }) {
  // A plain yes or no, so that only the moments it flips reach this component, not every tick.
  const offered = useGame(canExtend);
  const running = useGame((state) => state.overtime.rounds > 0);
  if (!offered && !running) return null;
  return (
    <div class={`overtime ${layout}`} style={{ right }}>
      {running && <JarLabel />}
      {offered && (
        <button
          type="button"
          class="overtime-pill live"
          onClick={() => {
            playSound('button');
            dispatch({ type: 'EXTEND_SHIFT' });
          }}
        >
          {`Mở thêm ${OVERTIME_ROUND_MS / 1000} giây`}
        </button>
      )}
    </div>
  );
});

/** What the late sales have made so far. Takes no touches: the coins land on it, like the wallet. */
function JarLabel() {
  const { jar, lost, forfeited } = useGame(({ overtime: { jar, lost, forfeited } }) => ({ jar, lost, forfeited }), shallow);
  const shown = useCountUp(jar, COIN_ARRIVAL_MS);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    anchors.jar = box.current;
    return () => {
      if (anchors.jar === box.current) anchors.jar = null;
    };
  }, []);
  return (
    <div ref={box} class={`overtime-jar ${lost ? 'lost' : ''}`}>
      {lost ? `Mất hũ — còn ${formatMoney(shown)}` : `Hũ tăng ca ${formatMoney(shown)}`}
      {/* On a line of its own: the dock is only as wide as the label, and beside it stand the cup and the hint. */}
      {forfeited && !lost && <div class="overtime-jar-note">không thưởng</div>}
    </div>
  );
}

/**
 * The quiet between two groups, and who it is leading up to. No countdown: it is a breath, and a
 * number running down would turn it into a wait. It takes no touches. This is the counter page's: the
 * top of the prep page is the order card, which is empty because a quiet only starts once the counter
 * and the line are clear, so the card says this itself rather than have a pill laid over what it says.
 */
function LullPill() {
  // The state's own list, which stays the same array for the whole of the quiet.
  const group = useGame(lullGroup);
  const page = useUi((ui) => ui.page);
  if (group.length === 0 || page === 1) return null;
  return (
    <div class="lull">
      <div class="lull-title">Quán vắng một chút</div>
      <div class="lull-group">{lullPreview(group)}</div>
    </div>
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
