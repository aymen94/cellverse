import { RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../../app/createStore';
import { elementCategories, elementList } from '../../data/elements';
import { blockCategories, buildingBlockList } from '../../data/lab';
import { Tabs } from '../../components/ui';
import { labActions, labStore } from './labStore';

export const DRAG_MIME = 'application/x-cellverse-lab';

const CATEGORY_COLORS: Record<string, string> = {
  'amino-acid': '#f59e0b', monosaccharide: '#38bdf8', 'lipid-component': '#fb923c', 'nucleotide-component': '#a78bfa', nucleotide: '#c084fc',
};

/** Dark or light text, whichever reads better on `hex`. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#06111f' : '#ffffff';
}

function PaletteItem({ kind, refId, sym, name, color }: { kind: 'atom' | 'block'; refId: string; sym: string; name: string; color: string }) {
  return (
    <button
      type="button"
      className="pal-item"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind, ref: refId })); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={() => labActions.add(kind, refId)}
      aria-label={`Add ${name} to the workspace`}
      title={`${name} — click to add, or drag into the workspace`}
    >
      <span className="sym" style={{ background: color, color: textOn(color) }}>{sym}</span>
      <span className="nm">{name}</span>
    </button>
  );
}

export function LabDrawer() {
  const [tab, setTab] = useState<'blocks' | 'atoms'>('blocks');
  const [q, setQ] = useState('');
  const canUndo = useStore(labStore, (s) => s.history.length > 0);
  const selectedId = useStore(labStore, (s) => s.selectedId);
  const count = useStore(labStore, (s) => s.lab.nodes.length);
  const query = q.trim().toLowerCase();

  const blocks = useMemo(() => buildingBlockList.filter((b) => !query || b.name.toLowerCase().includes(query) || b.short.toLowerCase().includes(query)), [query]);
  const atoms = useMemo(() => elementList.filter((e) => !query || e.name.toLowerCase().includes(query) || e.symbol.toLowerCase() === query), [query]);

  return (
    <>
      <div className="drawer-head">
        <h2>Laboratory</h2>
        <Tabs label="Palette" value={tab} onChange={setTab} options={[{ id: 'blocks', label: 'Building blocks' }, { id: 'atoms', label: 'Elements' }]} />
        <input className="input" style={{ width: 180 }} placeholder="Filter palette…" aria-label="Filter palette" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        <button type="button" className="btn small" onClick={labActions.undo} disabled={!canUndo} aria-label="Undo last action (Ctrl+Z)"><Undo2 size={14} aria-hidden /> Undo</button>
        <button type="button" className="btn small danger" onClick={() => selectedId && labActions.remove(selectedId)} disabled={!selectedId} aria-label="Remove selected component (Delete)"><Trash2 size={14} aria-hidden /> Remove</button>
        <button type="button" className="btn small danger" onClick={labActions.reset} disabled={!count} aria-label="Clear the workspace"><RotateCcw size={14} aria-hidden /> Reset</button>
      </div>
      <div className="drawer-body">
        {tab === 'blocks'
          ? blockCategories.map((c) => {
            const list = blocks.filter((b) => b.category === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id}>
                <div className="pal-group">{c.name}</div>
                <div className="palette">{list.map((b) => <PaletteItem key={b.id} kind="block" refId={b.id} sym={b.short} name={b.name} color={CATEGORY_COLORS[b.category]} />)}</div>
              </div>
            );
          })
          : elementCategories.map((c) => {
            const list = atoms.filter((e) => e.category === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id}>
                <div className="pal-group">{c.name}</div>
                <div className="palette">{list.map((e) => <PaletteItem key={e.symbol} kind="atom" refId={e.symbol} sym={e.symbol} name={e.name} color={e.color} />)}</div>
              </div>
            );
          })}
      </div>
    </>
  );
}
