/**
 * The colours of `src/theme.ts`, copied rather than imported: that file also builds `toneColor`
 * off `game/reducer`, which would drag the whole reducer into anything that wants a pink.
 * Keep the two in step.
 */
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

/**
 * Baloo 2, as `phaser/src/styles.css` registers it. Weights: 500 body, 600 semi, 700 bold,
 * 800 display.
 *
 * An SVG drawn through an `<img>`/`Image` (which is how a Phaser texture is made from one) is
 * sandboxed and cannot see the page's web fonts, so text in a rasterised drawing falls back to
 * the system face. Inline (`innerHTML`) it gets Baloo 2.
 */
export const FONT = "'Baloo 2', system-ui, sans-serif";
export const FONT_WEIGHT = { body: 500, semi: 600, bold: 700, display: 800 } as const;
