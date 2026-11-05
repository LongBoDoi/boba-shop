import { memo } from 'preact/compat';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { cupLayout, cupSvg } from '../art/cup';
import { counterRoomPlacement } from '../counter/roomLayout';
import { CARRY_MS } from '../game/effectTiming';
import { Drink } from '../game/ingredients';
import { canServe as cupCanServe, frontSlot } from '../game/reducer';
import { goToPage } from '../game/pager';
import { shallow, useGame, useUi } from '../hooks';
import { playSound } from '../sound';
import { dispatch, store } from '../store';
import { uiState } from '../ui-state';
import { animateSampled, easeInOut } from './motion';
import { Svg } from './Svg';

/** The cup is drawn lidded and strawed, as the customer will carry it off. */
const FINISHED = { straw: true, sealed: true, tapered: false } as const;

/**
 * The register is a real shortcut for taking the next customer's order — and it is where a drink
 * is handed over: a cup finished in the kitchen is carried out to the mat beside the till (see
 * `CupBuild.atCounter`), and pressing the register is what gives it to the customer.
 */
export const CounterPage = memo(function CounterPage({ width, height, wide }: {
  width: number; height: number; wide: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const opening = useUi(ui => ui.opening);
  const counterReady = useUi(ui => ui.counterReady);
  const { requesting, ordered, serving, name, running } = useGame(state => {
    const front = frontSlot(state.slots);
    return {
      requesting: Number(state.slots[front ?? -1]?.status === 'requesting'),
      ordered: Number(state.slots[front ?? -1]?.status === 'ordered'),
      serving: cupCanServe(state),
      name: (state.selectedSlot === null ? null : state.slots[state.selectedSlot]?.name) ?? '',
      running: state.phase === 'playing' && !state.paused,
    };
  }, shallow);
  // The cup itself is there whether or not it can be handed over: a customer who gave up waiting
  // leaves it standing on the mat, to be given to whoever is next or thrown away in the kitchen.
  const { waiting, cupId } = useGame(state => ({
    waiting: state.build.atCounter ? state.cup : null, cupId: state.cupId,
  }), shallow);
  const { register, handoff } = counterRoomPlacement(width, height, wide);
  useLayoutEffect(() => {
    const apply = () => {
      const offset = uiState.value.pageOffset;
      root.current!.style.transform = `translate3d(${-offset * width}px, 0, 0)`;
      root.current!.style.visibility = offset < 1 ? 'visible' : 'hidden';
      root.current!.dataset.active = offset === 0 ? 'true' : 'false';
    };
    apply();
    return uiState.subscribe((ui, was) => { if (ui.pageOffset !== was.pageOffset) apply(); });
  }, [width]);
  const action = !counterReady ? 'Xin chào' : serving ? 'Trao ly' : requesting ? 'Nhận đơn' : ordered ? 'Pha chế' : 'Xin chào';
  const detail = serving ? `Cho ${name}`
    : requesting ? `${requesting} khách chờ` : ordered ? `${ordered} đơn đã nhận` : 'Mời bạn gọi món';
  return <div ref={root} class="counter-register-layer" style={{ width, height }}>
    {waiting && <HandoffCup key={cupId} drink={waiting} seat={handoff} />}
    <button type="button" class={`counter-register ${serving ? 'ready' : ''}`}
      aria-label={serving ? `Trao ly cho ${name}` : requesting ? `Nhận đơn, ${requesting} khách đang chờ` : action}
      disabled={!running || opening || !counterReady || (!serving && !requesting && !ordered)}
      style={{ left: Math.max(0, register.x), top: register.y - Math.max(0, 44 - register.height) / 2,
        width: register.width + Math.min(0, register.x), height: Math.max(44, register.height),
        fontSize: Math.max(12, Math.min(18, register.width * 0.155)) }}
      onClick={() => {
        if (uiState.value.pageOffset !== 0 || uiState.value.opening || !uiState.value.counterReady || store.state.paused) return;
        // The till hands over whatever is standing on the mat before it takes anything else on.
        if (cupCanServe(store.state)) { dispatch({ type: 'SERVE' }); return; }
        const slot = frontSlot(store.state.slots);
        if (slot !== null && store.state.slots[slot]?.status === 'requesting') { playSound('order'); dispatch({ type: 'TAKE_ORDER', slot }); }
        else if (slot !== null && store.state.slots[slot]?.status === 'ordered') goToPage(1);
      }}>
      <span>{action}</span>
      {register.height >= 48 && <small>{detail}</small>}
    </button>
  </div>;
});

/**
 * The finished cup standing on the counter's mat. It flies in from wherever the kitchen's cup was
 * when the player sent it out (`uiState.cupScreen`), across the page slide the two pages make
 * together, so the whole thing reads as one move: the drink is carried out of the kitchen to the
 * front. Arriving, it says where it now stands, so the coins of the sale spring from the till
 * rather than from the kitchen the cup has left.
 */
function HandoffCup({ drink, seat }: { drink: Drink; seat: { x: number; y: number; width: number } }) {
  const element = useRef<HTMLDivElement>(null);
  const box = cupLayout(seat.width, FINISHED);
  const markup = useMemo(() => cupSvg(drink, { width: seat.width, backgroundColor: 'transparent', ...FINISHED }), [drink, seat.width]);
  const left = seat.x - box.boxWidth / 2;
  const top = seat.y - box.originY - box.boxHeight;
  useLayoutEffect(() => {
    const node = element.current!;
    const { pageOffset, pager } = uiState.value;
    const rect = node.getBoundingClientRect();
    // Where it will stand once the pager has settled: the whole layer is translated by the page
    // offset, so what is measured mid-slide is that much to the left of its resting place.
    const to = {
      x: rect.left + pageOffset * pager.width + box.originX + box.boxWidth / 2,
      y: rect.top + box.originY + box.boxHeight / 2,
    };
    const was = uiState.value.cupScreen;
    uiState.set({ cupScreen: { x: to.x, y: to.y, width: box.boxWidth } });
    if (!was) return;
    const dx = was.x - to.x;
    const dy = was.y - to.y;
    const from = was.width / box.boxWidth;
    const flight = animateSampled(node, CARRY_MS, (p) => ({
      transform: `translate3d(${dx * (1 - p)}px, ${dy * (1 - p)}px, 0) scale(${from + (1 - from) * p})`,
    }), { ease: easeInOut });
    return () => flight.cancel();
  }, [left, top, seat.width]);
  return <div ref={element} class="counter-handoff"
    style={{ left, top, width: box.svgWidth, height: box.svgHeight,
      transformOrigin: `${box.originX + box.boxWidth / 2}px ${box.originY + box.boxHeight / 2}px` }}>
    <Svg markup={markup} />
  </div>;
}
