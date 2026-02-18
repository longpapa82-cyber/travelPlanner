import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_URL, STORAGE_KEYS } from '../constants/config';
import { secureStorage } from '../utils/storage';
import { getCurrentLanguage } from '../i18n';
import { offlineCache } from './offlineCache';
import { offlineMutationQueue } from './offlineMutationQueue';

function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message?.includes('Network Error')) return true;
  if (!error.response && error.request) return true;
  return false;
}

class ApiService {
  private api: AxiosInstance;
  private onAuthExpired: (() => void) | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  setOnAuthExpired(callback: () => void) {
    this.onAuthExpired = callback;
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          config.headers['Accept-Language'] = getCurrentLanguage();
        } catch (error) {
          // Silent fail — proceed without auth token
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Unwrap envelope + handle errors
    this.api.interceptors.response.use(
      (response) => {
        // Unwrap { data, meta } envelope from backend
        if (response.data && typeof response.data === 'object' && 'data' in response.data && 'meta' in response.data) {
          response.data = response.data.data;
        }
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear storage and trigger logout
          await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          this.onAuthExpired?.();
        }

        return Promise.reject(error);
      }
    );
  }

  public getInstance(): AxiosInstance {
    return this.api;
  }

  // Generic HTTP methods for services
  async get<T = any>(url: string, config?: Parameters<AxiosInstance['get']>[1]) {
    return this.api.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['post']>[2]) {
    return this.api.post<T>(url, data, config);
  }

  // Auth Methods
  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, name: string) {
    const response = await this.api.post('/auth/register', { email, password, name });
    return response.data;
  }

  // Email Verification
  async verifyEmail(token: string) {
    const response = await this.api.post('/auth/verify-email', { token });
    return response.data;
  }

  async resendVerification(email: string) {
    const response = await this.api.post('/auth/resend-verification', { email });
    return response.data;
  }

  // Password Reset
  async forgotPassword(email: string) {
    const response = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }

  async exchangeOAuthCode(code: string) {
    const response = await this.api.post('/auth/oauth/exchange', { code });
    return response.data;
  }

  // User Methods
  async getProfile() {
    try {
      const response = await this.api.get('/auth/me');
      const data = response.data;
      offlineCache.set('profile', data).catch(() => {});
      return data;
    } catch (error) {
      const cached = await offlineCache.get('profile');
      if (cached) return cached;
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    const response = await this.api.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async logout(refreshToken: string) {
    return this.api.post('/auth/logout', { refreshToken });
  }

  async updateProfile(data: { name?: string; profileImage?: string }) {
    const response = await this.api.patch('/users/me', data);
    return response.data;
  }

  async updateTravelPreferences(preferences: { budget?: string; travelStyle?: string; interests?: string[] }) {
    const response = await this.api.patch('/users/me/travel-preferences', preferences);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.api.post('/users/me/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  async deleteAccount() {
    await this.api.delete('/users/me');
  }

  // 2FA Methods
  async setupTwoFactor() {
    const response = await this.api.post('/auth/2fa/setup');
    return response.data;
  }

  async enableTwoFactor(code: string) {
    const response = await this.api.post('/auth/2fa/enable', { code });
    return response.data;
  }

  async disableTwoFactor(code: string) {
    const response = await this.api.post('/auth/2fa/disable', { code });
    return response.data;
  }

  async verifyTwoFactor(tempToken: string, code: string) {
    const response = await this.api.post(
      '/auth/2fa/verify',
      { code },
      { headers: { Authorization: `Bearer ${tempToken}` } }
    );
    return response.data;
  }

  async regenerateBackupCodes(code: string) {
    const response = await this.api.post('/auth/2fa/regenerate-backup-codes', { code });
    return response.data;
  }

  // Trips Methods
  async createTrip(data: any) {
    const response = await this.api.post('/trips', data, { timeout: 120000 });
    return response.data;
  }

  async getTrips(params?: {
    search?: string;
    status?: 'upcoming' | 'ongoing' | 'completed';
    country?: string;
    startDateFrom?: string;
    startDateTo?: string;
    budgetMin?: number;
    budgetMax?: number;
    sortBy?: 'startDate' | 'createdAt' | 'destination';
    order?: 'ASC' | 'DESC';
    page?: number;
    limit?: number;
  }) {
    try {
      const response = await this.api.get('/trips', { params });
      const data = response.data;
      // Cache trips for offline use
      const cacheKey = `trips:${params?.status || 'all'}`;
      offlineCache.set(cacheKey, data).catch(() => {});
      return data;
    } catch (error) {
      // Return cached data if network fails
      const cacheKey = `trips:${params?.status || 'all'}`;
      const cached = await offlineCache.get(cacheKey);
      if (cached) return cached;
      throw error;
    }
  }

  async getTripById(id: string) {
    try {
      const response = await this.api.get(`/trips/${id}`);
      const data = response.data;
      // Cache individual trip for offline use
      offlineCache.set(`trip:${id}`, data).catch(() => {});
      return data;
    } catch (error) {
      // Return cached data if network fails
      const cached = await offlineCache.get(`trip:${id}`);
      if (cached) return cached;
      throw error;
    }
  }

  async updateTrip(id: string, data: any) {
    try {
      const response = await this.api.patch(`/trips/${id}`, data);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineMutationQueue.enqueue({
          method: 'PATCH',
          url: `/trips/${id}`,
          data,
          maxRetries: 3,
        });
        // Update local cache optimistically
        const cached = await offlineCache.get(`trip:${id}`);
        if (cached) {
          const updated = { ...(cached as any), ...data, _offline: true };
          await offlineCache.set(`trip:${id}`, updated);
          return updated;
        }
        return { ...data, id, _offline: true };
      }
      throw error;
    }
  }

  async deleteTrip(id: string) {
    await this.api.delete(`/trips/${id}`);
  }

  async duplicateTrip(id: string) {
    const response = await this.api.post(`/trips/${id}/duplicate`);
    return response.data;
  }

  getExportIcalUrl(id: string): string {
    return `${API_URL}/trips/${id}/export/ical`;
  }

  // Activity Methods
  async addActivity(tripId: string, itineraryId: string, activityData: any) {
    try {
      const response = await this.api.post(
        `/trips/${tripId}/itineraries/${itineraryId}/activities`,
        activityData
      );
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineMutationQueue.enqueue({
          method: 'POST',
          url: `/trips/${tripId}/itineraries/${itineraryId}/activities`,
          data: activityData,
          maxRetries: 3,
        });
        return { ...activityData, _offline: true };
      }
      throw error;
    }
  }

  async updateActivity(
    tripId: string,
    itineraryId: string,
    activityIndex: number,
    activityData: any
  ) {
    try {
      const response = await this.api.patch(
        `/trips/${tripId}/itineraries/${itineraryId}/activities/${activityIndex}`,
        activityData
      );
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineMutationQueue.enqueue({
          method: 'PATCH',
          url: `/trips/${tripId}/itineraries/${itineraryId}/activities/${activityIndex}`,
          data: activityData,
          maxRetries: 3,
        });
        return { ...activityData, _offline: true };
      }
      throw error;
    }
  }

  async deleteActivity(tripId: string, itineraryId: string, activityIndex: number) {
    const response = await this.api.delete(
      `/trips/${tripId}/itineraries/${itineraryId}/activities/${activityIndex}`
    );
    return response.data;
  }

  async reorderActivities(tripId: string, itineraryId: string, order: number[]) {
    const response = await this.api.patch(
      `/trips/${tripId}/itineraries/${itineraryId}/activities/reorder`,
      { order }
    );
    return response.data;
  }

  // Share Methods
  async generateShareLink(tripId: string, expiresInDays?: number) {
    const response = await this.api.post(`/trips/${tripId}/share`, {
      expiresInDays,
    });
    return response.data;
  }

  async getSharedTrip(shareToken: string) {
    const response = await this.api.get(`/share/${shareToken}`);
    return response.data;
  }

  async disableSharing(tripId: string) {
    const response = await this.api.delete(`/trips/${tripId}/share`);
    return response.data;
  }

  // Analytics Methods
  async trackAffiliateClick(data: {
    provider: string;
    destination?: string;
    checkIn?: string;
    checkOut?: string;
    travelers?: number;
    trackingId?: string;
    affiliateUrl?: string;
    referrer?: string;
    tripId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await this.api.post('/analytics/affiliate/track', data);
      return response.data;
    } catch (error) {
      // Silent fail — don't block user experience
      return null;
    }
  }

  async getMyAffiliateClicks(limit: number = 20) {
    const response = await this.api.get('/analytics/affiliate/my-clicks', {
      params: { limit },
    });
    return response.data;
  }

  async getUserStats() {
    try {
      const response = await this.api.get('/trips/my-stats');
      const data = response.data;
      offlineCache.set('user-stats', data).catch(() => {});
      return data;
    } catch (error) {
      const cached = await offlineCache.get('user-stats');
      if (cached) return cached;
      throw error;
    }
  }

  async uploadPhoto(uri: string): Promise<{ url: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('photo', { uri, name: filename, type } as any);
    const response = await this.api.post('/trips/upload/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Collaboration
  async getCollaborators(tripId: string) {
    const response = await this.api.get(`/trips/${tripId}/collaborators`);
    return response.data;
  }

  async addCollaborator(tripId: string, email: string, role: 'viewer' | 'editor' = 'viewer') {
    const response = await this.api.post(`/trips/${tripId}/collaborators`, { email, role });
    return response.data;
  }

  async updateCollaboratorRole(tripId: string, collabId: string, role: 'viewer' | 'editor') {
    const response = await this.api.patch(`/trips/${tripId}/collaborators/${collabId}`, { role });
    return response.data;
  }

  async removeCollaborator(tripId: string, collabId: string) {
    const response = await this.api.delete(`/trips/${tripId}/collaborators/${collabId}`);
    return response.data;
  }

  // Push Notifications
  async registerPushToken(token: string) {
    const response = await this.api.post('/auth/push-token', { token });
    return response.data;
  }

  async removePushToken() {
    await this.api.post('/auth/push-token/remove');
  }

  async getTripAffiliateClicks(tripId: string) {
    const response = await this.api.get(`/analytics/affiliate/trip/${tripId}`);
    return response.data;
  }

  // Notifications
  async getNotifications(page = 1, limit = 20) {
    const response = await this.api.get('/notifications', { params: { page, limit } });
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.api.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationRead(id: string) {
    await this.api.patch(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead() {
    await this.api.patch('/notifications/read-all');
  }

  async deleteNotification(id: string) {
    await this.api.delete(`/notifications/${id}`);
  }

  async deleteAllNotifications() {
    await this.api.delete('/notifications');
  }

  // Expenses
  async getExpenses(tripId: string) {
    const response = await this.api.get(`/trips/${tripId}/expenses`);
    return response.data;
  }

  async createExpense(tripId: string, data: any) {
    const response = await this.api.post(`/trips/${tripId}/expenses`, data);
    return response.data;
  }

  async updateExpense(tripId: string, expenseId: string, data: any) {
    const response = await this.api.patch(`/trips/${tripId}/expenses/${expenseId}`, data);
    return response.data;
  }

  async deleteExpense(tripId: string, expenseId: string) {
    await this.api.delete(`/trips/${tripId}/expenses/${expenseId}`);
  }

  async getExpenseBalances(tripId: string) {
    const response = await this.api.get(`/trips/${tripId}/expenses/balances`);
    return response.data;
  }

  async getExpenseSettlements(tripId: string) {
    const response = await this.api.get(`/trips/${tripId}/expenses/settlements`);
    return response.data;
  }

  async settleExpense(tripId: string, expenseId: string) {
    const response = await this.api.post(`/trips/${tripId}/expenses/${expenseId}/settle`);
    return response.data;
  }

  // Admin Analytics
  async getAffiliateSummary(days = 30) {
    const response = await this.api.get('/analytics/affiliate/summary', { params: { days } });
    return response.data;
  }

  async getAffiliateProviderStats(startDate?: string, endDate?: string) {
    const response = await this.api.get('/analytics/affiliate/stats', {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getAffiliateDailyStats(startDate: string, endDate: string, provider?: string) {
    const response = await this.api.get('/analytics/affiliate/daily', {
      params: { startDate, endDate, provider },
    });
    return response.data;
  }
  // ─── Admin API ─────────────────────────────────

  async getAdminUserStats() {
    const response = await this.api.get('/admin/users/stats');
    return response.data;
  }

  async getAdminUsers(params: { page?: number; limit?: number; search?: string; provider?: string }) {
    const response = await this.api.get('/admin/users', { params });
    return response.data;
  }

  async getAdminErrorLogStats() {
    const response = await this.api.get('/admin/error-logs/stats');
    return response.data;
  }

  async getAdminErrorLogs(params: { page?: number; limit?: number; severity?: string; resolved?: boolean }) {
    const response = await this.api.get('/admin/error-logs', { params });
    return response.data;
  }

  async resolveErrorLog(id: string) {
    const response = await this.api.patch(`/admin/error-logs/${id}/resolve`);
    return response.data;
  }

  async reportError(data: { errorMessage: string; stackTrace?: string; screen?: string; severity?: string; deviceOS?: string; appVersion?: string }) {
    const response = await this.api.post('/error-logs', data);
    return response.data;
  }

  // ─── Social ─────────────────────────────────

  async followUser(userId: string) {
    await this.api.post(`/social/follow/${userId}`);
  }

  async unfollowUser(userId: string) {
    await this.api.delete(`/social/follow/${userId}`);
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const response = await this.api.get(`/social/followers/${userId}`, { params: { page, limit } });
    return response.data;
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const response = await this.api.get(`/social/following/${userId}`, { params: { page, limit } });
    return response.data;
  }

  async likeTrip(tripId: string) {
    await this.api.post(`/social/trips/${tripId}/like`);
  }

  async unlikeTrip(tripId: string) {
    await this.api.delete(`/social/trips/${tripId}/like`);
  }

  async getDiscoverFeed(tab: 'following' | 'trending' = 'trending', page = 1, limit = 20) {
    const response = await this.api.get('/social/feed', { params: { tab, page, limit } });
    return response.data;
  }

  async getUserPublicProfile(userId: string) {
    const response = await this.api.get(`/social/users/${userId}/profile`);
    return response.data;
  }
}

export default new ApiService();
