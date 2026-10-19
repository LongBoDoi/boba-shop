import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { clockIconSvg, coinSvg } from '../art/icons';
import { shallow, useGame } from '../hooks';
import { dispatch } from '../store';
import { formatMoney } from '../game/money';
import { CSS_EASE, DURATION } from './motion';
import { Svg } from './Svg';
import { anchors } from './viewport';

/** Coins land in the wallet a moment after a sale; the counter waits for them. */
const COIN_ARRIVAL_MS = 750;

/**
 * The bar across the top of a shift (`Hud.tsx`): the day, the clock running down, the till, and
 * the pause button. The clock is the one thing in it that moves with the day, so it is its own
 * component selecting only what it draws — the rest renders when the day or the till changes.
 */
export const Hud = memo(function Hud({ warm }: { warm: boolean }) {
  const day = useGame((state) => state.day);
  return (
    <div class={`hud live ${warm ? 'warm' : ''}`}>
      <div class="hud-pill">
        <span class="hud-pill-text">Ngày {day}</span>
      </div>
      <HudClock warm={warm} />
      <HudMoney />
      <button
        type="button"
        class="hud-pause"
        aria-label="Tạm dừng"
        onClick={() => dispatch({ type: 'SET_PAUSED', paused: true })}
      >
        <span class="hud-pause-bar" />
        <span class="hud-pause-bar" />
      </button>
    </div>
  );
});

function HudClock({ warm }: { warm: boolean }) {
  // The label reads to the second and the bar is a couple of hundred pixels long, so a five-
  // hundredth of the day is finer than either can show — and the clock ticks several times a second.
  const { seconds, left, duration } = useGame((state) => {
    const remaining = Math.max(0, state.config.durationMs - state.clock);
    return {
      seconds: Math.ceil(remaining / 1000),
      left: remaining === 0 ? 0 : Math.max(0.002, Math.round((remaining / state.config.durationMs) * 500) / 500),
      duration: state.config.durationMs,
    };
  }, shallow);
  const closing = left === 0;
  const label = closing ? 'Sắp đóng cửa!' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const icon = useMemo(
    () => clockIconSvg(Math.min(1, (seconds * 1000) / duration), warm),
    [seconds, duration, warm],
  );
  return (
    <div class="hud-meter">
      <div class="hud-meter-row">
        <Svg markup={icon} />
        <span class={`hud-meter-label ${closing ? 'closing' : ''}`}>{label}</span>
      </div>
      <div class="hud-track">
        <div class="hud-fill" style={{ transform: `translateX(${(left - 1) * 100}%)` }} />
      </div>
    </div>
  );
}

function HudMoney() {
  const money = useGame((state) => state.money);
  const shown = useCountUp(money, COIN_ARRIVAL_MS);
  const coin = useMemo(() => coinSvg(18), []);
  const bump = useRef<HTMLSpanElement>(null);
  const previous = useRef(money);

  useEffect(() => {
    anchors.wallet = bump.current;
    return () => {
      if (anchors.wallet === bump.current) anchors.wallet = null;
    };
  }, []);

  // The wallet swells once as the coins land in it.
  useEffect(() => {
    const element = bump.current;
    if (money > previous.current && element) {
      const total = DURATION.fast + DURATION.base;
      element.animate(
        [
          { transform: 'scale(1)', easing: CSS_EASE },
          { transform: 'scale(1.12)', offset: DURATION.fast / total, easing: CSS_EASE },
          { transform: 'scale(1)' },
        ],
        { duration: total, delay: COIN_ARRIVAL_MS },
      );
    }
    previous.current = money;
  }, [money]);

  return (
    <div class="hud-meter">
      <div class="hud-meter-row">
        <span ref={bump} class="hud-coin"><Svg markup={coin} /></span>
        <span class="hud-meter-label">{formatMoney(shown)}</span>
      </div>
    </div>
  );
}

/** Animates a displayed number towards `target`, starting after `delay` ms when it rises. */
function useCountUp(target: number, delay: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = target <= from ? 1 : Math.min(1, (now - start) / 600);
      const value = Math.round(from + (target - from) * t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, target > from ? delay : 0);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [delay, target]);
  return shown;
}
