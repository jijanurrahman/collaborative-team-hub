import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 15000,
});

// Request interceptor — attach token from memory if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.__accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post('/auth/refresh');
        const { accessToken } = res.data;
        if (typeof window !== 'undefined') window.__accessToken = accessToken;
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(original);
      } catch (err) {
        processQueue(err, null);
        if (typeof window !== 'undefined') {
          window.__accessToken = null;
          window.location.href = '/auth/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
};

// Users
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.patch('/users/me', data),
  uploadAvatar: (formData) => api.post('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  search: (q, workspaceId) => api.get('/users/search', { params: { q, workspaceId } }),
};

// Workspaces
export const workspacesApi = {
  list: () => api.get('/workspaces'),
  create: (data) => api.post('/workspaces', data),
  get: (id) => api.get(`/workspaces/${id}`),
  update: (id, data) => api.patch(`/workspaces/${id}`, data),
  invite: (id, data) => api.post(`/workspaces/${id}/invite`, data),
  acceptInvite: (token) => api.post(`/workspaces/accept-invite/${token}`),
  updateMemberRole: (wsId, userId, role) => api.patch(`/workspaces/${wsId}/members/${userId}/role`, { role }),
  removeMember: (wsId, userId) => api.delete(`/workspaces/${wsId}/members/${userId}`),
  export: (id) => api.get(`/workspaces/${id}/export`, { responseType: 'blob' }),
};

// Goals
export const goalsApi = {
  list: (workspaceId, params) => api.get('/goals', { params: { workspaceId, ...params } }),
  create: (data) => api.post('/goals', data),
  get: (id) => api.get(`/goals/${id}`),
  update: (id, data, workspaceId) => api.patch(`/goals/${id}`, data, { params: { workspaceId } }),
  delete: (id, workspaceId) => api.delete(`/goals/${id}`, { params: { workspaceId } }),
  createMilestone: (goalId, data) => api.post(`/goals/${goalId}/milestones`, data),
  updateMilestone: (goalId, milestoneId, data) => api.patch(`/goals/${goalId}/milestones/${milestoneId}`, data),
  addProgress: (goalId, content) => api.post(`/goals/${goalId}/progress`, { content }),
};

// Announcements
export const announcementsApi = {
  list: (workspaceId, params) => api.get('/announcements', { params: { workspaceId, ...params } }),
  create: (data) => api.post('/announcements', data),
  get: (id) => api.get(`/announcements/${id}`),
  update: (id, data, workspaceId) => api.patch(`/announcements/${id}`, data, { params: { workspaceId } }),
  delete: (id, workspaceId) => api.delete(`/announcements/${id}`, { params: { workspaceId } }),
  pin: (id, workspaceId) => api.post(`/announcements/${id}/pin`, {}, { params: { workspaceId } }),
  react: (id, emoji) => api.post(`/announcements/${id}/react`, { emoji }),
  addComment: (id, data) => api.post(`/announcements/${id}/comments`, data),
};

// Action Items
export const actionItemsApi = {
  list: (workspaceId, params) => api.get('/action-items', { params: { workspaceId, ...params } }),
  create: (data) => api.post('/action-items', data),
  get: (id) => api.get(`/action-items/${id}`),
  update: (id, data, workspaceId) => api.patch(`/action-items/${id}`, data, { params: { workspaceId } }),
  delete: (id, workspaceId) => api.delete(`/action-items/${id}`, { params: { workspaceId } }),
  addComment: (id, data) => api.post(`/action-items/${id}/comments`, data),
};

// Notifications
export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// Analytics
export const analyticsApi = {
  get: (workspaceId) => api.get('/analytics', { params: { workspaceId } }),
};

// Audit
export const auditApi = {
  list: (workspaceId, params) => api.get('/audit', { params: { workspaceId, ...params } }),
};
