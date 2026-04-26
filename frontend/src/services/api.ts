import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL, STORAGE_KEYS } from '../constants/config';
import { secureStorage } from '../utils/storage';
import { getCurrentLanguage } from '../i18n';
import { offlineCache } from './offlineCache';
import { offlineMutationQueue } from './offlineMutationQueue';
import { recordSlowApiCall } from '../common/sentry';

function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message?.includes('Network Error')) return true;
  if (!error.response && error.request) return true;
  return false;
}

/*
 * V115 (V114-8, Gate 10 HIGH-3 fix): explicit shape of the register /
 * register-force response. Previously the code read `(response as any).action`
 * which bypassed type checking entirely. The backend contract is:
 * pending-verification payload OR (for legacy backends during rollout) full
 * auth tokens. Both shapes are modelled here.
 */
export interface RegisterResponse {
  action?: 'created' | 'refreshed';
  user: {
    id: string;
    email: string | null;
    name: string;
    provider?: string;
    profileImage?: string | null;
    isEmailVerified?: boolean;
  };
  resumeToken?: string;
  requiresEmailVerification?: boolean;
  // Legacy (pre-V112) full-token path
  accessToken?: string;
  refreshToken?: string;
}

class ApiService {
  private api: AxiosInstance;
  private onAuthExpired: (() => void) | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];
  // Debounce map: error key → last report timestamp (10s cooldown)
  private errorReportTimestamps = new Map<string, number>();

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

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((sub) => sub.resolve(token));
    this.refreshSubscribers = [];
  }

  private onRefreshFailed(error: any) {
    this.refreshSubscribers.forEach((sub) => sub.reject(error));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(resolve: (token: string) => void, reject: (error: any) => void) {
    this.refreshSubscribers.push({ resolve, reject });
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token + stamp request start time
    this.api.interceptors.request.use(
      async (config) => {
        try {
          // Skip if Authorization is already explicitly set (e.g. getProfileWithToken)
          if (!config.headers.Authorization) {
            const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          }
          config.headers['Accept-Language'] = getCurrentLanguage();
        } catch (error) {
          // Silent fail — proceed without auth token
        }

        // Stamp start time for slow API detection
        (config as any)._requestStartMs = Date.now();

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Unwrap envelope + auto-refresh on 401
    this.api.interceptors.response.use(
      (response) => {
        // Unwrap { data, meta } envelope from backend
        if (response.data && typeof response.data === 'object' && 'data' in response.data && 'meta' in response.data) {
          response.data = response.data.data;
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Skip refresh for auth endpoints themselves to avoid loops
        const isAuthEndpoint = originalRequest?.url?.includes('/auth/refresh') ||
          originalRequest?.url?.includes('/auth/login') ||
          originalRequest?.url?.includes('/auth/register');

        if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          if (!this.isRefreshing) {
            this.isRefreshing = true;

            try {
              const storedRefresh = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
              if (!storedRefresh) {
                // No refresh token available — session cannot be recovered.
                // Clear stale access token and trigger logout.
                this.isRefreshing = false;
                this.onRefreshFailed(error);
                await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
                this.onAuthExpired?.();
                return Promise.reject(error);
              }

              const response = await this.api.post('/auth/refresh', { refreshToken: storedRefresh });
              const data = response.data?.accessToken ? response.data : response.data?.data;
              const { accessToken, refreshToken: newRefreshToken } = data;

              await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
              await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

              // Verify tokens were persisted (keychain can silently fail)
              const verified = await secureStorage.verifyItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
              if (!verified) {
                // Retry up to 3 times with increasing delay
                for (let i = 0; i < 3; i++) {
                  await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
                  if (await secureStorage.verifyItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)) break;
                }
              }

              this.isRefreshing = false;
              this.onRefreshed(accessToken);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.api(originalRequest);
            } catch (refreshError: any) {
              this.isRefreshing = false;
              this.onRefreshFailed(error);

              // Clear tokens on explicit server rejection (401/403) or missing refresh token.
              // Network errors should preserve tokens for retry on next launch.
              const status = refreshError?.response?.status;
              if (status === 401 || status === 403) {
                await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
                await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
                this.onAuthExpired?.();
              }
              return Promise.reject(error);
            }
          }

          // Queue requests while refresh is in progress
          return new Promise((resolve, reject) => {
            this.addRefreshSubscriber(
              (newToken: string) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                resolve(this.api(originalRequest));
              },
              (err: any) => {
                reject(err);
              },
            );
          });
        }

        return Promise.reject(error);
      }
    );

    // 5xx error auto-reporting interceptor
    this.api.interceptors.response.use(undefined, (error: AxiosError) => {
      const status = error.response?.status;
      if (status && status >= 500) {
        const rawUrl = error.config?.url || 'unknown';
        // V185 (Invariant 35): strip query string before reporting to avoid
        // persisting PII (email, search query, share token) in error_logs.
        // Path-only is sufficient for grouping/filtering; query content
        // belongs in Sentry breadcrumbs (separate retention policy) only.
        const url = rawUrl.split('?')[0];
        // Don't report errors from the error-reporting endpoint itself
        if (url.includes('/error-logs')) {
          return Promise.reject(error);
        }
        const key = `${status}:${url}`;
        const now = Date.now();
        const last = this.errorReportTimestamps.get(key);

        if (!last || now - last > 10_000) {
          this.errorReportTimestamps.set(key, now);
          // Evict stale entries to prevent unbounded growth
          if (this.errorReportTimestamps.size > 50) {
            for (const [k, v] of this.errorReportTimestamps) {
              if (now - v > 60_000) this.errorReportTimestamps.delete(k);
            }
          }
          // V174 (P1): promote httpStatus and errorName out of the message
          // string so admin can filter + group. `routeName` placeholder is
          // populated elsewhere where a navigation ref is available; for
          // the pure interceptor path we can at least tag the endpoint.
          this.reportError({
            errorMessage: `[API ${status}] ${error.config?.method?.toUpperCase()} ${url}`,
            stackTrace: (error.response?.data as any)?.message || error.message,
            screen: 'ApiInterceptor',
            severity: 'error',
            deviceOS: Platform.OS,
            appVersion: Constants.expoConfig?.version,
            errorName: error?.name || 'ApiError',
            routeName: url,
            httpStatus: typeof status === 'number' ? status : undefined,
          }).catch(() => {});
        }
      }
      return Promise.reject(error);
    });

    // Slow API breadcrumb interceptor — records to Sentry when >10s
    this.api.interceptors.response.use(
      (response) => {
        const startMs = (response.config as any)?._requestStartMs;
        if (startMs) {
          const durationMs = Date.now() - startMs;
          recordSlowApiCall(
            response.config.url || 'unknown',
            response.config.method || 'unknown',
            durationMs,
            response.status,
          );
        }
        return response;
      },
      (error: AxiosError) => {
        const startMs = (error.config as any)?._requestStartMs;
        if (startMs) {
          const durationMs = Date.now() - startMs;
          recordSlowApiCall(
            error.config?.url || 'unknown',
            error.config?.method || 'unknown',
            durationMs,
            error.response?.status,
          );
        }
        return Promise.reject(error);
      },
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

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const response = await this.api.post('/auth/register', { email, password, name });
    return response.data as RegisterResponse;
  }

  /*
   * V115 (V114-8 fix): hard-reset an abandoned unverified registration.
   *
   * Called only after the user explicitly chose "start over" in response
   * to an `action: 'refreshed'` register response. The backend deletes the
   * previous unverified row and returns a fresh `{action: 'created', ...}`
   * pending-verification payload. Rate limited server-side to 1/10min.
   */
  async registerForce(email: string, password: string, name: string): Promise<RegisterResponse> {
    const response = await this.api.post('/auth/register-force', {
      email,
      password,
      name,
      confirmReset: true,
    });
    return response.data as RegisterResponse;
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

  // 6-digit code verification (mobile-first).
  //
  // V112 Wave 2 change: backend now requires a `pending_verification` scope
  // JWT on these endpoints. The caller passes the resumeToken issued by
  // register/login (EMAIL_NOT_VERIFIED 401 branch). The request interceptor
  // skips its default Bearer injection when Authorization is already set,
  // so this override lands as-is.
  async sendVerificationCode(
    resumeToken?: string,
  ): Promise<{ message: string; expiresIn: number }> {
    const response = await this.api.post(
      '/auth/send-verification-code',
      {},
      resumeToken
        ? { headers: { Authorization: `Bearer ${resumeToken}` } }
        : undefined,
    );
    return response.data;
  }

  async verifyEmailCode(
    code: string,
    resumeToken?: string,
  ): Promise<{
    message: string;
    isEmailVerified: boolean;
    // V112 Wave 5: backend upgrades the resume token to a full session
    // on a successful verify. Frontend promotes these to secureStorage
    // via AuthContext.completeEmailVerification.
    accessToken?: string;
    refreshToken?: string;
    user?: {
      id: string;
      email: string | null;
      name: string;
      provider: string;
      profileImage: string | null;
      isEmailVerified: boolean;
    };
  }> {
    const response = await this.api.post(
      '/auth/verify-email-code',
      { code },
      resumeToken
        ? { headers: { Authorization: `Bearer ${resumeToken}` } }
        : undefined,
    );
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

  async exchangeGoogleIdToken(idToken: string) {
    const response = await this.api.post('/auth/google/token', { idToken });
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

  /** Fetch profile with an explicit token, bypassing the request interceptor's storage read. */
  async getProfileWithToken(token: string) {
    try {
      const response = await this.api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  async deleteAccount(password?: string) {
    await this.api.post('/users/me/delete', { password });
  }

  async exportMyData(): Promise<Record<string, any>> {
    const response = await this.api.post('/users/me/export');
    return response.data;
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
    const response = await this.api.post('/trips', data, { timeout: 300000 });
    return response.data;
  }

  /**
   * V112 Wave 3: user-initiated cancel of an in-flight AI generation job.
   * Swallows 404 (already-gone) and 4xx so the UI can call this defensively
   * without showing an error if the job completed between poll and cancel.
   * Server returns 204 on success.
   */
  async cancelTripJob(jobId: string): Promise<void> {
    try {
      await this.api.delete(`/trips/jobs/${jobId}`, { timeout: 5000 });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 403) {
        // Idempotent from the UI's perspective — job already finished or
        // never existed. Swallow so the cancel button always feels responsive.
        return;
      }
      throw err;
    }
  }

  async createTripWithPolling(
    data: any,
    onProgress?: (step: string, message?: string) => void,
    signal?: AbortSignal,
  ): Promise<any> {
    try {
      const createResponse = await this.api.post('/trips/create-async', data, {
        timeout: 10000, // 10초 타임아웃 (빠른 응답 예상)
        signal,
      });

      const { jobId } = createResponse.data;

      if (!jobId) {
        throw new Error('TRIP_CREATION_NO_JOB');
      }

      // 2. 상태 폴링 (1초마다)
      return new Promise((resolve, reject) => {
        let pollCount = 0;
        const maxPolls = 300; // 최대 5분 (300초)
        // V112 Wave 3: if the caller aborts via AbortSignal, we must tell
        // the server to stop too. Without this, AbortSignal only stops the
        // local polling loop — the backend keeps running, burns the AI
        // quota, and commits a trip the user never sees.
        const sendCancelToServer = () => {
          this.cancelTripJob(jobId).catch((err) => {
            console.warn('[POLLING] cancelTripJob failed:', err?.message);
          });
        };
        if (signal) {
          const onAbort = () => sendCancelToServer();
          signal.addEventListener('abort', onAbort, { once: true });
        }

        const pollInterval = setInterval(async () => {
          // 취소 체크
          if (signal?.aborted) {
            clearInterval(pollInterval);
            reject(new Error('Trip creation cancelled'));
            return;
          }

          pollCount++;

          try {
            // 작업 상태 조회
            const statusResponse = await this.api.get(`/trips/job-status/${jobId}`, {
              timeout: 5000,
              signal,
            });

            const status = statusResponse.data;

            // 진행률 콜백 호출
            if (status.progress && onProgress) {
              onProgress(status.progress.step, status.progress.message);
            }

            // 완료 처리
            if (status.status === 'completed' && status.tripId) {
              clearInterval(pollInterval);

              // 최종 여행 데이터 조회
              try {
                const trip = await this.getTripById(status.tripId);
                resolve(trip);
              } catch (fetchError: any) {
                console.error('[POLLING] Failed to fetch trip:', fetchError.message);
                // 여행은 생성됐지만 조회 실패 - 에러에 tripId 포함
                const error: any = new Error('TRIP_FETCH_FAILED');
                error.tripId = status.tripId;
                error.tripCreated = true;
                reject(error);
              }
              return;
            }

            // V112 Wave 3: cancelled is a terminal state from DELETE /jobs/:id
            if (status.status === 'cancelled') {
              clearInterval(pollInterval);
              const error: any = new Error('Trip creation cancelled');
              error.cancelled = true;
              reject(error);
              return;
            }

            // 에러 처리
            if (status.status === 'error') {
              console.error('[POLLING] Trip creation failed:', status.error);
              clearInterval(pollInterval);
              reject(new Error(status.error || 'TRIP_CREATION_FAILED'));
              return;
            }

            // 타임아웃 체크
            if (pollCount >= maxPolls) {
              console.error('[POLLING] Timeout: exceeded maximum polling duration');
              clearInterval(pollInterval);
              reject(new Error('TRIP_CREATION_TIMEOUT'));
              return;
            }

            // pending, processing → 계속 폴링
          } catch (pollError: any) {
            // 네트워크 에러 등 - 재시도 가능하므로 계속 폴링
            console.warn(`[POLLING] Poll error:`, pollError.message);

            // 취소 에러는 즉시 중단
            if (pollError.name === 'AbortError' || pollError.code === 'ECONNABORTED') {
              clearInterval(pollInterval);
              reject(pollError);
              return;
            }

            // 기타 에러는 경고만 하고 계속 폴링 (일시적 네트워크 장애 대응)
          }
        }, 1000); // 1초마다 폴링
      });
    } catch (error: any) {
      console.error('[POLLING] Failed to start trip creation:', error.message);

      if (error.name === 'AbortError') {
        throw error;
      }

      // 작업 시작 실패 - 백엔드 에러 또는 네트워크 문제
      throw new Error(error.response?.data?.message || 'TRIP_CREATION_START_FAILED');
    }
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

  async downloadIcal(id: string): Promise<{ data: string; filename: string }> {
    const response = await this.api.get(`/trips/${id}/export/ical`, {
      responseType: 'text',
      headers: { Accept: 'text/calendar' },
    });
    const disposition = response.headers['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : 'trip.ics';
    return { data: response.data, filename };
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
    const isWeb = Platform.OS === 'web';

    if (isWeb && uri.startsWith('data:')) {
      // Web: convert data URI to Blob
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpeg';
      formData.append('photo', blob, `photo.${ext}`);
    } else if (isWeb && uri.startsWith('blob:')) {
      // Web: blob URL from file picker
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpeg';
      formData.append('photo', blob, `photo.${ext}`);
    } else {
      // Native: RN-style { uri, name, type } object
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Type-safe FormData append for React Native
      const photoData = {
        uri,
        name: filename,
        type
      } as any;

      (formData as any).append('photo', photoData);
    }

    const response = await this.api.post('/trips/upload/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadProfilePhoto(uri: string): Promise<{ url: string }> {
    const formData = new FormData();
    const isWeb = Platform.OS === 'web';

    if (isWeb && uri.startsWith('data:')) {
      // Web: convert data URI to Blob
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpeg';
      formData.append('photo', blob, `profile.${ext}`);
    } else if (isWeb && uri.startsWith('blob:')) {
      // Web: blob URL from file picker
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpeg';
      formData.append('photo', blob, `profile.${ext}`);
    } else {
      // Native: RN-style { uri, name, type } object
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Type-safe FormData append for React Native
      const photoData = {
        uri,
        name: filename,
        type
      } as any;

      (formData as any).append('photo', photoData);
    }

    const response = await this.api.post('/users/me/photo', formData, {
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

  async leaveTrip(tripId: string) {
    await this.api.delete(`/trips/${tripId}/leave`);
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

  async settleExpense(tripId: string, expenseId: string, targetUserId?: string) {
    const response = await this.api.post(`/trips/${tripId}/expenses/${expenseId}/settle`, targetUserId ? { targetUserId } : {});
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

  async getAdminErrorLogs(params: { page?: number; limit?: number; severity?: string; resolved?: boolean; platform?: string }) {
    const response = await this.api.get('/admin/error-logs', { params });
    return response.data;
  }

  async getAdminSubscriptionStats() {
    const response = await this.api.get('/admin/revenue/subscription-stats');
    return response.data;
  }

  async getAdminAiMetrics() {
    const response = await this.api.get('/admin/ai-metrics');
    return response.data;
  }

  async resolveErrorLog(id: string) {
    const response = await this.api.patch(`/admin/error-logs/${id}/resolve`);
    return response.data;
  }

  async getAdminApiUsageSummary() {
    const response = await this.api.get('/admin/api-usage/summary');
    return response.data;
  }

  async getAdminApiUsageDaily(from: string, to: string) {
    const response = await this.api.get('/admin/api-usage/daily', { params: { from, to } });
    return response.data;
  }

  async getAdminApiUsageMonthly(year: number) {
    const response = await this.api.get('/admin/api-usage/monthly', { params: { year } });
    return response.data;
  }

  async reportError(data: {
    errorMessage: string;
    stackTrace?: string;
    screen?: string;
    severity?: string;
    deviceOS?: string;
    appVersion?: string;
    // V174 (P1): expanded context — see backend/src/admin/dto/create-error-log.dto.ts
    errorName?: string;
    routeName?: string;
    breadcrumbs?: Array<Record<string, unknown>>;
    httpStatus?: number;
    deviceModel?: string;
  }) {
    // V180 (Issue 3): DB analysis showed deviceModel=NULL for 100% of
    // 4/24~4/25 rows because every reportError caller hand-built the
    // payload and forgot the new V174 fields. Auto-fill the platform
    // context here so missing fields never block triage. Caller-provided
    // values still win (so an interceptor can override deviceOS, etc.).
    const enriched = {
      ...data,
      deviceOS: data.deviceOS ?? Platform.OS,
      appVersion: data.appVersion ?? Constants.expoConfig?.version,
      deviceModel: data.deviceModel ?? this.getDeviceModelSafe(),
    };
    try {
      const response = await this.api.post('/error-logs', enriched);
      return response.data;
    } catch (err: any) {
      // V176: V174's expanded payload was being rejected with 400 when the
      // server-side ValidationPipe forbid unknown breadcrumb keys (Sentry
      // sometimes emits keys like `event_id` / `type`). Result: error_logs
      // had ZERO new-payload rows for 3 days. We now retry with a stripped
      // legacy payload so diagnostic data still lands in the table.
      if (err?.response?.status === 400 && enriched.breadcrumbs) {
        const minimal = {
          errorMessage: enriched.errorMessage,
          stackTrace: enriched.stackTrace,
          screen: enriched.screen,
          severity: enriched.severity,
          deviceOS: enriched.deviceOS,
          appVersion: enriched.appVersion,
        };
        const retry = await this.api.post('/error-logs', minimal);
        return retry.data;
      }
      throw err;
    }
  }

  // V180 (Issue 3): defensive lookup — expo-device may be unavailable in web
  // builds or before the native module loads. We swallow any failure and
  // return undefined so the report still goes through.
  private getDeviceModelSafe(): string | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Device = require('expo-device');
      return Device?.modelName ?? undefined;
    } catch {
      return undefined;
    }
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

  // Subscription
  async getSubscriptionStatus() {
    const response = await this.api.get('/subscription/status');
    return response.data;
  }

  async restoreSubscription() {
    const response = await this.api.post('/subscription/restore');
    return response.data;
  }

  async getPaddleCheckoutConfig(plan: 'monthly' | 'yearly'): Promise<{ priceId: string }> {
    const response = await this.api.post('/subscription/paddle/checkout-config', { plan });
    return response.data;
  }

  // ─── Announcements (Public) ─────────────────

  async getAnnouncements() {
    const response = await this.api.get('/announcements');
    return response.data;
  }

  async getAnnouncementDetail(id: string) {
    const response = await this.api.get(`/announcements/${id}`);
    return response.data;
  }

  async getAnnouncementUnreadCount(): Promise<{ count: number }> {
    const response = await this.api.get('/announcements/unread-count');
    return response.data;
  }

  async markAnnouncementRead(id: string) {
    await this.api.patch(`/announcements/${id}/read`);
  }

  async dismissAnnouncement(id: string) {
    await this.api.patch(`/announcements/${id}/dismiss`);
  }

  // ─── Announcements (Admin) ─────────────────

  async getAdminAnnouncements(params?: { page?: number; limit?: number }) {
    const response = await this.api.get('/admin/announcements', { params });
    return response.data;
  }

  async getAdminAnnouncement(id: string) {
    const response = await this.api.get(`/admin/announcements/${id}`);
    return response.data;
  }

  async createAnnouncement(data: any) {
    const response = await this.api.post('/admin/announcements', data);
    return response.data;
  }

  async updateAnnouncement(id: string, data: any) {
    const response = await this.api.patch(`/admin/announcements/${id}`, data);
    return response.data;
  }

  async deleteAnnouncement(id: string) {
    await this.api.delete(`/admin/announcements/${id}`);
  }

  async publishAnnouncement(id: string) {
    const response = await this.api.patch(`/admin/announcements/${id}/publish`);
    return response.data;
  }

  async unpublishAnnouncement(id: string) {
    const response = await this.api.patch(`/admin/announcements/${id}/unpublish`);
    return response.data;
  }

  // Places Autocomplete
  async placesAutocomplete(input: string, sessionToken?: string, language?: string) {
    const params: Record<string, string> = { input };
    if (sessionToken) params.sessionToken = sessionToken;
    if (language) params.language = language;
    const response = await this.api.get('/places/autocomplete', { params });
    return response.data as {
      predictions: Array<{
        placeId: string;
        description: string;
        mainText: string;
        secondaryText: string;
        latitude?: number;
        longitude?: number;
      }>;
      available: boolean;
    };
  }

  // ─── Consent Management (Phase 0b) ─────────────────

  async getConsentsStatus() {
    const response = await this.api.get('/users/me/consents');
    return response.data;
  }

  async updateConsents(data: any) {
    const response = await this.api.post('/users/me/consents', data);
    return response.data;
  }
}

export default new ApiService();
