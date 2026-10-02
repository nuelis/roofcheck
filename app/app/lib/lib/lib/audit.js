import { parseEstimate } from './parse.js';
import { RULES, makeCtx } from './rules.js';

export function auditEstimate(text) {
  const parsed = parseEstimate(text);
  const ctx = makeCtx(parsed);
  const warnings = [...parsed.warnings];

  if (parsed.items.length && !ctx.shingleScope) {
    warnings.push('No asphalt shingle scope found. This checklist only covers shingle re-roofs, so results are limited.');
  }

  const findings = ctx.shingleScope
    ? RULES.map((r) => {
        const hit = r.check(ctx);
        return hit ? { id: r.id, title: r.title, severity: r.severity, codeRef: r.codeRef, qty: null, ...hit } : null;
      }).filter(Boolean)
    : [];

  // likely first, stable order inside each group
  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'likely' ? -1 : 1));

  return {
    header: parsed.header,
    measurements: parsed.measurements,
    itemCount: parsed.items.length,
    findings,
    warnings,
    summary: {
      likely: findings.filter((f) => f.severity === 'likely').length,
      verify: findings.filter((f) => f.severity === 'verify').length,
    },
  };
}

const fmtQty = (q) => (q ? `${q.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${q.unit}` : null);

// The letter only includes 'likely' items, plus any 'verify' ids a human confirmed on site.
export function buildSupplementLetter(audit, { contractor = '[Your company]', contact = '[Phone or email]', adjuster = '[Adjuster name]', includeVerify = [] } = {}) {
  const h = audit.header;
  const rows = audit.findings.filter((f) => f.severity === 'likely' || includeVerify.includes(f.id));
  const out = ['[Date]', ''];
  out.push(`To: ${adjuster}${h.carrier ? `, ${h.carrier}` : ''}`);
  out.push('Re: Supplement request');
  if (h.claim) out.push(`Claim: ${h.claim}`);
  if (h.insured) out.push(`Insured: ${h.insured}`);
  if (h.property) out.push(`Property: ${h.property}`);
  if (h.dateOfLoss) out.push(`Date of loss: ${h.dateOfLoss}`);
  out.push('');
  out.push(`Hello ${adjuster},`);
  out.push('');
  out.push('We reviewed this estimate against the roof measurements and the scope of work. The items below appear to be missing. Please add them and reissue the estimate, or tell us the specific reason for any item you decline.');
  out.push('');
  rows.forEach((f, i) => {
    const qty = fmtQty(f.qty);
    out.push(`${i + 1}. ${f.title}`);
    out.push(`   Add: ${f.request}${qty ? ` (${qty})` : ''}`);
    out.push(`   Why: ${f.why}`);
    if (f.codeRef) out.push(`   Code: ${f.codeRef}`);
    out.push('');
  });
  out.push('Photos and measurement reports are attached. Call or email with any questions.');
  out.push('');
  out.push('Thank you,');
  out.push(contractor);
  out.push(contact);
  return out.join('\n');
}

// Internal list for the roofer. Never goes to the carrier.
export function buildInternalChecklist(audit) {
  const verify = audit.findings.filter((f) => f.severity === 'verify');
  const out = ['CONFIRM BEFORE SENDING (internal, not for the carrier)', ''];
  out.push('Every code reference in the letter: check the edition your city or county actually adopted.');
  if (!verify.length) out.push('- No extra items to confirm.');
  verify.forEach((f) => out.push(`- [ ] ${f.title}: ${f.why}`));
  out.push('- [ ] On-site items the PDF cannot show: decking, fascia, skylights, chimney, satellite dishes, gutters.');
  return out.join('\n');
}
