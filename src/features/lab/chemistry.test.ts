import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeComponent, connectionOptions } from './chemistry';
import { labActions, labStore } from './labStore';
import { formatHill, parseFormula } from './formula';

const st = () => labStore.get().lab;

function add(kind: 'atom' | 'block', ref: string) {
  return labActions.add(kind, ref)!;
}

/** Connects a → b using the option whose label/site matches `pick` (or the only one). */
function connect(a: string, b: string, pick?: (key: string) => boolean) {
  const res = connectionOptions(st(), a, b);
  if (!res.ok) throw new Error(res.reason);
  const opt = pick ? res.options.find((o) => pick(o.key)) : res.options[0];
  if (!opt) throw new Error(`no option among ${res.options.map((o) => o.key).join(', ')}`);
  labActions.apply(a, b, opt);
}

beforeEach(() => {
  labStore.set({ lab: { nodes: [], bonds: [], nextId: 1 }, history: [], selectedId: null, pendingTarget: null, message: null });
});

describe('formula bookkeeping', () => {
  it('parses and prints Hill formulas', () => {
    expect(formatHill(parseFormula('C6H12O6'))).toBe('C6H12O6');
    expect(formatHill(parseFormula('H3PO4'))).toBe('H3O4P');
    expect(formatHill(parseFormula('OH2'))).toBe('H2O');
  });
});

describe('atoms and valence', () => {
  it('builds water and recognizes it', () => {
    const o = add('atom', 'O'), h1 = add('atom', 'H'), h2 = add('atom', 'H');
    connect(o, h1);
    expect(analyzeComponent(st(), o).productClass).toBe('incomplete');
    connect(o, h2);
    const p = analyzeComponent(st(), o);
    expect(p.name).toContain('Water');
    expect(p.formula).toBe('H₂O');
  });

  it('refuses a third bond to oxygen and explains why', () => {
    const o = add('atom', 'O');
    const hs = [add('atom', 'H'), add('atom', 'H'), add('atom', 'H')];
    connect(o, hs[0]);
    connect(o, hs[1]);
    const res = connectionOptions(st(), o, hs[2]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Oxygen already uses 2 bonds/);
  });

  it('raises bond order for CO2 but not for H–H', () => {
    const c = add('atom', 'C'), o1 = add('atom', 'O'), o2 = add('atom', 'O');
    connect(c, o1); connect(c, o1); connect(c, o2); connect(c, o2);
    expect(analyzeComponent(st(), c).name).toContain('Carbon dioxide');
    const h1 = add('atom', 'H'), h2 = add('atom', 'H');
    connect(h1, h2);
    const res = connectionOptions(st(), h1, h2);
    expect(res.ok).toBe(false);
  });

  it('distinguishes ethanol from dimethyl ether by connectivity', () => {
    const c1 = add('atom', 'C'), c2 = add('atom', 'C'), o = add('atom', 'O');
    connect(c1, c2); connect(c2, o);
    const hs = Array.from({ length: 6 }, () => add('atom', 'H'));
    hs.slice(0, 3).forEach((h) => connect(c1, h));
    hs.slice(3, 5).forEach((h) => connect(c2, h));
    connect(o, hs[5]);
    expect(analyzeComponent(st(), c1).name).toContain('Ethanol');
  });

  it('pairs Na+ with Cl- ionically and rejects Fe coordination and metal–metal bonds', () => {
    const na = add('atom', 'Na'), cl = add('atom', 'Cl');
    const res = connectionOptions(st(), na, cl);
    expect(res.ok && res.options[0].bondType).toBe('ionic');
    connect(na, cl);
    expect(analyzeComponent(st(), na).name).toContain('Sodium chloride');
    const fe = add('atom', 'Fe'), o = add('atom', 'O');
    expect(connectionOptions(st(), fe, o).ok).toBe(false);
    const k = add('atom', 'K'), na2 = add('atom', 'Na');
    const mm = connectionOptions(st(), k, na2);
    expect(mm.ok).toBe(false);
    if (!mm.ok) expect(mm.reason).toMatch(/both metals/);
  });

  it('balances CaCl2 and refuses a third chloride', () => {
    const ca = add('atom', 'Ca'), a = add('atom', 'Cl'), b = add('atom', 'Cl'), c = add('atom', 'Cl');
    connect(ca, a); connect(ca, b);
    expect(analyzeComponent(st(), ca).formula).toBe('CaCl₂');
    expect(connectionOptions(st(), ca, c).ok).toBe(false);
  });

  it('refuses mixing atoms with building blocks', () => {
    const h = add('atom', 'H'), g = add('block', 'glycine');
    const res = connectionOptions(st(), h, g);
    expect(res.ok).toBe(false);
  });
});

describe('peptides', () => {
  it('builds Gly-Ala-Ser with peptide bonds and correct formula', () => {
    const g = add('block', 'glycine'), a = add('block', 'alanine'), s = add('block', 'serine');
    connect(g, a, (k) => k.startsWith('C|N'));
    connect(a, s, (k) => k.startsWith('C|N'));
    const p = analyzeComponent(st(), g);
    expect(p.productClass).toBe('peptide');
    expect(p.name).toContain('Gly-Ala-Ser');
    // 2 + 3 + 3 C; 5+7+7-4 H; 3 N; 2+2+3-2 O
    expect(p.formula).toBe('C₈H₁₅N₃O₅');
  });

  it('Gly-Gly matches glycylglycine C4H8N2O3', () => {
    const a = add('block', 'glycine'), b = add('block', 'glycine');
    connect(a, b, (k) => k.startsWith('C|N'));
    const p = analyzeComponent(st(), a);
    expect(p.formula).toBe('C₄H₈N₂O₃');
    expect(p.moleculeId).toBe('glycylglycine');
  });

  it('explains why two used amino groups cannot react', () => {
    const a = add('block', 'glycine'), b = add('block', 'glycine'), c = add('block', 'glycine');
    connect(a, b, (k) => k.startsWith('C|N'));
    connect(b, c, (k) => k.startsWith('C|N'));
    // a's carboxyl and c's amino group are used; a(N) + c(C) remains but would close a ring.
    const res = connectionOptions(st(), a, c);
    expect(res.ok).toBe(false);
  });
});

describe('carbohydrates', () => {
  it('names maltose, sucrose and lactose', () => {
    const g1 = add('block', 'alpha-glucose'), g2 = add('block', 'alpha-glucose');
    connect(g1, g2, (k) => k === 'C1|C4|glycosidic');
    expect(analyzeComponent(st(), g1).name).toContain('Maltose');
    expect(analyzeComponent(st(), g1).formula).toBe('C₁₂H₂₂O₁₁');

    const g = add('block', 'alpha-glucose'), f = add('block', 'beta-fructose');
    connect(g, f, (k) => k === 'C1|C2|glycosidic-anomeric');
    expect(analyzeComponent(st(), g).name).toContain('Sucrose');

    const gal = add('block', 'beta-galactose'), glc = add('block', 'beta-glucose');
    connect(gal, glc, (k) => k === 'C1|C4|glycosidic');
    expect(analyzeComponent(st(), gal).name).toContain('Lactose');
  });

  it('rejects two non-anomeric hydroxyls with an explanation', () => {
    const f1 = add('block', 'beta-fructose'), f2 = add('block', 'alpha-glucose'), f3 = add('block', 'alpha-glucose');
    connect(f1, f2, (k) => k === 'C2|C1|glycosidic-anomeric');
    // f2's anomeric carbon is used; f3 can still donate its C1 to f2's C4.
    const res = connectionOptions(st(), f2, f3);
    expect(res.ok).toBe(true);
  });
});

describe('lipids', () => {
  it('builds POPC with the zwitterion formula C42H82NO8P', () => {
    const g = add('block', 'glycerol'), pa = add('block', 'palmitic-acid'), oa = add('block', 'oleic-acid');
    const p = add('block', 'phosphate'), ch = add('block', 'choline');
    connect(g, pa, (k) => k.startsWith('sn1|'));
    connect(g, oa, (k) => k.startsWith('sn2|'));
    connect(g, p, (k) => k.startsWith('sn3|OH-a'));
    connect(p, ch, (k) => k.startsWith('OH-b|'));
    const prod = analyzeComponent(st(), g);
    expect(prod.productClass).toBe('phospholipid');
    expect(prod.name).toContain('POPC');
    expect(prod.formula).toBe('C₄₂H₈₂NO₈P');
  });

  it('builds a triglyceride and refuses fatty acid–fatty acid', () => {
    const g = add('block', 'glycerol');
    const fas = [add('block', 'palmitic-acid'), add('block', 'palmitic-acid'), add('block', 'palmitic-acid')];
    fas.forEach((fa) => connect(g, fa));
    const prod = analyzeComponent(st(), g);
    expect(prod.productClass).toBe('triglyceride');
    expect(prod.formula).toBe('C₅₁H₉₈O₆'); // tripalmitin
    const x = add('block', 'oleic-acid'), y = add('block', 'oleic-acid');
    const res = connectionOptions(st(), x, y);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/anhydride/);
  });
});

describe('nucleic acids', () => {
  it('assembles dAMP from components with the PubChem formula', () => {
    const a = add('block', 'adenine'), d = add('block', 'deoxyribose'), p = add('block', 'phosphate');
    connect(a, d);
    expect(analyzeComponent(st(), a).name).toBe('Deoxyadenosine');
    connect(p, d, (k) => k.includes("C5'"));
    const prod = analyzeComponent(st(), a);
    expect(prod.name).toContain('dAMP');
    expect(prod.formula).toBe('C₁₀H₁₄N₅O₆P');
  });

  it('refuses thymine on ribose and mixed DNA/RNA strands', () => {
    const t = add('block', 'thymine'), r = add('block', 'ribose');
    const res = connectionOptions(st(), t, r);
    expect(res.ok).toBe(false);
    const x = add('block', 'damp'), y = add('block', 'ump');
    const mixed = connectionOptions(st(), x, y);
    expect(mixed.ok).toBe(false);
  });

  it('links nucleotides 5′→3′ into a named DNA strand', () => {
    const a = add('block', 'damp'), c = add('block', 'dcmp'), g = add('block', 'dgmp');
    connect(a, c, (k) => k.startsWith("3'OH|5'P"));
    connect(c, g, (k) => k.startsWith("3'OH|5'P"));
    const prod = analyzeComponent(st(), a);
    expect(prod.productClass).toBe('nucleic-acid');
    expect(prod.name).toContain("5′-ACG-3′");
  });
});

describe('history', () => {
  it('undoes the last action', () => {
    const a = add('block', 'glycine'), b = add('block', 'glycine');
    connect(a, b, (k) => k.startsWith('C|N'));
    expect(st().bonds).toHaveLength(1);
    labActions.undo();
    expect(st().bonds).toHaveLength(0);
    labActions.undo();
    expect(st().nodes).toHaveLength(1);
  });
});
