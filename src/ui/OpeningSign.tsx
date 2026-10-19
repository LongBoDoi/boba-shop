import { useRef, useState } from 'preact/hooks';

import { shallow, useGame } from '../hooks';
import { uiState } from '../ui-state';
import { describeUnlocks } from '../game/levels';
import { formatMoney } from '../game/money';
import { GameMode } from '../game/reducer';
import { Button } from './Button';
import { DURATION } from './motion';

/** The sign's lines, exactly as `GameScreen` builds them: how to play on day 1, what is new after. */
function introFor(day: number, mode: GameMode): string[] {
  return day === 1
    ? [
        mode === 'relaxed'
          ? 'Order tự được nhận — xem ở Pha chế.'
          : 'Chạm vào khách ở Quầy để nhận order.',
        'Chạm Pha chế ➜, chạm ly S / M / L đúng order trên kệ để đặt lên thảm.',
        'Kéo ly dưới bình trà, giữ vòi để rót — xem lượng trà ở thanh phía trên bếp.',
        'Kéo đá từ hộp cạnh topping vào ly: 1 muỗng ít đá, 2 muỗng đá thường.',
      ]
    : describeUnlocks(day);
}

/**
 * The "open" sign at the start of each day (`OpeningSign.tsx`). It stays until "Bắt đầu" — no
 * timer, no tap outside — and the day's clock is held while it is up (`ui.opening`).
 */
export function OpeningSign() {
  const { day, money, mode } = useGame((state) => ({ day: state.day, money: state.money, mode: state.mode }), shallow);
  const [closing, setClosing] = useState(false);
  const closed = useRef(false);
  const lines = introFor(day, mode);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    setTimeout(() => uiState.set({ opening: false }), DURATION.base);
  };

  return (
    <div class={`sign-overlay live ${closing ? 'closing' : ''}`}>
      <div class="sign-dim" />
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
  );
}
