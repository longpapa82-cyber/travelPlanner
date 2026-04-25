# V184 Alpha 제출 + 검증 체크리스트

**작성**: 2026-04-26 KST
**목적**: V184 Phase 0 코드 변경 완료 후 EAS Build → Play Console Alpha 제출 → 테스터 검증까지 단계별 가이드

---

## 0. 사전 점검 (이미 완료된 사항)

- [x] V184 P0 11건 + 자동 검증 2건 commit 완료 (`1c7e80b8`)
- [x] git working tree 클린 (chore commit 2건으로 noise 제거)
- [x] `npm run validate:static` PASS
- [x] Frontend TypeScript 0 errors
- [x] Frontend Jest 223/223 PASS

---

## 1. EAS Build (사용자 직접 실행)

### 1-A. 빌드 전 마지막 확인

```bash
cd /Users/hoonjaepark/projects/travelPlanner

# 자동 검증 PASS 재확인
npm run validate:static

# 빌드 트리거 직전 git 상태 클린 확인
git status

# 현재 브랜치 main 확인
git branch --show-current

# EAS 로그인 상태 확인
cd frontend && eas whoami
```

### 1-B. Android 빌드 + 자동 제출

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# preview 프로파일 + auto-submit 으로 빌드 → Alpha 트랙
# eas.json의 build.preview.android.autoIncrement=true → versionCode 184 자동
# eas.json의 submit.production.android.track="alpha" → Alpha 트랙
eas build --profile preview --platform android --auto-submit
```

**예상 소요 시간**: 빌드 15-25분 + 제출 5분 = **약 30분**

### 1-C. 빌드 실패 시 디버깅 순서

1. **로컬 prebuild 검증**:
   ```bash
   npx expo prebuild --clean
   # android/app/build.gradle 확인 — versionCode 184로 증가됐는지
   ```
2. **EAS 빌드 로그 확인**: 빌드 페이지 URL이 콘솔에 출력됨
3. **흔한 실패 원인**:
   - `google-play-service-account.json` 누락 → `eas secret:list` 확인
   - Java/Gradle 버전 불일치 → `eas.json`의 `image` 필드 확인
   - i18n JSON syntax error → `npm run validate:static` 재실행

---

## 2. Play Console 제출 후 (제출 자동 완료 시 스킵)

만약 `--auto-submit`이 실패한 경우 수동 제출:

```bash
# AAB 파일 다운로드 위치 확인
eas build:list --platform=android --limit=1

# Play Console 직접 업로드
# https://play.google.com/console/u/0/developers/.../app/.../tracks/internal-testing
# → 내부 테스트 → 새 버전 만들기 → AAB 업로드 → 검토 시작 → 출시
```

---

## 3. Alpha 테스터 검증 — V183 보고 3건 우선

테스터 기기에 V184 (versionCode 184) 빌드가 다운로드되면 **반드시** 다음 3건을 우선 확인:

### 3-A. ⭐ Critical: admin 결제 버튼 동작 (V183 이슈 1)

**목적**: V182 회귀(`if(isAdmin) return;`) 제거 확인 — 관리자 계정에서도 페이월 정상 진입

**테스트 계정**: `longpapa82@gmail.com` 또는 `hoonjae723@gmail.com` (둘 다 admin)

**절차**:
1. V184 빌드로 위 계정 로그인
2. 하단 탭 → [프로필] 탭 진입
3. 프로필 화면에서 [구독] 버튼 클릭
4. **기대**: 페이월 모달이 즉시 표시됨 (월간/연간 선택 화면)
5. **(중요)** 결제 시도 — 라이선스 테스터로 등록되어 있어 실결제 안 됨
6. 결제 완료 후 [프로필] 화면 재진입 → "프리미엄 활성" 배지 표시 확인

**FAIL 조건**:
- 버튼 클릭 시 아무 반응 없음 → V184 가드 제거 미반영 (build cache 의심)
- 페이월 진입 시 "이미 연간 구독 중" alert → V182 server-tier gate 회귀

### 3-B. ⭐ 라이선스 화면 footer 저작권

**목적**: "© 2024-2026 AI Soft" → "© 2026 AI Soft" 변경 확인

**절차**:
1. 어떤 계정이든 로그인
2. [프로필] → [오픈소스 라이선스] 클릭
3. 화면 하단 footer 확인
4. **기대**: `© 2026 AI Soft. ...` 표시 (year 2024-2026 또는 2024 단독 X)

**FAIL 조건**:
- 여전히 "2024-2026" 표시 → 빌드에 새 i18n 미반영 (캐시 또는 OTA 업데이트 누락)

### 3-C. ⭐ 약관 + 처리방침 Paddle 표기 확인

**목적**: 6곳에서 Paddle 표기 사라짐 확인 (전자상거래법 §13)

**절차**:
1. [프로필] → [이용약관] 진입 → "결제 및 갱신" 섹션 확인
2. **기대**: "Google Play 인앱 결제(IAP)만 처리" 단일화 문구. Paddle/Merchant of Record 단어 없음
3. [프로필] → [개인정보처리방침] 진입 → 처리자 표 + 국외이전 표 확인
4. **기대**:
   - 처리자 표: Paddle 행 없음, OpenWeather 행 있음
   - 국외이전 표: OpenWeather 행 추가됨 (위·경도 좌표 → 미국)

**FAIL 조건**:
- Paddle 단어가 어디든 보임 → 빌드에 i18n 갱신 누락 (legal.json은 이미 PASS이므로 OTA 업데이트 캐시 의심)

---

## 4. 추가 회귀 확인 (Critical Path 10건)

V183 보고 외 통합 마스터 플랜 §B의 Critical Path 10건 — 우선순위 순:

| # | 시나리오 | 회귀 이력 | 검증 시간 |
|---|---|---|---|
| 1 | 탈퇴-재가입 phantom 구독 차단 | V173/V179/V181 (3회) | 30분 |
| 2 | 단일 클릭 로그아웃 race 없음 | V177/V181 (2회) | 5분 |
| 3 | 화면 진입 폼 초기화 (useFocusEffect) | V108~V173 (9회) | 5분 |
| 4 | 인원수 5.5 floor 가드 | V169/V176/V180 | 2분 |
| 5 | 타임존 목적지 기준 active 전환 | 2026-03-22 P0 | 5분 |
| 6 | 월간 결제 5초 내 premium 반영 | V172 webhook | 10분 |
| 7 | 프리미엄/admin 광고 0개 | localPremiumOverride | 10분 |
| 8 | Foreground 복귀 메뉴 유지 | V177 cascade | 5분 |
| 9 | 인앱 라이선스 (외부 브라우저 X) | V176/V178 | 2분 |
| 10 | 데이터 내보내기 ZIP 다운로드 | V178/V180 | 5분 |

**총 검증 시간**: 약 80분

---

## 5. GO/NO-GO 결정 기준

### ✅ GO (프로덕션 트랙 제출 가능)
- V183 보고 3건 모두 PASS (3-A, 3-B, 3-C)
- Critical Path 10건 모두 PASS
- Sentry P0 신규 발생 0건 (24h 모니터링)

### ❌ NO-GO (V185 추가 fix 필요)
- 3-A admin 결제 무반응 재발 → PremiumContext.tsx:357 변경 빌드 미반영
- 3-B 저작권 표기 미변경 → i18n 빌드 OTA 업데이트 캐시 문제
- 3-C Paddle 표기 잔존 → legal.json 갱신 OTA 누락
- Critical Path 1번(phantom 구독)이 다시 보고됨 → V184 server-tier gate 회귀

---

## 6. 출시 후 후속 작업 (V184 commit 후 별도 진행)

### 우선순위 P1 (1주 내)

1. **GitHub Actions CI 통합**: `.github/workflows/validate-static.yml` 또는 ci.yml에 job 추가
   ```yaml
   - run: python3 scripts/validate-legal.py
   - run: python3 scripts/validate-content.py
   ```
   (보안 hook 정책상 사용자가 직접 또는 별도 PR로 추가 권장)

2. **axios SSRF + path-to-regexp 패치**: ts-jest@29 → 30 마이그레이션과 통합
   ```bash
   cd backend
   npm install axios@^1.15.2 ts-jest@30 --legacy-peer-deps
   npm test  # 회귀 검증
   ```

3. **Backend Jest 2 suite 실패 RCA**: otplib ESM dual package + ts-jest transform
   - 임시 해결: jest.config의 transformIgnorePatterns에 `node_modules/(?!(@scure|@otplib|@noble|otplib))/` 정확성 재검증
   - 근본 해결: ts-jest@30 + jest@30 ESM 모드 활성화

### 우선순위 P2 (1개월 내)

4. CSP unsafe-inline → nonce 기반 전환
5. console.log ~210건 → `__DEV__` 가드
6. register() 이메일 열거 방지 (응답 통일)
7. PII purge cron 90일 동작 검증 (V180 추가)
8. Hetzner VPS 방화벽/Postgres/Redis 외부 노출 점검

---

## 7. 비상 롤백 절차

V184 출시 후 즉각적인 P0 발생 시:

```bash
# Play Console에서 V184 출시 일시 중지
# https://play.google.com/console/.../tracks/internal-testing
# → 내부 테스트 → 출시 중지

# Git 롤백 (필요 시)
cd /Users/hoonjaepark/projects/travelPlanner
git revert 1c7e80b8  # V184 fix commit revert
git push origin main

# V182 (versionCode 183) 재출시
# Play Console에서 V182 빌드를 다시 출시
```

---

## 8. 참고 문서

- `CLAUDE.md` — V184 핵심 수정 + 불변식 32+33
- `testResult.md` — V183 사용자 보고 원문
- `scripts/validate-legal.py` — 17 locale legal.json 자동 검증 (P0 7건 + P1 3건)
- `scripts/validate-content.py` — 56 HTML 정적 콘텐츠 자동 검증
- `package.json` — `npm run validate:static`
