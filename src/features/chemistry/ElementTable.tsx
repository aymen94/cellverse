import { useMemo, useState } from 'react';
import { select } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { elementCategories, elementList, essentialityInfo } from '../../data/elements';
import type { ElementCategory, Essentiality } from '../../types/science';

const CAT_BAR: Record<ElementCategory, string> = { major: '#22d3ee', 'ion-mineral': '#4ade80', additional: '#a78bfa' };

/** Periodic-table-inspired selector for the 30 elements, with search and filters. */
export function ElementTable() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ElementCategory | 'all'>('all');
  const [ess, setEss] = useState<Essentiality | 'all'>('all');
  const selection = useStore(appStore, (s) => s.selection);
  const [narrow] = useState(() => window.innerWidth < 700);
  const [view, setView] = useState<'table' | 'list'>(narrow ? 'list' : 'table');

  const query = q.trim().toLowerCase();
  const matches = useMemo(() => new Set(elementList.filter((e) =>
    (cat === 'all' || e.category === cat) &&
    (ess === 'all' || e.essentiality === ess) &&
    (!query || e.name.toLowerCase().includes(query) || e.symbol.toLowerCase() === query || e.biologicalRole.toLowerCase().includes(query)),
  ).map((e) => e.symbol)), [cat, ess, query]);

  const cells = [];
  for (let period = 1; period <= 5; period++) {
    for (let group = 1; group <= 18; group++) {
      const e = elementList.find((x) => x.period === period && x.group === group);
      if (!e) { cells.push(<div key={`${period}-${group}`} className="pgap" aria-hidden />); continue; }
      const cinfo = elementCategories.find((c) => c.id === e.category)!;
      const pressed = selection?.kind === 'element' && selection.id === e.symbol;
      cells.push(
        <button
          key={e.symbol}
          type="button"
          className={`pcell ess-${e.essentiality} ${matches.has(e.symbol) ? '' : 'dim'}`}
          aria-pressed={pressed}
          aria-label={`${e.name}, ${e.symbol}, atomic number ${e.atomicNumber}. ${cinfo.name}. ${essentialityInfo[e.essentiality].label}.`}
          onClick={() => select({ kind: 'element', id: e.symbol })}
          title={`${e.name} — ${essentialityInfo[e.essentiality].label}`}
        >
          <span className="bar" style={{ background: CAT_BAR[e.category] }} aria-hidden />
          <span className="z">{e.atomicNumber}</span>
          <span className="cat" aria-hidden>{cinfo.badge}</span>
          <span className="s">{e.symbol}</span>
          <span className="n">{e.name}</span>
        </button>,
      );
    }
  }

  return (
    <>
      <div className="drawer-head">
        <h2>Essential elements of life</h2>
        <input className="input" style={{ width: 200 }} placeholder="Search elements or roles…" aria-label="Search elements" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by category">
          <button type="button" className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All 30</button>
          {elementCategories.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              <span className="dot" style={{ background: CAT_BAR[c.id] }} aria-hidden />{c.name}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="ess-filter">Filter by essentiality</label>
        <select id="ess-filter" className="input" style={{ width: 'auto' }} value={ess} onChange={(e) => setEss(e.target.value as Essentiality | 'all')}>
          <option value="all">Any essentiality</option>
          {(Object.keys(essentialityInfo) as Essentiality[]).map((k) => <option key={k} value={k}>{essentialityInfo[k].label}</option>)}
        </select>
        <span className="grow" />
        <div className="tabs" role="tablist" aria-label="Layout">
          <button type="button" role="tab" className="tab" aria-selected={view === 'table'} onClick={() => setView('table')}>Table</button>
          <button type="button" role="tab" className="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
      </div>
      <div className="drawer-body">
        {view === 'table' ? (
          <div style={{ overflowX: 'auto' }}><div className="ptable">{cells}</div></div>
        ) : (
          <div className="elist">
            {elementList.filter((e) => matches.has(e.symbol)).map((e) => (
              <button key={e.symbol} type="button" className="tree-item" style={{ border: '1px solid var(--border)' }} aria-current={selection?.kind === 'element' && selection.id === e.symbol ? 'true' : undefined} onClick={() => select({ kind: 'element', id: e.symbol })}>
                <span className="sym">{e.symbol}</span>{e.name}<span className="meta">{essentialityInfo[e.essentiality].short}</span>
              </button>
            ))}
          </div>
        )}
        <div className="legend" aria-label="Legend">
          {elementCategories.map((c) => <span key={c.id}><span className="sw" style={{ background: CAT_BAR[c.id], borderColor: CAT_BAR[c.id] }} />{c.badge} = {c.name}</span>)}
          <span><span className="sw" />solid: universal/essential</span>
          <span><span className="sw" style={{ borderBottomWidth: 3 }} />thick base: trace essential</span>
          <span><span className="sw" style={{ borderStyle: 'dashed' }} />dashed: species-dependent</span>
          <span><span className="sw" style={{ borderStyle: 'dotted', borderWidth: 2 }} />dotted: uncertain / no established role</span>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-faint)' }}>
          An educational selection of 30 elements found in organisms — not a claim that each is essential to every organism. Atomic weights: IUPAC abridged standard values.
        </p>
      </div>
    </>
  );
}
