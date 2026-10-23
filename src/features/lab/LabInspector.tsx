import { AlertTriangle, CheckCircle2, Info, Link2, Trash2, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { select } from '../../app/actions';
import { useStore } from '../../app/createStore';
import { elements } from '../../data/elements';
import { buildingBlocks, LAB_DISCLAIMER } from '../../data/lab';
import { isMoleculeId } from '../../data/molecules';
import { ElementChip, Section } from '../../components/ui';
import type { ElementSymbol } from '../../types/science';
import { analyzeComponent, bondsOf, connectionOptions, nodeById, nodeLabel, nodeShort, ruleById } from './chemistry';
import { labActions, labStore } from './labStore';

export function LabInspector() {
  const lab = useStore(labStore, (s) => s.lab);
  const selectedId = useStore(labStore, (s) => s.selectedId);
  const message = useStore(labStore, (s) => s.message);
  const pendingTarget = useStore(labStore, (s) => s.pendingTarget);
  const node = selectedId ? nodeById(lab, selectedId) : undefined;

  const product = useMemo(() => (node ? analyzeComponent(lab, node.id) : null), [lab, node]);
  const others = useMemo(
    () => (node ? lab.nodes.filter((n) => n.id !== node.id).map((n) => ({ n, res: connectionOptions(lab, node.id, n.id) })) : []),
    [lab, node],
  );

  return (
    <>
      <div className="panel-title"><div><h2>Molecular laboratory</h2><div className="sci" style={{ fontStyle: 'normal' }}>Rule-based building-block assembly</div></div></div>

      <div aria-live="polite">
        {message && (
          <div className={`note ${message.tone}`} style={{ marginBottom: 12 }}>
            {message.tone === 'error' ? <XCircle size={14} aria-hidden /> : message.tone === 'success' ? <CheckCircle2 size={14} aria-hidden /> : <Info size={14} aria-hidden />}
            <div><strong>{message.title}.</strong> {message.text}</div>
          </div>
        )}
      </div>

      {!lab.nodes.length && (
        <div className="empty" style={{ paddingTop: 10 }}>
          <h2>Empty workspace</h2>
          <p>Add elements or building blocks from the palette below the 3D view — click them, or drag them into the workspace.</p>
          <div className="tips">
            <div className="note"><Info size={14} aria-hidden /><div>Select one component, then <strong>Shift-click</strong> another in 3D, or use <strong>Connect</strong> here, to try combining them.</div></div>
            <div className="note"><Info size={14} aria-hidden /><div>Try: glycine + alanine (peptide bond), α-glucose + α-glucose (maltose), or O + 2 H (water).</div></div>
          </div>
        </div>
      )}

      {node && (
        <>
          <Section title="Selected component">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="formula" style={{ fontWeight: 700 }}>{nodeShort(node)}</span>
              <span style={{ flex: 1 }}>{nodeLabel(node)}</span>
              <button type="button" className="btn small danger" onClick={() => labActions.remove(node.id)} aria-label={`Remove ${nodeLabel(node)}`}>
                <Trash2 size={13} aria-hidden /> Remove
              </button>
            </div>
            {node.kind === 'block' ? (
              <ul style={{ marginTop: 8, fontSize: 12.5 }}>
                {buildingBlocks[node.ref].sites.map((s) => {
                  const used = bondsOf(lab, node.id).find((b) => (b.a === node.id ? b.siteA : b.siteB) === s.id);
                  return <li key={s.id} style={{ color: used ? 'var(--text-faint)' : 'var(--text)' }}><span className="mono">{s.id}</span> {s.label} — {used ? `used (${ruleById(used.ruleId)?.name.toLowerCase() ?? used.type})` : 'free'}</li>;
                })}
              </ul>
            ) : (
              <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-dim)' }}>
                {elements[node.ref as ElementSymbol].covalent
                  ? `Typical valence: ${elements[node.ref as ElementSymbol].covalent!.valences.join(' or ')}; bonds used: ${bondsOf(lab, node.id).filter((b) => b.type === 'covalent').reduce((s, b) => s + b.order, 0)}.`
                  : elements[node.ref as ElementSymbol].ionCharge ? `Forms the ion ${node.ref}${elements[node.ref as ElementSymbol].ionCharge! > 0 ? '⁺' : '⁻'} (charge ${elements[node.ref as ElementSymbol].ionCharge! > 0 ? '+' : ''}${elements[node.ref as ElementSymbol].ionCharge}).`
                  : 'A transition metal; in cells it is bound to proteins by coordination bonds, which this lab does not model.'}
              </p>
            )}
          </Section>

          {product && (
            <Section title="Assembly containing it">
              <div className="conn" style={{ borderColor: product.recognized ? 'rgba(74,222,128,0.4)' : undefined }}>
                <div className="conn-head">
                  {product.recognized ? <CheckCircle2 size={15} color="var(--green)" aria-hidden /> : <AlertTriangle size={15} color="var(--warn)" aria-hidden />}
                  <strong className="grow">{product.name}</strong>
                </div>
                {product.formula && <div className="formula" style={{ marginTop: 6 }}>{product.formula}</div>}
                {product.formulaNote && product.formula && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>{product.formulaNote}</div>}
                <p style={{ marginTop: 8, fontSize: 13 }}>{product.description}</p>
                {product.bondSummary.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Bonds: {product.bondSummary.join(', ')}</div>}
                {product.notes.map((n) => <div key={n} className="note warn" style={{ marginTop: 8 }}><Info size={13} aria-hidden /><div>{n}</div></div>)}
                {product.elements.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{product.elements.map((e) => <ElementChip key={e} symbol={e} />)}</div>}
                {product.moleculeId && isMoleculeId(product.moleculeId) && (
                  <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={() => select({ kind: 'molecule', id: product.moleculeId as never })}>
                    See the real molecule in 3D
                  </button>
                )}
              </div>
            </Section>
          )}

          <Section title="Connect to…">
            {others.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Add another component to see what can connect.</p>}
            <div className="conn-list">
              {others.map(({ n, res }) => (
                <div className="conn" key={n.id} style={pendingTarget === n.id ? { borderColor: 'var(--accent)' } : undefined}>
                  <div className="conn-head">
                    {res.ok ? <Link2 size={14} color="var(--green)" aria-hidden /> : <XCircle size={14} color="var(--danger)" aria-hidden />}
                    <span className="mono" style={{ fontWeight: 700 }}>{nodeShort(n)}</span>
                    <span className="grow" style={{ color: 'var(--text-dim)' }}>{nodeLabel(n)}</span>
                    <span className={`badge ${res.ok ? 'green' : 'danger'}`}>{res.ok ? 'compatible' : 'no bond'}</span>
                  </div>
                  {res.ok
                    ? res.options.map((o) => (
                      <div className="opt" key={o.key}>
                        <span title={o.detail}>{o.label}</span>
                        <button type="button" className="btn small" onClick={() => labActions.apply(node.id, n.id, o)}>Connect</button>
                      </div>
                    ))
                    : <div className="reason">{res.reason}</div>}
                </div>
              ))}
            </div>
          </Section>

          {product && product.bondSummary.length > 0 && <BondConditions nodeId={node.id} />}
        </>
      )}

      <Section title="What this lab is (and is not)">
        <div className="note"><Info size={14} aria-hidden /><div>{LAB_DISCLAIMER}</div></div>
      </Section>
    </>
  );
}

/** How cells actually form the bonds present in the selected assembly. */
function BondConditions({ nodeId }: { nodeId: string }) {
  const lab = useStore(labStore, (s) => s.lab);
  const rules = useMemo(() => {
    const seen = new Map<string, ReturnType<typeof ruleById>>();
    const stack = [nodeId], visited = new Set(stack);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const b of bondsOf(lab, cur)) {
        if (b.ruleId && !seen.has(b.ruleId)) seen.set(b.ruleId, ruleById(b.ruleId));
        const o = b.a === cur ? b.b : b.a;
        if (!visited.has(o)) { visited.add(o); stack.push(o); }
      }
    }
    return [...seen.values()].filter(Boolean);
  }, [lab, nodeId]);
  if (!rules.length) return null;
  return (
    <Section title="How cells really make these bonds">
      {rules.map((r) => (
        <div key={r!.id} className="note" style={{ marginBottom: 6 }}>
          <Info size={14} aria-hidden />
          <div><strong>{r!.name}{r!.byproduct ? ' (net: − H₂O)' : ''}.</strong> {r!.cellularReality}</div>
        </div>
      ))}
    </Section>
  );
}
