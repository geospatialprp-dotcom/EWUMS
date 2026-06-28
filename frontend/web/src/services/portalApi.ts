import axios from 'axios';
import { acceptLanguageHeader } from '../i18n';

const portalApi = axios.create({
  baseURL: '/api/v1/consumer-portal',
  headers: { 'Content-Type': 'application/json' },
});

let onPortalUnauthorized: (() => void) | null = null;

export function setPortalUnauthorizedHandler(handler: () => void) {
  onPortalUnauthorized = handler;
}

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('egip_portal_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = acceptLanguageHeader();
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      if (!url.includes('/auth/login')) {
        onPortalUnauthorized?.();
      }
    }
    return Promise.reject(error);
  },
);

export const consumerPortalApi = {
  getCatalog: () => portalApi.get('/catalog'),
  getAuthConfig: () => portalApi.get('/auth/config'),
  login: (fhtcNumber: string, mobile: string) =>
    portalApi.post('/auth/login', { fhtcNumber, mobile }),
  requestOtp: (fhtcNumber: string, mobile: string) =>
    portalApi.post('/auth/otp/request', { fhtcNumber, mobile }),
  verifyOtp: (fhtcNumber: string, mobile: string, otp: string) =>
    portalApi.post('/auth/otp/verify', { fhtcNumber, mobile, otp }),
  getProfile: () => portalApi.get('/me'),
  listBills: () => portalApi.get('/bills'),
  getBill: (id: string) => portalApi.get(`/bills/${id}`),
  listPayments: () => portalApi.get('/payments'),
  getPayment: (id: string) => portalApi.get(`/payments/${id}`),
  listComplaints: () => portalApi.get('/complaints'),
  registerComplaint: (data: object) => portalApi.post('/complaints', data),
  listApplications: () => portalApi.get('/applications'),
  getApplication: (requestNo: string) => portalApi.get(`/applications/${encodeURIComponent(requestNo)}`),
  applyNewConnection: (data: object) => portalApi.post('/applications/new-connection', data),
  trackApplication: (data: object) => portalApi.post('/applications/track', data),
  trackApplicationMe: (data: object) => portalApi.post('/applications/track/me', data),
  updateMobile: (mobile: string) => portalApi.patch('/profile/mobile', { mobile }),
  listNotifications: () => portalApi.get('/notifications'),
  markNotificationRead: (id: string) => portalApi.patch(`/notifications/${id}/read`),
  markAllNotificationsRead: () => portalApi.post('/notifications/read-all'),
};

export const jalMitraApi = {
  getConfig: () => portalApi.get('/jal-mitra/config'),
  getQuickActions: () => portalApi.get('/jal-mitra/quick-actions'),
  startSession: (data: { language?: string; channel?: string }) =>
    portalApi.post('/jal-mitra/sessions', data),
  listMessages: (sessionId: string) =>
    portalApi.get(`/jal-mitra/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, data: { text: string; quickActionId?: string; language?: string }) =>
    portalApi.post(`/jal-mitra/sessions/${sessionId}/messages`, data),
  verify: (sessionId: string, data: { fhtcNumber: string; mobile: string }) =>
    portalApi.post(`/jal-mitra/sessions/${sessionId}/verify`, data),
  requestOtp: (sessionId: string, data: { fhtcNumber: string; mobile: string }) =>
    portalApi.post(`/jal-mitra/sessions/${sessionId}/otp/request`, data),
  verifyOtp: (sessionId: string, data: { fhtcNumber: string; mobile: string; otp: string }) =>
    portalApi.post(`/jal-mitra/sessions/${sessionId}/otp/verify`, data),
  setLanguage: (sessionId: string, language: string) =>
    portalApi.patch(`/jal-mitra/sessions/${sessionId}/language`, { language }),
  escalate: (sessionId: string, data?: { targetRole?: string; reason?: string }) =>
    portalApi.post(`/jal-mitra/sessions/${sessionId}/escalate`, data ?? {}),
};

export default portalApi;
