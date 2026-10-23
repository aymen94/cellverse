import type { StructureKey } from '../types/science';

// Structure files produced by scripts/fetch-structures.mjs, loaded on demand.

export interface StructureSource { db: string; id: string; url: string; note: string }

export type AtomRow = [element: string, x: number, y: number, z: number];

export type StructureData =
  | { kind: 'atoms'; source: StructureSource; atoms: AtomRow[]; bonds: [number, number, number][] }
  | { kind: 'trace'; source: StructureSource; chains: { id: string; points: [number, number, number][] }[]; ligands: { names: string[]; atoms: AtomRow[]; bonds: [number, number, number][] } };

const files = import.meta.glob<StructureData>('./structures/*.json', { import: 'default' });
const cache = new Map<StructureKey, Promise<StructureData>>();

export function loadStructure(key: StructureKey): Promise<StructureData> {
  let p = cache.get(key);
  if (!p) {
    const loader = files[`./structures/${key}.json`];
    if (!loader) return Promise.reject(new Error(`Missing structure file for ${key}`));
    p = loader();
    cache.set(key, p);
  }
  return p;
}
