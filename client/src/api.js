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
};

export const user = {
  profile: () => request('/user/profile'),
  changePassword: (currentPassword, newPassword) => request('/user/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  traffic: (hours = 24) => request(`/user/traffic?hours=${hours}`),
};

export const ports = {
  list: () => request('/ports'),
  create: (port, name, protocol) => request('/ports', { method: 'POST', body: JSON.stringify({ port, name, protocol }) }),
  update: (id, data) => request(`/ports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/ports/${id}`, { method: 'DELETE' }),
  random: () => request('/ports/random'),
};

export const admin = {
  users: (page = 1, limit = 20, search = '') => request(`/admin/users?page=${page}&limit=${limit}&search=${search}`),
  userDetail: (id) => request(`/admin/users/${id}`),
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  updatePort: (userId, portId, data) => request(`/admin/users/${userId}/ports/${portId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePort: (userId, portId) => request(`/admin/users/${userId}/ports/${portId}`, { method: 'DELETE' }),
  stats: () => request('/admin/stats'),
};

export const stats = {
  user: (userId, hours = 24) => request(`/stats/user/${userId}?hours=${hours}`),
  global: (hours = 24) => request(`/stats/global?hours=${hours}`),
};
