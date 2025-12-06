const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  
  return data;
}

export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  verify: (token) => request(`/auth/verify?token=${token}`),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  settings: () => request('/auth/settings'),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  announcements: () => request('/auth/announcements'),
};

export const user = {
  profile: () => request('/user/profile'),
  changePassword: (currentPassword, newPassword) => request('/user/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  traffic: (hours = 24) => request(`/user/traffic?hours=${hours}`),
};

export const ports = {
  list: () => request('/ports'),
  create: (port, name, protocol, local_ip, local_port) => request('/ports', { method: 'POST', body: JSON.stringify({ port, name, protocol, local_ip, local_port }) }),
  update: (id, data) => request(`/ports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/ports/${id}`, { method: 'DELETE' }),
  random: () => request('/ports/random'),
  config: () => request('/ports/config'),
};

export const admin = {
  users: (page = 1, limit = 20, search = '') => request(`/admin/users?page=${page}&limit=${limit}&search=${search}`),
  userDetail: (id) => request(`/admin/users/${id}`),
  createUser: (data) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  toggleAdmin: (id) => request(`/admin/users/${id}/toggle-admin`, { method: 'POST' }),
  userConfig: (id) => request(`/admin/users/${id}/config`),
  addPort: (userId, data) => request(`/admin/users/${userId}/ports`, { method: 'POST', body: JSON.stringify(data) }),
  updatePort: (userId, portId, data) => request(`/admin/users/${userId}/ports/${portId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePort: (userId, portId) => request(`/admin/users/${userId}/ports/${portId}`, { method: 'DELETE' }),
  stats: () => request('/admin/stats'),
  getSettings: () => request('/admin/settings'),
  updateSettings: (data) => request('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getFrpToken: () => request('/admin/frp-token'),
  // 公告管理
  announcements: () => request('/admin/announcements'),
  createAnnouncement: (data) => request('/admin/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id, data) => request(`/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnouncement: (id) => request(`/admin/announcements/${id}`, { method: 'DELETE' }),
};

export const stats = {
  user: (userId, hours = 24) => request(`/stats/user/${userId}?hours=${hours}`),
  global: (hours = 24) => request(`/stats/global?hours=${hours}`),
};
