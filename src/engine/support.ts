/** WAMR3D needs WebGPU or WebGL 2. Checked before the engine module is loaded. */
export function hasGraphicsSupport(): boolean {
  if ('gpu' in navigator) return true;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
