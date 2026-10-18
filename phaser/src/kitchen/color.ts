/** Lighten (positive) or darken (negative) a #RRGGBB colour by a percentage. As `Character.tsx`. */
export function shade(hex: string, percent: number): string {
  const value = parseInt(hex.slice(1), 16);
  const adjust = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel + (percent / 100) * (percent < 0 ? channel : 255 - channel))));
  const r = adjust((value >> 16) & 255);
  const g = adjust((value >> 8) & 255);
  const b = adjust(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Mix two #RRGGBB colours, `amount` of the way from `a` to `b`. As `TeaLiquid.tsx`. */
export function blend(a: string, b: string, amount: number): string {
  const channels = [1, 3, 5].map((at) => Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - amount)
    + parseInt(b.slice(at, at + 2), 16) * amount).toString(16).padStart(2, '0'));
  return `#${channels.join('')}`;
}

/** `#RRGGBB` as the number Phaser takes for tints and fills. */
export function hexNumber(hex: string): number {
  return parseInt(hex.slice(1, 7), 16);
}
