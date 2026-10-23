import { ChevronRight, History } from 'lucide-react';
import type { ReactNode } from 'react';
import { select, toggle } from '../app/actions';
import { appStore, sameSelection, type Selection } from '../app/appStore';
import { useStore } from '../app/createStore';
import { elementCategories, elementList, elements } from '../data/elements';
import { buildingBlocks } from '../data/lab';
import { moleculeFamilies, moleculeList, molecules } from '../data/molecules';
import { organelleGroups, organelleList, organelles } from '../data/organelles';
import type { Organelle } from '../types/science';

function TreeSection({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="tree-section" open={open}>
      <summary>
        <ChevronRight className="chev" size={13} aria-hidden />
        {title}
      </summary>
      {children}
    </details>
  );
}

export function selectionLabel(sel: Selection): { title: string; meta: string } {
  switch (sel.kind) {
    case 'organelle': return { title: organelles[sel.id].name, meta: 'structure' };
    case 'element': return { title: `${elements[sel.id].name}`, meta: sel.id };
    case 'molecule': return { title: molecules[sel.id].name, meta: 'molecule' };
    case 'block': return { title: buildingBlocks[sel.id]?.name ?? sel.id, meta: 'block' };
  }
}

export function Sidebar() {
  const open = useStore(appStore, (s) => s.leftOpen);
  const selection = useStore(appStore, (s) => s.selection);
  const recent = useStore(appStore, (s) => s.recent);

  const item = (sel: Selection, content: ReactNode, key: string) => (
    <button
      key={key}
      type="button"
      className="tree-item"
      aria-current={sameSelection(selection, sel) ? 'true' : undefined}
      onClick={() => {
        select(sel, { focus: false });
        if (window.innerWidth < 1100) toggle('leftOpen');
      }}
    >
      {content}
    </button>
  );

  const organelleItem = (o: Organelle) => item({ kind: 'organelle', id: o.id }, <><span className="dot" style={{ background: o.color }} aria-hidden />{o.name}</>, o.id);
  const children = (id: string) => organelleList.filter((o) => o.parent === id);
  const renderOrganelle = (o: Organelle): ReactNode => {
    const kids = children(o.id);
    return (
      <div key={o.id}>
        {organelleItem(o)}
        {kids.length > 0 && <div className="tree-children">{kids.map(renderOrganelle)}</div>}
      </div>
    );
  };

  return (
    <>
      {open && <div className="scrim" onClick={() => toggle('leftOpen')} aria-hidden />}
      <aside className={`sidebar ${open ? '' : 'closed'}`} aria-label="Explorer" aria-hidden={!open}>
        <div className="sidebar-inner">
          <TreeSection title="Cell structures">
            {organelleGroups.map((g) => {
              const top = organelleList.filter((o) => o.group === g.id && !o.parent);
              if (!top.length) return null;
              return (
                <div key={g.id}>
                  <div className="tree-group-label">{g.name}</div>
                  {top.map(renderOrganelle)}
                </div>
              );
            })}
          </TreeSection>

          <TreeSection title="Chemical elements" open={false}>
            {elementCategories.map((c) => (
              <div key={c.id}>
                <div className="tree-group-label">{c.name}</div>
                {elementList.filter((e) => e.category === c.id).map((e) =>
                  item({ kind: 'element', id: e.symbol }, <><span className="sym">{e.symbol}</span>{e.name}<span className="meta">{e.atomicNumber}</span></>, e.symbol),
                )}
              </div>
            ))}
          </TreeSection>

          <TreeSection title="Molecular families" open={false}>
            {moleculeFamilies.map((f) => (
              <div key={f.id}>
                <div className="tree-group-label">{f.name}</div>
                {moleculeList.filter((m) => m.family === f.id).map((m) => item({ kind: 'molecule', id: m.id }, <>{m.name}</>, m.id))}
              </div>
            ))}
          </TreeSection>

          <TreeSection title="Recently inspected">
            {recent.length === 0 && <div className="tree-group-label">Nothing yet. Selections appear here.</div>}
            {recent.map((r) => {
              const l = selectionLabel(r);
              return item(r, <><History size={13} aria-hidden />{l.title}<span className="meta">{l.meta}</span></>, `${r.kind}-${r.id}`);
            })}
          </TreeSection>
        </div>
      </aside>
    </>
  );
}
