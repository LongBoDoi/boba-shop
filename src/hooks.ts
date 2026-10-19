import { useEffect, useRef, useState } from 'preact/hooks';

import { GameState } from './game/reducer';
import { store } from './store';
import { UiState, uiState } from './ui-state';

/**
 * A slice of the shop, re-rendering only when that slice changes (by `Object.is`, or by `equal`).
 * Pick narrowly: the clock moves several times a second, and a component that selects the whole
 * state re-renders with it.
 */
export function useGame<T>(select: (state: GameState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const [value, setValue] = useState(() => select(store.state));
  const latest = useRef({ select, equal, value });
  latest.current = { select, equal, value };
  useEffect(() => {
    const check = () => {
      const { select: pick, equal: same, value: was } = latest.current;
      const next = pick(store.state);
      if (!same(was, next)) setValue(() => next);
    };
    check();
    return store.subscribe(check);
  }, []);
  return value;
}

/** The same, for the screen's own state. */
export function useUi<T>(select: (ui: UiState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const [value, setValue] = useState(() => select(uiState.value));
  const latest = useRef({ select, equal, value });
  latest.current = { select, equal, value };
  useEffect(() => {
    const check = () => {
      const { select: pick, equal: same, value: was } = latest.current;
      const next = pick(uiState.value);
      if (!same(was, next)) setValue(() => next);
    };
    check();
    return uiState.subscribe(check);
  }, []);
  return value;
}

/** Shallow equality for selecting a few fields at once. */
export function shallow<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}
