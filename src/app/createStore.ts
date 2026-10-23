import { useSyncExternalStore } from 'react';

/** A minimal external store: get/set/subscribe plus a selector hook for React. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const store = {
    get: () => state,
    set(update: T | ((prev: T) => T)) {
      const next = typeof update === 'function' ? (update as (p: T) => T)(state) : update;
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return store;
}

export type Store<T> = ReturnType<typeof createStore<T>>;

/** Subscribes a component to a slice of a store; re-renders only when the slice changes. */
export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}
