# Priority 2: 비즈니스 모델 구현 - 광고 수익 시스템

## 개요
CLAUDE.md의 비즈니스 모델 요구사항 "구글 에드센스 등과 연계하여 광고 수익 모델을 적용"을 구현했습니다.

**구현 완료일**: 2026-02-07
**우선순위**: Priority 2 (비즈니스 모델)
**상태**: Phase 1 웹용 구현 완료 ✅

## 구현 내용

### Phase 1: 웹용 광고 시스템 (완료)

#### 1. Google AdSense 컴포넌트
**파일**: `frontend/src/components/ads/AdSense.tsx` (신규, 216 lines)

**핵심 기능**:
- ✅ 웹 플랫폼 전용 AdSense 통합
- ✅ 테스트 모드 (개발 환경에서 자동 활성화)
- ✅ 다양한 광고 포맷 지원 (auto, rectangle, vertical, horizontal)
- ✅ 반응형 광고 지원
- ✅ 안전한 초기화 및 에러 핸들링

**주요 Props**:
```typescript
interface AdSenseProps {
  adSlot: string;                    // AdSense 광고 슬롯 ID
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  layout?: string;                   // 반응형 광고 레이아웃
  layoutKey?: string;               // 반응형 광고 레이아웃 키
  fullWidthResponsive?: boolean;    // 전체 너비 반응형 (기본: true)
  style?: any;                      // 커스텀 스타일
  testMode?: boolean;               // 테스트 모드 (기본: __DEV__)
}
```

**테스트 모드 기능**:
- 개발 환경에서 자동으로 활성화
- 실제 광고 대신 플레이스홀더 표시
- 광고 슬롯 정보 표시
- 계정 정지 위험 방지

**사용 예시**:
```tsx
<AdSense
  adSlot="1234567890"
  format="auto"
  fullWidthResponsive
  testMode={__DEV__}
/>
```

#### 2. 여행 제휴 링크 컴포넌트
**파일**: `frontend/src/components/ads/AffiliateLink.tsx` (신규, 279 lines)

**지원 제휴 파트너** (6개):
1. **Booking.com** - 숙박 예약 (최대 40% 마진 커미션)
2. **Expedia** - 항공/숙박/패키지 (최대 6% 커미션, 7일 쿠키)
3. **Hotels.com** - 숙박 예약 (Expedia Group)
4. **Airbnb** - 숙박 예약
5. **Viator** - 투어 & 액티비티
6. **Klook** - 투어 & 액티비티

**핵심 기능**:
- ✅ 자동 URL 파라미터 생성 (목적지, 날짜, 인원수)
- ✅ 클릭 트래킹 (콘솔 로그, Backend API 준비)
- ✅ 외부 링크 안전 오픈
- ✅ 제휴사별 커스터마이징 (아이콘, 색상)
- ✅ 다양한 버튼 스타일 (primary, secondary, outline)

**주요 Props**:
```typescript
interface AffiliateLinkProps {
  provider: 'booking' | 'expedia' | 'hotels' | 'airbnb' | 'viator' | 'klook';
  destination?: string;      // 여행지 (자동 검색 프리필)
  checkIn?: string;         // 체크인 날짜 (ISO format)
  checkOut?: string;        // 체크아웃 날짜 (ISO format)
  travelers?: number;       // 여행 인원 (기본: 2)
  label?: string;           // 커스텀 버튼 텍스트
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  showLogo?: boolean;       // 제휴사 아이콘 표시
  trackingId?: string;      // 분석용 추적 ID
  style?: any;
}
```

**제휴 URL 자동 생성 예시**:
```typescript
// Booking.com
https://www.booking.com/searchresults.html
  ?aid=YOUR_AFFILIATE_ID
  &ss=도쿄
  &checkin=2026-03-01
  &checkout=2026-03-05
  &group_adults=2
  &label=trip_123

// Expedia
https://www.expedia.com/Hotel-Search
  ?aid=YOUR_AFFILIATE_ID
  &destination=도쿄
  &startDate=2026-03-01
  &endDate=2026-03-05
  &adults=2
```

#### 3. TripDetailScreen 통합
**파일**: `frontend/src/screens/trips/TripDetailScreen.tsx`

**광고 배치 전략** (UX 최우선):

1. **제휴 링크 섹션** (여행 설명 카드 직후)
   - 위치: 일정 시작 전 자연스러운 배치
   - 표시: "숙소 & 액티비티 예약" 섹션
   - 버튼: Booking, Expedia, Viator, Klook
   - 데이터: 여행지, 날짜, 인원 자동 전달
   - 스타일: Outline 버튼으로 부담 감소

```tsx
<View style={styles.affiliateSection}>
  <View style={styles.affiliateSectionHeader}>
    <Icon name="bookmark-outline" />
    <Text>숙소 & 액티비티 예약</Text>
  </View>
  <Text>도쿄에서의 완벽한 여행을 위해</Text>

  <View style={styles.affiliateButtons}>
    <AffiliateLink provider="booking" destination={trip.destination} ... />
    <AffiliateLink provider="expedia" destination={trip.destination} ... />
    <AffiliateLink provider="viator" destination={trip.destination} ... />
    <AffiliateLink provider="klook" destination={trip.destination} ... />
  </View>
</View>
```

2. **AdSense 배너 #1** (제휴 링크 직후)
   - 위치: 일정 리스트 시작 전
   - 형식: Auto (반응형)
   - 테스트: 개발 환경에서 플레이스홀더 표시

3. **AdSense 배너 #2** (일정 리스트 끝)
   - 위치: 모든 일정 표시 후
   - 형식: Auto (반응형)
   - 조건: 일정이 있을 때만 표시

**스타일 추가**:
```typescript
affiliateSection: {
  marginHorizontal: 20,
  marginBottom: 24,
  padding: 20,
  borderRadius: 16,
  ...theme.shadows.sm,
},
affiliateSectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},
affiliateSectionTitle: {
  fontSize: 18,
  fontWeight: '700',
},
affiliateButtons: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 12,
},
```

#### 4. Export 설정
**파일**: `frontend/src/components/ads/index.ts` (신규)

```typescript
export { default as AdSense } from './AdSense';
export { default as AffiliateLink } from './AffiliateLink';
export type { AffiliateProvider } from './AffiliateLink';
```

## 구현 아키텍처

```
┌──────────────────────────────────────────────────┐
│         TripDetailScreen                         │
│  (여행 상세 화면)                                  │
└────────┬─────────────────────────────────────────┘
         │
         ├─► 제휴 링크 섹션
         │   ├─► AffiliateLink (Booking.com)
         │   │   └─► 클릭 시: URL 생성 → 트래킹 → 외부 오픈
         │   ├─► AffiliateLink (Expedia)
         │   ├─► AffiliateLink (Viator)
         │   └─► AffiliateLink (Klook)
         │
         ├─► AdSense 배너 #1
         │   └─► 테스트 모드: 플레이스홀더
         │       프로덕션: 실제 광고
         │
         ├─► 일정 리스트 (Itineraries)
         │
         └─► AdSense 배너 #2
             └─► 일정 있을 때만 표시
```

## 수익화 전략

### 1. 제휴 마케팅 수익
**Booking.com**:
- 커미션: 최대 40% 마진
- 트래킹: 세션 기반 (즉시 전환 중요)
- 타겟: 숙박 예약 사용자

**Expedia Group**:
- 커미션: 최대 6%
- 쿠키: 7일 (재방문 전환 가능)
- 브랜드: Hotels.com, VRBO, Agoda 포함
- 타겟: 항공/숙박 패키지 사용자

**Viator & Klook**:
- 커미션: 평균 8-12%
- 타겟: 투어 & 액티비티 예약 사용자

### 2. AdSense 광고 수익
**광고 배치**:
- 2개 배너 (일정 전/후)
- 반응형 광고로 모든 화면 크기 지원
- 자연스러운 콘텐츠 흐름 유지

**예상 수익**:
- CPM 기준: $1-5 (여행 카테고리)
- 1,000 페이지뷰 = $1-5 수익
- 월 10만 페이지뷰 = $100-500

### 3. 클릭 트래킹 (향후 구현)
```typescript
// TODO: Backend API 추가
await apiService.trackAffiliateClick({
  provider: 'booking',
  destination: '도쿄',
  trackingId: 'trip_123',
  userId: 'user_456',
  timestamp: new Date().toISOString(),
});
```

**분석 지표**:
- 클릭률 (CTR)
- 전환율 (Conversion Rate)
- 제휴사별 성과 비교
- 수익 대시보드

## 기술적 결정사항

### 1. AdSense vs AdMob 분리
- **웹**: AdSense (HTML 스크립트)
- **모바일 앱**: AdMob (react-native-google-mobile-ads)
- 현재: 웹만 구현, 추후 네이티브 앱 시 AdMob 추가

### 2. 테스트 모드 필수
```typescript
testMode={__DEV__}  // 개발 환경에서 자동 활성화
```
**이유**:
- 실제 광고 클릭 시 계정 정지 위험
- 개발 중 레이아웃 확인 용이
- 플레이스홀더로 광고 위치 명확히 표시

### 3. 제휴 링크 자동 파라미터
```typescript
buildAffiliateUrl()
```
- 여행 정보(destination, dates, travelers) 자동 전달
- URL 파라미터 자동 생성
- 제휴사별 URL 구조 맞춤

### 4. UX 우선 배치
- 광고를 콘텐츠 흐름에 자연스럽게 배치
- 버튼/입력 필드와 분리 (오클릭 방지)
- Outline 스타일로 시각적 부담 감소
- 제휴 링크를 "도움" 형태로 제공

## 베스트 프랙티스 준수

### 1. 개인정보 보호
```typescript
// TODO: GDPR/CCPA 동의 구현
const [adsConsent, setAdsConsent] = useState(false);

if (!adsConsent) {
  return <ConsentBanner onAccept={() => setAdsConsent(true)} />;
}
```
**필수 요구사항**:
- GDPR (EU) 동의 팝업
- CCPA (미국) 동의 관리
- 동의 없으면 광고 미표시

### 2. 광고 정책 준수
```typescript
// ✅ 좋은 예
<AdSense adSlot="1234567890" testMode={__DEV__} />

// ❌ 나쁜 예
<AdSense adSlot="1234567890" testMode={false} />  // 개발 중 실제 광고
```

### 3. 클릭 유도 금지
- ❌ "광고를 클릭하세요" 텍스트
- ❌ 광고 주변에 화살표/하이라이트
- ✅ 자연스러운 콘텐츠 통합

### 4. 접근성
- AdSense 컴포넌트는 웹 전용
- Platform.OS 체크로 안전성 보장
- 에러 핸들링 및 fallback

## 다음 단계 (Phase 2 & 3)

### Phase 2: Backend 트래킹 시스템
**예상 기간**: 3일

1. **제휴 클릭 트래킹 API**
   ```typescript
   POST /api/analytics/affiliate-click
   {
     provider: 'booking',
     destination: '도쿄',
     trackingId: 'trip_123',
     userId: 'user_456',
     timestamp: '2026-02-07T12:00:00Z'
   }
   ```

2. **수익 대시보드 (관리자용)**
   - 제휴사별 클릭/전환 통계
   - 일별/월별 수익 리포트
   - CTR, CVR 분석

3. **데이터베이스 스키마**
   ```typescript
   AffiliateClick {
     id: string;
     provider: string;
     destination: string;
     tripId?: string;
     userId?: string;
     clickedAt: Date;
     convertedAt?: Date;
     commission?: number;
   }
   ```

### Phase 3: React Native 앱용 AdMob
**예상 기간**: 2-3일

1. **패키지 설치**
   ```bash
   npm install react-native-google-mobile-ads
   ```

2. **Config 플러그인 추가** (app.json)
   ```json
   {
     "expo": {
       "plugins": [
         [
           "react-native-google-mobile-ads",
           {
             "androidAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx",
             "iosAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx"
           }
         ]
       ]
     }
   }
   ```

3. **EAS Build 필요**
   - Expo Go 미지원 (네이티브 코드 포함)
   - EAS Development Build 생성
   - iOS: ATT 팝업 추가
   - Android: "앱에 광고 포함" 선택

4. **배너 광고 컴포넌트**
   ```tsx
   import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

   <BannerAd
     unitId="ca-app-pub-xxxxx/xxxxx"
     size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
   />
   ```

### Phase 4: 최적화 & 확장
**예상 기간**: 1주

1. **A/B 테스팅**
   - 광고 배치 위치 최적화
   - 제휴 링크 버튼 스타일 테스트
   - CTR 개선 실험

2. **추가 제휴 파트너**
   - Skyscanner (항공권)
   - GetYourGuide (투어)
   - TripAdvisor (리뷰/예약)

3. **개인화**
   - 사용자 선호도 기반 제휴 링크 우선순위
   - 여행지별 최적 제휴사 추천

## 성과 측정 지표 (KPI)

### 수익 지표
- **월간 광고 수익** (AdSense + 제휴)
- **페이지뷰당 수익** (RPM)
- **클릭률** (CTR)
- **전환율** (CVR)

### 사용자 경험 지표
- **광고 클릭 후 이탈률**
- **페이지 체류 시간**
- **제휴 링크 사용자 피드백**

### 기술 지표
- **광고 로딩 시간**
- **에러율**
- **광고 표시 성공률**

## 법적 준수사항

### 1. 광고 정책
- [Google AdSense 프로그램 정책](https://support.google.com/adsense/answer/48182)
- 무효 트래픽 방지
- 클릭 유도 금지
- 콘텐츠 정책 준수

### 2. 개인정보 보호
- GDPR 동의 필수 (EU 사용자)
- CCPA 동의 필수 (미국 캘리포니아 사용자)
- 쿠키 정책 명시
- 개인정보 처리방침 업데이트

### 3. 제휴 공개
```tsx
<Text style={styles.affiliateDisclosure}>
  ℹ️ 이 링크는 제휴 링크이며, 예약 시 소정의 수수료를 받을 수 있습니다.
</Text>
```

## 컴파일 상태

### Frontend
- ✅ TypeScript 타입 체크 통과
- ✅ Web 번들링 성공 (1252 modules)
- ✅ 컴포넌트 렌더링 정상
- ✅ Hot reload 작동

### 테스트 필요 항목
- [ ] AdSense 스크립트 로딩 확인 (실제 도메인 필요)
- [ ] 제휴 링크 URL 파라미터 검증
- [ ] 클릭 트래킹 로그 확인
- [ ] 다양한 화면 크기 테스트
- [ ] 다크 모드 테스트

## 파일 변경 내역

### 생성된 파일:
- `frontend/src/components/ads/AdSense.tsx` (216 lines)
- `frontend/src/components/ads/AffiliateLink.tsx` (279 lines)
- `frontend/src/components/ads/index.ts` (3 lines)
- `claudedocs/priority-2-business-model-implementation.md` (이 문서)

### 수정된 파일:
- `frontend/src/screens/trips/TripDetailScreen.tsx`
  - AdSense, AffiliateLink import 추가
  - 제휴 링크 섹션 추가 (lines 880-936)
  - AdSense 배너 2개 추가 (lines 938-944, 980-988)
  - 스타일 추가 (lines 1444-1473)

## 결론

CLAUDE.md의 비즈니스 모델 요구사항을 성공적으로 구현했습니다:

**✅ 완료된 기능**:
- Google AdSense 웹 통합
- 6개 여행 제휴 파트너 연동
- 자동 URL 파라미터 생성
- 테스트 모드로 안전한 개발
- UX 고려한 광고 배치

**💰 수익화 경로**:
1. AdSense 광고 수익 (CPM)
2. Booking.com 제휴 (최대 40%)
3. Expedia Group 제휴 (최대 6%)
4. 투어/액티비티 제휴 (Viator, Klook)

**📊 다음 마일스톤**:
- Phase 2: Backend 트래킹 시스템 (3일)
- Phase 3: 네이티브 앱 AdMob (2-3일)
- Phase 4: 최적화 & 확장 (1주)

**🎯 기대 효과**:
- 지속 가능한 수익 모델 확립
- 사용자에게 유용한 예약 링크 제공
- 자연스러운 광고 통합으로 UX 유지

---
**구현 완료일**: 2026-02-07
**담당**: Claude Code with SuperClaude Framework
**우선순위**: Priority 2 (비즈니스 모델) ✅ Phase 1 COMPLETE
