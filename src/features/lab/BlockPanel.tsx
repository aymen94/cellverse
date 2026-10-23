import { FlaskConical } from 'lucide-react';
import { addSelectionToLab, select } from '../../app/actions';
import { blockCategories, buildingBlocks } from '../../data/lab';
import { References, Section } from '../../components/ui';
import { prettyFormula } from './formula';

export function BlockPanel({ id }: { id: string }) {
  const b = buildingBlocks[id];
  if (!b) return null;
  return (
    <>
      <div className="panel-title">
        <div>
          <h2>{b.name}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <span className="badge">Lab building block</span>
            <span className="badge">{blockCategories.find((c) => c.id === b.category)!.name}</span>
          </div>
        </div>
      </div>
      <div className="formula">{prettyFormula(b.formula, b.charge ?? 0)}</div>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={addSelectionToLab}><FlaskConical size={14} aria-hidden /> Add to laboratory</button>
        {b.moleculeId && <button type="button" className="btn small ghost" onClick={() => select({ kind: 'molecule', id: b.moleculeId! })}>Open in molecule explorer</button>}
      </div>
      <Section title="Description"><p>{b.description}</p></Section>
      <Section title="Connection sites modelled in the lab">
        <ul>{b.sites.map((s) => <li key={s.id}><span className="mono">{s.id}</span> — {s.label}</li>)}</ul>
        <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 6 }}>Each site can form one bond. Other reactive groups of the molecule are not modelled.</p>
      </Section>
      <References ids={b.references} />
    </>
  );
}
