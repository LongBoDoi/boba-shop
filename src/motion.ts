import { Easing } from 'react-native-reanimated';

/**
 * One calm motion style for the whole game: short, eased moves that settle once — no bounce,
 * no shaking, no looping movement near the play area.
 */
export const ease = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);

export const DURATION = {
  fast: 150,
  base: 250,
  slow: 450,
};

export const timing = (duration: number = DURATION.base) => ({ duration, easing: ease });
