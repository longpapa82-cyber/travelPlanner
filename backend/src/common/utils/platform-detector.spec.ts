import { detectPlatform } from './platform-detector';

describe('detectPlatform', () => {
  it('returns "web" for undefined UA', () => {
    expect(detectPlatform(undefined)).toBe('web');
  });

  it('returns "web" for empty string', () => {
    expect(detectPlatform('')).toBe('web');
  });

  it('returns "web" for standard browser UA', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('web');
  });

  it('returns "web" for Mac OS (not iOS)', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('web');
  });

  it('returns "android" for Expo Android', () => {
    expect(
      detectPlatform('Expo/2.32.13 CFNetwork/1568.100.1 Android/14'),
    ).toBe('android');
  });

  it('returns "ios" for Expo iPhone', () => {
    expect(
      detectPlatform('Expo/2.32.13 CFNetwork/1568.100.1 iPhone'),
    ).toBe('ios');
  });

  it('returns "ios" for Expo iPad', () => {
    expect(
      detectPlatform('Expo/2.32.13 CFNetwork/1568.100.1 iPad'),
    ).toBe('ios');
  });

  it('returns "ios" for ambiguous Expo UA (no platform marker)', () => {
    expect(detectPlatform('Expo/2.32.13')).toBe('ios');
  });

  it('returns "android" for React Native Android', () => {
    expect(
      detectPlatform('react-native Android/13'),
    ).toBe('android');
  });

  it('returns "android" for Dalvik UA', () => {
    expect(
      detectPlatform('Dalvik/2.1.0 (Linux; U; Android 14; Pixel 7 Build/UQ1A.240205.002)'),
    ).toBe('android');
  });

  it('returns "android" for OkHttp UA', () => {
    expect(detectPlatform('okhttp/4.12.0')).toBe('android');
  });

  it('returns "ios" for Darwin non-Mac UA', () => {
    expect(
      detectPlatform('CFNetwork/1485 Darwin/23.1.0'),
    ).toBe('ios');
  });

  it('returns "web" for Darwin with Mac OS (desktop Safari)', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15 Darwin',
      ),
    ).toBe('web');
  });
});
