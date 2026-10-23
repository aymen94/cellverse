// Typed models for CellVerse's educational content. The content itself lives in
// src/data/; nothing here depends on rendering or UI code.

export type ReferenceKind = 'textbook' | 'database' | 'article' | 'structure' | 'factsheet' | 'standard';

export interface Reference {
  id: string;
  title: string;
  /** Publisher, journal or database. */
  source: string;
  authors?: string;
  year?: number;
  url: string;
  /** DOI, PDB id, PubChem CID, NCBI Bookshelf accession... */
  identifier?: string;
  kind: ReferenceKind;
}

export type OrganelleId =
  | 'plasma-membrane'
  | 'cytoplasm'
  | 'nucleus'
  | 'nuclear-envelope'
  | 'nuclear-pore'
  | 'nucleolus'
  | 'mitochondrion'
  | 'rough-er'
  | 'smooth-er'
  | 'ribosome'
  | 'golgi'
  | 'lysosome'
  | 'peroxisome'
  | 'vesicle'
  | 'cytoskeleton'
  | 'centrosome';

export type OrganelleGroup = 'boundary' | 'genetic' | 'endomembrane' | 'energy' | 'structural' | 'protein-synthesis';

export interface OrganelleRelationship {
  id: OrganelleId;
  text: string;
}

export interface Organelle {
  id: OrganelleId;
  name: string;
  scientificName?: string;
  group: OrganelleGroup;
  /** For the hierarchy view (nuclear pores belong to the nuclear envelope, ...). */
  parent?: OrganelleId;
  /** Quick overview: one or two accessible sentences. */
  summary: string;
  /** Scientific details: short paragraphs with terminology. */
  details: string[];
  function: string;
  structure: string;
  processes: string[];
  relationships: OrganelleRelationship[];
  /** Molecules from the molecule catalogue. */
  molecules: MoleculeId[];
  /** Other relevant molecules that are not in the catalogue. */
  moleculeNotes: string[];
  elements: ElementSymbol[];
  facts: string[];
  /** Typical real size, for the scale annotations. */
  size: string;
  /** How the 3D model departs from reality. */
  simplifications: string[];
  references: string[];
  /** Display colour of the organelle (also used for its label marker). */
  color: string;
}

export type ElementSymbol =
  | 'H' | 'C' | 'N' | 'O' | 'P' | 'S'
  | 'Na' | 'K' | 'Ca' | 'Mg' | 'Cl' | 'Fe'
  | 'Zn' | 'Cu' | 'Mn' | 'Co' | 'Mo' | 'Se' | 'I' | 'F' | 'Si' | 'Cr' | 'Ni' | 'B' | 'V' | 'Sn' | 'Li' | 'Br' | 'Sr' | 'Al';

/** The three groups of the element explorer. */
export type ElementCategory = 'major' | 'ion-mineral' | 'additional';

/**
 * How firmly an element's biological requirement is established:
 *  - universal: required by all known cellular life as part of its biomolecules;
 *  - essential: an established requirement for humans and most organisms studied;
 *  - essential-trace: required in trace amounts by humans (and many other organisms);
 *  - species-dependent: required by some organisms (plants, microbes) but not established for humans;
 *  - uncertain: proposed or debated roles, with limited or conflicting evidence;
 *  - none-established: no established biological requirement.
 */
export type Essentiality = 'universal' | 'essential' | 'essential-trace' | 'species-dependent' | 'uncertain' | 'none-established';

export interface CovalentProfile {
  /** Common total bond orders (valences) in biomolecules, smallest first. */
  valences: number[];
  /** Highest bond order to a single partner. */
  maxBondOrder: 1 | 2 | 3;
}

export interface ChemicalElement {
  symbol: ElementSymbol;
  name: string;
  atomicNumber: number;
  /** IUPAC abridged standard atomic weight, as written (keeps significant digits). */
  atomicMass: string;
  period: number;
  group: number;
  category: ElementCategory;
  essentiality: Essentiality;
  essentialityNote: string;
  biologicalRole: string;
  /** Cellular locations or molecular associations. */
  locations: string[];
  /** Typical biological forms (ion, covalently bound atom, cofactor...). */
  forms: string[];
  examples: string[];
  /** Cell structures to highlight when the element is selected. */
  organelles: OrganelleId[];
  caveats?: string;
  /** For the laboratory: covalent bonding (nonmetals) ... */
  covalent?: CovalentProfile;
  /** ... or the usual ionic charge (metals and halides). */
  ionCharge?: number;
  references: string[];
  /** Jmol/CPK-style colour for atoms of this element. */
  color: string;
}

export type MoleculeFamily = 'protein' | 'carbohydrate' | 'lipid' | 'nucleic-acid';

export type MoleculeId =
  | 'alanine' | 'glycylglycine' | 'hemoglobin' | 'actin' | 'collagen' | 'lysozyme'
  | 'glucose' | 'sucrose' | 'maltose' | 'lactose' | 'cellobiose' | 'starch' | 'glycogen' | 'cellulose'
  | 'palmitic-acid' | 'triglyceride' | 'phosphatidylcholine' | 'cholesterol'
  | 'damp' | 'atp' | 'dna' | 'mrna' | 'trna';

/** Keys of the files in src/data/structures/ (see scripts/fetch-structures.mjs). */
export type StructureKey =
  | 'alpha-glucose' | 'beta-glucose' | 'beta-fructose' | 'beta-galactose' | 'sucrose' | 'maltose' | 'lactose' | 'cellobiose'
  | 'cholesterol' | 'atp' | 'glycine' | 'alanine' | 'serine' | 'cysteine' | 'valine' | 'leucine' | 'lysine'
  | 'aspartic-acid' | 'glutamic-acid' | 'phenylalanine' | 'glycerol' | 'palmitic-acid' | 'oleic-acid'
  | 'phosphoric-acid' | 'choline' | 'ethanolamine' | 'adenine' | 'guanine' | 'cytosine' | 'thymine' | 'uracil'
  | 'ribose' | 'deoxyribose' | 'damp' | 'amp' | 'dgmp' | 'dcmp' | 'dtmp' | 'gmp' | 'cmp' | 'ump' | 'glycylglycine' | 'popc' | 'tristearin'
  | 'hemoglobin' | 'actin' | 'collagen' | 'lysozyme' | 'dna' | 'trna';

export type SchematicKind = 'amylose' | 'glycogen' | 'cellulose' | 'mrna';

export type StructureRef = { type: 'file'; key: StructureKey } | { type: 'schematic'; kind: SchematicKind };

/**
 * How the 3D representation was obtained:
 *  - experimental: coordinates from an experimentally determined structure (PDB);
 *  - computed: a computed conformer (PubChem 3D);
 *  - idealized: idealized coordinates from a chemical dictionary (PDB CCD);
 *  - schematic: an educational model whose geometry is illustrative only.
 */
export type RepresentationKind = 'experimental' | 'computed' | 'idealized' | 'schematic';

export interface Molecule {
  id: MoleculeId;
  name: string;
  family: MoleculeFamily;
  /** e.g. "Monosaccharide", "Globular protein". */
  subtype: string;
  formula?: string;
  formulaNote?: string;
  buildingBlocks: string;
  bonds: string;
  function: string;
  location: string;
  organelles: OrganelleId[];
  elements: ElementSymbol[];
  explanation: string;
  details: string[];
  /** Organisms in which the stated roles apply, where that matters. */
  organisms?: string;
  structure: StructureRef;
  representation: RepresentationKind;
  representationNote: string;
  references: string[];
}

export interface MoleculeFamilyInfo {
  id: MoleculeFamily;
  name: string;
  overview: string;
  monomers: string;
  linkage: string;
  roles: string;
  subtopics: { title: string; text: string }[];
  references: string[];
}

// --- Laboratory ---------------------------------------------------------------

export type BuildingBlockCategory = 'amino-acid' | 'monosaccharide' | 'lipid-component' | 'nucleotide-component' | 'nucleotide';

/** The kind of reactive group a connection site stands for. */
export type SiteKind =
  | 'aa-amine' | 'aa-carboxyl'
  | 'sugar-anomeric' | 'sugar-hydroxyl'
  | 'glycerol-hydroxyl' | 'fa-carboxyl' | 'phosphate-hydroxyl' | 'headgroup-hydroxyl'
  | 'base-nitrogen' | 'pentose-c1' | 'pentose-5oh' | 'pentose-3oh'
  | 'nucleotide-5p' | 'nucleotide-3oh';

export interface ConnectionSite {
  id: string;
  kind: SiteKind;
  label: string;
}

export interface BuildingBlock {
  id: string;
  name: string;
  /** Short label shown in the workspace (Gly, α-Glc, A...). */
  short: string;
  category: BuildingBlockCategory;
  /** Molecular formula of the free (un-ionized) molecule, as used for condensation bookkeeping. */
  formula: string;
  charge?: number;
  structure: StructureKey;
  sites: ConnectionSite[];
  description: string;
  /** For sugars: anomer and identity used to name disaccharides. */
  sugar?: { kind: 'glucose' | 'fructose' | 'galactose'; anomer: 'alpha' | 'beta' };
  pentose?: 'ribose' | 'deoxyribose';
  base?: 'A' | 'G' | 'C' | 'T' | 'U';
  /** For ready-made nucleotides. */
  nucleotide?: { base: 'A' | 'G' | 'C' | 'T' | 'U'; pentose: 'ribose' | 'deoxyribose' };
  moleculeId?: MoleculeId;
  references: string[];
}

export type BondType = 'peptide' | 'glycosidic' | 'ester' | 'phosphoester' | 'phosphodiester' | 'n-glycosidic' | 'covalent' | 'ionic';

export interface AssemblyRule {
  id: string;
  name: string;
  bondType: BondType;
  /** The two site kinds the rule joins (order does not matter). */
  sites: [SiteKind, SiteKind];
  /** Small molecule released in the net condensation, if any. */
  byproduct: 'H2O' | null;
  /** What the bond is, chemically. */
  explanation: string;
  /** How cells actually make it (activation, enzymes): this lab does not simulate it. */
  cellularReality: string;
  references: string[];
}

// --- Missions -----------------------------------------------------------------

export type MissionCondition =
  | { type: 'select'; kind: 'organelle' | 'element' | 'molecule'; id: string }
  | { type: 'select-all'; kind: 'organelle' | 'element' | 'molecule'; ids: string[] }
  | { type: 'nav-mode'; mode: 'interior' | 'closeup' }
  | { type: 'focus'; id: OrganelleId }
  | { type: 'open-lab' }
  | { type: 'lab-product'; productClass: string; minUnits?: number };

export interface MissionStep {
  id: string;
  objective: string;
  hint: string;
  condition: MissionCondition;
  /** What the app can show to help (focus an organelle, open a molecule...). */
  assist?: { kind: 'organelle' | 'molecule' | 'element' | 'lab'; id?: string };
}

export interface Mission {
  id: string;
  title: string;
  summary: string;
  steps: MissionStep[];
  completion: string;
  references: string[];
}
