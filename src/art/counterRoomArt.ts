import portrait from '../assets/counter/cafe-peach-portrait-v1.png';
import landscape from '../assets/counter/cafe-peach-panorama-v8.png';
import portraitGardenPatch from '../assets/counter/door-garden-patch-portrait-v1.png';
import landscapeGardenPatch from '../assets/counter/door-garden-patch-landscape-v1.png';

/** One continuous painting per orientation. Geometry lives in counter/roomLayout.ts. */
export const COUNTER_ROOMS = {
  portrait: { image: portrait, gardenPatch: portraitGardenPatch },
  landscape: { image: landscape, gardenPatch: landscapeGardenPatch },
};
