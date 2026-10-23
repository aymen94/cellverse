import { AlertTriangle, ExternalLink, FlaskConical } from 'lucide-react';
import { addSelectionToLab } from '../../app/actions';
import { elementCategories, elements, essentialityInfo, pubchemElementUrl } from '../../data/elements';
import { OrganelleChip, References, Section } from '../../components/ui';
import type { ElementSymbol, Essentiality } from '../../types/science';

const ESS_TONE: Record<Essentiality, string> = {
  universal: 'accent', essential: 'green', 'essential-trace': 'green', 'species-dependent': 'violet', uncertain: 'warn', 'none-established': '',
};

export function EssentialityBadge({ value }: { value: Essentiality }) {
  return <span className={`badge ${ESS_TONE[value]}`}>{essentialityInfo[value].short}</span>;
}

export function ElementPanel({ symbol }: { symbol: ElementSymbol }) {
  const e = elements[symbol];
  const cat = elementCategories.find((c) => c.id === e.category)!;
  return (
    <>
      <div className="panel-title">
        <div className="element-tile" style={{ borderColor: e.color }}>
          <span className="z">{e.atomicNumber}</span>
          <span className="s">{e.symbol}</span>
        </div>
        <div>
          <h2>{e.name}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="badge">{cat.badge} · {cat.name}</span>
            <EssentialityBadge value={e.essentiality} />
          </div>
        </div>
      </div>

      <dl className="kv">
        <dt>Atomic number</dt><dd className="mono">{e.atomicNumber}</dd>
        <dt>Atomic mass</dt><dd className="mono">{e.atomicMass} u</dd>
        <dt>Period / group</dt><dd className="mono">{e.period} / {e.group}</dd>
      </dl>

      <div style={{ display: 'flex', gap: 8, margin: '14px 0 0', flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={addSelectionToLab}>
          <FlaskConical size={14} aria-hidden /> Add to laboratory
        </button>
        <a className="btn small ghost" href={pubchemElementUrl(e.atomicNumber)} target="_blank" rel="noreferrer noopener">
          PubChem <ExternalLink size={12} aria-hidden />
        </a>
      </div>

      <Section title="Essentiality">
        <p><strong>{essentialityInfo[e.essentiality].label}.</strong> {e.essentialityNote}</p>
      </Section>
      <Section title="Biological role">
        <p>{e.biologicalRole}</p>
      </Section>
      <Section title="Typical biological form">
        <ul>{e.forms.map((f) => <li key={f}>{f}</li>)}</ul>
      </Section>
      <Section title="Cellular locations & associations">
        <ul>{e.locations.map((l) => <li key={l}>{l}</li>)}</ul>
      </Section>
      <Section title="Example biomolecules & processes">
        <ul>{e.examples.map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>
      <Section title="Highlighted in the cell">
        {e.organelles.length ? (
          <>
            <div className="chips">{e.organelles.map((o) => <OrganelleChip key={o} id={o} />)}</div>
            <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-dim)' }}>
              These structures glow in the 3D cell. The element is present there in compounds or as ions — not as free atoms.
            </p>
          </>
        ) : (
          <p style={{ color: 'var(--text-dim)' }}>No specific structure of this animal-cell model is associated with this element.</p>
        )}
      </Section>
      {e.caveats && (
        <Section title="Caveats">
          <div className="note warn"><AlertTriangle size={14} aria-hidden /><div>{e.caveats}</div></div>
        </Section>
      )}
      <References ids={e.references} />
    </>
  );
}
