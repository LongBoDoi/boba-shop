import { CustomerKind, CustomerLook, KIND_MARK, kindOf } from './customers';
import { formatMoney } from './money';
import type { ServeQuality } from './orders';
import type { DayStats, Departure, GameMode, GameState, Overtime, Tone } from './reducer';
import type { Recall } from './regulars';

/**
 * What a customer will put up with and what they pay, in one place. Every number here is a starting
 * guess that tuning will move, and every modifier a later mechanic adds lands in these functions:
 * spawning and serving call them and work nothing out for themselves, because modifiers stacked at
 * the point of use multiply out with nobody looking. A rush, a shipper and a late round together
 * came to about five seconds of patience, for a drink that takes ten to make.
 */

/**
 * The shortest wait anyone is given for their drink, and for their order to be taken. The day proper
 * never reaches the first of these, whose lowest is a shipper's 32.5 s, so all it decides is how hard
 * the late rounds get, and that is what decides the third press. At 30 s it was free for a skilled
 * player, by about 30 units. At 25 s it costs one working the queue in order and still pays one
 * triaging it, which is what makes the pill a question. See `tools/sim/README.md`.
 */
export const SERVE_PATIENCE_FLOOR_MS = 25_000;
export const ORDER_PATIENCE_FLOOR_MS = 12_000;

/** How much of the day's patience each kind has. */
export const KIND_PATIENCE: Record<CustomerKind, number> = { plain: 1, shipper: 0.5, elder: 1.6, office: 0.85 };
/** What each kind does to the tip a perfect drink earns. */
export const KIND_TIP: Record<CustomerKind, number> = { plain: 1, shipper: 3, elder: 0, office: 1 };
/** Added to the tip by an office worker, for a perfect drink poured neatly. */
export const OFFICE_BONUS = 2;
/** The tip for a drink served the moment it was ordered, before the kind has its say. */
export const MAX_TIP = 3;
/** The tip for a perfect drink however late it came, before the kind has its say. */
export const MIN_TIP = 1;
/** The share of its price a drink that fell short still pays: spilled, or nearly right. */
export const PARTIAL_PAY = 0.5;

/** Three stars: this share of customers happy, with this share of the cups sold perfect. */
export const THREE_STAR_HAPPY = 0.9;
export const THREE_STAR_PERFECT = 0.6;
/** Two stars: this share of customers happy. */
export const TWO_STAR_HAPPY = 0.7;

/** How long a customer's arrival line stays up: long enough to be read while doing something else. */
export const SAY_MS = 2_600;

/** The most introductions one opening sign carries. The rest wait for the next day. */
export const MAX_NEWS = 2;

/**
 * The shortest the day itself makes anyone wait for a drink, before kinds and overtime. Three tickets
 * at a slow player's nineteen seconds is 57 s, so this is what decides whether they keep their third
 * star: at 60 s, with kinds on the counter and wrong drinks counted, they fell to about four days in five.
 */
export const DAY_PATIENCE_FLOOR_MS = 65_000;

/** The group that opens the first day of a shop, and the one the days never grow past. */
export const FIRST_WAVE = 3;
export const MAX_WAVE = 6;
/** How many days it takes a group to grow by one. It runs on past the day every other dial stops. */
export const WAVE_GROWTH_DAYS = 5;
/** The quiet between two groups. It is a breath and not a chore, so it stays short. */
export const LULL_MIN_MS = 6_000;
export const LULL_MAX_MS = 10_000;
/** The stagger inside a group: they come in one after another, not through the door as one. */
export const WAVE_GAP_MIN_MS = 1_200;
export const WAVE_GAP_MAX_MS = 2_200;
/** How long someone with no spot waits outside before going home. */
export const LINE_MS = 35_000;
/** What the bench does to that wait. */
export const BENCH_LINE_PATIENCE = 1.5;

/** How much longer one press keeps the shop open. */
export const OVERTIME_ROUND_MS = 30_000;
/** How long before closing the offer stands. A thumb holding a pour cannot press, so not 5 s. */
export const OVERTIME_WINDOW_MS = 15_000;
export const OVERTIME_MAX_ROUNDS = 3;
/** The first day the shop may stay open, so a new player learns the day before stretching it. */
export const OVERTIME_FROM_DAY = 3;
/**
 * What each round leaves of a late customer's patience, compounding: ×0.343 by the third, which puts
 * a late day's third round on the floor. A press is only a decision if it can actually be lost: the
 * sales pay for themselves, and at 0.8 a skilled player never lost one. See `tools/sim/README.md`.
 */
export const OVERTIME_PATIENCE = 0.7;
/** What each round adds to the jar's multiplier when it pays out at closing. */
export const OVERTIME_BONUS_PER_ROUND = 0.1;
/** What a walkout leaves of the jar. */
export const OVERTIME_BURN_KEEPS = 0.5;

/**
 * How far into the day a regular may come, as a share of it. The first day is later, so that a new
 * player has met the shop before they meet someone they are meant to remember.
 */
export const REGULAR_AT_FIRST_DAY = 0.6;
export const REGULAR_AT = 0.2;
/** The most tiles a usual may fill on the card, its size included: it is a drink to be remembered. */
export const USUAL_MAX_TILES = 4;
/** The most units a streak adds to the tip, so that a long run is worth having and not worth fearing. */
export const STREAK_CAP = 5;

interface Patience {
  orderPatienceMs: number;
  patienceMs: number;
}

/**
 * How long this customer will wait, on this day, in this shop. `mode` is for a shop about to change
 * how it is run, which has not got there yet. `rounds` is how far into overtime this customer came
 * in: it belongs to the customer and not to the shop, because whoever was already standing there
 * when the player pressed keeps the patience they arrived with.
 *
 * The relaxed shop keeps its customers' faces, lines and tips, but it promises no pressure, so
 * nobody in it has less time than anybody else. The floors go on last, after every modifier, which
 * is the only thing that makes them floors.
 */
export function patienceFor(
  state: Pick<GameState, 'config' | 'mode'>,
  look: CustomerLook,
  { mode = state.mode, rounds = 0 }: { mode?: GameMode; rounds?: number } = {},
): Patience {
  const scale = mode === 'relaxed' ? 1 : KIND_PATIENCE[kindOf(look)] * OVERTIME_PATIENCE ** rounds;
  return {
    orderPatienceMs: Math.max(ORDER_PATIENCE_FLOOR_MS, Math.round(state.config.orderPatienceMs * scale)),
    patienceMs: Math.max(SERVE_PATIENCE_FLOOR_MS, Math.round(state.config.patienceMs * scale)),
  };
}

interface Sale {
  quality: ServeQuality;
  /** Nothing went over the brim. */
  neat: boolean;
  price: number;
  /** How much patience the customer had left when the cup reached them, 1 to 0. */
  patienceLeft: number;
  look: CustomerLook;
  /** Only for a regular: whether the card was hidden, and their streak as it stood. */
  regular?: { recall?: Recall; streak: number };
}

interface Payout {
  earned: number;
  tip: number;
  text: string;
  tone: Tone;
  /** Only for a regular: their streak after this cup. */
  streak?: number;
}

/** What a served cup pays, what the counter says about it, and what it does to a regular's streak. */
export function payoutFor(sale: Sale): Payout {
  const paid = paidFor(sale);
  return sale.regular ? { ...paid, streak: streakAfter(sale, sale.regular) } : paid;
}

function paidFor({ quality, neat, price, patienceLeft, look, regular }: Sale): Payout {
  const kind = kindOf(look);
  // Right drink, but it was poured over the brim: half price from everyone, and nothing on top.
  if (quality === 'perfect' && !neat) {
    const earned = Math.ceil(price * PARTIAL_PAY);
    return { earned, tip: 0, text: `Tràn ly… +${formatMoney(earned)}`, tone: 'ok' };
  }
  if (quality === 'perfect') {
    const base = Math.max(MIN_TIP, Math.round(patienceLeft * MAX_TIP)) * KIND_TIP[kind] + (kind === 'office' ? OFFICE_BONUS : 0);
    const remembered = regular?.recall === 'blank';
    // The tip is what asking costs, so it costs the whole of it, however quick the cup was.
    const tip = regular?.recall === 'asked' ? 0 : base + (remembered ? Math.min(regular.streak, STREAK_CAP) : 0);
    const earned = price + tip;
    return { earned, tip, text: `${remembered ? 'Đúng như cũ!' : 'Hoàn hảo!'} +${formatMoney(earned)}`, tone: 'good' };
  }
  // The office worker's bonus has a price: nearly right is not what they ordered.
  if (quality === 'close' && kind === 'office') return { earned: 0, tip: 0, text: 'Chưa đúng món…', tone: 'ok' };
  if (quality === 'close') {
    const earned = Math.ceil(price * PARTIAL_PAY);
    return { earned, tip: 0, text: `Tạm được +${formatMoney(earned)}`, tone: 'ok' };
  }
  return { earned: 0, tip: 0, text: 'Sai món rồi! 😡', tone: 'bad' };
}

/**
 * A regular's run of drinks got right. Anything short of the right drink ends it, asked or not: the
 * card was there to be read. Asking leaves it where it stood, and so does a spill, because the
 * drink was remembered and only the hand slipped. A first visit starts it, with nothing to remember.
 */
function streakAfter({ quality, neat }: Sale, { recall, streak }: NonNullable<Sale['regular']>): number {
  if (quality !== 'perfect') return 0;
  if (!neat || recall === 'asked') return streak;
  return recall === 'blank' ? streak + 1 : 1;
}

/**
 * Whether a customer goes off pleased with what they were handed. Nearly right usually does it, at
 * half price. An office worker who would not pay for it has not been pleased, and a smile and the
 * happy way out would argue with the `Chưa đúng món…` beside them.
 */
export function leftContent({ outcome, earned }: Pick<Departure, 'outcome' | 'earned'>): boolean {
  return outcome === 'perfect' || (outcome === 'close' && earned > 0);
}

interface Walkout {
  /** Whether the day's stats hold it against the shop. */
  missed: boolean;
  /** Whether it costs the shop its overtime jar, if the jar is still at stake. See `burnJar`. */
  burns: boolean;
  text: string;
  tone: Tone;
}

/**
 * Someone out of patience. A shipper leaving is not a failure of the shop — he has another delivery
 * — and this is load-bearing rather than kind: with shippers counted as misses, a slow player's
 * three-star days fell to about a third, and "who can I afford to lose?" stopped having an answer.
 * It holds in overtime too, so the kind that hurries the most cannot be what loses the jar.
 */
export function walkoutFor(look: CustomerLook, requesting: boolean): Walkout {
  if (kindOf(look) === 'shipper') return { missed: false, burns: false, text: 'Anh shipper đi rồi', tone: 'ok' };
  return { missed: true, burns: true, text: requesting ? 'Chưa kịp nhận! 😤' : 'Chậm quá! 😤', tone: 'bad' };
}

/** How long someone waits outside, on this day, in this shop. Read here so that a bench acts where it is used. */
export function lineWaitMs({ config, gear }: Pick<GameState, 'config' | 'gear'>): number {
  return config.lineMs * (gear.includes('bench') ? BENCH_LINE_PATIENCE : 1);
}

/** Nobody is on the way. One value, so a selector holding it does not read a new list as news. */
const NOBODY: readonly CustomerKind[] = [];

/** Who the quiet is leading up to, while it lasts. It hands back the state's own list, so it is a stable slice. */
export function lullGroup({ clock, incoming, lullUntil }: Pick<GameState, 'clock' | 'incoming' | 'lullUntil'>): readonly CustomerKind[] {
  return clock < lullUntil ? incoming : NOBODY;
}

/** The quiet's second line, `Sắp có 3 khách · 🛵 1 · 🧓 1`. Plain customers have no mark, so they are only in the count. */
export function lullPreview(group: readonly CustomerKind[]): string {
  const counts = (['shipper', 'elder', 'office'] as const)
    .map((kind) => [KIND_MARK[kind], group.filter((member) => member === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([mark, count]) => ` · ${mark} ${count}`);
  return `Sắp có ${group.length} khách${counts.join('')}`;
}

/** When the shop stops letting people in, which each round of overtime moves back. */
export function closesAt({ config, overtime }: Pick<GameState, 'config' | 'overtime'>): number {
  return config.durationMs + overtime.rounds * OVERTIME_ROUND_MS;
}

/**
 * Whether the day proper is over and the shop is still going. Between a press and the original
 * closing time it is not: those few seconds are the day's own, and they pay the till.
 */
export function inOvertime({ clock, config, overtime }: Pick<GameState, 'clock' | 'config' | 'overtime'>): boolean {
  return overtime.rounds > 0 && clock >= config.durationMs;
}

/**
 * A walkout on a running jar: half of it gone, and the bonus with it. Only the first one costs, and a
 * forfeited jar is out of reach: it has already given up its bonus to leave the risk behind, and a
 * relaxed shop's promise is no pressure, so it cannot go on threatening half of it.
 */
export function burnJar(overtime: Overtime): Overtime {
  if (overtime.rounds === 0 || overtime.lost || overtime.forfeited) return overtime;
  return { ...overtime, lost: true, jar: Math.floor(overtime.jar * OVERTIME_BURN_KEEPS) };
}

/**
 * Going relaxed with a round running. A walkout there does not burn the jar, and without this the safe
 * way to a bonus would be three presses, a trip to the settings, and a trip back before closing. The
 * jar itself stays whole: it is money the shop has earned, and a relaxed shop takes nothing away.
 */
export function forfeitJar(overtime: Overtime): Overtime {
  return overtime.rounds === 0 ? overtime : { ...overtime, forfeited: true };
}

/**
 * What the jar puts in the till at closing. The nudge is for binary fractions: a whole bonus can come
 * out a hair short of itself, as 100 × 1.15 does, and a clean close is not to lose a unit over that.
 */
export function jarPayout({ rounds, jar, lost, forfeited }: Overtime): number {
  return lost || forfeited ? jar : Math.floor(jar * (1 + OVERTIME_BONUS_PER_ROUND * rounds) + 1e-9);
}

/**
 * How the day went, out of three. A day cannot be failed, so the stars rate the *service*: how many
 * customers left with a drink that was at least nearly theirs, and how many got the one they asked
 * for. A wrong drink is a customer let down, the same as one who gave up, which `serve` counts in
 * `missed` — so a shop cannot earn stars by handing everyone anything at all.
 */
export function starsFor({ served, perfect, missed }: DayStats) {
  if (served === 0) return 0;
  const happy = served / (served + missed);
  if (happy >= THREE_STAR_HAPPY && perfect >= served * THREE_STAR_PERFECT) return 3;
  if (happy >= TWO_STAR_HAPPY) return 2;
  return 1;
}

type NewsReader = Pick<GameState, 'day' | 'seen' | 'mode'>;

interface News {
  id: string;
  line: string;
  /** Whether this shop has any use for it yet. Without one, every shop does. */
  applies?: (state: NewsReader) => boolean;
}

/**
 * Each mechanic's introduction, in the order a shop meets them. Two go on a sign, so a new shop hears
 * about regulars on day 2, the day the first "Như cũ nhé!" comes in, and about overtime on day 3, the
 * day it first opens. Groups can wait for that sign: the quiet's pill and the `+N` on the tab explain them.
 */
const NEWS: News[] = [
  { id: 'kinds', line: '🛵 Shipper vội nhưng tip gấp ba; 🧓 bác chờ được lâu, không tip; 💼 dân văn phòng thưởng thêm khi đúng món.' },
  { id: 'regulars', line: '🤝 Khách quen nói “Như cũ nhé!” — nhớ món thì pha, quên thì hỏi lại và mất tip.' },
  // Relaxed keeps someone at every spot and nobody outside, so there is nothing to tell it.
  { id: 'waves', line: '👥 Khách tới từng đợt — ai chưa có chỗ sẽ đợi ngoài cửa.', applies: ({ mode }) => mode !== 'relaxed' },
  {
    id: 'overtime',
    line: `🌙 Cuối ngày có thể mở thêm ${OVERTIME_ROUND_MS / 1000} giây. Tiền tăng ca vào hũ, đóng cửa êm thì có thưởng.`,
    applies: ({ day, mode }) => day >= OVERTIME_FROM_DAY && mode !== 'relaxed',
  },
];

/** Every id a shop can have seen. A save naming anything else named something this build lacks. */
export const NEWS_IDS = NEWS.map((news) => news.id);

/**
 * What the opening sign has to introduce. It is keyed to what this shop has seen and not to the day:
 * the shops that already exist are past day 1, and one on day 20 would otherwise never be told, or
 * be told everything at once. Day 1 has the how-to-play to get through first.
 */
export function dayNews(state: NewsReader): News[] {
  if (state.day <= 1) return [];
  return NEWS.filter((news) =>!state.seen.includes(news.id) && (news.applies?.(state) ?? true)).slice(0, MAX_NEWS);
}
