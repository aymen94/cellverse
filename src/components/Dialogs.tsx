import { CheckCircle2, Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openDialog, select } from '../app/actions';
import { appStore, type Settings } from '../app/appStore';
import { useStore } from '../app/createStore';
import { search } from '../features/search/searchIndex';
import { LAB_DISCLAIMER } from '../data/lab';
import { WAMR3D_NPM, WAMR3D_URL } from './Credits';

function Dialog({ title, onClose, children, label }: { title?: string; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, button, select, a');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        // Keep focus inside the dialog.
        const items = [...ref.current.querySelectorAll<HTMLElement>('input, button, select, a, [tabindex="0"]')];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog glass" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        {title && (
          <div className="dialog-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function SearchDialog() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(q), [q]);
  const close = () => openDialog('searchOpen', false);
  const choose = (i: number) => {
    const r = results[i];
    if (!r) return;
    close();
    select(r.selection, { focus: r.selection.kind === 'organelle' });
  };
  return (
    <Dialog onClose={close} label="Search">
      <div className="search-box">
        <Search size={18} color="var(--text-faint)" aria-hidden />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          placeholder="Search organelles, elements, molecules, building blocks…"
          aria-label="Search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `res-${active}` : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') choose(active);
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul className="results" id="search-results" role="listbox" aria-label="Results">
        {q && !results.length && <li className="result" style={{ cursor: 'default', color: 'var(--text-dim)' }}>No matches for “{q}”.</li>}
        {!q && <li className="result" style={{ cursor: 'default', color: 'var(--text-dim)' }}>Try “ribosome”, “Fe”, “glucose”, “phospholipid” or “ATP”.</li>}
        {results.map((r, i) => (
          <li key={`${r.selection.kind}-${r.selection.id}`} id={`res-${i}`} role="option" aria-selected={i === active} className="result" onMouseEnter={() => setActive(i)} onClick={() => choose(i)}>
            <div style={{ minWidth: 0 }}>
              <div className="rt">{r.title}</div>
              <div className="rs">{r.subtitle}</div>
            </div>
            <span className="badge rk">{r.kindLabel}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function HelpDialog() {
  const close = () => openDialog('helpOpen', false);
  const rows: [string, string][] = [
    ['/  or  Ctrl K', 'Search'], ['E', 'Enter / exit the cell'], ['W A S D', 'Move inside the cell (Q / Z: up / down)'], ['Drag', 'Orbit · right-drag or Shift-drag: pan · wheel: zoom'],
    ['Click', 'Select a structure'], ['Double-click  or  F', 'Inspect close up'], ['+  /  −', 'Zoom'], ['R', 'Reset view'], ['L', 'Toggle labels'], ['N', 'Toggle scale & simplification annotations'],
    ['C', 'Cutaway view'], ['Backspace', 'Back to previous selection'], ['Esc', 'Close dialog / clear selection'], ['Shift + click', 'Lab: combine selected component with another'],
    ['Delete', 'Lab: remove selected component'], ['Ctrl Z', 'Lab: undo'], ['?', 'This help'],
  ];
  return (
    <Dialog title="Help & keyboard shortcuts" onClose={close} label="Help">
      <div className="dialog-body">
        <p>CellVerse is an interactive model of a eukaryotic animal cell, its chemical elements and its biomolecules. Everything is also reachable without the 3D view: use the sidebar, search, and the panels.</p>
        <div className="shortcuts">
          {rows.map(([k, v]) => (<Fragment key={k}><span><kbd>{k}</kbd></span><span>{v}</span></Fragment>))}
        </div>
        <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>About the science</h3>
        <ul style={{ color: 'var(--text-dim)' }}>
          <li>The cell is a scientifically informed illustration, <strong>not to scale</strong>: small structures are enlarged and far fewer are drawn than a real cell contains.</li>
          <li>Molecule views state their origin: experimental (PDB), computed (PubChem 3D) or idealized (PDB Chemical Component Dictionary) coordinates, or a clearly labelled educational model.</li>
          <li>{LAB_DISCLAIMER}</li>
          <li>Sources: OpenStax Biology 2e, Cooper's <em>The Cell</em> (NCBI Bookshelf), PubChem, RCSB PDB and PDB-101, NIH Office of Dietary Supplements, IUPAC CIAAW, and primary literature cited in each panel.</li>
        </ul>
        <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>Rendering</h3>
        <p style={{ color: 'var(--text-dim)' }}>3D graphics are rendered by the WAMR3D engine (WebGPU, with its own WebGL 2 fallback). Selection glow is approximated with emissive colour and an enlarged back-face halo rather than a post-processing outline.</p>
        <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>Credits</h3>
        <ul style={{ color: 'var(--text-dim)' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>3D engine: WAMR3D</strong> v{__WAMR3D_VERSION__} by aymen94 — a Rust and WebAssembly 3D engine with its own WebGPU renderer and WebGL 2 fallback (MIT licence).{' '}
            <a href={WAMR3D_URL} target="_blank" rel="noreferrer noopener">GitHub</a> · <a href={WAMR3D_NPM} target="_blank" rel="noreferrer noopener">npm</a>
          </li>
          <li>Molecular structures: RCSB Protein Data Bank, PDB Chemical Component Dictionary and PubChem.</li>
          <li>Educational content sources: OpenStax <em>Biology 2e</em>, Cooper's <em>The Cell</em> (NCBI Bookshelf), PDB-101, NIH Office of Dietary Supplements, IUPAC CIAAW and the primary papers cited in each panel.</li>
          <li>Interface: React, Vite and Lucide icons.</li>
        </ul>
      </div>
    </Dialog>
  );
}

export function SettingsDialog() {
  const settings = useStore(appStore, (s) => s.settings);
  const backend = useStore(appStore, (s) => s.engine.backend);
  const close = () => openDialog('settingsOpen', false);
  const set = (patch: Partial<Settings>) => appStore.set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  return (
    <Dialog title="Settings" onClose={close} label="Settings">
      <div className="dialog-body">
        <div className="settings-row">
          <div><label htmlFor="set-motion">Motion</label><small>Camera transitions and interface animation.</small></div>
          <select id="set-motion" className="input" style={{ width: 'auto' }} value={settings.motion} onChange={(e) => set({ motion: e.target.value as Settings['motion'] })}>
            <option value="system">Follow system setting</option>
            <option value="reduce">Reduce motion</option>
            <option value="full">Full motion</option>
          </select>
        </div>
        <div className="settings-row">
          <div><label htmlFor="set-quality">Rendering quality</label><small>Caps the device pixel ratio (high 2×, balanced 1.5×, low 1×).</small></div>
          <select id="set-quality" className="input" style={{ width: 'auto' }} value={settings.quality} onChange={(e) => set({ quality: e.target.value as Settings['quality'] })}>
            <option value="high">High</option>
            <option value="balanced">Balanced</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="settings-row">
          <div><label htmlFor="set-anim">Animate cellular transport</label><small>Vesicles moving between ER, Golgi and membrane; slow molecule rotation.</small></div>
          <input id="set-anim" type="checkbox" checked={settings.animate} onChange={(e) => set({ animate: e.target.checked })} />
        </div>
        <div className="settings-row">
          <div><label htmlFor="set-debug">Developer / debug mode</label><small>Shows measured frame rate, draw calls and triangles.</small></div>
          <input id="set-debug" type="checkbox" checked={settings.debug} onChange={(e) => set({ debug: e.target.checked })} />
        </div>
        <div className="settings-row">
          <div>Renderer backend<small>Chosen at start-up by <a href={WAMR3D_URL} target="_blank" rel="noreferrer noopener">WAMR3D</a> v{__WAMR3D_VERSION__}.</small></div>
          <span className="badge accent">{backend ?? 'not started'}</span>
        </div>
      </div>
    </Dialog>
  );
}

export function Toast() {
  const toast = useStore(appStore, (s) => s.toast);
  return (
    <div aria-live="polite" role="status" style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0 }}>
      {toast && (
        <div className={`toast glass ${toast.tone}`}>
          {toast.tone === 'success' && <CheckCircle2 size={16} color="var(--green)" aria-hidden />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
