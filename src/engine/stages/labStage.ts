// The laboratory workspace: components on the z = 0 plane, bonds between them, and
// selection / compatibility rings. Positions are schematic.

import { buildingBlocks } from '../../data/lab';
import { elements } from '../../data/elements';
import { loadStructure } from '../../data/structures';
import { assemblyRules } from '../../data/lab';
import type { BondType, BuildingBlockCategory, ElementSymbol } from '../../types/science';
import type { LabBond, LabNode } from '../../features/lab/labTypes';
import type { CameraRig } from '../cameraRig';
import { segmentMatrix } from '../geometry';
import { buildAtomModel } from '../molecular';
import type { LabelAnchor, LabSnapshot } from '../types';
import { W } from '../wamr';
import { disposeTree, type PickResult, type Stage } from './stage';

const CATEGORY_COLORS: Record<BuildingBlockCategory, string> = {
  'amino-acid': '#f59e0b',
  monosaccharide: '#38bdf8',
  'lipid-component': '#fb923c',
  'nucleotide-component': '#a78bfa',
  nucleotide: '#c084fc',
};

export const BOND_COLORS: Record<BondType, string> = {
  peptide: '#fbbf24', glycosidic: '#38bdf8', ester: '#fb923c', phosphoester: '#f97316',
  phosphodiester: '#ef4444', 'n-glycosidic': '#a78bfa', covalent: '#cbd5e1', ionic: '#22d3ee',
};

interface NodeVisual {
  node: LabNode;
  group: W.Group;
  pick: W.Mesh;
  ring: W.Mesh;
  radius: number;
}

const RING_SELECTED = new W.Color('#22d3ee');
const RING_OK = new W.Color('#4ade80');
const RING_NO = new W.Color('#f87171');

export class LabStage implements Stage {
  readonly scene = new W.Scene();
  private readonly nodes = new Map<string, NodeVisual>();
  private readonly bondObjects: W.Object3D[] = [];
  private readonly bondAnchors: { key: string; text: string; color: string; pos: W.Vector3 }[] = [];
  private readonly unitCylinder = new W.CylinderGeometry(1, 1, 1, 10, 1, true);
  private readonly ringGeo = new W.TorusGeometry(1, 0.045, 8, 56);
  private readonly bondMats = new Map<string, W.Material>();
  private snapshot: LabSnapshot = { nodes: [], bonds: [], selectedId: null, compatible: [], incompatible: [] };
  onChange?: () => void;

  constructor() {
    this.scene.background = new W.Color('#060b16');
    this.scene.add(new W.HemisphereLight('#e0f2fe', '#0b1730', 1.3));
    const key = new W.DirectionalLight('#ffffff', 1.5);
    key.position.set(6, 10, 18);
    this.scene.add(key);
    const grid = new W.GridHelper(80, 40, '#16324a', '#0d1f33');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -2;
    this.scene.add(grid);
  }

  private bondMaterial(type: BondType) {
    let m = this.bondMats.get(type);
    if (!m) {
      m = type === 'ionic'
        ? new W.LineDashedMaterial({ color: BOND_COLORS[type], dashSize: 0.3, gapSize: 0.2 })
        : new W.MeshStandardMaterial({ color: BOND_COLORS[type], roughness: 0.4, emissive: BOND_COLORS[type], emissiveIntensity: 0.15 });
      this.bondMats.set(type, m);
    }
    return m;
  }

  private createNode(node: LabNode): NodeVisual {
    const group = new W.Group();
    group.position.set(node.x, node.y, 0);
    let radius: number;
    let pick: W.Mesh;
    if (node.kind === 'atom') {
      const el = elements[node.ref as ElementSymbol];
      radius = 0.8;
      pick = new W.Mesh(new W.SphereGeometry(radius, 28, 20), new W.MeshStandardMaterial({ color: el.color, roughness: 0.35, metalness: 0.1 }));
      group.add(pick);
    } else {
      const bb = buildingBlocks[node.ref];
      radius = 1.6;
      const tint = CATEGORY_COLORS[bb.category];
      pick = new W.Mesh(new W.SphereGeometry(radius, 28, 20), new W.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.18, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.25 }));
      pick.renderOrder = 2;
      group.add(pick);
      loadStructure(bb.structure).then((data) => {
        if (data.kind !== 'atoms' || !this.nodes.has(node.id)) return;
        const model = buildAtomModel(data.atoms, data.bonds, { style: 'ball-stick', hydrogens: false });
        const s = 1.25 / Math.max(1, model.radius);
        model.group.position.copy(model.center).multiplyScalar(-s);
        model.group.scale.set(s, s, s);
        group.add(model.group);
      }).catch(() => { /* the translucent token alone still represents the block */ });
    }
    pick.userData.nodeId = node.id;
    const ring = new W.Mesh(this.ringGeo, new W.MeshBasicMaterial({ color: RING_SELECTED, transparent: true, opacity: 0.9 }));
    ring.scale.setScalar(radius + 0.28);
    ring.visible = false;
    group.add(ring);
    this.scene.add(group);
    return { node, group, pick, ring, radius };
  }

  sync(snapshot: LabSnapshot) {
    this.snapshot = snapshot;
    const ids = new Set(snapshot.nodes.map((n) => n.id));
    for (const [id, v] of this.nodes) {
      if (!ids.has(id)) {
        this.scene.remove(v.group);
        v.group.traverse((o) => { if (o !== v.ring) { const m = o as W.Mesh; if (m.geometry && m.geometry !== this.ringGeo) m.geometry.dispose(); } });
        disposeMaterials(v.group);
        this.nodes.delete(id);
      }
    }
    for (const n of snapshot.nodes) {
      const v = this.nodes.get(n.id);
      if (!v) this.nodes.set(n.id, this.createNode(n));
      else { v.node = n; v.group.position.set(n.x, n.y, 0); }
    }
    this.rebuildBonds();
    this.updateRings();
    this.onChange?.();
  }

  private updateRings() {
    const { selectedId, compatible, incompatible } = this.snapshot;
    for (const [id, v] of this.nodes) {
      const mat = v.ring.material as W.MeshBasicMaterial;
      if (id === selectedId) { mat.color.copy(RING_SELECTED); v.ring.visible = true; mat.opacity = 0.95; }
      else if (compatible.includes(id)) { mat.color.copy(RING_OK); v.ring.visible = true; mat.opacity = 0.8; }
      else if (incompatible.includes(id)) { mat.color.copy(RING_NO); v.ring.visible = true; mat.opacity = 0.35; }
      else v.ring.visible = false;
    }
  }

  private rebuildBonds() {
    for (const o of this.bondObjects) {
      this.scene.remove(o);
      if ((o as W.Line).isLine) (o as W.Line).geometry.dispose();
    }
    this.bondObjects.length = 0;
    this.bondAnchors.length = 0;
    for (const b of this.snapshot.bonds) this.addBond(b);
  }

  private endpoints(b: LabBond): [W.Vector3, W.Vector3] | null {
    const va = this.nodes.get(b.a), vb = this.nodes.get(b.b);
    if (!va || !vb) return null;
    const a = va.group.position.clone(), c = vb.group.position.clone();
    const dir = c.clone().sub(a);
    const len = dir.length();
    if (len < 1e-3) return null;
    dir.normalize();
    return [a.addScaledVector(dir, va.radius * 0.85), c.addScaledVector(dir, -vb.radius * 0.85)];
  }

  private addBond(b: LabBond) {
    const ends = this.endpoints(b);
    if (!ends) return;
    const [a, c] = ends;
    if (b.type === 'ionic') {
      const g = new W.BufferGeometry().setFromPoints([a, c]);
      const line = new W.Line(g, this.bondMaterial('ionic'));
      line.computeLineDistances();
      line.userData.bondId = b.id;
      this.scene.add(line);
      this.bondObjects.push(line);
      return;
    }
    const dir = c.clone().sub(a).normalize();
    const off = new W.Vector3(-dir.y, dir.x, 0).normalize();
    const n = b.type === 'covalent' ? b.order : 1;
    const m = new W.Matrix4();
    for (let i = 0; i < n; i++) {
      const shift = (i - (n - 1) / 2) * 0.32;
      const mesh = new W.Mesh(this.unitCylinder, this.bondMaterial(b.type));
      const p = new W.Vector3(), q = new W.Quaternion(), s = new W.Vector3();
      segmentMatrix(a.clone().addScaledVector(off, shift), c.clone().addScaledVector(off, shift), n > 1 ? 0.1 : 0.16, m).decompose(p, q, s);
      mesh.position.copy(p); mesh.quaternion.copy(q); mesh.scale.copy(s);
      this.scene.add(mesh);
      this.bondObjects.push(mesh);
    }
    if (b.type !== 'covalent') {
      const rule = assemblyRules.find((r) => r.id === b.ruleId);
      this.bondAnchors.push({ key: `lab-bond:${b.id}`, text: rule?.name.replace(/ \(.*\)/, '') ?? b.type, color: BOND_COLORS[b.type], pos: a.clone().lerp(c, 0.5) });
    }
  }

  /** Moves a node while dragging (visual only; the store is updated on release). */
  dragTo(id: string, x: number, y: number) {
    const v = this.nodes.get(id);
    if (!v) return;
    v.group.position.set(x, y, 0);
    v.node = { ...v.node, x, y };
    this.snapshot = { ...this.snapshot, nodes: this.snapshot.nodes.map((n) => (n.id === id ? v.node : n)) };
    this.rebuildBonds();
  }

  nodePosition(id: string) {
    return this.nodes.get(id)?.group.position;
  }

  pickables() {
    return [...this.nodes.values()].map((v) => v.pick);
  }

  resolvePick(hits: W.Intersection[]): PickResult | null {
    const h = hits.find((x) => x.object.userData.nodeId);
    if (!h) return null;
    const id = h.object.userData.nodeId as string;
    const v = this.nodes.get(id);
    if (!v) return null;
    const label = v.node.kind === 'atom' ? elements[v.node.ref as ElementSymbol].name : buildingBlocks[v.node.ref].name;
    return { target: { stage: 'lab', nodeId: id }, label, sub: 'Drag to move · Shift-click another component to combine' };
  }

  activate(rig: CameraRig, first: boolean) {
    rig.bounds = {};
    rig.setLimits({ minDistance: 8, maxDistance: 70, enablePan: true, minPolarAngle: Math.PI / 2 - 0.55, maxPolarAngle: Math.PI / 2 + 0.55 });
    if (first) rig.jumpTo(new W.Vector3(0, 0, 30), new W.Vector3(0, 0, 0));
  }

  update() { /* static scene */ }

  labelAnchors(): LabelAnchor[] {
    const nodes: LabelAnchor[] = this.snapshot.nodes.map((n) => {
      const bb = n.kind === 'block' ? buildingBlocks[n.ref] : undefined;
      const el = n.kind === 'atom' ? elements[n.ref as ElementSymbol] : undefined;
      return {
        key: `lab:${n.id}`,
        text: bb ? bb.short : el!.symbol,
        sub: bb ? bb.name : el!.name,
        color: bb ? CATEGORY_COLORS[bb.category] : el!.color,
        kind: 'lab-node' as const,
        emphasis: n.id === this.snapshot.selectedId,
      };
    });
    return [...nodes, ...this.bondAnchors.map((b) => ({ key: b.key, text: b.text, color: b.color, kind: 'lab-bond' as const }))];
  }

  labelPositions() {
    const m = new Map<string, W.Vector3>();
    for (const [id, v] of this.nodes) m.set(`lab:${id}`, v.group.position.clone().add(new W.Vector3(0, -(v.radius + 0.55), 0)));
    for (const b of this.bondAnchors) m.set(b.key, b.pos);
    return m;
  }

  dispose() {
    disposeTree(this.scene);
    this.unitCylinder.dispose();
    this.ringGeo.dispose();
    for (const m of this.bondMats.values()) m.dispose();
  }
}

function disposeMaterials(root: W.Object3D) {
  root.traverse((o) => {
    const m = (o as W.Mesh).material;
    if (m && !Array.isArray(m)) m.dispose();
  });
}
