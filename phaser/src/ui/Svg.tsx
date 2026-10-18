import { CSSProperties } from 'preact';
import { useMemo } from 'preact/hooks';

import { cupLayout, cupSvg, CupOptions } from '../art/cup';
import { Drink } from '../../../src/game/ingredients';

/**
 * One of the `art/` drawings, inline. Each drawing is a complete `<svg>` string with ids of its
 * own, so the caller memoizes the string: building it again mints new ids and Preact would then
 * replace the markup on every render.
 */
export function Svg({ markup, class: cls = '', style }: { markup: string; class?: string; style?: CSSProperties }) {
  return <span class={`svg ${cls}`} style={style} dangerouslySetInnerHTML={{ __html: markup }} />;
}

/**
 * The simple vector cup (`Cup.tsx`), occupying the same layout box it did in React Native —
 * `width` wide and `1.3 × width` (plus the straw) tall. The drawing overhangs that box (the rim
 * by 2px a side, a seal above it), so it is pulled back by negative margins rather than pushing
 * its neighbours away.
 */
export function CupArt({ drink, ...options }: { drink: Drink } & CupOptions) {
  const { width, backgroundColor, straw, sealed, tapered, fill } = options;
  const markup = useMemo(
    () => cupSvg(drink, { width, backgroundColor, straw, sealed, tapered, fill }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drink, width, backgroundColor, straw, sealed, tapered, fill],
  );
  const box = cupLayout(width, { straw, sealed });
  return (
    <Svg
      markup={markup}
      style={{
        marginLeft: -box.originX,
        marginRight: -(box.svgWidth - box.originX - box.boxWidth),
        marginTop: -box.originY,
        marginBottom: -(box.svgHeight - box.originY - box.boxHeight),
      }}
    />
  );
}
