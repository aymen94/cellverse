import { CheckCircle2, Flag, Lightbulb, Play, RotateCcw, Target, X } from 'lucide-react';
import { useState } from 'react';
import { focusOrganelle, setSection } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { missions } from '../../data/missions';
import { isOrganelleId } from '../../data/organelles';
import { isMoleculeId } from '../../data/molecules';
import { isElementSymbol } from '../../data/elements';
import type { MissionStep } from '../../types/science';
import { missionById, startMission, stopMission } from './missionEngine';

function assist(step: MissionStep) {
  const a = step.assist;
  if (!a) return;
  // "Show me" points the way (camera or explorer) and leaves the selection to the learner.
  if (a.kind === 'organelle' && a.id && isOrganelleId(a.id)) focusOrganelle(a.id);
  else if (a.kind === 'molecule' && a.id && isMoleculeId(a.id)) setSection('molecules');
  else if (a.kind === 'element' && a.id && isElementSymbol(a.id)) setSection('elements');
  else if (a.kind === 'lab') setSection('lab');
}

export function MissionsDrawer() {
  const state = useStore(appStore, (s) => s.missions);
  return (
    <>
      <div className="drawer-head">
        <h2>Guided missions</h2>
        <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>Short activities that use the same 3D cell, molecules and lab.</span>
      </div>
      <div className="drawer-body">
        <div className="mission-list">
          {missions.map((m) => {
            const p = state.progress[m.id];
            const active = state.activeId === m.id;
            return (
              <div className="mission-card" key={m.id} style={active ? { borderColor: 'var(--accent)' } : undefined}>
                <h4>{p?.done ? <CheckCircle2 size={16} color="var(--green)" aria-label="Completed" /> : <Flag size={15} aria-hidden />}{m.title}</h4>
                <p>{m.summary}</p>
                <p style={{ color: 'var(--text-faint)' }}>{m.steps.length} steps{p && !p.done ? ` · step ${p.step + 1} of ${m.steps.length}` : ''}{p?.done ? ' · completed' : ''}</p>
                <div className="row">
                  {active && !p?.done ? (
                    <button type="button" className="btn small" onClick={stopMission}><X size={13} aria-hidden /> Stop</button>
                  ) : (
                    <button type="button" className="btn small primary" onClick={() => startMission(m.id)}>
                      {p ? <RotateCcw size={13} aria-hidden /> : <Play size={13} aria-hidden />} {p ? 'Restart' : 'Start'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Floating card showing the active mission's current objective. */
export function MissionTracker() {
  const state = useStore(appStore, (s) => s.missions);
  const [hint, setHint] = useState(false);
  const mission = state.activeId ? missionById(state.activeId) : undefined;
  if (!mission) return null;
  const p = state.progress[mission.id] ?? { step: 0, done: false, collected: [] };
  const step = mission.steps[p.step];
  return (
    <section className="glass mission-tracker" aria-label={`Mission: ${mission.title}`} aria-live="polite">
      <h3>
        {p.done ? <CheckCircle2 size={16} color="var(--green)" aria-hidden /> : <Target size={15} color="var(--accent)" aria-hidden />}
        <span style={{ flex: 1 }}>{mission.title}</span>
        <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} aria-label="Close mission" onClick={stopMission}><X size={14} /></button>
      </h3>
      <div className="steps-dots" aria-hidden>
        {mission.steps.map((s, i) => <i key={s.id} className={p.done || i < p.step ? 'done' : i === p.step ? 'current' : ''} />)}
      </div>
      {p.done ? (
        <div className="note success"><CheckCircle2 size={14} aria-hidden /><div><strong>Mission complete.</strong> {mission.completion}</div></div>
      ) : (
        <>
          <div style={{ fontSize: 13.5 }}><span style={{ color: 'var(--text-faint)' }}>Step {p.step + 1}/{mission.steps.length}: </span>{step.objective}</div>
          {step.condition.type === 'select-all' && (
            <div className="chips" style={{ marginTop: 6 }}>
              {step.condition.ids.map((id) => (
                <span key={id} className="chip" style={p.collected.includes(id) ? { borderColor: 'var(--green)', color: 'var(--green)' } : undefined}>
                  {p.collected.includes(id) && <CheckCircle2 size={12} aria-label="found" />}{id}
                </span>
              ))}
            </div>
          )}
          {hint && <div className="note info" style={{ marginTop: 8 }}><Lightbulb size={14} aria-hidden /><div>{step.hint}</div></div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" className="btn small ghost" onClick={() => setHint((h) => !h)} aria-expanded={hint}><Lightbulb size={13} aria-hidden /> {hint ? 'Hide hint' : 'Hint'}</button>
            {step.assist && <button type="button" className="btn small" onClick={() => assist(step)}>Show me</button>}
          </div>
        </>
      )}
    </section>
  );
}
