import type { AssemblyRule, BuildingBlock, BuildingBlockCategory, ConnectionSite } from '../types/science';

// Building blocks and the rules that may join them. A block exposes only the reactive
// groups this educational lab models (its "sites"); each site can form one bond.

const aaSites: ConnectionSite[] = [
  { id: 'N', kind: 'aa-amine', label: 'α-amino group (–NH₂)' },
  { id: 'C', kind: 'aa-carboxyl', label: 'α-carboxyl group (–COOH)' },
];

const aa = (id: string, name: string, short: string, formula: string, extra: string): BuildingBlock => ({
  id, name, short, category: 'amino-acid', formula, structure: id as BuildingBlock['structure'], sites: aaSites,
  description: `${extra} Only the backbone α-amino and α-carboxyl groups take part in peptide bonds here.`,
  references: [`pc-${id}`, 'os-proteins'],
});

const hexoseSites = (anomericLabel: string): ConnectionSite[] => [
  { id: 'C1', kind: 'sugar-anomeric', label: anomericLabel },
  { id: 'C4', kind: 'sugar-hydroxyl', label: 'C4 hydroxyl (–OH)' },
  { id: 'C6', kind: 'sugar-hydroxyl', label: 'C6 hydroxyl (–OH)' },
];

const pentoseSites: ConnectionSite[] = [
  { id: "C1'", kind: 'pentose-c1', label: "C1′ (bonds to the base)" },
  { id: "C5'", kind: 'pentose-5oh', label: "5′ hydroxyl (bonds to phosphate)" },
  { id: "C3'", kind: 'pentose-3oh', label: "3′ hydroxyl (links to the next nucleotide)" },
];

const nucleotideSites: ConnectionSite[] = [
  { id: "5'P", kind: 'nucleotide-5p', label: "5′ phosphate" },
  { id: "3'OH", kind: 'nucleotide-3oh', label: "3′ hydroxyl" },
];

export const buildingBlockList: BuildingBlock[] = [
  aa('glycine', 'Glycine', 'Gly', 'C2H5NO2', 'The smallest amino acid; its side chain is a single hydrogen.'),
  aa('alanine', 'L-Alanine', 'Ala', 'C3H7NO2', 'Nonpolar; methyl side chain.'),
  aa('serine', 'L-Serine', 'Ser', 'C3H7NO3', 'Polar; its hydroxyl side chain can be phosphorylated or glycosylated in cells.'),
  aa('cysteine', 'L-Cysteine', 'Cys', 'C3H7NO2S', 'Contains a thiol (–SH) that can form disulfide bonds in folded proteins.'),
  aa('valine', 'L-Valine', 'Val', 'C5H11NO2', 'Nonpolar, branched side chain.'),
  aa('leucine', 'L-Leucine', 'Leu', 'C6H13NO2', 'Nonpolar, branched side chain; common in protein cores.'),
  aa('lysine', 'L-Lysine', 'Lys', 'C6H14N2O2', 'Positively charged side-chain amino group at physiological pH.'),
  aa('aspartic-acid', 'L-Aspartic acid', 'Asp', 'C4H7NO4', 'Negatively charged side-chain carboxyl at physiological pH.'),
  aa('glutamic-acid', 'L-Glutamic acid', 'Glu', 'C5H9NO4', 'Negatively charged side chain; also a neurotransmitter.'),
  aa('phenylalanine', 'L-Phenylalanine', 'Phe', 'C9H11NO2', 'Aromatic, hydrophobic side chain.'),

  {
    id: 'alpha-glucose', name: 'α-D-Glucose', short: 'α-Glc', category: 'monosaccharide', formula: 'C6H12O6',
    structure: 'alpha-glucose', sites: hexoseSites('C1 anomeric –OH (α)'), sugar: { kind: 'glucose', anomer: 'alpha' },
    description: 'Glucose with the anomeric C1 hydroxyl in the α orientation; α-linkages build starch and glycogen.',
    moleculeId: 'glucose', references: ['pc-alpha-glucose', 'os-carbohydrates'],
  },
  {
    id: 'beta-glucose', name: 'β-D-Glucose', short: 'β-Glc', category: 'monosaccharide', formula: 'C6H12O6',
    structure: 'beta-glucose', sites: hexoseSites('C1 anomeric –OH (β)'), sugar: { kind: 'glucose', anomer: 'beta' },
    description: 'Glucose with the anomeric C1 hydroxyl in the β orientation; β-1,4 linkages build cellulose.',
    moleculeId: 'glucose', references: ['pc-beta-glucose', 'os-carbohydrates'],
  },
  {
    id: 'beta-fructose', name: 'β-D-Fructose', short: 'β-Fru', category: 'monosaccharide', formula: 'C6H12O6',
    structure: 'beta-fructose', sites: [{ id: 'C2', kind: 'sugar-anomeric', label: 'C2 anomeric –OH (β)' }], sugar: { kind: 'fructose', anomer: 'beta' },
    description: 'A ketohexose in its five-membered (furanose) ring form; its anomeric carbon is C2.',
    references: ['pc-beta-fructose', 'os-carbohydrates'],
  },
  {
    id: 'beta-galactose', name: 'β-D-Galactose', short: 'β-Gal', category: 'monosaccharide', formula: 'C6H12O6',
    structure: 'beta-galactose', sites: hexoseSites('C1 anomeric –OH (β)'), sugar: { kind: 'galactose', anomer: 'beta' },
    description: 'An epimer of glucose (differs at C4); combined with glucose it forms lactose.',
    references: ['pc-beta-galactose', 'os-carbohydrates'],
  },

  {
    id: 'glycerol', name: 'Glycerol', short: 'Gro', category: 'lipid-component', formula: 'C3H8O3', structure: 'glycerol',
    sites: [
      { id: 'sn1', kind: 'glycerol-hydroxyl', label: 'sn-1 hydroxyl' },
      { id: 'sn2', kind: 'glycerol-hydroxyl', label: 'sn-2 hydroxyl' },
      { id: 'sn3', kind: 'glycerol-hydroxyl', label: 'sn-3 hydroxyl' },
    ],
    description: 'A three-carbon alcohol with three hydroxyl groups: the backbone of triglycerides and glycerophospholipids.',
    references: ['pc-glycerol', 'os-lipids'],
  },
  {
    id: 'palmitic-acid', name: 'Palmitic acid (16:0)', short: 'C16:0', category: 'lipid-component', formula: 'C16H32O2', structure: 'palmitic-acid',
    sites: [{ id: 'COOH', kind: 'fa-carboxyl', label: 'Carboxyl group' }],
    description: 'Saturated 16-carbon fatty acid.', moleculeId: 'palmitic-acid', references: ['pc-palmitic-acid', 'os-lipids'],
  },
  {
    id: 'oleic-acid', name: 'Oleic acid (18:1 cis-9)', short: 'C18:1', category: 'lipid-component', formula: 'C18H34O2', structure: 'oleic-acid',
    sites: [{ id: 'COOH', kind: 'fa-carboxyl', label: 'Carboxyl group' }],
    description: 'Monounsaturated 18-carbon fatty acid with one cis double bond, which kinks the chain.', references: ['pc-oleic-acid', 'os-lipids'],
  },
  {
    id: 'phosphate', name: 'Phosphate (as phosphoric acid)', short: 'Pi', category: 'lipid-component', formula: 'H3PO4', structure: 'phosphoric-acid',
    sites: [
      { id: 'OH-a', kind: 'phosphate-hydroxyl', label: 'P–OH (first ester position)' },
      { id: 'OH-b', kind: 'phosphate-hydroxyl', label: 'P–OH (second ester position)' },
    ],
    description: 'Inorganic phosphate, written as fully protonated H₃PO₄ for formula bookkeeping; at pH 7 it is mostly HPO₄²⁻ and H₂PO₄⁻. Used in phospholipids and nucleotides.',
    references: ['pc-phosphoric-acid', 'os-lipids', 'os-nucleic-acids'],
  },
  {
    id: 'choline', name: 'Choline', short: 'Cho', category: 'lipid-component', formula: 'C5H14NO', charge: 1, structure: 'choline',
    sites: [{ id: 'OH', kind: 'headgroup-hydroxyl', label: 'Hydroxyl group' }],
    description: 'A quaternary ammonium cation (C₅H₁₄NO⁺); the head group of phosphatidylcholine and sphingomyelin.', references: ['pc-choline', 'os-lipids'],
  },
  {
    id: 'ethanolamine', name: 'Ethanolamine', short: 'Etn', category: 'lipid-component', formula: 'C2H7NO', structure: 'ethanolamine',
    sites: [{ id: 'OH', kind: 'headgroup-hydroxyl', label: 'Hydroxyl group' }],
    description: 'Head group of phosphatidylethanolamine, a major phospholipid of inner membrane leaflets.', references: ['pc-ethanolamine', 'os-lipids'],
  },

  ...(['A', 'G', 'C', 'T', 'U'] as const).map((b): BuildingBlock => {
    const info = {
      A: { id: 'adenine', name: 'Adenine', formula: 'C5H5N5', n: 'N9', kind: 'purine' },
      G: { id: 'guanine', name: 'Guanine', formula: 'C5H5N5O', n: 'N9', kind: 'purine' },
      C: { id: 'cytosine', name: 'Cytosine', formula: 'C4H5N3O', n: 'N1', kind: 'pyrimidine' },
      T: { id: 'thymine', name: 'Thymine', formula: 'C5H6N2O2', n: 'N1', kind: 'pyrimidine (DNA)' },
      U: { id: 'uracil', name: 'Uracil', formula: 'C4H4N2O2', n: 'N1', kind: 'pyrimidine (RNA)' },
    }[b];
    return {
      id: info.id, name: info.name, short: b, category: 'nucleotide-component', formula: info.formula, structure: info.id as BuildingBlock['structure'],
      sites: [{ id: info.n, kind: 'base-nitrogen', label: `${info.n} (bonds to the sugar’s C1′)` }], base: b,
      description: `A ${info.kind} base.`, references: [`pc-${info.id}`, 'os-nucleic-acids'],
    };
  }),
  {
    id: 'ribose', name: 'β-D-Ribose', short: 'Rib', category: 'nucleotide-component', formula: 'C5H10O5', structure: 'ribose', sites: pentoseSites, pentose: 'ribose',
    description: 'The five-carbon sugar of RNA; it has a 2′-hydroxyl group.', references: ['pc-ribose', 'os-nucleic-acids'],
  },
  {
    id: 'deoxyribose', name: '2-Deoxy-β-D-ribose', short: 'dRib', category: 'nucleotide-component', formula: 'C5H10O4', structure: 'deoxyribose', sites: pentoseSites, pentose: 'deoxyribose',
    description: 'The sugar of DNA; it lacks the 2′-hydroxyl group of ribose.', references: ['pc-deoxyribose', 'os-nucleic-acids'],
  },

  ...([
    ['damp', 'dAMP', 'A', 'deoxyribose', 'C10H14N5O6P'],
    ['dgmp', 'dGMP', 'G', 'deoxyribose', 'C10H14N5O7P'],
    ['dcmp', 'dCMP', 'C', 'deoxyribose', 'C9H14N3O7P'],
    ['dtmp', 'dTMP', 'T', 'deoxyribose', 'C10H15N2O8P'],
    ['amp', 'AMP', 'A', 'ribose', 'C10H14N5O7P'],
    ['gmp', 'GMP', 'G', 'ribose', 'C10H14N5O8P'],
    ['cmp', 'CMP', 'C', 'ribose', 'C9H14N3O8P'],
    ['ump', 'UMP', 'U', 'ribose', 'C9H13N2O9P'],
  ] as const).map(([id, short, base, pentose, formula]): BuildingBlock => ({
    id, name: `${short} (${pentose === 'ribose' ? 'ribo' : 'deoxyribo'}nucleotide)`, short, category: 'nucleotide', formula, structure: id,
    sites: nucleotideSites, nucleotide: { base, pentose },
    description: `A ready-made ${pentose === 'ribose' ? 'RNA' : 'DNA'} nucleotide (nucleoside 5′-monophosphate).`,
    moleculeId: id === 'damp' ? 'damp' : undefined, references: [`pc-${id}`, 'os-nucleic-acids'],
  })),
];

export const buildingBlocks: Record<string, BuildingBlock> = Object.fromEntries(buildingBlockList.map((b) => [b.id, b]));

export const blockCategories: { id: BuildingBlockCategory; name: string }[] = [
  { id: 'amino-acid', name: 'Amino acids' },
  { id: 'monosaccharide', name: 'Monosaccharides' },
  { id: 'lipid-component', name: 'Lipid components' },
  { id: 'nucleotide-component', name: 'Nucleotide components' },
  { id: 'nucleotide', name: 'Nucleotides' },
];

export const assemblyRules: AssemblyRule[] = [
  {
    id: 'peptide', name: 'Peptide bond', bondType: 'peptide', sites: ['aa-carboxyl', 'aa-amine'], byproduct: 'H2O',
    explanation: 'An amide bond between the α-carboxyl carbon of one amino acid and the α-amino nitrogen of the next. The chain grows from the N-terminus to the C-terminus.',
    cellularReality: 'On the ribosome. Each amino acid is first activated by attachment to its tRNA (using ATP); the ribosome’s rRNA catalyses peptide-bond formation, and GTP-driven elongation factors move the chain along. Free amino acids do not combine on their own in water.',
    references: ['os-translation', 'os-proteins'],
  },
  {
    id: 'glycosidic', name: 'Glycosidic bond', bondType: 'glycosidic', sites: ['sugar-anomeric', 'sugar-hydroxyl'], byproduct: 'H2O',
    explanation: 'An O-glycosidic bond from the anomeric carbon of one sugar to a hydroxyl of another. Its α or β configuration is fixed by the anomeric form of the donor sugar.',
    cellularReality: 'Made by glycosyltransferases that use an activated nucleotide-sugar donor (e.g. UDP-glucose for glycogen, ADP-glucose for starch), not by direct dehydration.',
    references: ['os-carbohydrates'],
  },
  {
    id: 'glycosidic-anomeric', name: 'Glycosidic bond (anomeric–anomeric)', bondType: 'glycosidic', sites: ['sugar-anomeric', 'sugar-anomeric'], byproduct: 'H2O',
    explanation: 'Both anomeric carbons are joined, as in sucrose (α1→β2) and trehalose (α1→α1). The product has no free anomeric carbon and is a non-reducing sugar.',
    cellularReality: 'In plants sucrose is made from UDP-glucose and fructose-6-phosphate by sucrose-phosphate synthase and a phosphatase.',
    references: ['os-carbohydrates'],
  },
  {
    id: 'ester', name: 'Ester bond', bondType: 'ester', sites: ['fa-carboxyl', 'glycerol-hydroxyl'], byproduct: 'H2O',
    explanation: 'A carboxylic ester between the fatty-acid carboxyl and a glycerol hydroxyl.',
    cellularReality: 'Acyltransferases in the ER transfer fatty acids from fatty acyl-CoA (activated with ATP) to glycerol-3-phosphate or diacylglycerol.',
    references: ['os-lipids'],
  },
  {
    id: 'phosphoester-glycerol', name: 'Phosphoester bond (glycerol)', bondType: 'phosphoester', sites: ['phosphate-hydroxyl', 'glycerol-hydroxyl'], byproduct: 'H2O',
    explanation: 'An ester between phosphate and a glycerol hydroxyl. In natural glycerophospholipids the phosphate is on sn-3.',
    cellularReality: 'Cells make glycerol-3-phosphate by reducing dihydroxyacetone phosphate or by phosphorylating glycerol with ATP (glycerol kinase).',
    references: ['os-lipids'],
  },
  {
    id: 'phosphoester-headgroup', name: 'Phosphoester bond (head group)', bondType: 'phosphoester', sites: ['phosphate-hydroxyl', 'headgroup-hydroxyl'], byproduct: 'H2O',
    explanation: 'Links the polar head group (choline or ethanolamine) to the phosphate, completing a phosphodiester that bridges glycerol and head group.',
    cellularReality: 'In the Kennedy pathway the head group is activated as CDP-choline or CDP-ethanolamine and transferred to diacylglycerol in the ER.',
    references: ['os-lipids'],
  },
  {
    id: 'n-glycosidic', name: 'N-glycosidic bond', bondType: 'n-glycosidic', sites: ['base-nitrogen', 'pentose-c1'], byproduct: 'H2O',
    explanation: 'Joins N9 of a purine or N1 of a pyrimidine to the C1′ of ribose or deoxyribose, forming a nucleoside.',
    cellularReality: 'Cells do not condense free bases with free sugars: nucleotides are built on activated ribose-5-phosphate (PRPP) by de novo or salvage pathways, and deoxyribonucleotides are made by ribonucleotide reductase.',
    references: ['os-nucleic-acids'],
  },
  {
    id: 'phosphoester-5', name: '5′ Phosphoester bond', bondType: 'phosphoester', sites: ['phosphate-hydroxyl', 'pentose-5oh'], byproduct: 'H2O',
    explanation: 'Attaches phosphate to the 5′ carbon of the sugar, turning a nucleoside into a nucleotide (nucleoside 5′-monophosphate).',
    cellularReality: 'Kinases phosphorylate nucleosides using ATP; nucleotides made de novo already carry the 5′ phosphate from PRPP.',
    references: ['os-nucleic-acids'],
  },
  {
    id: 'phosphoester-3', name: '3′ Phosphoester bond', bondType: 'phosphoester', sites: ['phosphate-hydroxyl', 'pentose-3oh'], byproduct: 'H2O',
    explanation: 'Links a phosphate to the 3′ hydroxyl. When that phosphate is also attached to the 5′ carbon of another nucleotide, the two esters form a 3′→5′ phosphodiester linkage.',
    cellularReality: 'In cells, polymerases attack the α-phosphate of an incoming nucleoside triphosphate with the 3′-OH of the chain, releasing pyrophosphate (not water).',
    references: ['os-nucleic-acids', 'os-dna-structure'],
  },
  {
    id: 'phosphodiester', name: 'Phosphodiester bond', bondType: 'phosphodiester', sites: ['nucleotide-3oh', 'nucleotide-5p'], byproduct: 'H2O',
    explanation: 'Links the 3′-OH of one nucleotide to the 5′-phosphate of the next, extending the sugar–phosphate backbone in the 5′→3′ direction.',
    cellularReality: 'DNA and RNA polymerases add nucleoside triphosphates (dNTPs or NTPs) to the 3′ end of a chain, copying a template and releasing pyrophosphate. Net bookkeeping here uses monophosphates and water.',
    references: ['os-nucleic-acids', 'os-dna-structure'],
  },
  {
    id: 'phosphodiester-mixed-a', name: 'Phosphodiester bond', bondType: 'phosphodiester', sites: ['pentose-3oh', 'nucleotide-5p'], byproduct: 'H2O',
    explanation: 'Links the 3′-OH of a sugar to the 5′-phosphate of a ready-made nucleotide.',
    cellularReality: 'In cells this bond is formed by a polymerase using a nucleoside triphosphate, releasing pyrophosphate.',
    references: ['os-nucleic-acids'],
  },
  {
    id: 'phosphodiester-mixed-b', name: '3′ Phosphoester bond', bondType: 'phosphoester', sites: ['nucleotide-3oh', 'phosphate-hydroxyl'], byproduct: 'H2O',
    explanation: 'Attaches a phosphate to the 3′-OH of a ready-made nucleotide; with a second ester to a 5′ sugar it completes a phosphodiester.',
    cellularReality: 'In cells, backbone bonds are formed by polymerases from nucleoside triphosphates.',
    references: ['os-nucleic-acids'],
  },
];

export const LAB_DISCLAIMER =
  'This laboratory is a rule-based building-block demonstration. It checks which functional groups may be joined and keeps formula bookkeeping (one H₂O removed per condensation). It does not simulate reaction mechanisms, kinetics, thermodynamics, quantum chemistry or molecular dynamics, and positions in the workspace are schematic.';
