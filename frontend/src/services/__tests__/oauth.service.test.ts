jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `travelplanner://${path}`),
  parse: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import {
  signInWithOAuth,
  signInWithGoogle,
  signInWithApple,
  signInWithKakao,
} from '../oauth.service';

describe('oauth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  // ── signInWithOAuth (mobile) ──

  describe('signInWithOAuth (mobile)', () => {
    it('should open auth session and return code on success', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth/callback?code=abc123&state=mock-uuid-1234',
      });
      (Linking.parse as jest.Mock).mockReturnValue({
        queryParams: { code: 'abc123', state: 'mock-uuid-1234' },
      });

      const result = await signInWithOAuth('google');

      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
      expect(result).toEqual({ code: 'abc123' });
    });

    it('should include provider in auth URL', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      await signInWithOAuth('kakao');

      const authUrl = (WebBrowser.openAuthSessionAsync as jest.Mock).mock
        .calls[0][0] as string;
      expect(authUrl).toContain('/auth/kakao');
    });

    it('should include state parameter in auth URL', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      await signInWithOAuth('google');

      const authUrl = (WebBrowser.openAuthSessionAsync as jest.Mock).mock
        .calls[0][0] as string;
      expect(authUrl).toContain('state=mock-uuid-1234');
    });

    it('should return null when auth cancelled', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await signInWithOAuth('google');

      expect(result).toBeNull();
    });

    it('should return null when auth dismissed', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'dismiss',
      });

      const result = await signInWithOAuth('kakao');

      expect(result).toBeNull();
    });

    it('should return null on CSRF state mismatch', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth/callback?code=abc&state=wrong-state',
      });
      (Linking.parse as jest.Mock).mockReturnValue({
        queryParams: { code: 'abc', state: 'wrong-state' },
      });

      const result = await signInWithOAuth('google');

      expect(result).toBeNull();
    });

    it('should return null when no code in callback URL', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth/callback?error=access_denied',
      });
      (Linking.parse as jest.Mock).mockReturnValue({
        queryParams: { error: 'access_denied' },
      });

      const result = await signInWithOAuth('google');

      expect(result).toBeNull();
    });

    it('should throw on WebBrowser error', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockRejectedValue(
        new Error('Browser error'),
      );

      await expect(signInWithOAuth('google')).rejects.toThrow('Browser error');
    });
  });

  // ── Provider-specific functions ──

  describe('signInWithGoogle', () => {
    it('should call signInWithOAuth with google provider', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      await signInWithGoogle();

      const url = (WebBrowser.openAuthSessionAsync as jest.Mock).mock
        .calls[0][0] as string;
      expect(url).toContain('/auth/google');
    });
  });

  describe('signInWithApple', () => {
    it('should work on iOS', async () => {
      (Platform as any).OS = 'ios';
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await signInWithApple();

      expect(result).toBeNull();
    });

    it('should throw on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';

      await expect(signInWithApple()).rejects.toThrow(
        'Apple Sign-In is only available on iOS',
      );
    });
  });

  describe('signInWithKakao', () => {
    it('should call signInWithOAuth with kakao provider', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      await signInWithKakao();

      const url = (WebBrowser.openAuthSessionAsync as jest.Mock).mock
        .calls[0][0] as string;
      expect(url).toContain('/auth/kakao');
    });
  });
});
