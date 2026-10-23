// The contract between the UI and the WAMR3D adapter. React components only use these
// types and the SceneController methods; they never touch renderer objects.

import type { OrganelleId, StructureRef } from '../types/science';
import type { LabBond, LabNode } from '../features/lab/labTypes';

export type StageId = 'cell' | 'molecule' | 'lab';
export type NavMode = 'exterior' | 'interior' | 'closeup';
export type ViewStyle = 'standard' | 'cutaway';
export type Quality = 'high' | 'balanced' | 'low';

export type PickTarget =
  | { stage: 'cell'; organelleId: OrganelleId; instance?: number }
  | { stage: 'lab'; nodeId: string };

/** A label drawn by the DOM overlay and positioned by the engine every frame. */
export interface LabelAnchor {
  key: string;
  text: string;
  sub?: string;
  color?: string;
  kind: 'organelle' | 'molecule' | 'lab-node' | 'lab-bond';
  /** Selected or highlighted labels are emphasized. */
  emphasis?: boolean;
}

export interface EngineStats {
  backend: string;
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  stage: StageId;
}

export interface EngineCallbacks {
  onPick(target: PickTarget | null, event: { shiftKey: boolean; double: boolean }): void;
  onHover(target: { label: string; sub?: string } | null, x: number, y: number): void;
  onNavModeChange(mode: NavMode): void;
  onLabelsChanged(anchors: LabelAnchor[]): void;
  onLabNodeMoved(id: string, x: number, y: number): void;
  onStats?(stats: EngineStats): void;
}

export interface MoleculeViewOptions {
  style: 'ball-stick' | 'spacefill';
  hydrogens: boolean;
}

export interface LabSnapshot {
  nodes: LabNode[];
  bonds: LabBond[];
  selectedId: string | null;
  /** Node ids that can connect to the selected node (green) or cannot (dimmed). */
  compatible: string[];
  incompatible: string[];
}

export interface SceneController {
  readonly backend: string;
  setStage(stage: StageId): void;

  // Cell
  selectOrganelle(id: OrganelleId | null, instance?: number): void;
  focusOrganelle(id: OrganelleId, instance?: number): void;
  highlightOrganelles(ids: OrganelleId[]): void;
  enterCell(): void;
  exitCell(): void;
  resetView(): void;
  zoom(factor: number): void;
  setMoveInput(input: { forward: number; right: number; up: number }): void;
  setViewStyle(style: ViewStyle): void;
  setAnimate(on: boolean): void;

  // Molecule
  showMolecule(ref: StructureRef, options: MoleculeViewOptions): Promise<void>;

  // Laboratory
  syncLab(snapshot: LabSnapshot): void;
  screenToLab(clientX: number, clientY: number): { x: number; y: number } | null;

  // Overlay and settings
  bindLabelElement(key: string, el: HTMLElement | null): void;
  setLabelsVisible(on: boolean): void;
  /** Pixels covered by UI at the bottom of the viewport; the view is re-centred above them. */
  setViewInset(bottom: number): void;
  setReducedMotion(on: boolean): void;
  setQuality(q: Quality): void;
  setDebug(on: boolean): void;
  dispose(): void;
}
