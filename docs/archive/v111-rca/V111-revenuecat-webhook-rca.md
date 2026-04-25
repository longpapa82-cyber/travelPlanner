# V111 RevenueCat Webhook RCA — **최종 확정** (2026-04-13 19:00 KST)

## 🎯 진짜 근본 원인 (스크린샷 증거)

### 1차 원인 (P0): Google Play Service Account 인증 실패
**Error message (RevenueCat 대시보드 View Details)**:
> Google Play Authentication Error: Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.

**해석**: Service Account JSON 파일은 업로드되어 있으나 OAuth 2 인증 토큰이 invalid. 다음 중 하나:
- 서비스 계정 키가 만료되거나 revoked
- 서비스 계정이 Google Play Console에서 권한을 잃음
- 서비스 계정이 IAM에서 disabled

### 2차 원인 (P0): App User ID detection method가 `anonymous`
RevenueCat이 S2S 알림에서 익명 ID를 사용 → Frontend `Purchases.logIn(userId)`와 매칭 실패 → Backend webhook이 와도 `RevenueCat event for unknown user`로 skip.

### 정상 연결된 부분 ✅
- Google Developer Notifications (Pub/Sub): **Connected**
- Topic ID: `projects/tripplanner-486511/topics/play-billing`
- Last received: **2026-04-13 11:41 UTC** (오늘 아침)
- Package name: `com.longpapa82.travelplanner` ✅
- RevenueCat API Key (SDK): `goog_BeyiIKXfhmqtbtzaEGMRICChtQd` ✅

---

## 🛠️ 수정 절차

### Step 1: Service Account 재검증 (P0)
1. Google Cloud Console → IAM → Service Accounts → `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
2. 상태 확인 (Enabled / Disabled)
3. Keys 탭 → Add Key → Create new key → JSON 다운로드
4. Play Console → 사용자 및 권한 → 해당 서비스 계정 권한 확인
   - 앱 정보 보기, 재무 데이터 보기, 주문 및 구독 관리
5. RevenueCat → Replace로 새 JSON 업로드
6. 1~2분 대기 → 새로고침 → 경고 사라짐 확인

### Step 2: App User ID detection method 변경 (P0)
- 현재: `Use anonymous App User ID`
- 변경: **`Use user ID from purchase token`** 또는 `obfuscatedAccountId`
- 이유: Frontend가 `Purchases.logIn(user.id)` 호출하므로 익명 ID 사용 시 매칭 실패

### Step 3: 기존 구독 복구
- Alpha 앱에서 hoonjae723 등 로그인 → Restore Purchases
- RevenueCat Customers 탭에 사용자 등장 확인
- Backend DB에 subscription 필드 채워짐 확인

---

## 📊 해결 범위

| V111 이슈 | Phase 1.3 수정으로 해결 |
|---|---|
| V111-4 AI 카운터 오표기 | ✅ 자동 해결 |
| V111-6 구독 화면 필드 | ✅ 자동 해결 |
| V111-7 구독자 3/3 형식 | ✅ 자동 해결 |
| V111-1 에러 메시지 | ❌ 별도 Phase 2.A 필요 |
| V111-2 동의 버튼 여백 | ❌ 별도 Phase 2.A 필요 |
| V111-3 코치마크 | ❌ 별도 Phase 2.C 필요 |
| V111-5 광고 토스트 | ❌ 별도 Phase 2.D 필요 |

---

## 🧠 교훈

1. **RCA 에이전트는 시스템 경계를 넘지 못함** — 코드/파일만 보고 대시보드/런타임 상태 확인 안 됨. 외부 서비스 문제는 에이전트가 탐지 불가.
2. **CLAUDE.md "Valid credentials" 기록은 시점성이 있음** — 작성 당시만 유효. 재검증 필요.
3. **증상 체인 추적**: Backend → nginx → RevenueCat webhook → RevenueCat Customers → Google Play API. 이번 경우 마지막 단계가 원인.
4. **단일 근본 원인 vs 복합**: 3개 Frontend 증상이 1개 인프라 원인에서 파생. Frontend 코드는 모두 정상.
