import { ExternalLink } from 'lucide-react';
import { appStore } from '../app/appStore';
import { useStore } from '../app/createStore';

export const WAMR3D_URL = 'https://github.com/aymen94/wamr3d';
export const WAMR3D_NPM = 'https://www.npmjs.com/package/wamr3d';

/** Small credit shown in the corner of the 3D view. */
export function EngineCredit() {
  const backend = useStore(appStore, (s) => s.engine.backend);
  return (
    <a className="engine-credit glass" href={WAMR3D_URL} target="_blank" rel="noreferrer noopener" title="WAMR3D: a 3D engine core in WebAssembly (opens GitHub)">
      Rendered with <strong>WAMR3D</strong> <span className="ver">v{__WAMR3D_VERSION__}{backend ? ` · ${backend}` : ''}</span>
      <ExternalLink size={11} aria-hidden />
    </a>
  );
}
