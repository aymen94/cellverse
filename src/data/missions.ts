import type { Mission } from '../types/science';
import { molecules } from './molecules';
import { organelles } from './organelles';

// Missions reference the same organelle, molecule and element data as the explorers:
// objectives quote that data instead of duplicating it.

const dnaElements = molecules.dna.elements;

export const missions: Mission[] = [
  {
    id: 'find-nucleus',
    title: 'Find the nucleus',
    summary: 'Locate the cell’s control centre and learn what it stores.',
    steps: [
      {
        id: 'select-nucleus',
        objective: 'Select the nucleus in the 3D view (or from the sidebar).',
        hint: 'It is the large violet sphere near the centre of the cell. Click it through the membrane.',
        condition: { type: 'select', kind: 'organelle', id: 'nucleus' },
        assist: { kind: 'organelle', id: 'nucleus' },
      },
      {
        id: 'select-nucleolus',
        objective: 'Now find the nucleolus inside the nucleus.',
        hint: `${organelles.nucleolus.summary} Look for the dark sphere inside the nucleus, or choose it under “Nucleus” in the sidebar.`,
        condition: { type: 'select', kind: 'organelle', id: 'nucleolus' },
        assist: { kind: 'organelle', id: 'nucleolus' },
      },
    ],
    completion: `You found the nucleus. ${organelles.nucleus.facts[0]}`,
    references: organelles.nucleus.references,
  },
  {
    id: 'locate-mitochondria',
    title: 'Locate the mitochondria',
    summary: 'Enter the cell and inspect its power stations up close.',
    steps: [
      {
        id: 'enter',
        objective: 'Enter the cell (press E or use “Enter cell”).',
        hint: 'The camera passes through the plasma membrane into the cytoplasm.',
        condition: { type: 'nav-mode', mode: 'interior' },
      },
      {
        id: 'select-mito',
        objective: 'Select a mitochondrion.',
        hint: 'Mitochondria are the red-orange capsule-shaped organelles scattered through the cytoplasm.',
        condition: { type: 'select', kind: 'organelle', id: 'mitochondrion' },
        assist: { kind: 'organelle', id: 'mitochondrion' },
      },
      {
        id: 'focus-mito',
        objective: 'Inspect it close up: double-click it, or press F / “Inspect selection”.',
        hint: 'Close-up view centres the camera on the organelle so you can orbit around it.',
        condition: { type: 'focus', id: 'mitochondrion' },
        assist: { kind: 'organelle', id: 'mitochondrion' },
      },
      {
        id: 'atp',
        objective: 'Open ATP, the molecule mitochondria produce, in the molecule explorer.',
        hint: 'Search for “ATP” or open the Molecules tab → Nucleic acids.',
        condition: { type: 'select', kind: 'molecule', id: 'atp' },
        assist: { kind: 'molecule', id: 'atp' },
      },
    ],
    completion: organelles.mitochondrion.facts[0],
    references: organelles.mitochondrion.references,
  },
  {
    id: 'protein-synthesis',
    title: 'Explore how proteins are synthesized',
    summary: 'Follow genetic information from DNA to a polypeptide.',
    steps: [
      {
        id: 'dna', objective: 'Start with the information store: open DNA in the molecule explorer.',
        hint: 'Search for “DNA”.', condition: { type: 'select', kind: 'molecule', id: 'dna' }, assist: { kind: 'molecule', id: 'dna' },
      },
      {
        id: 'mrna', objective: 'Genes are transcribed into messenger RNA in the nucleus. Open mRNA.',
        hint: 'Search for “mRNA”.', condition: { type: 'select', kind: 'molecule', id: 'mrna' }, assist: { kind: 'molecule', id: 'mrna' },
      },
      {
        id: 'pore', objective: 'mRNA leaves the nucleus through nuclear pores. Select a nuclear pore complex.',
        hint: 'Pores are the small rings on the nuclear envelope.', condition: { type: 'select', kind: 'organelle', id: 'nuclear-pore' }, assist: { kind: 'organelle', id: 'nuclear-pore' },
      },
      {
        id: 'ribosome', objective: 'Ribosomes translate mRNA into protein. Select a ribosome.',
        hint: 'Small amber dots, free in the cytoplasm and on the rough ER.', condition: { type: 'select', kind: 'organelle', id: 'ribosome' }, assist: { kind: 'organelle', id: 'ribosome' },
      },
      {
        id: 'trna', objective: 'tRNAs deliver the amino acids. Open transfer RNA.',
        hint: 'Search for “tRNA”.', condition: { type: 'select', kind: 'molecule', id: 'trna' }, assist: { kind: 'molecule', id: 'trna' },
      },
    ],
    completion: 'DNA → mRNA (transcription, nucleus) → protein (translation, ribosome). The ribosome’s rRNA catalyses each peptide bond.',
    references: ['os-translation', 'os-rna-processing'],
  },
  {
    id: 'dna-elements',
    title: 'Discover the major elements in DNA',
    summary: 'Find which chemical elements DNA is made of.',
    steps: [
      {
        id: 'open-dna', objective: 'Open DNA in the molecule explorer and look at its elements.',
        hint: 'Search for “DNA”. The element list is in the right panel.', condition: { type: 'select', kind: 'molecule', id: 'dna' }, assist: { kind: 'molecule', id: 'dna' },
      },
      {
        id: 'visit-elements', objective: `Open each element DNA contains (${dnaElements.join(', ')}) in the element explorer.`,
        hint: 'Click the element chips in DNA’s panel, or use the periodic table in the Elements tab.',
        condition: { type: 'select-all', kind: 'element', ids: dnaElements }, assist: { kind: 'element', id: dnaElements[0] },
      },
    ],
    completion: 'DNA is built from C, H, N, O and P. Phosphorus sits in the phosphate groups of the backbone; nitrogen in the bases.',
    references: molecules.dna.references,
  },
  {
    id: 'assemble-peptide',
    title: 'Assemble a short peptide',
    summary: 'Use the laboratory to join amino acids with peptide bonds.',
    steps: [
      {
        id: 'open-lab', objective: 'Open the Laboratory.', hint: 'Use the “Laboratory” tab at the top.',
        condition: { type: 'open-lab' }, assist: { kind: 'lab' },
      },
      {
        id: 'dipeptide', objective: 'Add two amino acids and join them with a peptide bond.',
        hint: 'Add e.g. glycine and alanine from the palette, select one, then Shift-click the other in 3D (or use “Connect” in the panel).',
        condition: { type: 'lab-product', productClass: 'peptide', minUnits: 2 },
      },
      {
        id: 'tripeptide', objective: 'Extend it to a tripeptide (three amino acids).',
        hint: 'A new amino acid can bond to the free C-terminal carboxyl or the free N-terminal amino group.',
        condition: { type: 'lab-product', productClass: 'peptide', minUnits: 3 },
      },
    ],
    completion: 'You built a tripeptide with two peptide bonds. In cells, each bond is made on the ribosome from aminoacyl-tRNAs.',
    references: ['os-proteins', 'os-translation'],
  },
  {
    id: 'build-phospholipid',
    title: 'Build a simplified phospholipid',
    summary: 'Assemble phosphatidylcholine from glycerol, fatty acids, phosphate and choline.',
    steps: [
      {
        id: 'open-lab', objective: 'Open the Laboratory.', hint: 'Use the “Laboratory” tab at the top.',
        condition: { type: 'open-lab' }, assist: { kind: 'lab' },
      },
      {
        id: 'dag', objective: 'Esterify two fatty acids to glycerol (a diacylglycerol).',
        hint: 'Add glycerol, palmitic acid and oleic acid. Connect each fatty acid to a glycerol hydroxyl (sn-1, sn-2).',
        condition: { type: 'lab-product', productClass: 'acylglycerol', minUnits: 3 },
      },
      {
        id: 'pc', objective: 'Attach phosphate to the remaining glycerol hydroxyl (sn-3), then choline to the phosphate.',
        hint: 'Phosphate has two ester positions: one for glycerol, one for the head group.',
        condition: { type: 'lab-product', productClass: 'phospholipid', minUnits: 5 },
      },
    ],
    completion: 'You built phosphatidylcholine, the most abundant phospholipid in many animal membranes.',
    references: molecules.phosphatidylcholine.references,
  },
  {
    id: 'secretory-path',
    title: 'Follow a protein through the ER and Golgi',
    summary: 'Trace the secretory pathway from ribosome to cell surface.',
    steps: [
      {
        id: 'ribosome', objective: 'A secreted protein starts on a ribosome. Select a ribosome.', hint: 'Amber dots on the rough ER.',
        condition: { type: 'select', kind: 'organelle', id: 'ribosome' }, assist: { kind: 'organelle', id: 'ribosome' },
      },
      {
        id: 'rer', objective: 'Its signal sequence sends it into the rough ER. Select the rough ER.', hint: organelles['rough-er'].summary,
        condition: { type: 'select', kind: 'organelle', id: 'rough-er' }, assist: { kind: 'organelle', id: 'rough-er' },
      },
      {
        id: 'copii', objective: 'COPII vesicles carry it to the Golgi. Select a transport vesicle.', hint: 'Small yellow spheres travelling between ER and Golgi.',
        condition: { type: 'select', kind: 'organelle', id: 'vesicle' }, assist: { kind: 'organelle', id: 'vesicle' },
      },
      {
        id: 'golgi', objective: 'It is modified and sorted in the Golgi apparatus. Select it.', hint: organelles.golgi.summary,
        condition: { type: 'select', kind: 'organelle', id: 'golgi' }, assist: { kind: 'organelle', id: 'golgi' },
      },
      {
        id: 'membrane', objective: 'A secretory vesicle fuses with the plasma membrane. Select the plasma membrane.', hint: 'Exit the cell or click the outer shell.',
        condition: { type: 'select', kind: 'organelle', id: 'plasma-membrane' }, assist: { kind: 'organelle', id: 'plasma-membrane' },
      },
    ],
    completion: 'Ribosome → rough ER → vesicle → Golgi → vesicle → plasma membrane: the secretory pathway. Collagen and lysozyme both travel this route.',
    references: ['os-endomembrane', 'cooper-vesicles'],
  },
];
