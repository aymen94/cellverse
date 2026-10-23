// Molecular formula bookkeeping: parse "C6H12O6", add, subtract, and print in Hill order.

export type Formula = Map<string, number>;

export function parseFormula(text: string): Formula {
  const f: Formula = new Map();
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[1]) continue;
    f.set(m[1], (f.get(m[1]) ?? 0) + (m[2] ? parseInt(m[2], 10) : 1));
  }
  return f;
}

export function addFormula(target: Formula, add: Formula, times = 1): Formula {
  for (const [el, n] of add) {
    const v = (target.get(el) ?? 0) + n * times;
    if (v === 0) target.delete(el);
    else target.set(el, v);
  }
  return target;
}

/** Hill order: C, then H, then the rest alphabetically; without carbon, all alphabetically. */
export function hillOrder(f: Formula): [string, number][] {
  const entries = [...f].filter(([, n]) => n !== 0);
  const hasC = f.has('C');
  return entries.sort(([a], [b]) => {
    if (hasC) {
      if (a === 'C') return -1;
      if (b === 'C') return 1;
      if (a === 'H') return -1;
      if (b === 'H') return 1;
    }
    return a.localeCompare(b);
  });
}

/** Plain ASCII Hill formula, e.g. "C6H12O6" (used as a lookup key). */
export function formatHill(f: Formula): string {
  return hillOrder(f).map(([el, n]) => (n === 1 ? el : `${el}${n}`)).join('');
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP: Record<string, string> = { '+': '⁺', '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

export const subscript = (n: number) => String(n).split('').map((d) => SUB[+d]).join('');

export function chargeLabel(charge: number): string {
  if (charge === 0) return '';
  const mag = Math.abs(charge) === 1 ? '' : String(Math.abs(charge));
  return (mag + (charge > 0 ? '+' : '-')).split('').map((c) => SUP[c] ?? c).join('');
}

/** Display formula with Unicode subscripts (and a superscript charge), e.g. "C₆H₁₂O₆". */
export function prettyFormula(f: Formula | string, charge = 0): string {
  const formula = typeof f === 'string' ? parseFormula(f) : f;
  return hillOrder(formula).map(([el, n]) => (n === 1 ? el : el + subscript(n))).join('') + chargeLabel(charge);
}

/** Converts an ASCII formula such as "C6H12O6" to subscripts without reordering. */
export function prettify(ascii: string): string {
  return ascii.replace(/\d+/g, (d) => subscript(+d));
}
