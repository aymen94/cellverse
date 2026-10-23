import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { select } from '../app/actions';
import { elements } from '../data/elements';
import { molecules } from '../data/molecules';
import { organelles } from '../data/organelles';
import { references } from '../data/references';
import type { ElementSymbol, MoleculeId, OrganelleId } from '../types/science';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function OrganelleChip({ id }: { id: OrganelleId }) {
  const o = organelles[id];
  return (
    <button type="button" className="chip" onClick={() => select({ kind: 'organelle', id })} aria-label={`Show ${o.name}`}>
      <span className="dot" style={{ background: o.color }} aria-hidden />
      {o.name}
    </button>
  );
}

export function ElementChip({ symbol }: { symbol: ElementSymbol }) {
  const e = elements[symbol];
  return (
    <button type="button" className="chip" onClick={() => select({ kind: 'element', id: symbol })} aria-label={`Show element ${e.name}`}>
      <span className="mono" style={{ fontWeight: 700 }}>{symbol}</span>
      <span style={{ color: 'var(--text-dim)' }}>{e.name}</span>
    </button>
  );
}

export function MoleculeChip({ id }: { id: MoleculeId }) {
  const m = molecules[id];
  return (
    <button type="button" className="chip" onClick={() => select({ kind: 'molecule', id })} aria-label={`Show molecule ${m.name}`}>
      {m.name}
    </button>
  );
}

export function References({ ids }: { ids: string[] }) {
  const list = [...new Set(ids)].map((id) => references[id]).filter(Boolean);
  if (!list.length) return null;
  return (
    <Section title="References">
      <ul className="refs">
        {list.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer noopener">
              {r.title} <ExternalLink size={11} aria-hidden style={{ verticalAlign: -1 }} />
            </a>
            <div className="src">
              {[r.authors, r.source, r.year, r.identifier].filter(Boolean).join(' · ')}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" className="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
