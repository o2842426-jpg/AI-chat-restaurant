const TOKEN_KEY = "token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function parsePayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function getAuthRole() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parsePayload(token);
  return payload?.role || null;
}

/** Restaurant id from JWT (null for admin or missing token). */
export function getRestaurantId() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parsePayload(token);
  if (payload?.role === "admin") return null;
  const id = payload?.restaurant_id;
  return id != null ? Number(id) : null;
}
