import { useEffect, useRef } from 'react';
import { engine } from '../engine/engineHandle';
import { BottomToolbar } from '../components/BottomToolbar';
import { HelpDialog, SearchDialog, SettingsDialog, Toast } from '../components/Dialogs';
import { RightPanel } from '../components/RightPanel';
import { Sidebar } from '../components/Sidebar';
import { TopNav } from '../components/TopNav';
import { Viewport } from '../features/cell/Viewport';
import { ElementTable } from '../features/chemistry/ElementTable';
import { LabDrawer } from '../features/lab/LabDrawer';
import { onLabProduct } from '../features/lab/labStore';
import { dispatchMissionEvent } from '../features/missions/missionEngine';
import { MissionTracker, MissionsDrawer } from '../features/missions/Missions';
import { MoleculeDrawer } from '../features/molecules/MoleculeDrawer';
import { OrganelleDrawer } from '../features/organelles/OrganelleDrawer';
import { appStore } from './appStore';
import { useStore } from './createStore';
import { useKeyboard } from './useKeyboard';

function Drawer() {
  const section = useStore(appStore, (s) => s.section);
  const open = useStore(appStore, (s) => s.drawerOpen);
  const ref = useRef<HTMLElement>(null);
  const visible = open && section !== 'explorer';
  // Re-centre the 3D view above the drawer while it is open.
  useEffect(() => {
    const el = ref.current;
    if (!visible || !el) { engine.get()?.setViewInset(0); return; }
    const update = () => engine.get()?.setViewInset(el.offsetHeight + 12);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const unsub = appStore.subscribe(update);
    return () => { ro.disconnect(); unsub(); engine.get()?.setViewInset(0); };
  }, [visible, section]);
  if (!visible) return null;
  const content = {
    organelles: <OrganelleDrawer />,
    elements: <ElementTable />,
    molecules: <MoleculeDrawer />,
    lab: <LabDrawer />,
    missions: <MissionsDrawer />,
  }[section];
  return (
    <section className="drawer glass" aria-label={`${section} explorer`} ref={ref}>
      {content}
    </section>
  );
}

function useReducedMotionClass() {
  const motion = useStore(appStore, (s) => s.settings.motion);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', motion === 'reduce');
    root.classList.toggle('full-motion', motion === 'full');
  }, [motion]);
}

export function App() {
  useKeyboard();
  useReducedMotionClass();
  useEffect(() => onLabProduct((p) => dispatchMissionEvent({ type: 'lab-product', productClass: p.productClass, units: p.units })), []);
  const searchOpen = useStore(appStore, (s) => s.searchOpen);
  const helpOpen = useStore(appStore, (s) => s.helpOpen);
  const settingsOpen = useStore(appStore, (s) => s.settingsOpen);

  return (
    <div className="app">
      <a href="#details" className="sr-only">Skip to details panel</a>
      <TopNav />
      <Sidebar />
      <Viewport hud={<MissionTracker />}>
        <Drawer />
        <BottomToolbar />
      </Viewport>
      <RightPanel />
      {searchOpen && <SearchDialog />}
      {helpOpen && <HelpDialog />}
      {settingsOpen && <SettingsDialog />}
      <Toast />
    </div>
  );
}
