import axios, { AxiosInstance, AxiosError } from 'axios';
import * as Keychain from 'react-native-keychain';
import { API_URL, STORAGE_KEYS } from '../constants/config';

class ApiService {
  private api: AxiosInstance;

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

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const credentials = await Keychain.getGenericPassword({
            service: STORAGE_KEYS.AUTH_TOKEN,
          });

          if (credentials) {
            config.headers.Authorization = `Bearer ${credentials.password}`;
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
          // Token expired or invalid - clear storage
          await Keychain.resetGenericPassword({
            service: STORAGE_KEYS.AUTH_TOKEN,
          });
          // TODO: Navigate to login screen
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
    const response = await this.api.get('/users/me');
    return response.data;
  }

  // Trips Methods
  async createTrip(data: any) {
    const response = await this.api.post('/trips', data);
    return response.data;
  }

  async getTrips() {
    const response = await this.api.get('/trips');
    return response.data;
  }

  async getTripById(id: string) {
    const response = await this.api.get(`/trips/${id}`);
    return response.data;
  }
}

export default new ApiService();
