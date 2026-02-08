import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_URL, STORAGE_KEYS } from '../constants/config';
import { secureStorage } from '../utils/storage';

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
        } catch (error) {
          console.error('Error loading auth token:', error);
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

  // Auth Methods
  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, name: string) {
    const response = await this.api.post('/auth/register', { email, password, name });
    return response.data;
  }

  // User Methods
  async getProfile() {
    const response = await this.api.get('/auth/me');
    return response.data;
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

  // Trips Methods
  async createTrip(data: any) {
    const response = await this.api.post('/trips', data);
    return response.data;
  }

  async getTrips(params?: {
    search?: string;
    status?: 'upcoming' | 'ongoing' | 'completed';
    sortBy?: 'startDate' | 'createdAt' | 'destination';
    order?: 'ASC' | 'DESC';
  }) {
    const response = await this.api.get('/trips', { params });
    return response.data;
  }

  async getTripById(id: string) {
    const response = await this.api.get(`/trips/${id}`);
    return response.data;
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
      // Silent fail - don't block user experience
      console.warn('Failed to track affiliate click:', error);
      return null;
    }
  }

  async getMyAffiliateClicks(limit: number = 20) {
    const response = await this.api.get('/analytics/affiliate/my-clicks', {
      params: { limit },
    });
    return response.data;
  }

  async getTripAffiliateClicks(tripId: string) {
    const response = await this.api.get(`/analytics/affiliate/trip/${tripId}`);
    return response.data;
  }
}

export default new ApiService();
