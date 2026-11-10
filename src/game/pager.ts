import { playSound } from '../sound';
import { uiState } from '../ui-state';
import { easeInOut } from '../kitchen/motion';

/**
 * The two pages — the counter and the kitchen — side by side, with animated tab navigation.
 *
 * `pageOffset` is where the pager is drawn (0 = counter, 1 = kitchen, in between during a tab slide). The
 * cameras and the HTML on each page both follow it, so a page slides as one piece. The kitchen's
 * own horizontal swipes belong to its panorama. The tabs and service actions move between pages.
 */
const SLIDE_MS = 320;
let animation = 0;

export function goToPage(page: 0 | 1, withSound = true) {
  cancelAnimationFrame(animation);
  if (withSound) playSound('tap');
  const from = uiState.value.pageOffset;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SLIDE_MS);
    const offset = from + (page - from) * easeInOut(t);
    if (t >= 1) {
      uiState.set({ pageOffset: page, page });
      return;
    }
    uiState.set({ pageOffset: offset });
    animation = requestAnimationFrame(step);
  };
  animation = requestAnimationFrame(step);
}
