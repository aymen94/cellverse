// Rule-based chemistry for the laboratory. Decides which connections are allowed,
// explains why others are not, and names what the user has assembled.
//
// This is an educational model, not a simulation: it checks functional-group rules and
// typical valences, and keeps formula bookkeeping. It knows nothing about kinetics,
// energetics or 3D geometry.

import { assemblyRules, buildingBlocks } from '../../data/lab';
import { elements } from '../../data/elements';
import type { AssemblyRule, BuildingBlock, ChemicalElement, ElementSymbol } from '../../types/science';
import { addFormula, formatHill, parseFormula, prettyFormula, type Formula } from './formula';
import type { CompatibilityResult, ConnectionOption, LabBond, LabNode, LabState, ProductAnalysis } from './labTypes';

// --- Graph helpers ------------------------------------------------------------------

export const nodeById = (s: LabState, id: string) => s.nodes.find((n) => n.id === id);
export const bondsOf = (s: LabState, id: string) => s.bonds.filter((b) => b.a === id || b.b === id);
export const otherEnd = (b: LabBond, id: string) => (b.a === id ? b.b : b.a);
const siteOf = (b: LabBond, id: string) => (b.a === id ? b.siteA : b.siteB);

export function componentOf(s: LabState, id: string): Set<string> {
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const b of bondsOf(s, cur)) {
      const o = otherEnd(b, cur);
      if (!seen.has(o)) { seen.add(o); stack.push(o); }
    }
  }
  return seen;
}

export const nodeLabel = (n: LabNode) => (n.kind === 'atom' ? elements[n.ref as ElementSymbol].name : buildingBlocks[n.ref].name);
export const nodeShort = (n: LabNode) => (n.kind === 'atom' ? n.ref : buildingBlocks[n.ref].short);

// --- Atoms ----------------------------------------------------------------------------

const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);
const isSaltCation = (e: ChemicalElement) => !e.covalent && (e.ionCharge ?? 0) > 0;
const maxValence = (e: ChemicalElement) => Math.max(...(e.covalent?.valences ?? [0]));

function covalentUse(s: LabState, id: string) {
  return bondsOf(s, id).filter((b) => b.type === 'covalent').reduce((sum, b) => sum + b.order, 0);
}
const ionicUse = (s: LabState, id: string) => bondsOf(s, id).filter((b) => b.type === 'ionic').length;

function atomOptions(s: LabState, a: LabNode, b: LabNode): CompatibilityResult {
  const ea = elements[a.ref as ElementSymbol];
  const eb = elements[b.ref as ElementSymbol];
  const existing = s.bonds.find((x) => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));

  // Metals: only alkali / alkaline-earth / Al cations pairing with halide anions are modelled.
  const metalA = !ea.covalent, metalB = !eb.covalent;
  if (metalA || metalB) {
    if (metalA && metalB) {
      return { ok: false, reason: `${ea.name} and ${eb.name} are both metals. As ions they are both positively charged and repel each other; they do not form a molecule together.` };
    }
    const metal = metalA ? ea : eb, other = metalA ? eb : ea;
    const metalNode = metalA ? a : b, otherNode = metalA ? b : a;
    if (!isSaltCation(metal)) {
      return {
        ok: false,
        reason: `In cells ${metal.name.toLowerCase()} is held by coordination bonds to proteins and cofactors (for example ${metal.examples[0]}). Coordination chemistry is not modelled in this lab, so ${metal.symbol} cannot be connected here.`,
      };
    }
    if (!HALOGENS.has(other.symbol)) {
      return {
        ok: false,
        reason: `${metal.name} does not share electrons covalently. It gives up ${metal.ionCharge === 1 ? 'one electron' : `${metal.ionCharge} electrons`} to become ${metal.symbol}${metal.ionCharge === 1 ? '⁺' : `${metal.ionCharge}⁺`}. Compounds with ${other.name.toLowerCase()} (such as hydrides, oxides or sulfides) exist but are not modelled here; this lab only pairs these cations with halide anions (F⁻, Cl⁻, Br⁻, I⁻).`,
      };
    }
    if (existing) return { ok: false, reason: `${metal.symbol}⁺ and ${other.symbol}⁻ are already associated. An ionic attraction has no bond order to increase.` };
    if (covalentUse(s, otherNode.id) > 0) {
      return { ok: false, reason: `This ${other.name.toLowerCase()} atom is already covalently bonded, so it is not a free ${other.symbol}⁻ ion that could pair with ${metal.symbol}.` };
    }
    if (ionicUse(s, otherNode.id) >= 1) return { ok: false, reason: `This ${other.symbol}⁻ ion (charge −1) is already balanced by a cation.` };
    if (ionicUse(s, metalNode.id) >= (metal.ionCharge ?? 0)) {
      return { ok: false, reason: `${metal.symbol}${metal.ionCharge! > 1 ? metal.ionCharge : ''}⁺ already has ${metal.ionCharge} halide partner${metal.ionCharge! > 1 ? 's' : ''}, which balances its charge.` };
    }
    return {
      ok: true,
      options: [{
        key: 'ionic', label: `Ionic attraction ${metal.symbol}⁺ ··· ${other.symbol}⁻`, bondType: 'ionic',
        detail: `${metal.name} transfers an electron to ${other.name.toLowerCase()}, giving oppositely charged ions held together by electrostatic attraction. In a crystal they form a lattice; in water (and in cells) they separate into hydrated ions.`,
      }],
    };
  }

  // Covalent bonding between nonmetals, limited by typical valence.
  if (ionicUse(s, a.id) || ionicUse(s, b.id)) {
    const ion = ionicUse(s, a.id) ? ea : eb;
    return { ok: false, reason: `This ${ion.name.toLowerCase()} is already present as a ${ion.symbol}⁻ ion paired with a cation, so it has no electrons to share in a covalent bond.` };
  }
  const freeA = maxValence(ea) - covalentUse(s, a.id);
  const freeB = maxValence(eb) - covalentUse(s, b.id);
  const full = (e: ChemicalElement, used: number) => `${e.name} already uses ${used} bond${used === 1 ? '' : 's'}, the most it typically forms (${e.covalent!.valences.join(' or ')}).`;
  if (freeA < 1) return { ok: false, reason: full(ea, covalentUse(s, a.id)) };
  if (freeB < 1) return { ok: false, reason: full(eb, covalentUse(s, b.id)) };
  if (existing) {
    const next = existing.order + 1;
    const limit = Math.min(ea.covalent!.maxBondOrder, eb.covalent!.maxBondOrder);
    if (next > limit) {
      const which = ea.covalent!.maxBondOrder <= eb.covalent!.maxBondOrder ? ea : eb;
      return { ok: false, reason: `${which.name} does not form ${next === 2 ? 'double' : 'triple'} bonds in biomolecules${limit === 1 ? ' — only single bonds' : ''}.` };
    }
    const name = next === 2 ? 'double' : 'triple';
    return {
      ok: true,
      options: [{
        key: `raise-${next}`, label: `Make a ${name} bond ${ea.symbol}${next === 2 ? '=' : '≡'}${eb.symbol}`, bondType: 'covalent', order: next, existingBondId: existing.id,
        detail: `Sharing ${next} electron pairs. Each atom uses one more of its available valence.`,
      }],
    };
  }
  return {
    ok: true,
    options: [{
      key: 'single', label: `Single covalent bond ${ea.symbol}–${eb.symbol}`, bondType: 'covalent', order: 1,
      detail: `One shared electron pair. ${ea.symbol} has ${freeA} and ${eb.symbol} has ${freeB} free valence${freeB === 1 ? '' : 's'} before this bond. Connect the pair again to raise the bond order where chemistry allows it.`,
    }],
  };
}

// --- Building blocks ----------------------------------------------------------------

const usedSites = (s: LabState, id: string) => new Set(bondsOf(s, id).map((b) => siteOf(b, id)).filter(Boolean) as string[]);

function ruleFor(kindA: string, kindB: string): AssemblyRule | undefined {
  return assemblyRules.find((r) => (r.sites[0] === kindA && r.sites[1] === kindB) || (r.sites[0] === kindB && r.sites[1] === kindA));
}

function pentosesIn(s: LabState, ids: Iterable<string>): Set<'ribose' | 'deoxyribose'> {
  const out = new Set<'ribose' | 'deoxyribose'>();
  for (const id of ids) {
    const n = nodeById(s, id)!;
    if (n.kind !== 'block') continue;
    const bb = buildingBlocks[n.ref];
    const p = bb.pentose ?? bb.nucleotide?.pentose;
    if (p) out.add(p);
  }
  return out;
}

function incompatibilityReason(a: BuildingBlock, b: BuildingBlock): string {
  const cats = [a.category, b.category].sort().join('+');
  const has = (id: string) => a.id === id || b.id === id;
  const fa = (x: BuildingBlock) => x.sites.some((si) => si.kind === 'fa-carboxyl');
  if (a.category === 'amino-acid' && b.category === 'amino-acid') {
    return 'A peptide bond needs the carboxyl group of one amino acid and the amino group of the other, and the matching groups here are already used.';
  }
  if (cats === 'amino-acid+monosaccharide') {
    return 'Cells do attach sugars to proteins (glycosylation of Asn, Ser or Thr side chains in the ER and Golgi), but side-chain chemistry is not modelled in this lab. Backbone groups of amino acids do not form glycosidic bonds.';
  }
  if (cats === 'amino-acid+lipid-component') {
    if (has('phosphate')) return 'Kinases transfer phosphate from ATP to the side chains of Ser, Thr or Tyr (protein phosphorylation), but side-chain reactions are not modelled here; the backbone amino and carboxyl groups do not take a phosphate.';
    if (fa(a) || fa(b)) return 'Some proteins carry fatty acids attached by specific enzymes (e.g. N-myristoylation, S-palmitoylation of cysteine), but these modifications are not modelled. Free fatty acids do not form peptide bonds with amino acids.';
    return 'No assembly rule links an amino acid to this lipid component.';
  }
  if (a.category === 'amino-acid' || b.category === 'amino-acid') {
    return 'Amino acids are joined to RNA only as aminoacyl-tRNAs (an ester to the tRNA’s 3′ end, made by aminoacyl-tRNA synthetases using ATP); that step is not modelled here.';
  }
  if (cats === 'lipid-component+monosaccharide') {
    return 'Sugars are attached to lipids in glycolipids by Golgi glycosyltransferases, but that chemistry is not modelled. Hexoses are not part of phospholipids or triglycerides built here.';
  }
  if (a.category === 'monosaccharide' || b.category === 'monosaccharide') {
    if (a.category === 'monosaccharide' && b.category === 'monosaccharide') {
      return 'A glycosidic bond needs the anomeric carbon of at least one sugar, and the matching groups here are already used (or both partners offer only non-anomeric hydroxyls).';
    }
    return 'Hexoses such as glucose are not part of nucleotides. Nucleotides use the pentoses ribose (RNA) or deoxyribose (DNA).';
  }
  if (fa(a) && fa(b)) return 'Two carboxylic acids would form an acid anhydride, which is unstable in water and is not how lipids are built. Each fatty acid is esterified to a glycerol hydroxyl instead.';
  if (a.base && b.base) return 'Bases pair with each other through hydrogen bonds (A–T or A–U, G–C) between strands, not through covalent bonds. Base pairing is visible in the DNA structure in the molecule explorer.';
  if ((a.base && b.id === 'phosphate') || (b.base && a.id === 'phosphate')) return 'Phosphate bonds to the sugar, not to the base. Join the base to C1′ of a pentose and the phosphate to its 5′ hydroxyl.';
  if ((a.base && b.category === 'nucleotide') || (b.base && a.category === 'nucleotide')) return 'A ready-made nucleotide already has its base. Free bases connect only to the C1′ of a ribose or deoxyribose.';
  if ((a.base && b.category === 'lipid-component') || (b.base && a.category === 'lipid-component')) return 'Nitrogenous bases are not part of lipids. They bond only to C1′ of a pentose sugar.';
  if ((a.pentose && b.category === 'lipid-component' && b.id !== 'phosphate') || (b.pentose && a.category === 'lipid-component' && a.id !== 'phosphate')) {
    return 'No assembly rule joins a pentose to this lipid component. (Phosphate is the only shared component: it bonds to the 5′ or 3′ hydroxyl of a pentose.)';
  }
  if (a.id === 'glycerol' && b.id === 'glycerol') return 'Two glycerols would be joined by an ether bond; this does not occur in the lipids built here.';
  if (has('glycerol') && (has('choline') || has('ethanolamine'))) return 'Head groups attach through a phosphate bridge, not directly to glycerol: glycerol–O–P–O–choline.';
  if ((fa(a) && (b.id === 'phosphate' || b.id === 'choline' || b.id === 'ethanolamine')) || (fa(b) && (a.id === 'phosphate' || a.id === 'choline' || a.id === 'ethanolamine'))) {
    return 'Fatty acids are esterified to glycerol hydroxyls, not to phosphate or head groups.';
  }
  return `No assembly rule in this lab connects ${a.name} to ${b.name}.`;
}

function blockOptions(s: LabState, a: LabNode, b: LabNode): CompatibilityResult {
  const ba = buildingBlocks[a.ref], bb = buildingBlocks[b.ref];
  if (componentOf(s, a.id).has(b.id)) {
    return { ok: false, reason: 'These units are already part of the same assembly. Closing a ring between them (cyclic peptides, cyclic oligosaccharides) is not modelled in this lab.' };
  }
  const usedA = usedSites(s, a.id), usedB = usedSites(s, b.id);
  const options: ConnectionOption[] = [];
  const blocked: string[] = [];
  let anyRuleIgnoringUse = false;

  for (const sa of ba.sites) {
    for (const sb of bb.sites) {
      const rule = ruleFor(sa.kind, sb.kind);
      if (!rule) continue;
      anyRuleIgnoringUse = true;
      if (usedA.has(sa.id) || usedB.has(sb.id)) continue;
      // Base–sugar combinations that do not occur in standard DNA or RNA.
      if (rule.id === 'n-glycosidic') {
        const base = ba.base ?? bb.base;
        const pentose = ba.pentose ?? bb.pentose;
        if (base === 'T' && pentose === 'ribose') { blocked.push('Thymine is the DNA base: it pairs with deoxyribose. RNA uses uracil instead. (Ribothymidine does occur in some tRNAs, but it is made by methylating uridine already in the RNA.)'); continue; }
        if (base === 'U' && pentose === 'deoxyribose') { blocked.push('Uracil is the RNA base: it pairs with ribose. DNA uses thymine instead. (dUMP exists as an intermediate in thymidine synthesis but is kept out of DNA.)'); continue; }
      }
      options.push({
        key: `${sa.id}|${sb.id}|${rule.id}`,
        label: `${rule.name}: ${ba.short} ${sa.id} → ${bb.short} ${sb.id}`,
        bondType: rule.bondType,
        ruleId: rule.id,
        siteA: sa.id,
        siteB: sb.id,
        detail: `${sa.label} + ${sb.label}. ${rule.explanation}`,
      });
    }
  }

  if (options.length) {
    const pentoses = pentosesIn(s, [...componentOf(s, a.id), ...componentOf(s, b.id)]);
    if (pentoses.size > 1) {
      return { ok: false, reason: 'One part contains ribose (RNA) and the other deoxyribose (DNA). Strands in this lab are built from a single sugar type. (Mixed RNA–DNA chains do exist briefly, e.g. RNA primers during DNA replication.)' };
    }
    return { ok: true, options };
  }
  if (blocked.length) return { ok: false, reason: blocked[0] };
  if (anyRuleIgnoringUse) {
    const freeA = ba.sites.filter((x) => !usedA.has(x.id)).map((x) => x.label);
    const freeB = bb.sites.filter((x) => !usedB.has(x.id)).map((x) => x.label);
    return {
      ok: false,
      reason: `The groups that could react are already used. Free on ${ba.short}: ${freeA.join(', ') || 'none'}. Free on ${bb.short}: ${freeB.join(', ') || 'none'}.`,
    };
  }
  return { ok: false, reason: incompatibilityReason(ba, bb) };
}

/** What may join nodes `aId` and `bId`, or why nothing can. */
export function connectionOptions(s: LabState, aId: string, bId: string): CompatibilityResult {
  if (aId === bId) return { ok: false, reason: 'Choose two different components.' };
  const a = nodeById(s, aId), b = nodeById(s, bId);
  if (!a || !b) return { ok: false, reason: 'Component not found.' };
  if (a.kind !== b.kind) {
    const atom = a.kind === 'atom' ? a : b, block = a.kind === 'atom' ? b : a;
    return {
      ok: false,
      reason: `${elements[atom.ref as ElementSymbol].name} is a single atom, while ${buildingBlocks[block.ref].name} is a whole molecule. This lab assembles biomolecules from complete building blocks and builds small molecules from atoms; it does not attach loose atoms to biomolecules.`,
    };
  }
  return a.kind === 'atom' ? atomOptions(s, a, b) : blockOptions(s, a, b);
}

// --- Naming what was built -------------------------------------------------------

interface SmallMolecule { name: string; note: string; check?: (s: LabState, ids: string[]) => boolean }

const atomsBy = (s: LabState, ids: string[], el: string) => ids.filter((id) => nodeById(s, id)!.ref === el);
const bondBetween = (s: LabState, a: string, b: string) => s.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
const hasCC = (s: LabState, ids: string[]) => { const c = atomsBy(s, ids, 'C'); return !!(c.length === 2 && bondBetween(s, c[0], c[1])); };

const SMALL_MOLECULES: Record<string, SmallMolecule[]> = {
  H2: [{ name: 'Hydrogen (H₂)', note: 'Produced and consumed by some microbes (hydrogenases).' }],
  O2: [{ name: 'Oxygen (O₂)', note: 'The final electron acceptor of aerobic respiration in mitochondria.' }],
  N2: [{ name: 'Nitrogen (N₂)', note: 'Its triple bond is very strong; only nitrogen-fixing microbes can use N₂ directly.' }],
  H2O: [{ name: 'Water (H₂O)', note: 'The solvent of life; about 70% of a typical cell’s mass.' }],
  CO2: [{ name: 'Carbon dioxide (CO₂)', note: 'Released by the citric acid cycle in mitochondria; fixed by photosynthesis.' }],
  CH4: [{ name: 'Methane (CH₄)', note: 'Produced by methanogenic archaea.' }],
  H3N: [{ name: 'Ammonia (NH₃)', note: 'In cells mostly present as ammonium (NH₄⁺); a nitrogen source and a toxic waste product.' }],
  H2S: [{ name: 'Hydrogen sulfide (H₂S)', note: 'Toxic at high levels; also a signalling molecule at low levels.' }],
  ClH: [{ name: 'Hydrogen chloride (HCl)', note: 'In water it ionizes completely to H⁺ and Cl⁻ (hydrochloric acid, as in stomach acid).' }],
  BrH: [{ name: 'Hydrogen bromide (HBr)', note: 'A strong acid in water.' }],
  FH: [{ name: 'Hydrogen fluoride (HF)', note: 'A weak but highly toxic acid.' }],
  HI: [{ name: 'Hydrogen iodide (HI)', note: 'A strong acid in water.' }],
  H2O2: [{ name: 'Hydrogen peroxide (H₂O₂)', note: 'A reactive by-product of metabolism, destroyed by catalase in peroxisomes.' }],
  CHN: [{ name: 'Hydrogen cyanide (HCN)', note: 'Poisonous: cyanide blocks cytochrome c oxidase in mitochondria.' }],
  CH2O: [{ name: 'Formaldehyde (CH₂O)', note: 'A reactive aldehyde; the simplest molecule with the (CH₂O) formula of sugars.' }],
  CH4O: [{ name: 'Methanol (CH₃OH)', note: 'Toxic in humans because it is oxidized to formaldehyde and formic acid.' }],
  C2H6: [{ name: 'Ethane (C₂H₆)', note: 'A simple saturated hydrocarbon, like a piece of a fatty-acid chain.' }],
  C2H4: [{ name: 'Ethene (ethylene, C₂H₄)', note: 'A plant hormone that triggers fruit ripening.' }],
  C2H2: [{ name: 'Ethyne (acetylene, C₂H₂)', note: 'Contains a C≡C triple bond.' }],
  C2H6O: [
    { name: 'Ethanol (C₂H₅OH)', note: 'Produced by yeast fermentation.', check: hasCC },
    { name: 'Dimethyl ether (CH₃OCH₃)', note: 'An isomer of ethanol: same formula, different connectivity.', check: (s, ids) => !hasCC(s, ids) },
  ],
  CH2O2: [{ name: 'Formic acid (HCOOH)', note: 'The simplest carboxylic acid.' }],
  C2H4O2: [
    { name: 'Acetic acid (CH₃COOH)', note: 'As acetate (acetyl-CoA) it is a central metabolic building block.', check: hasCC },
    { name: 'Methyl formate (HCOOCH₃)', note: 'An ester isomer of acetic acid.', check: (s, ids) => !hasCC(s, ids) },
  ],
  CH4N2O: [{ name: 'Urea (CO(NH₂)₂)', note: 'Mammals excrete excess nitrogen as urea, made by the urea cycle in the liver.' }],
  CH5N: [{ name: 'Methylamine (CH₃NH₂)', note: 'The simplest primary amine.' }],
  H3O4P: [{ name: 'Phosphoric acid (H₃PO₄)', note: 'At pH 7 it exists mainly as HPO₄²⁻ and H₂PO₄⁻ (inorganic phosphate, Pᵢ).' }],
  H3P: [{ name: 'Phosphine (PH₃)', note: 'A toxic gas; not part of normal metabolism.' }],
  H2O4S: [{ name: 'Sulfuric acid (H₂SO₄)', note: 'In water it ionizes to sulfate, the form in which cells take up sulfur.' }],
};

function analyzeAtoms(s: LabState, ids: string[]): ProductAnalysis {
  const nodes = ids.map((id) => nodeById(s, id)!);
  const els = [...new Set(nodes.map((n) => n.ref as ElementSymbol))];
  const f: Formula = new Map();
  for (const n of nodes) f.set(n.ref, (f.get(n.ref) ?? 0) + 1);
  const bonds = s.bonds.filter((b) => ids.includes(b.a) && ids.includes(b.b));

  if (nodes.length === 1) {
    const e = elements[nodes[0].ref as ElementSymbol];
    return {
      name: `${e.name} atom`, productClass: 'atom', recognized: false, formula: null, units: 1, elements: els,
      description: `A single ${e.name.toLowerCase()} atom. In living cells ${e.name.toLowerCase()} is not found as isolated atoms; typical forms: ${e.forms.join('; ')}.`,
      bondSummary: [], notes: [],
    };
  }

  const ionic = bonds.filter((b) => b.type === 'ionic');
  if (ionic.length) {
    const charge = nodes.reduce((sum, n) => sum + (elements[n.ref as ElementSymbol].ionCharge ?? 0), 0);
    const cation = nodes.find((n) => (elements[n.ref as ElementSymbol].ionCharge ?? 0) > 0)!;
    const anion = nodes.find((n) => (elements[n.ref as ElementSymbol].ionCharge ?? 0) < 0)!;
    const ce = elements[cation.ref as ElementSymbol], ae = elements[anion.ref as ElementSymbol];
    const anionName = { F: 'fluoride', Cl: 'chloride', Br: 'bromide', I: 'iodide' }[ae.symbol as 'F'];
    const nAnion = nodes.filter((n) => n.ref === ae.symbol).length;
    const multiCation = nodes.filter((n) => n.ref === ce.symbol).length > 1;
    const formula = `${ce.symbol}${ae.symbol}${nAnion > 1 ? nAnion : ''}`;
    if (charge === 0 && !multiCation) {
      return {
        name: `${ce.name === 'Aluminum' ? 'Aluminium' : ce.name} ${anionName} (${prettyFormula(formula)})`, productClass: 'salt', recognized: true, formula: prettyFormula(formula), units: nodes.length, elements: els,
        description: `An ionic compound: ${ce.symbol}${ce.ionCharge! > 1 ? ce.ionCharge : ''}⁺ and ${nAnion} ${ae.symbol}⁻ ion${nAnion > 1 ? 's' : ''} with balanced charges. As a solid it forms a crystal lattice, not discrete molecules; dissolved in water — as in cells — the ions separate and are surrounded by water molecules.`,
        bondSummary: [`${ionic.length} ionic attraction${ionic.length > 1 ? 's' : ''} (no shared electron pairs)`],
        notes: ['Formula units of ionic compounds give ratios of ions, not molecules.'],
      };
    }
    return {
      name: 'Unbalanced ion group', productClass: 'ions', recognized: false, formula: null, units: nodes.length, elements: els,
      description: `Net charge ${charge > 0 ? '+' : ''}${charge}. Add ${charge > 0 ? 'halide anions' : 'cations'} until the charges balance.`,
      bondSummary: [`${ionic.length} ionic attraction${ionic.length > 1 ? 's' : ''}`], notes: [],
    };
  }

  // Covalent molecule: check each atom's valence.
  const missing: string[] = [];
  for (const n of nodes) {
    const e = elements[n.ref as ElementSymbol];
    const used = covalentUse(s, n.id);
    if (!e.covalent!.valences.includes(used)) {
      const next = e.covalent!.valences.find((v) => v > used);
      missing.push(`${e.symbol} has ${used} bond${used === 1 ? '' : 's'}${next ? ` (typically ${e.covalent!.valences.join(' or ')})` : ''}`);
    }
  }
  const hill = formatHill(f);
  const orders = bonds.reduce((m, b) => m.set(b.order, (m.get(b.order) ?? 0) + 1), new Map<number, number>());
  const bondSummary = [...orders].map(([o, n]) => `${n} ${['', 'single', 'double', 'triple'][o]} covalent bond${n > 1 ? 's' : ''}`);
  if (missing.length) {
    return {
      name: 'Incomplete molecule', productClass: 'incomplete', recognized: false, formula: null, units: nodes.length, elements: els, bondSummary,
      description: `Some atoms have unfilled valences: ${missing.join('; ')}. In real molecules every valence is satisfied — often by bonds to hydrogen.`,
      notes: [],
    };
  }
  const known = SMALL_MOLECULES[hill]?.find((m) => !m.check || m.check(s, ids));
  return {
    name: known?.name ?? `Molecule ${prettyFormula(f)}`,
    productClass: 'small-molecule', recognized: !!known, formula: prettyFormula(f), units: nodes.length, elements: els, bondSummary,
    description: known ? known.note : 'Every atom has a typical valence, so this is a plausible structure, but it is not in this lab’s catalogue of named molecules. Real stability also depends on geometry and energetics, which are not evaluated here.',
    notes: known ? [] : ['Valence rules allow many structures that are strained, unstable or reactive; this lab does not compute energies.'],
  };
}

// Block assemblies -------------------------------------------------------------------

const NUMBER_WORDS = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];

function blockFormula(s: LabState, ids: string[]): { f: Formula; charge: number; condensations: number } {
  const f: Formula = new Map();
  let charge = 0;
  for (const id of ids) {
    const bb = buildingBlocks[nodeById(s, id)!.ref];
    addFormula(f, parseFormula(bb.formula));
    charge += bb.charge ?? 0;
  }
  const bonds = s.bonds.filter((b) => ids.includes(b.a) && ids.includes(b.b));
  const condensations = bonds.filter((b) => assemblyRules.find((r) => r.id === b.ruleId)?.byproduct === 'H2O').length;
  addFormula(f, parseFormula('H2O'), -condensations);
  return { f, charge, condensations };
}

function bondSummaryFor(s: LabState, ids: string[]): string[] {
  const bonds = s.bonds.filter((b) => ids.includes(b.a) && ids.includes(b.b));
  const counts = new Map<string, number>();
  for (const b of bonds) {
    const name = assemblyRules.find((r) => r.id === b.ruleId)?.name ?? b.type;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => `${n} × ${name.toLowerCase()}`);
}

const elementsOf = (f: Formula) => [...f.keys()].filter((k) => k in elements) as ElementSymbol[];

function analyzePeptide(s: LabState, ids: string[]): Partial<ProductAnalysis> {
  if (ids.length === 1) {
    const bb = buildingBlocks[nodeById(s, ids[0])!.ref];
    return { name: bb.name, productClass: 'amino-acid', recognized: true, description: `A free amino acid. ${bb.description}`, moleculeId: bb.id === 'alanine' ? 'alanine' : undefined };
  }
  // Walk from the N-terminus (free amino group) along carboxyl → amino peptide bonds.
  const start = ids.find((id) => !usedSites(s, id).has('N'))!;
  const order: string[] = [];
  let cur: string | undefined = start;
  while (cur) {
    order.push(cur);
    const next: LabBond | undefined = bondsOf(s, cur).find((b) => siteOf(b, cur!) === 'C');
    cur = next ? otherEnd(next, cur) : undefined;
  }
  const seq = order.map((id) => buildingBlocks[nodeById(s, id)!.ref].short).join('-');
  const n = ids.length;
  const kind = n <= 10 ? `${NUMBER_WORDS[n]}peptide` : n <= 20 ? 'oligopeptide' : 'polypeptide';
  return {
    name: `${seq} (${kind})`, productClass: 'peptide', recognized: true,
    description: `A chain of ${n} amino acids joined by ${n - 1} peptide bond${n > 2 ? 's' : ''}, written from the N-terminus (free α-amino group, left) to the C-terminus (free α-carboxyl group, right). Its sequence is its primary structure; a real protein of a few hundred residues would fold into a specific 3D shape.`,
    moleculeId: seq === 'Gly-Gly' ? 'glycylglycine' : undefined,
  };
}

const sugarName = (bb: BuildingBlock) => ({ glucose: 'Glc', fructose: 'Fru', galactose: 'Gal' }[bb.sugar!.kind]);

function analyzeSugars(s: LabState, ids: string[]): Partial<ProductAnalysis> {
  const bonds = s.bonds.filter((b) => ids.includes(b.a) && ids.includes(b.b));
  if (ids.length === 1) {
    const bb = buildingBlocks[nodeById(s, ids[0])!.ref];
    return { name: bb.name, productClass: 'monosaccharide', recognized: true, description: bb.description, moleculeId: bb.moleculeId };
  }
  // Describe each linkage as donor (anomeric) → acceptor position.
  const links = bonds.map((b) => {
    const [d, dSite, acc, accSite] = buildingBlocks[nodeById(s, b.a)!.ref].sites.find((x) => x.id === b.siteA)!.kind === 'sugar-anomeric'
      ? [b.a, b.siteA!, b.b, b.siteB!] : [b.b, b.siteB!, b.a, b.siteA!];
    const donor = buildingBlocks[nodeById(s, d)!.ref], acceptor = buildingBlocks[nodeById(s, acc)!.ref];
    const accAnomeric = acceptor.sites.find((x) => x.id === accSite)!.kind === 'sugar-anomeric';
    return {
      donor, acceptor, accAnomeric,
      dPos: dSite.slice(1), aPos: accSite.slice(1),
      text: `${donor.sugar!.anomer === 'alpha' ? 'α' : 'β'}-D-${sugarName(donor)}-(${dSite.slice(1)}→${accSite.slice(1)})${accAnomeric ? `-${acceptor.sugar!.anomer === 'alpha' ? 'α' : 'β'}` : ''}-D-${sugarName(acceptor)}`,
    };
  });
  if (ids.length === 2) {
    const l = links[0];
    const is = (x: BuildingBlock, kind: string, anomer?: string) => x.sugar!.kind === kind && (!anomer || x.sugar!.anomer === anomer);
    const named: [boolean, string, string, string | undefined][] = [
      [!l.accAnomeric && is(l.donor, 'glucose', 'alpha') && is(l.acceptor, 'glucose') && l.aPos === '4', 'Maltose', 'Two glucoses joined α1→4 — the linkage of starch and glycogen chains.', 'maltose'],
      [!l.accAnomeric && is(l.donor, 'glucose', 'beta') && is(l.acceptor, 'glucose') && l.aPos === '4', 'Cellobiose', 'Two glucoses joined β1→4 — the repeating unit of cellulose.', 'cellobiose'],
      [!l.accAnomeric && is(l.donor, 'galactose', 'beta') && is(l.acceptor, 'glucose') && l.aPos === '4', 'Lactose', 'Galactose β1→4 glucose — the sugar of milk.', 'lactose'],
      [!l.accAnomeric && is(l.donor, 'glucose', 'alpha') && is(l.acceptor, 'glucose') && l.aPos === '6', 'Isomaltose', 'Two glucoses joined α1→6 — the linkage found at branch points of glycogen and amylopectin.', undefined],
      [!l.accAnomeric && is(l.donor, 'glucose', 'beta') && is(l.acceptor, 'glucose') && l.aPos === '6', 'Gentiobiose', 'Two glucoses joined β1→6.', undefined],
      [l.accAnomeric && ((is(l.donor, 'glucose', 'alpha') && is(l.acceptor, 'fructose', 'beta')) || (is(l.donor, 'fructose', 'beta') && is(l.acceptor, 'glucose', 'alpha'))), 'Sucrose', 'α-Glucose and β-fructose joined through both anomeric carbons (α1→β2): a non-reducing sugar, the transport sugar of plants.', 'sucrose'],
      [l.accAnomeric && is(l.donor, 'glucose', 'alpha') && is(l.acceptor, 'glucose', 'alpha'), 'α,α-Trehalose', 'Two α-glucoses joined through both anomeric carbons (α1→α1): a non-reducing sugar made by insects, fungi and some plants.', undefined],
    ];
    const hit = named.find((x) => x[0]);
    if (hit) return { name: `${hit[1]} (disaccharide)`, productClass: 'disaccharide', recognized: true, description: `${hit[2]} Linkage: ${l.text}.`, moleculeId: hit[3] };
    return { name: `Disaccharide ${l.text}`, productClass: 'disaccharide', recognized: false, description: `Two monosaccharides joined by a glycosidic bond (${l.text}). Not one of the common named disaccharides in this lab’s catalogue.` };
  }
  const allGlc = links.every((l) => l.donor.sugar!.kind === 'glucose' && l.acceptor.sugar!.kind === 'glucose' && !l.accAnomeric);
  const types = new Set(links.map((l) => `${l.donor.sugar!.anomer}-${l.aPos}`));
  const n = ids.length;
  if (allGlc && [...types].every((t) => t === 'alpha-4')) {
    return { name: `α-1,4-Glucan chain (${n} glucoses)`, productClass: 'polysaccharide', recognized: true, moleculeId: 'starch', description: `An unbranched chain of α1→4-linked glucoses, like a short piece of amylose (starch). Natural amylose contains hundreds to thousands of glucoses.` };
  }
  if (allGlc && [...types].every((t) => t === 'alpha-4' || t === 'alpha-6') && types.has('alpha-6')) {
    return { name: `Branched α-glucan (${n} glucoses)`, productClass: 'polysaccharide', recognized: true, moleculeId: 'glycogen', description: 'α1→4 chains with α1→6 branch points — the pattern of glycogen (animals, fungi) and amylopectin (plants). Glycogen branches every 8–12 residues and contains thousands of glucoses.' };
  }
  if (allGlc && [...types].every((t) => t === 'beta-4')) {
    return { name: `β-1,4-Glucan chain (${n} glucoses)`, productClass: 'polysaccharide', recognized: true, moleculeId: 'cellulose', description: 'An unbranched chain of β1→4-linked glucoses, like a short piece of cellulose. In plant cell walls such chains pack side by side into hydrogen-bonded microfibrils.' };
  }
  return { name: `Oligosaccharide (${n} sugars)`, productClass: 'polysaccharide', recognized: false, description: `Sugars joined by ${links.length} glycosidic bonds: ${links.map((l) => l.text).join('; ')}.` };
}

function analyzeLipid(s: LabState, ids: string[]): Partial<ProductAnalysis> {
  const nodes = ids.map((id) => nodeById(s, id)!);
  const glycerols = nodes.filter((n) => n.ref === 'glycerol');
  const fas = nodes.filter((n) => buildingBlocks[n.ref].sites.some((x) => x.kind === 'fa-carboxyl'));
  if (ids.length === 1) {
    const bb = buildingBlocks[nodes[0].ref];
    return { name: bb.name, productClass: fas.length ? 'fatty-acid' : 'lipid-component', recognized: true, description: bb.description, moleculeId: bb.moleculeId };
  }
  if (glycerols.length !== 1) {
    return { name: 'Lipid-component assembly', productClass: 'assembly', recognized: false, description: 'Valid bonds, but not a lipid class in this lab’s catalogue.' };
  }
  const g = glycerols[0];
  const at = (site: string) => {
    const b = bondsOf(s, g.id).find((x) => siteOf(x, g.id) === site);
    return b ? nodeById(s, otherEnd(b, g.id))! : undefined;
  };
  const pos = { sn1: at('sn1'), sn2: at('sn2'), sn3: at('sn3') };
  const acyl = Object.entries(pos).filter(([, n]) => n && fas.includes(n));
  const phosEntry = Object.entries(pos).find(([, n]) => n?.ref === 'phosphate');
  const acylName = (n: LabNode) => (n.ref === 'palmitic-acid' ? 'palmitoyl' : 'oleoyl');
  const acylList = acyl.map(([p, n]) => `${acylName(n!)} at ${p.replace('sn', 'sn-')}`).join(', ');

  if (!phosEntry) {
    const k = acyl.length;
    const cls = ['', 'Monoacylglycerol', 'Diacylglycerol', 'Triacylglycerol (triglyceride)'][k];
    return {
      name: cls, productClass: k === 3 ? 'triglyceride' : 'acylglycerol', recognized: true, moleculeId: k === 3 ? 'triglyceride' : undefined,
      description: k === 3
        ? `Glycerol esterified to three fatty acids (${acylList}): a neutral storage fat. Triglycerides are stored in lipid droplets and release fatty acids for β-oxidation when energy is needed.`
        : `Glycerol esterified to ${k} fatty acid${k > 1 ? 's' : ''} (${acylList}). ${k === 2 ? 'Diacylglycerol is also a second messenger that activates protein kinase C.' : 'An intermediate of fat digestion and synthesis.'}`,
    };
  }
  const phos = phosEntry[1]!;
  const head = bondsOf(s, phos.id).map((b) => nodeById(s, otherEnd(b, phos.id))!).find((n) => n.ref === 'choline' || n.ref === 'ethanolamine');
  const sn2Phosphate = phosEntry[0] === 'sn2';
  const notes = sn2Phosphate ? ['Natural glycerophospholipids carry the phosphate on sn-3 (a terminal carbon), not on sn-2.'] : [];
  if (acyl.length === 2) {
    const name = head?.ref === 'choline' ? 'Phosphatidylcholine' : head?.ref === 'ethanolamine' ? 'Phosphatidylethanolamine' : 'Phosphatidic acid';
    const popc = head?.ref === 'choline' && pos.sn1?.ref === 'palmitic-acid' && pos.sn2?.ref === 'oleic-acid' && phosEntry[0] === 'sn3';
    return {
      name: popc ? 'Phosphatidylcholine (POPC: 1-palmitoyl-2-oleoyl)' : name, productClass: 'phospholipid', recognized: true, notes,
      moleculeId: head?.ref === 'choline' ? 'phosphatidylcholine' : undefined,
      description: `${name}: two fatty acids (${acylList}) and a phosphate${head ? `–${head.ref}` : ''} head group on glycerol. The polar head and two hydrophobic tails make it amphipathic, so such molecules form bilayers in water. ${head ? '' : 'Phosphatidic acid is the precursor from which other glycerophospholipids are made.'}`.trim(),
    };
  }
  if (acyl.length === 1) {
    return { name: `Lysophospholipid${head ? ` (lyso-${head.ref === 'choline' ? 'PC' : 'PE'})` : ' (lysophosphatidic acid)'}`, productClass: 'lysophospholipid', recognized: true, notes, description: 'A glycerophospholipid with only one fatty acid. Lysophospholipids are cone-shaped, act as signalling molecules, and in excess disrupt bilayers.' };
  }
  return { name: 'Glycerol phosphate', productClass: 'glycerol-phosphate', recognized: true, notes, description: 'Glycerol carrying a phosphate: the backbone onto which cells esterify fatty acids to make phospholipids and triglycerides.' };
}

interface Residue { id: string; base?: 'A' | 'G' | 'C' | 'T' | 'U'; pentose: 'ribose' | 'deoxyribose'; phosphate5: boolean; threeHandle: { node: string; site: string }; fiveNode?: string }

const NUCLEOSIDE: Record<string, [string, string]> = {
  A: ['Adenosine', 'Deoxyadenosine'], G: ['Guanosine', 'Deoxyguanosine'], C: ['Cytidine', 'Deoxycytidine'], T: ['Ribothymidine', 'Thymidine'], U: ['Uridine', 'Deoxyuridine'],
};

function analyzeNucleic(s: LabState, ids: string[]): Partial<ProductAnalysis> {
  const nodes = ids.map((id) => nodeById(s, id)!);
  const residues: Residue[] = [];
  const neighbourAt = (id: string, site: string) => {
    const b = bondsOf(s, id).find((x) => siteOf(x, id) === site);
    return b ? nodeById(s, otherEnd(b, id)) : undefined;
  };
  for (const n of nodes) {
    const bb = buildingBlocks[n.ref];
    if (bb.pentose) {
      const base = neighbourAt(n.id, "C1'");
      const p5 = neighbourAt(n.id, "C5'");
      residues.push({ id: n.id, base: base ? buildingBlocks[base.ref].base : undefined, pentose: bb.pentose, phosphate5: p5?.ref === 'phosphate', threeHandle: { node: n.id, site: "C3'" }, fiveNode: p5?.id });
    } else if (bb.nucleotide) {
      residues.push({ id: n.id, base: bb.nucleotide.base, pentose: bb.nucleotide.pentose, phosphate5: true, threeHandle: { node: n.id, site: "3'OH" }, fiveNode: n.id });
    }
  }
  if (!residues.length) {
    const bb = buildingBlocks[nodes[0].ref];
    return { name: ids.length === 1 ? bb.name : 'Assembly', productClass: ids.length === 1 ? 'nucleotide-component' : 'assembly', recognized: ids.length === 1, description: bb.description };
  }
  // X → Y when X's 3′ group is bonded to Y's 5′ phosphate (directly or via a phosphate block).
  const next = new Map<string, string>();
  for (const x of residues) {
    const partner = neighbourAt(x.threeHandle.node, x.threeHandle.site);
    if (!partner) continue;
    const y = residues.find((r) => r.id !== x.id && (r.fiveNode === partner.id));
    if (y) next.set(x.id, y.id);
  }
  const incoming = new Set(next.values());
  const pentose = residues[0].pentose;
  const deoxy = pentose === 'deoxyribose';

  if (residues.length === 1) {
    const r = residues[0];
    if (!r.base) {
      return { name: `${deoxy ? '2-Deoxyribose' : 'Ribose'}${r.phosphate5 ? ' 5-phosphate' : ''}`, productClass: 'sugar-phosphate', recognized: true, description: r.phosphate5 ? 'A sugar phosphate. Ribose-5-phosphate (from the pentose phosphate pathway) is the starting point for nucleotide synthesis.' : 'A pentose sugar.' };
    }
    const nucleoside = NUCLEOSIDE[r.base][deoxy ? 1 : 0];
    if (!r.phosphate5) {
      const p3 = neighbourAt(r.threeHandle.node, r.threeHandle.site)?.ref === 'phosphate';
      return {
        name: p3 ? `${nucleoside} 3′-monophosphate` : nucleoside, productClass: p3 ? 'nucleotide' : 'nucleoside', recognized: true,
        description: p3 ? 'A nucleotide with its phosphate on the 3′ carbon; nucleic-acid synthesis uses 5′-phosphates.' : `A nucleoside: ${r.base === 'A' || r.base === 'G' ? 'purine' : 'pyrimidine'} base + ${pentose}, joined by an N-glycosidic bond. Adding a 5′ phosphate makes a nucleotide.`,
      };
    }
    const code = `${deoxy ? 'd' : ''}${r.base}MP`;
    return {
      name: `${code} (${nucleoside} 5′-monophosphate)`, productClass: 'nucleotide', recognized: true, moleculeId: code === 'dAMP' ? 'damp' : undefined,
      description: `A nucleotide: base + ${pentose} + 5′ phosphate. It is a monomer unit of ${deoxy ? 'DNA' : 'RNA'}. Cells polymerize the triphosphate form (${deoxy ? 'd' : ''}${r.base}TP).`,
    };
  }
  const start = residues.find((r) => !incoming.has(r.id));
  const order: Residue[] = [];
  let cur = start;
  while (cur && order.length <= residues.length) {
    order.push(cur);
    const nid = next.get(cur.id);
    cur = nid ? residues.find((r) => r.id === nid) : undefined;
  }
  if (order.length !== residues.length || residues.some((r) => !r.base)) {
    return { name: 'Sugar–phosphate assembly', productClass: 'assembly', recognized: false, description: 'Pentoses linked through phosphate, but not every sugar carries a base or the chain is not a single 5′→3′ strand. Add bases to C1′ and join each 3′-OH to the next 5′-phosphate.' };
  }
  const seq = order.map((r) => r.base).join('');
  const n = order.length;
  return {
    name: `${deoxy ? 'DNA' : 'RNA'} strand 5′-${seq}-3′ (${n === 2 ? 'dinucleotide' : `${n}-nucleotide oligonucleotide`})`,
    productClass: 'nucleic-acid', recognized: true,
    description: `${n} ${deoxy ? 'deoxy' : ''}ribonucleotides joined by ${n - 1} 3′→5′ phosphodiester linkage${n > 2 ? 's' : ''}, forming the sugar–phosphate backbone with bases projecting from it. By convention the sequence is written from the 5′ end to the 3′ end.${deoxy ? ' A complementary strand would pair through A–T and G–C hydrogen bonds to form a double helix.' : ''}`,
  };
}

/** Names and describes the assembly containing `nodeId`. */
export function analyzeComponent(s: LabState, nodeId: string): ProductAnalysis {
  const ids = [...componentOf(s, nodeId)];
  const first = nodeById(s, ids[0])!;
  if (first.kind === 'atom') return analyzeAtoms(s, ids);

  const cats = new Set(ids.map((id) => buildingBlocks[nodeById(s, id)!.ref].category));
  let partial: Partial<ProductAnalysis>;
  if (cats.size === 1 && cats.has('amino-acid')) partial = analyzePeptide(s, ids);
  else if (cats.size === 1 && cats.has('monosaccharide')) partial = analyzeSugars(s, ids);
  else if (cats.has('nucleotide') || cats.has('nucleotide-component')) partial = analyzeNucleic(s, ids);
  else if (cats.size === 1 && cats.has('lipid-component')) partial = analyzeLipid(s, ids);
  else partial = { name: `Assembly of ${ids.length} building blocks`, productClass: 'assembly', recognized: false, description: 'Every bond follows a rule, but the combination is not a named biomolecule in this lab’s catalogue.' };

  const { f, charge, condensations } = blockFormula(s, ids);
  let shownCharge = charge;
  const notes = [...(partial.notes ?? [])];
  let formulaNote = condensations ? `Bookkeeping: sum of the building blocks minus ${condensations} H₂O (one per condensation bond), neutral un-ionized forms.` : 'Neutral, un-ionized form.';
  if (partial.productClass === 'phospholipid' && charge === 1) {
    // The phosphate of PC carries a negative charge at pH 7, balancing choline: a zwitterion.
    addFormula(f, parseFormula('H'), -1);
    shownCharge = 0;
    formulaNote = `Bookkeeping: building blocks minus ${condensations} H₂O, shown as the zwitterion (phosphate deprotonated, balancing the choline cation).`;
  }
  return {
    name: partial.name!, productClass: partial.productClass!, recognized: partial.recognized ?? false,
    formula: prettyFormula(f, shownCharge), formulaNote, units: ids.length,
    description: partial.description ?? '', bondSummary: bondSummaryFor(s, ids), notes, moleculeId: partial.moleculeId,
    elements: elementsOf(f),
  };
}

/** Rule explaining a bond, for the inspector. */
export const ruleById = (id?: string) => assemblyRules.find((r) => r.id === id);
