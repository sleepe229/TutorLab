import axios from 'axios';
import { API_BASE } from '../config.js';

const API_BASE_URL = `${API_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sessionToken');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  return config;
});

// Auto-refresh access token on 401
let isRefreshing = false;
let failedQueue = [];

let isStudentRefreshing = false;
let studentFailedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Auth endpoints return 401 for wrong credentials — not a token expiry, skip refresh
      const url = originalRequest.url || '';
      if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/tutors/login') || url.includes('/tutors/register')) {
        return Promise.reject(error);
      }

      // Student request (carries X-Student-Token) → try student token refresh
      if (originalRequest.headers?.['X-Student-Token']) {
        const studentRefreshToken = localStorage.getItem('studentRefreshToken');
        if (!studentRefreshToken) {
          ['studentAccountId', 'studentToken', 'studentRefreshToken', 'studentFirstName', 'studentLastName']
            .forEach(k => localStorage.removeItem(k));
          window.location.href = '/tutors';
          return Promise.reject(error);
        }

        if (isStudentRefreshing) {
          // Queue concurrent student requests until the token refresh completes
          return new Promise((resolve, reject) => {
            studentFailedQueue.push({ resolve, reject });
          }).then((newToken) => {
            originalRequest.headers['X-Student-Token'] = newToken;
            return api(originalRequest);
          }).catch((err) => Promise.reject(err));
        }

        isStudentRefreshing = true;

        try {
          const res = await axios.post(`${API_BASE_URL}/students/auth/refresh`, { refreshToken: studentRefreshToken });
          const newToken = res.data.accessToken;
          const newRefreshToken = res.data.refreshToken;
          localStorage.setItem('studentToken', newToken);
          if (newRefreshToken) localStorage.setItem('studentRefreshToken', newRefreshToken);
          // Retry all queued student requests with the new token
          studentFailedQueue.forEach(p => p.resolve(newToken));
          studentFailedQueue = [];
          originalRequest.headers['X-Student-Token'] = newToken;
          return api(originalRequest);
        } catch {
          studentFailedQueue.forEach(p => p.reject(error));
          studentFailedQueue = [];
          ['studentAccountId', 'studentToken', 'studentRefreshToken', 'studentFirstName', 'studentLastName']
            .forEach(k => localStorage.removeItem(k));
          window.location.href = '/tutors';
          return Promise.reject(error);
        } finally {
          isStudentRefreshing = false;
        }
      }

      // Tutor request → try tutor token refresh
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('tutorId');
        localStorage.removeItem('sessionToken');
        window.location.href = '/home';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['X-Session-Token'] = token;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken = response.data.accessToken;
        localStorage.setItem('sessionToken', newAccessToken);
        processQueue(null, newAccessToken);
        originalRequest.headers['X-Session-Token'] = newAccessToken;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('tutorId');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/home';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const tutorApi = {
  register: (data) => api.post('/tutors/register', data),
  login: (data) => api.post('/tutors/login', data),
  googleAuth: (accessToken) => api.post('/tutors/auth/google', { accessToken }),
  getTutor: (id) => api.get(`/tutors/${id}`),
  updateTutor: (id, data) => api.put(`/tutors/${id}`, data),
  tutorExists: (id) => api.get(`/tutors/${id}/exists`),
  loginExists: (login) => api.get(`/tutors/login/${login}/exists`),
  getPublicTutors: () => api.get('/tutors/public'),
  getTutorProfile: (id) => api.get(`/tutors/${id}/profile`),
  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/tutors/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response;
  },
};

export const studentApi = {
  createStudent: (tutorId, data) => api.post(`/students/tutor/${tutorId}`, data),
  getStudent: (id) => api.get(`/students/${id}`),
  getStudentsByTutor: (tutorId) => api.get(`/students/tutor/${tutorId}`),
  addMaterial: (id, materialUrl) => api.post(`/students/${id}/materials`, { materialUrl }),
  addLessonDate: (id, lessonDate) => api.post(`/students/${id}/lessons`, { lessonDate }),
  updateLessonDate: (id, oldLessonDate, newLessonDate) => api.put(`/students/${id}/lessons`, { oldLessonDate, newLessonDate }),
  deleteStudent: (id) => api.delete(`/students/${id}`),
  toggleFavorite: (id, tutorId) => api.post(`/students/${id}/toggle-favorite`, { tutorId }),
  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/students/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.photoUrl;
  },
  addLessonMaterial: (id, lessonDate, materialUrl) =>
    api.post(`/students/${id}/lesson-materials`, { lessonDate, materialUrl }),
  getStudentPublic: (id) => api.get(`/students/${id}/view`),
  updatePrice: (id, pricePerLesson, trialLessonsCount) =>
    api.put(`/students/${id}/price`, { pricePerLesson, trialLessonsCount }),
  updateLessonPayment: (id, date, status) =>
    api.post(`/students/${id}/lessons/${date}/payment`, { status }),
  updateStudentInfo: (id, data) => api.put(`/students/${id}/info`, data),
  uploadMaterial: async (file, tutorId, studentId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tutorId', tutorId);
    formData.append('studentId', studentId);
    const response = await api.post('/students/upload-material', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data.fileUrl;
  },
};

export const chatApi = {
  getOrCreate: (tutorId, studentAccountId, studentName) =>
    api.post('/chats', { tutorId, studentAccountId, studentName }),
  getOrCreateAsStudent: (tutorId, studentAccountId, studentName, token) =>
    api.post('/chats', { tutorId, studentAccountId, studentName }, { headers: { 'X-Student-Token': token } }),
  getTutorChats: (tutorId) => api.get(`/chats/tutor/${tutorId}`),
  getStudentChats: (studentAccountId, token) =>
    api.get(`/chats/student/${studentAccountId}`, { headers: { 'X-Student-Token': token } }),
  getMessages: (chatId, token) =>
    token
      ? api.get(`/chats/${chatId}/messages`, { headers: { 'X-Student-Token': token } })
      : api.get(`/chats/${chatId}/messages`),
  sendMessage: (chatId, payload, token) =>
    token
      ? api.post(`/chats/${chatId}/message`, payload, { headers: { 'X-Student-Token': token } })
      : api.post(`/chats/${chatId}/message`, payload),
  markReadTutor: (chatId) => api.post(`/chats/${chatId}/read/tutor`),
  markReadStudent: (chatId, token) =>
    api.post(`/chats/${chatId}/read/student`, {}, { headers: { 'X-Student-Token': token } }),
};

export const studentAccountApi = {
  register: (data) => api.post('/students/auth/register', data),
  login: (data) => api.post('/students/auth/login', data),
  googleAuth: (accessToken) => api.post('/students/auth/google', { accessToken }),
  refresh: (refreshToken) => api.post('/students/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/students/auth/logout', { refreshToken }),
  getMe: (token) => api.get('/students/auth/me', { headers: { 'X-Student-Token': token } }),
  link: (token, studentId) => api.post('/students/auth/link',
    { studentId },
    { headers: { 'X-Student-Token': token } }),
  getHistory: (token) => api.get('/students/auth/history', { headers: { 'X-Student-Token': token } }),
  getSnapshotRecap: (token, snapshotId) =>
    api.get(`/students/auth/snapshot/${snapshotId}/recap`, { headers: { 'X-Student-Token': token } }),
  getSnapshotSlides: (token, snapshotId) =>
    api.get(`/students/auth/snapshot/${snapshotId}/slides`, { headers: { 'X-Student-Token': token } }),
  updateMe: (token, data) =>
    api.patch('/students/auth/me', data, { headers: { 'X-Student-Token': token } }),
  updatePhoto: (token, photoUrl) =>
    api.patch('/students/auth/me/photo', { photoUrl }, { headers: { 'X-Student-Token': token } }),
  uploadChatFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tutorId', 'chat');
    formData.append('studentId', 'shared');
    const response = await api.post('/students/upload-material', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const liveApi = {
  getSessionByTutor: (tutorId, token) =>
    api.get(`/live/sessions/tutor/${tutorId}`, { headers: { 'X-Student-Token': token } }),
  endSession: (sessionId, studentId) =>
    api.post(`/live/sessions/${sessionId}/end`, studentId ? { studentId } : {}),
  getRecap: (snapshotId) => api.get(`/live/recap/${snapshotId}`),
};

export const progressApi = {
  addNote: (studentId, note) => api.post(`/students/${studentId}/progress-notes`, note),
  getNotes: (studentId, token) => api.get(`/students/${studentId}/progress-notes`,
    token ? { headers: { 'X-Student-Token': token } } : undefined),
};

export const joinApi = {
  // Student (with JWT token) joins a tutor by tutorId → creates student profile + links account
  joinTutor: (tutorId, token) =>
    api.post(`/join/${tutorId}`, {}, { headers: { 'X-Student-Token': token } }),
  // Get tutor public info for the join landing page (no auth)
  getTutorPublicInfo: (tutorId) => api.get(`/tutors/${tutorId}`),
};

export default api;
