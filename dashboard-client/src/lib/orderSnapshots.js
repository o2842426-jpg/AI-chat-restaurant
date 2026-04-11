/** Display text for nullable snapshot fields from API (snake_case). */
export function snapshotLine(value) {
  if (value == null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

/** `order_type` from API; null/unknown treated as delivery (legacy rows). */
export function orderTypeLabelAr(orderType) {
  const t = String(orderType ?? '').trim().toLowerCase();
  if (t === 'dine_in') return 'داخل المطعم';
  return 'توصيل';
}
