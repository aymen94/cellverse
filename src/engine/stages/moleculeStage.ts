// Shows one molecule: an atomic model, a protein trace, or a labelled schematic.

import { loadStructure } from '../../data/structures';
import type { SchematicKind, StructureKey, StructureRef } from '../../types/science';
import type { CameraRig } from '../cameraRig';
import { rng, segmentMatrix } from '../geometry';
import { buildAtomModel, buildTrace } from '../molecular';
import type { LabelAnchor, MoleculeViewOptions } from '../types';
import { W } from '../wamr';
import { disposeTree, type PickResult, type Stage } from './stage';

const CHAIN_NAMES: Partial<Record<StructureKey, Record<string, string>>> = {
  hemoglobin: { A: 'α₁ chain', B: 'β₁ chain', C: 'α₂ chain', D: 'β₂ chain' },
  collagen: { A: 'Strand 1', B: 'Strand 2', C: 'Strand 3' },
  actin: { A: 'Actin chain' },
  lysozyme: { A: 'Lysozyme chain (129 residues)' },
};

interface Anchor { key: string; text: string; sub?: string; color?: string; pos: W.Vector3 }

export class MoleculeStage implements Stage {
  readonly scene = new W.Scene();
  private readonly root = new W.Group();
  private anchors: Anchor[] = [];
  private fit = { radius: 10 };
  private token = 0;
  onChange?: () => void;
  /** Called after a molecule is built so the engine can frame it. */
  onFramed?: () => void;

  constructor() {
    this.scene.background = new W.Color('#050a14');
    this.scene.add(new W.HemisphereLight('#e0f2fe', '#0b1730', 1.3));
    const key = new W.DirectionalLight('#ffffff', 1.8);
    key.position.set(10, 14, 12);
    const fill = new W.DirectionalLight('#5eead4', 0.5);
    fill.position.set(-12, -4, -8);
    this.scene.add(key, fill, this.root);
  }

  async show(ref: StructureRef, opts: MoleculeViewOptions) {
    const token = ++this.token;
    let built: { group: W.Group; center: W.Vector3; radius: number; anchors: Anchor[] };
    if (ref.type === 'file') {
      const data = await loadStructure(ref.key);
      if (token !== this.token) return;
      if (data.kind === 'atoms') {
        const m = buildAtomModel(data.atoms, data.bonds, opts);
        built = { ...m, anchors: ref.key === 'dna' ? this.dnaAnchors(data.atoms, m.center) : [] };
      } else {
        const t = buildTrace(data.chains);
        const anchors: Anchor[] = [...t.chainMid].map(([id, pos]) => ({ key: `chain-${id}`, text: CHAIN_NAMES[ref.key]?.[id] ?? `Chain ${id}`, pos }));
        if (data.ligands.atoms.length) {
          const lig = buildAtomModel(data.ligands.atoms, data.ligands.bonds, { ...opts, style: opts.style });
          t.group.add(lig.group);
          const name = data.ligands.names.includes('HEM') ? 'Heme (Fe²⁺)' : data.ligands.names.join(', ');
          const fe = data.ligands.atoms.find((a) => a[0] === 'Fe') ?? data.ligands.atoms[0];
          anchors.push({ key: 'ligand', text: name, sub: 'bound cofactor', color: '#e06633', pos: new W.Vector3(fe[1], fe[2], fe[3]) });
        }
        built = { group: t.group, center: t.center, radius: t.radius, anchors };
      }
    } else {
      built = buildSchematic(ref.kind);
    }
    if (token !== this.token) { disposeTree(built.group); return; }
    this.clear();
    built.group.position.copy(built.center).negate();
    this.root.add(built.group);
    this.anchors = built.anchors.map((a) => ({ ...a, pos: a.pos.clone().sub(built.center) }));
    this.fit.radius = Math.max(2, built.radius);
    this.onChange?.();
    this.onFramed?.();
  }

  private dnaAnchors(atoms: [string, number, number, number][], center: W.Vector3): Anchor[] {
    // The backbone is on the outside of the helix (phosphorus), base pairs in the middle.
    const ps = atoms.filter((a) => a[0] === 'P').map((a) => new W.Vector3(a[1], a[2], a[3]));
    const far = ps.reduce((best, p) => (p.distanceTo(center) > best.distanceTo(center) ? p : best), ps[0]);
    return [
      { key: 'backbone', text: 'Sugar–phosphate backbone', sub: 'phosphodiester bonds', color: '#ff8000', pos: far },
      { key: 'pairs', text: 'Base pairs', sub: 'A–T and G–C hydrogen bonds', color: '#3050f8', pos: center.clone() },
    ];
  }

  frame(rig: CameraRig, instant: boolean) {
    const r = this.fit.radius;
    const dist = r / Math.sin((rig.camera.fov * Math.PI) / 360) * 1.05;
    rig.bounds = {};
    rig.setLimits({ minDistance: r * 0.4, maxDistance: dist * 3, enablePan: true });
    const pos = new W.Vector3(0.35, 0.25, 1).normalize().multiplyScalar(dist);
    if (instant) rig.jumpTo(pos, new W.Vector3());
    else rig.flyTo(pos, new W.Vector3(), 0.8);
  }

  private clear() {
    for (const c of [...this.root.children]) {
      this.root.remove(c);
      disposeTree(c);
    }
    this.anchors = [];
  }

  pickables() { return []; }
  resolvePick(): PickResult | null { return null; }
  activate(rig: CameraRig) { this.frame(rig, true); }
  update(dt: number, _time: number, _camera: W.PerspectiveCamera) {
    if (this.autoRotate) this.root.rotation.y += dt * 0.15;
  }
  autoRotate = true;

  labelAnchors(): LabelAnchor[] {
    return this.anchors.map((a) => ({ key: `mol:${a.key}`, text: a.text, sub: a.sub, color: a.color, kind: 'molecule' as const }));
  }

  labelPositions() {
    const m = new Map<string, W.Vector3>();
    this.root.updateMatrixWorld(true);
    for (const a of this.anchors) m.set(`mol:${a.key}`, a.pos.clone().applyMatrix4(this.root.matrixWorld));
    return m;
  }

  dispose() {
    this.clear();
    disposeTree(this.scene);
  }
}

// --- Schematic educational models -------------------------------------------------

const BASE_COLORS: Record<string, string> = { A: '#4ade80', U: '#f87171', G: '#fbbf24', C: '#60a5fa' };

function buildSchematic(kind: SchematicKind): { group: W.Group; center: W.Vector3; radius: number; anchors: Anchor[] } {
  const group = new W.Group();
  const anchors: Anchor[] = [];
  const ring = new W.CylinderGeometry(0.55, 0.55, 0.22, 6);
  const link = new W.CylinderGeometry(1, 1, 1, 8);
  const tokens: { pos: W.Vector3; normal: W.Vector3; color: string }[] = [];
  const links: { a: W.Vector3; b: W.Vector3; color: string }[] = [];
  const glucose = '#e2e8f0';

  if (kind === 'amylose') {
    // Left-handed helix, about six glucoses per turn.
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = -(i / 6) * Math.PI * 2;
      tokens.push({ pos: new W.Vector3(Math.cos(a) * 1.6, i * 0.32 - (n * 0.32) / 2, Math.sin(a) * 1.6), normal: new W.Vector3(Math.cos(a), 0.2, Math.sin(a)).normalize(), color: glucose });
      if (i) links.push({ a: tokens[i - 1].pos, b: tokens[i].pos, color: '#94a3b8' });
    }
    anchors.push({ key: 'helix', text: 'α-1,4 linked glucose helix', sub: '≈6 glucose units per turn', pos: tokens[3].pos.clone() });
    anchors.push({ key: 'unit', text: 'One glucose unit', sub: 'C₆H₁₀O₅ residue', pos: tokens[n - 2].pos.clone() });
  } else if (kind === 'glycogen') {
    const branchPoints: W.Vector3[] = [];
    const rand = rng(7);
    const grow = (start: W.Vector3, dir: W.Vector3, len: number, depth: number) => {
      let prev = start;
      for (let i = 1; i <= len; i++) {
        const p = start.clone().addScaledVector(dir, i * 1.25);
        tokens.push({ pos: p, normal: new W.Vector3(0, 0, 1), color: glucose });
        links.push({ a: prev, b: p, color: '#94a3b8' });
        if (depth < 3 && (i === 3 || i === 6)) {
          const nd = dir.clone().applyAxisAngle(new W.Vector3(0, 0, 1), (i === 3 ? 1 : -1) * 0.75).applyAxisAngle(new W.Vector3(1, 0, 0), (rand() - 0.5) * 0.6);
          const b = p.clone().addScaledVector(nd, 1.25);
          tokens.push({ pos: b, normal: new W.Vector3(0, 0, 1), color: glucose });
          links.push({ a: p, b, color: '#fb923c' });
          branchPoints.push(p.clone().lerp(b, 0.5));
          grow(b, nd, Math.max(3, len - 3), depth + 1);
        }
        prev = p;
      }
    };
    const core = new W.Vector3(0, -6, 0);
    tokens.push({ pos: core, normal: new W.Vector3(0, 0, 1), color: '#22d3ee' });
    grow(core, new W.Vector3(0, 1, 0), 8, 0);
    anchors.push({ key: 'core', text: 'Glycogenin (protein primer)', sub: 'reducing end attached here', color: '#22d3ee', pos: core.clone() });
    anchors.push({ key: 'branch', text: 'α-1,6 branch point', sub: 'orange links', color: '#fb923c', pos: branchPoints[0] });
    anchors.push({ key: 'chain', text: 'α-1,4 chain', sub: 'grey links', pos: tokens[2].pos.clone() });
  } else if (kind === 'cellulose') {
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 12; i++) {
        // Alternate glucoses are flipped 180°: shown by tilting tokens up and down.
        const pos = new W.Vector3(i * 1.25 - 7, c * 1.6 - 1.6, 0);
        tokens.push({ pos, normal: new W.Vector3(0, i % 2 ? 0.35 : -0.35, 1).normalize(), color: glucose });
        if (i) links.push({ a: tokens[tokens.length - 2].pos, b: pos, color: '#94a3b8' });
      }
    }
    anchors.push({ key: 'chain', text: 'β-1,4 glucose chain', sub: 'every other unit flipped', pos: tokens[5].pos.clone() });
    anchors.push({ key: 'hbonds', text: 'Inter-chain hydrogen bonds', sub: 'dashed lines', color: '#22d3ee', pos: tokens[12 + 8].pos.clone().add(new W.Vector3(0, -0.8, 0)) });
  } else {
    // mRNA: cap, 5′ UTR, start codon, codons, stop codon, 3′ UTR, poly(A) tail.
    const seq = 'GACUUCAUGGCUAAAGGCUUCGAAUCUGGUCACUAAGCUCCAAUAAAAAAAAAAAAAAAA';
    const at = (i: number) => new W.Vector3(i * 0.55 - (seq.length * 0.55) / 2, Math.sin(i * 0.25) * 1.4, Math.cos(i * 0.18) * 0.8);
    const cap = at(-1.6);
    tokens.push({ pos: cap, normal: new W.Vector3(0, 0, 1), color: '#c084fc' });
    for (let i = 0; i < seq.length; i++) {
      const p = at(i);
      tokens.push({ pos: p, normal: new W.Vector3(0, 0, 1), color: BASE_COLORS[seq[i]] });
      links.push({ a: i ? at(i - 1) : cap, b: p, color: '#64748b' });
    }
    anchors.push({ key: 'cap', text: '5′ cap (7-methylguanosine)', color: '#c084fc', pos: cap.clone() });
    anchors.push({ key: 'start', text: 'Start codon AUG', sub: 'translation begins', color: '#4ade80', pos: at(7) });
    anchors.push({ key: 'cds', text: 'Coding sequence', sub: 'read in codons of 3 nucleotides', pos: at(20) });
    anchors.push({ key: 'stop', text: 'Stop codon UAA', color: '#f87171', pos: at(34) });
    anchors.push({ key: 'polyA', text: 'Poly(A) tail', sub: '3′ end', color: '#4ade80', pos: at(52) });
  }

  const ringMat = new W.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const rings = new W.InstancedMesh(kind === 'mrna' ? new W.SphereGeometry(0.28, 14, 10) : ring, ringMat, tokens.length);
  const m = new W.Matrix4(), q = new W.Quaternion(), c = new W.Color();
  tokens.forEach((t, i) => {
    q.setFromUnitVectors(new W.Vector3(0, 1, 0), t.normal);
    m.compose(t.pos, q, new W.Vector3(1, 1, 1));
    rings.setMatrixAt(i, m);
    rings.setColorAt(i, c.set(t.color));
  });
  const linkMat = new W.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const sticks = new W.InstancedMesh(link, linkMat, Math.max(1, links.length));
  links.forEach((l, i) => {
    sticks.setMatrixAt(i, segmentMatrix(l.a, l.b, kind === 'mrna' ? 0.07 : 0.09, m));
    sticks.setColorAt(i, c.set(l.color));
  });
  group.add(rings, sticks);

  if (kind === 'cellulose') {
    const seg: number[] = [];
    for (let c2 = 0; c2 < 2; c2++) {
      for (let i = 0; i < 12; i += 1) {
        const a = tokens[c2 * 12 + i].pos, b = tokens[(c2 + 1) * 12 + i].pos;
        seg.push(a.x, a.y + 0.3, a.z, b.x, b.y - 0.3, b.z);
      }
    }
    const g = new W.BufferGeometry();
    g.setAttribute('position', new W.Float32BufferAttribute(seg, 3));
    const lines = new W.LineSegments(g, new W.LineDashedMaterial({ color: '#22d3ee', dashSize: 0.15, gapSize: 0.1 }));
    lines.computeLineDistances();
    group.add(lines);
  }

  const center = new W.Vector3();
  tokens.forEach((t) => center.add(t.pos));
  center.divideScalar(tokens.length);
  const radius = tokens.reduce((r, t) => Math.max(r, t.pos.distanceTo(center)), 0) + 1;
  return { group, center, radius, anchors };
}
