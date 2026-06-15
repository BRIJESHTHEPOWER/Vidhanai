// ── Shared validation helpers for Login / Signup forms ─────────────────────

export function validateName(name) {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Name can only contain letters, spaces, and . \' -';
  return '';
}

export function validateEmail(email) {
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return '';
}

export function validatePassword(password) {
  if (!password) return '';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return '';
}

const STRENGTH_LEVELS = [
  { label: 'Very weak', color: '#ef4444' },
  { label: 'Weak',      color: '#f97316' },
  { label: 'Fair',      color: '#eab308' },
  { label: 'Good',      color: '#22c55e' },
  { label: 'Strong',    color: '#06b6d4' },
];

export function getPasswordStrength(password) {
  if (!password) return { score: 0, percent: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password))   score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const idx = Math.min(score, STRENGTH_LEVELS.length - 1);
  return { score, percent: ((idx + 1) / STRENGTH_LEVELS.length) * 100, ...STRENGTH_LEVELS[idx] };
}
