// Tracks progress through guided missions by listening to app events.

import { appStore, showToast, type MissionProgress } from '../../app/appStore';
import { missions } from '../../data/missions';
import type { MissionCondition } from '../../types/science';

export type MissionEvent =
  | { type: 'select'; kind: 'organelle' | 'element' | 'molecule' | 'block'; id: string }
  | { type: 'nav-mode'; mode: string }
  | { type: 'focus'; id: string }
  | { type: 'open-lab' }
  | { type: 'lab-product'; productClass: string; units: number };

export const missionById = (id: string) => missions.find((m) => m.id === id);

function matches(c: MissionCondition, e: MissionEvent, progress: MissionProgress): { done: boolean; collected?: string[] } {
  switch (c.type) {
    case 'select':
      return { done: e.type === 'select' && e.kind === c.kind && e.id === c.id };
    case 'select-all': {
      if (e.type !== 'select' || e.kind !== c.kind || !c.ids.includes(e.id)) return { done: false };
      const collected = [...new Set([...progress.collected, e.id])];
      return { done: c.ids.every((id) => collected.includes(id)), collected };
    }
    case 'nav-mode':
      return { done: e.type === 'nav-mode' && e.mode === c.mode };
    case 'focus':
      return { done: e.type === 'focus' && e.id === c.id };
    case 'open-lab':
      return { done: e.type === 'open-lab' };
    case 'lab-product':
      return { done: e.type === 'lab-product' && e.productClass === c.productClass && e.units >= (c.minUnits ?? 1) };
  }
}

export function dispatchMissionEvent(e: MissionEvent) {
  const { missions: state } = appStore.get();
  const id = state.activeId;
  if (!id) return;
  const mission = missionById(id);
  const progress = state.progress[id] ?? { step: 0, done: false, collected: [] };
  if (!mission || progress.done) return;
  const step = mission.steps[progress.step];
  if (!step) return;
  const res = matches(step.condition, e, progress);
  let next: MissionProgress = { ...progress, collected: res.collected ?? progress.collected };
  if (res.done) {
    const stepIndex = progress.step + 1;
    const done = stepIndex >= mission.steps.length;
    next = { step: done ? progress.step : stepIndex, done, collected: [] };
    showToast(done ? `Mission complete: ${mission.title}` : `Objective complete — ${mission.steps[stepIndex].objective}`, 'success');
  }
  appStore.set((s) => ({ ...s, missions: { ...s.missions, progress: { ...s.missions.progress, [id]: next } } }));
}

export function startMission(id: string) {
  appStore.set((s) => ({
    ...s,
    missions: { activeId: id, progress: { ...s.missions.progress, [id]: { step: 0, done: false, collected: [] } } },
  }));
  const m = missionById(id);
  if (m) showToast(`Mission started: ${m.title}`);
  // Some objectives may already be satisfied by the current state.
  const { navMode, section } = appStore.get();
  if (navMode !== 'exterior') dispatchMissionEvent({ type: 'nav-mode', mode: navMode });
  if (section === 'lab') dispatchMissionEvent({ type: 'open-lab' });
}

export function stopMission() {
  appStore.set((s) => ({ ...s, missions: { ...s.missions, activeId: null } }));
}
