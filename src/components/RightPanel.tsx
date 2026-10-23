import { ArrowLeft, Microscope, PanelRightClose, Search, X } from 'lucide-react';
import { clearSelection, goBack, openDialog, select, toggle } from '../app/actions';
import { appStore } from '../app/appStore';
import { useStore } from '../app/createStore';
import { ElementPanel } from '../features/chemistry/ElementPanel';
import { BlockPanel } from '../features/lab/BlockPanel';
import { LabInspector } from '../features/lab/LabInspector';
import { MoleculePanel } from '../features/molecules/MoleculePanel';
import { OrganellePanel } from '../features/organelles/OrganellePanel';
import { selectionLabel } from './Sidebar';

const KIND_LABEL = { organelle: 'Cell structure', element: 'Chemical element', molecule: 'Molecule', block: 'Building block' } as const;

function EmptyState() {
  return (
    <div className="empty">
      <Microscope size={34} color="var(--accent)" aria-hidden />
      <h2>Select something to explore</h2>
      <p>Click a structure in the 3D cell, pick one from the sidebar, or search.</p>
      <div className="tips">
        <button type="button" className="btn" onClick={() => select({ kind: 'organelle', id: 'nucleus' })}>Start with the nucleus</button>
        <button type="button" className="btn" onClick={() => select({ kind: 'organelle', id: 'mitochondrion' })}>Meet the mitochondrion</button>
        <button type="button" className="btn" onClick={() => openDialog('searchOpen')}><Search size={14} aria-hidden /> Search everything</button>
      </div>
    </div>
  );
}

export function RightPanel() {
  const open = useStore(appStore, (s) => s.rightOpen);
  const selection = useStore(appStore, (s) => s.selection);
  const back = useStore(appStore, (s) => s.back);
  const section = useStore(appStore, (s) => s.section);
  const inLab = section === 'lab';
  const previous = back[back.length - 1];

  return (
    <aside className={`panel-right ${open ? '' : 'closed'}`} aria-label="Details" id="details" tabIndex={-1}>
      <div className="panel-head">
        {!inLab && previous && (
          <button type="button" className="icon-btn" onClick={goBack} aria-label={`Back to ${selectionLabel(previous).title}`} title={`Back to ${selectionLabel(previous).title} (Backspace)`}>
            <ArrowLeft size={17} />
          </button>
        )}
        <span className="kind">{inLab ? 'Laboratory' : selection ? KIND_LABEL[selection.kind] : 'Details'}</span>
        <span className="grow" />
        {!inLab && selection && (
          <button type="button" className="icon-btn" onClick={clearSelection} aria-label="Close details and clear selection" title="Close (Esc)">
            <X size={17} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={() => toggle('rightOpen')} aria-label="Collapse panel" title="Collapse panel">
          <PanelRightClose size={17} />
        </button>
      </div>
      <div className="panel-body" key={inLab ? 'lab' : selection ? `${selection.kind}:${selection.id}` : 'none'}>
        {inLab ? <LabInspector /> : !selection ? <EmptyState /> : selection.kind === 'organelle' ? <OrganellePanel id={selection.id} />
          : selection.kind === 'element' ? <ElementPanel symbol={selection.id} />
          : selection.kind === 'molecule' ? <MoleculePanel id={selection.id} />
          : <BlockPanel id={selection.id} />}
      </div>
    </aside>
  );
}
