import { select } from '../../app/actions';
import { appStore } from '../../app/appStore';
import { useStore } from '../../app/createStore';
import { organelleGroups, organelleList } from '../../data/organelles';

export function OrganelleDrawer() {
  const selection = useStore(appStore, (s) => s.selection);
  return (
    <>
      <div className="drawer-head">
        <h2>Organelles & cell structures</h2>
        <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>Select a card to highlight it in the 3D cell; double-click a structure in 3D to inspect it close up.</span>
      </div>
      <div className="drawer-body">
        {organelleGroups.map((g) => (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <div className="pal-group">{g.name}</div>
            <div className="cards">
              {organelleList.filter((o) => o.group === g.id).map((o) => (
                <button key={o.id} type="button" className="card" aria-pressed={selection?.kind === 'organelle' && selection.id === o.id} onClick={() => select({ kind: 'organelle', id: o.id })}>
                  <span className="card-title"><span className="dot" style={{ width: 10, height: 10, borderRadius: 3, background: o.color }} aria-hidden />{o.name}</span>
                  <span className="card-sub">{o.summary}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
