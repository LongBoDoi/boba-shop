/**
 * The two pieces of React Native the shared audio engine uses: which platform it is on, and
 * whether the app is in front. A page is "in front" while it is visible.
 */
type OS = 'ios' | 'android' | 'web' | 'windows' | 'macos';
export const Platform: { OS: OS } = { OS: 'web' };

type Status = 'active' | 'background' | 'inactive';
const status = (): Status => (typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 'background' : 'active');

export const AppState = {
  get currentState(): Status {
    return status();
  },
  addEventListener(_type: 'change', listener: (next: Status) => void) {
    const handler = () => listener(status());
    document.addEventListener('visibilitychange', handler);
    return { remove: () => document.removeEventListener('visibilitychange', handler) };
  },
};
