import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { elementList, elements } from './elements';
import { assemblyRules, buildingBlockList } from './lab';
import { missions } from './missions';
import { moleculeFamilies, moleculeList, molecules } from './molecules';
import { organelleList, organelles } from './organelles';
import { references } from './references';
import { search } from '../features/search/searchIndex';
import { formatHill, parseFormula } from '../features/lab/formula';

const structureDir = path.resolve(process.cwd(), 'src/data/structures');

describe('scientific data integrity', () => {
  it('cites only references that exist', () => {
    const cited = [
      ...organelleList.flatMap((o) => o.references),
      ...elementList.flatMap((e) => e.references),
      ...moleculeList.flatMap((m) => m.references),
      ...moleculeFamilies.flatMap((f) => f.references),
      ...buildingBlockList.flatMap((b) => b.references),
      ...assemblyRules.flatMap((r) => r.references),
      ...missions.flatMap((m) => m.references),
    ];
    const missing = [...new Set(cited)].filter((id) => !references[id]);
    expect(missing).toEqual([]);
    for (const r of Object.values(references)) expect(r.url).toMatch(/^https:\/\//);
  });

  it('has the 30 requested elements with unique symbols and atomic numbers', () => {
    expect(elementList).toHaveLength(30);
    expect(new Set(elementList.map((e) => e.symbol)).size).toBe(30);
    expect(new Set(elementList.map((e) => e.atomicNumber)).size).toBe(30);
    expect(elements.Fe.atomicMass).toBe('55.845');
    expect(elements.C.atomicNumber).toBe(6);
  });

  it('links organelles, molecules and elements consistently', () => {
    for (const o of organelleList) {
      for (const r of o.relationships) expect(organelles[r.id], `${o.id} → ${r.id}`).toBeDefined();
      for (const m of o.molecules) expect(molecules[m], `${o.id} → ${m}`).toBeDefined();
      for (const e of o.elements) expect(elements[e], `${o.id} → ${e}`).toBeDefined();
      if (o.parent) expect(organelles[o.parent]).toBeDefined();
    }
    for (const e of elementList) for (const o of e.organelles) expect(organelles[o], `${e.symbol} → ${o}`).toBeDefined();
    for (const m of moleculeList) for (const o of m.organelles) expect(organelles[o], `${m.id} → ${o}`).toBeDefined();
  });

  it('has a structure file for every molecule and building block', () => {
    const keys = [
      ...moleculeList.flatMap((m) => (m.structure.type === 'file' ? [m.structure.key] : [])),
      ...buildingBlockList.map((b) => b.structure),
    ];
    for (const k of keys) expect(fs.existsSync(path.join(structureDir, `${k}.json`)), k).toBe(true);
  });

  it('keeps stated formulas consistent with the bundled structures', () => {
    // Heavy-atom + hydrogen counts of the PubChem/CCD files must match the stated formula.
    for (const m of moleculeList) {
      if (m.structure.type !== 'file' || !m.formula || m.representation === 'experimental') continue;
      const data = JSON.parse(fs.readFileSync(path.join(structureDir, `${m.structure.key}.json`), 'utf8'));
      const f = new Map<string, number>();
      for (const [el] of data.atoms) f.set(el, (f.get(el) ?? 0) + 1);
      const ascii = m.formula.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)));
      expect(formatHill(f), m.id).toBe(formatHill(parseFormula(ascii)));
    }
  });

  it('points every mission step at real content', () => {
    for (const m of missions) {
      for (const s of m.steps) {
        const c = s.condition;
        if (c.type === 'select') {
          const table = c.kind === 'organelle' ? organelles : c.kind === 'element' ? elements : molecules;
          expect((table as Record<string, unknown>)[c.id], `${m.id}/${s.id}`).toBeDefined();
        }
        if (c.type === 'select-all') for (const id of c.ids) expect((elements as Record<string, unknown>)[id]).toBeDefined();
      }
    }
  });
});

describe('search', () => {
  it('finds organelles, elements by symbol, molecules and building blocks', () => {
    expect(search('ribosome')[0].selection).toEqual({ kind: 'organelle', id: 'ribosome' });
    expect(search('Fe')[0].selection).toEqual({ kind: 'element', id: 'Fe' });
    expect(search('atp')[0].selection).toEqual({ kind: 'molecule', id: 'atp' });
    expect(search('glycerol').some((r) => r.selection.kind === 'block')).toBe(true);
    expect(search('')).toEqual([]);
  });
});
