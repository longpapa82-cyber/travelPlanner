import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { STORAGE_KEYS } from '../constants/config';
import apiService from '../services/api';
import { secureStorage } from '../utils/storage';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithKakao,
  OAuthResult,
} from '../services/oauth.service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithKakao: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (token) {
        // Token exists, get user profile
        const profile = await apiService.getProfile();
        setUser(profile);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response: AuthResponse = await apiService.login(email, password);

      // Store tokens
      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);

      setUser(response.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response: AuthResponse = await apiService.register(email, password, name);

      // Store tokens
      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);

      setUser(response.user);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const handleOAuthResult = async (result: OAuthResult | null) => {
    if (!result) {
      throw new Error('OAuth authentication failed');
    }

    // Store tokens
    await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.accessToken);
    await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, result.refreshToken);

    // Get user profile
    const profile = await apiService.getProfile();
    setUser(profile);
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithGoogle();
      await handleOAuthResult(result);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const loginWithApple = async () => {
    try {
      const result = await signInWithApple();
      await handleOAuthResult(result);
    } catch (error) {
      console.error('Apple login error:', error);
      throw error;
    }
  };

  const loginWithKakao = async () => {
    try {
      const result = await signInWithKakao();
      await handleOAuthResult(result);
    } catch (error) {
      console.error('Kakao login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear tokens
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    loginWithApple,
    loginWithKakao,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
