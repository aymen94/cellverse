// Downloads the molecular structures CellVerse displays and converts them into compact
// JSON files under src/data/structures/. Run with `npm run fetch:structures`.
//
// Sources (all public, no API key):
//   - PubChem computed 3D conformers (SDF):  https://pubchem.ncbi.nlm.nih.gov/
//   - PDB Chemical Component Dictionary ideal coordinates (SDF): https://www.rcsb.org/
//   - PDB entries (legacy .pdb format):     https://files.rcsb.org/
//
// The output is committed so the app works offline; this script only documents and
// reproduces how the files were made.

import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('src/data/structures');

// key -> PubChem CID. Every CID was resolved from its name with PUG REST.
const PUBCHEM = {
  'alpha-glucose': 79025,
  'beta-glucose': 64689,
  'beta-fructose': 439709,
  'beta-galactose': 439353,
  sucrose: 5988,
  maltose: 439186,
  lactose: 6134,
  cellobiose: 439178,
  cholesterol: 5997,
  atp: 5957,
  glycine: 750,
  alanine: 5950,
  serine: 5951,
  cysteine: 5862,
  valine: 6287,
  leucine: 6106,
  lysine: 5962,
  'aspartic-acid': 5960,
  'glutamic-acid': 33032,
  phenylalanine: 6140,
  glycerol: 753,
  'palmitic-acid': 985,
  'oleic-acid': 445639,
  'phosphoric-acid': 1004,
  choline: 305,
  ethanolamine: 700,
  adenine: 190,
  guanine: 135398634,
  cytosine: 597,
  thymine: 1135,
  uracil: 1174,
  ribose: 447347,
  deoxyribose: 439576,
  damp: 12599,
  amp: 6083,
  dgmp: 135398597,
  dcmp: 13945,
  dtmp: 9700,
  gmp: 135398631,
  cmp: 6131,
  ump: 6030,
  glycylglycine: 11163,
};

// key -> Chemical Component Dictionary id (PubChem has no 3D conformer for these
// flexible lipids).
const CCD = { popc: 'POV', tristearin: 'TGL' };

// key -> [PDB id, representation]
const PDB = {
  hemoglobin: ['4HHB', 'trace'],
  actin: ['1J6Z', 'trace'],
  collagen: ['1CAG', 'trace'],
  lysozyme: ['2LYZ', 'trace'],
  dna: ['1BNA', 'atoms'],
  trna: ['1EHZ', 'atoms'],
};

const r3 = (v) => Math.round(v * 1000) / 1000;

function parseSdf(text) {
  const lines = text.split(/\r?\n/);
  const counts = lines[3];
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    atoms.push([l.slice(31, 34).trim(), r3(+l.slice(0, 10)), r3(+l.slice(10, 20)), r3(+l.slice(20, 30))]);
  }
  const bonds = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    bonds.push([parseInt(l.slice(0, 3), 10) - 1, parseInt(l.slice(3, 6), 10) - 1, parseInt(l.slice(6, 9), 10)]);
  }
  return { atoms, bonds };
}

// Covalent radii (Å) for bond perception in PDB entries, which carry no bond table.
const COV = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, P: 1.07, S: 1.05 };

function perceiveBonds(atoms) {
  const bonds = [];
  const cell = 2.2;
  const grid = new Map();
  atoms.forEach((a, i) => {
    const k = `${Math.floor(a[1] / cell)},${Math.floor(a[2] / cell)},${Math.floor(a[3] / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
  });
  atoms.forEach((a, i) => {
    const cx = Math.floor(a[1] / cell), cy = Math.floor(a[2] / cell), cz = Math.floor(a[3] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        if (j <= i) continue;
        const b = atoms[j];
        const d = Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);
        const max = (COV[a[0]] ?? 0.8) + (COV[b[0]] ?? 0.8) + 0.4;
        if (d > 0.4 && d < max) bonds.push([i, j, 1]);
      }
    }
  });
  return bonds;
}

// Hydroxyproline (collagen) and N-methylhistidine (actin) are HETATM records in legacy
// PDB files but belong to the polypeptide chain.
const MODIFIED_RESIDUES = ['HYP', 'HIC', 'MSE'];
// Ligands kept for display: heme in hemoglobin and ADP in actin. Crystallization
// additives and fluorescent labels (PO4, ACY, RHO) are left out.
const BIOLOGICAL_LIGANDS = ['HEM', 'ADP'];

function parsePdb(text, mode) {
  const chains = new Map();
  const atoms = [];
  const ligands = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('ENDMDL')) break;
    const rec = line.slice(0, 6).trim();
    if (rec !== 'ATOM' && rec !== 'HETATM') continue;
    const name = line.slice(12, 16).trim();
    const alt = line.slice(16, 17);
    if (alt !== ' ' && alt !== 'A') continue;
    const res = line.slice(17, 20).trim();
    const chain = line.slice(21, 22);
    const x = r3(+line.slice(30, 38)), y = r3(+line.slice(38, 46)), z = r3(+line.slice(46, 54));
    let el = line.slice(76, 78).trim();
    if (!el) el = name.replace(/[^A-Z]/g, '').slice(0, 1);
    el = el[0] + el.slice(1).toLowerCase();
    if (res === 'HOH' || el === 'H') continue;
    if (mode === 'trace') {
      // Modified residues (hydroxyproline in collagen) are HETATM records but part of the chain.
      if (name === 'CA' && (rec === 'ATOM' || MODIFIED_RESIDUES.includes(res))) {
        if (!chains.has(chain)) chains.set(chain, []);
        chains.get(chain).push([x, y, z]);
      } else if (rec === 'HETATM' && BIOLOGICAL_LIGANDS.includes(res)) {
        ligands.push([el, x, y, z, res]);
      }
    } else {
      // Single metal ions (Mg2+ in the tRNA crystal) are left out of the covalent model.
      if (rec === 'HETATM' && ['MG', 'NA', 'K', 'CL', 'SPM', 'MN', 'ZN'].includes(res)) continue;
      atoms.push([el, x, y, z]);
    }
  }
  if (mode === 'trace') {
    const ligandAtoms = ligands.map(([el, x, y, z]) => [el, x, y, z]);
    return {
      chains: [...chains].map(([id, points]) => ({ id, points })),
      ligands: { names: [...new Set(ligands.map((l) => l[4]))], atoms: ligandAtoms, bonds: perceiveBonds(ligandAtoms) },
    };
  }
  return { atoms, bonds: perceiveBonds(atoms) };
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const index = {};
  for (const [key, cid] of Object.entries(PUBCHEM)) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF?record_type=3d`;
    const s = parseSdf(await get(url));
    index[key] = { kind: 'atoms', source: { db: 'PubChem', id: `CID ${cid}`, url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, note: 'PubChem computed 3D conformer (one low-energy conformer, not an experimental structure).' }, ...s };
    console.log('pubchem', key, s.atoms.length);
    await new Promise((r) => setTimeout(r, 250));
  }
  for (const [key, id] of Object.entries(CCD)) {
    const s = parseSdf(await get(`https://files.rcsb.org/ligands/view/${id}_ideal.sdf`));
    index[key] = { kind: 'atoms', source: { db: 'PDB Chemical Component Dictionary', id, url: `https://www.rcsb.org/ligand/${id}`, note: 'Idealized coordinates from the PDB Chemical Component Dictionary (one extended conformation, not an experimental structure).' }, ...s };
    console.log('ccd', key, s.atoms.length);
  }
  for (const [key, [id, mode]] of Object.entries(PDB)) {
    const s = parsePdb(await get(`https://files.rcsb.org/download/${id}.pdb`), mode);
    const note = mode === 'trace'
      ? 'Experimental crystal structure. Shown as a Cα trace (one point per amino-acid residue) plus bound ligands; side chains are omitted.'
      : 'Experimental crystal structure (non-hydrogen atoms; water and free metal ions omitted). Bonds inferred from interatomic distances.';
    index[key] = { kind: mode, source: { db: 'RCSB Protein Data Bank', id, url: `https://www.rcsb.org/structure/${id}`, note }, ...s };
    console.log('pdb', key, mode === 'trace' ? s.chains.map((c) => c.points.length).join('+') : s.atoms.length);
  }
  for (const [key, value] of Object.entries(index)) {
    await fs.writeFile(path.join(OUT, `${key}.json`), JSON.stringify(value));
  }
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(Object.keys(index)));
}

main().catch((e) => { console.error(e); process.exit(1); });
