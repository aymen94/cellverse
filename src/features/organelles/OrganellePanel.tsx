import { Info, Microscope } from 'lucide-react';
import { useState } from 'react';
import { focusOrganelle, select } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { organelles } from '../../data/organelles';
import { ElementChip, MoleculeChip, References, Section, Tabs } from '../../components/ui';
import type { OrganelleId } from '../../types/science';

export function OrganellePanel({ id }: { id: OrganelleId }) {
  const o = organelles[id];
  const [tab, setTab] = useState<'overview' | 'details'>('overview');
  const annotations = useStore(appStore, (s) => s.annotations);
  const parent = o.parent ? organelles[o.parent] : null;

  return (
    <>
      <div className="panel-title">
        <span className="swatch" style={{ background: o.color }} aria-hidden />
        <div>
          <h2>{o.name}</h2>
          {o.scientificName && o.scientificName !== o.name && <div className="sci">{o.scientificName}</div>}
          {parent && (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
              Part of{' '}
              <button type="button" className="btn ghost small" onClick={() => select({ kind: 'organelle', id: parent.id })}>{parent.name}</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={() => focusOrganelle(id)}>
          <Microscope size={14} aria-hidden /> Inspect in 3D
        </button>
      </div>

      <Tabs label="Information level" value={tab} onChange={setTab} options={[{ id: 'overview', label: 'Quick overview' }, { id: 'details', label: 'Scientific details' }]} />

      {tab === 'overview' ? (
        <>
          <Section title="In brief">
            <p className="lead">{o.summary}</p>
          </Section>
          <Section title="Main function">
            <p>{o.function}</p>
          </Section>
          <Section title="Typical size">
            <p>{o.size}</p>
          </Section>
          <Section title="Did you know?">
            <ul className="facts">{o.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </Section>
        </>
      ) : (
        <>
          <Section title="Scientific details">
            {o.details.map((d) => <p key={d.slice(0, 32)}>{d}</p>)}
          </Section>
          <Section title="Structure & composition">
            <p>{o.structure}</p>
          </Section>
          <Section title="Biological processes">
            <ul>{o.processes.map((p) => <li key={p}>{p}</li>)}</ul>
          </Section>
        </>
      )}

      <Section title="Relationships with other structures">
        <div className="rel">
          {o.relationships.map((r) => (
            <div className="rel-item" key={r.id}>
              <button type="button" className="chip" onClick={() => select({ kind: 'organelle', id: r.id })}>
                <span className="dot" style={{ background: organelles[r.id].color }} aria-hidden />
                {organelles[r.id].name}
              </button>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      </Section>

      {(o.molecules.length > 0 || o.moleculeNotes.length > 0) && (
        <Section title="Relevant molecules">
          <div className="chips">{o.molecules.map((m) => <MoleculeChip key={m} id={m} />)}</div>
          {o.moleculeNotes.length > 0 && <p style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: 13 }}>Also: {o.moleculeNotes.join('; ')}.</p>}
        </Section>
      )}

      <Section title="Relevant chemical elements">
        <div className="chips">{o.elements.map((e) => <ElementChip key={e} symbol={e} />)}</div>
      </Section>

      {annotations && (
        <Section title="Model simplifications">
          <div className="note warn">
            <Info size={14} aria-hidden />
            <div>{o.simplifications.join(' ')}</div>
          </div>
        </Section>
      )}

      <References ids={o.references} />
    </>
  );
}
