// Loads WAMR3D. This is the only module that initializes the engine.
//
// WAMR3D's add-ons (OrbitControls) create engine objects while their modules are
// evaluated, so they must be imported dynamically after `init()` has finished.

import * as W from 'wamr3d/compat';
import wasmUrl from 'wamr3d/wamr3d_wasm_bg.wasm?url';
import type { OrbitControls as OrbitControlsType } from 'wamr3d/addons/controls/OrbitControls.js';

export { W };
export type OrbitControls = OrbitControlsType;

let ready: Promise<{ OrbitControls: typeof OrbitControlsType }> | null = null;

export function loadEngine() {
  ready ??= (async () => {
    await W.init(wasmUrl);
    const { OrbitControls } = await import('wamr3d/addons/controls/OrbitControls.js');
    return { OrbitControls };
  })();
  return ready;
}
