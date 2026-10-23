// User-level actions. They update the stores and ask the engine to act through the
// SceneController interface.

import { appStore, prefersReducedMotion, sameSelection, showToast, type Section, type Selection } from './appStore';
import { engine } from '../engine/engineHandle';
import { buildingBlockList } from '../data/lab';
import { dispatchMissionEvent } from '../features/missions/missionEngine';
import { labActions } from '../features/lab/labStore';
import type { OrganelleId } from '../types/science';

const MAX_RECENT = 8;

export function select(sel: Selection, opts: { focus?: boolean } = {}) {
  appStore.set((s) => {
    const changed = !sameSelection(s.selection, sel) || (sel.kind === 'organelle' && s.selection?.kind === 'organelle' && s.selection.instance !== sel.instance);
    const back = changed && s.selection && !sameSelection(s.selection, sel) ? [...s.back, s.selection].slice(-20) : s.back;
    const recent = [sel, ...s.recent.filter((r) => !sameSelection(r, sel))].slice(0, MAX_RECENT);
    let { stage, section, drawerOpen } = s;
    if (sel.kind === 'organelle') {
      stage = 'cell';
      if (section === 'lab' || section === 'molecules') { section = 'explorer'; drawerOpen = false; }
    } else if (sel.kind === 'molecule') {
      stage = 'molecule';
      if (section === 'lab') { section = 'molecules'; }
    }
    const narrow = window.innerWidth < 900;
    return { ...s, selection: sel, back, recent, stage, section, drawerOpen: narrow ? false : drawerOpen, rightOpen: true };
  });
  dispatchMissionEvent({ type: 'select', kind: sel.kind, id: sel.id });
  if (opts.focus && sel.kind === 'organelle') focusOrganelle(sel.id, sel.instance);
}

export function goBack() {
  const { back } = appStore.get();
  const prev = back[back.length - 1];
  if (!prev) return;
  const rest = back.slice(0, -1);
  select(prev);
  // select() pushed the current item; going back should not.
  appStore.set((s) => ({ ...s, back: rest }));
}

export function clearSelection() {
  appStore.set((s) => ({ ...s, selection: null, back: s.selection ? [...s.back, s.selection].slice(-20) : s.back }));
}

export function setSection(section: Section) {
  const s = appStore.get();
  const toggleOff = s.section === section && s.drawerOpen && section !== 'explorer';
  appStore.set((st) => {
    let stage = st.stage;
    if (section === 'explorer' || section === 'organelles' || section === 'elements') stage = 'cell';
    if (section === 'lab') stage = 'lab';
    if (section === 'molecules') stage = st.selection?.kind === 'molecule' ? 'molecule' : st.stage === 'lab' ? 'cell' : st.stage;
    return { ...st, section, stage, drawerOpen: section === 'explorer' ? false : !toggleOff };
  });
  if (section === 'lab') dispatchMissionEvent({ type: 'open-lab' });
}

export function focusOrganelle(id: OrganelleId, instance?: number) {
  appStore.set((s) => ({ ...s, stage: 'cell', section: s.section === 'lab' || s.section === 'molecules' ? 'explorer' : s.section }));
  engine.get()?.focusOrganelle(id, instance);
  appStore.set((s) => ({ ...s, navMode: 'closeup' }));
  dispatchMissionEvent({ type: 'focus', id });
}

export function inspectSelection() {
  const sel = appStore.get().selection;
  if (sel?.kind === 'organelle') focusOrganelle(sel.id, sel.instance);
  else if (sel) showToast('Close-up inspection applies to cell structures. Select one in the 3D view or sidebar.');
}

export function toggleCell() {
  const { navMode, stage } = appStore.get();
  if (stage !== 'cell') appStore.set((s) => ({ ...s, stage: 'cell', section: s.section === 'lab' || s.section === 'molecules' ? 'explorer' : s.section }));
  if (navMode === 'exterior' || stage !== 'cell') engine.get()?.enterCell();
  else engine.get()?.exitCell();
}

export function resetView() {
  engine.get()?.resetView();
}

export function zoom(factor: number) {
  engine.get()?.zoom(factor);
}

export function setNavMode(mode: 'exterior' | 'interior' | 'closeup') {
  appStore.set((s) => ({ ...s, navMode: mode }));
  dispatchMissionEvent({ type: 'nav-mode', mode });
}

/** The lab building block matching the current selection, if any. */
export function labTargetFor(sel: Selection | null): { kind: 'atom' | 'block'; ref: string; name: string } | null {
  if (!sel) return null;
  if (sel.kind === 'element') return { kind: 'atom', ref: sel.id, name: sel.id };
  if (sel.kind === 'block') return { kind: 'block', ref: sel.id, name: sel.id };
  if (sel.kind === 'molecule') {
    const b = buildingBlockList.find((x) => x.moleculeId === sel.id);
    return b ? { kind: 'block', ref: b.id, name: b.name } : null;
  }
  return null;
}

export function addSelectionToLab() {
  const target = labTargetFor(appStore.get().selection);
  if (!target) {
    showToast('Select an element, a building block, or a small molecule that has a lab building block.');
    return;
  }
  labActions.add(target.kind, target.ref);
  setSection('lab');
}

export function toggle(key: 'labels' | 'annotations' | 'leftOpen' | 'rightOpen') {
  appStore.set((s) => ({ ...s, [key]: !s[key] }));
}

export function toggleViewStyle() {
  appStore.set((s) => ({ ...s, viewStyle: s.viewStyle === 'standard' ? 'cutaway' : 'standard' }));
}

export function openDialog(which: 'searchOpen' | 'helpOpen' | 'settingsOpen', open = true) {
  appStore.set((s) => ({ ...s, searchOpen: false, helpOpen: false, settingsOpen: false, [which]: open }));
}

export const reducedMotion = prefersReducedMotion;
