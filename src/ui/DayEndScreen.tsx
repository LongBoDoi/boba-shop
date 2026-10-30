import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { coinSvg, starSvg, sunRaysSvg } from '../art/icons';
import { useGame } from '../hooks';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { GEAR, GearItem } from '../game/gear';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { canAfford, GameState } from '../game/reducer';
import { starsFor } from '../game/rules';
import { Button } from './Button';
import { confetti } from './Effects';
import { Svg } from './Svg';
import { useViewport } from './viewport';

const VERDICT = [
  'Hôm nay chưa bán được ly nào.',
  'Vẫn còn nhiều khách chưa hài lòng.',
  'Một ngày bán hàng tốt.',
  'Tiệm đông nghịt cả ngày!',
];

/** Held still once the next day starts, so the wipe covers this day's tally rather than the next one's. */
const frozen = (was: GameState, next: GameState) => next.phase !== 'dayEnd' || was === next;

/** The end of a shift (`DayEndScreen.tsx`): the stars, the day's takings, where they went, what to buy, what's next. */
export function DayEndScreen() {
  const { width } = useViewport();
  const state = useGame((s) => s, frozen);
  const { day, coins, lost, money, stats, overtime } = state;
  const stars = starsFor(stats);
  const unlocks = describeUnlocks(day + 1);
  const burst = useRef<HTMLDivElement>(null);

  const rows: [string, string][] = [
    ['Số ly đã bán', String(stats.served)],
    ['Ly hoàn hảo', String(stats.perfect)],
    ['Tiền tip', formatMoney(stats.tips)],
    ['Khách không hài lòng', String(stats.missed)],
  ];
  if (lost > 0) rows.push(['Khách về trước', String(lost)]);
  // Today's takings above already include it, so this says where that part of them came from.
  if (overtime.rounds > 0) {
    rows.push(['Hũ tăng ca', overtime.lost
      ? `Mất hũ — còn ${formatMoney(overtime.jar)}`
      : overtime.forfeited
        ? `${formatMoney(overtime.jar)} · không thưởng`
        : `${formatMoney(overtime.jar)} + thưởng ${formatMoney(overtime.paid - overtime.jar)}`]);
  }

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
          {/* No stars with money in the till is a day sold only after closing, which the stars do not count. */}
          <div class="dayend-subtitle">{VERDICT[stars === 0 && coins > 0 ? 1 : stars]}</div>

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

          <div class="dayend-gear">
            <div class="dayend-gear-head">
              <span class="dayend-gear-title">Sắm cho tiệm</span>
              {/* The till at the top of the card can be scrolled away by the time this is read. */}
              <span class="dayend-gear-till">Két tiền: {formatMoney(money)}</span>
            </div>
            {GEAR.map((item) => (
              <GearRow key={item.id} item={item} owned={state.gear.includes(item.id)} affordable={canAfford(state, item.price)} />
            ))}
          </div>

          <div class="dayend-buttons">
            <Button label={`Bắt đầu ngày ${day + 1}`} onPress={() => dispatch({ type: 'START_DAY', day: day + 1 })} />
            <Button label="📒 Sổ khách" variant="secondary" onPress={() => uiState.set({ book: true })} />
            <Button label="Về menu chính" variant="secondary" onPress={() => dispatch({ type: 'GO_TO_TITLE' })} />
          </div>
        </div>
      </div>
      <div ref={burst} class="dayend-burst" />
    </div>
  );
}

function GearRow({ item, owned, affordable }: { item: GearItem; owned: boolean; affordable: boolean }) {
  return (
    <div class="gear-row">
      <div class="gear-text">
        <div class="gear-line">
          <span class="gear-name">{item.name}</span>
          <span class="gear-price">{formatMoney(item.price)}</span>
        </div>
        <div class="gear-blurb">{item.blurb}</div>
      </div>
      {owned ? (
        <span class="gear-owned">Đã có</span>
      ) : (
        <Button label="Mua" class="gear-buy" disabled={!affordable} onPress={() => dispatch({ type: 'BUY_GEAR', id: item.id })} />
      )}
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
