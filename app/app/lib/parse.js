// Parses text extracted from an insurance estimate PDF (Xactimate-style layout).
// Best effort: real estimates vary a lot, so every field is optional and the
// parser reports what it could not read instead of guessing.

const UNITS = 'SQ|LF|SF|EA|HR|CY|SY|DA|MO|WK|LS|TON|GAL|CF|BF|MSF|MLF|LB|PR|DAY';
const NUM = String.raw`\(?-?\d[\d,]*\.\d{1,4}\)?`;
// "12. Description text ....  34.65 SQ  292.14  0.00  0.00  10,123.45 ..."
const ITEM_RE = new RegExp(String.raw`^\s*(\d{1,3})\.\s+(.+?)\s+(${NUM})\s+(${UNITS})\b(.*)$`, 'i');
const NUM_G = new RegExp(NUM, 'g');
const MONEY_RE = /\d[\d,]*\.\d{2}/;
const STOP_RE = /^\s*(total|subtotal|line item total|summary|overhead|profit|sales tax|page\b|recap|deductible|net claim|replacement cost|actual cash)/i;

export function toNum(s) {
  if (s == null) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(String(s).replace(/[(),-]/g, ''));
  return Number.isNaN(n) ? null : neg ? -n : n;
}

// A wrapped description line sits indented under its item and carries no numbers.
function isContinuation(line) {
  return /^\s{3,}\S/.test(line) && !MONEY_RE.test(line) && !STOP_RE.test(line) && line.trim().length < 100;
}

export function parseItems(text) {
  const items = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(ITEM_RE);
    if (m) {
      const nums = (m[5].match(NUM_G) || []).map(toNum);
      cur = {
        n: Number(m[1]),
        description: m[2].trim(),
        qty: toNum(m[3]),
        unit: m[4].toUpperCase(),
        unitPrice: nums[0] ?? null,
        tax: nums[1] ?? null,
        op: nums[2] ?? null,
        rcv: nums[3] ?? null,
      };
      items.push(cur);
    } else if (cur && isContinuation(raw)) {
      cur.description += ' ' + raw.trim();
    } else {
      cur = null;
    }
  }
  return items;
}

export function parseEstimate(text) {
  const pick = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };
  const n = (re) => { const m = text.match(re); return m ? toNum(m[1]) : null; };
  const lf = (label) => n(new RegExp(String.raw`${label}\s*(?:length)?\s*[:=]?\s*(\d[\d,]*\.?\d*)\s*LF`, 'i'));

  const items = parseItems(text);

  const header = {
    insured: pick(/^\s*Insured\s*:?\s*(.+)$/im),
    claim: pick(/^\s*Claim\s*(?:Number|No\.?|#)\s*:?\s*([A-Z0-9-]{4,})/im),
    property: pick(/^\s*(?:Property|Loss Location|Risk Location)\s*:?\s*(.+)$/im),
    dateOfLoss: pick(/Date of Loss\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i),
    carrier: pick(/^\s*(?:Carrier|Insurer|Insurance Company)\s*:?\s*(.+)$/im),
    priceList: pick(/Price List\s*:?\s*([A-Z0-9_]+)/i),
  };

  const tearOff = items.find((i) => i.unit === 'SQ' && /^remove\b.*(shingle|comp)/i.test(i.description));
  const m = {
    areaSQ:
      n(/(?:total\s+roof\s+area|roof\s+area|total\s+area)\s*[:=]?\s*(\d[\d,]*\.?\d*)\s*(?:SQ|squares?)\b/i) ??
      tearOff?.qty ?? null,
    pitch: n(/pitch\s*[:=]?\s*(\d{1,2})\s*\/\s*12/i),
    stories: n(/(?:stories|story|storeys)\s*[:=]\s*(\d)/i) ?? n(/\b(\d)\s*(?:stories|story)\b/i),
    eavesLF: lf('eaves?'),
    rakesLF: lf('rakes?'),
    ridgesLF: lf('ridges?'),
    hipsLF: lf('hips?'),
    valleysLF: lf('valleys?'),
    wastePct: n(/waste(?:\s*factor)?\s*[:=]?\s*(\d{1,2}(?:\.\d+)?)\s*%/i),
  };
  m.shape = m.hipsLF > 0 ? 'hip' : m.rakesLF > 0 ? 'gable' : null;

  const opLine = /^\s*(?:overhead|profit)\b[^\n]*\d+(?:\.\d+)?\s*%[^\n]*\d[\d,]*\.\d{2}/im.test(text);
  const opCol = items.some((i) => (i.op ?? 0) > 0);

  const warnings = [];
  if (!items.length) warnings.push('No line items could be read. If this is a scanned PDF it needs OCR first.');
  if (!header.claim && !header.insured) warnings.push('Claim details were not found in the PDF. Fill them in manually.');

  return { header, measurements: m, items, hasOP: opLine || opCol, warnings };
        }
