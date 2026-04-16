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

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, TextInput, ActivityIndicator } from 'react-native';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner';
const APP_STORE_URL = 'https://apps.apple.com/app/mytravel/id0000000000'; // placeholder
const API_BASE = 'https://mytravel-planner.com/api';

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

const WebResetPasswordForm: React.FC<{ token: string }> = ({ token }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('비밀번호는 8자 이상이어야 합니다.');
      setResult('error');
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setErrorMsg('비밀번호에 영문자와 숫자가 각각 하나 이상 포함되어야 합니다.');
      setResult('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      setResult('error');
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || '비밀번호 재설정에 실패했습니다.');
      }
      setResult('success');
    } catch (e: any) {
      setErrorMsg(e.message || '비밀번호 재설정에 실패했습니다.');
      setResult('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>MyTravel</Text>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.headline}>비밀번호가 변경되었습니다</Text>
        <Text style={styles.subline}>새 비밀번호로 앱에서 로그인해 주세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>MyTravel</Text>
      <Text style={styles.headline}>새 비밀번호 설정</Text>
      <Text style={styles.subline}>새로운 비밀번호를 입력해 주세요.</Text>

      {result === 'error' && (
        <Text style={styles.errorText}>{errorMsg}</Text>
      )}

      <TextInput
        style={styles.webInput}
        placeholder="새 비밀번호 (영문+숫자 포함 8자 이상)"
        secureTextEntry
        value={newPassword}
        onChangeText={(v) => { setNewPassword(v); setResult(null); }}
        editable={!isLoading}
        autoComplete="new-password"
      />
      <TextInput
        style={styles.webInput}
        placeholder="비밀번호 확인"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setResult(null); }}
        editable={!isLoading}
        autoComplete="new-password"
      />

      <TouchableOpacity
        style={[styles.primaryBtn, isLoading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>비밀번호 변경</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const WebAppRedirectScreen: React.FC = () => {
  const { kind, token } = isResetOrVerifyPath();

  if (kind === 'reset' && token) {
    return (
      <View style={styles.container}>
        <WebResetPasswordForm token={token} />
      </View>
    );
  }

  const headline =
    kind === 'verify'
      ? '이메일 인증은 앱에서 진행됩니다'
      : 'MyTravel은 모바일 앱에서 이용하실 수 있습니다';

  const subline =
    kind === 'verify'
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
  webInput: {
    width: '100%',
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  successIcon: {
    fontSize: 48,
    color: '#22C55E',
    marginBottom: 16,
  },
});

export default WebAppRedirectScreen;
