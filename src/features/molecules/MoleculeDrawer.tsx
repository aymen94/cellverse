import { useState } from 'react';
import { select } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { familyInfo, moleculeFamilies, moleculeList } from '../../data/molecules';
import { Tabs } from '../../components/ui';
import type { MoleculeFamily } from '../../types/science';

const REP_LABEL = { experimental: 'Experimental', computed: 'Computed 3D', idealized: 'Idealized', schematic: 'Educational model' } as const;

export function MoleculeDrawer() {
  const selection = useStore(appStore, (s) => s.selection);
  const initial = selection?.kind === 'molecule' ? moleculeList.find((m) => m.id === selection.id)!.family : 'protein';
  const [family, setFamily] = useState<MoleculeFamily>(initial);
  const info = familyInfo[family];
  return (
    <>
      <div className="drawer-head">
        <h2>Organic molecules</h2>
        <Tabs label="Molecule family" value={family} onChange={setFamily} options={moleculeFamilies.map((f) => ({ id: f.id, label: f.name }))} />
      </div>
      <div className="drawer-body">
        <p style={{ color: 'var(--text-dim)', maxWidth: 900 }}>{info.overview} <span style={{ color: 'var(--text-faint)' }}>Monomers: {info.monomers}. Linkage: {info.linkage}.</span></p>
        <div className="cards" style={{ marginBottom: 12 }}>
          {moleculeList.filter((m) => m.family === family).map((m) => (
            <button key={m.id} type="button" className="card" aria-pressed={selection?.kind === 'molecule' && selection.id === m.id} onClick={() => select({ kind: 'molecule', id: m.id })}>
              <span className="card-title">{m.name}</span>
              <span className="card-sub">{m.subtype}</span>
              <span className="card-meta">{m.formula ?? 'polymer'} · {REP_LABEL[m.representation]}</span>
            </button>
          ))}
        </div>
        <details>
          <summary style={{ cursor: 'pointer', color: 'var(--text-dim)' }}>Key concepts: {info.subtopics.map((t) => t.title).join(', ')}</summary>
          <div className="cards" style={{ marginTop: 8 }}>
            {info.subtopics.map((t) => (
              <div key={t.title} className="card" style={{ cursor: 'default' }}>
                <span className="card-title">{t.title}</span>
                <span className="card-sub">{t.text}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}
