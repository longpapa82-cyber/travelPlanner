import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
    // Request interceptor - Add auth token
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
        const url = error.config?.url || 'unknown';
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
          this.reportError({
            errorMessage: `[API ${status}] ${error.config?.method?.toUpperCase()} ${url}`,
            stackTrace: (error.response?.data as any)?.message || error.message,
            screen: 'ApiInterceptor',
            severity: 'error',
            deviceOS: Platform.OS,
            appVersion: Constants.expoConfig?.version,
          }).catch(() => {});
        }
      }
      return Promise.reject(error);
    });
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

  // Track active SSE requests to prevent concurrent duplicates
  private activeSseRequest: Promise<any> | null = null;

  /**
   * Create trip with SSE progress streaming.
   * Falls back to regular createTrip if SSE fails.
   */
  async createTripWithProgress(
    data: any,
    onProgress?: (step: string, message?: string) => void,
    signal?: AbortSignal,
  ): Promise<any> {
    console.log('='.repeat(80));
    console.log('🚀 SSE DEBUGGING VERSION 12.0 - RAILWAY PROXY FIX');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Build Time: 2026-03-24 11:00 KST');
    console.log('Backend: 10KB padding + 3s delay');
    console.log('='.repeat(80));

    // If there's already an active SSE request, return it (prevent duplicates)
    if (this.activeSseRequest) {
      return this.activeSseRequest;
    }

    let sseRequestStarted = false;

    // Wrap the entire operation in a promise that we can track
    this.activeSseRequest = (async () => {
      try {
        const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const lang = getCurrentLanguage();

        const response = await fetch(`${API_URL}/trips/create-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Accept-Language': lang,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage = 'Trip creation failed';
          try {
            const parsed = JSON.parse(errorBody);
            errorMessage = parsed.message || errorMessage;
          } catch {}
          const error: any = new Error(errorMessage);
          error.response = { status: response.status, data: { message: errorMessage } };
          throw error;
        }

        // ✅ FIX: SSE request started successfully (201) - trip is being created on server
        // From this point, we MUST NOT fallback to createTrip() as it would create duplicates
        sseRequestStarted = true;

        const reader = response.body?.getReader();
        if (!reader) {
          // No streaming support - but trip creation already started on server
          // Poll for trip status instead of creating duplicate
          throw new Error('Streaming not supported but trip creation started');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let result: any = null;
        let lastActivityTime = Date.now();
        const SSE_TIMEOUT = 30000; // 30 seconds without data = timeout

        while (true) {
          // Add timeout protection to prevent indefinite hanging
          const readPromise = reader.read();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              const timeSinceLastActivity = Date.now() - lastActivityTime;
              if (timeSinceLastActivity >= SSE_TIMEOUT) {
                reject(new Error('SSE stream timeout - no data received for 30 seconds'));
              }
            }, SSE_TIMEOUT);
          });

          try {
            const { done, value } = await Promise.race([readPromise, timeoutPromise]);

            // ✅ FIX (Bug #7): Process the final chunk before breaking
            // done=true means no more data to read, but value may still contain the last chunk
            if (done) {
              console.log('[SSE DEBUG] Stream done=true');
              console.log('[SSE DEBUG]   - value exists?', value ? 'YES' : 'NO');
              console.log('[SSE DEBUG]   - value length:', value ? value.byteLength : 0);
              if (value) {
                const finalChunk = decoder.decode(value, { stream: false });
                console.log('[SSE DEBUG]   - Final chunk decoded:', JSON.stringify(finalChunk));
                console.log('[SSE DEBUG]   - Final chunk bytes:', finalChunk.split('').map(c => {
                  if (c === '\n') return '\\n';
                  if (c === '\r') return '\\r';
                  return c;
                }).join(''));
                buffer += finalChunk;
              }
              console.log('[SSE DEBUG] Breaking loop with buffer length:', buffer.length);
              console.log('[SSE DEBUG] Buffer content:', JSON.stringify(buffer.substring(0, 200)));
              break;
            }

            lastActivityTime = Date.now(); // Reset activity timer on data received

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const dataLine = line.replace(/^data: /, '').trim();
              if (!dataLine) continue;

              try {
                const event = JSON.parse(dataLine);
                console.log('[SSE DEBUG] Main loop parsed event:', event.step, event.tripId ? `(tripId: ${event.tripId})` : '');

                // Log if we have padding (Bug #11 debugging)
                if (event.padding) {
                  console.log('[SSE DEBUG] Event has padding field, length:', event.padding.length);
                }

                if (event.step === 'complete' && event.tripId) {
                  console.log('[SSE DEBUG] *** COMPLETE EVENT FOUND IN MAIN LOOP ***');
                  // Fetch the full trip data
                  result = await this.getTripById(event.tripId);
                  console.log('[SSE DEBUG] Trip fetched:', result?.id ? 'SUCCESS' : 'FAILED');
                } else if (event.step === 'error') {
                  const error: any = new Error(event.message || 'Trip creation failed');
                  error.response = { status: event.status || 500, data: { message: event.message } };
                  throw error;
                } else {
                  onProgress?.(event.step, event.message);
                }
              } catch (e: any) {
                if (e.response) throw e; // Re-throw structured errors
                console.log('[SSE DEBUG] Error parsing in main loop:', e.message);
              }
            }
          } catch (timeoutError: any) {
            // SSE timeout - trip was likely created but stream froze
            if (timeoutError.message?.includes('SSE stream timeout')) {
              // Set flag that trip was created
              sseRequestStarted = true;
              throw timeoutError;
            }
            throw timeoutError;
          }
        }

        // ✅ FIX (Bug #6): Process any remaining buffer data after stream closes
        // The server may send the final 'complete' event right before closing the connection,
        // causing 'done=true' before we process the buffered data
        console.log('[SSE DEBUG] === PROCESSING REMAINING BUFFER ===');
        console.log('[SSE DEBUG] Buffer length:', buffer.length);
        console.log('[SSE DEBUG] Buffer trimmed length:', buffer.trim().length);
        console.log('[SSE DEBUG] Buffer content:', JSON.stringify(buffer));
        console.log('[SSE DEBUG] Buffer bytes:', buffer.split('').map(c => {
          if (c === '\n') return '\\n';
          if (c === '\r') return '\\r';
          return c;
        }).join(''));

        if (buffer.trim()) {
          console.log('[SSE DEBUG] Buffer has content, processing...');

          // Try multiple parsing strategies for robustness
          // Strategy 1: Try to parse as-is (for partial JSON)
          let dataToProcess = buffer.trim();

          // Remove "data: " prefix if present
          if (dataToProcess.startsWith('data: ')) {
            dataToProcess = dataToProcess.substring(6).trim();
          }

          // Strategy 2: Try direct JSON parse first (simplest case)
          try {
            const event = JSON.parse(dataToProcess);
            console.log('[SSE DEBUG] Direct JSON parse successful:', event);

            if (event.step === 'complete' && event.tripId) {
              console.log('[SSE DEBUG] *** COMPLETE EVENT FOUND (direct parse) ***');
              result = await this.getTripById(event.tripId);
              console.log('[SSE DEBUG] Trip fetched:', result?.id ? 'SUCCESS' : 'FAILED');
            }
          } catch (directParseError) {
            console.log('[SSE DEBUG] Direct parse failed, trying SSE format...');

            // Strategy 3: Handle as SSE formatted events
            if (!buffer.endsWith('\n\n')) {
              buffer += '\n\n';
              console.log('[SSE DEBUG] Added missing \\n\\n to buffer');
            }

            // Now process as complete SSE events
            const events = buffer.split('\n\n').filter(e => e.trim());
            console.log('[SSE DEBUG] Events to process from buffer:', events.length);

            for (const eventBlock of events) {
              console.log('[SSE DEBUG] Processing event block:', JSON.stringify(eventBlock));

              // Handle both formats: with or without "data: " prefix
              let dataLine = eventBlock.trim();
              if (dataLine.startsWith('data: ')) {
                dataLine = dataLine.substring(6).trim();
              }
              console.log('[SSE DEBUG] Data line after processing:', JSON.stringify(dataLine));

              if (!dataLine) continue;

              try {
                const event = JSON.parse(dataLine);
                console.log('[SSE DEBUG] Successfully parsed event from buffer:', event);

                if (event.step === 'complete' && event.tripId) {
                  // Found the completion event in remaining buffer - fetch trip data
                  console.log('[SSE DEBUG] *** COMPLETE EVENT FOUND IN BUFFER ***');
                  result = await this.getTripById(event.tripId);
                  console.log('[SSE DEBUG] Trip fetched:', result?.id ? 'SUCCESS' : 'FAILED');
                } else if (event.step === 'error') {
                  const error: any = new Error(event.message || 'Trip creation failed');
                  error.response = { status: event.status || 500, data: { message: event.message } };
                  throw error;
                }
              } catch (e: any) {
                console.log('[SSE DEBUG] Error parsing buffer event:', e.message);
                console.log('[SSE DEBUG] Failed to parse:', dataLine);
                if (e.response) throw e; // Re-throw structured errors
              }
            }
          }
        }

        console.log('[SSE DEBUG] === FINAL RESULT CHECK ===');
        console.log('[SSE DEBUG] Result exists?', result ? 'YES' : 'NO');
        console.log('[SSE DEBUG] SSE request started?', sseRequestStarted ? 'YES' : 'NO');

        // If no result after processing all data, but SSE started successfully,
        // it means the trip was created but we couldn't parse the complete event
        if (!result && sseRequestStarted) {
          console.log('[SSE DEBUG] No complete event found but SSE started, attempting to fetch recent trip');
          // Try to fetch the most recent trip as a fallback
          try {
            const trips = await this.getTrips({ sortBy: 'createdAt', order: 'DESC', limit: 1 });
            if (trips?.data && trips.data.length > 0) {
              const latestTrip = trips.data[0];
              const tripCreatedAt = new Date(latestTrip.createdAt).getTime();
              const now = Date.now();
              if (now - tripCreatedAt < 15000) { // Within 15 seconds
                console.log('[SSE DEBUG] Found recent trip, using as result');
                result = latestTrip;
              }
            }
          } catch (fetchError) {
            console.log('[SSE DEBUG] Failed to fetch recent trip:', fetchError);
          }
        }

        return result;
      } catch (error: any) {
        console.log('[SSE DEBUG] Caught error:', error.message, 'sseRequestStarted:', sseRequestStarted);
        if (error.name === 'AbortError') throw error;
        if (error.response) throw error;

        // ✅ FIX: If SSE request started (trip created), try to fetch the created trip with retry
        if (sseRequestStarted) {
          console.log('[SSE DEBUG] SSE request started, attempting retry to fetch created trip');
          // Retry logic: attempt up to 3 times with exponential backoff
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              // Wait before retry (0ms, 1000ms, 2000ms)
              if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }

              // Trip was created on server but stream failed - try to get the latest trip
              const trips = await this.getTrips({ sortBy: 'createdAt', order: 'DESC', limit: 1 });
              if (trips?.data && trips.data.length > 0) {
                const latestTrip = trips.data[0];
                // Check if trip was created very recently (within last 10 seconds)
                const tripCreatedAt = new Date(latestTrip.createdAt).getTime();
                const now = Date.now();
                if (now - tripCreatedAt < 10000) {
                  // This is likely the trip we just created
                  return latestTrip;
                }
              }

              // If we reach here, trip not found in recent trips
              if (attempt === 2) {
                // Last attempt failed - throw error with tripCreated flag
                const streamError: any = new Error('Trip created but stream interrupted - please check your trips list');
                streamError.tripCreated = true; // Flag to help UI show better message
                throw streamError;
              }
            } catch (fetchError: any) {
              // If this is the last attempt or if it's already a tripCreated error, throw
              if (attempt === 2 || fetchError.tripCreated) {
                if (fetchError.tripCreated) {
                  throw fetchError;
                }
                // Failed to fetch trips - throw original stream error
                const streamError: any = new Error('Trip creation in progress - check trips list');
                streamError.tripCreated = true;
                throw streamError;
              }
              // Otherwise, continue to next retry
            }
          }
        }

        // Only fallback if SSE request never reached server
        return this.createTrip(data);
      } finally {
        // Clear the active request tracker
        this.activeSseRequest = null;
      }
    })();

    return this.activeSseRequest;
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
    const isWeb = typeof document !== 'undefined';

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
      formData.append('photo', { uri, name: filename, type } as any);
    }

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
      }>;
      available: boolean;
    };
  }
}

export default new ApiService();
