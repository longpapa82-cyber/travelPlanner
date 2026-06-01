# 프로젝트 현황 (2026-05-08)

## 현재 버전 상태

| 플랫폼 | 버전 | 상태 |
|--------|------|------|
| **Android** | versionCode 222 | 알파 트랙 등록 완료 |
| **iOS** | 1.0.0 (buildNumber 29) | **App Store 심사 대기 중** (B27 거절 → B29 재제출, 2026-05-09) |
| **Backend** | — | mytravel-planner.com 26차 배포 완료 |

## 최근 버전 이력

| 버전 | 날짜 | 핵심 수정 |
|------|------|-----------|
| **iOS B28** | 2026-05-08 | Apple 로그인 `jwt.verify is not a function` 버그 수정 → App Store 재제출 |
| **iOS B27** | 2026-05-07 | RevenueCat iOS 키 설정 → **App Store 심사 거절** (Guideline 2.1a, Apple 로그인 실패) |
| **Android 222** | 2026-05-08 | Android 스플래시 배경색 `#4A90D9` 수정 + iOS B13~B27 수정 반영 → 알파 트랙 |
| **iOS B27** | 2026-05-07 | RevenueCat iOS 키 설정 |
| **iOS 1.0.0 (B2~B26)** | 2026-05-04~07 | iOS 로그인 전면 수정, 스플래시, 헤더, DatePicker 등 다수 버그 수정 |
| **V220** | 2026-05-03 | OAuth CSRF nonce 보안 강화 + AsyncStorage refresh token 제거 + CSP unsafe-inline 제거 + 17개 언어 법적 문서 |
| V217 | 2026-05-02 | Kakao providerId 재발급 re-link + 17개 언어 kakaoCancelled + Apple cancel 오류 필터 |
| V215 | 2026-05-01 | ASO 최적화 + Production 전체 출시 (176개 국가) |
| V214 | 2026-04-30 | purchasePackage 직전 RC logIn 추가 → 월간 무한스피너 수정 |
| V213 | 2026-04-30 | phantom 구독: auto-reconcile 제거 + $deleted_at 마킹 |

## iOS B27 심사 거절 및 B28 수정 내역 (2026-05-08)

| 항목 | 내용 |
|------|------|
| **거절 사유** | Guideline 2.1(a) — "An internal error appeared when we tried to login with 3rd party login option" |
| **근본 원인** | `await import('jsonwebtoken')` 동적 임포트 시 ESM/CJS interop 버그 → `jwt.verify is not a function` |
| **수정** | `import * as jwt from 'jsonwebtoken'` 정적 임포트로 변경 + `createPublicKey` 동일하게 수정 |
| **백엔드 배포** | 26차 배포 완료 (2026-05-08) |
| **테스트** | 앱 재설치 후 Apple 로그인 OK 확인 |

## Android 업데이트 내역 (2026-05-08, versionCode 222)

| 항목 | 내용 |
|------|------|
| **스플래시 배경색** | `app.config.js` android.splash.backgroundColor `#4A90D9` 추가 (기존 흰색 → 파란색) |
| **iOS 수정사항 반영** | `androidUpdatePlan.md` 기준 자동 반영 항목 포함 |
| **알파 트랙 제출** | Play Store 알파 트랙 등록 완료 |

## SNS 로그인 상태

| Provider | Android | iOS | 비고 |
|----------|---------|-----|------|
| Google | ✅ 프로덕션 | ✅ 구현 완료 | |
| Kakao | ✅ 프로덕션 | ✅ 번들 ID 등록 | 이메일/닉네임/프로필 |
| Apple | N/A | ✅ 네이티브 SDK | expo-apple-authentication |

## 백엔드 배포 이력

| 차수 | 내용 |
|------|------|
| 26차 | Apple 로그인 jwt.verify 버그 수정 (2026-05-08) |
| 25차 | AdSense 영문 가이드 5개 + sitemap 추가 |
| 24차 | 비용 최적화 59% 절감 |
| 23차 | API Usage 로깅 4개 추가 |

## 다음 작업

1. iOS B28 App Store 심사 결과 대기 (longpapa82@gmail.com)
2. Android versionCode 222 알파 테스트 검증
3. Android 프로덕션 제출 (알파 검증 완료 후)

## 후속 작업 (낮은 우선순위)

1. **Android edge-to-edge 마이그레이션**: StatusBar API 완전 대응
2. 회원 탈퇴 모달 하단 여백 UX 개선
3. 무중단 배포 체계 (nginx blue-green)
4. npm audit HIGH 7건 (mjml 체인, path-to-regexp, picomatch)
5. CSP style-src unsafe-inline → nonce 기반 전환
6. console.log 정리 (~210건 → `__DEV__` 가드)
7. **Sentry 제거**: DSN 미설정, 번들 크기 낭비
