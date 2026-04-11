/**
 * Single source of truth for restaurant dashboard order status transitions.
 * Bot confirms draft -> confirmed; kitchen advances linearly after that.
 */

const STATUSES = ["draft", "confirmed", "preparing", "ready", "delivered"];

const NEXT_FROM = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
};

function normalizeStatus(s) {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

function canTransition(current, next) {
  const c = normalizeStatus(current);
  const n = normalizeStatus(next);
  if (!n || c === n) return true;
  return NEXT_FROM[c] === n;
}

function allowedNextStatuses(current) {
  const c = normalizeStatus(current);
  const n = NEXT_FROM[c];
  return n ? [c, n] : [c];
}

module.exports = {
  STATUSES,
  normalizeStatus,
  canTransition,
  allowedNextStatuses,
};
