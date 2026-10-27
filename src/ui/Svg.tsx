import { CSSProperties } from 'preact';
import { useMemo } from 'preact/hooks';

import { cupLayout, cupSvg, CupOptions } from '../art/cup';
import { Drink } from '../game/ingredients';

/**
 * One of the `art/` drawings, inline. Each drawing is a complete `<svg>` string with ids of its
 * own, so the caller memoizes the string: building it again mints new ids and Preact would then
 * replace the markup on every render.
 */
export function Svg({ markup, class: cls = '', style }: { markup: string; class?: string; style?: CSSProperties }) {
  return <span class={`svg ${cls}`} style={style} dangerouslySetInnerHTML={{ __html: markup }} />;
}

/** The shared clear cup; negative top margin leaves room for the raised lid and straw. */
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
