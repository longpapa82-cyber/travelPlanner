---
template: plan
version: 1.2
description: MyTravel iOS TestFlight 빌드 5 전체 검수 계획 — 기능/보안/iOS 특화/합격 기준
---

# iOS 전체 검수 Planning Document (빌드 5)

> **Summary**: TestFlight 1.0.0 (5)에서 수정된 5개 버그를 포함한 iOS 전체 기능·보안·플랫폼 검수 계획을 수립한다. Android(versionCode 220) 및 웹 서비스에 영향 없이 iOS 전용 합격 판정을 목표로 한다.
>
> **Project**: MyTravel (Expo SDK 54, React Native, New Architecture)
> **Version**: 1.0.0 (5) — TestFlight 빌드 5
> **Author**: Product Manager
> **Date**: 2026-05-04
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

TestFlight 1.0.0 (5)는 빌드 4에서 발견된 5개 iOS 버그를 수정한 빌드이다.
이 플랜은 수정된 버그의 회귀 여부 확인을 포함하여 App Store 제출 전 iOS 품질 게이트를
통과하기 위한 전체 검수 범위와 절차를 정의한다.

수정 완료된 버그 (빌드 5 기준):
- P0: Google Sign-In 크래시 → lazy require를 top-level import로 변경
- P1: 탭바 Safe Area 누락 → useSafeAreaInsets 적용
- P1: 키보드가 입력창 가림 → KeyboardAvoidingView offset 수정
- P1: 날짜 선택기 렌더링 불가 → height: 200→216, lazy require 제거
- P2: 스플래시 색상 불일치 → #ffffff → #FAFAF9

### 1.2 Background

- **Android**: versionCode 220 프로덕션 운영 중 (177개 국가) — 영향 없어야 함
- **웹**: https://mytravel-planner.com 운영 중 — 영향 없어야 함
- **iOS**: TestFlight 내부 테스트 단계, App Store 제출 직전
- **핵심 제약**: 불변식 45개 (`docs/invariants/README.md`) 준수 확인 필수
- **플랫폼**: Expo SDK 54, New Architecture(newArchEnabled: true), React Navigation

### 1.3 Related Documents

- 버그수정 플랜: `docs/01-plan/features/ios-testflight-bugfix.plan.md`
- 불변식 전체: `docs/invariants/README.md`
- 배포 절차: `docs/operations/deploy.md`
- Android QA 마스터 플랜: `docs/qa-master-plan.md`

---

## 2. Scope

### 2.1 In Scope

- [x] 수정된 5개 버그 회귀 검증 (핵심 목적)
- [x] 인증 플로우 전체: Apple, Google, Kakao, 이메일/비밀번호
- [x] 핵심 기능 플로우: 여행 생성(AI), 일정 관리, 장소 추가, 협업, 알림
- [x] 결제 플로우: RevenueCat IAP, 구독 상태, 프리미엄 기능 잠금/해제
- [x] 광고 플로우: 배너, 전면, 보상형, 앱 오픈 (AdMob)
- [x] iOS 특화 검수: Safe Area, 키보드, 다크모드, 접근성
- [x] 보안 점검: 토큰 저장, API 통신, 개인정보 처리
- [x] 앱 스토어 가이드라인 준수: Sign in with Apple (Guideline 4.8), 개인정보 (Guideline 5.1.1)
- [x] i18n: 한국어/영어 최소 2개 언어 검증 (17개 언어 중)
- [x] Android 회귀 미발생 확인

### 2.2 Out of Scope

- Android 전용 기능 검수 (별도 QA)
- 웹 서비스 기능 검수
- 새로운 기능 추가 검증
- 백엔드 부하 테스트
- Playwright 자동화 E2E (TestFlight 환경 제약)

---

## 3. 검수 레이어 구조

검수는 4개 레이어로 구성되며, 각 레이어는 전 레이어 통과를 전제로 진행한다.

```
Layer 1: 버그수정 회귀 검증 (P0 → P1 → P2 순)
    ↓ PASS 후
Layer 2: 핵심 기능 플로우 검증
    ↓ PASS 후
Layer 3: iOS 특화 + 보안 점검
    ↓ PASS 후
Layer 4: App Store 가이드라인 준수 검증 (Go/No-Go 판정)
```

---

## 4. Layer 1: 버그수정 회귀 검증

### 우선순위 및 진행 순서

이 레이어는 다른 레이어보다 먼저 수행한다. P0 버그가 재현되면 즉시 중단하고 재빌드한다.

---

### L1-01. Google Sign-In 크래시 회귀 (P0)

**수정 내용**: lazy require → top-level import

**검증 환경**: 실기기 필수 (Simulator는 Google Sign-In 제한 있음)

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-001 | 로그인 화면에서 "Google로 시작하기" 버튼 탭 | 크래시 없이 Google 인증 화면 진입 | P0 블로커 |
| T-002 | Google 계정 선택 후 인증 완료 | 앱 메인 화면 진입 | Must |
| T-003 | Google 로그인 취소 후 앱 상태 | 로그인 화면 복귀, 크래시 없음 | Must |
| T-004 | Cold start 후 Google Sign-In 재시도 | 동일하게 정상 동작 | Must |
| T-005 | 이미 Google 로그인 상태에서 앱 재실행 | 자동 로그인 또는 메인 화면 진입 | Should |

**진단 체크**:
- [ ] Xcode Console에서 NSException/Fatal Signal 없음 확인
- [ ] GoogleService-Info.plist 번들 포함 확인 (Xcode → Bundle Contents)
- [ ] Sentry/Crashlytics 신규 크래시 리포트 0건

---

### L1-02. 탭바 Safe Area 회귀 (P1)

**수정 내용**: useSafeAreaInsets 적용

**검증 환경**: iPhone 14 이상 (홈 인디케이터 있는 기종) 필수

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-006 | 홈 탭 — 탭바 버튼과 홈 인디케이터 영역 확인 | 탭바 버튼이 홈 인디케이터 위에 위치 | Must |
| T-007 | 탐색/여행/프로필 탭 전환 | 탭바 높이 일관성 유지 | Must |
| T-008 | 세로 → 가로 방향 전환 (지원 시) | Safe Area 재계산, 겹침 없음 | Should |
| T-009 | iPhone SE (홈 버튼 있는 기종) | 탭바 정상 표시 | Should |

---

### L1-03. 키보드 가림 회귀 (P1)

**수정 내용**: KeyboardAvoidingView offset 수정

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-010 | 로그인 화면 — 이메일 필드 탭 | 키보드 출현 시 이메일 필드 가리지 않음 | Must |
| T-011 | 로그인 화면 — 비밀번호 필드 탭 | 키보드 출현 시 비밀번호 필드 가리지 않음 | Must |
| T-012 | 회원가입 화면 — 하단 필드 탭 | 키보드 출현 시 필드 가리지 않음 | Must |
| T-013 | 여행 생성 폼 — 텍스트 입력 필드 | 키보드 출현 시 입력창 보임 | Must |
| T-014 | 키보드 닫기 후 레이아웃 | 원래 위치로 복귀, 잔여 여백 없음 | Should |
| T-015 | 소프트 키보드 열린 상태에서 스크롤 | 입력 필드 접근 가능 | Should |

**불변식 준수 확인**:
- [ ] `behavior="height"` 코드 없음 확인 (`grep -r 'behavior.*height' frontend/src`)

---

### L1-04. 날짜 선택기 회귀 (P1)

**수정 내용**: height: 200→216, lazy require 제거

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-016 | 여행 생성 — 출발일 선택 버튼 탭 | 날짜 선택 UI 정상 렌더링 | Must |
| T-017 | 여행 생성 — 귀국일 선택 버튼 탭 | 날짜 선택 UI 정상 렌더링 | Must |
| T-018 | 날짜 선택 후 확인 | 선택한 날짜 필드에 반영 | Must |
| T-019 | 날짜 선택 취소 | 이전 값 유지 | Must |
| T-020 | 다크모드에서 날짜 선택기 | 텍스트/배경 색상 대비 정상 | Should |
| T-021 | 출발일 이후만 귀국일 선택 가능 여부 | 유효성 검사 정상 동작 | Should |

---

### L1-05. 스플래시 색상 회귀 (P2)

**수정 내용**: #ffffff → #FAFAF9

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-022 | Cold start 시 스플래시 화면 | #FAFAF9 배경색, 깜빡임 없음 | Should |
| T-023 | 백그라운드에서 포그라운드 복귀 | 색상 불일치 잔상 없음 | Could |

---

## 5. Layer 2: 핵심 기능 플로우 검증

### L2-A. 인증 플로우

#### A1. Apple Sign-In

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-030 | "Apple로 시작하기" 탭 | Face ID 인증 또는 Apple ID 비밀번호 요청 | Must |
| T-031 | Apple 인증 완료 | 메인 화면 진입, 사용자 이름 표시 | Must |
| T-032 | Apple 로그인 취소 | 로그인 화면 복귀 | Must |
| T-033 | 이미 Apple 로그인 계정 재로그인 | 기존 계정 연결, 데이터 유지 | Must |
| T-034 | 계정 삭제 요청 (Guideline 5.1.1) | Apple token revoke 후 계정 삭제 | P0 (스토어 가이드라인) |

**App Store Guideline 4.8 준수**:
- [ ] Apple Sign-In이 소셜 로그인 옵션 중 하나로 제공됨 확인
- [ ] Apple Sign-In이 다른 소셜 로그인보다 동등하게 표시됨 확인

#### A2. Google Sign-In

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-035 | Google 로그인 성공 (L1-01 연계) | 메인 화면 진입 | Must |
| T-036 | Google 계정 전환 시나리오 | 새 계정으로 정상 로그인 | Should |

#### A3. Kakao Sign-In

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-040 | "카카오로 시작하기" 탭 | 카카오 인증 화면 진입 | Must |
| T-041 | 카카오 인증 완료 | 메인 화면 진입 | Must |
| T-042 | 카카오 앱 없는 경우 | 웹 폴백 또는 안내 메시지 | Should |

#### A4. 이메일/비밀번호

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-045 | 이메일 + 비밀번호 로그인 | 메인 화면 진입 | Must |
| T-046 | 잘못된 비밀번호 입력 | 오류 메시지 표시, 크래시 없음 | Must |
| T-047 | 비밀번호 재설정 이메일 요청 | 이메일 발송 확인 메시지 | Must |
| T-048 | 회원가입 → 이메일 인증 플로우 | 인증 메일 수신 후 가입 완료 | Must |

#### A5. 로그아웃 / 세션 관리

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-050 | 프로필 → 로그아웃 | 로그인 화면 복귀, RC logOut 호출됨 | P0 (불변식) |
| T-051 | 로그아웃 후 재로그인 | 새 세션 정상 시작 | Must |
| T-052 | 앱 백그라운드 30분 후 복귀 | 세션 유효 또는 재로그인 안내 | Should |
| T-053 | 토큰 만료 시나리오 | 자동 갱신 또는 재로그인 안내 | Must |

---

### L2-B. 여행 생성 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-060 | 새 여행 생성 버튼 탭 | 여행 생성 폼 진입 | Must |
| T-061 | 목적지 입력 — 장소 자동완성 | 자동완성 목록 표시, 탭으로 선택 | Must |
| T-062 | 출발일/귀국일 선택 | 날짜 선택기 정상 동작 (L1-04 연계) | Must |
| T-063 | AI 일정 생성 요청 | 로딩 표시 → 일정 생성 완료 | Must |
| T-064 | AI 생성 중 네트워크 오류 | 오류 메시지 + 재시도 버튼 | Must |
| T-065 | 일정 생성 완료 → 여행 상세 진입 | 생성된 일정 목록 표시 | Must |
| T-066 | 여행 제목 수정 | 저장 후 목록에 반영 | Should |
| T-067 | 여행 삭제 | 확인 다이얼로그 → 삭제 후 목록에서 제거 | Should |

---

### L2-C. 일정 관리 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-070 | 일정 상세 보기 | 날짜별 장소 목록 표시 | Must |
| T-071 | 장소 추가 (검색) | 장소 검색 → 선택 → 일정에 추가 | Must |
| T-072 | 장소 순서 변경 (드래그) | 변경 순서 저장 | Must |
| T-073 | 장소 삭제 | 일정에서 제거 | Must |
| T-074 | 장소 상세 정보 확인 | 주소, 영업시간, 지도 연동 | Should |
| T-075 | 지도 보기 전환 | 장소들 지도에 핀 표시 | Should |
| T-076 | 일정 날짜 탭 전환 | 날짜별 장소 정상 표시 | Must |

---

### L2-D. 협업/공유 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-080 | 여행 공유 링크 생성 | 딥링크 또는 공유 코드 생성 | Must |
| T-081 | 공유 초대 수락 | 여행 목록에 추가 | Must |
| T-082 | 공동 편집자 추가/제거 | 권한 변경 즉시 반영 | Should |
| T-083 | 실시간 편집 충돌 | 최신 버전 유지 또는 충돌 안내 | Could |

---

### L2-E. 알림 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-090 | 알림 권한 요청 | iOS 알림 권한 다이얼로그 표시 | Must |
| T-091 | 알림 권한 허용 후 | 백그라운드 알림 수신 가능 | Must |
| T-092 | 알림 탭 → 여행 상세 이동 | 딥링크 정상 동작 | Should |
| T-093 | 알림 설정 해제 후 | 알림 미수신 | Should |

---

### L2-F. 결제/구독 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-100 | 프리미엄 업그레이드 버튼 탭 | 페이월 모달 표시 | Must |
| T-101 | 구독 플랜 선택 → Apple IAP 결제 | Face ID 인증 → 결제 완료 → 프리미엄 활성화 | P0 |
| T-102 | 샌드박스 테스트 계정으로 IAP 테스트 | 결제 성공, RC 웹훅 수신 | P0 |
| T-103 | 구독 후 광고 미노출 | 배너/전면 광고 사라짐 | Must |
| T-104 | 구독 취소 후 만료 시점 | 만료일까지 프리미엄 유지 (불변식) | P0 (불변식) |
| T-105 | 구독 복원 (Restore Purchases) | 이전 구독 복원 | Must (App Store 요구사항) |
| T-106 | 구독 관리 화면 이동 | App Store 구독 관리 화면 진입 | Must |
| T-107 | 무결제 프리미엄 미활성화 | 일반 사용자 제한 기능 비활성 | Must |

**결제 불변식 준수 확인**:
- [ ] RC logOut — 로그아웃 시 RevenueCat logOut 호출
- [ ] server tier authoritative — 클라이언트 단독 프리미엄 판단 금지
- [ ] preflight dual-source — 구독 확인 시 RC + 서버 양쪽 검증
- [ ] fail-close — 구독 상태 불명확 시 미구독으로 처리

---

### L2-G. 광고 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-110 | 비구독 사용자 — 배너 광고 | 하단 배너 광고 표시 | Must |
| T-111 | 비구독 사용자 — 전면 광고 | 특정 액션 후 전면 광고 표시 | Must |
| T-112 | 비구독 사용자 — 보상형 광고 | 광고 시청 후 보상 지급 | Must |
| T-113 | 앱 오픈 광고 | 앱 실행 시 오픈 광고 표시 (빈도 제한 준수) | Should |
| T-114 | GDPR 동의 미제공 지역 | UMP 동의 화면 표시 | Must |
| T-115 | 광고 클릭 → 외부 링크 | Safari 또는 앱 전환, 크래시 없음 | Must |
| T-116 | 구독 사용자 — 광고 미노출 확인 | 모든 광고 형식 미표시 | P0 |

---

### L2-H. 프로필/설정 플로우

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-120 | 프로필 사진 변경 | 갤러리/카메라 접근 → 사진 업로드 | Should |
| T-121 | 언어 설정 변경 | 앱 언어 즉시 반영 (17개 언어 중 최소 ko/en/ja) | Must |
| T-122 | 계정 삭제 요청 | 확인 다이얼로그 → 계정/데이터 삭제 + Apple token revoke | P0 (Guideline 5.1.1) |
| T-123 | 개인정보 처리방침 링크 | Safari에서 개인정보 처리방침 페이지 열림 | Must |
| T-124 | 이용약관 링크 | Safari에서 이용약관 페이지 열림 | Must |

---

## 6. Layer 3: iOS 특화 + 보안 점검

### L3-A. iOS Safe Area 전면 검증

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-130 | 모든 화면 — 상단 Dynamic Island/노치 영역 | 콘텐츠 겹침 없음 | Must |
| T-131 | 모든 화면 — 하단 홈 인디케이터 영역 | 탭바/버튼 홈 인디케이터와 겹치지 않음 | Must |
| T-132 | 모달/시트 화면 | Safe Area 준수 | Must |
| T-133 | 키보드 출현 시 Safe Area 재계산 | 레이아웃 깨지지 않음 | Must |
| T-134 | 가로 방향 전환 시 (지원 화면) | 좌우 Safe Area 반영 | Should |

**검증 기기 목록**:
- iPhone 15 Pro (Dynamic Island) — 필수
- iPhone 14 (노치 없는 Dynamic Island) — 권장
- iPhone SE 3세대 (홈 버튼 있음) — 권장

---

### L3-B. 다크모드

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-140 | 시스템 다크모드 전환 | 앱 색상 테마 동적 전환 | Must |
| T-141 | 다크모드 — 텍스트 대비 | 모든 텍스트 WCAG AA 기준 충족 (4.5:1) | Must |
| T-142 | 다크모드 — 입력 필드 | 배경/텍스트 색 구분 가능 | Must |
| T-143 | 다크모드 — 날짜 선택기 | 텍스트 보임 (L1-04 연계) | Must |
| T-144 | 라이트모드 복귀 | 색상 정상 복원 | Must |
| T-145 | 앱 내 테마 고정 설정 (있는 경우) | 시스템 설정과 독립적으로 동작 | Should |

---

### L3-C. 접근성 (Accessibility)

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-150 | VoiceOver — 로그인 화면 | 주요 버튼 레이블 낭독 | Should |
| T-151 | 동적 폰트 크기 — 최대 설정 | 텍스트 잘림/겹침 없음 | Must |
| T-152 | 동적 폰트 크기 — 최소 설정 | 레이아웃 유지 | Should |
| T-153 | 버튼 터치 영역 | 최소 44×44pt 이상 | Should |
| T-154 | 감소된 모션 설정 | 전환 애니메이션 감소 또는 제거 | Could |

---

### L3-D. 네트워크 상태

| 번호 | 테스트 시나리오 | 기대 결과 | 판정 기준 |
|------|--------------|---------|---------|
| T-160 | 오프라인 상태에서 앱 실행 | 오프라인 안내 메시지, 크래시 없음 | Must |
| T-161 | 오프라인 → 온라인 복귀 | 자동 재연결 또는 재시도 옵션 | Must |
| T-162 | 느린 네트워크 (3G 시뮬레이션) | 로딩 인디케이터, 타임아웃 처리 | Should |
| T-163 | API 응답 지연 중 화면 전환 | 요청 취소 처리, 크래시 없음 | Must |

---

### L3-E. 메모리 및 성능

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-170 | 여러 여행 목록 스크롤 | FPS 유지, 버벅임 없음 | Should |
| T-171 | 장시간 사용 (30분 이상) | 메모리 누수로 인한 크래시 없음 | Must |
| T-172 | 이미지 많은 화면 | 지연 로딩, 메모리 과부하 없음 | Should |
| T-173 | 앱 백그라운드 → 포그라운드 반복 5회 | 상태 유지, 크래시 없음 | Must |

---

### L3-F. 보안 점검

#### F1. 인증 토큰 보안

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-180 | Access Token 저장 위치 | SecureStore 또는 메모리 저장 (AsyncStorage 금지) | P0 (불변식) |
| T-181 | Refresh Token 저장 위치 | AsyncStorage에 refresh token 저장 없음 확인 | P0 (불변식) |
| T-182 | 토큰 만료 후 API 요청 | 401 처리, 재로그인 유도 | Must |
| T-183 | OAuth CSRF nonce 검증 | Google/Kakao OAuth 콜백 시 nonce 검증 | Must (불변식) |
| T-184 | isLoggingOut lock | 로그아웃 중 중복 요청 차단 | Must (불변식) |

**검증 방법**:
```bash
# AsyncStorage에 토큰 저장 여부 확인
grep -r "AsyncStorage.setItem" frontend/src | grep -i "token\|refresh\|access"
```

#### F2. API 통신 보안

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-190 | API 요청 — HTTPS 사용 | http:// 요청 없음 | Must |
| T-191 | API 응답 — 에러 메시지 | 스택 트레이스/PII 미노출 | Must |
| T-192 | 사용자 개인정보 API 전송 | 필요 최소한의 데이터만 전송 | Must |
| T-193 | 에러 리포팅 — PII strip | reportError 시 개인정보 제거 | P0 (불변식) |

#### F3. 데이터 저장 보안

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-195 | 민감 정보 로컬 저장 | Keychain/SecureStore 사용 | Must |
| T-196 | 앱 제거 후 재설치 | 민감 정보 초기화 | Should |
| T-197 | 백업 제외 설정 | 민감 데이터 iCloud 백업 제외 | Should |

#### F4. 입력 유효성 검증

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-200 | 이메일 필드 — 잘못된 형식 | 유효성 오류 메시지 | Must |
| T-201 | 비밀번호 필드 — 최소 길이 미달 | 유효성 오류 메시지 | Must |
| T-202 | XSS 시도 — 텍스트 필드에 스크립트 입력 | 서버 저장/실행 없음 | Must |
| T-203 | 매우 긴 문자열 입력 | 크래시 없음, truncate 또는 거부 | Must |

---

## 7. Layer 4: App Store 가이드라인 준수 검증

### L4-A. Guideline 4.8 — Sign in with Apple

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-210 | Apple Sign-In 버튼 존재 | 로그인 화면에 "Apple로 시작하기" 버튼 있음 | P0 (App Store 규정) |
| T-211 | Apple 버튼 스타일 | Apple 가이드라인 준수 (흰색/검정 배경) | Must |
| T-212 | Apple Sign-In vs 다른 소셜 로그인 표시 | 동등한 크기/위치 | Must |
| T-213 | Apple Sign-In 기능 동작 | 실제 인증 완료 | P0 |

### L4-B. Guideline 5.1.1 — 계정 삭제 (v)

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-220 | 계정 삭제 옵션 접근성 | 프로필 → 설정에서 계정 삭제 메뉴 접근 가능 | P0 (App Store 규정) |
| T-221 | Apple Sign-In 사용자 — 계정 삭제 | Apple token revoke API 호출 확인 | P0 |
| T-222 | 계정 삭제 후 서버 데이터 | 사용자 데이터 실제 삭제 (유예기간 안내 포함) | P0 |
| T-223 | 삭제 후 재로그인 시도 | "계정 없음" 처리, 크래시 없음 | Must |

### L4-C. 결제 요건

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-230 | IAP — Apple In-App Purchase 사용 | 웹 결제(Paddle)가 iOS에서 비활성화됨 | P0 (App Store 규정) |
| T-231 | 구독 취소 방법 안내 | 앱 내 또는 설정에서 구독 취소 방법 설명 | Must |
| T-232 | 복원 구매 버튼 | 페이월 화면에 "구매 복원" 옵션 있음 | Must |
| T-233 | 구독 가격 표시 | 현지 통화 가격 명확히 표시 | Must |

### L4-D. 개인정보 보호

| 번호 | 검증 항목 | 기대 결과 | 판정 기준 |
|------|---------|---------|---------|
| T-240 | 카메라 접근 권한 요청 | 용도 설명 포함한 iOS 권한 다이얼로그 | Must |
| T-241 | 위치 정보 접근 권한 | 용도 설명 포함, 필요 시에만 요청 | Must |
| T-242 | 알림 권한 요청 타이밍 | 첫 실행 즉시가 아닌 적절한 시점에 요청 | Should |
| T-243 | App Store Privacy Nutrition Label | 실제 수집 데이터와 일치 | P0 |
| T-244 | ATT (앱 추적 투명성) | 광고 추적 시 ATT 권한 요청 | Must (iOS 14.5+) |

---

## 8. 합격/불합격 기준 (Go/No-Go)

### 8.1 즉시 재빌드 (Critical Block)

다음 중 하나라도 발생 시 즉시 재빌드, Layer 4 진행 불가:

| 조건 | 분류 |
|------|------|
| Google Sign-In 크래시 재현 (T-001) | P0 재빌드 |
| Apple IAP 결제 실패 (T-101, T-102) | P0 재빌드 |
| 계정 삭제 시 Apple token revoke 미호출 (T-221) | P0 재빌드 |
| 구독 취소 후 만료 전 프리미엄 해제 (T-104) | P0 재빌드 |
| RC logOut 미호출 (T-050) | P0 재빌드 |
| 앱 크래시 발생 횟수 3회 이상 (어떤 플로우든) | P0 재빌드 |

### 8.2 App Store 제출 차단 (Hard Block)

다음 중 하나라도 해결되지 않으면 App Store 제출 불가:

| 조건 | 근거 |
|------|------|
| Apple Sign-In 버튼 없음 (T-210) | Guideline 4.8 |
| 계정 삭제 기능 없음 (T-220) | Guideline 5.1.1 |
| iOS에서 웹 결제 활성화 (T-230) | Guideline 3.1.1 |
| ATT 권한 요청 없이 광고 추적 (T-244) | iOS 14.5+ 정책 |
| Privacy Nutrition Label 불일치 (T-243) | App Store 규정 |
| Safe Area 전면 침범 (T-130, T-131) | HIG 위반 |

### 8.3 조건부 Go (Conditional Go)

다음 조건이 모두 충족될 때 App Store 제출 가능:

- [ ] Layer 1: P0 버그 회귀 0건, P1 버그 회귀 0건
- [ ] Layer 2: Must 항목 전부 통과
- [ ] Layer 3: P0 보안 불변식 위반 0건, Must 항목 통과율 90% 이상
- [ ] Layer 4: 8.2 Hard Block 항목 전부 통과
- [ ] Android versionCode 220 회귀 없음 확인

**미통과 항목 허용 범위**:
- Should 항목: 50% 이상 통과
- Could 항목: 검수 결과 기록만

### 8.4 Go 판정 (Full Go)

조건부 Go 기준 + 아래 추가 충족 시 Full Go:

- [ ] Should 항목 80% 이상 통과
- [ ] i18n 한국어/영어/일본어 3개 언어 검증 완료
- [ ] 실기기 2종 이상 (iPhone 15 + iPhone SE) 검증

---

## 9. 검수 순서 및 의존성

```
[사전 준비]
  ├── TestFlight 빌드 5 설치 (실기기 필수)
  ├── 샌드박스 테스트 계정 준비 (Apple IAP용)
  ├── Google/Kakao 테스트 계정 준비
  └── Sentry/Crashlytics 모니터링 대시보드 열기

[Layer 1: 버그수정 회귀] ← 최우선, 병렬 불가
  ├── T-001~005: Google Sign-In 크래시 (P0 — FAIL 시 즉시 중단)
  ├── T-006~009: 탭바 Safe Area
  ├── T-010~015: 키보드 가림
  ├── T-016~021: 날짜 선택기
  └── T-022~023: 스플래시 색상

[Layer 2: 핵심 기능] ← Layer 1 전체 통과 후
  ├── A. 인증 플로우 (T-030~053)  ← 다른 모든 플로우의 전제조건
  ├── B. 여행 생성 (T-060~067)    ← 인증 후 진행
  ├── C. 일정 관리 (T-070~076)    ← 여행 생성 완료 후
  ├── D. 협업/공유 (T-080~083)    ← 여행 생성 완료 후
  ├── E. 알림 (T-090~093)         ← 인증 후 진행 (독립)
  ├── F. 결제/구독 (T-100~107)    ← 인증 후 진행 (독립)
  └── G. 광고 (T-110~116)         ← 비구독/구독 상태 모두 필요
      └── H. 프로필/설정 (T-120~124) ← 독립 진행 가능

[Layer 3: iOS 특화 + 보안] ← Layer 2 Must 항목 통과 후
  ├── A. Safe Area 전면 검증 (T-130~134)  ← 독립
  ├── B. 다크모드 (T-140~145)              ← 독립
  ├── C. 접근성 (T-150~154)                ← 독립
  ├── D. 네트워크 상태 (T-160~163)          ← 독립
  ├── E. 메모리/성능 (T-170~173)            ← 독립
  └── F. 보안 점검 (T-180~203)             ← 독립 (코드 검증 포함)

[Layer 4: App Store 가이드라인] ← Layer 3 P0 항목 통과 후
  ├── A. Sign in with Apple (T-210~213)
  ├── B. 계정 삭제 (T-220~223)
  ├── C. 결제 요건 (T-230~233)
  └── D. 개인정보 보호 (T-240~244)

[Go/No-Go 판정]
  └── 8.1~8.4 기준에 따라 최종 판정
```

---

## 10. Requirements

### 10.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 버그수정 5건 회귀 없음 확인 | P0 | Pending |
| FR-02 | 인증 4종 모두 iOS에서 정상 동작 | Must | Pending |
| FR-03 | Apple IAP 결제 플로우 완전 검증 | P0 | Pending |
| FR-04 | Guideline 4.8, 5.1.1v 준수 확인 | P0 | Pending |
| FR-05 | iOS Safe Area 전 화면 준수 | Must | Pending |
| FR-06 | 보안 불변식 8개 준수 확인 | P0 | Pending |
| FR-07 | Android versionCode 220 회귀 없음 | Must | Pending |

### 10.2 Non-Functional Requirements

| Category | 기준 | 검증 방법 |
|----------|------|---------|
| 안정성 | 검수 중 앱 크래시 3회 미만 | Sentry/Crashlytics |
| 성능 | 주요 화면 로딩 3초 이내 | 체감 측정 |
| 접근성 | 동적 폰트 최대 크기에서 레이아웃 유지 | 실기기 설정 변경 |
| 보안 | 불변식 P0 항목 위반 0건 | 코드 검증 + 실기기 확인 |

---

## 11. 불변식 준수 확인 항목 (검수 전 코드 검증)

검수 시작 전 다음 코드 검증을 먼저 수행한다.

```bash
# 1. KAV behavior="height" 금지 확인
grep -rn 'behavior.*height\|height.*behavior' frontend/src

# 2. AsyncStorage에 토큰 저장 금지 확인
grep -rn "AsyncStorage.setItem" frontend/src | grep -i "token\|refresh\|access"

# 3. Google Sign-In top-level import 확인 (lazy require 제거 확인)
grep -n "require.*google-signin" frontend/src

# 4. RC logOut 호출 확인
grep -rn "logOut\|Purchases.logOut" frontend/src | grep -i "logout\|signout"
```

예상 결과:
- 검색 1: 결과 없음 (not-found = PASS)
- 검색 2: 결과 없음 (not-found = PASS)
- 검색 3: 결과 없음 (not-found = PASS, top-level import로 변경됨)
- 검색 4: 최소 1개 이상 (PASS)

---

## 12. Success Criteria

### 12.1 Definition of Done

- [ ] Layer 1 전체 통과 (P0 재빌드 없음)
- [ ] Layer 2 Must 항목 90% 이상 통과
- [ ] Layer 3 보안 P0 불변식 위반 0건
- [ ] Layer 4 Hard Block 항목 0건
- [ ] Android versionCode 220 회귀 없음
- [ ] Go/No-Go 판정: Conditional Go 이상

### 12.2 Quality Criteria

- [ ] 실기기 최소 1종 (iPhone 15 계열) 검증 완료
- [ ] 코드 불변식 검증 완료 (섹션 11)
- [ ] Sentry 신규 크래시 리포트 0건 (검수 시간 동안)

---

## 13. Risks and Mitigation

| 리스크 | 영향도 | 가능성 | 대응 방안 |
|--------|--------|--------|---------|
| Apple IAP 샌드박스 계정 인증 지연 | High | Medium | 사전 샌드박스 계정 생성 및 검증 |
| TestFlight 빌드 5 설치 후 캐시로 인한 오탐 | Medium | Medium | 앱 완전 삭제 후 재설치 |
| 실기기 미보유 (iPhone 15 계열) | High | Low | Simulator 1차 검증 후 실기기 위탁 테스트 |
| Google Sign-In 수정이 Simulator에서만 검증됨 | High | Medium | 실기기 검증 필수 (T-001 P0 블로커) |
| New Architecture 관련 신규 버그 | Medium | Low | Expo SDK 54 릴리스 노트 확인 |
| 결제 불변식 위반 신규 발견 | High | Low | 섹션 11 코드 검증으로 사전 차단 |

---

## 14. Architecture Considerations

### 14.1 Project Level

**Dynamic** (Expo managed workflow + NestJS backend + RevenueCat + AdMob)

### 14.2 검수 환경 요구사항

| 항목 | 요구사항 |
|------|---------|
| iOS 버전 | iOS 16 이상 |
| 기기 | iPhone 15 (필수), iPhone SE 3세대 (권장) |
| TestFlight 빌드 | 1.0.0 (5) 설치 완료 |
| Apple 계정 | 샌드박스 테스트 계정 (IAP 테스트용) |
| 네트워크 | Wi-Fi (일반 테스트), LTE/3G 시뮬레이션 (네트워크 테스트) |
| 백엔드 | https://mytravel-planner.com (프로덕션 서버) |

---

## 15. Next Steps

1. [ ] TestFlight 빌드 5 빌드 완료 및 배포 확인
2. [ ] 섹션 11 코드 불변식 검증 실행
3. [ ] 실기기에 TestFlight 빌드 5 설치 (완전 삭제 후 재설치)
4. [ ] Layer 1 시작: T-001 Google Sign-In 크래시 회귀 검증
5. [ ] 검수 결과 문서화 → Go/No-Go 판정
6. [ ] App Store 제출 (Full Go 시)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | Initial draft — 빌드 5 전체 검수 플랜 | PM Agent |
