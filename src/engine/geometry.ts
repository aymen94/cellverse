// Geometry helpers built on WAMR3D's BufferGeometry: smooth icospheres with organic
// displacement, merging several geometries into one draw call, and seeded randomness.

import { W } from './wamr';

/** Deterministic pseudo-random numbers (mulberry32), so the cell looks the same every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth, cheap 3D noise from layered sines (enough for organic wobble). */
export function wobble(x: number, y: number, z: number, seed = 0): number {
  return (
    Math.sin(x * 1.7 + seed) * Math.cos(y * 1.3 + seed * 0.7) * 0.5 +
    Math.sin(y * 2.3 + z * 1.1 + seed * 1.3) * 0.3 +
    Math.cos(z * 2.9 + x * 0.7 + seed * 2.1) * 0.2 +
    Math.sin((x + y + z) * 4.1 + seed) * 0.08
  );
}

/** Indexed unit icosphere (shared vertices, so vertex normals are smooth). */
export function icosphere(detail: number): { positions: number[]; indices: number[] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const positions: number[] = [];
  const add = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z);
    positions.push(x / l, y / l, z / l);
    return positions.length / 3 - 1;
  };
  [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].forEach((v) => add(v[0], v[1], v[2]));
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let d = 0; d < detail; d++) {
    const cache = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let i = cache.get(key);
      if (i === undefined) {
        i = add((positions[a * 3] + positions[b * 3]) / 2, (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2, (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2);
        cache.set(key, i);
      }
      return i;
    };
    const next: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { positions, indices: faces.flat() };
}

/**
 * An organic blob: a unit icosphere scaled by `radius` (x, y, z) and displaced along
 * the normal by `displace(x, y, z)` (unit-sphere coordinates, result in world units).
 */
export function blobGeometry(
  detail: number,
  radius: [number, number, number],
  displace: (x: number, y: number, z: number) => number,
  /** Optional deformation applied after scaling (e.g. bending a Golgi cisterna). */
  deform?: (p: [number, number, number]) => void,
): W.BufferGeometry {
  const { positions, indices } = icosphere(detail);
  const out = new Float32Array(positions.length);
  const p: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const d = displace(x, y, z);
    p[0] = x * (radius[0] + d);
    p[1] = y * (radius[1] + d);
    p[2] = z * (radius[2] + d);
    deform?.(p);
    out[i] = p[0];
    out[i + 1] = p[1];
    out[i + 2] = p[2];
  }
  const g = new W.BufferGeometry();
  g.setAttribute('position', new W.Float32BufferAttribute(out, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * A curved sheet over part of a sphere around the origin: `radius(dir)` gives the
 * distance for each direction (phi measured from +y, theta around y).
 */
export function sheetGeometry(
  radius: (x: number, y: number, z: number) => number,
  phi: [number, number],
  theta: [number, number],
  segU: number,
  segV: number,
): W.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let v = 0; v <= segV; v++) {
    const ph = phi[0] + ((phi[1] - phi[0]) * v) / segV;
    for (let u = 0; u <= segU; u++) {
      const th = theta[0] + ((theta[1] - theta[0]) * u) / segU;
      const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
      const r = radius(x, y, z);
      pos.push(x * r, y * r, z * r);
    }
  }
  const row = segU + 1;
  for (let v = 0; v < segV; v++) {
    for (let u = 0; u < segU; u++) {
      const a = v * row + u, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new W.BufferGeometry();
  g.setAttribute('position', new W.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merges geometries (each with an optional transform) into one indexed geometry with normals. */
export function mergeGeometries(parts: { geometry: W.BufferGeometry; matrix?: W.Matrix4 }[], dispose = true): W.BufferGeometry {
  let vCount = 0, iCount = 0;
  for (const p of parts) {
    vCount += p.geometry.attributes.position.count;
    iCount += p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  const v = new W.Vector3(), n = new W.Vector3(), nm = new W.Matrix3();
  let vo = 0, io = 0;
  for (const p of parts) {
    const g = p.geometry;
    const pa = g.attributes.position, na = g.attributes.normal;
    if (p.matrix) nm.getNormalMatrix(p.matrix);
    for (let i = 0; i < pa.count; i++) {
      v.set(pa.getX(i), pa.getY(i), pa.getZ(i));
      if (p.matrix) v.applyMatrix4(p.matrix);
      pos.set([v.x, v.y, v.z], (vo + i) * 3);
      if (na) {
        n.set(na.getX(i), na.getY(i), na.getZ(i));
        if (p.matrix) n.applyMatrix3(nm).normalize();
        nor.set([n.x, n.y, n.z], (vo + i) * 3);
      }
    }
    if (g.index) {
      const ia = g.index;
      for (let i = 0; i < ia.count; i++) idx[io + i] = ia.getX(i) + vo;
      io += ia.count;
    } else {
      for (let i = 0; i < pa.count; i++) idx[io + i] = vo + i;
      io += pa.count;
    }
    vo += pa.count;
    if (dispose) g.dispose();
  }
  const out = new W.BufferGeometry();
  out.setAttribute('position', new W.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new W.Float32BufferAttribute(nor, 3));
  out.setIndex(new W.Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const _up = new W.Vector3(0, 1, 0);

/** Matrix placing a unit-height, Y-aligned shape between points a and b with the given radius. */
export function segmentMatrix(a: W.Vector3, b: W.Vector3, radius: number, target = new W.Matrix4()): W.Matrix4 {
  const dir = new W.Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new W.Quaternion().setFromUnitVectors(_up, dir.normalize());
  const mid = new W.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return target.compose(mid, q, new W.Vector3(radius, len, radius));
}

/** A random point on the unit sphere. */
export function randomDirection(r: () => number, target = new W.Vector3()): W.Vector3 {
  const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return target.set(s * Math.cos(th), u, s * Math.sin(th));
}
