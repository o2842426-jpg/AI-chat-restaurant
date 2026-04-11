/** Display text for nullable snapshot fields from API (snake_case). */
export function snapshotLine(value) {
  if (value == null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}
