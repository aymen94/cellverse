import { Atom, CircleHelp, Dna, FlaskConical, Flag, Hexagon, Microscope, PanelLeft, Search, Settings } from 'lucide-react';
import { openDialog, setSection, toggle } from '../app/actions';
import { appStore, type Section } from '../app/appStore';
import { useStore } from '../app/createStore';

const tabs: { id: Section; label: string; icon: typeof Atom }[] = [
  { id: 'explorer', label: 'Cell Explorer', icon: Microscope },
  { id: 'organelles', label: 'Organelles', icon: Hexagon },
  { id: 'elements', label: 'Elements', icon: Atom },
  { id: 'molecules', label: 'Molecules', icon: Dna },
  { id: 'lab', label: 'Laboratory', icon: FlaskConical },
  { id: 'missions', label: 'Missions', icon: Flag },
];

export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <radialGradient id="lg" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#5eead4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13.5" fill="url(#lg)" stroke="#22d3ee" strokeWidth="1.6" />
      <circle cx="18" cy="14" r="5" fill="#a78bfa" />
      <circle cx="19.2" cy="13" r="1.6" fill="#6d28d9" />
      <rect x="7.5" y="18.5" width="6" height="2.6" rx="1.3" fill="#f87171" transform="rotate(-25 10.5 19.8)" />
      <circle cx="22.5" cy="22" r="1.4" fill="#fbbf24" />
    </svg>
  );
}

export function TopNav() {
  const section = useStore(appStore, (s) => s.section);
  const leftOpen = useStore(appStore, (s) => s.leftOpen);
  return (
    <header className="topnav">
      <button type="button" className="icon-btn" aria-label={leftOpen ? 'Hide explorer sidebar' : 'Show explorer sidebar'} aria-pressed={leftOpen} onClick={() => toggle('leftOpen')}>
        <PanelLeft size={18} />
      </button>
      <div className="brand">
        <Logo />
        <span className="brand-name">CellVerse</span>
        <span className="brand-tag">Explore life at the molecular level.</span>
      </div>
      <nav className="nav-tabs" aria-label="Main sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" className="nav-tab" aria-current={section === t.id ? 'page' : undefined} onClick={() => setSection(t.id)} title={t.label}>
            <t.icon size={16} aria-hidden />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-spacer" />
      <button type="button" className="search-trigger" onClick={() => openDialog('searchOpen')} aria-label="Search organelles, elements and molecules">
        <Search size={15} aria-hidden />
        <span>Search…</span>
        <kbd>/</kbd>
      </button>
      <button type="button" className="icon-btn" aria-label="Help and keyboard shortcuts" onClick={() => openDialog('helpOpen')}>
        <CircleHelp size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label="Settings" onClick={() => openDialog('settingsOpen')}>
        <Settings size={18} />
      </button>
    </header>
  );
}
