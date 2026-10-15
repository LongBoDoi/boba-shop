import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { PRELOAD } from './components/art/kitchenArt';

/**
 * Pulling the painted kitchen in before the shop opens.
 *
 * Nothing here is required — every sprite loads itself the first time it is drawn, which is
 * exactly the problem: the room filled itself in plank by plank on the first swipe to the prep
 * page, and the first scoop of each topping stuttered while its sprite decoded. A shift is 2
 * minutes long and the stutter lands in the middle of one, so the wait is taken up front instead,
 * where there is a loading screen to put it behind.
 *
 * Two steps per sprite, because they are different jobs: `downloadAsync` puts the file somewhere it
 * can be read (on a phone it is already in the app; over the dev server or on the web it has to
 * come down), and `prefetch` is what actually decodes it into the image cache.
 */

/** Never hold the shop shut over a slow connection: open it and let the stragglers turn up late. */
const GIVE_UP_MS = 10_000;

/** How much of the artwork is in, 0–1. Reaches 1 whatever happens — a missing sprite is not fatal. */
export function useArtwork(): number {
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let live = true;
    let loaded = 0;
    const total = PRELOAD.length || 1;
    const counted = () => {
      loaded += 1;
      if (live) setReady(loaded / total);
    };
    const giveUp = setTimeout(() => {
      if (live) {
        console.warn(`[art] only ${loaded}/${total} sprites arrived in time; opening anyway`);
        setReady(1);
      }
    }, GIVE_UP_MS);
    // Every sprite counts towards the bar whether it arrived or not, so one that cannot be read
    // leaves the bar short rather than stopping it.
    Promise.all(PRELOAD.map((module) => fetchArt(module).then(counted, counted))).then(() => {
      clearTimeout(giveUp);
      if (live) setReady(1);
    });
    return () => {
      live = false;
      clearTimeout(giveUp);
    };
  }, []);

  return ready;
}

async function fetchArt(module: number) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (uri) await Image.prefetch(uri);
}
