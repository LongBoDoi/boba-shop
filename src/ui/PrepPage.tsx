import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';

import { kitchenActionIconSvg } from '../art/kitchenEquipment';
import { setKitchenRect } from '../game/host';
import { canServe as cupCanServe } from '../game/reducer';
import { shallow, useGame, useUi } from '../hooks';
import { playSound } from '../sound';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { TOSS_MS } from '../game/effectTiming';
import { OrderBubble } from './OrderBubble';
import { PourMeterSlot } from './PourMeter';
import { panelWidthFor, PrepLayout } from './responsive';
import { Svg } from './Svg';
import { anchors } from './viewport';

/** The band of shop either side of the order panel. */
const GUTTER = 10;

interface PrepPageProps {
  layout: PrepLayout;
  /** The pager's size, in CSS pixels. */
  width: number;
  height: number;
}

/**
 * The kitchen page's HTML (`PrepPage.tsx`): the order across the top, the action buttons along the
 * bottom (or both in a column beside the room, sideways and short), and between them a hole the
 * kitchen canvas shows through — measured and handed to the game as `setKitchenRect`. Over that
 * hole sit only the pour meter and the hint pill, and neither takes a touch.
 *
 * It slides with the pager: translated by `(1 - pageOffset) × width`, written straight onto the
 * element as the offset moves, so a swipe never renders anything.
 */
export const PrepPage = memo(function PrepPage({ layout, width, height }: PrepPageProps) {
  const page = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const orderSpaceRef = useRef<HTMLDivElement>(null);
  const [orderSpace, setOrderSpace] = useState(0);

  useLayoutEffect(() => {
    const element = page.current!;
    const apply = () => {
      const offset = uiState.value.pageOffset;
      element.style.transform = `translate3d(${(1 - offset) * width}px, 0, 0)`;
      element.style.visibility = offset <= 0 ? 'hidden' : 'visible';
    };
    apply();
    return uiState.subscribe((ui, was) => {
      if (ui.pageOffset !== was.pageOffset) apply();
    });
  }, [width]);

  // The kitchen's hole, relative to the pager. Both boxes slide together, so their difference is
  // the untranslated layout.
  useLayoutEffect(() => {
    const container = page.current!;
    const hole = scene.current!;
    const measure = () => {
      const p = container.getBoundingClientRect();
      const s = hole.getBoundingClientRect();
      setKitchenRect({ x: s.left - p.left, y: s.top - p.top, width: s.width, height: s.height });
      if (orderSpaceRef.current) setOrderSpace(orderSpaceRef.current.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(hole);
    observer.observe(container);
    if (orderSpaceRef.current) observer.observe(orderSpaceRef.current);
    measure();
    return () => observer.disconnect();
  }, [layout]);

  const column = layout === 'column';
  const band = layout === 'band';
  // The column's width is read against the room's own height: see `panelWidthFor`.
  const panelWidth = panelWidthFor(width, height);
  // In the column the card stands inside the column's padding and its 2px rule; the original made
  // it the column's width less the gutters and clipped its right edge by those 2px.
  const orderWidth = column ? panelWidth - GUTTER * 2 - 2 : width - GUTTER * 2;
  const order = <OrderBubble width={orderWidth} form={layout} maxHeight={orderSpace} />;

  const kitchen = (
    <div ref={scene} class="prep-scene">
      <PourMeterSlot />
      <KitchenHint />
    </div>
  );

  let body;
  if (column) {
    body = (
      <div key={layout} class="prep-layout prep-wide">
        {kitchen}
        <div class="prep-column" style={{ width: panelWidth }}>
          <div ref={orderSpaceRef} class="prep-order-space">{order}</div>
          <ClearButton layout={layout} />
          <ServeButton layout={layout} />
        </div>
      </div>
    );
  } else {
    body = (
      <div key={layout} class="prep-layout">
        <div class={`prep-order-header ${band ? 'band' : ''}`}>{order}</div>
        {kitchen}
        <div class={`prep-actions ${band ? 'band' : ''}`}>
          <ClearButton layout={layout} />
          <ServeButton layout={layout} />
        </div>
      </div>
    );
  }

  return <div ref={page} class="prep-page">{body}</div>;
});

/** The kitchen's standing hint, or a short message over it, on a pill near the foot of the room. */
function KitchenHint() {
  const hint = useUi((ui) => ui.nudge || ui.hint);
  if (!hint) return null;
  return (
    <div class="hint-row">
      <div class="hint">
        <span class="hint-text">{hint}</span>
      </div>
    </div>
  );
}

function ClearButton({ layout }: { layout: PrepLayout }) {
  const hasCup = useGame((state) => Boolean(state.cup.size));
  const icon = useMemo(() => kitchenActionIconSvg('trash'), []);
  const box = useRef<HTMLDivElement>(null);
  // The bin is also the toss's target, so it is registered whether or not it can be pressed.
  useEffect(() => {
    anchors.trash = box.current;
    return () => {
      if (anchors.trash === box.current) anchors.trash = null;
    };
  }, []);
  return (
    <div ref={box} class={layout === 'column' ? 'prep-clear-box' : 'prep-clear'}>
      <button
        type="button"
        class={`prep-clear-button live ${layout === 'band' ? 'band' : ''}`}
        disabled={!hasCup}
        aria-label="Đổ bỏ"
        onClick={() => {
          playSound('trash', TOSS_MS);
          dispatch({ type: 'CLEAR_CUP' });
        }}
      >
        <Svg markup={icon} />
        <span class="prep-clear-text">Đổ bỏ</span>
      </button>
    </div>
  );
}

function ServeButton({ layout }: { layout: PrepLayout }) {
  const { label, canServe } = useGame((state) => {
    const customer = state.selectedSlot === null ? null : state.slots[state.selectedSlot];
    const label = !customer
      ? 'Chọn order để pha'
      : !state.cup.size
        ? 'Lấy ly đúng cỡ từ kệ'
        : !state.cup.tea
          ? 'Rót trà vào ly'
          : state.build.inLidder
            ? 'Máy đang đậy nắp…'
          : !state.build.lidded
            ? 'Đặt ly vào máy đậy nắp ➜'
            : !state.build.straw
              ? 'Thêm ống hút bên cạnh máy ➜'
              : `Phục vụ ${customer.name} ➜`;
    return { label, canServe: cupCanServe(state) };
  }, shallow);
  const icon = useMemo(() => kitchenActionIconSvg('cup'), []);
  return (
    <button
      type="button"
      class={`prep-serve live ${layout === 'column' ? 'wide' : ''} ${layout === 'band' ? 'band' : ''}`}
      disabled={!canServe}
      aria-label={label}
      onClick={() => dispatch({ type: 'SERVE' })}
    >
      <Svg markup={icon} />
      <span class="prep-serve-text">{label}</span>
    </button>
  );
}
