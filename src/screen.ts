/**
 * Keep the phone's screen on while the shop is open.
 *
 * A shift is two minutes of watching customers walk in and tea run into a cup, and a lot of that
 * is a finger resting on the glass rather than moving on it. A phone whose timeout is thirty
 * seconds dims mid-pour and then locks, which is the shop closing itself.
 *
 * The Screen Wake Lock API does this with **no native code**: no plugin, no permission, no shell
 * change, so it costs no reinstall and it works on the installed page exactly as it does in the
 * app. Two things about it decide the shape of everything below:
 *
 * - **The browser takes the lock away whenever the page is hidden** and never gives it back by
 *   itself. A lock taken once at boot is therefore gone the first time the player answers a
 *   message, so it has to be asked for again on the way back in.
 * - **It can simply be refused** — battery saver on Android, a WebView older than Chrome 84, an
 *   iPhone before 16.4. That is not a failure worth a word to the player: the screen goes on
 *   behaving the way it always has. It is said once to the console and never again.
 */
let held: WakeLockSentinel | null = null;
let mentioned = false;

/** Whether the page is in front. A hidden tab, or a phone with the app behind, is not. */
function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

async function hold(): Promise<void> {
  if (held || !visible()) return;
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    held = lock;
    // It is released *for* us on the way out; this is how we find out, so the next time the page
    // comes back we ask again rather than believing we still have one.
    lock.addEventListener('release', () => {
      if (held === lock) held = null;
    });
    // Hidden while we were asking: let it go rather than hold a lock for a page nobody is looking
    // at, which is the one way this could flatten a battery.
    if (!visible()) void release();
  } catch (error: unknown) {
    held = null;
    if (!mentioned) {
      mentioned = true;
      console.warn('Không giữ được màn hình sáng:', error);
    }
  }
}

async function release(): Promise<void> {
  const lock = held;
  held = null;
  await lock?.release().catch(() => {});
}

/** Ask now, and again every time the game comes back to the front. */
export function keepScreenOn(): void {
  void hold();
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (visible()) void hold();
    else void release();
  });
}
