/**
 * Session + auth-header helpers for backend calls.
 * Pro-gated endpoints (quiz, tutor, TTS, JD teach, voice/translate)
 * and the plan-aware /ask endpoints identify the user by the Bearer header.
 */

const TOKEN_KEY = 'vidhan_token';

/* Everything a logged-in session writes. Cleared together so a half-cleared
   session can never look partly logged in. */
const SESSION_KEYS = ['vidhan_token', 'vidhan_user', 'vidhan_email', 'vidhan_avatar'];

/** Decode a JWT's payload without verifying it. The server is the real check —
    this only lets the UI notice a token that is already dead. */
function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * The stored token, or null when there isn't a usable one.
 *
 * Guards the two ways a session goes bad while still looking logged in:
 *   • the literal strings "undefined"/"null" — written by a failed login that
 *     stored its own error response, and truthy in localStorage
 *   • an expired token (they last 7 days)
 * Both make every authenticated request 401 while ProtectedRoute happily
 * renders the page, which reads as "the app is broken" rather than "log in".
 */
export function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw || raw === 'undefined' || raw === 'null') return null;
  const payload = decodeJwtPayload(raw);
  if (payload?.exp && payload.exp * 1000 <= Date.now()) return null;
  return raw;
}

/** Wipe the session so the UI stops pretending we're logged in. */
export function clearSession() {
  SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  try { sessionStorage.removeItem('vidhan_plan_cache'); } catch { /* private mode */ }
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/**
 * Reads the structured plan-gate error from a failed response.
 * Returns { error, message } — error is 'upgrade_required',
 * 'daily_limit_reached', 'demo_limit_reached', or null for other failures.
 */
export async function readPlanError(res) {
  try {
    const body = await res.json();
    const d = body?.detail;
    if (d && typeof d === 'object' && d.error) {
      return { error: d.error, message: d.message || '' };
    }
    if (typeof d === 'string') return { error: null, message: d };
  } catch { /* non-JSON body */ }
  return { error: null, message: '' };
}
