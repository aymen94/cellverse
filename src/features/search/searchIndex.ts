import type { Selection } from '../../app/appStore';
import { elementList, elementCategories } from '../../data/elements';
import { buildingBlockList, blockCategories } from '../../data/lab';
import { familyInfo, moleculeList } from '../../data/molecules';
import { organelleList } from '../../data/organelles';
import { prettify } from '../lab/formula';

export interface SearchEntry {
  selection: Selection;
  title: string;
  subtitle: string;
  kindLabel: string;
  /** Lower-case text searched (name, synonyms, formula, symbol...). */
  haystack: string;
  /** Exact tokens that rank highest (e.g. element symbols). */
  exact: string[];
}

const entries: SearchEntry[] = [
  ...organelleList.map((o): SearchEntry => ({
    selection: { kind: 'organelle', id: o.id },
    title: o.name,
    subtitle: o.summary,
    kindLabel: 'Cell structure',
    haystack: [o.name, o.scientificName, o.function, o.processes.join(' '), o.moleculeNotes.join(' ')].join(' ').toLowerCase(),
    exact: [o.name.toLowerCase(), (o.scientificName ?? '').toLowerCase()],
  })),
  ...elementList.map((e): SearchEntry => ({
    selection: { kind: 'element', id: e.symbol },
    title: `${e.name} (${e.symbol})`,
    subtitle: `${elementCategories.find((c) => c.id === e.category)!.name} · Z = ${e.atomicNumber}`,
    kindLabel: 'Element',
    haystack: [e.name, e.symbol, e.biologicalRole, e.examples.join(' ')].join(' ').toLowerCase(),
    exact: [e.symbol.toLowerCase(), e.name.toLowerCase()],
  })),
  ...moleculeList.map((m): SearchEntry => ({
    selection: { kind: 'molecule', id: m.id },
    title: m.name,
    subtitle: `${familyInfo[m.family].name} · ${m.subtype}${m.formula ? ` · ${m.formula}` : ''}`,
    kindLabel: 'Molecule',
    haystack: [m.name, m.id, m.subtype, m.formula, m.function, m.buildingBlocks].join(' ').toLowerCase(),
    exact: [m.name.toLowerCase(), m.id.toLowerCase()],
  })),
  ...buildingBlockList.map((b): SearchEntry => ({
    selection: { kind: 'block', id: b.id },
    title: b.name,
    subtitle: `Lab building block · ${blockCategories.find((c) => c.id === b.category)!.name} · ${prettify(b.formula)}`,
    kindLabel: 'Building block',
    haystack: [b.name, b.short, b.formula, b.description].join(' ').toLowerCase(),
    exact: [b.short.toLowerCase(), b.name.toLowerCase()],
  })),
];

export function search(query: string, limit = 24): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of entries) {
    let score = 0;
    const title = e.title.toLowerCase();
    if (e.exact.includes(q)) score = 100;
    else if (title.startsWith(q)) score = 60;
    else if (title.split(/[\s(),-]+/).some((w) => w.startsWith(q))) score = 45;
    else if (title.includes(q)) score = 35;
    else if (e.haystack.includes(q)) score = 10;
    else continue;
    if (e.selection.kind === 'organelle') score += 3;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.e);
}
