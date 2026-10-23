# CellVerse

*Explore life at the molecular level.*

CellVerse is an interactive 3D explorer of a eukaryotic animal cell, the chemical elements of life and the four families of biological macromolecules, with a rule-based molecular assembly lab and guided missions. All 3D rendering uses [WAMR3D](https://www.npmjs.com/package/wamr3d) (WebGPU, with its own WebGL 2 fallback).

- Repository: <https://github.com/aymen94/cellverse>
- Issues: <https://github.com/aymen94/cellverse/issues>
- Built with: React 18, TypeScript, Vite 6, WAMR3D 0.9, Lucide icons

## Requirements

- Node.js 20 or newer and npm
- A browser with WebGPU or WebGL 2 (current Chrome, Edge, Firefox or Safari with hardware acceleration enabled)

## Getting started

```sh
git clone https://github.com/aymen94/cellverse.git
cd cellverse
npm install
npm run dev
```

Then open the URL Vite prints (by default <http://localhost:5173>).

## Commands

```sh
npm run dev          # development server (Vite)
npm run build        # type check + production build into dist/
npm run preview      # serve the production build
npm test             # unit tests (chemistry rules, data integrity, search)
npm run typecheck    # TypeScript only
npm run fetch:structures   # re-download the molecular structure files (optional)
```

The app needs no backend or API key: all content and structures are local files. Add `?debug` to the URL (or enable it in Settings) to show measured frame rate, draw calls and triangle counts.

## Deployment

`npm run build` writes a fully static site to `dist/` (HTML, JS, CSS, the WAMR3D `.wasm` file and the structure data). Serve it from any static host. The build assumes it is served from the site root (`/`); to host it under a sub-path such as GitHub Pages (`https://<user>.github.io/cellverse/`), set Vite's `base` option in `vite.config.ts` to `'/cellverse/'` before building. The server must send `.wasm` files with the `application/wasm` content type (most hosts do by default).

## Features

- **Cell explorer** – plasma membrane (bilayer shells with membrane proteins), cytoplasm, nucleus with double envelope, nuclear pores, chromatin and nucleolus, mitochondria, rough ER with ribosomes, smooth ER, free ribosomes, Golgi stack, lysosomes, peroxisomes, animated transport vesicles (ER → Golgi → membrane), cytoskeleton (microtubules from the centrosome, actin cortex, intermediate filaments) and centrosome with centrioles.
- **Navigation** – orbit/zoom from outside, *Enter cell* flight into the interior (WASD/QZ movement, boundary and nucleus collision), double-click or *Inspect* for close-ups, camera-facing cutaway, reset, zoom buttons, mode indicator, keyboard shortcuts (`?` lists them).
- **Organelle panels** – quick overview and scientific details, function, structure, processes, relationships (clickable), relevant molecules and elements, facts, model simplifications and references. Selection is highlighted with a glow plus an instance halo; *Back* returns to the previous selection.
- **Element explorer** – 30 elements in a periodic-table layout (or list), searchable and filterable by category and essentiality. Categories use a text badge and border style as well as colour. Each element lists atomic number, IUPAC atomic weight, role, forms, locations, examples, essentiality with caveats, and highlights associated cell structures.
- **Molecule explorer** – proteins, carbohydrates, lipids and nucleic acids (23 molecules). Each states how its 3D model was obtained (see below), with formula, building blocks, bonds, function, location, elements and references.
- **Laboratory** – add elements or building blocks (click or drag), move them, select and Shift-click (or *Connect*) to combine. Compatible partners are ringed green, incompatible ones red with an explanation. Recognizes peptides, disaccharides and glucans, mono/di/triacylglycerols, phosphatidic acid / PC / PE, nucleosides, nucleotides, DNA/RNA strands, small molecules (H₂O, CO₂, NH₃, ethanol vs dimethyl ether…) and halide salts. Undo, remove and reset are supported.
- **Missions** – seven guided activities (find the nucleus, locate mitochondria, protein synthesis, elements of DNA, assemble a peptide, build a phospholipid, follow the secretory pathway) with hints, “Show me”, progress and completion.
- **Search** across organelles, elements, molecules and building blocks (`/` or `Ctrl K`).

## Architecture

```
src/
  app/          App shell, stores (createStore, appStore), actions, keyboard shortcuts
  engine/       WAMR3D adapter — the only code that touches the renderer
    wamr.ts           engine init (WASM first, then add-ons)
    WamrEngine.ts     SceneController implementation: renderer, camera, controls, picking, loop
    types.ts          SceneController / callbacks contract used by the UI
    cameraRig.ts      eased camera flights, limits, bounds and collision
    labels.ts         per-frame DOM label projection with overlap culling
    geometry.ts       icospheres, organic blobs, sheets, geometry merging
    molecular.ts      instanced ball-and-stick / space-filling models, Cα tubes
    stages/           cellStage, moleculeStage, labStage
  components/   Top navigation, sidebar, right panel, toolbar, dialogs
  features/     cell (viewport), organelles, chemistry, molecules, lab, missions, search
  data/         organelles, elements, molecules, lab rules, missions, references, structures/
  types/        science.ts — typed models for all educational content
  styles/       global.css with design tokens
scripts/fetch-structures.mjs   how the structure files were produced
```

The React UI never touches renderer objects: it calls the `SceneController` interface (`engine/types.ts`), and the engine reports picks, hovers, navigation-mode changes and label anchors back through callbacks. Labels are positioned by the engine every frame through element transforms, so camera motion does not re-render React. Resources, event listeners, the ResizeObserver and the animation loop are released in `WamrEngine.dispose()`; rendering pauses while the tab is hidden.

Content is separate from code: organelles, elements, molecules, building blocks, assembly rules and missions are typed data in `src/data/`, and missions refer to that same data.

## Scientific sources and representations

References are listed in every panel and defined once in `src/data/references.ts`. Every URL and identifier was checked against its publisher or an official API: OpenStax *Biology 2e*, Cooper’s *The Cell* (NCBI Bookshelf accessions verified via E-utilities), PubChem, RCSB PDB and PDB-101, NIH Office of Dietary Supplements, IUPAC CIAAW, and DOIs for primary papers (verified via Crossref).

Molecule views state their origin:

| Kind | Source | Examples |
| --- | --- | --- |
| Experimental | RCSB PDB entries | hemoglobin 4HHB, actin 1J6Z, collagen-like peptide 1CAG, lysozyme 2LYZ (Cα traces + ligands); B-DNA 1BNA and tRNA-Phe 1EHZ (all heavy atoms) |
| Computed | PubChem 3D conformers | amino acids, sugars, disaccharides, cholesterol, ATP, nucleotides, lab building blocks |
| Idealized | PDB Chemical Component Dictionary | POPC (POV), tristearin (TGL) — flexible lipids without a PubChem conformer |
| Educational model | generated, labelled as such | starch (amylose helix), glycogen, cellulose, mRNA |

A unit test checks that each stated molecular formula matches the atoms in its bundled structure file.

### Deliberate simplifications

- The cell is **not to scale**: small structures are enlarged and far fewer are drawn than a real cell contains (an on-screen note says so while annotations are on). Each organelle panel lists its own model simplifications.
- The element list is an educational selection; essentiality is classified (universal, essential, trace-essential, species-dependent, uncertain, no established role) with caveats.
- The **laboratory is a rule-based building-block demonstration**, not a chemical simulation. It enforces functional-group rules, typical valences and charge balance and does formula bookkeeping (one H₂O per condensation). It does not model mechanisms, kinetics, energetics, 3D geometry, quantum chemistry or molecular dynamics; for each bond it explains how cells actually make it (ribosomes, activated substrates such as aminoacyl-tRNAs, UDP-glucose, acyl-CoA, CDP-choline, nucleoside triphosphates). Coordination chemistry of transition metals is out of scope and refused with an explanation.

## WAMR3D notes and limits

- WAMR3D picks WebGPU when available and its WebGL 2 renderer otherwise; the active backend appears in Settings and the debug overlay. If neither API is available, the 3D view shows a fallback message and all content stays available through the sidebar, search and panels.
- WAMR3D add-ons (OrbitControls) create engine objects when their modules load, so `engine/wamr.ts` initializes the WASM module first and imports add-ons afterwards. Some compat classes (e.g. `Color`) are WASM-backed, so the stage modules are also loaded dynamically after `init()`. `vite.config.ts` excludes `wamr3d` from dependency pre-bundling so add-ons and the compat layer share one WASM instance.
- Selection outlines use an emissive glow plus an enlarged back-face halo mesh rather than a post-processing outline pass. Lines (actin cortex, intermediate filaments, ionic bonds) are one pixel wide, as WAMR3D documents.
- The compat typings do not re-export the named tone-mapping constants, so ACES filmic tone mapping is set by its numeric value (4). OrbitControls ships without TypeScript declarations; `src/types/wamr3d-addons.d.ts` declares only the members used.
- Repeated structures use `InstancedMesh` (ribosomes, pores, mitochondria, lysosomes, peroxisomes, vesicles, membrane proteins, atoms, bonds); tubes are merged into single geometries. The exterior cell view renders in about 33 draw calls (as reported by `renderer.info`).

## Accessibility

Every control has an accessible name; the sidebar, search and panels give full access without the 3D view; dialogs trap focus and close with Esc; live regions announce lab results, mission progress and toasts; categories never rely on colour alone; motion follows `prefers-reduced-motion` or the Settings override (camera flights become instant).

## Project status

Version 0.1.0. Tested with Node.js 24, in Chromium (WebGL 2 backend) at desktop and phone widths. `npm run typecheck`, `npm test` (26 tests) and `npm run build` pass.

## Credits

- **3D engine: [WAMR3D](https://github.com/aymen94/wamr3d)** ([npm](https://www.npmjs.com/package/wamr3d)), a Rust and WebAssembly 3D engine with its own WebGPU renderer and WebGL 2 fallback (MIT). The app credits it on screen: a “Rendered with WAMR3D” badge under the view-mode indicator (installed version and active backend; links to the GitHub repository), the Credits section of the Help dialog (`?`), and the renderer row in Settings. The version is read from `node_modules/wamr3d/package.json` at build time (`vite.config.ts`).
- Molecular structures: RCSB Protein Data Bank, PDB Chemical Component Dictionary, PubChem.
- Content sources: OpenStax *Biology 2e*, Cooper’s *The Cell* (NCBI Bookshelf), PDB-101, NIH Office of Dietary Supplements, IUPAC CIAAW and the papers cited in each panel.
- Interface: React, Vite, Lucide icons.

## Contributing

Bug reports and suggestions are welcome in the [issue tracker](https://github.com/aymen94/cellverse/issues). Corrections to the scientific content are especially useful: please cite a source. Content lives in `src/data/`; run `npm test` after editing it, since the data-integrity tests check references, cross-links, structure files and formulas.

## License

No license has been chosen yet. Third-party data keeps its own terms: OpenStax content is CC BY 4.0, PDB and PubChem data are freely available, and WAMR3D is MIT-licensed.
