// PDF text comes out of pdf.js as loose fragments with positions, not lines.
// The parser depends on line structure and on the indent of wrapped descriptions,
// so this rebuilds lines: group by baseline, sort left to right, turn gaps into spaces.
//
// items: [{ str, x, y, w }] in PDF points (y grows upward, like pdf.js transform[5]).

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function itemsToLines(items, { yTol = 2.5 } = {}) {
  const its = items.filter((i) => i.str && i.str.trim() !== '');
  if (!its.length) return '';

  const charW = median(its.filter((i) => i.str.length >= 3 && i.w > 0).map((i) => i.w / i.str.length)) || 4;
  const minX = Math.min(...its.map((i) => i.x));

  const sorted = [...its].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= yTol) last.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }

  return rows
    .map((row) => {
      const cells = row.items.sort((a, b) => a.x - b.x);
      let line = ' '.repeat(Math.max(0, Math.round((cells[0].x - minX) / charW)));
      let prev = null;
      for (const it of cells) {
        if (prev) {
          const gap = it.x - (prev.x + prev.w);
          const forced = /\s$/.test(prev.str) || /^\s/.test(it.str) ? 1 : 0;
          const n = gap < 0.3 * charW ? forced : Math.max(1, Math.round(gap / charW));
          line += ' '.repeat(n);
        }
        line += it.str.trim();
        prev = it;
      }
      return line;
    })
    .join('\n');
}
