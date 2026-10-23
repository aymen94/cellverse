import { createStore } from './createStore';
import type { ElementSymbol, MoleculeId, OrganelleId } from '../types/science';
import type { NavMode, StageId, ViewStyle } from '../engine/types';

export type Section = 'explorer' | 'organelles' | 'elements' | 'molecules' | 'lab' | 'missions';

export type Selection =
  | { kind: 'organelle'; id: OrganelleId; instance?: number }
  | { kind: 'element'; id: ElementSymbol }
  | { kind: 'molecule'; id: MoleculeId }
  | { kind: 'block'; id: string };

export interface Settings {
  motion: 'system' | 'reduce' | 'full';
  quality: 'high' | 'balanced' | 'low';
  debug: boolean;
  animate: boolean;
}

export interface MissionProgress {
  step: number;
  done: boolean;
  collected: string[];
}

export interface AppState {
  section: Section;
  drawerOpen: boolean;
  stage: StageId;
  selection: Selection | null;
  back: Selection[];
  recent: Selection[];
  navMode: NavMode;
  labels: boolean;
  annotations: boolean;
  viewStyle: ViewStyle;
  leftOpen: boolean;
  rightOpen: boolean;
  searchOpen: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  settings: Settings;
  engine: { status: 'loading' | 'ready' | 'error'; backend?: string; error?: string; progress?: string };
  missions: { activeId: string | null; progress: Record<string, MissionProgress> };
  moleculeView: { style: 'ball-stick' | 'spacefill'; hydrogens: boolean };
  toast: { id: number; text: string; tone: 'info' | 'success' } | null;
}

const SETTINGS_KEY = 'cellverse.settings.v1';
const MISSIONS_KEY = 'cellverse.missions.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const wide = typeof window !== 'undefined' ? window.innerWidth >= 1100 : true;

export const appStore = createStore<AppState>({
  section: 'explorer',
  drawerOpen: false,
  stage: 'cell',
  selection: null,
  back: [],
  recent: [],
  navMode: 'exterior',
  labels: true,
  annotations: true,
  viewStyle: 'standard',
  leftOpen: wide,
  rightOpen: wide,
  searchOpen: false,
  helpOpen: false,
  settingsOpen: false,
  settings: load<Settings>(SETTINGS_KEY, { motion: 'system', quality: 'high', debug: new URLSearchParams(location.search).has('debug'), animate: true }),
  engine: { status: 'loading' },
  missions: load(MISSIONS_KEY, { activeId: null, progress: {} }),
  moleculeView: { style: 'ball-stick', hydrogens: true },
  toast: null,
});

appStore.subscribe(() => {
  const s = appStore.get();
  save(SETTINGS_KEY, s.settings);
  save(MISSIONS_KEY, s.missions);
});

export const sameSelection = (a: Selection | null, b: Selection | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;

export function prefersReducedMotion(): boolean {
  const m = appStore.get().settings.motion;
  if (m !== 'system') return m === 'reduce';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let toastId = 0;
export function showToast(text: string, tone: 'info' | 'success' = 'info') {
  const id = ++toastId;
  appStore.set((s) => ({ ...s, toast: { id, text, tone } }));
  setTimeout(() => appStore.set((s) => (s.toast?.id === id ? { ...s, toast: null } : s)), 5000);
}
