import { useMemo, useRef } from 'preact/hooks';

import { characterSvg } from '../art/character';
import { titleAwningSvg, titlePearlsSvg, titleWallpaperSvg } from '../art/icons';
import { colors } from '../art/theme';
import { useGame } from '../hooks';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { CustomerLook } from '../game/customers';
import { Drink } from '../game/ingredients';
import { GameMode, suspendedShift } from '../game/reducer';
import { Button } from './Button';
import { CupArt, Svg } from './Svg';
import { useViewport } from './viewport';

const SHOWCASE_DRINK: Drink = {
  size: 'M',
  toppings: ['pearls'],
  sweetness: null,
  ice: 'regular',
  tea: 'taro',
  milk: 'whole',
  foam: 'cheese',
};

const LEFT_FAN: CustomerLook = { skin: '#F6C8A4', hair: '#2B1B17', hairStyle: 'bun', shirt: '#7FD6C2', accessory: 'none' };
const RIGHT_FAN: CustomerLook = { skin: '#E9B48E', hair: '#6B4423', hairStyle: 'cap', shirt: '#FFCF6E', accessory: 'glasses' };

/** The three how-to-play lines; the first one depends on who takes the orders. */
function stepsFor(mode: GameMode) {
  return [
    mode === 'relaxed' ? '⚡ Order tự được nhận, khách tới liên tục' : '🧍 Chạm vào khách để nhận order',
    '🧋 Chạm ly đúng cỡ S / M / L rồi thêm nguyên liệu',
    '💰 Phục vụ nhanh để được tip và dành tiền cho tiệm!',
  ];
}

/**
 * The menu (`TitleScreen.tsx`). It scrolls when it has to: on a short phone the logo was already
 * sliding under the awning, so the spread-out layout is a minimum height, not a fixed one.
 */
export function TitleScreen() {
  const { width, height } = useViewport();
  const mode = useGame((state) => state.mode);
  // What the one button does, which is not always the same thing. The menu is where a shop waits
  // while it is put down — the day it is on, and the shift inside that day if there is one — so
  // the button comes back to whatever is there rather than building a day over the top of it.
  const phase = useGame((state) => state.phase);
  const day = useGame((state) => state.day);
  const waiting = useGame(suspendedShift);
  // Held, because this screen outlives the press. The wipe keeps the menu up for a moment after
  // the shop has left the title phase, and a live reading would spend that moment saying
  // "Mở cửa tiệm" — the shop announcing the very reset the player was afraid of, over a shift
  // that is in fact already back on screen behind the wipe.
  const offer = useRef({ day, waiting });
  if (phase === 'title') offer.current = { day, waiting };
  const { day: openDay, waiting: resuming } = offer.current;
  const cupWidth = Math.min(130, width * 0.32);

  const wallpaper = useMemo(() => titleWallpaperSvg(width, height, false), [width, height]);
  const pearls = useMemo(() => titlePearlsSvg(width, height), [width, height]);
  const awning = useMemo(() => titleAwningSvg(width), [width]);
  const leftFan = useMemo(() => characterSvg(LEFT_FAN, { mood: 'delighted', width: 74 }), []);
  const rightFan = useMemo(() => characterSvg(RIGHT_FAN, { mood: 'happy', width: 74 }), []);

  return (
    <div class="title live">
      <Svg markup={wallpaper} class="fill" />
      <Svg markup={pearls} class="fill" />
      <Svg markup={awning} class="title-awning" />

      <div class="title-safe">
        <div class="title-scroll">
          <div class="title-content">
            <div class="title-hero">
              <div class="title-logo">
                <div class="title-word title-small" style={{ animationDelay: '0ms' }}>Tiệm</div>
                <div class="title-word title-big" style={{ animationDelay: '120ms' }}>Trà Sữa</div>
                <div class="title-word title-subtitle" style={{ animationDelay: '300ms' }}>Lắc đều. Ép nắp. Bán đắt hàng.</div>
              </div>
              <div class="title-scene">
                <div class="title-fan"><Svg markup={leftFan} /></div>
                <CupArt drink={SHOWCASE_DRINK} width={cupWidth} backgroundColor={colors.wall} straw />
                <div class="title-fan"><Svg markup={rightFan} /></div>
              </div>
            </div>

            <div class="title-card">
              {stepsFor(mode).map((step) => (
                <div key={step} class="title-step">{step}</div>
              ))}
              <Button
                label={resuming ? `Tiếp tục ngày ${openDay}` : openDay > 1 ? `Mở cửa ngày ${openDay}` : 'Mở cửa tiệm'}
                onPress={() => dispatch(resuming ? { type: 'RESUME_DAY' } : { type: 'START_DAY', day: openDay })}
                class="title-start" />
              <Button label="⚙️ Cài đặt" variant="secondary" onPress={() => uiState.set({ settings: true })} />
              <Button label="📒 Sổ khách" variant="secondary" onPress={() => uiState.set({ book: true })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
