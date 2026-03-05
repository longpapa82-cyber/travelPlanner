export type Platform = 'web' | 'ios' | 'android';

/**
 * Detect platform from User-Agent string.
 * Mobile app UAs typically contain "Expo" or platform-specific markers.
 */
export function detectPlatform(ua: string | undefined): Platform {
  if (!ua) return 'web';

  const lower = ua.toLowerCase();

  // React Native / Expo apps include these markers
  if (lower.includes('expo') || lower.includes('react-native')) {
    if (lower.includes('android')) return 'android';
    if (
      lower.includes('ios') ||
      lower.includes('iphone') ||
      lower.includes('ipad')
    )
      return 'ios';
    // Default to iOS for ambiguous Expo UAs (more common in production)
    return 'ios';
  }

  // Native app webview markers
  if (lower.includes('dalvik') || lower.includes('okhttp')) return 'android';
  if (lower.includes('darwin') && !lower.includes('mac os')) return 'ios';

  return 'web';
}
