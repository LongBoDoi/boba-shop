import { Tone } from './game/reducer';

export const colors = {
  wall: '#FFE3EC',
  wallStripe: '#FFD3E1',
  floor: '#FFF4E8',
  tile: '#FFF8F0',
  grout: '#F3E3D3',
  counter: '#D9A06B',
  counterLight: '#E8B886',
  counterEdge: '#B97F4C',
  counterDark: '#9C6638',
  panel: '#FFFFFF',
  paper: '#FFFDF6',
  line: '#F0DCCB',
  ink: '#4A2C2A',
  inkSoft: '#8A6A64',
  primary: '#FF6F9C',
  primaryDark: '#E0507F',
  primaryTint: '#FFE8EF',
  mint: '#9FDCCB',
  mintDark: '#6FBFA9',
  machineInside: '#F4FBF9',
  sky: '#BFE7FF',
  skyLow: '#E6F6FF',
  gold: '#FFC93C',
  goldDark: '#E2A410',
  cupOutline: '#D9C2AE',
  good: '#3FA56B',
  ok: '#E9A23B',
  bad: '#E5534B',
};

/** Baloo 2 — rounded, friendly, and covers Vietnamese diacritics. Loaded in App.tsx. */
export const fonts = {
  display: 'Baloo2_800ExtraBold',
  bold: 'Baloo2_700Bold',
  semi: 'Baloo2_600SemiBold',
  body: 'Baloo2_500Medium',
};

export const toneColor: Record<Tone, string> = {
  good: colors.good,
  ok: colors.ok,
  bad: colors.bad,
};
