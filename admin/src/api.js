/* Shared API client for admin — attaches Bearer token to every request */
const BASE = 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('vadmin_token') || '';
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('vadmin_token');
    localStorage.removeItem('vadmin_user');
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login:          (body)   => request('/admin/login', { method: 'POST', body: JSON.stringify(body) }),
  signup:         (body)   => request('/admin/register', { method: 'POST', body: JSON.stringify(body) }),
  me:             ()       => request('/admin/me'),
  changePassword: (body)   => request('/admin/change-password', { method: 'POST', body: JSON.stringify(body) }),

  // Stats
  stats:          ()       => request('/admin/stats'),

  // Users
  users:    (p, l, s) => request(`/admin/users?page=${p}&limit=${l}&search=${encodeURIComponent(s)}`),
  deleteUser: (id)    => request(`/admin/users/${id}`, { method: 'DELETE' }),

  // Reviews
  reviews:      (p, l, s, r) => request(`/admin/reviews?page=${p}&limit=${l}&search=${encodeURIComponent(s)}&rating=${r}`),
  deleteReview: (id)         => request(`/admin/reviews/${id}`, { method: 'DELETE' }),

  // Queries
  queries: (p, l, s, email = '') => request(`/admin/queries?page=${p}&limit=${l}&search=${encodeURIComponent(s)}&email=${encodeURIComponent(email)}`),

  // Laws — summary
  lawsSummary: () => request('/admin/laws-summary'),

  // BNS Laws CRUD
  laws:        (p, l, s) => request(`/admin/laws?page=${p}&limit=${l}&search=${encodeURIComponent(s)}`),
  createLaw:   (body)     => request('/admin/laws', { method: 'POST', body: JSON.stringify(body) }),
  updateLaw:   (id, body) => request(`/admin/laws/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteLaw:   (id)       => request(`/admin/laws/${id}`, { method: 'DELETE' }),

  // IPC Laws CRUD
  ipcLaws:        (p, l, s) => request(`/admin/ipc-laws?page=${p}&limit=${l}&search=${encodeURIComponent(s)}`),
  createIpcLaw:   (body)     => request('/admin/ipc-laws', { method: 'POST', body: JSON.stringify(body) }),
  updateIpcLaw:   (id, body) => request(`/admin/ipc-laws/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIpcLaw:   (id)       => request(`/admin/ipc-laws/${id}`, { method: 'DELETE' }),

  // Admins
  admins:      ()   => request('/admin/admins'),
  deleteAdmin: (id) => request(`/admin/admins/${id}`, { method: 'DELETE' }),
};
