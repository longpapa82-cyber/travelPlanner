import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_URL, STORAGE_KEYS } from '../constants/config';
import { secureStorage } from '../utils/storage';
import { getCurrentLanguage } from '../i18n';
import { offlineCache } from './offlineCache';

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

    // Response interceptor - Handle errors
    this.api.interceptors.response.use(
      (response) => response,
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

  async updateProfile(data: { name?: string; profileImage?: string }) {
    const response = await this.api.patch('/users/me', data);
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
    const response = await this.api.patch(`/trips/${id}`, data);
    return response.data;
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
    const response = await this.api.post(
      `/trips/${tripId}/itineraries/${itineraryId}/activities`,
      activityData
    );
    return response.data;
  }

  async updateActivity(
    tripId: string,
    itineraryId: string,
    activityIndex: number,
    activityData: any
  ) {
    const response = await this.api.patch(
      `/trips/${tripId}/itineraries/${itineraryId}/activities/${activityIndex}`,
      activityData
    );
    return response.data;
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
}

export default new ApiService();
