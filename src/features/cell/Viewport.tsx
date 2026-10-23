import { Eye, Layers, Minus, Plus, RotateCcw, Scissors } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { select, setNavMode, toggle, toggleViewStyle, zoom, resetView, focusOrganelle } from '../../app/actions';
import { appStore, prefersReducedMotion } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { elements } from '../../data/elements';
import { molecules } from '../../data/molecules';
import { organelles } from '../../data/organelles';
import { bindLabel, engine, hoverStore, labelStore, statsStore } from '../../engine/engineHandle';
import { hasGraphicsSupport } from '../../engine/support';
import type { LabSnapshot } from '../../engine/types';
import { EngineCredit } from '../../components/Credits';
import { connectionOptions } from '../lab/chemistry';
import { DRAG_MIME } from '../lab/LabDrawer';
import { labActions, labStore } from '../lab/labStore';

/** Creates the WAMR3D engine for this element and keeps it in sync with the stores. */
function useEngine(container: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    if (!hasGraphicsSupport()) {
      appStore.set((s) => ({ ...s, engine: { status: 'error', error: 'This browser supports neither WebGPU nor WebGL 2.' } }));
      return;
    }
    let disposed = false;
    const unsubs: (() => void)[] = [];
    let instance: import('../../engine/WamrEngine').WamrEngine | null = null;

    (async () => {
      const { WamrEngine } = await import('../../engine/WamrEngine');
      if (disposed) return;
      const eng = new WamrEngine(el, {
        onPick(target, { shiftKey, double }) {
          if (!target) {
            if (appStore.get().stage === 'lab') labActions.select(null);
            return;
          }
          if (target.stage === 'cell') {
            select({ kind: 'organelle', id: target.organelleId, instance: target.instance });
            if (double) focusOrganelle(target.organelleId, target.instance);
          } else if (target.stage === 'lab') {
            const { selectedId } = labStore.get();
            if (shiftKey && selectedId && selectedId !== target.nodeId) labActions.attempt(target.nodeId);
            else labActions.select(target.nodeId);
          }
        },
        onHover(target, x, y) {
          hoverStore.set(target ? { ...target, x, y } : null);
        },
        onNavModeChange(mode) {
          setNavMode(mode);
        },
        onLabelsChanged(anchors) {
          labelStore.set(anchors);
        },
        onLabNodeMoved(id, x, y) {
          labActions.move(id, x, y);
        },
        onStats(stats) {
          statsStore.set(stats);
        },
      });
      instance = eng;
      try {
        await eng.init((progress) => appStore.set((s) => ({ ...s, engine: { status: 'loading', progress } })));
      } catch (err) {
        console.error(err);
        eng.dispose();
        if (!disposed) appStore.set((s) => ({ ...s, engine: { status: 'error', error: err instanceof Error ? err.message : String(err) } }));
        return;
      }
      if (disposed) { eng.dispose(); return; }
      engine.set(eng);
      appStore.set((s) => ({ ...s, engine: { status: 'ready', backend: eng.backend } }));

      // --- Keep the scene in sync with application state -----------------------------
      let prev = appStore.get();
      const applyAll = (s = appStore.get(), force = false) => {
        if (force || s.stage !== prev.stage) eng.setStage(s.stage);
        if (force || s.selection !== prev.selection) {
          const sel = s.selection;
          eng.selectOrganelle(sel?.kind === 'organelle' ? sel.id : null, sel?.kind === 'organelle' ? sel.instance : undefined);
          eng.highlightOrganelles(sel?.kind === 'element' ? elements[sel.id].organelles : sel?.kind === 'molecule' ? molecules[sel.id].organelles : []);
        }
        const molChanged = s.selection !== prev.selection || s.moleculeView !== prev.moleculeView || s.stage !== prev.stage;
        if ((force || molChanged) && s.stage === 'molecule' && s.selection?.kind === 'molecule') {
          void eng.showMolecule(molecules[s.selection.id].structure, s.moleculeView);
        }
        if (force || s.labels !== prev.labels) eng.setLabelsVisible(s.labels);
        if (force || s.viewStyle !== prev.viewStyle) eng.setViewStyle(s.viewStyle);
        if (force || s.settings !== prev.settings) {
          eng.setQuality(s.settings.quality);
          eng.setDebug(s.settings.debug);
          eng.setAnimate(s.settings.animate && !prefersReducedMotion());
          eng.setReducedMotion(prefersReducedMotion());
          if (!s.settings.debug) statsStore.set(null);
        }
        prev = s;
      };
      applyAll(appStore.get(), true);
      unsubs.push(appStore.subscribe(() => applyAll()));

      const syncLab = () => {
        const { lab, selectedId } = labStore.get();
        const compatible: string[] = [], incompatible: string[] = [];
        if (selectedId) {
          for (const n of lab.nodes) {
            if (n.id === selectedId) continue;
            (connectionOptions(lab, selectedId, n.id).ok ? compatible : incompatible).push(n.id);
          }
        }
        const snap: LabSnapshot = { nodes: lab.nodes, bonds: lab.bonds, selectedId, compatible, incompatible };
        eng.syncLab(snap);
      };
      syncLab();
      unsubs.push(labStore.subscribe(syncLab));
    })();

    return () => {
      disposed = true;
      unsubs.forEach((u) => u());
      engine.set(null);
      instance?.dispose();
    };
  }, [container]);
}

function Labels() {
  const anchors = useStore(labelStore, (s) => s);
  const annotations = useStore(appStore, (s) => s.annotations);
  return (
    <div className="labels-layer" aria-hidden>
      {anchors.map((a) => (
        <div key={a.key} ref={(el) => bindLabel(a.key, el)} className={`label3d ${a.kind} ${a.emphasis ? 'emphasis' : ''}`}>
          <div className="label3d-inner">
            <div className="label3d-pill">
              {a.color && a.kind !== 'lab-node' && <span className="dot" style={{ background: a.color }} />}
              {a.text}
            </div>
            {annotations && a.sub && (a.emphasis || a.kind === 'lab-node') && <div className="label3d-sub">{a.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tooltip() {
  const hover = useStore(hoverStore, (s) => s);
  if (!hover) return null;
  const x = Math.min(hover.x + 14, window.innerWidth - 290);
  return (
    <div className="tooltip" style={{ left: x, top: hover.y + 14 }} role="tooltip">
      {hover.label}
      {hover.sub && <small>{hover.sub}</small>}
    </div>
  );
}

function ModeBadge() {
  const stage = useStore(appStore, (s) => s.stage);
  const nav = useStore(appStore, (s) => s.navMode);
  const selection = useStore(appStore, (s) => s.selection);
  let title = '', crumbs = '';
  if (stage === 'cell') {
    title = nav === 'exterior' ? 'Exterior view' : nav === 'interior' ? 'Inside the cell' : 'Close-up inspection';
    crumbs = nav === 'closeup' && selection?.kind === 'organelle' ? organelles[selection.id].name : nav === 'interior' ? 'WASD to move · drag to look' : 'Drag to orbit · scroll to zoom';
  } else if (stage === 'molecule') {
    title = 'Molecule viewer';
    crumbs = selection?.kind === 'molecule' ? molecules[selection.id].name : '';
  } else {
    title = 'Laboratory workspace';
    crumbs = 'Drag components · Shift-click to combine';
  }
  return (
    <div className="glass mode-badge" role="status" aria-live="polite">
      <span className="pulse" aria-hidden />
      <strong>{title}</strong>
      {crumbs && <span className="crumbs">{crumbs}</span>}
    </div>
  );
}

function DebugHud() {
  const stats = useStore(statsStore, (s) => s);
  const debug = useStore(appStore, (s) => s.settings.debug);
  if (!debug) return null;
  return (
    <div className="glass debug-hud" aria-label="Performance information">
      {stats ? (
        <>
          backend <b>{stats.backend}</b> · stage <b>{stats.stage}</b><br />
          fps <b>{stats.fps.toFixed(1)}</b> · frame <b>{stats.frameMs.toFixed(1)} ms</b><br />
          draw calls <b>{stats.drawCalls}</b> · triangles <b>{stats.triangles.toLocaleString()}</b><br />
          pixel ratio <b>{stats.pixelRatio}</b>
          <div style={{ color: 'var(--text-faint)', marginTop: 2 }}>measured live; calls/triangles from renderer.info</div>
        </>
      ) : 'Collecting measurements…'}
    </div>
  );
}

function ViewControls() {
  const labels = useStore(appStore, (s) => s.labels);
  const viewStyle = useStore(appStore, (s) => s.viewStyle);
  const stage = useStore(appStore, (s) => s.stage);
  return (
    <div className="glass view-controls" role="toolbar" aria-label="View controls" aria-orientation="vertical">
      <button type="button" className="icon-btn" aria-label="Zoom in (+)" title="Zoom in (+)" onClick={() => zoom(0.75)}><Plus size={17} /></button>
      <button type="button" className="icon-btn" aria-label="Zoom out (−)" title="Zoom out (−)" onClick={() => zoom(1.33)}><Minus size={17} /></button>
      <button type="button" className="icon-btn" aria-label="Reset camera (R)" title="Reset camera (R)" onClick={resetView}><RotateCcw size={16} /></button>
      <div className="sep" />
      <button type="button" className="icon-btn" aria-pressed={labels} aria-label="Toggle labels (L)" title="Toggle labels (L)" onClick={() => toggle('labels')}><Eye size={16} /></button>
      {stage === 'cell' && (
        <button type="button" className="icon-btn" aria-pressed={viewStyle === 'cutaway'} aria-label="Cutaway view (C)" title="Cutaway view: open the membrane facing you (C)" onClick={toggleViewStyle}><Scissors size={16} /></button>
      )}
      <button type="button" className="icon-btn" aria-pressed={useStore(appStore, (s) => s.annotations)} aria-label="Toggle scientific annotations (N)" title="Scale & simplification annotations (N)" onClick={() => toggle('annotations')}><Layers size={16} /></button>
    </div>
  );
}

function ScaleNote() {
  const annotations = useStore(appStore, (s) => s.annotations);
  const stage = useStore(appStore, (s) => s.stage);
  const drawer = useStore(appStore, (s) => s.drawerOpen);
  const nav = useStore(appStore, (s) => s.navMode);
  if (!annotations || stage !== 'cell' || drawer || nav === 'closeup') return null;
  return (
    <div className="overlay glass scale-note">
      <strong style={{ color: 'var(--text)' }}>Not to scale.</strong> A typical animal cell is 10–30 µm across. Small structures (ribosomes ≈ 25–30 nm, pores, vesicles) are enlarged and far fewer are drawn than a real cell contains.
    </div>
  );
}

export function Viewport({ hud, children }: { hud?: React.ReactNode; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEngine(ref);
  const status = useStore(appStore, (s) => s.engine);
  const stage = useStore(appStore, (s) => s.stage);
  const [dragOver, setDragOver] = useState(false);

  return (
    <main
      className="viewport"
      ref={ref}
      aria-label="3D viewport"
      onDragOver={(e) => {
        if (stage === 'lab' && e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;
        e.preventDefault();
        const { kind, ref: r } = JSON.parse(raw) as { kind: 'atom' | 'block'; ref: string };
        const at = engine.get()?.screenToLab(e.clientX, e.clientY) ?? undefined;
        labActions.add(kind, r, at ?? undefined);
      }}
      style={dragOver ? { outline: '2px dashed var(--accent)', outlineOffset: -6 } : undefined}
    >
      <Labels />
      <div className="overlay hud-tl">
        <ModeBadge />
        <EngineCredit />
        <DebugHud />
      </div>
      <div className="overlay hud-tr">
        <ViewControls />
        {hud}
      </div>
      {children}
      <ScaleNote />
      {status.status === 'loading' && (
        <div className="loading" role="status">
          <div className="glass loading-card"><span className="spinner" aria-hidden />{status.progress ?? 'Loading…'}</div>
        </div>
      )}
      {status.status === 'error' && (
        <div className="fallback">
          <div className="glass fallback-card" role="alert">
            <h2>3D view unavailable</h2>
            <p>CellVerse renders with WAMR3D, which needs WebGPU or WebGL 2. The renderer could not start:</p>
            <p className="mono" style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{status.error}</p>
            <p>All scientific content still works: use the sidebar, search (press <kbd>/</kbd>), the element table and the molecule explorer. Try an up-to-date Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</p>
          </div>
        </div>
      )}
      <Tooltip />
    </main>
  );
}
