// WAMR3D ships its add-ons as plain JavaScript. These declarations cover only the
// members of OrbitControls that CellVerse uses (checked against
// node_modules/wamr3d/addons/controls/OrbitControls.js).
declare module 'wamr3d/addons/controls/OrbitControls.js' {
  import type { Camera, Vector3 } from 'wamr3d/compat';

  export class OrbitControls {
    constructor(object: Camera, domElement?: HTMLElement | null);
    object: Camera;
    target: Vector3;
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    update(deltaTime?: number | null): boolean;
    addEventListener(type: 'change' | 'start' | 'end', listener: (event: unknown) => void): void;
    removeEventListener(type: 'change' | 'start' | 'end', listener: (event: unknown) => void): void;
    dispose(): void;
  }
}
