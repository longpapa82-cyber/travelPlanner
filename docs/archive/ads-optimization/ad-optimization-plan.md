# MyTravel — 광고 고도화 계획서

> 작성일: 2026-02-28 | 목표: CTR 및 eCPM 극대화, 사용자 이탈 최소화
> 기준: 글로벌 여행 앱 벤치마킹 + 현재 구현 감사 완료

---

## 1. 글로벌 벤치마킹 분석

### 1.1 경쟁사 수익 모델 비교

| 앱 | 수익 모델 | 광고 방식 | 구독료 | 특징 |
|-----|----------|----------|--------|------|
| **Wanderlog** | Freemium + 제휴 | 제휴 링크 (숙소/항공) | $5.99/월, $49.99/년 | 광고 거의 없음, 제휴 수수료 중심 |
| **TripIt** | Freemium | 없음 | $49/년 (Pro) | 광고 0, 순수 구독 모델 |
| **TripAdvisor** | Hybrid | 네이티브 광고 + 메타서치 | Plus 멤버십 | 콘텐츠에 녹인 광고, 높은 CTR |
| **Hopper** | Commission + 데이터 | 인앱 프로모션 | 없음 | 가격 예측으로 전환율 극대화 |
| **Booking.com** | Commission | 인앱 프로모션 + 푸시 | 없음 | 15-30% 예약 수수료 |
| **MyTravel (현재)** | Freemium + 광고 | 배너+전면+리워드+앱오픈 | $3.99/월, $29.99/년 | 4가지 AdMob 포맷 + AdSense |

### 1.2 광고 포맷별 성과 벤치마크 (2025-2026)

| 포맷 | CTR | eCPM (Tier-1) | eCPM (글로벌) | 사용자 경험 영향 |
|------|-----|---------------|-------------|----------------|
| **배너 (320×50)** | 0.1-0.3% | $0.50-1.50 | $0.20-0.80 | 낮음 (무시됨) |
| **MREC (300×250)** | 0.3-0.8% | $1.00-3.00 | $0.50-1.50 | 중간 |
| **전면 (Interstitial)** | 4-5% | $5.00-8.00 | $2.50-5.00 | 높음 (불편) |
| **리워드 비디오** | 수동 클릭 | $15.00-30.00 | $8.00-18.00 | 없음 (자발적) |
| **네이티브 광고** | 1-3% | $3.00-5.00 | $1.50-3.00 | 매우 낮음 |
| **앱 오픈** | 3-4% | $5.00-10.00 | $3.00-6.00 | 중간 |

> 출처: [Business of Apps](https://www.businessofapps.com/ads/research/mobile-app-advertising-cpm-rates/), [Yango Ads](https://yango-ads.com/blog/mobile-interstitial-ads), [Adnimation](https://www.adnimation.com/mobile-optimization-in-2025-turning-every-tap-into-revenue/)

### 1.3 핵심 인사이트

1. **전면 광고는 배너 대비 18배 높은 CTR** — 하지만 빈도 관리 필수 (5% 이상 이탈률 방지)
2. **리워드 비디오가 최고 eCPM** ($15-30) — 95%+ 완료율, 사용자 자발적
3. **네이티브 광고는 배너 대비 20% 높은 eCPM** — 콘텐츠에 녹아 CTR 3배 상승
4. **MREC (300×250)이 배너보다 3-5배 eCPM** — 피드 사이에 삽입 시 최적
5. **AI 기반 최적화로 RPM 30-38% 향상** 가능 (개인화 타이밍 + 빈도)
6. **광고가 초기 뷰포트 15% 이상 차지하면 Google 페널티** — 배치 주의

---

## 2. 현재 MyTravel 광고 구현 감사 결과

### 2.1 현재 광고 배치 현황

| 화면 | 배너 | 전면 | 리워드 | 앱오픈 | 네이티브 |
|------|------|------|--------|--------|---------|
| HomeScreen | 1 (하단) | - | - | - | - |
| TripListScreen | 1 (목록 하단) | - | - | - | - |
| TripDetailScreen | 2 (일정 탭) | - | - | - | - |
| CreateTripScreen | - | 1 (생성 후) | 1 (인사이트) | - | - |
| EditTripScreen | - | 1 (저장 후) | - | - | - |
| App.tsx (전역) | - | - | - | 1 (복귀 시) | - |
| **합계** | **4** | **2** | **1** | **1** | **0** |

### 2.2 현재 강점

- 4가지 AdMob 포맷 구현 완료 (배너, 전면, 리워드, 앱오픈)
- 빈도 제한 (3분 간격, 세션당 5회)
- Premium 사용자 광고 제거
- GDPR/ATT 컴플라이언스
- 플랫폼별 분리 (.native.ts 패턴)

### 2.3 현재 약점 (개선 기회)

| # | 약점 | 영향 | 개선 방향 |
|---|------|------|----------|
| W1 | **네이티브 광고 미구현** | eCPM 기회 손실 ($3-5 vs $0.5-1.5) | 피드 내 네이티브 광고 추가 |
| W2 | **배너만 사용 (320×50)** | 최저 eCPM 포맷 | MREC (300×250) 혼용 |
| W3 | **리워드 광고 1곳만 사용** | 최고 eCPM 기회 미활용 | 리워드 포인트 2-3곳 추가 |
| W4 | **광고 임프레션 추적 없음** | 최적화 데이터 부재 | 이벤트 트래킹 추가 |
| W5 | **A/B 테스트 없음** | 최적 빈도/배치 모름 | Firebase Remote Config |
| W6 | **배너 자동 리프레시 없음** | 세션당 임프레션 손실 | 30-60초 리프레시 |
| W7 | **소셜 피드에 광고 없음** | 높은 스크롤 빈도 화면 미활용 | 피드 3-5번째마다 네이티브 |
| W8 | **미디에이션 미적용** | 단일 네트워크 의존 | AdMob 미디에이션 추가 |
| W9 | **제휴 링크 ID 미설정** | 추가 수익원 미활용 | 파트너 등록 |

---

## 3. 광고 고도화 전략

### 3.1 전략 개요: 하이브리드 수익 극대화

```
[Layer 1] 기본 수익 — 배너 + MREC (일관된 fill rate 90%+)
[Layer 2] 고가치 수익 — 전면 + 앱오픈 (전환 포인트)
[Layer 3] 프리미엄 수익 — 리워드 비디오 (자발적 참여, 최고 eCPM)
[Layer 4] 네이티브 수익 — 콘텐츠 통합형 (높은 CTR, 낮은 이탈)
[Layer 5] 제휴 수익 — 예약/체험 링크 (CPA, 가장 높은 단가)
```

### 3.2 Phase별 실행 계획

---

#### Phase 1: 즉시 적용 — 기존 구현 최적화 (1-2일)

**목표**: 코드 변경 최소화, 기존 인프라에서 eCPM 30%+ 향상

| # | 작업 | 파일 | 예상 효과 |
|---|------|------|----------|
| 1-1 | **배너 → MREC 교체** (피드 사이) | `TripListScreen.tsx`, `TripDetailScreen.tsx` | eCPM 3-5배 향상 |
| 1-2 | **배너 자동 리프레시** (45초) | `AdMobBanner.native.tsx` | 임프레션 +40% |
| 1-3 | **광고 임프레션 이벤트 추적** | `AdBanner.tsx`, `eventTracker.ts` | 데이터 기반 최적화 |
| 1-4 | **소셜 피드에 배너 삽입** | `FeedScreen.tsx` | 새 광고 노출 화면 확보 |
| 1-5 | **리워드 포인트 추가** (날씨 상세) | `TripDetailScreen.tsx` | 리워드 노출 +100% |

**Phase 1 상세 구현**:

##### 1-1. MREC (300×250) 광고 도입

현재 모든 배너가 `adaptive` (320×50 계열)인데, 스크롤 콘텐츠 사이에는 MREC이 3-5배 높은 eCPM을 제공합니다.

```
변경 전: TripListScreen → <AdBanner size="adaptive" />  (eCPM ~$0.80)
변경 후: TripListScreen → <AdBanner size="mediumRectangle" />  (eCPM ~$3.00)

배치: 여행 목록 3번째와 7번째 항목 사이에 삽입 (피드 인라인)
```

적용 화면:
- `TripListScreen`: 여행 리스트 3번째 아이템 뒤
- `TripDetailScreen`: 일정 탭 일자별 카드 사이 (3일차 뒤)
- `FeedScreen`: 소셜 피드 5번째 아이템 뒤

##### 1-2. 배너 자동 리프레시

```typescript
// AdMobBanner.native.tsx에 추가
// 45초마다 새 광고 요청 (Google 최소 권장 30초)
useEffect(() => {
  const interval = setInterval(() => {
    bannerRef.current?.load();
  }, 45000);
  return () => clearInterval(interval);
}, []);
```

##### 1-3. 광고 임프레션 이벤트 추적

```typescript
// 모든 광고 컴포넌트에 추가
trackEvent('ad_impression', {
  format: 'banner' | 'interstitial' | 'rewarded' | 'app_open',
  screen: 'HomeScreen' | 'TripDetail' | ...,
  size: 'adaptive' | 'mrec',
  placement: 'inline' | 'bottom' | 'transition',
});
```

##### 1-5. 리워드 광고 포인트 추가

현재 CreateTripScreen 1곳에서만 리워드 사용. 추가 배치:

| 화면 | 리워드 트리거 | 보상 |
|------|-------------|------|
| CreateTripScreen (기존) | 여행지 인사이트 잠금 해제 | 목적지 상세 정보 |
| TripDetailScreen (신규) | 날씨 7일 예보 잠금 해제 | 상세 날씨 데이터 |
| HomeScreen (신규) | AI 추천 여행지 잠금 해제 | 개인화 추천 리스트 |

---

#### Phase 2: 네이티브 광고 도입 (3-5일)

**목표**: 콘텐츠에 자연스럽게 녹는 광고로 CTR 1-3% 달성

| # | 작업 | 파일 | 예상 효과 |
|---|------|------|----------|
| 2-1 | **NativeAd 컴포넌트 구현** | `components/ads/NativeAd.native.tsx` | 네이티브 포맷 기반 |
| 2-2 | **소셜 피드 네이티브 광고** | `FeedScreen.tsx` | 피드 5번째마다 삽입 |
| 2-3 | **여행지 추천 네이티브 광고** | `HomeScreen.tsx` | 추천 카드 스타일 |
| 2-4 | **여행 상세 네이티브 광고** | `TripDetailScreen.tsx` | "관련 체험" 카드 |

**Phase 2 상세 구현**:

##### 2-1. NativeAd 컴포넌트 설계

```
[여행지 카드 스타일 네이티브 광고]
┌─────────────────────────────────┐
│ [이미지 (16:9)]                  │
│                                 │
│ 📍 Sponsored · Booking.com      │
│ 도쿄 시부야 호텔 특가            │
│ ★ 4.5 · "완벽한 위치"           │
│ ₩89,000~/박                     │
│              [지금 예약하기 →]    │
└─────────────────────────────────┘
```

핵심 원칙:
- 앱의 기존 카드 디자인과 **동일한 font, color, border-radius** 사용
- "Sponsored" 또는 "광고" 라벨 필수 (Google 정책)
- 이미지, 제목, 설명, CTA 버튼 커스텀 렌더링

##### 2-2. 소셜 피드 네이티브 광고 삽입

```
피드 아이템 1
피드 아이템 2
피드 아이템 3
피드 아이템 4
[네이티브 광고 카드]  ← 5번째마다
피드 아이템 5
피드 아이템 6
피드 아이템 7
피드 아이템 8
[네이티브 광고 카드]  ← 10번째
...
```

FlatList `renderItem`에서 인덱스 체크:
```typescript
if ((index + 1) % 5 === 0 && !isPremium) {
  return <NativeAd placement="feed" />;
}
```

##### 2-3. 여행지 추천 네이티브 광고

HomeScreen의 "인기 여행지" 또는 "추천" 섹션에 자연스럽게 삽입:
```
[도쿄 - 추천 여행지]
[오사카 - 추천 여행지]
[방콕 호텔 특가 - Sponsored]  ← 네이티브 광고
[파리 - 추천 여행지]
```

---

#### Phase 3: 전면 광고 최적화 (2-3일)

**목표**: 전면 광고 CTR 유지하면서 이탈률 최소화

| # | 작업 | 현재 | 개선 | 예상 효과 |
|---|------|------|------|----------|
| 3-1 | **빈도 동적 조정** | 고정 3분 | 사용자별 최적 빈도 | 이탈률 -30% |
| 3-2 | **자연스러운 전환 포인트 추가** | 2곳 (생성/수정) | +2곳 (공유 후, 설정 변경 후) | 임프레션 +50% |
| 3-3 | **지연 표시** | 즉시 (500ms) | 800ms + 페이드인 | UX 개선 |
| 3-4 | **닫기 버튼 카운트다운** | 기본 (5초) | 3초 (Google 최소) | 이탈률 -20% |

**Phase 3 상세 구현**:

##### 3-1. 사용자별 동적 빈도 조정

```typescript
// adFrequency.ts 확장
const getOptimalInterval = (sessionDuration: number, adsShown: number) => {
  // 세션 초반: 5분 간격 (사용자 정착 유도)
  if (sessionDuration < 300) return 5 * 60 * 1000;
  // 세션 중반: 3분 간격 (기본)
  if (adsShown < 3) return 3 * 60 * 1000;
  // 세션 후반: 4분 간격 (피로도 감소)
  return 4 * 60 * 1000;
};
```

##### 3-2. 전면 광고 추가 전환 포인트

| 현재 | 추가 제안 | 이유 |
|------|----------|------|
| 여행 생성 후 | 여행 공유 후 | 행동 완료 시점, 만족감 높음 |
| 여행 수정 후 | 앱 설정 변경 후 | 비핵심 흐름, 이탈 영향 적음 |

---

#### Phase 4: 스마트 광고 인프라 구축 (1주)

**목표**: 데이터 기반 최적화 + A/B 테스트 시스템

| # | 작업 | 도구 | 예상 효과 |
|---|------|------|----------|
| 4-1 | **Firebase Remote Config 연동** | Firebase | 광고 설정 서버 사이드 제어 |
| 4-2 | **A/B 테스트 프레임워크** | Firebase A/B Testing | 배치/빈도 실험 |
| 4-3 | **광고 수익 대시보드** | AdminDashboard + AdMob API | 실시간 모니터링 |
| 4-4 | **사용자 세그먼트별 빈도** | Firebase Analytics | 맞춤 광고 경험 |

**Phase 4 상세 구현**:

##### 4-1. Firebase Remote Config으로 광고 설정 원격 제어

```json
{
  "ad_banner_refresh_interval": 45,
  "ad_interstitial_min_interval": 180,
  "ad_interstitial_session_max": 5,
  "ad_native_feed_interval": 5,
  "ad_mrec_screens": ["TripList", "TripDetail", "Feed"],
  "ad_reward_points": ["insights", "weather", "recommendations"],
  "ad_enabled": true
}
```

서버에서 실시간으로 빈도, 배치, 포맷을 변경 가능 → 앱 업데이트 없이 최적화

##### 4-2. A/B 테스트 실험 목록

| 실험 | 변수 A | 변수 B | 측정 지표 |
|------|--------|--------|----------|
| 배너 vs MREC | 320×50 | 300×250 | eCPM, 이탈률 |
| 전면 빈도 | 3분 | 5분 | 이탈률, 세션 시간 |
| 피드 네이티브 간격 | 5번째마다 | 8번째마다 | CTR, 스크롤 깊이 |
| 리워드 위치 | 인사이트만 | 인사이트+날씨+추천 | 참여율, eCPM |
| 배너 리프레시 | 30초 | 60초 | 임프레션, fill rate |

---

#### Phase 5: 미디에이션 + 고급 최적화 (2주)

**목표**: 복수 네트워크로 fill rate 99%+ 달성, eCPM 극대화

| # | 작업 | 네트워크 | 예상 효과 |
|---|------|---------|----------|
| 5-1 | **AdMob 미디에이션 설정** | Meta Audience Network | fill rate +10% |
| 5-2 | **Unity Ads 추가** | Unity Ads | 리워드 eCPM 경쟁 |
| 5-3 | **AppLovin MAX** | AppLovin | 워터폴 최적화 |
| 5-4 | **Open Bidding** | 실시간 경매 | eCPM +20-40% |

**미디에이션 우선순위**:
```
1순위: AdMob (기본) — 이미 구현됨
2순위: Meta Audience Network — 높은 fill rate, 여행 카테고리 강세
3순위: Unity Ads — 리워드 비디오 전문
4순위: AppLovin — 전면/리워드 경쟁력
```

---

## 4. 화면별 최적 광고 배치 (최종 설계)

### 4.1 HomeScreen

```
┌─────────────────────────────────┐
│ [상단 히어로 — 환영 메시지]      │
│                                 │
│ [인기 여행지 추천 카드]           │
│ [인기 여행지 추천 카드]           │
│ [🏷️ Sponsored 네이티브 광고]    │  ← NEW: 네이티브 (Phase 2)
│                                 │
│ [최근 여행 카드]                  │
│                                 │
│ [📺 리워드: AI 추천 잠금해제]    │  ← NEW: 리워드 (Phase 1)
│                                 │
│ [배너 광고 (adaptive)]           │  ← 기존 유지
└─────────────────────────────────┘
```

### 4.2 TripListScreen

```
┌─────────────────────────────────┐
│ [여행 1]                         │
│ [여행 2]                         │
│ [MREC 300×250 광고]              │  ← 변경: 배너→MREC (Phase 1)
│ [여행 3]                         │
│ [여행 4]                         │
│ [여행 5]                         │
│ [여행 6]                         │
│ [MREC 300×250 광고]              │  ← NEW: 7번째 뒤 (Phase 1)
│ [여행 7]                         │
│ ...                             │
└─────────────────────────────────┘
```

### 4.3 TripDetailScreen

```
┌─────────────────────────────────┐
│ [여행 헤더 + 커버 이미지]        │
│ [제휴 링크: 호텔/체험 예약]      │  ← 기존 (최고 수익 잠재력)
│ [MREC 광고]                     │  ← 변경: 배너→MREC
│                                 │
│ [1일차 일정]                     │
│ [2일차 일정]                     │
│ [3일차 일정]                     │
│ [🏷️ 관련 체험 네이티브 광고]    │  ← NEW: 네이티브 (Phase 2)
│ [4일차 일정]                     │
│ ...                             │
│ [📺 리워드: 7일 날씨 예보]      │  ← NEW: 리워드 (Phase 1)
│ [배너 광고 (하단)]               │  ← 기존 유지
└─────────────────────────────────┘
```

### 4.4 FeedScreen (소셜 피드)

```
┌─────────────────────────────────┐
│ [피드 1]                         │
│ [피드 2]                         │
│ [피드 3]                         │
│ [피드 4]                         │
│ [🏷️ Sponsored 네이티브 광고]    │  ← NEW: 5번째마다 (Phase 2)
│ [피드 5]                         │
│ ...                             │
│ [피드 9]                         │
│ [🏷️ Sponsored 네이티브 광고]    │  ← 10번째
│ [피드 10]                        │
│ ...                             │
└─────────────────────────────────┘
```

### 4.5 CreateTripScreen

```
┌─────────────────────────────────┐
│ [여행 생성 폼]                   │
│                                 │
│ [📺 리워드: 여행지 인사이트]     │  ← 기존 유지
│                                 │
│ [생성 버튼]                      │
│                                 │
│ → 생성 완료 후 전면 광고         │  ← 기존 유지
└─────────────────────────────────┘
```

---

## 5. 수익 예측 모델

### 5.1 현재 vs 개선 후 비교 (1,000 DAU 기준)

| 포맷 | 현재 월 수익 | 개선 후 월 수익 | 변화 |
|------|------------|--------------|------|
| **배너** (4곳, $1 eCPM) | $120 | — | — |
| **MREC** (배너 교체+추가) | — | $270 | +$150 |
| **전면** (2곳, $6 eCPM) | $36 | $54 | +$18 |
| **앱오픈** (1곳, $7 eCPM) | $21 | $21 | 유지 |
| **리워드** (1곳→3곳, $20 eCPM) | $10 | $30 | +$20 |
| **네이티브** (0곳→4곳, $4 eCPM) | $0 | $96 | +$96 |
| **합계** | **$187** | **$471** | **+152%** |

### 5.2 규모별 월 수익 예측 (개선 후)

| DAU | 배너/MREC | 전면 | 앱오픈 | 리워드 | 네이티브 | **합계** |
|-----|----------|------|--------|--------|---------|---------|
| 100 | $27 | $5 | $2 | $3 | $10 | **$47** |
| 1,000 | $270 | $54 | $21 | $30 | $96 | **$471** |
| 5,000 | $1,350 | $270 | $105 | $150 | $480 | **$2,355** |
| 10,000 | $2,700 | $540 | $210 | $300 | $960 | **$4,710** |

> 가정: Tier-1 50%, Tier-2/3 50% 혼합 eCPM, 세션당 3 페이지뷰, 프리미엄 전환율 2%

---

## 6. 구현 우선순위 및 타임라인

| 순서 | Phase | 예상 소요 | 예상 수익 증가 | 난이도 |
|------|-------|----------|--------------|--------|
| 1 | **Phase 1**: 배너→MREC + 리프레시 + 리워드 추가 | 1-2일 | +50% | 낮음 |
| 2 | **Phase 2**: 네이티브 광고 컴포넌트 + 피드/상세 삽입 | 3-5일 | +40% | 중간 |
| 3 | **Phase 3**: 전면 광고 최적화 + 전환 포인트 추가 | 2-3일 | +15% | 낮음 |
| 4 | **Phase 4**: Firebase A/B 테스트 + 대시보드 | 1주 | +20-30% (장기) | 높음 |
| 5 | **Phase 5**: 미디에이션 (Meta, Unity, AppLovin) | 2주 | +20-40% | 높음 |

---

## 7. 사용자 경험 보호 가이드라인

### 7.1 절대 하지 말 것

- 콘텐츠 로딩 중 전면 광고 표시
- 네비게이션 직후 즉시 전면 광고
- 초기 뷰포트의 15% 이상 광고 차지
- 배너 30초 미만 리프레시
- 닫기 버튼 없는 광고
- 광고와 콘텐츠 버튼이 겹치는 배치

### 7.2 반드시 지킬 것

- 전면 광고는 **행동 완료 후** (생성, 수정, 공유 등)에만
- 리워드 광고는 **항상 사용자 자발적 클릭**으로만
- 네이티브 광고에 **"Sponsored" 라벨 필수**
- 세션 초반 5분은 **전면 광고 억제**
- Premium 사용자는 **모든 광고 0**

### 7.3 이탈률 모니터링 지표

| 지표 | 경고 기준 | 즉시 조치 |
|------|----------|----------|
| 세션 시간 감소 | -15% 이상 | 빈도 감소 |
| DAU 하락 | -10% 이상 | 전면 광고 중단 |
| 앱 삭제율 | 5% 이상 | 전면 + 앱오픈 중단 |
| 부정적 리뷰 | "광고 너무 많다" 2건+ | 빈도 50% 감소 |

---

## 8. AdSense (웹) 최적화

### 8.1 현재 웹 광고 현황

- 단일 슬롯 (`2397004834`) — auto 포맷
- 38개 정적 HTML 페이지 + React SPA
- RPM 미측정 (승인 대기 중)

### 8.2 웹 광고 개선 계획

| # | 작업 | 현재 | 개선 | 예상 효과 |
|---|------|------|------|----------|
| W1 | **멀티 슬롯** | 1개 | 3개 (상단, 인라인, 사이드바) | RPM 2-3배 |
| W2 | **앵커 광고** | 없음 | 하단 고정 앵커 | 지속 노출 |
| W3 | **자동 광고** | 수동 배치 | AdSense Auto Ads 병행 | AI 최적 배치 |
| W4 | **스크롤 트리거** | 없음 | 70% 스크롤 시 추가 광고 로드 | RPM +20-30% |

### 8.3 웹 페이지별 슬롯 배치

```html
<!-- 여행 상세 페이지 (가장 체류 시간 긴 페이지) -->
<header>
  [상단 리더보드 728×90]          ← 슬롯 1 (above the fold)
</header>

<article>
  [일정 Day 1-2]
  [인라인 MREC 300×250]           ← 슬롯 2 (in-content)
  [일정 Day 3-4]
  [인라인 MREC 300×250]           ← 슬롯 3 (in-content)
  [일정 Day 5+]
</article>

<footer>
  [하단 앵커 320×50]              ← 슬롯 4 (sticky bottom)
</footer>
```

---

## 9. 제휴 링크 최적화

### 9.1 현재 상태

- 6개 파트너 컴포넌트 구현 완료
- Affiliate ID 모두 미설정 (수익 $0)
- 클릭 추적 백엔드 구현 완료

### 9.2 제휴 링크 CTR 향상 전략

| # | 전략 | 현재 | 개선 |
|---|------|------|------|
| R1 | **컨텍스트 기반 노출** | 일정 상단 고정 | 일정 내 관련 시점에 인라인 |
| R2 | **가격 비교 카드** | 단일 링크 | 2-3개 파트너 가격 비교 |
| R3 | **딥링크** | 검색 페이지 | 특정 호텔/체험 직접 링크 |
| R4 | **시각적 강조** | 텍스트 링크 | 이미지+별점+가격 카드 |

**개선된 제휴 카드 디자인**:

```
┌─────────────────────────────────┐
│ 🏨 도쿄 숙소 비교                │
│                                 │
│ ┌──────────┐ ┌──────────┐      │
│ │Booking   │ │Expedia   │      │
│ │₩89,000~  │ │₩92,000~  │      │
│ │★4.5 8.7점│ │★4.3      │      │
│ │[예약하기] │ │[예약하기] │      │
│ └──────────┘ └──────────┘      │
└─────────────────────────────────┘
```

---

## 10. 참고 자료

### 벤치마킹 출처
- [AVOW: Travel App Advertising Strategy 2026](https://avow.tech/blog/travel-apps-advertising-when-and-what-travelers-book/)
- [Sensor Tower: State of Mobile Travel Apps 2025](https://sensortower.com/blog/2025-state-of-mobile-travel-apps)
- [Business of Apps: Interstitial Ads 2025](https://www.businessofapps.com/ads/interstitial/)
- [Business of Apps: Mobile Advertising CPM Rates](https://www.businessofapps.com/ads/research/mobile-app-advertising-cpm-rates/)
- [Adnimation: Mobile Optimization 2025](https://www.adnimation.com/mobile-optimization-in-2025-turning-every-tap-into-revenue/)
- [Yango Ads: Mobile Interstitial Ads](https://yango-ads.com/blog/mobile-interstitial-ads)
- [Yango Ads: Mobile Banner Ads](https://yango-ads.com/blog/mobile-banner-ads)
- [Yango Ads: Rewarded Video Ads](https://yango-ads.com/blog/rewarded-video-ads-for-mobile-apps)
- [Google AdMob: Native Ads Playbook](https://admob.google.com/home/resources/native-ads-playbook/)
- [MonetizeMore: App Ad Revenue 2026](https://www.monetizemore.com/blog/how-much-ad-revenue-can-apps-generate/)
- [Setupad: Increase AdSense RPM](https://setupad.com/blog/increase-adsense-rpm/)
- [The Drum: Travel Advertising Trends 2026](https://www.thedrum.com/industry-insight/five-trends-that-will-redefine-travel-advertising-in-2026)

---

*이 문서는 각 Phase 구현 후 실측 데이터 기반으로 업데이트됩니다.*
*최종 수정: 2026-02-28*
