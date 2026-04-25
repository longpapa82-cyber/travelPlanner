# V111 RCA Findings — Phase 1.0 선결 조사 결과

**조사일**: 2026-04-13
**HEAD**: `f144ad0da0b704bae33e08d6e75882ed02234a64` (V110 커밋)
**V109 커밋**: `648d348b0c25d0aa9ed92c335a95da111674db5c`
**조사 방법**: `.git/logs/HEAD` + `.git/objects/` 직접 파싱 (Xcode CLT 라이선스 문제로 git CLI 사용 불가)

---

## 🚨 결정적 발견

### 발견 1: V110 커밋은 V109 수정의 "재수정"임을 명시
V110 커밋 메시지에 다음 문구가 **명시적으로** 포함되어 있음:

> **[P0] 화면 이탈 후 폼 데이터 유지 (V109 재발)**:
> CreateTripScreen focus listener가 **에러 상태만 리셋했던 문제**
>
> **[P1] 코치마크 박스 위치 불일치 (V109 재발)**:
> HomeScreen measureInWindow 타이밍 문제
> 측정 지연 **500ms → 800ms + 1500ms 재측정**

**함의**: CLAUDE.md의 V109 기록("46/46 VERIFIED")은 **검증 품질이 부족**했고, V110 작성자가 이미 재발을 발견해 재수정했음. 그러나 V110 수정(측정 지연 늘리기)마저 V111에서 3회째 재발.

### 발견 2: 빌드 파이프라인 누락 가설 기각
V109 커밋(`648d348b`) + V110 커밋(`f144ad0d`)은 모두 HEAD 이전에 정상 포함됨. **"커밋되었으나 빌드에 누락"은 사실이 아님**. 즉 Phase 1.0의 주요 가설 R1(HIGH)은 **기각**.

→ V111 재발 이슈는 **빌드 파이프라인 문제가 아니라 근본 원인 오진단**임.

### 발견 3 (가장 중요): RevenueCat webhook 자동 반영 실패
V110 커밋 메시지에 다음 **자백**이 포함됨:

> **[근본] 서버 DB 상태 수동 업데이트**:
> - hoonjae723/longpapa82: `subscriptionTier='premium', aiTripsUsedThisMonth=0`
> - **RevenueCat webhook 자동 반영 실패**는 V111에서 별도 처리

**함의**: 구독 상태가 **RevenueCat → Backend webhook 경로로 자동 반영되지 않는 상태**. V110에서는 DB를 수동 UPDATE로 우회했을 뿐, webhook 처리 자체는 깨진 채로 V111에 들어옴.

이것이 V111의 **세 재발 이슈의 진짜 공통 근본 원인**임:
- **V111-4** "1/3회 남음" 오표기 → 구독자인데도 `subscriptionTier='free'`로 DB에 남아 있음
- **V111-6** 구독 화면 필드 미표기 → `subscriptionStartedAt/planType` 필드가 webhook에서 채워지지 않음
- **V111-7** 3/3 형식 미반영 → 클라이언트 분기 로직이 `subscriptionTier='premium'`을 기대하지만 DB에 free로 남아 있음

**즉 Frontend 수정은 부수적이고, 반드시 Backend RevenueCat webhook 처리 경로를 고쳐야 함**. 단순 UI 수정으로는 V112에서도 재발할 것.

### 발견 4: V110 코치마크 수정은 근본 해결이 아님
측정 지연을 늘리는 패치(500ms→1500ms)가 V110에 들어갔으나 V111에서 3회째 재발. 측정 타이밍 문제가 아니라 **측정 대상 자체(버튼 ref, 컨테이너 레이아웃)의 이슈**일 가능성이 큼. Phase 2.C에서 측정 로직 폐기 + 고정 위치 툴팁 디자인 대안 검토 필수.

---

## 📋 Phase 2 작업 범위 재조정

| # | 원래 계획 | 수정된 계획 |
|---|---|---|
| V111-4 | CreateTripScreen 배너 UI 수정 | **Backend: RevenueCat webhook 처리 경로 수정** + users.entity `subscriptionTier` 동기화 + 수동 UPDATE 제거 |
| V111-6 | SubscriptionScreen UI 필드 추가 | **Backend: webhook payload에서 `subscriptionStartedAt/planType` 추출 + DB 저장** (UI는 이미 V109에서 추가됨) |
| V111-7 | 구독자 분기 로직 수정 | **Backend webhook 수정 후 자동으로 해결됨** (PremiumContext는 이미 premium 구독 시 3/3 로직 존재 가능성) |
| V111-3 | 코치마크 측정 재작성 | **측정 로직 폐기 고려** — 고정 위치 툴팁 + 화살표 방식 대안 |

---

## ✅ Phase 1.0 결론

1. **빌드 파이프라인은 정상** — Phase 1.0 R1 리스크 해제
2. **V111 재발 이슈의 진짜 근본 원인은 RevenueCat webhook 처리 실패** — Backend 우선 수정 필요
3. **Phase 2 작업 순서 변경**: 원래 Phase 2.B(Frontend AI 카운터) 먼저였으나, **Backend webhook 수정을 최우선 배치**해야 함
4. **코치마크는 측정 로직 재작성 대신 고정 위치 대안을 준비**해야 함 (3회 재발 = 측정 접근 자체의 한계)

---

## 🛠️ 다음 단계 (Phase 1.1~1.5 병렬 RCA)

위 발견을 바탕으로, 다음 RCA는 **이미 원인이 식별된 부분을 재확인**하는 수준으로 축소되고, 대신 **Backend RevenueCat webhook 코드 상세 조사**가 새로운 최우선 순위가 됨.

- **Phase 1.3-REVISED (최우선)**: `backend/src/subscriptions/*` + RevenueCat webhook handler 조사 — 수신 로그, 이벤트 파싱, DB 업데이트 로직
- **Phase 1.1**: 이메일 인증 에러 메시지 (이전 우선순위 유지)
- **Phase 1.2**: 코치마크 (측정 로직 + 고정 위치 대안 설계)
- **Phase 1.4**: 광고 재생 중 토스트 dismiss (독립 이슈)
- **Phase 1.5**: 구독 화면 필드 (발견 3으로 원인 확정됨, 구현 위치만 확인)
