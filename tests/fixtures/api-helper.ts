import { API_URL, TEST_PASSWORD, IS_PROD } from '../helpers/constants';

interface UserCredentials {
  email: string;
  name: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  text: string;
}

export class ApiHelper {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Core JSON request with auto-unwrap of response envelope.
   * The backend wraps all successful responses as { data, meta }.
   * This method returns the inner `data` payload directly.
   */
  private async request(
    method: string,
    path: string,
    body?: any,
    token?: string,
    retries: number = IS_PROD ? 6 : 3,
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Production rate limits are stricter (5 login/60s, 3 register/60s)
    const maxBackoffMs = IS_PROD ? 65_000 : 15_000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Retry on 429 (Too Many Requests) with exponential backoff
      if (res.status === 429 && attempt < retries) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt), maxBackoffMs);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
      }

      if (res.status === 204) return null;

      const json = await res.json().catch(() => null);

      // Auto-unwrap response envelope { data, meta }
      if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
        return json.data;
      }
      return json;
    }

    throw new Error(`API ${method} ${path} failed: max retries exceeded (429)`);
  }

  /**
   * Raw request returning full response details (status, headers, body text).
   * Does NOT auto-unwrap the envelope — used for response format verification.
   */
  async rawRequest(
    method: string,
    path: string,
    options?: {
      body?: any;
      token?: string;
      headers?: Record<string, string>;
    },
  ): Promise<RawResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
      ...(options?.headers || {}),
    };
    if (options?.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: res.status, headers: responseHeaders, body, text };
  }

  /**
   * Multipart form-data request for file uploads.
   * Returns the unwrapped response data.
   */
  private async uploadRequest(
    path: string,
    formData: FormData,
    token?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Accept-Language': 'ko',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Do NOT set Content-Type — fetch sets multipart boundary automatically

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API POST ${path} failed: ${res.status} ${text}`);
    }

    const json = await res.json().catch(() => null);
    if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
      return json.data;
    }
    return json;
  }

  // ============================================
  // Auth
  // ============================================

  async register(user: UserCredentials): Promise<any> {
    try {
      return await this.request('POST', '/auth/register', {
        email: user.email,
        name: user.name,
        password: user.password,
      });
    } catch (e: any) {
      // 409 = already exists, that's fine
      if (e.message.includes('409')) return null;
      throw e;
    }
  }

  async login(email: string, password: string = TEST_PASSWORD): Promise<AuthTokens> {
    const data = await this.request('POST', '/auth/login', { email, password });
    return {
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
    };
  }

  /**
   * Login that returns raw response data, preserving 2FA fields like
   * requiresTwoFactor and tempToken.
   */
  async loginRaw(email: string, password: string = TEST_PASSWORD): Promise<any> {
    return this.request('POST', '/auth/login', { email, password });
  }

  async getMe(token: string): Promise<any> {
    return this.request('GET', '/auth/me', undefined, token);
  }

  // ============================================
  // Two-Factor Authentication
  // ============================================

  async setup2FA(token: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    return this.request('POST', '/auth/2fa/setup', undefined, token);
  }

  async enable2FA(token: string, code: string): Promise<{ backupCodes: string[] }> {
    return this.request('POST', '/auth/2fa/enable', { code }, token);
  }

  async verify2FA(tempToken: string, code: string): Promise<any> {
    return this.request('POST', '/auth/2fa/verify', { code }, tempToken);
  }

  async disable2FA(token: string, code: string): Promise<any> {
    return this.request('POST', '/auth/2fa/disable', { code }, token);
  }

  async regenerateBackupCodes(
    token: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    return this.request('POST', '/auth/2fa/regenerate-backup-codes', { code }, token);
  }

  // ============================================
  // Notifications
  // ============================================

  async getNotifications(
    token: string,
    params?: { page?: number; limit?: number },
  ): Promise<any> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.request('GET', `/notifications${query ? '?' + query : ''}`, undefined, token);
  }

  async getUnreadCount(token: string): Promise<{ count: number }> {
    return this.request('GET', '/notifications/unread-count', undefined, token);
  }

  async markNotificationRead(token: string, id: string): Promise<void> {
    await this.request('PATCH', `/notifications/${id}/read`, undefined, token);
  }

  async markAllNotificationsRead(token: string): Promise<void> {
    await this.request('PATCH', '/notifications/read-all', undefined, token);
  }

  async deleteNotification(token: string, id: string): Promise<void> {
    await this.request('DELETE', `/notifications/${id}`, undefined, token);
  }

  async deleteAllNotifications(token: string): Promise<void> {
    await this.request('DELETE', '/notifications', undefined, token);
  }

  // ============================================
  // Image Upload
  // ============================================

  async uploadPhoto(
    token: string,
    imageBuffer: Buffer,
    filename: string,
  ): Promise<{ url: string; thumbnailUrl?: string }> {
    // Must set MIME type on Blob — multer's fileFilter checks file.mimetype
    const mimeType = filename.endsWith('.png') ? 'image/png'
      : filename.endsWith('.webp') ? 'image/webp'
      : filename.endsWith('.gif') ? 'image/gif'
      : 'image/jpeg';
    const blob = new Blob([imageBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append('photo', blob, filename);
    return this.uploadRequest('/trips/upload/photo', formData, token);
  }

  /**
   * Raw upload returning full response (status, headers, body) for
   * validation tests (cache headers, error shapes, etc.)
   */
  async uploadPhotoRaw(
    imageBuffer: Buffer | null,
    filename: string,
    token?: string,
  ): Promise<RawResponse> {
    const headers: Record<string, string> = {
      'Accept-Language': 'ko',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    if (imageBuffer) {
      const mimeType = filename.endsWith('.png') ? 'image/png'
        : filename.endsWith('.webp') ? 'image/webp'
        : filename.endsWith('.gif') ? 'image/gif'
        : 'image/jpeg';
      const blob = new Blob([imageBuffer], { type: mimeType });
      formData.append('photo', blob, filename);
    }

    const res = await fetch(`${this.baseUrl}/trips/upload/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: res.status, headers: responseHeaders, body, text };
  }

  // ============================================
  // Trips
  // ============================================

  async createTrip(
    token: string,
    data: {
      destination: string;
      startDate: string;
      endDate: string;
      numberOfTravelers?: number;
      description?: string;
    }
  ): Promise<any> {
    return this.request('POST', '/trips', {
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      numberOfTravelers: data.numberOfTravelers || 2,
      description: data.description || '',
    }, token);
  }

  async getTrips(token: string): Promise<any[]> {
    const data = await this.request('GET', '/trips', undefined, token);
    return Array.isArray(data) ? data : data?.trips || data?.data || [];
  }

  async getTrip(token: string, tripId: string): Promise<any> {
    return this.request('GET', `/trips/${tripId}`, undefined, token);
  }

  async updateTrip(token: string, tripId: string, data: any): Promise<any> {
    return this.request('PATCH', `/trips/${tripId}`, data, token);
  }

  async deleteTrip(token: string, tripId: string): Promise<void> {
    await this.request('DELETE', `/trips/${tripId}`, undefined, token);
  }

  async duplicateTrip(token: string, tripId: string): Promise<any> {
    return this.request('POST', `/trips/${tripId}/duplicate`, undefined, token);
  }

  // ============================================
  // iCal Export
  // ============================================

  async exportIcal(token: string, tripId: string): Promise<RawResponse> {
    const headers: Record<string, string> = {
      'Accept-Language': 'ko',
      'Authorization': `Bearer ${token}`,
    };

    const res = await fetch(`${this.baseUrl}/trips/${tripId}/export/ical`, {
      method: 'GET',
      headers,
    });

    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: res.status, headers: responseHeaders, body: text, text };
  }

  // ============================================
  // Activities
  // ============================================

  async addActivity(
    token: string,
    tripId: string,
    itineraryId: string,
    activity: any
  ): Promise<any> {
    return this.request(
      'POST',
      `/trips/${tripId}/itineraries/${itineraryId}/activities`,
      activity,
      token
    );
  }

  async updateActivity(
    token: string,
    tripId: string,
    itineraryId: string,
    index: number,
    data: any
  ): Promise<any> {
    return this.request(
      'PATCH',
      `/trips/${tripId}/itineraries/${itineraryId}/activities/${index}`,
      data,
      token
    );
  }

  async deleteActivity(
    token: string,
    tripId: string,
    itineraryId: string,
    index: number
  ): Promise<void> {
    await this.request(
      'DELETE',
      `/trips/${tripId}/itineraries/${itineraryId}/activities/${index}`,
      undefined,
      token
    );
  }

  // ============================================
  // Sharing & Collaboration
  // ============================================

  async generateShareLink(
    token: string,
    tripId: string,
    expiresInDays?: number
  ): Promise<any> {
    return this.request(
      'POST',
      `/trips/${tripId}/share`,
      expiresInDays ? { expiresInDays } : undefined,
      token
    );
  }

  async addCollaborator(
    token: string,
    tripId: string,
    email: string,
    role: 'viewer' | 'editor' = 'viewer'
  ): Promise<any> {
    return this.request(
      'POST',
      `/trips/${tripId}/collaborators`,
      { email, role },
      token
    );
  }

  async getCollaborators(token: string, tripId: string): Promise<any[]> {
    const data = await this.request('GET', `/trips/${tripId}/collaborators`, undefined, token);
    return Array.isArray(data) ? data : [];
  }

  async removeCollaborator(token: string, tripId: string, collabId: string): Promise<void> {
    await this.request('DELETE', `/trips/${tripId}/collaborators/${collabId}`, undefined, token);
  }

  // ============================================
  // Users
  // ============================================

  async deleteUser(token: string): Promise<void> {
    await this.request('DELETE', '/users/me', undefined, token);
  }

  async changePassword(
    token: string,
    currentPassword: string,
    newPassword: string
  ): Promise<any> {
    return this.request(
      'POST',
      '/users/me/password',
      { currentPassword, newPassword },
      token
    );
  }
}
