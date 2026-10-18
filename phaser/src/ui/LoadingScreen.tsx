import { useUi } from '../hooks';

/**
 * The shop getting ready (`LoadingScreen.tsx`): the fonts, the saved day and the painted kitchen.
 *
 * It is the one screen with **no Baloo 2 on it** — the fonts are part of what it waits for, so
 * anything set in the display face would jump when the real one arrived. The bar is real progress,
 * eased towards each new value; nothing spins or pulses.
 */
export function LoadingScreen() {
  const progress = useUi((ui) => ui.loading);
  const filled = Math.max(0, Math.min(1, progress));
  return (
    <div class="loading live">
      <div class="loading-mark">🧋</div>
      <div class="loading-name">Tiệm Trà Sữa</div>
      <div class="loading-track">
        <div class="loading-fill" style={{ transform: `translateX(${(filled - 1) * 100}%)` }} />
      </div>
      <div class="loading-note">Đang chuẩn bị quầy…</div>
    </div>
  );
}
