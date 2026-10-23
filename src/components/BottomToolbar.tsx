import { DoorClosed, DoorOpen, Eye, FlaskConical, Layers, PanelRightOpen, RotateCcw, ScanSearch } from 'lucide-react';
import { addSelectionToLab, inspectSelection, labTargetFor, resetView, toggle, toggleCell } from '../app/actions';
import { appStore } from '../app/appStore';
import { useStore } from '../app/createStore';

export function BottomToolbar() {
  const nav = useStore(appStore, (s) => s.navMode);
  const stage = useStore(appStore, (s) => s.stage);
  const selection = useStore(appStore, (s) => s.selection);
  const labels = useStore(appStore, (s) => s.labels);
  const annotations = useStore(appStore, (s) => s.annotations);
  const rightOpen = useStore(appStore, (s) => s.rightOpen);
  const inside = stage === 'cell' && nav !== 'exterior';
  const canInspect = selection?.kind === 'organelle';
  const labTarget = labTargetFor(selection);

  return (
    <div className="toolbar glass" role="toolbar" aria-label="Quick actions">
      <button type="button" className="tb primary" onClick={toggleCell} aria-label={inside ? 'Exit the cell (E)' : 'Enter the cell (E)'} title={inside ? 'Exit the cell (E)' : 'Enter the cell (E)'}>
        {inside ? <DoorClosed size={16} aria-hidden /> : <DoorOpen size={16} aria-hidden />}
        <span>{inside ? 'Exit cell' : 'Enter cell'}</span>
      </button>
      <div className="divider" />
      <button type="button" className="tb" onClick={inspectSelection} disabled={!canInspect} aria-label="Inspect selection close up (F)" title={canInspect ? 'Inspect selection close up (F)' : 'Select a cell structure to inspect it'}>
        <ScanSearch size={16} aria-hidden /><span>Inspect</span>
      </button>
      <button type="button" className="tb" onClick={addSelectionToLab} disabled={!labTarget} aria-label="Add selection to laboratory" title={labTarget ? 'Add selection to the laboratory' : 'Select an element or building block to add it to the laboratory'}>
        <FlaskConical size={16} aria-hidden /><span>Add to lab</span>
      </button>
      <div className="divider" />
      <button type="button" className="tb" aria-pressed={labels} onClick={() => toggle('labels')} aria-label="Toggle labels (L)" title="Toggle labels (L)">
        <Eye size={16} aria-hidden /><span>Labels</span>
      </button>
      <button type="button" className="tb" aria-pressed={annotations} onClick={() => toggle('annotations')} aria-label="Toggle simplified scientific annotations (N)" title="Scale & simplification annotations (N)">
        <Layers size={16} aria-hidden /><span>Annotations</span>
      </button>
      <button type="button" className="tb" onClick={resetView} aria-label="Reset view (R)" title="Reset view (R)">
        <RotateCcw size={16} aria-hidden /><span>Reset</span>
      </button>
      {!rightOpen && (
        <>
          <div className="divider" />
          <button type="button" className="tb" onClick={() => toggle('rightOpen')} aria-label="Show details panel" title="Show details panel">
            <PanelRightOpen size={16} aria-hidden /><span>Details</span>
          </button>
        </>
      )}
    </div>
  );
}
