import { createStore } from '../app/createStore';
import type { EngineStats, LabelAnchor, SceneController } from './types';

// The single SceneController instance, shared by UI actions. UI code calls its methods
// and never reaches into renderer objects.
let controller: SceneController | null = null;
const labelElements = new Map<string, HTMLElement>();

export const engine = {
  get: () => controller,
  set: (c: SceneController | null) => {
    controller = c;
    if (c) for (const [k, el] of labelElements) c.bindLabelElement(k, el);
  },
};

/** Ref callback for label elements; remembered so a controller created later still gets them. */
export function bindLabel(key: string, el: HTMLElement | null) {
  if (el) labelElements.set(key, el);
  else labelElements.delete(key);
  controller?.bindLabelElement(key, el);
}

/** Labels the current stage wants drawn; updated only when the set of labels changes. */
export const labelStore = createStore<LabelAnchor[]>([]);

/** Hover tooltip, updated at most every 70 ms by the engine. */
export const hoverStore = createStore<{ label: string; sub?: string; x: number; y: number } | null>(null);

/** Measured performance figures (debug mode only). */
export const statsStore = createStore<EngineStats | null>(null);
