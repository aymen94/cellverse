import { ExternalLink, FlaskConical, Info, Microscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addSelectionToLab, labTargetFor, setSection } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { familyInfo, molecules } from '../../data/molecules';
import { loadStructure, type StructureSource } from '../../data/structures';
import { ElementChip, OrganelleChip, References, Section } from '../../components/ui';
import type { MoleculeId, RepresentationKind } from '../../types/science';

const REP: Record<RepresentationKind, { label: string; tone: string }> = {
  experimental: { label: 'Experimental structure', tone: 'green' },
  computed: { label: 'Computed conformer', tone: 'accent' },
  idealized: { label: 'Idealized coordinates', tone: 'accent' },
  schematic: { label: 'Educational model', tone: 'warn' },
};

export function MoleculePanel({ id }: { id: MoleculeId }) {
  const m = molecules[id];
  const family = familyInfo[m.family];
  const view = useStore(appStore, (s) => s.moleculeView);
  const stage = useStore(appStore, (s) => s.stage);
  const [source, setSource] = useState<StructureSource | null>(null);
  const hasAtoms = m.structure.type === 'file';
  const labTarget = labTargetFor({ kind: 'molecule', id });

  useEffect(() => {
    setSource(null);
    if (m.structure.type === 'file') loadStructure(m.structure.key).then((d) => setSource(d.source)).catch(() => setSource(null));
  }, [m]);

  const setView = (patch: Partial<typeof view>) => appStore.set((s) => ({ ...s, moleculeView: { ...s.moleculeView, ...patch } }));

  return (
    <>
      <div className="panel-title">
        <div>
          <h2>{m.name}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="badge">{family.name}</span>
            <span className="badge">{m.subtype}</span>
          </div>
        </div>
      </div>

      {m.formula && <div className="formula" aria-label={`Molecular formula ${m.formula}`}>{m.formula}</div>}
      {m.formulaNote && <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 4 }}>{m.formulaNote}</p>}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 4px', flexWrap: 'wrap' }}>
        {stage !== 'molecule' && (
          <button type="button" className="btn small" onClick={() => appStore.set((s) => ({ ...s, stage: 'molecule', section: s.section === 'lab' ? 'molecules' : s.section }))}>
            <Microscope size={14} aria-hidden /> View in 3D
          </button>
        )}
        {stage === 'molecule' && (
          <button type="button" className="btn small" onClick={() => setSection('explorer')}>Back to the cell</button>
        )}
        {labTarget && (
          <button type="button" className="btn small" onClick={addSelectionToLab}>
            <FlaskConical size={14} aria-hidden /> Add to laboratory
          </button>
        )}
      </div>

      <Section title="3D representation">
        <div className={`note ${m.representation === 'schematic' ? 'warn' : 'info'}`}>
          <Info size={14} aria-hidden />
          <div>
            <strong>{REP[m.representation].label}.</strong> {m.representationNote}
            {source && (
              <div style={{ marginTop: 4 }}>
                Source: <a href={source.url} target="_blank" rel="noreferrer noopener">{source.db} {source.id} <ExternalLink size={11} aria-hidden /></a>
              </div>
            )}
          </div>
        </div>
        {hasAtoms && stage === 'molecule' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="sr-only" htmlFor="mol-style">Display style</label>
            <select id="mol-style" className="input" style={{ width: 'auto' }} value={view.style} onChange={(e) => setView({ style: e.target.value as typeof view.style })}>
              <option value="ball-stick">Ball and stick</option>
              <option value="spacefill">Space-filling</option>
            </select>
            <label className="chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={view.hydrogens} onChange={(e) => setView({ hydrogens: e.target.checked })} /> Show hydrogens
            </label>
          </div>
        )}
      </Section>

      <Section title="Explanation">
        <p className="lead">{m.explanation}</p>
        {m.details.map((d) => <p key={d.slice(0, 30)} style={{ color: 'var(--text-dim)' }}>{d}</p>)}
      </Section>

      <Section title="Composition">
        <dl className="kv">
          <dt>Building blocks</dt><dd>{m.buildingBlocks}</dd>
          <dt>Chemical bonds</dt><dd>{m.bonds}</dd>
          <dt>Main function</dt><dd>{m.function}</dd>
          <dt>Location</dt><dd>{m.location}</dd>
          {m.organisms && (<><dt>Organisms</dt><dd>{m.organisms}</dd></>)}
        </dl>
      </Section>

      {m.organelles.length > 0 && (
        <Section title="Where in the cell">
          <div className="chips">{m.organelles.map((o) => <OrganelleChip key={o} id={o} />)}</div>
        </Section>
      )}

      <Section title="Chemical elements">
        <div className="chips">{m.elements.map((e) => <ElementChip key={e} symbol={e} />)}</div>
      </Section>

      <Section title={`About ${family.name.toLowerCase()}`}>
        <p style={{ color: 'var(--text-dim)' }}>{family.overview}</p>
        <dl className="kv">
          <dt>Monomers</dt><dd>{family.monomers}</dd>
          <dt>Linkage</dt><dd>{family.linkage}</dd>
        </dl>
      </Section>

      <References ids={[...m.references, ...family.references]} />
    </>
  );
}
