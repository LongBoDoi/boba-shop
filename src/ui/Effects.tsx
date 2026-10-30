import { useEffect, useRef } from 'preact/hooks';

import { coinSvg, CONFETTI_COLORS } from '../art/icons';
import { cupLayout, cupSvg } from '../art/cup';
import { store } from '../store';
import { uiState } from '../ui-state';
import { COIN_FLIGHT_MS, COIN_STAGGER_MS, COIN_START_MS, TOSS_MS } from '../game/effectTiming';
import { Drink } from '../game/ingredients';
import { Departure, GameState } from '../game/reducer';
import { animateSampled, easeInOut, easeOutQuad, noise } from './motion';
import { anchors, centreOf } from './viewport';

interface Point {
  x: number;
  y: number;
}

/**
 * Serve and discard effects over the whole game screen (`EffectsLayer` in `Effects.tsx`): confetti
 * on a perfect serve, coins flying from the cup to the wallet on a paid one, and a discarded cup
 * tossed into the bin.
 *
 * Nothing here is a render. Each effect is started once, by the reducer event that caused it (a new
 * departure, a new `discarded`), as elements created on the spot and moved by the Web Animations
 * API — transform and opacity only — then removed when they land.
 */
export function EffectsLayer() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = layer.current!;
    // The cup is gone from the mat by the time its serve or its discard reaches here, so the
    // place it last stood is kept.
    let cup = uiState.value.cupScreen;
    const offUi = uiState.subscribe((ui) => {
      if (ui.cupScreen) cup = ui.cupScreen;
    });

    const from = (): Point => cup ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
    let seenDeparture = store.state.departures.reduce((max, d) => Math.max(max, d.id), 0);
    let seenDiscard = store.state.discarded?.id ?? 0;

    const onState = (state: GameState) => {
      for (const departure of state.departures) {
        if (departure.id <= seenDeparture) continue;
        seenDeparture = departure.id;
        reward(root, departure, from());
      }
      if (state.discarded && state.discarded.id > seenDiscard) {
        seenDiscard = state.discarded.id;
        const target = centreOf(anchors.trash) ?? { x: window.innerWidth * 0.2, y: window.innerHeight * 0.9 };
        toss(root, state.discarded.drink, from(), target, cup?.width ?? 90);
      }
    };
    const offStore = store.subscribe(onState);
    return () => {
      offUi();
      offStore();
      root.replaceChildren();
    };
  }, []);

  return <div ref={layer} class="effects" />;
}

/** The served cup is carried off on the counter; here the sale itself springs from the cup. */
function reward(root: HTMLElement, departure: Departure, at: Point) {
  if (departure.outcome === 'perfect') confetti(root, at, { delay: 300 });
  if (departure.earned > 0) {
    const to = (departure.toJar ? centreOf(anchors.jar) : null) ?? centreOf(anchors.wallet) ?? { x: window.innerWidth * 0.65, y: 30 };
    const count = Math.min(3, Math.max(1, Math.ceil(departure.earned / 3)));
    for (let i = 0; i < count; i++) flyCoin(root, at, to, COIN_START_MS + i * COIN_STAGGER_MS);
  }
}

function piece(root: HTMLElement, markup: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'flyer';
  element.innerHTML = markup;
  root.appendChild(element);
  return element;
}

function done(element: HTMLElement, animation: Animation) {
  const remove = () => element.remove();
  animation.onfinish = remove;
  animation.oncancel = remove;
}

const COIN_SIZE = 18;
let coinMarkup = '';

function flyCoin(root: HTMLElement, from: Point, to: Point, delay: number) {
  coinMarkup ||= coinSvg(COIN_SIZE);
  const element = piece(root, coinMarkup);
  const half = COIN_SIZE / 2;
  done(element, animateSampled(element, COIN_FLIGHT_MS, (p) => ({
    opacity: p === 0 || p >= 1 ? 0 : 1,
    transform: `translate3d(${from.x + (to.x - from.x) * p - half}px, ${from.y + (to.y - from.y) * p - 30 * 4 * p * (1 - p) - half}px, 0)`,
  }), { delay, ease: easeInOut }));
}

function toss(root: HTMLElement, drink: Drink, from: Point, to: Point, width: number) {
  const cupWidth = Math.round(width);
  const layout = cupLayout(cupWidth);
  const element = piece(root, cupSvg(drink, { width: cupWidth, backgroundColor: 'transparent', tapered: false }));
  // Placed by the cup's own box, as the original's `Cup` was; the drawing overhangs it a little.
  const offsetX = -layout.originX - layout.boxWidth / 2;
  const offsetY = -layout.originY - layout.boxHeight / 2;
  element.style.transformOrigin = `${layout.originX + layout.boxWidth / 2}px ${layout.originY + layout.boxHeight / 2}px`;
  done(element, animateSampled(element, TOSS_MS, (p) => ({
    opacity: p < 0.7 ? 1 : (1 - p) / 0.3,
    transform: `translate3d(${from.x + (to.x - from.x) * p + offsetX}px, ${from.y + (to.y - from.y) * p + offsetY}px, 0) rotate(${-p * 35}deg) scale(${1 - p * 0.6})`,
  }), { ease: easeInOut }));
}

/** A burst of confetti (`Confetti` in `Effects.tsx`), also thrown by the day-end screen. */
export function confetti(root: HTMLElement, at: Point, { delay = 0, pieces = 12, power = 0.8 } = {}) {
  for (let i = 0; i < pieces; i++) {
    const angle = -Math.PI / 2 + (noise(i, 1) - 0.5) * Math.PI * 1.1;
    const speed = (60 + noise(i, 2) * 70) * power;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = (noise(i, 3) - 0.5) * 240;
    const round = i % 3 === 0;
    const element = document.createElement('div');
    element.className = 'flyer confetti';
    element.style.width = `${round ? 7 : 6}px`;
    element.style.height = `${round ? 7 : 10}px`;
    element.style.borderRadius = `${round ? 4 : 1.5}px`;
    element.style.backgroundColor = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    root.appendChild(element);
    done(element, animateSampled(element, 1000, (p) => ({
      opacity: p === 0 ? 0 : 1 - Math.max(0, (p - 0.7) / 0.3),
      transform: `translate3d(${at.x + vx * p}px, ${at.y + vy * p + 160 * p * p}px, 0) rotate(${spin * p}deg)`,
    }), { delay, ease: easeOutQuad }));
  }
}
