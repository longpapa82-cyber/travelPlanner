# Google Play Store Publication Checklist — V115

작성일: 2026-04-15
대상 versionCode: 115
트랙: Alpha (내부 테스트)

---

## 1. Data Safety Form

**현재 수집 데이터 (V115 시점)**

| 카테고리 | 항목 | 수집 목적 | 공유 대상 | 암호화 (전송 / 저장) |
|---|---|---|---|---|
| 개인 정보 | email | 계정 식별 | 없음 | TLS / bcrypt (password) |
| 개인 정보 | name (표시 이름) | 프로필 | 없음 | TLS / AES-256 (at-rest) |
| 재무 정보 | 구독 상태 | 플랜 관리 | RevenueCat, Paddle | TLS / 벤더 저장 |
| 앱 활동 | 여행 데이터 | 서비스 제공 | 없음 | TLS / at-rest |
| 앱 활동 | AI 생성 요청 | 핵심 기능 | OpenAI API | TLS (OpenAI는 user data training 금지 계약) |
| 기기·기타 ID | Play Advertising ID | 광고 개인화 | AdMob | TLS |
| 위치 | 대략적 (JIT) | 주변 장소 검색 | Google Maps, Mapbox, LocationIQ | TLS |
| 기기 정보 | OS, 버전, UA | 오류 진단 | Sentry | TLS |

**V115 변경사항 반영 필요 여부**
- [x] `POST /auth/register-force` 신설 — 개인정보 삭제 경로 추가 (사용자 주도 삭제 강화, 긍정적)
- [x] `PRIVACY_OPTIONAL` 동의 deprecated — 수집 목적 변경 아님, UI 정리
- [x] **신규 외부 API 없음** — Data Safety 재제출 불필요

**체크**:
- [ ] Play Console → 앱 콘텐츠 → 데이터 보호 → 변경사항 없음 확인
- [ ] "사용자가 데이터 삭제를 요청할 수 있음" 체크 유지 (register-force로 더 강화됨)

---

## 2. Content Rating (IARC)

- **현재 등급**: 13+ (ESRB Everyone, PEGI 3)
- **V115 변경**: 없음 (UI 레이아웃/문구 변경만)
- **체크**: IARC 설문 재답변 불필요

---

## 3. Target API Level

- Google Play 2026 요구사항: **Android 14 (API 34)** 이상
- 현재 설정 확인 필요:

```bash
# frontend/app.config.js 또는 app.json에서 android.targetSdkVersion
grep -rn "targetSdkVersion\|compileSdkVersion" frontend/app.config.js frontend/app.json 2>/dev/null
```

**체크**:
- [ ] `targetSdkVersion: 34` 이상인지
- [ ] EAS Build config에 `compileSdkVersion: 34` 이상

---

## 4. Permissions Audit

**현재 androidManifest (app.config.js)**
- INTERNET
- ACCESS_NETWORK_STATE
- ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION (JIT)
- CAMERA, READ_MEDIA_IMAGES (JIT, 프로필/여행 사진)
- POST_NOTIFICATIONS (Android 13+)
- BILLING (IAP)
- AD_ID (AdMob)

**V115 변경**: 없음

**체크**:
- [ ] Play Console → 앱 콘텐츠 → 권한 → 모든 권한이 JIT 안내 매칭됨
- [ ] 사용 안 하는 권한 없는지 (READ_PHONE_STATE, READ_CONTACTS 등 과거 의존성 정리 확인)

---

## 5. Store Listing

**V115 신규 기능 반영 (선택적)**
- 짧은 설명: 유지
- 자세한 설명: **"앱 다운로드 안내" 웹 랜딩 정비** 언급 가능 (SEO 유리)
- 스크린샷: V115 UI 변경 항목 재촬영 권장
  - ConsentScreen (중복 제거)
  - CreateTripScreen (새 카운터 포맷)
  - SubscriptionScreen (관리자 시간 표기)
  - CoachMark 위치 정확 (V114-2a fix 증거)

**체크**:
- [ ] ko/en/ja 3개 언어 설명 업데이트 (optional)
- [ ] V115 스크린샷 최소 3장 교체
- [ ] "What's new"에 V115 수정 내역 요약 (한국어 기준 500자 이내)

---

## 6. Privacy Policy

**필수 반영 사항**
- `/privacy.html` 에 V115 변경 반영:
  - PRIVACY_OPTIONAL 동의 deprecated 공지 (기존 동의자에게 이메일 고지 권장)
  - register-force로 사용자 주도 삭제 경로 존재 명시

**체크**:
- [ ] `frontend/public/privacy.html`, `privacy-en.html`에 V115 섹션 추가
- [ ] effectiveDate를 V115 배포일로 업데이트 (17개 언어 `legal.json`)

---

## 7. External Services Disclosed

Privacy Policy에 이미 포함된 외부 서비스:
- OpenAI (AI 생성)
- Google Maps API, Mapbox, LocationIQ (지도/장소)
- Google Timezone API
- OpenWeather (날씨)
- RevenueCat + Paddle (결제)
- AdMob (광고)
- Sentry (에러 모니터링)
- SMTP (이메일 발송)

**V115 변경**: 없음

---

## 8. Pre-launch Report (필수)

- [ ] Play Console Internal Test 트랙에 V115 업로드
- [ ] Pre-launch Report 자동 실행 (Firebase Test Lab):
  - Crash 0건
  - ANR 0건
  - 접근성 위반 0건
  - 성능 경고 최소화
- [ ] Report 실패 시 CRITICAL로 간주하고 Phase 12 차단

---

## 9. App Bundle (AAB)

- [ ] EAS Build `production` 프로필로 AAB 생성
- [ ] `--auto-submit` 플래그로 Play Console 자동 업로드
- [ ] versionCode 115 확인
- [ ] Signing key: Play App Signing (Google 관리) 유지

---

## 10. Policy Compliance Final Check

| 정책 | 준수 여부 | 근거 |
|---|---|---|
| 구독 취소 경로 | ✅ | openManageSubscription() — Play/Apple/Paddle 계정 페이지 |
| 환불 정책 고지 | ✅ | legal.html 환불 섹션 |
| 가족 동의 (13세 미만) | ✅ | 13+ 등급, 가입 시 나이 확인 불요 |
| 광고 부정 방지 | ✅ | AdMob 정책 준수 (V84에서 프레임 크기 수정 완료) |
| 앱 콘텐츠 | ✅ | 전부 선언 완료 |
| 데이터 삭제 경로 | ✅ | ProfileScreen → 계정 삭제 / register-force |
| 구글 플레이 Billing 사용 | ✅ | Android IAP는 RevenueCat 경유 |
| Payment 외부 리디렉션 | ✅ | Paddle은 web 구독 전용 (Android 앱에서 사용 안 함) |

---

## Gate 9 통과 기준

1. Data Safety 변경 없음 확인 ✅
2. Target API level 34 이상
3. Privacy policy V115 섹션 반영
4. Pre-launch Report CRITICAL 0건
5. Store listing 최소 스크린샷 3장 교체
6. App Bundle 서명/업로드 검증

**현재 상태**: 항목 2/3/4/5는 배포 단계(Phase 12) 직전 처리. 이 단계에서는 checklist 문서화만 완료.
