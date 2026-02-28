# MyTravel 수익화 플래너 (Sale Planner)

> 최종 점검일: 2026-02-28
> 상태: 진행 중

---

## 1. 수익화 채널 현황 총괄

| 채널 | 구현 상태 | 운영 상태 | 월 예상 수익 | 우선순위 |
|------|----------|----------|-------------|---------|
| Google AdSense (웹) | ✅ 100% | ⏳ 승인 대기 | 출시 후 측정 | P0 |
| Google AdMob (네이티브) | ✅ 100% | ⏳ 프로덕션 미테스트 | 출시 후 측정 | P0 |
| 프리미엄 구독 (RevenueCat) | ✅ 100% | 🚫 플래그 OFF | $3.99/월, $29.99/년 | P1 |
| 제휴 링크 (6개 파트너) | ✅ 100% | ⏳ 파트너 ID 미등록 | CPA 기반 | P2 |

---

## 2. 채널별 상세 현황

### 2.1 Google AdSense (웹)

**구현 완료 항목:**
- [x] AdSense Client ID 설정: `ca-pub-7330738950092177`
- [x] AdSense Slot ID 설정: `2397004834`
- [x] 정적 HTML 38개 파일 광고 삽입 (blog 15 + guides 20 + landing/about/faq)
- [x] React SPA용 AdSense 컴포넌트 (`AdSense.tsx`)
- [x] ads.txt / app-ads.txt 설정 완료
- [x] nginx CSP 헤더에 AdSense 도메인 허용
- [x] 프리미엄 사용자 광고 숨김 (`isPremium → return null`)
- [x] Cloudflare WAF 예외 규칙 — `/ads.txt`, `/robots.txt` Skip 설정 (2026-02-28)
- [x] 개발 모드 테스트 플레이스홀더 (`__DEV__` 감지)
- [x] nginx ads.txt 캐시 헤더 (1일)

**미완료/대기 항목:**
- [ ] **AdSense 사이트 승인** — mytravel-planner.com (준비 중 → 승인됨)
- [ ] 광고 노출 확인 (현재 `data-ad-status: unfilled`)
- [ ] 다중 슬롯 ID 분리 (현재 단일 슬롯으로 전 페이지 운영)
- [ ] A/B 테스트 인프라 구축
- [ ] 광고 차단기 감지/대응

**핵심 파일:**
| 파일 | 역할 |
|------|------|
| `frontend/src/components/ads/AdSense.tsx` | React AdSense 컴포넌트 |
| `frontend/src/components/ads/AdBanner.tsx` | 통합 광고 라우터 (웹→AdSense, 네이티브→AdMob) |
| `frontend/public/ads.txt` | AdSense 인증 파일 |
| `frontend/nginx.conf:14` | CSP 헤더 (AdSense 도메인 허용) |
| `frontend/app.config.js:115-116` | 환경변수 → 앱 설정 매핑 |

---

### 2.2 Google AdMob (네이티브 앱)

**구현 완료 항목:**
- [x] 배너 광고 (`AdMobBanner.native.tsx`)
- [x] 전면 광고 (`useInterstitialAd.native.ts`)
- [x] 보상형 광고 (`useRewardedAd.native.ts`)
- [x] 앱 오픈 광고 (`useAppOpenAd.native.ts`)
- [x] 빈도 제한: 3분 간격, 세션당 최대 5회 (`adFrequency.ts`)
- [x] GDPR/UMP 동의 흐름 (`initAds.native.ts`)
- [x] iOS ATT 추적 투명성 요청
- [x] 프리미엄 사용자 광고 차단
- [x] 웹 플랫폼용 no-op 스텁 (`.tsx` vs `.native.tsx`)
- [x] 개발 모드 TestIds 자동 사용

**광고 단위 ID (프로덕션):**

| 유형 | iOS | Android |
|------|-----|---------|
| 배너 | `ca-app-pub-…/6974109326` | `ca-app-pub-…/6507205462` |
| 전면 | `ca-app-pub-…/6010288116` | `ca-app-pub-…/1039256361` |
| 앱 오픈 | `ca-app-pub-…/6405873931` | `ca-app-pub-…/4051173331` |
| 보상형 | `ca-app-pub-…/7718955609` | `ca-app-pub-…/9032037274` |

**앱 ID:**
- iOS: `ca-app-pub-7330738950092177~7468498577`
- Android: `ca-app-pub-7330738950092177~5475101490`

**광고 배치 위치:**
| 화면 | 광고 유형 | 조건 |
|------|----------|------|
| HomeScreen | 배너 (adaptive) | 비프리미엄 |
| TripListScreen | 배너 (adaptive) | trips > 0, 비프리미엄 |
| TripDetailScreen | 배너 x2 (adaptive + banner) | 비프리미엄 |
| CreateTripScreen | 전면 (저장 후) | 빈도 제한 충족 시 |
| CreateTripScreen | 보상형 (AI 보상) | 사용자 선택 시 |
| 앱 포그라운드 진입 | 앱 오픈 | 3분+ 백그라운드 후 |

**미완료/대기 항목:**
- [ ] **프로덕션 빌드에서 실제 광고 노출 테스트**
- [ ] AdMob 콘솔에서 GDPR 메시지 설정 (UMP 동의 폼 활성화)
- [ ] 보상형 광고 실제 보상 흐름 검증
- [ ] 앱 오픈 광고 빈도 최적화 (현재 3분, A/B 테스트 필요)
- [ ] eCPM 모니터링 대시보드 구축

---

### 2.3 프리미엄 구독 (RevenueCat IAP)

**구현 완료 항목:**
- [x] RevenueCat SDK 연동 (`revenueCat.ts`, `revenueCat.web.ts`)
- [x] PremiumContext 상태 관리 (isPremium, aiTripsRemaining 등)
- [x] PaywallModal UI (월간/연간 선택, 혜택 비교표)
- [x] SubscriptionScreen (현재 플랜 표시, AI 사용량 바)
- [x] PremiumBadge 컴포넌트 (크라운 아이콘 + PRO)
- [x] 백엔드 SubscriptionService (RevenueCat 웹훅 처리)
- [x] 백엔드 PremiumGuard (Redis 캐시 5분 TTL)
- [x] AI 여행 제한: 무료 3회/월, 프리미엄 무제한
- [x] 월간 카운터 리셋 (매월 1일 0시 CRON)
- [x] 구독 복원 기능
- [x] 웹 사용자 → 모바일 앱 안내
- [x] 기능 플래그: `PREMIUM_ENABLED = false`

**구독 플랜:**
| 플랜 | 가격 | 혜택 |
|------|------|------|
| Free | $0 | 광고 표시, AI 3회/월, 기본 기능 |
| Monthly | $3.99/월 | 무광고, AI 무제한, PRO 배지 |
| Yearly | $29.99/년 | 동일 (37% 할인) |

**프리미엄 전용 혜택:**
1. AI 여행 생성 무제한
2. 모든 광고 제거
3. 프리미엄 배지 (크라운)
4. (동일) 여행 생성, 소셜, 비용 관리

**미완료/대기 항목 (사업자 등록 필수):**
- [ ] **사업자 등록 완료** (한국 개인사업자 or 법인)
- [ ] Apple App Store Connect — IAP 상품 등록 (월간/연간)
- [ ] Google Play Console — IAP 상품 등록
- [ ] RevenueCat 대시보드 — Offerings/Entitlements 설정
- [ ] 환경변수 설정: `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`
- [ ] 환경변수 설정: `REVENUECAT_WEBHOOK_SECRET`
- [ ] `PREMIUM_ENABLED = true` 플래그 전환
- [ ] 결제 흐름 E2E 테스트 (Sandbox → Production)
- [ ] 구독 갱신/취소/만료 시나리오 테스트

**핵심 파일:**
| 파일 | 역할 |
|------|------|
| `frontend/src/services/revenueCat.ts` | SDK 초기화, 구매, 복원 |
| `frontend/src/contexts/PremiumContext.tsx` | 프리미엄 상태 관리 |
| `frontend/src/components/PaywallModal.tsx` | 구독 페이월 UI |
| `frontend/src/constants/config.ts:17` | `PREMIUM_ENABLED` 플래그 |
| `backend/src/subscription/` | 웹훅, 상태 조회, AI 제한 |
| `backend/src/auth/guards/premium.guard.ts` | Redis 캐시 프리미엄 검증 |

---

### 2.4 제휴 링크 (Affiliate)

**구현 완료 항목:**
- [x] AffiliateLink 컴포넌트 (`AffiliateLink.tsx`, 314줄)
- [x] 6개 파트너 URL 빌더 (destination, check-in/out, travelers 파라미터)
- [x] 클릭 추적 백엔드 (`affiliate_clicks` 테이블)
- [x] 전환 추적 필드 (converted, convertedAt, conversionValue, commission)
- [x] RevenueDashboardScreen (관리자 분석 대시보드)
- [x] TripDetailScreen에 배치 (숙소: Booking+Expedia, 체험: Viator+Klook)

**파트너 현황:**
| 파트너 | URL 빌더 | 파트너 ID | 상태 |
|--------|----------|----------|------|
| Booking.com | ✅ destination, checkin, checkout, travelers | `AFFILIATE_BOOKING_ID` | ⏳ 미등록 |
| Expedia | ✅ destination, startDate, endDate, adults | `AFFILIATE_EXPEDIA_ID` | ⏳ 미등록 |
| Hotels.com | ✅ search redirect | `AFFILIATE_HOTELS_ID` | ⏳ 미등록 |
| Airbnb | ✅ destination, date, guest | `AFFILIATE_AIRBNB_ID` | ⏳ 미등록 |
| Viator | ✅ destination | `AFFILIATE_VIATOR_ID` | ⏳ 미등록 |
| Klook | ✅ destination | `AFFILIATE_KLOOK_ID` | ⏳ 미등록 |

**미완료/대기 항목:**
- [ ] 각 파트너사 제휴 프로그램 가입 (개별 신청)
- [ ] 파트너 ID 발급 후 환경변수 설정
- [ ] 실제 추적 링크 동작 검증
- [ ] 전환율 모니터링 설정
- [ ] 제휴 수익 대시보드 실데이터 연동

---

## 3. 수익화 로드맵

### Phase 0: 즉시 실행 (이번 주)
> 목표: 광고 수익 활성화

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 0.1 | AdSense 사이트 승인 확인 | 사용자 | ⏳ 대기 | Cloudflare WAF 예외 설정 완료 (2/28), 재크롤링 대기 |
| 0.2 | AdMob 콘솔 GDPR 메시지 설정 | 사용자 | ✅ 완료 | 게시 완료 (2/28), 앱 2개(Android+iOS) 적용, 영어(en) |
| 0.3 | 프로덕션 APK/AAB로 AdMob 실광고 테스트 | 사용자 | ❌ 미시작 | 내부 테스트 트랙 활용 |
| 0.4 | assetlinks.json SHA-256 값 교체 | 사용자 | ✅ 완료 | SHA-256 반영 + 서버 배포 완료 (2/28) |
| 0.5 | Play Console 콘텐츠 등급(IARC) 설정 | 사용자 | ✅ 완료 | 2/22 설정 완료 |
| 0.6 | Play Console 데이터 안전 섹션 작성 | 사용자 | ✅ 완료 | 2/22 설정 완료 (앱 콘텐츠 선언 10개 모두 조치됨) |

### Phase 1: 단기 (1-2주)
> 목표: 앱 스토어 정식 출시 + 기본 수익 확보

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 1.1 | Google Play 프로덕션 트랙 출시 | 사용자 | ❌ 미시작 | 내부 테스트 → 프로덕션 승급 |
| 1.2 | Apple App Store 빌드/제출 (선택) | 사용자 | ❌ 미시작 | Apple 개발자 계정 필요 ($99/년) |
| 1.3 | AdSense 승인 후 광고 노출 확인 | 사용자 | ⏳ 대기 | 승인 후 24h 내 노출 시작 |
| 1.4 | AdMob eCPM 초기 데이터 수집 | 자동 | ⏳ 대기 | 1주일 데이터 축적 필요 |
| 1.5 | Cloudflare WAF — /ads.txt 보안 규칙 예외 | 사용자 | ✅ 완료 | Custom rule: Skip all WAF for /ads.txt, /robots.txt (2/28) |
| 1.6 | 웹 SEO 트래픽 모니터링 시작 | 사용자 | ❌ 미시작 | Google Search Console 등록 |

### Phase 2: 중기 (1-2개월)
> 목표: 프리미엄 구독 런칭 + 수익 다각화

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 2.1 | 사업자 등록 (개인사업자 or 법인) | 사용자 | ❌ 미시작 | IAP 필수 요건 |
| 2.2 | Apple App Store Connect IAP 상품 등록 | 사용자 | ❌ 미시작 | 월간 $3.99, 연간 $29.99 |
| 2.3 | Google Play Console IAP 상품 등록 | 사용자 | ❌ 미시작 | 동일 가격 |
| 2.4 | RevenueCat 대시보드 설정 | 사용자 | ❌ 미시작 | Offerings, Entitlements, Webhook |
| 2.5 | 환경변수 설정 (RevenueCat 키 3종) | 사용자 | ❌ 미시작 | iOS key, Android key, Webhook secret |
| 2.6 | `PREMIUM_ENABLED = true` 전환 + 배포 | 개발 | ❌ 미시작 | config.ts 수정 |
| 2.7 | Sandbox 결제 E2E 테스트 | 사용자 | ❌ 미시작 | 구매→갱신→취소→만료 시나리오 |
| 2.8 | 프로덕션 결제 검증 | 사용자 | ❌ 미시작 | 실제 카드 테스트 |
| 2.9 | 제휴 프로그램 가입 (Booking.com 우선) | 사용자 | ❌ 미시작 | 가장 높은 수수료율 |
| 2.10 | 제휴 파트너 ID 환경변수 설정 | 개발 | ❌ 미시작 | 가입 완료 후 |

### Phase 3: 장기 (3개월+)
> 목표: 수익 최적화 + 신규 채널 개척

| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 3.1 | AdSense 다중 슬롯 분리 | 개발 | ❌ 미시작 | 페이지별 맞춤 광고 타겟팅 |
| 3.2 | AdMob 앱 오픈 광고 빈도 A/B 테스트 | 개발 | ❌ 미시작 | 3분 vs 5분 vs 10분 |
| 3.3 | 광고 차단기 감지/대응 | 개발 | ❌ 미시작 | 우회 메시지 or 프리미엄 유도 |
| 3.4 | 보상형 광고 활용 확대 | 개발 | ❌ 미시작 | AI 생성 외 추가 보상 포인트 |
| 3.5 | AdMob 미디에이션 도입 | 개발 | ❌ 미시작 | Meta, Unity, AppLovin 등 |
| 3.6 | 제휴 전환율 분석 + 최적화 | 데이터 | ❌ 미시작 | 1개월 데이터 축적 후 |
| 3.7 | 스폰서십/프로모션 제안 | 사용자 | ❌ 미시작 | 여행사/호텔 직접 제안 |
| 3.8 | 웹 결제 (Stripe) 연동 | 개발 | ❌ 미시작 | 웹 사용자 프리미엄 구독 |
| 3.9 | 수익 분석 대시보드 구축 | 개발 | ❌ 미시작 | 채널별 RPM, ARPU, LTV 추적 |
| 3.10 | 가격 A/B 테스트 | 데이터 | ❌ 미시작 | $2.99 vs $3.99 vs $4.99 |

---

## 4. 채널별 예상 수익 모델

### 4.1 광고 수익 (AdSense + AdMob)

**웹 (AdSense) 예측:**
| MAU | 페이지뷰/사용자 | RPM (예상) | 월 수익 |
|-----|---------------|-----------|---------|
| 1,000 | 3 | $1.50 | $4.50 |
| 10,000 | 3 | $2.00 | $60 |
| 50,000 | 4 | $2.50 | $500 |
| 100,000 | 4 | $3.00 | $1,200 |

**네이티브 (AdMob) 예측:**
| DAU | 배너 노출/일 | 전면 노출/일 | eCPM | 월 수익 |
|-----|------------|------------|------|---------|
| 100 | 300 | 50 | $1.00 / $5.00 | $16.50 |
| 1,000 | 3,000 | 500 | $1.50 / $8.00 | $255 |
| 10,000 | 30,000 | 5,000 | $2.00 / $10.00 | $3,300 |

### 4.2 프리미엄 구독 수익

| 유료 전환율 | MAU | 월간 구독자 | 연간 구독자 | 월 수익 |
|------------|-----|-----------|-----------|---------|
| 2% | 1,000 | 10 | 10 | $64.90 |
| 3% | 10,000 | 150 | 150 | $972 |
| 5% | 50,000 | 1,250 | 1,250 | $8,120 |

### 4.3 제휴 수익

| 월 클릭수 | 예약 전환율 | 평균 수수료 | 월 수익 |
|----------|-----------|-----------|---------|
| 500 | 2% | $5 | $50 |
| 5,000 | 3% | $8 | $1,200 |
| 20,000 | 4% | $10 | $8,000 |

---

## 5. 환경변수 체크리스트

### 현재 설정 완료
```env
# AdSense (웹)
ADSENSE_CLIENT_ID=ca-pub-7330738950092177
ADSENSE_DEFAULT_SLOT=2397004834

# AdMob (네이티브) — 앱 ID
ADMOB_IOS_APP_ID=ca-app-pub-7330738950092177~7468498577
ADMOB_ANDROID_APP_ID=ca-app-pub-7330738950092177~5475101490

# AdMob — 광고 단위 ID (8개, 모두 app.config.js에 하드코딩 fallback)
ADMOB_IOS_BANNER_ID=ca-app-pub-7330738950092177/6974109326
ADMOB_ANDROID_BANNER_ID=ca-app-pub-7330738950092177/6507205462
ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-7330738950092177/6010288116
ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-7330738950092177/1039256361
ADMOB_IOS_APP_OPEN_ID=ca-app-pub-7330738950092177/6405873931
ADMOB_ANDROID_APP_OPEN_ID=ca-app-pub-7330738950092177/4051173331
ADMOB_IOS_REWARDED_ID=ca-app-pub-7330738950092177/7718955609
ADMOB_ANDROID_REWARDED_ID=ca-app-pub-7330738950092177/9032037274
```

### 설정 필요 (프리미엄 런칭 시)
```env
# RevenueCat
REVENUECAT_IOS_KEY=          # RevenueCat 대시보드 → API Keys → iOS
REVENUECAT_ANDROID_KEY=      # RevenueCat 대시보드 → API Keys → Android
REVENUECAT_WEBHOOK_SECRET=   # RevenueCat 대시보드 → Integrations → Webhook

# 제휴 프로그램 (가입 후)
AFFILIATE_BOOKING_ID=        # Booking.com Partner Centre
AFFILIATE_EXPEDIA_ID=        # Expedia Affiliate Network
AFFILIATE_HOTELS_ID=         # Hotels.com Affiliate
AFFILIATE_AIRBNB_ID=         # Airbnb Associates
AFFILIATE_VIATOR_ID=         # Viator Partner Program
AFFILIATE_KLOOK_ID=          # Klook Affiliate Platform
```

---

## 6. 기술 아키텍처 요약

```
┌─────────────────────────────────────────────────────────────┐
│                    MyTravel 수익화 아키텍처                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─── 웹 (브라우저) ───┐   ┌─── 네이티브 (iOS/Android) ───┐ │
│  │                     │   │                              │ │
│  │  AdSense            │   │  AdMob                       │ │
│  │  ├ 정적 HTML (38p)  │   │  ├ 배너 (3 화면)             │ │
│  │  └ React SPA        │   │  ├ 전면 (저장 후)            │ │
│  │                     │   │  ├ 보상형 (AI 보상)          │ │
│  │  제휴 링크           │   │  └ 앱 오픈 (포그라운드)      │ │
│  │  └ 6개 파트너        │   │                              │ │
│  │                     │   │  RevenueCat IAP              │ │
│  │  ※ 웹 결제 미지원   │   │  ├ 월간 $3.99               │ │
│  │  (모바일 앱 유도)    │   │  └ 연간 $29.99              │ │
│  │                     │   │                              │ │
│  └─────────────────────┘   └──────────────────────────────┘ │
│                          │                                   │
│                    ┌─────┴─────┐                             │
│                    │  Backend  │                              │
│                    │  NestJS   │                              │
│                    ├───────────┤                              │
│                    │ Subscription│                            │
│                    │ Service    │                              │
│                    │ ├ 웹훅 처리│                              │
│                    │ ├ AI 제한  │                              │
│                    │ ├ 캐시(Redis)│                            │
│                    │ └ 월간 리셋│                              │
│                    │           │                              │
│                    │ Affiliate │                              │
│                    │ ├ 클릭 추적│                              │
│                    │ └ 전환 기록│                              │
│                    └───────────┘                             │
│                          │                                   │
│                    ┌─────┴─────┐                             │
│                    │ PostgreSQL│                              │
│                    │ + Redis   │                              │
│                    └───────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 리스크 및 대응 전략

| 리스크 | 영향도 | 대응 전략 |
|--------|-------|----------|
| AdSense 승인 지연/거부 | 높음 | 콘텐츠 품질 강화, 정책 준수 재확인, 재신청 |
| AdMob 정책 위반 (광고 배치) | 높음 | 배너: 콘텐츠와 분리, 전면: 빈도 제한 준수, 보상형: 사용자 선택 |
| IAP 심사 거부 (Apple) | 중간 | 가이드라인 사전 검토, 가격 정책 일관성, 복원 기능 필수 |
| 광고 차단기 사용률 증가 | 중간 | 감지 후 프리미엄 유도 메시지, 보상형 광고 대안 제시 |
| 제휴 프로그램 가입 거부 | 낮음 | 트래픽 확보 후 재신청, 대체 파트너 탐색 |
| 낮은 전환율 | 중간 | A/B 테스트, 가격 조정, 혜택 강화, 온보딩 최적화 |
| RevenueCat 서비스 장애 | 낮음 | 웹훅 재시도 설정, 로컬 캐시 유지, 수동 복구 절차 |

---

## 8. KPI 지표 정의

### 광고 KPI
| 지표 | 정의 | 목표 (3개월) |
|------|------|-------------|
| AdSense RPM | 1000 페이지뷰당 수익 | > $2.00 |
| AdMob eCPM (배너) | 1000 노출당 수익 | > $1.50 |
| AdMob eCPM (전면) | 1000 노출당 수익 | > $8.00 |
| 광고 채움률 | 요청 대비 노출 비율 | > 80% |
| 사용자당 광고 노출 | 일일 평균 | 3-5회 |

### 프리미엄 KPI
| 지표 | 정의 | 목표 (6개월) |
|------|------|-------------|
| 유료 전환율 | MAU 대비 구독자 비율 | > 2% |
| ARPU | 사용자당 평균 수익 | > $0.15/월 |
| LTV | 사용자 생애 가치 | > $3.00 |
| 이탈률 (Churn) | 월간 구독 취소율 | < 10% |
| 시험 → 유료 전환 | 무료 체험 후 결제 | > 15% |

### 제휴 KPI
| 지표 | 정의 | 목표 |
|------|------|------|
| CTR | 제휴 링크 클릭률 | > 3% |
| 전환율 | 클릭 → 예약 완료 | > 2% |
| 평균 커미션 | 건당 수수료 | > $5 |

---

## 9. 즉시 액션 아이템 (체크리스트)

### 이번 주 필수 (P0)
- [ ] AdSense 사이트 승인 상태 확인 (매일 체크)
- [ ] AdMob 콘솔 → 개인정보 보호 및 메시지 → GDPR 메시지 생성
- [ ] Play Console → 앱 콘텐츠 → 콘텐츠 등급(IARC) 설문지 작성
- [ ] Play Console → 앱 콘텐츠 → 데이터 안전 섹션 작성
- [ ] Play Console → 앱 무결성 → 앱 서명 SHA-256 복사 → assetlinks.json 교체
- [ ] 프로덕션 APK 설치 → 실제 광고 노출 확인

### 다음 주 (P1)
- [ ] Google Play 프로덕션 트랙 출시 준비 (스크린샷, 설명, 카테고리)
- [ ] Cloudflare WAF → /ads.txt 경로 보안 규칙 예외 처리
- [ ] Google Search Console 사이트 등록 (웹 트래픽 모니터링)
- [ ] AdMob 미디에이션 검토 (트래픽 규모에 따라)

### 이번 달 (P2)
- [ ] 사업자 등록 절차 시작
- [ ] Booking.com 제휴 프로그램 가입 신청
- [ ] RevenueCat 계정 생성 + 프로젝트 설정
- [ ] Apple 개발자 프로그램 가입 검토 ($99/년)

---

*이 문서는 진행 상황에 따라 지속적으로 업데이트됩니다.*
*체크박스를 [ ] → [x]로 변경하여 완료 항목을 추적하세요.*
