/**
 * Bearer-token headers for backend calls.
 * Pro-gated endpoints (quiz, tutor, comic, TTS, JD teach, voice/translate)
 * and the plan-aware /ask endpoints identify the user by this header.
 */
export function authHeaders(extra = {}) {
  const token = localStorage.getItem('vidhan_token');
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
