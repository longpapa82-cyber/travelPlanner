import { API_URL, TEST_PASSWORD } from '../helpers/constants';

interface UserCredentials {
  email: string;
  name: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiHelper {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request(
    method: string,
    path: string,
    body?: any,
    token?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
    }

    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

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

  async getMe(token: string): Promise<any> {
    return this.request('GET', '/auth/me', undefined, token);
  }

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
