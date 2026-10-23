import type { BondType, ElementSymbol } from '../../types/science';

export interface LabNode {
  id: string;
  kind: 'atom' | 'block';
  /** Element symbol for atoms, building-block id for blocks. */
  ref: string;
  x: number;
  y: number;
}

export interface LabBond {
  id: string;
  a: string;
  b: string;
  /** Site ids for block–block bonds. */
  siteA?: string;
  siteB?: string;
  type: BondType;
  /** Bond order for covalent atom–atom bonds. */
  order: number;
  ruleId?: string;
}

export interface LabState {
  nodes: LabNode[];
  bonds: LabBond[];
  nextId: number;
}

export interface ConnectionOption {
  key: string;
  label: string;
  bondType: BondType;
  ruleId?: string;
  siteA?: string;
  siteB?: string;
  /** For covalent bonds: the order to create (or raise an existing bond to). */
  order?: number;
  /** Set when the option raises an existing bond's order. */
  existingBondId?: string;
  detail: string;
}

export type CompatibilityResult = { ok: true; options: ConnectionOption[] } | { ok: false; reason: string };

export interface ProductAnalysis {
  /** Display name of the assembly containing the node. */
  name: string;
  /** Stable class used by missions: 'peptide', 'phospholipid', ... */
  productClass: string;
  recognized: boolean;
  /** Pretty formula, or null when the assembly is incomplete. */
  formula: string | null;
  formulaNote?: string;
  /** Number of building blocks or atoms. */
  units: number;
  description: string;
  bondSummary: string[];
  notes: string[];
  /** Molecule in the catalogue that this product corresponds to. */
  moleculeId?: string;
  elements: ElementSymbol[];
}
