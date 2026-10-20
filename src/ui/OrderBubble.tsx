import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';

import { characterSvg } from '../art/character';
import { patienceHeartSvg } from '../art/icons';
import { cupSizeIconSvg, ingredientIconSvg, ingredientLocatorSvg } from '../art/ingredientIcon';
import { useGame } from '../hooks';
import { playSound } from '../sound';
import { dispatch } from '../store';
import { ICON_CUP } from '../art/kitchenArt';
import {
  asksFor,
  CategoryId,
  describeSelection,
  Drink,
  effectiveId,
  getIngredient,
  selectedIds,
} from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { categoryMatches, evaluateDrink } from '../game/orders';
import { Customer, patienceLeft } from '../game/reducer';
import { ORDER_BAND_HEIGHT, ORDER_PANEL_HEIGHT, PrepLayout } from './responsive';
import { Svg } from './Svg';

/** A taken order (`Ticket` in `TicketRail.tsx`): the counter spot and who is waiting at it. */
export interface Ticket {
  slot: number;
  customer: Customer;
}

/** The taken orders, in counter order — how `GameScreen` builds `tickets`. */
export function ticketsOf(slots: (Customer | null)[]): Ticket[] {
  return slots.flatMap((customer, slot) => (customer && customer.status === 'ordered' ? [{ slot, customer }] : []));
}

/**
 * The order is read, not built, so it is listed the way it would be said over the counter —
 * tea first, then what goes in it — rather than in `BUILD_ORDER`.
 */
const SPOKEN: CategoryId[] = ['tea', 'milk', 'sweetness', 'ice', 'toppings', 'foam'];

const CARD_BORDER = 2;
const TRACK_HEIGHT = 18;
const HEAD_RESERVE = 232;

/** The biggest tile column that still stands a whole order inside a short side column's height. */
function fitTiles(count: number, room: number, budget: number) {
  let grid = { column: Math.min(room, 74) };
  for (let column = 74; column >= 34; column -= 4) {
    const perRow = Math.max(1, Math.floor(room / column));
    const tile = Math.max(28, Math.min(column - 6, 60));
    const rows = Math.ceil(count / perRow);
    const height = rows * tile + Math.max(0, rows - 1) * 8;
    grid = { column: Math.min(room / Math.max(1, Math.min(count, perRow)), column) };
    if (budget <= 0 || height <= budget) break;
  }
  return grid;
}

interface Chip {
  key: string;
  category: CategoryId | 'size';
  id: string;
  label: string;
  done: boolean;
}

/**
 * What the order asks for, one tile per thing — a cup with two toppings gets two. Only what the
 * customer actually asked for is listed: a category they said nothing about has no tile, rather
 * than a crossed-out one reading "Không sữa". So the list is as long as the order is, the count
 * under the name is out of what there is to do, and anything not on the card goes in no cup.
 */
function chipsFor(order: Drink, cup: Drink, config: DayConfig): Chip[] {
  const asked = SPOKEN.filter((category) => config.categories.includes(category) && asksFor(order, category));
  const ingredients = asked.flatMap<Chip>((category) => {
    const done = categoryMatches(cup, order, category);
    if (category === 'toppings') {
      return selectedIds(order, category)
        .map((id) => ({ key: `topping-${id}`, category, id, label: getIngredient(category, id)?.name ?? id,
          done: cup.toppings.includes(id) }));
    }
    const id = effectiveId(order, category) ?? '';
    return [{ key: category, category, id, label: describeSelection(order, category), done }];
  });
  return [{ key: 'size', category: 'size', id: order.size ?? '', label: `Ly ${order.size}`,
    done: Boolean(cup.size && cup.size === order.size) }, ...ingredients];
}

/**
 * What the drink is called. "Trà Thái" becomes "Trà sữa Thái", but "Hồng trà" becomes "Hồng trà
 * sữa" — the word lands where Vietnamese puts it.
 */
function drinkName(order: Drink): string {
  const tea = order.tea ? getIngredient('tea', order.tea)?.name : null;
  if (!tea) return 'Ly trà sữa';
  if (!order.milk || order.milk === 'none') return tea;
  if (/^trà\s/i.test(tea)) return `Trà sữa ${tea.slice(4)}`;
  if (/\strà$/i.test(tea)) return `${tea} sữa`;
  return `Trà sữa ${tea}`;
}

interface OrderBubbleProps {
  width: number;
  form: PrepLayout;
  /** Column: the height it has to fit in, so a short column gets smaller tiles. */
  maxHeight: number;
}

/**
 * The order being made, across the top of the kitchen (`OrderBubble.tsx`): who it is for, what it
 * is called, how much is done, a tile for every thing that goes in it, and the other taken orders
 * waiting in a queue. Only those queue portraits take touches.
 *
 * Its height is fixed (except standing in a column), because the kitchen is laid out from what is
 * left under it. It renders when the order, the cup or the counter changes — never on a tick:
 * the patience heart is its own component.
 */
export const OrderBubble = memo(function OrderBubble({ width: W, form, maxHeight }: OrderBubbleProps) {
  const slots = useGame((state) => state.slots);
  const selectedSlot = useGame((state) => state.selectedSlot);
  const cup = useGame((state) => state.cup);
  const config = useGame((state) => state.config);
  const customer = selectedSlot === null ? null : slots[selectedSlot];
  const tickets = useMemo(() => ticketsOf(slots), [slots]);

  const pad = 10;
  const tall = form === 'column';
  const inline = form === 'band';
  const avatar = tall ? 44 : 40;
  const others = tickets.filter((ticket) => ticket.slot !== selectedSlot);
  const compactQueue = tall && others.length > 0;

  const chips = customer ? chipsFor(customer.order, cup, config) : [];
  const done = chips.filter((chip) => chip.done).length;
  const room = W - pad * 2 - CARD_BORDER * 2;
  const headRoom = Math.max(140, room - HEAD_RESERVE - (others.length > 0 ? 24 + others.length * 37 : 0));
  const band = { column: chips.length > 0 ? Math.min((inline ? headRoom : room) / chips.length, 56) : 0 };
  const grid = tall
    ? fitTiles(chips.length, room, (maxHeight || 0) - pad * 2 - CARD_BORDER * 2
      - Math.max(avatar, compactQueue ? 48 : 30) - TRACK_HEIGHT)
    : band;
  const column = grid.column;
  const tile = Math.floor(Math.max(24, Math.min(column - 6, tall ? 60 : 48)));

  const tiles = chips.map((chip) => <ChipTile key={chip.key} chip={chip} width={column} tile={tile} />);
  const queue = others.map(({ slot, customer: waiting }) => (
    <OrderPin key={waiting.id} slot={slot} customer={waiting} cup={cup} config={config} size={tall ? 24 : 32} />
  ));

  const face = useMemo(
    () => (customer ? characterSvg(customer.look, { mood: 'happy', width: avatar * 0.92, headOnly: true }) : ''),
    [customer, avatar],
  );

  return (
    <div
      class={`order-card ${tall ? 'tall' : ''}`}
      style={{ width: W, padding: pad, height: tall ? undefined : inline ? ORDER_BAND_HEIGHT : ORDER_PANEL_HEIGHT }}
    >
      <div class="order-head">
        <div class="order-avatar" style={{ width: avatar, height: avatar, borderRadius: avatar * 0.32 }}>
          {customer ? (
            <Svg markup={face} />
          ) : (
            <img src={String(ICON_CUP)} alt="" style={{ width: avatar * 0.5, height: avatar * 0.5, objectFit: 'contain' }} />
          )}
        </div>
        <div class="order-name">
          <div class="order-title">{customer ? drinkName(customer.order) : 'Chưa có order'}</div>
          <div class={`order-subtitle ${compactQueue ? 'visually-hidden' : ''}`}>
            {customer ? `Cho ${customer.name} · xong ${done}/${chips.length}` : 'Vuốt sang Quầy để nhận order'}
          </div>
          {compactQueue && <div class="order-queue-compact">
            <span class="order-waiting-label">Chờ</span>
            <div class="order-queue">{queue}</div>
          </div>}
        </div>
        {customer && <Patience size={26} />}
        {inline && customer && (
          <>
            <div class="order-split" />
            <div class="order-chips-inline">{tiles}</div>
          </>
        )}
        {!tall && queue.length > 0 && (
          <>
            <div class="order-split" />
            <div class="order-queue">{queue}</div>
          </>
        )}
      </div>

      <div class="order-track">
        <div class="order-fill" style={{ width: `${chips.length > 0 ? (done / chips.length) * 100 : 0}%` }} />
      </div>

      {inline ? null : customer ? (
        <div class={`order-chips ${tall ? 'wrap' : ''}`}>{tiles}</div>
      ) : (
        <div class="order-hint-box">
          <div class="order-hint">Mỗi order hiện ở đây, kèm từng thứ cần cho vào ly.</div>
        </div>
      )}
    </div>
  );
});

/**
 * The customer's patience, a heart emptying from the top. The only part of the card that follows
 * the clock, and `patienceLeft` is already rounded to a fiftieth, so it redraws ~50 times a wait.
 */
function Patience({ size }: { size: number }) {
  const left = useGame((state) => {
    const customer = state.selectedSlot === null ? null : state.slots[state.selectedSlot];
    return customer ? patienceLeft(customer, state.clock) : 1;
  });
  const markup = useMemo(() => patienceHeartSvg(left, size), [left, size]);
  return <Svg markup={markup} />;
}

function ChipTile({ chip, width, tile }: { chip: Chip; width: number; tile: number }) {
  const icon = useMemo(() => {
    if (chip.category === 'size') return cupSizeIconSvg(chip.id, tile - 2);
    return ingredientIconSvg(chip.category, chip.id, tile - 2);
  }, [chip.category, chip.id, tile]);
  const locator = useMemo(() => ingredientLocatorSvg(chip.category, chip.id, 16), [chip.category, chip.id]);
  const quantity = chip.category === 'size' ? chip.id : chip.category === 'sweetness' ? `${chip.id}%`
    : chip.category === 'ice' ? `×${chip.id === 'less' ? 1 : 2}` : null;
  return (
    <div
      class="chip"
      role="img"
      aria-label={`${chip.label} — ${chip.done ? 'đã đúng' : 'chưa đúng'}`}
      data-ingredient={`${chip.category}:${chip.id}`}
      data-testid={chip.category === 'size' ? 'order-cup-size' : undefined}
      style={{ width }}
    >
      <div class={`chip-tile ${chip.done ? 'done' : ''}`} style={{ width: tile, height: tile, borderRadius: tile * 0.3 }}>
        <Svg markup={icon} />
        {locator && <Svg class="chip-locator" markup={locator} />}
        {quantity && <span class="chip-quantity">{quantity}</span>}
        {chip.done && (
          <div class="chip-check" style={{ width: tile * 0.42, height: tile * 0.42, borderRadius: tile * 0.21 }}>
            <span class="chip-check-mark" style={{ fontSize: tile * 0.26 }}>✓</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One of the other taken orders, waiting its turn; tap it to make it next. */
function OrderPin({ slot, customer, cup, config, size }: {
  slot: number; customer: Customer; cup: Drink; config: DayConfig; size: number;
}) {
  const ready = evaluateDrink(cup, customer.order, config.categories).quality === 'perfect';
  const face = useMemo(() => characterSvg(customer.look, { mood: 'happy', width: size * 0.8, headOnly: true }), [customer.look, size]);
  return (
    <button
      type="button"
      class="order-pin live"
      aria-label={`Order của ${customer.name} — ly ${customer.order.size}`}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onClick={() => {
        playSound('tap');
        dispatch({ type: 'SELECT_SLOT', slot });
      }}
    >
      <Svg markup={face} />
      {ready && <span class="order-pin-ready" style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }} />}
    </button>
  );
}
