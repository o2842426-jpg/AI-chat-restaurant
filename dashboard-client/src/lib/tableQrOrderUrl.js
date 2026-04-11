/**
 * Build public order URLs for per-table QR codes (dine-in).
 * Example: `/order/4?mode=dine_in&table=7`
 *
 * @param {string|number} restaurantId
 * @param {string|number} tableNumber
 * @returns {string} pathname + query (no origin)
 */
export function buildDineInTableOrderPath(restaurantId, tableNumber) {
  const rid = encodeURIComponent(String(restaurantId).trim());
  const t = encodeURIComponent(String(tableNumber).trim());
  return `/order/${rid}?mode=dine_in&table=${t}`;
}

/**
 * Full URL for QR encoding (pass window.location.origin in the browser).
 *
 * @param {string} origin e.g. `https://menu.example.com` (no trailing slash)
 * @param {string|number} restaurantId
 * @param {string|number} tableNumber
 */
export function buildDineInTableOrderUrl(origin, restaurantId, tableNumber) {
  const path = buildDineInTableOrderPath(restaurantId, tableNumber);
  if (origin == null || String(origin).trim() === '') return path;
  return `${String(origin).replace(/\/$/, '')}${path}`;
}
