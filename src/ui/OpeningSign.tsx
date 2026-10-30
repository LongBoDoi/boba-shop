import { useRef, useState } from 'preact/hooks';

import { shallow, useGame } from '../hooks';
import { dispatch, store } from '../store';
import { uiState } from '../ui-state';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { GameMode } from '../game/reducer';
import { dayNews } from '../game/rules';
import { Button } from './Button';
import { DURATION } from './motion';

/** How to play, which is all the first day's sign has to say. */
function howToPlay(mode: GameMode): string[] {
  return [
    mode === 'relaxed'
      ? 'Order tự được nhận — xem ở Pha chế.'
      : 'Chạm vào khách ở Quầy để nhận order.',
    'Chạm Pha chế ➜, chạm ly S / M / L đúng order trên kệ để đặt lên thảm.',
    'Kéo ly dưới bình trà, giữ vòi để rót — xem lượng trà ở thanh phía trên bếp.',
    'Kéo đá từ hộp cạnh topping vào ly: 1 muỗng ít đá, 2 muỗng đá thường.',
  ];
}

/**
 * The "open" sign at the start of each day (`OpeningSign.tsx`). It stays until "Bắt đầu" — no
 * timer, no tap outside — and the day's clock is held while it is up (`ui.opening`).
 *
 * What it says is taken once, as it goes up: pressing "Bắt đầu" marks the news as seen, and a sign
 * reading it live would lose those lines while it fades. It scrolls, because that button is the only
 * way off it and nothing else stops a long sign from pushing it past the foot of a phone on its side.
 */
export function OpeningSign() {
  const { day, money, mode } = useGame((state) => ({ day: state.day, money: state.money, mode: state.mode }), shallow);
  const [closing, setClosing] = useState(false);
  const closed = useRef(false);
  const [{ lines, news }] = useState(() => {
    const items = dayNews(store.state);
    return {
      lines: day === 1 ? howToPlay(mode) : [...describeUnlocks(day), ...items.map((item) => item.line)],
      news: items.map((item) => item.id),
    };
  });

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (news.length > 0) dispatch({ type: 'NOTE_NEWS', ids: news });
    setClosing(true);
    setTimeout(() => uiState.set({ opening: false }), DURATION.base);
  };

  return (
    <div class={`sign-overlay live ${closing ? 'closing' : ''}`}>
      <div class="sign-dim" />
      <div class="sign-scroll">
        <div class="sign-wrap">
          <div class="sign-ropes">
            <div class="sign-rope" style={{ transform: 'rotate(18deg)' }} />
            <div class="sign-rope" style={{ transform: 'rotate(-18deg)' }} />
          </div>
          <div class="sign-board">
            <div class="sign-inner">
              <div class="sign-open">MỞ CỬA</div>
              <div class="sign-day">Ngày {day}</div>
              <div class="sign-till">
                <span class="sign-till-text">Két tiền: {formatMoney(money)}</span>
              </div>
              {lines.length > 0 && (
                <div class="sign-news">
                  <div class="sign-news-title">{day === 1 ? 'Cách chơi' : 'Mới hôm nay'}</div>
                  {lines.map((line) => (
                    <div key={line} class="sign-news-line">{line}</div>
                  ))}
                </div>
              )}
              <Button label="Bắt đầu" onPress={close} class="sign-start" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
