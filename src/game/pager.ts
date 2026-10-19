import { playSound } from '../sound';
import { uiState } from '../ui-state';
import { easeInOut } from '../kitchen/motion';

/**
 * The two pages — the counter and the kitchen — side by side, and the swipe between them.
 *
 * `pageOffset` is where the pager is drawn (0 = counter, 1 = kitchen, in between mid-swipe). The
 * cameras and the HTML on each page both follow it, so a page slides as one piece. The kitchen's
 * own horizontal swipes belong to its panorama: the counter is reached from there by the tab, and
 * the kitchen from the counter by either.
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

/** A finger dragging the pager, as a fraction of a page (positive = towards the kitchen). */
export function dragPage(fraction: number) {
  cancelAnimationFrame(animation);
  uiState.set({ pageOffset: Math.max(0, Math.min(1, uiState.value.page + fraction)) });
}

/** The finger let go: settle on whichever page it is nearer, or the one a flick was aimed at. */
export function releasePage(velocity: number) {
  const { pageOffset, page } = uiState.value;
  let target: 0 | 1 = pageOffset > 0.5 ? 1 : 0;
  if (Math.abs(velocity) > 0.4) target = velocity > 0 ? 1 : 0;
  if (target === page && Math.abs(pageOffset - page) < 0.001) return;
  goToPage(target, false);
}
