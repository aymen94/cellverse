// Molecular representations built from structure data: ball-and-stick / space-filling
// models from atoms and bonds, and Cα tubes for protein traces. Repeated spheres and
// cylinders are instanced (one draw call per kind).

import { elements } from '../data/elements';
import type { AtomRow } from '../data/structures';
import { segmentMatrix } from './geometry';
import { W } from './wamr';

const VDW: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, P: 1.8, S: 1.8, Fe: 1.4, Mg: 1.73, Ca: 1.8 };

export function atomColor(el: string): string {
  return (elements as Record<string, { color: string }>)[el]?.color ?? '#ff69b4';
}

const sphereGeo = () => new W.SphereGeometry(1, 18, 12);
const cylGeo = () => new W.CylinderGeometry(1, 1, 1, 10, 1, true);

export interface AtomModelOptions {
  style: 'ball-stick' | 'spacefill';
  hydrogens: boolean;
  /** Scales every radius (the lab uses smaller models). */
  scale?: number;
  emissive?: string;
}

/** Builds a ball-and-stick (or space-filling) model. Returns the group and its bounding sphere. */
export function buildAtomModel(atoms: AtomRow[], bonds: [number, number, number][], opts: AtomModelOptions): { group: W.Group; center: W.Vector3; radius: number } {
  const group = new W.Group();
  const keep = atoms.map((a) => opts.hydrogens || a[0] !== 'H');
  const shown = atoms.filter((_, i) => keep[i]);
  const k = opts.scale ?? 1;
  const center = new W.Vector3();
  for (const a of shown) center.add(new W.Vector3(a[1], a[2], a[3]));
  center.divideScalar(Math.max(1, shown.length));

  const mat = new W.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.05, emissive: opts.emissive ?? '#000000' });
  const spheres = new W.InstancedMesh(sphereGeo(), mat, shown.length);
  const m = new W.Matrix4(), c = new W.Color(), p = new W.Vector3();
  let radius = 0, i = 0;
  atoms.forEach((a, idx) => {
    if (!keep[idx]) return;
    const vdw = VDW[a[0]] ?? 1.6;
    const r = (opts.style === 'spacefill' ? vdw * 0.95 : vdw * 0.22) * k;
    p.set(a[1], a[2], a[3]);
    m.compose(p, new W.Quaternion(), new W.Vector3(r, r, r));
    spheres.setMatrixAt(i, m);
    spheres.setColorAt(i, c.set(atomColor(a[0])));
    radius = Math.max(radius, p.distanceTo(center) + r);
    i++;
  });
  group.add(spheres);

  if (opts.style === 'ball-stick') {
    const visible = bonds.filter(([a, b]) => keep[a] && keep[b]);
    let n = 0;
    for (const [, , order] of visible) n += 2 * Math.min(order, 3);
    const bondMat = new W.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.05 });
    const sticks = new W.InstancedMesh(cylGeo(), bondMat, Math.max(1, n));
    const a = new W.Vector3(), b = new W.Vector3(), mid = new W.Vector3(), dir = new W.Vector3(), off = new W.Vector3();
    let j = 0;
    for (const [ia, ib, order] of visible) {
      const A = atoms[ia], B = atoms[ib];
      a.set(A[1], A[2], A[3]);
      b.set(B[1], B[2], B[3]);
      dir.subVectors(b, a).normalize();
      off.crossVectors(dir, Math.abs(dir.y) < 0.9 ? new W.Vector3(0, 1, 0) : new W.Vector3(1, 0, 0)).normalize();
      const count = Math.min(order, 3);
      const rad = (count === 1 ? 0.13 : 0.075) * k;
      for (let q = 0; q < count; q++) {
        const shift = (q - (count - 1) / 2) * 0.17 * k;
        const a2 = a.clone().addScaledVector(off, shift), b2 = b.clone().addScaledVector(off, shift);
        mid.addVectors(a2, b2).multiplyScalar(0.5);
        sticks.setMatrixAt(j, segmentMatrix(a2, mid, rad, m));
        sticks.setColorAt(j++, c.set(atomColor(A[0])));
        sticks.setMatrixAt(j, segmentMatrix(mid, b2, rad, m));
        sticks.setColorAt(j++, c.set(atomColor(B[0])));
      }
    }
    sticks.count = j;
    group.add(sticks);
  }
  return { group, center, radius };
}

const CHAIN_COLORS = ['#22d3ee', '#f472b6', '#a78bfa', '#fbbf24', '#4ade80', '#fb923c'];

/** Smooth tubes through Cα positions, one per chain. */
export function buildTrace(chains: { id: string; points: [number, number, number][] }[]): { group: W.Group; center: W.Vector3; radius: number; chainMid: Map<string, W.Vector3> } {
  const group = new W.Group();
  const center = new W.Vector3();
  let n = 0;
  for (const ch of chains) for (const p of ch.points) { center.add(new W.Vector3(p[0], p[1], p[2])); n++; }
  center.divideScalar(Math.max(1, n));
  let radius = 0;
  const chainMid = new Map<string, W.Vector3>();
  chains.forEach((ch, i) => {
    const pts = ch.points.map((p) => new W.Vector3(p[0], p[1], p[2]));
    for (const p of pts) radius = Math.max(radius, p.distanceTo(center));
    if (pts.length < 2) return;
    const tube = new W.TubeGeometry(new W.CatmullRomCurve3(pts), pts.length * 5, 0.45, 8);
    const mat = new W.MeshStandardMaterial({ color: CHAIN_COLORS[i % CHAIN_COLORS.length], roughness: 0.45, metalness: 0.05 });
    group.add(new W.Mesh(tube, mat));
    chainMid.set(ch.id, pts[Math.floor(pts.length / 2)].clone());
  });
  return { group, center, radius: radius + 1, chainMid };
}
