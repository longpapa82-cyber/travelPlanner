/**
 * WebAppRedirectScreen — V115 (V114-1 fix)
 *
 * Expo web 빌드가 www.mytravel-planner.com에서 서빙될 때, 웹 사용자가
 * 로그인/가입/AI 생성 등 앱 기능을 그대로 사용할 수 있던 것이 V112~V114
 * 알파 리포트의 핵심 CRITICAL 이슈였다. 정책상 "앱에서만 서비스 제공"이
 * 원칙이므로 웹 빌드는 "앱 다운로드 안내" 한 장으로 대체한다.
 *
 * 이 화면이 렌더링되는 시점:
 *  - Platform.OS === 'web' 이고
 *  - OAuth callback 경로(/auth/callback)가 아니며
 *  - nginx가 index.html로 fallback한 모든 경로(SPA catch-all)
 *
 * 정적 SEO 페이지(/landing.html, /guides/*, /blog/*, /privacy.html,
 * /terms.html 등)는 nginx에서 직접 서빙되므로 이 화면을 거치지 않는다.
 * App Links 경로(/app/reset, /app/verify)는 앱이 설치돼 있으면 인텐트로
 * 앱이 열리고, 미설치 시 여기로 와서 Play Store 다운로드로 유도된다.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Image } from 'react-native';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner';
const APP_STORE_URL = 'https://apps.apple.com/app/mytravel/id0000000000'; // placeholder

function isResetOrVerifyPath(): { kind: 'reset' | 'verify' | null; token: string | null } {
  if (typeof window === 'undefined') return { kind: null, token: null };
  const { pathname, searchParams } = new URL(window.location.href);
  const token = searchParams.get('token');
  if (pathname.startsWith('/app/reset') || pathname.startsWith('/reset-password')) {
    return { kind: 'reset', token };
  }
  if (pathname.startsWith('/app/verify') || pathname.startsWith('/verify-email')) {
    return { kind: 'verify', token };
  }
  return { kind: null, token: null };
}

const WebAppRedirectScreen: React.FC = () => {
  const { kind } = isResetOrVerifyPath();

  const headline =
    kind === 'reset'
      ? '비밀번호 재설정은 앱에서 진행됩니다'
      : kind === 'verify'
      ? '이메일 인증은 앱에서 진행됩니다'
      : 'MyTravel은 모바일 앱에서 이용하실 수 있습니다';

  const subline =
    kind === 'reset'
      ? 'MyTravel 앱이 설치되어 있다면 이 링크가 앱으로 열리지 않을 때 아래 버튼으로 앱을 실행해 주세요. 앱이 없다면 Play 스토어에서 설치 후 다시 시도해 주세요.'
      : kind === 'verify'
      ? '이메일 인증 링크는 앱에서 안전하게 처리됩니다. 아래 버튼으로 앱을 실행하거나 Play 스토어에서 설치해 주세요.'
      : '여행 계획, 일정 관리, AI 자동 생성 등 모든 기능은 전용 모바일 앱에서 제공됩니다. 아래 버튼으로 앱을 받아보세요.';

  const openStore = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {
      if (typeof window !== 'undefined') window.location.href = url;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MyTravel</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={openStore} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Play 스토어에서 앱 받기</Text>
        </TouchableOpacity>

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => {
            if (typeof window !== 'undefined') window.location.href = '/privacy.html';
          }}>
            <Text style={styles.legalText}>개인정보 처리방침</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => {
            if (typeof window !== 'undefined') window.location.href = '/terms.html';
          }}>
            <Text style={styles.legalText}>이용약관</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  card: {
    maxWidth: 520,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 30,
  },
  subline: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  legalText: {
    fontSize: 13,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: '#CBD5E1',
  },
});

export default WebAppRedirectScreen;
