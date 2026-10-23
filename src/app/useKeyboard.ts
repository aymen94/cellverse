import { useEffect } from 'react';
import { clearSelection, goBack, inspectSelection, openDialog, resetView, toggle, toggleCell, toggleViewStyle, zoom } from './actions';
import { appStore } from './appStore';
import { engine } from '../engine/engineHandle';
import { labActions, labStore } from '../features/lab/labStore';

const MOVE_KEYS: Record<string, [number, number, number]> = {
  w: [1, 0, 0], s: [-1, 0, 0], a: [0, -1, 0], d: [0, 1, 0], q: [0, 0, 1], z: [0, 0, -1],
};

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Global keyboard shortcuts (ignored while typing or when a dialog is open). */
export function useKeyboard() {
  useEffect(() => {
    const held = new Set<string>();
    const pushMove = () => {
      let f = 0, r = 0, u = 0;
      for (const k of held) { const m = MOVE_KEYS[k]; if (m) { f += m[0]; r += m[1]; u += m[2]; } }
      engine.get()?.setMoveInput({ forward: f, right: r, up: u });
    };
    const onDown = (e: KeyboardEvent) => {
      const s = appStore.get();
      const dialog = s.searchOpen || s.helpOpen || s.settingsOpen;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isTyping(e.target) && !dialog)) {
        e.preventDefault();
        openDialog('searchOpen');
        return;
      }
      if (dialog || isTyping(e.target) || e.altKey) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z' && s.section === 'lab') { e.preventDefault(); labActions.undo(); }
        return;
      }
      const key = e.key.toLowerCase();
      if (MOVE_KEYS[key] && s.stage === 'cell' && s.navMode !== 'exterior') {
        held.add(key);
        pushMove();
        return;
      }
      switch (e.key) {
        case '?': openDialog('helpOpen'); break;
        case 'Escape':
          if (s.section === 'lab' && labStore.get().selectedId) labActions.select(null);
          else if (s.drawerOpen) appStore.set((st) => ({ ...st, drawerOpen: false }));
          else clearSelection();
          break;
        case 'e': case 'E': toggleCell(); break;
        case 'r': case 'R': resetView(); break;
        case 'l': case 'L': toggle('labels'); break;
        case 'n': case 'N': toggle('annotations'); break;
        case 'c': case 'C': if (s.stage === 'cell') toggleViewStyle(); break;
        case 'f': case 'F': inspectSelection(); break;
        case '+': case '=': zoom(0.75); break;
        case '-': case '_': zoom(1.33); break;
        case 'Backspace': e.preventDefault(); goBack(); break;
        case 'Delete': {
          const id = labStore.get().selectedId;
          if (s.section === 'lab' && id) labActions.remove(id);
          break;
        }
        default: return;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (held.delete(e.key.toLowerCase())) pushMove();
    };
    const onBlur = () => { held.clear(); pushMove(); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
