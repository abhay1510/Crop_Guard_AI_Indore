const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const getToken = () => localStorage.getItem('cg_token');
export const setToken = (t) => (t ? localStorage.setItem('cg_token', t) : localStorage.removeItem('cg_token'));

async function request(path, { method = 'GET', body, form, timeoutMs } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: payload,
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The request took too long. Try a smaller image or try again later.');
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('cg-logout')); }
    const err = new Error(data.detail ? `${data.error}: ${data.detail}` : data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchImageBlobUrl(scanId) {
  const res = await fetch(`${BASE}/scans/${scanId}/image`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('image unavailable');
  return URL.createObjectURL(await res.blob());
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  contact: (body) => request('/contact', { method: 'POST', body }),
  adminOverview: () => request('/admin/overview'),
  adminUsers: () => request('/admin/users'),
  updateUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  adminMessages: () => request('/admin/messages'),
  markAdminMessageRead: (id) => request(`/admin/messages/${id}/read`, { method: 'PATCH' }),
  health: () => request('/health'),
  dashboard: () => request('/dashboard'),
  nearby: (latitude, longitude) => request(`/nearby?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, { timeoutMs: 32_000 }),
  fields: () => request('/fields'),
  createField: (b) => request('/fields', { method: 'POST', body: b }),
  resetFieldAnalysis: (id) => request(`/fields/${id}/analysis`, { method: 'DELETE' }),
  deleteField: (id) => request(`/fields/${id}`, { method: 'DELETE' }),
  report: (id) => request(`/fields/${id}/report`),
  healthMap: (id) => request(`/fields/${id}/health-map`),
  recommendations: (id) => request(`/fields/${id}/recommendations`),
  scans: (fieldId) => request(`/scans${fieldId ? `?fieldId=${fieldId}` : ''}`),
  createScan: (form) => request('/scans', { method: 'POST', form }),
  dronePreview: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('/drone/preview', { method: 'POST', form });
  },
  droneAnalyze: (file) => {
    const form = new FormData();
    form.append('image', file);
    form.append('language', localStorage.getItem('cg_language') || 'en');
    return request('/drone/analyze', { method: 'POST', form, timeoutMs: 125000 });
  },
  askChat: (question, history, language = 'en') => request('/chat', {
    method: 'POST',
    body: { question, history, language },
  }),
};