import type { W } from '../wamr';
import type { CameraRig } from '../cameraRig';
import type { LabelAnchor, PickTarget } from '../types';

export interface PickResult {
  target: PickTarget;
  label: string;
  sub?: string;
}

/** One 3D scene the engine can show: the cell, a molecule, or the lab workspace. */
export interface Stage {
  readonly scene: W.Scene;
  /** Objects the raycaster tests. */
  pickables(): W.Object3D[];
  /** Turns raycast hits (nearest first) into a pick, or null for empty space. */
  resolvePick(hits: W.Intersection[]): PickResult | null;
  /** Called when the stage becomes visible; positions the camera. */
  activate(rig: CameraRig, first: boolean): void;
  update(dt: number, time: number, camera: W.PerspectiveCamera): void;
  /** Labels this stage shows and their current world positions. */
  labelAnchors(): LabelAnchor[];
  labelPositions(): Map<string, W.Vector3>;
  labelFade?(): { near: number; far: number } | undefined;
  dispose(): void;
}

/** Disposes every geometry and material under `root`. */
export function disposeTree(root: W.Object3D) {
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const m = o as W.Mesh;
    if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); }
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) if (!seen.has(mat)) { seen.add(mat); mat.dispose(); }
  });
}
