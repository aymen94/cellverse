import { createStore } from '../../app/createStore';
import { buildingBlocks } from '../../data/lab';
import { elements } from '../../data/elements';
import type { ElementSymbol } from '../../types/science';
import { analyzeComponent, connectionOptions, nodeById } from './chemistry';
import type { ConnectionOption, LabNode, LabState, ProductAnalysis } from './labTypes';

export interface LabMessage {
  tone: 'success' | 'error' | 'info';
  title: string;
  text: string;
}

export interface LabUiState {
  lab: LabState;
  history: LabState[];
  selectedId: string | null;
  /** Second node chosen for a connection, when there are several options to pick from. */
  pendingTarget: string | null;
  message: LabMessage | null;
}

const empty: LabState = { nodes: [], bonds: [], nextId: 1 };

export const labStore = createStore<LabUiState>({ lab: empty, history: [], selectedId: null, pendingTarget: null, message: null });

const MAX_HISTORY = 100;

function commit(next: LabState, patch: Partial<LabUiState> = {}) {
  labStore.set((st) => ({ ...st, lab: next, history: [...st.history.slice(-MAX_HISTORY + 1), st.lab], ...patch }));
}

/** Finds a free spot near the centre of the workspace, spiralling outward. */
function freeSpot(lab: LabState): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const r = 3.2 * Math.sqrt(i), a = i * 2.39996;
    const x = Math.round(r * Math.cos(a) * 10) / 10, y = Math.round(r * Math.sin(a) * 0.62 * 10) / 10;
    if (lab.nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 3.4)) return { x, y };
  }
  return { x: 0, y: 0 };
}

export const labActions = {
  add(kind: LabNode['kind'], ref: string, at?: { x: number; y: number }) {
    if (kind === 'atom' && !(ref in elements)) return;
    if (kind === 'block' && !buildingBlocks[ref]) return;
    const { lab } = labStore.get();
    const pos = at ?? freeSpot(lab);
    const node: LabNode = { id: `n${lab.nextId}`, kind, ref, x: pos.x, y: pos.y };
    const name = kind === 'atom' ? elements[ref as ElementSymbol].name : buildingBlocks[ref].name;
    commit({ ...lab, nodes: [...lab.nodes, node], nextId: lab.nextId + 1 }, {
      selectedId: node.id, pendingTarget: null,
      message: { tone: 'info', title: `Added ${name}`, text: 'Select another component to see what it can connect to.' },
    });
    return node.id;
  },

  move(id: string, x: number, y: number) {
    const { lab } = labStore.get();
    const n = nodeById(lab, id);
    if (!n || (Math.abs(n.x - x) < 1e-3 && Math.abs(n.y - y) < 1e-3)) return;
    commit({ ...lab, nodes: lab.nodes.map((m) => (m.id === id ? { ...m, x, y } : m)) });
  },

  remove(id: string) {
    const { lab, selectedId } = labStore.get();
    if (!nodeById(lab, id)) return;
    commit({ ...lab, nodes: lab.nodes.filter((n) => n.id !== id), bonds: lab.bonds.filter((b) => b.a !== id && b.b !== id) }, {
      selectedId: selectedId === id ? null : selectedId, pendingTarget: null,
      message: { tone: 'info', title: 'Removed component', text: 'Its bonds were removed too.' },
    });
  },

  select(id: string | null) {
    labStore.set((st) => ({ ...st, selectedId: id, pendingTarget: null }));
  },

  /**
   * Tries to connect the selected node to `targetId`. With exactly one option it is
   * applied; with several, the choice is left to the user (pendingTarget).
   */
  attempt(targetId: string): ConnectionOption[] | null {
    const { lab, selectedId } = labStore.get();
    if (!selectedId || selectedId === targetId) { labActions.select(targetId); return null; }
    const res = connectionOptions(lab, selectedId, targetId);
    if (!res.ok) {
      labStore.set((st) => ({ ...st, pendingTarget: null, message: { tone: 'error', title: 'These cannot be combined', text: res.reason } }));
      return null;
    }
    if (res.options.length === 1) { labActions.apply(selectedId, targetId, res.options[0]); return null; }
    labStore.set((st) => ({ ...st, pendingTarget: targetId, message: { tone: 'info', title: 'Choose a connection', text: 'More than one pair of groups can react. Pick one in the panel.' } }));
    return res.options;
  },

  apply(aId: string, bId: string, option: ConnectionOption) {
    const { lab } = labStore.get();
    const res = connectionOptions(lab, aId, bId);
    if (!res.ok || !res.options.some((o) => o.key === option.key)) return;
    let next: LabState;
    if (option.existingBondId) {
      next = { ...lab, bonds: lab.bonds.map((b) => (b.id === option.existingBondId ? { ...b, order: option.order! } : b)) };
    } else {
      next = {
        ...lab,
        bonds: [...lab.bonds, { id: `b${lab.nextId}`, a: aId, b: bId, siteA: option.siteA, siteB: option.siteB, type: option.bondType, order: option.order ?? 1, ruleId: option.ruleId }],
        nextId: lab.nextId + 1,
      };
    }
    const product = analyzeComponent(next, aId);
    commit(next, {
      selectedId: aId, pendingTarget: null,
      message: { tone: 'success', title: option.label, text: `Result: ${product.name}${product.formula ? ` — ${product.formula}` : ''}.` },
    });
    lastProduct = product;
    productListeners.forEach((l) => l(product));
  },

  undo() {
    labStore.set((st) => {
      if (!st.history.length) return st;
      const prev = st.history[st.history.length - 1];
      return {
        ...st, lab: prev, history: st.history.slice(0, -1), pendingTarget: null,
        selectedId: st.selectedId && nodeById(prev, st.selectedId) ? st.selectedId : null,
        message: { tone: 'info', title: 'Undone', text: 'The previous action was reverted.' },
      };
    });
  },

  reset() {
    const { lab } = labStore.get();
    if (!lab.nodes.length) return;
    commit(empty, { selectedId: null, pendingTarget: null, message: { tone: 'info', title: 'Workspace cleared', text: 'Undo restores it.' } });
  },

  dismissMessage() {
    labStore.set((st) => ({ ...st, message: null }));
  },
};

// Missions listen for newly formed products.
let lastProduct: ProductAnalysis | null = null;
const productListeners = new Set<(p: ProductAnalysis) => void>();
export function onLabProduct(listener: (p: ProductAnalysis) => void) {
  productListeners.add(listener);
  return () => { productListeners.delete(listener); };
}
export const getLastProduct = () => lastProduct;
