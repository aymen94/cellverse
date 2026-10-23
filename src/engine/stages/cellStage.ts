// The eukaryotic animal cell: geometry, materials, picking, highlighting and the small
// amount of animation (vesicle traffic). Sizes are in arbitrary scene units with the
// cell radius R = 10; small structures are enlarged so they stay visible.

import { organelles } from '../../data/organelles';
import type { OrganelleId } from '../../types/science';
import type { CameraRig } from '../cameraRig';
import { blobGeometry, mergeGeometries, randomDirection, rng, sheetGeometry, wobble } from '../geometry';
import type { LabelAnchor } from '../types';
import { W } from '../wamr';
import { disposeTree, type PickResult, type Stage } from './stage';

import { CELL_RADIUS } from '../constants';

const R = CELL_RADIUS;
const NUC = new W.Vector3(-0.8, 0.4, 0.3);
const NUC_R = 3.1;
const GOLGI = new W.Vector3(4.4, 0.7, 0.9);
const CENTROSOME = new W.Vector3(2.7, -0.7, -1.2);
const NUCLEOLUS = new W.Vector3(-0.1, 0.95, 0.7);

const ACCENT = new W.Color('#22d3ee');

interface Instance {
  center: W.Vector3;
  radius: number;
  /** World matrix of the instance (for halos). */
  matrix: W.Matrix4;
}

interface Visual {
  id: OrganelleId;
  objects: W.Object3D[];
  materials: W.MeshStandardMaterial[];
  instances: Instance[];
  /** Geometry drawn (enlarged) as the selection halo of one instance. */
  haloGeometry?: W.BufferGeometry;
  label: W.Vector3;
}

const membraneRadius = (x: number, y: number, z: number) => R + 0.55 * wobble(x * 1.3, y * 1.3, z * 1.3, 2.0);

function material(color: string, extra: Record<string, unknown> = {}) {
  return new W.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
}

const tmpM = new W.Matrix4();
const tmpQ = new W.Quaternion();
const tmpS = new W.Vector3();
const Z = new W.Vector3(0, 0, 1);
const Y = new W.Vector3(0, 1, 0);

export class CellStage implements Stage {
  readonly scene = new W.Scene();
  private readonly visuals = new Map<OrganelleId, Visual>();
  private readonly pickList: W.Object3D[] = [];
  private readonly glass = new Set<W.Object3D>();
  private readonly halo: W.Mesh;
  private readonly haloMat = new W.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.35, side: W.BackSide, depthWrite: false });
  private readonly membraneClip = new W.Plane(new W.Vector3(0, 0, -1), 0);
  private readonly nucleusClip = new W.Plane(new W.Vector3(0, 0, -1), 0);
  private readonly clipMaterials: W.Material[] = [];
  private readonly nucleusClipMaterials: W.Material[] = [];
  private readonly vesicleTracks: { mesh: W.InstancedMesh; index: number; curve: W.CatmullRomCurve3; speed: number; offset: number; scale: number }[] = [];
  private readonly fog = new W.FogExp2('#08111f', 0);
  private selected: { id: OrganelleId; instance?: number } | null = null;
  private highlighted = new Set<OrganelleId>();
  private cutaway = false;
  inside = false;
  animate = true;

  constructor() {
    this.scene.background = new W.Color('#050a14');
    this.scene.fog = this.fog;
    this.buildLights();
    this.buildMembrane();
    this.buildCytoplasm();
    this.buildNucleus();
    this.buildEndomembrane();
    this.buildOrganelles();
    this.buildCytoskeleton();
    this.halo = new W.Mesh(new W.SphereGeometry(1, 8, 6), this.haloMat);
    this.halo.visible = false;
    this.halo.renderOrder = 10;
    this.scene.add(this.halo);
  }

  // --- Construction -------------------------------------------------------------

  private register(id: OrganelleId, objects: W.Object3D[], materials: W.MeshStandardMaterial[], instances: Instance[], label: W.Vector3, haloGeometry?: W.BufferGeometry, glass = false) {
    for (const o of objects) {
      o.userData.organelleId = id;
      this.pickList.push(o);
      if (glass) this.glass.add(o);
    }
    const existing = this.visuals.get(id);
    if (existing) {
      existing.objects.push(...objects);
      existing.materials.push(...materials);
      existing.instances.push(...instances);
      return;
    }
    this.visuals.set(id, { id, objects, materials, instances, label, haloGeometry });
  }

  private buildLights() {
    this.scene.add(new W.HemisphereLight('#bde7ff', '#0b1730', 1.1));
    const key = new W.DirectionalLight('#ffffff', 1.6);
    key.position.set(12, 18, 14);
    this.scene.add(key);
    const rim = new W.DirectionalLight('#5eead4', 0.6);
    rim.position.set(-16, -6, -12);
    this.scene.add(rim);
    const inner = new W.PointLight('#ffe8c7', 2.2, 18, 1.4);
    inner.position.set(2, 3, 4);
    this.scene.add(inner);
  }

  private buildMembrane() {
    const outerMat = material('#5eead4', { transparent: true, opacity: 0.13, side: W.DoubleSide, depthWrite: false, roughness: 0.3 });
    const innerMat = material('#2dd4bf', { transparent: true, opacity: 0.08, side: W.DoubleSide, depthWrite: false, roughness: 0.3 });
    const outer = new W.Mesh(blobGeometry(5, [0, 0, 0], (x, y, z) => membraneRadius(x, y, z)), outerMat);
    const inner = new W.Mesh(blobGeometry(5, [0, 0, 0], (x, y, z) => membraneRadius(x, y, z) - 0.18), innerMat);
    outer.renderOrder = 2;
    inner.renderOrder = 1;
    this.scene.add(outer, inner);
    this.clipMaterials.push(outerMat, innerMat);

    // Membrane proteins: small bumps oriented along the surface normal.
    const r = rng(11);
    const count = 260;
    const protGeo = blobGeometry(1, [0.12, 0.22, 0.12], () => 0);
    const protMat = material('#99f6e4', { roughness: 0.4 });
    this.clipMaterials.push(protMat);
    const prots = new W.InstancedMesh(protGeo, protMat, count);
    const d = new W.Vector3();
    const instances: Instance[] = [];
    const color = new W.Color();
    for (let i = 0; i < count; i++) {
      randomDirection(r, d);
      const rad = membraneRadius(d.x, d.y, d.z) - 0.05;
      const pos = d.clone().multiplyScalar(rad);
      tmpQ.setFromUnitVectors(Y, d);
      const s = 0.55 + r() * 0.5;
      const m = new W.Matrix4().compose(pos, tmpQ, tmpS.set(s, s * (0.8 + r() * 0.6), s));
      prots.setMatrixAt(i, m);
      prots.setColorAt(i, color.set(r() < 0.15 ? '#c4b5fd' : '#99f6e4'));
      if (i < 1) instances.push({ center: pos, radius: 0.5, matrix: m });
    }
    this.scene.add(prots);
    const top = new W.Vector3(0, membraneRadius(0, 1, 0), 0);
    this.register('plasma-membrane', [outer, inner], [outerMat, innerMat], [{ center: top, radius: 2.5, matrix: new W.Matrix4() }], new W.Vector3(5.2, 7.6, 4.6), undefined, true);
    this.register('plasma-membrane', [prots], [protMat], instances, top);
  }

  private buildCytoplasm() {
    const r = rng(5);
    const pts: number[] = [];
    const d = new W.Vector3();
    while (pts.length < 2600 * 3) {
      randomDirection(r, d).multiplyScalar(Math.cbrt(r()) * (R - 0.8));
      if (d.distanceTo(NUC) < NUC_R + 0.25) continue;
      pts.push(d.x, d.y, d.z);
    }
    const g = new W.BufferGeometry();
    g.setAttribute('position', new W.Float32BufferAttribute(pts, 3));
    const cyto = new W.Points(g, new W.PointsMaterial({ color: '#93c5fd', size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.45, depthWrite: false }));
    this.scene.add(cyto);
    // Faint particles outside the cell, for depth.
    const out: number[] = [];
    while (out.length < 500 * 3) {
      randomDirection(r, d).multiplyScalar(16 + r() * 40);
      out.push(d.x, d.y, d.z);
    }
    const g2 = new W.BufferGeometry();
    g2.setAttribute('position', new W.Float32BufferAttribute(out, 3));
    this.scene.add(new W.Points(g2, new W.PointsMaterial({ color: '#334155', size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false })));
    // The cytoplasm itself is selected by clicking empty space inside the cell.
    this.visuals.set('cytoplasm', { id: 'cytoplasm', objects: [cyto], materials: [], instances: [{ center: new W.Vector3(5, -3, 4), radius: 2.5, matrix: new W.Matrix4() }], label: new W.Vector3(4.5, -4.5, 5) });
  }

  private buildNucleus() {
    const envelopeOuter = material('#c4b5fd', { transparent: true, opacity: 0.32, side: W.DoubleSide, depthWrite: false, roughness: 0.35 });
    const envelopeInner = material('#a78bfa', { transparent: true, opacity: 0.18, side: W.DoubleSide, depthWrite: false, roughness: 0.35 });
    const shape = (x: number, y: number, z: number) => 0.08 * wobble(x * 2, y * 2, z * 2, 7);
    const outer = new W.Mesh(blobGeometry(4, [NUC_R + 0.12, NUC_R * 0.94 + 0.12, NUC_R + 0.12], shape), envelopeOuter);
    const inner = new W.Mesh(blobGeometry(4, [NUC_R, NUC_R * 0.94, NUC_R], shape), envelopeInner);
    outer.position.copy(NUC);
    inner.position.copy(NUC);
    outer.renderOrder = 4;
    inner.renderOrder = 3;
    this.scene.add(outer, inner);
    this.nucleusClipMaterials.push(envelopeOuter, envelopeInner);
    const envelopeInstance = { center: NUC.clone(), radius: NUC_R, matrix: new W.Matrix4().makeTranslation(NUC.x, NUC.y, NUC.z) };
    this.register('nuclear-envelope', [outer, inner], [envelopeOuter, envelopeInner], [envelopeInstance], NUC.clone().add(new W.Vector3(-1.6, 2.7, 1.2)), undefined, true);

    // Chromatin: coiled strands inside the nucleus.
    const r = rng(21);
    const parts: { geometry: W.BufferGeometry }[] = [];
    for (let k = 0; k < 9; k++) {
      const pts: W.Vector3[] = [];
      const p = randomDirection(r).multiplyScalar(r() * 1.6);
      for (let i = 0; i < 14; i++) {
        p.add(randomDirection(r).multiplyScalar(0.55));
        if (p.length() > 2.4) p.setLength(2.0);
        pts.push(p.clone().add(NUC));
      }
      parts.push({ geometry: new W.TubeGeometry(new W.CatmullRomCurve3(pts), 70, 0.07, 5) });
    }
    const chromatinMat = material('#8b5cf6', { roughness: 0.7, emissive: '#1e1048' });
    const chromatin = new W.Mesh(mergeGeometries(parts), chromatinMat);
    this.scene.add(chromatin);
    this.register('nucleus', [chromatin], [chromatinMat], [envelopeInstance], NUC.clone().add(new W.Vector3(1.4, 2.4, 2.0)));

    // Nucleolus.
    const nucleolusGeo = blobGeometry(3, [0.95, 0.85, 0.9], (x, y, z) => 0.07 * wobble(x * 4, y * 4, z * 4, 3));
    const nucleolusMat = material('#6d28d9', { roughness: 0.8 });
    const nucleolus = new W.Mesh(nucleolusGeo, nucleolusMat);
    nucleolus.position.copy(NUCLEOLUS);
    this.scene.add(nucleolus);
    this.register('nucleolus', [nucleolus], [nucleolusMat], [{ center: NUCLEOLUS.clone(), radius: 1, matrix: new W.Matrix4().makeTranslation(NUCLEOLUS.x, NUCLEOLUS.y, NUCLEOLUS.z) }], NUCLEOLUS.clone().add(new W.Vector3(0, 1.1, 0)), nucleolusGeo);

    // Nuclear pores: rings on the envelope.
    const poreGeo = new W.TorusGeometry(0.17, 0.06, 6, 14);
    const poreMat = material('#f5f3ff', { roughness: 0.4, emissive: '#2e1065' });
    const count = 90;
    const pores = new W.InstancedMesh(poreGeo, poreMat, count);
    const d = new W.Vector3();
    const instances: Instance[] = [];
    for (let i = 0; i < count; i++) {
      randomDirection(r, d);
      const pos = d.clone().multiply(new W.Vector3(NUC_R + 0.14, NUC_R * 0.94 + 0.14, NUC_R + 0.14)).add(NUC);
      tmpQ.setFromUnitVectors(Z, d);
      const m = new W.Matrix4().compose(pos, tmpQ, tmpS.set(1, 1, 1));
      pores.setMatrixAt(i, m);
      instances.push({ center: pos, radius: 0.25, matrix: m });
    }
    this.scene.add(pores);
    this.register('nuclear-pore', [pores], [poreMat], instances, instances[3].center.clone().add(new W.Vector3(0, 0.35, 0)), poreGeo);
  }

  private buildEndomembrane() {
    const r = rng(31);
    // Rough ER: stacked, ribbon-like cisternae wrapped around the nucleus (away from the Golgi side).
    const rerMat = material('#38bdf8', { roughness: 0.5, side: W.DoubleSide, emissive: '#04263a' });
    const sheets: W.Mesh[] = [];
    const layers = [NUC_R + 0.75, NUC_R + 1.3, NUC_R + 1.85];
    const theta: [number, number] = [1.1, 5.1];
    const bands: [number, number][] = [[0.55, 0.95], [1.1, 1.5], [1.65, 2.05], [2.2, 2.55]];
    const sheetR = (base: number, seed: number) => (x: number, y: number, z: number) => base + 0.18 * wobble(x * 3.2, y * 3.2, z * 3.2, seed) + 0.12 * Math.sin(Math.atan2(z, x) * 7 + seed);
    const ribosomes: W.Vector3[] = [];
    layers.forEach((base, li) => {
      bands.forEach((band, bi) => {
        const fn = sheetR(base, li * 3 + bi + 1);
        const shift = (li % 2) * 0.35 + bi * 0.2;
        const th: [number, number] = [theta[0] + shift + r() * 0.3, theta[1] - r() * 0.5 - shift * 0.5];
        const mesh = new W.Mesh(sheetGeometry(fn, band, th, 72, 8), rerMat);
        mesh.position.copy(NUC);
        sheets.push(mesh);
        for (let i = 0; i < 110; i++) {
          const ph = band[0] + 0.03 + r() * (band[1] - band[0] - 0.06), t2 = th[0] + 0.03 + r() * (th[1] - th[0] - 0.06);
          const x = Math.sin(ph) * Math.cos(t2), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(t2);
          const rad = fn(x, y, z) + (r() < 0.5 ? 0.08 : -0.08);
          ribosomes.push(new W.Vector3(x * rad, y * rad, z * rad).add(NUC));
        }
      });
    });
    this.scene.add(...sheets);
    const rerCenter = NUC.clone().add(new W.Vector3(-NUC_R - 1.3, 0, 0));
    this.register('rough-er', sheets, [rerMat], [{ center: rerCenter, radius: 2.5, matrix: new W.Matrix4() }], NUC.clone().add(new W.Vector3(-4.6, 1.8, -1.2)));

    // Smooth ER: tubular network beyond the rough ER.
    const tubes: { geometry: W.BufferGeometry }[] = [];
    for (let k = 0; k < 16; k++) {
      const th = theta[0] + r() * (theta[1] - theta[0]);
      const ph = 0.6 + r() * 1.9;
      const start = new W.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).multiplyScalar(NUC_R + 2.4).add(NUC);
      const pts = [start];
      const p = start.clone();
      for (let i = 0; i < 6; i++) {
        p.add(randomDirection(r).multiplyScalar(0.9)).add(p.clone().sub(NUC).normalize().multiplyScalar(0.25));
        if (p.length() > R - 1.4) p.setLength(R - 1.6);
        pts.push(p.clone());
      }
      tubes.push({ geometry: new W.TubeGeometry(new W.CatmullRomCurve3(pts), 48, 0.1, 6) });
    }
    const serMat = material('#22d3ee', { roughness: 0.45, emissive: '#032c33' });
    const ser = new W.Mesh(mergeGeometries(tubes), serMat);
    this.scene.add(ser);
    this.register('smooth-er', [ser], [serMat], [{ center: NUC.clone().add(new W.Vector3(-5.2, -1.8, 1.5)), radius: 2.2, matrix: new W.Matrix4() }], NUC.clone().add(new W.Vector3(-5.6, -2.6, 2.4)));

    // Ribosomes: on the rough ER and free in the cytosol (one instanced mesh).
    const free: W.Vector3[] = [];
    const d = new W.Vector3();
    while (free.length < 700) {
      randomDirection(r, d).multiplyScalar(3.8 + r() * (R - 4.8));
      if (d.distanceTo(NUC) < NUC_R + 0.6 || d.distanceTo(GOLGI) < 2) continue;
      free.push(d.clone());
    }
    const all = [...ribosomes, ...free];
    // 20 triangles each: ribosomes are tiny on screen and there are about two thousand.
    const riboGeo = new W.IcosahedronGeometry(0.08, 0);
    const riboMat = material('#fbbf24', { roughness: 0.5, emissive: '#3b2600' });
    const ribos = new W.InstancedMesh(riboGeo, riboMat, all.length);
    const instances: Instance[] = [];
    all.forEach((p, i) => {
      const m = new W.Matrix4().makeTranslation(p.x, p.y, p.z);
      ribos.setMatrixAt(i, m);
      instances.push({ center: p, radius: 0.08, matrix: m });
    });
    this.scene.add(ribos);
    this.register('ribosome', [ribos], [riboMat], instances, all[40].clone().add(new W.Vector3(0, 0.3, 0)), riboGeo);

    // Golgi apparatus: a stack of curved cisternae, concave side away from the nucleus.
    const axis = GOLGI.clone().sub(NUC).normalize();
    const golgiMat = material('#fb923c', { roughness: 0.45, emissive: '#3a1503' });
    const cisternae: { geometry: W.BufferGeometry; matrix: W.Matrix4 }[] = [];
    for (let i = 0; i < 6; i++) {
      const s = 1.05 - Math.abs(i - 2.5) * 0.06;
      const g = blobGeometry(3, [1.55 * s, 0.11, 1.05 * s], (x, y, z) => 0.03 * wobble(x * 5, y * 5, z * 5, i), (p) => { p[1] += 0.22 * (p[0] * p[0] + p[2] * p[2]); });
      cisternae.push({ geometry: g, matrix: new W.Matrix4().makeTranslation(0, (i - 2.5) * 0.3, 0) });
    }
    const golgiGeo = mergeGeometries(cisternae);
    const golgi = new W.Mesh(golgiGeo, golgiMat);
    golgi.position.copy(GOLGI);
    golgi.quaternion.setFromUnitVectors(Y, axis);
    this.scene.add(golgi);
    golgi.updateMatrixWorld(true);
    this.register('golgi', [golgi], [golgiMat], [{ center: GOLGI.clone(), radius: 1.7, matrix: golgi.matrixWorld.clone() }], GOLGI.clone().add(new W.Vector3(0.2, 1.7, 0.4)), golgiGeo);

    // Vesicles: some parked near the Golgi rims, others travelling ER → Golgi → membrane.
    const vesGeo = blobGeometry(2, [0.17, 0.17, 0.17], () => 0);
    const vesMat = material('#facc15', { roughness: 0.35, emissive: '#2b2100' });
    const parked = 16, moving = 18;
    const ves = new W.InstancedMesh(vesGeo, vesMat, parked + moving);
    const vInstances: Instance[] = [];
    const side = new W.Vector3().crossVectors(axis, Y).normalize();
    const up2 = new W.Vector3().crossVectors(side, axis).normalize();
    for (let i = 0; i < parked; i++) {
      const a = (i / parked) * Math.PI * 2;
      const pos = GOLGI.clone().addScaledVector(side, Math.cos(a) * (1.9 + r() * 0.4)).addScaledVector(up2, Math.sin(a) * (1.4 + r() * 0.3)).addScaledVector(axis, (r() - 0.5) * 1.6);
      const s = 0.8 + r() * 0.5;
      const m = new W.Matrix4().compose(pos, tmpQ.identity(), tmpS.set(s, s, s));
      ves.setMatrixAt(i, m);
      vInstances.push({ center: pos, radius: 0.2 * s, matrix: m });
    }
    const cis = GOLGI.clone().addScaledVector(axis, -1.1);
    const trans = GOLGI.clone().addScaledVector(axis, 1.1);
    for (let i = 0; i < moving; i++) {
      const toGolgi = i < 7;
      let curve: W.CatmullRomCurve3;
      if (toGolgi) {
        const startDir = axis.clone().add(randomDirection(r).multiplyScalar(0.7)).normalize();
        const start = startDir.multiplyScalar(NUC_R + 1.7).add(NUC);
        const mid = start.clone().lerp(cis, 0.5).add(randomDirection(r).multiplyScalar(0.6));
        curve = new W.CatmullRomCurve3([start, mid, cis.clone().addScaledVector(side, (r() - 0.5) * 1.2)]);
      } else {
        const dir = axis.clone().add(randomDirection(r).multiplyScalar(0.9)).normalize();
        const end = dir.clone().multiplyScalar(membraneRadius(dir.x, dir.y, dir.z) - 0.45);
        const mid = trans.clone().lerp(end, 0.5).add(randomDirection(r).multiplyScalar(1.2));
        curve = new W.CatmullRomCurve3([trans.clone().addScaledVector(side, (r() - 0.5) * 1.4), mid, end]);
      }
      const idx = parked + i;
      const s = 0.85 + r() * 0.4;
      const start = curve.getPointAt(0);
      const m = new W.Matrix4().compose(start, tmpQ.identity(), tmpS.set(s, s, s));
      ves.setMatrixAt(idx, m);
      this.vesicleTracks.push({ mesh: ves, index: idx, curve, speed: 0.04 + r() * 0.04, offset: r(), scale: s });
      vInstances.push({ center: start, radius: 0.2 * s, matrix: m });
    }
    this.scene.add(ves);
    this.register('vesicle', [ves], [vesMat], vInstances, vInstances[2].center.clone().add(new W.Vector3(0, 0.45, 0)), vesGeo);
  }

  private placeAway(r: () => number, minR: number, maxR: number, clearance: number, taken: { c: W.Vector3; r: number }[]) {
    const d = new W.Vector3();
    for (let tries = 0; tries < 400; tries++) {
      randomDirection(r, d).multiplyScalar(minR + r() * (maxR - minR));
      if (d.distanceTo(NUC) < NUC_R + 2.2 + clearance) continue;
      if (taken.some((t) => t.c.distanceTo(d) < t.r + clearance)) continue;
      const c = d.clone();
      taken.push({ c, r: clearance });
      return c;
    }
    return d.clone();
  }

  private buildOrganelles() {
    const r = rng(41);
    const taken: { c: W.Vector3; r: number }[] = [{ c: GOLGI.clone(), r: 2.2 }, { c: CENTROSOME.clone(), r: 1 }];

    // Mitochondria: elongated, with ridges that suggest cristae.
    const mitoGeo = blobGeometry(4, [0.46, 1.25, 0.46], (x, y) => 0.035 * Math.sin(y * Math.PI * 7) + 0.015 * Math.sin(x * 20));
    const mitoMat = material('#f87171', { roughness: 0.45, emissive: '#2a0606' });
    const n = 16;
    const mitos = new W.InstancedMesh(mitoGeo, mitoMat, n);
    const inst: Instance[] = [];
    const color = new W.Color();
    for (let i = 0; i < n; i++) {
      const pos = this.placeAway(r, 4.5, R - 1.9, 1.5, taken);
      tmpQ.setFromUnitVectors(Y, randomDirection(r));
      const s = 0.85 + r() * 0.35;
      const m = new W.Matrix4().compose(pos, tmpQ, tmpS.set(s, s * (0.9 + r() * 0.35), s));
      mitos.setMatrixAt(i, m);
      mitos.setColorAt(i, color.setHSL(0.0 + r() * 0.03, 0.75, 0.62 + r() * 0.08));
      inst.push({ center: pos, radius: 1.3 * s, matrix: m });
    }
    this.scene.add(mitos);
    this.register('mitochondrion', [mitos], [mitoMat], inst, inst[0].center.clone().add(new W.Vector3(0, 1.4, 0)), mitoGeo);

    const spheres = (id: OrganelleId, count: number, colorHex: string, emissive: string, size: [number, number], seed: number) => {
      const geo = blobGeometry(3, [1, 1, 1], (x, y, z) => 0.06 * wobble(x * 3, y * 3, z * 3, seed));
      const mat = material(colorHex, { roughness: 0.5, emissive });
      const mesh = new W.InstancedMesh(geo, mat, count);
      const list: Instance[] = [];
      for (let i = 0; i < count; i++) {
        const s = size[0] + r() * (size[1] - size[0]);
        const pos = this.placeAway(r, 4.0, R - 1.6, s + 0.5, taken);
        const m = new W.Matrix4().compose(pos, tmpQ.setFromUnitVectors(Y, randomDirection(r)), tmpS.set(s, s, s));
        mesh.setMatrixAt(i, m);
        list.push({ center: pos, radius: s, matrix: m });
      }
      this.scene.add(mesh);
      this.register(id, [mesh], [mat], list, list[0].center.clone().add(new W.Vector3(0, list[0].radius + 0.35, 0)), geo);
    };
    spheres('lysosome', 10, '#f472b6', '#2a0718', [0.32, 0.48], 4);
    spheres('peroxisome', 9, '#4ade80', '#052e14', [0.24, 0.32], 9);
  }

  private buildCytoskeleton() {
    const r = rng(51);
    // Microtubules radiate from the centrosome and bend around the nucleus.
    const tubes: { geometry: W.BufferGeometry }[] = [];
    const d = new W.Vector3();
    for (let k = 0; k < 34; k++) {
      randomDirection(r, d);
      const end = d.clone().multiplyScalar(membraneRadius(d.x, d.y, d.z) - 0.7);
      const pts: W.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const p = CENTROSOME.clone().lerp(end, i / 10);
        const off = p.clone().sub(NUC);
        if (off.length() < NUC_R + 0.55) p.copy(NUC).add(off.setLength(NUC_R + 0.55));
        pts.push(p);
      }
      tubes.push({ geometry: new W.TubeGeometry(new W.CatmullRomCurve3(pts), 40, 0.028, 5) });
    }
    const mtMat = material('#7dd3fc', { roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false });
    const microtubules = new W.Mesh(mergeGeometries(tubes), mtMat);
    this.scene.add(microtubules);

    // Actin cortex under the membrane and intermediate filaments: thin lines (not pickable).
    const seg: number[] = [];
    const t = new W.Vector3();
    for (let i = 0; i < 1100; i++) {
      randomDirection(r, d);
      const p = d.clone().multiplyScalar(membraneRadius(d.x, d.y, d.z) - 0.45);
      t.crossVectors(d, randomDirection(r)).normalize().multiplyScalar(0.5 + r() * 0.5);
      seg.push(p.x - t.x, p.y - t.y, p.z - t.z, p.x + t.x, p.y + t.y, p.z + t.z);
    }
    for (let k = 0; k < 22; k++) {
      randomDirection(r, d);
      let prev = d.clone().multiplyScalar(NUC_R + 0.35).add(NUC);
      for (let i = 1; i <= 14; i++) {
        const target = d.clone().multiplyScalar(membraneRadius(d.x, d.y, d.z) - 0.6);
        const p = NUC.clone().add(d.clone().multiplyScalar(NUC_R + 0.35)).lerp(target, i / 14).add(randomDirection(r).multiplyScalar(0.18));
        seg.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
    }
    const lg = new W.BufferGeometry();
    lg.setAttribute('position', new W.Float32BufferAttribute(seg, 3));
    const lineMat = new W.LineBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.22, depthWrite: false });
    this.clipMaterials.push(lineMat);
    this.scene.add(new W.LineSegments(lg, lineMat));
    this.register('cytoskeleton', [microtubules], [mtMat], [{ center: CENTROSOME.clone().add(new W.Vector3(1.8, -2.2, -2.5)), radius: 2.5, matrix: new W.Matrix4() }], CENTROSOME.clone().add(new W.Vector3(2.4, -3.2, -3.2)));

    // Centrosome: two orthogonal centrioles (nine rods each) in a faint cloud.
    const rods: { geometry: W.BufferGeometry; matrix: W.Matrix4 }[] = [];
    for (let c = 0; c < 2; c++) {
      const orient = new W.Matrix4().makeRotationFromQuaternion(new W.Quaternion().setFromAxisAngle(new W.Vector3(1, 0, 0), c ? Math.PI / 2 : 0));
      const offset = new W.Matrix4().makeTranslation(c ? 0.32 : -0.1, 0, 0);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const local = new W.Matrix4().makeTranslation(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
        rods.push({ geometry: new W.CylinderGeometry(0.035, 0.035, 0.55, 6), matrix: offset.clone().multiply(orient).multiply(local) });
      }
    }
    const centrioleGeo = mergeGeometries(rods);
    const centrioleMat = material('#e2e8f0', { roughness: 0.4, emissive: '#1e293b' });
    const centrioles = new W.Mesh(centrioleGeo, centrioleMat);
    centrioles.position.copy(CENTROSOME);
    const pcmMat = material('#e2e8f0', { transparent: true, opacity: 0.12, depthWrite: false });
    const pcm = new W.Mesh(blobGeometry(2, [0.62, 0.62, 0.62], (x, y, z) => 0.05 * wobble(x * 3, y * 3, z * 3, 1)), pcmMat);
    pcm.position.copy(CENTROSOME);
    pcm.renderOrder = 5;
    this.scene.add(centrioles, pcm);
    this.register('centrosome', [centrioles], [centrioleMat], [{ center: CENTROSOME.clone(), radius: 0.6, matrix: new W.Matrix4().makeTranslation(CENTROSOME.x, CENTROSOME.y, CENTROSOME.z) }], CENTROSOME.clone().add(new W.Vector3(0, 0.85, 0)), centrioleGeo);
    this.register('centrosome', [pcm], [pcmMat], [], CENTROSOME, undefined, true);
  }

  // --- Stage interface ------------------------------------------------------------

  pickables() {
    return this.pickList;
  }

  resolvePick(hits: W.Intersection[]): PickResult | null {
    const solid = hits.find((h) => !this.glass.has(h.object));
    let hit = solid;
    let id: OrganelleId | undefined = solid?.object.userData.organelleId;
    if (!solid) {
      const g = hits[0];
      if (!g) return null;
      hit = g;
      id = g.object.userData.organelleId;
      if (id === 'plasma-membrane' && this.inside) id = 'cytoplasm';
    }
    // The envelope stands for the whole nucleus until the nucleus is already selected.
    if (id === 'nuclear-envelope' && this.selected?.id !== 'nucleus' && this.selected?.id !== 'nuclear-envelope') id = 'nucleus';
    if (!id || !hit) return null;
    const o = organelles[id];
    const instance = (hit.object as W.InstancedMesh).isInstancedMesh ? hit.instanceId : undefined;
    return { target: { stage: 'cell', organelleId: id, instance }, label: o.name, sub: o.size };
  }

  activate(rig: CameraRig, first: boolean) {
    if (first) this.applyExterior(rig, true);
  }

  update(_dt: number, time: number, camera: W.PerspectiveCamera) {
    this.inside = camera.position.length() < R - 0.2;
    this.fog.density = this.inside ? 0.028 : 0;

    if (this.animate) {
      for (const v of this.vesicleTracks) {
        const t = (time * v.speed + v.offset) % 1;
        const p = v.curve.getPointAt(t);
        // Shrink at both ends so vesicles appear to bud and fuse rather than pop.
        const s = v.scale * Math.min(1, Math.sin(t * Math.PI) * 4);
        tmpM.compose(p, tmpQ.identity(), tmpS.set(s, s, s));
        v.mesh.setMatrixAt(v.index, tmpM);
        const inst = this.visuals.get('vesicle')!.instances[v.index];
        inst.center.copy(p);
        inst.matrix.copy(tmpM);
      }
      if (this.vesicleTracks.length) this.vesicleTracks[0].mesh.instanceMatrix.needsUpdate = true;
    }

    // Selection halo follows its instance and pulses gently.
    if (this.halo.visible && this.selected) {
      const v = this.visuals.get(this.selected.id)!;
      const inst = v.instances[this.selected.instance ?? 0];
      if (inst) this.placeHalo(inst);
      this.haloMat.opacity = 0.22 + 0.12 * Math.sin(time * 3);
    }
    for (const id of this.highlighted) {
      if (id === this.selected?.id) continue;
      const k = 0.35 + 0.3 * Math.sin(time * 3);
      for (const m of this.visuals.get(id)?.materials ?? []) m.emissiveIntensity = k;
    }

    if (this.cutaway) {
      const n = camera.position.clone().normalize().negate();
      this.membraneClip.setComponents(n.x, n.y, n.z, 0);
      this.nucleusClip.setComponents(n.x, n.y, n.z, -n.dot(NUC));
    }
  }

  labelAnchors(): LabelAnchor[] {
    return [...this.visuals.values()].map((v) => ({
      key: `cell:${v.id}`,
      text: organelles[v.id].name,
      sub: organelles[v.id].size,
      color: organelles[v.id].color,
      kind: 'organelle' as const,
      emphasis: this.selected?.id === v.id || this.highlighted.has(v.id),
    }));
  }

  labelPositions() {
    const m = new Map<string, W.Vector3>();
    for (const v of this.visuals.values()) {
      if (v.id === 'cytoplasm' && !this.inside) continue;
      m.set(`cell:${v.id}`, v.label);
    }
    return m;
  }

  labelFade() {
    return this.inside ? { near: 6, far: 16 } : undefined;
  }

  // --- Selection, highlighting, camera targets --------------------------------------

  /** Glow in the organelle's own colour (`intensity` 0 restores the base look). */
  private setGlow(id: OrganelleId, intensity: number) {
    const glow = new W.Color(organelles[id].color);
    for (const m of this.visuals.get(id)?.materials ?? []) {
      if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.emissive.getHex();
      if (intensity > 0) { m.emissive.copy(glow); m.emissiveIntensity = intensity; }
      else { m.emissive.setHex(m.userData.baseEmissive); m.emissiveIntensity = 1; }
    }
  }

  private placeHalo(inst: Instance) {
    const pos = new W.Vector3(), scale = new W.Vector3();
    inst.matrix.decompose(pos, tmpQ, scale);
    this.halo.position.copy(pos);
    this.halo.quaternion.copy(tmpQ);
    this.halo.scale.copy(scale.multiplyScalar(1.18));
  }

  select(id: OrganelleId | null, instance?: number) {
    if (this.selected) this.setGlow(this.selected.id, this.highlighted.has(this.selected.id) ? 0.3 : 0);
    this.selected = id ? { id, instance } : null;
    this.halo.visible = false;
    if (!id) return;
    this.setGlow(id, 0.28);
    const v = this.visuals.get(id);
    if (v?.haloGeometry) {
      const inst = v.instances[instance ?? 0];
      if (inst) {
        this.halo.geometry = v.haloGeometry;
        this.placeHalo(inst);
        this.halo.visible = true;
      }
    }
  }

  highlight(ids: OrganelleId[]) {
    for (const id of this.highlighted) if (id !== this.selected?.id) this.setGlow(id, 0);
    this.highlighted = new Set(ids);
    for (const id of ids) if (id !== this.selected?.id) this.setGlow(id, 0.3);
  }

  /** Where to look for a close-up of an organelle (instance), and whether that is inside the cell. */
  focusTarget(id: OrganelleId, instance?: number): { center: W.Vector3; radius: number } | null {
    const v = this.visuals.get(id);
    if (!v || !v.instances.length) return null;
    const inst = v.instances[instance ?? 0] ?? v.instances[0];
    return { center: inst.center.clone(), radius: inst.radius };
  }

  setCutaway(on: boolean) {
    this.cutaway = on;
    for (const m of this.clipMaterials) m.clippingPlanes = on ? [this.membraneClip] : null;
    for (const m of this.nucleusClipMaterials) m.clippingPlanes = on ? [this.nucleusClip] : null;
  }

  applyExterior(rig: CameraRig, instant = false) {
    // Fit the whole cell in view whatever the aspect ratio (portrait phones need more distance).
    const cam = rig.camera;
    const vHalf = (cam.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect);
    const dist = Math.max(32.6, (R * 1.18) / Math.sin(Math.min(vHalf, hHalf)));
    rig.bounds = {};
    rig.setLimits({ minDistance: R + 3.5, maxDistance: Math.max(R * 5, dist * 1.6), enablePan: false });
    const pos = new W.Vector3(17, 9, 26).normalize().multiplyScalar(dist), target = new W.Vector3(0, 0, 0);
    if (instant) rig.jumpTo(pos, target);
    else rig.flyTo(pos, target, 1.4);
  }

  setInteriorLimits(rig: CameraRig) {
    rig.setLimits({ minDistance: 0.6, maxDistance: 7, enablePan: true });
    rig.bounds = { maxRadius: R - 1.0, avoid: [{ center: NUC, radius: NUC_R + 0.6 }] };
  }

  applyInterior(rig: CameraRig, done?: () => void) {
    const bounds = { maxRadius: R - 1.0, avoid: [{ center: NUC, radius: NUC_R + 0.6 }] };
    rig.bounds = {};
    rig.setLimits({ minDistance: 0.6, maxDistance: 7, enablePan: true });
    const pos = new W.Vector3(5.6, 3.2, 5.2), target = new W.Vector3(1.4, 1.0, 1.2);
    // Fly in from outside along the line through the entry point.
    rig.flyTo(pos, target, 1.8, () => { rig.bounds = bounds; done?.(); });
  }

  /** Camera settings for a close-up of the given organelle. */
  applyCloseup(rig: CameraRig, id: OrganelleId, instance?: number): boolean {
    const t = this.focusTarget(id, instance);
    if (!t) return false;
    const dist = Math.max(1.6, t.radius * 3.2);
    if (id === 'plasma-membrane') {
      const dir = t.center.clone().normalize();
      rig.bounds = {};
      rig.setLimits({ minDistance: 1.5, maxDistance: 12, enablePan: true });
      rig.flyTo(t.center.clone().addScaledVector(dir, 6).add(new W.Vector3(2, 1, 0)), t.center, 1.4);
      return true;
    }
    const camDir = rig.camera.position.clone().sub(t.center);
    if (camDir.lengthSq() < 1e-6) camDir.set(1, 0.5, 1);
    camDir.normalize();
    let pos = t.center.clone().addScaledVector(camDir, dist);
    // Keep the close-up camera inside the cell and outside the nucleus.
    if (pos.length() > R - 1.2) pos = t.center.clone().addScaledVector(t.center.clone().negate().normalize(), dist);
    if (id !== 'nucleus' && id !== 'nuclear-envelope' && id !== 'nucleolus' && pos.distanceTo(NUC) < NUC_R + 0.6) {
      pos = t.center.clone().addScaledVector(t.center.clone().sub(NUC).normalize(), dist);
    }
    if (id === 'nucleolus') pos = NUCLEOLUS.clone().addScaledVector(NUCLEOLUS.clone().sub(NUC).normalize().add(new W.Vector3(0.4, 0.2, 0.6)).normalize(), NUC_R + 1.2);
    if (id === 'nucleus' || id === 'nuclear-envelope') pos = NUC.clone().addScaledVector(new W.Vector3(0.7, 0.35, 0.65).normalize(), NUC_R + 3.6);
    rig.bounds = {};
    rig.setLimits({ minDistance: Math.max(0.4, t.radius * 1.4), maxDistance: Math.max(6, t.radius * 10), enablePan: true });
    rig.flyTo(pos, t.center, 1.4, () => {
      const avoid = id === 'nucleus' || id === 'nuclear-envelope' || id === 'nucleolus' || id === 'nuclear-pore' ? [] : [{ center: NUC, radius: NUC_R + 0.4 }];
      rig.bounds = { maxRadius: R - 0.8, avoid };
    });
    return true;
  }

  dispose() {
    disposeTree(this.scene);
    this.haloMat.dispose();
  }
}
