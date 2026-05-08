/**
 * Normalize UAE-style mobile numbers for comparison and storage.
 * +971 5X XXX XXXX / 05X XXX XXXX / 5XXXXXXXX → 9715XXXXXXXX
 */
function normalizePhone(p) {
  if (!p || typeof p !== 'string') return '';
  const d = p.replace(/\D/g, '');
  if (d.startsWith('971') && d.length === 12) return d;
  if (d.startsWith('00971')) return d.slice(2);          // 00971… → 971…
  if (d.startsWith('0') && d.length === 10) return `971${d.slice(1)}`; // 05XXXXXXXX → 9715XXXXXXXX
  if (d.length === 9) return `971${d}`;                  // 5XXXXXXXX → 9715XXXXXXXX
  return d;
}

module.exports = { normalizePhone };
