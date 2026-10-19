import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { coinSvg, starSvg, sunRaysSvg } from '../art/icons';
import { useGame } from '../hooks';
import { dispatch } from '../store';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { DayStats, GameState } from '../game/reducer';
import { Button } from './Button';
import { confetti } from './Effects';
import { Svg } from './Svg';
import { useViewport } from './viewport';

/**
 * How the day went, out of three. A day cannot be failed, so the stars rate the *service*: how many
 * customers got a drink at all, and how many got the one they asked for.
 */
export function starsFor({ served, perfect, missed }: DayStats) {
  if (served === 0) return 0;
  const happy = served / (served + missed);
  if (happy >= 0.9 && perfect >= served * 0.6) return 3;
  if (happy >= 0.7) return 2;
  return 1;
}

const VERDICT = [
  'Hôm nay chưa bán được ly nào.',
  'Vẫn còn khách phải chờ lâu.',
  'Một ngày bán hàng tốt.',
  'Tiệm đông nghịt cả ngày!',
];

/** Held still once the next day starts, so the wipe covers this day's tally rather than the next one's. */
const frozen = (was: GameState, next: GameState) => next.phase !== 'dayEnd' || was === next;

/** The end of a shift (`DayEndScreen.tsx`): the stars, the day's takings, where they went, what's next. */
export function DayEndScreen() {
  const { width } = useViewport();
  const state = useGame((s) => s, frozen);
  const { day, coins, money, stats } = state;
  const stars = starsFor(stats);
  const unlocks = describeUnlocks(day + 1);
  const burst = useRef<HTMLDivElement>(null);

  const rows: [string, string][] = [
    ['Số ly đã bán', String(stats.served)],
    ['Ly hoàn hảo', String(stats.perfect)],
    ['Tiền tip', formatMoney(stats.tips)],
    ['Khách bỏ đi', String(stats.missed)],
  ];

  useEffect(() => {
    if (stars > 0 && burst.current) confetti(burst.current, { x: window.innerWidth * 0.5, y: 150 }, { delay: 900, pieces: 16, power: 1.2 });
    // Once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raySize = width * 1.8;
  const rays = useMemo(() => sunRaysSvg(raySize), [raySize]);
  const coin = useMemo(() => coinSvg(30), []);

  return (
    <div class="dayend live">
      {stars > 0 && (
        <Svg markup={rays} class="dayend-rays" style={{ left: (width - raySize) / 2, top: 130 - raySize / 2 }} />
      )}
      <div class="dayend-content">
        <div class="dayend-card">
          <div class="dayend-stars">
            {[0, 1, 2].map((i) => (
              <Star key={i} earned={i < stars} delay={400 + i * 250} big={i === 1} />
            ))}
          </div>
          <div class="dayend-title">{`Hoàn thành ngày ${day}!`}</div>
          <div class="dayend-subtitle">{VERDICT[stars]}</div>

          <div class="dayend-earned-label">Tiền bán hôm nay</div>
          <div class="dayend-earnings">
            <Svg markup={coin} />
            <CountUp value={coins} />
          </div>
          <div class="dayend-till">
            <span class="dayend-till-text">Két tiền: {formatMoney(money)}</span>
          </div>

          <div class="dayend-table">
            {rows.map(([label, value], index) => (
              <div key={label} class="dayend-row" style={{ animationDelay: `${200 + index * 60}ms` }}>
                <span class="dayend-label">{label}</span>
                <span class="dayend-value">{value}</span>
              </div>
            ))}
          </div>

          {unlocks.length > 0 && (
            <div class="dayend-unlocks">
              <div class="dayend-unlock-title">Mở khóa cho ngày {day + 1}</div>
              {unlocks.map((line) => (
                <div key={line} class="dayend-unlock-line">{line}</div>
              ))}
            </div>
          )}

          <div class="dayend-buttons">
            <Button label={`Bắt đầu ngày ${day + 1}`} onPress={() => dispatch({ type: 'START_DAY', day: day + 1 })} />
            <Button label="Về menu chính" variant="secondary" onPress={() => dispatch({ type: 'GO_TO_TITLE' })} />
          </div>
        </div>
      </div>
      <div ref={burst} class="dayend-burst" />
    </div>
  );
}

function Star({ earned, delay, big }: { earned: boolean; delay: number; big: boolean }) {
  const size = big ? 64 : 48;
  const markup = useMemo(() => starSvg(earned, size), [earned, size]);
  return (
    <div class={`dayend-star ${big ? 'big' : ''}`} style={{ animationDelay: `${earned ? delay : 200}ms` }}>
      <Svg markup={markup} />
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 350);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return <span class="dayend-earned">{formatMoney(shown)}</span>;
}
