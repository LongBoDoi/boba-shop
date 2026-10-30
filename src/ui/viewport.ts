import { useEffect, useState } from 'preact/hooks';

/** `useWindowDimensions`: the window's CSS size, following resizes and turns. */
export interface Viewport {
  width: number;
  height: number;
}

function read(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function useViewport(): Viewport {
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = () => setSize((was) => {
      const next = read();
      return next.width === was.width && next.height === was.height ? was : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}

/**
 * Where the effects aim: the wallet in the HUD (the coins land on it), the overtime jar (so do a
 * late sale's) and the bin button (a discarded cup is tossed into it). Registered by the elements
 * themselves, read when an effect starts, so nothing is measured until something is actually thrown.
 */
export const anchors: { wallet: HTMLElement | null; jar: HTMLElement | null; trash: HTMLElement | null } = {
  wallet: null,
  jar: null,
  trash: null,
};

export function centreOf(element: Element | null): { x: number; y: number } | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
