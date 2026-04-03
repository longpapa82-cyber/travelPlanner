import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';

interface SmartAppBannerProps {
  variant?: 'A' | 'B' | 'C'; // A/B 테스트 변형
}

const BANNER_VARIANTS = {
  A: '여행 계획, 더 쉽고 빠르게',
  B: 'AI가 만드는 완벽한 여행',
  C: '5초 만에 여행 일정 완성',
};

const SmartAppBanner: React.FC<SmartAppBannerProps> = ({ variant = 'A' }) => {
  const [dismissed, setDismissed] = useState(false);

  // 웹 전용 - React Native Web에서만 작동
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setDismissed(true); // 앱에서는 배너 숨김
      return;
    }

    // 1일 1회만 표시
    const lastDismissed = localStorage.getItem('banner_dismissed');
    const today = new Date().toDateString();
    if (lastDismissed === today) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    if (Platform.OS !== 'web') return;

    const today = new Date().toDateString();
    localStorage.setItem('banner_dismissed', today);
    setDismissed(true);

    // Analytics 이벤트
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'banner_dismiss', {
        variant: variant,
        page: window.location.pathname,
      });
    }
  };

  const handleInstall = () => {
    if (Platform.OS !== 'web') return;

    // Deep link 파라미터 포함
    const deepLink = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    const playStoreUrl = `https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner&referrer=${deepLink}`;

    // Analytics 이벤트
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'banner_click', {
        variant: variant,
        page: window.location.pathname,
      });
    }

    // Play Store 열기
    Linking.openURL(playStoreUrl);
  };

  if (dismissed || Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* 앱 아이콘 - 실제로는 Image 컴포넌트 사용 */}
          <View style={styles.appIcon}>
            <Text style={styles.iconText}>🎯</Text>
          </View>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.appName}>myTravel</Text>
          <Text style={styles.tagline}>{BANNER_VARIANTS[variant]}</Text>
          <Text style={styles.rating}>⭐⭐⭐⭐⭐ 4.8 (12K)</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.downloadButton} onPress={handleInstall}>
          <Text style={styles.downloadText}>무료 다운로드</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4A90D9',
    // backgroundImage: 'linear-gradient(135deg, #4A90D9 0%, #5BA3E8 100%)' as any,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  appName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  tagline: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 2,
  },
  rating: {
    color: 'white',
    fontSize: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  downloadText: {
    color: '#4A90D9',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SmartAppBanner;
