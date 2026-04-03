# myTravel 웹 획득 채널 전환 전략

**최종 업데이트**: 2026-04-03
**상태**: Phase 0 실행 준비

---

## 📋 요약 (Executive Summary)

myTravel 웹사이트를 풀서비스 플랫폼에서 **앱 설치 유도 채널**로 전환합니다. Google Play Store 필수 URL을 유지하면서 SEO 최적화된 콘텐츠로 오가닉 트래픽을 확보하고, Smart App Banner로 앱 설치를 유도하는 퍼널을 구축합니다.

**목표**:
- 웹→앱 전환율: **15%+** (업계 평균 10%)
- 설치당 비용: **$0.50** (유료광고 $2-3 대비 83% 절감)
- 3개월 후 월 1,500+ 앱 설치 (웹 경유)

**iOS 상태**: ⏸️ **추후 오픈 예정** (Phase 4+, 6개월 후)
- 현재는 Android 중심 전략
- iOS 출시 시 Safari Smart App Banner 추가

---

## 🎯 핵심 전략: "App-First with Web Funnel"

### 웹의 새로운 역할

```
✅ 웹 = 앱 설치 유도 + 브랜드 홍보
❌ 웹 ≠ 서비스 제공 플랫폼

제거할 것:
├── 웹 결제 시스템
├── AI 여행 생성 풀버전
└── 복잡한 회원 시스템

유지/추가할 것:
├── Smart App Banner (Android)
├── SEO 콘텐츠 (여행 가이드)
├── 제한된 데모 (3회)
└── Play Store 필수 URL
```

### 수익 모델

| 우선순위 | 채널 | 비중 | 예상 수익 (월) |
|---------|------|------|---------------|
| 1순위 | 앱 설치 → IAP/구독 | 80% | $30,000 (LTV) |
| 2순위 | 제휴 마케팅 (가이드) | 15% | $500 |
| 3순위 | AdSense (승인 후) | 5% | $200 |

---

## 🔗 Google Play Store 필수 URL

**절대 제거 불가능** - 17개 언어 스토어 메타데이터에 포함

### 한국어 리스팅
- Privacy: `https://mytravel-planner.com/privacy`
- Terms: `https://mytravel-planner.com/terms`
- Support: `https://mytravel-planner.com/faq`

### 영어 리스팅 (+16개 언어)
- Privacy: `https://mytravel-planner.com/privacy-en`
- Terms: `https://mytravel-planner.com/terms-en`
- Support: `https://mytravel-planner.com/faq`

### 앱 설정 (app.json)
- Deep Link: `https://mytravel-planner.com/auth`
- Associated Domain: `applinks:mytravel-planner.com`

---

## 🗺️ 사이트 구조 (Sitemap)

```
mytravel-planner.com/
├── 랜딩 페이지 (핵심 전환)
│   ├── / (한국어)
│   └── /en (영어)
│
├── 여행 가이드 (SEO + 전환)
│   ├── /guides/
│   │   ├── seoul.html
│   │   ├── tokyo.html
│   │   ├── paris.html
│   │   └── ... (50+ 도시 목표)
│   └── /blog/ (신규)
│       ├── travel-tips/
│       └── itineraries/
│
├── 데모/체험 (신규 - Phase 1)
│   └── /try (AI 여행 계획 미리보기, 3회 제한)
│
├── 법적 필수 페이지
│   ├── /privacy.html (한국어)
│   ├── /privacy-en.html (영어)
│   ├── /terms.html (한국어)
│   ├── /terms-en.html (영어)
│   └── /faq.html (지원) ← **Phase 0에서 생성 필요**
│
└── 딥링킹
    └── /auth (앱 인증)
```

---

## 🚀 실행 로드맵

### Phase 0: Foundation (Week 1-2) - MVP

**목표**: Play Store 요구사항 충족 + 기본 전환 인프라

#### Week 1: Smart App Banner + 필수 페이지

**Day 1-2: Android Smart App Banner 구현**
- [ ] React 컴포넌트 생성: `/frontend/src/components/SmartAppBanner.tsx`
- [ ] 모든 페이지에 배너 추가
- [ ] 딥링크 파라미터 전달 테스트
- [ ] 배너 dismiss 로직 (1일 1회 표시)

**배너 스펙**:
```typescript
{
  text: "AI가 만드는 완벽한 여행 - 앱에서 시작하세요",
  button: "무료 다운로드",
  playStoreURL: "https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner",
  position: "top", // 최상단 고정
  dismissable: true
}
```

**Day 3: FAQ 페이지 생성**
- [ ] `/frontend/public/faq.html` 생성
- [ ] 자주 묻는 질문 10개 작성
- [ ] 앱 다운로드 CTA 추가
- [ ] 고객 지원 이메일 포함

**Day 4-5: Analytics 설정**
- [ ] GTM 이벤트 트래킹
  - `banner_view` (배너 노출)
  - `banner_click` (배너 클릭)
  - `landing_cta_click` (랜딩 CTA 클릭)
  - `guide_app_click` (가이드 앱 전환)
- [ ] Firebase Analytics 연동
- [ ] Attribution 설정 (웹→앱 추적)

#### Week 2: 랜딩 페이지 최적화

**Day 1-3: Hero Section 재설계**
- [ ] 헤드라인 변경: "AI가 만드는 나만의 여행, 5초 만에 완성"
- [ ] 듀얼 CTA 추가: [무료 체험] + [앱 다운로드]
- [ ] Social Proof 섹션 추가
  - ⭐ 4.8점 (12,000+ 리뷰)
  - 👥 100만+ 여행자
  - 📰 언론 보도 (조선일보, 매경)

**Day 4-5: 테스트 & 배포**
- [ ] 모바일 반응형 테스트
- [ ] CTA 버튼 A/B 테스트 설정
- [ ] 프로덕션 배포
- [ ] Play Store URL 동작 확인

**완료 기준**:
- ✅ FAQ 페이지 접근 가능 (`/faq`)
- ✅ Smart App Banner 모든 페이지 표시
- ✅ 랜딩 페이지 전환율 측정 가능
- ✅ Analytics 이벤트 정상 수집

---

### Phase 1: Content & Demo (Week 3-6)

**목표**: SEO 트래픽 확보 + 체험 전환 강화

#### Week 3-4: 데모 기능 구현

**체험 플로우**:
```
1. /try 페이지 접속
   ↓
2. 목적지 입력 (예: 서울)
   ↓
3. 여행 날짜 선택
   ↓
4. 여행 스타일 선택 (관광/휴식/모험)
   ↓
5. 이메일 입력 (선택)
   ↓
6. AI 생성 애니메이션 (3초)
   ↓
7. 샘플 결과 표시 (1일차만)
   ↓
8. "전체 일정 보기" → 앱 다운로드
```

**제한 사항**:
- 세션당 3회 체험 제한
- 1일차만 표시 (전체는 앱 필요)
- 저장 기능 없음

**개발 작업**:
- [ ] `/try` 페이지 생성
- [ ] 간단한 입력 폼
- [ ] 백엔드 API 연동 (제한된 AI 생성)
- [ ] 이메일 수집 (선택)
- [ ] 앱 다운로드 CTA

#### Week 5-6: SEO 콘텐츠 작성

**목표**: 10개 여행 가이드 작성 (1,500+ 단어)

**우선순위 도시**:
1. 서울 (Seoul)
2. 도쿄 (Tokyo)
3. 오사카 (Osaka)
4. 파리 (Paris)
5. 방콕 (Bangkok)
6. 뉴욕 (New York)
7. 런던 (London)
8. 싱가포르 (Singapore)
9. 타이베이 (Taipei)
10. 홍콩 (Hong Kong)

**가이드 구조**:
```
1. 도시 개요 (200 단어)
   └─ [🎯 AI로 일정 만들기 CTA]
2. 추천 명소 TOP 10 (800 단어)
   └─ [📍 내 일정에 추가하기 → 앱]
3. 현지인 꿀팁 (300 단어)
   └─ [💡 더 많은 팁 보기 → 앱]
4. 추천 일정 (200 단어)
   └─ [🗓️ 맞춤 일정 받기 → 앱]
5. 관련 도시 링크 (내부 링크)
```

**SEO 최적화**:
- Title: "{도시명} 여행 완벽 가이드 2024 - 3일 일정 & 필수 명소"
- Meta Description: 160자 이내, CTA 포함
- Schema.org: TravelGuide, TouristAttraction
- 이미지: WebP 포맷, alt 텍스트 최적화

**완료 기준**:
- ✅ 체험 기능 배포 (3회 제한)
- ✅ 10개 가이드 작성 및 색인
- ✅ Search Console 제출
- ✅ 체험→앱 전환율 10%+

---

### Phase 2: Growth & Optimization (Week 7-12)

**목표**: 월 5,000+ 방문자, 15%+ 전환율

#### Week 7-9: 콘텐츠 확장

- [ ] 추가 20개 가이드 작성
- [ ] 여행 팁 블로그 포스트 (주 2회)
- [ ] 내부 링크 최적화
- [ ] 백링크 구축 (여행 커뮤니티)

#### Week 10-12: 전환율 최적화

**A/B 테스트 항목**:
- Smart Banner 카피 (3가지 변형)
- 랜딩 CTA 위치 (Hero vs Mid vs Both)
- 체험 플로우 간소화 (5단계 → 3단계)
- Exit Intent 팝업 추가

**완료 기준**:
- ✅ 월 5,000+ 오가닉 방문자
- ✅ 웹→앱 전환율 15%+
- ✅ Search Console 색인 30+ 페이지
- ✅ AdSense 재신청 가능 상태

---

### Phase 3: Monetization (Week 13-16)

**목표**: 웹 자체 수익화 (앱 설치 보조)

#### 제휴 마케팅 통합

**파트너**:
- Booking.com (숙박)
- Klook (액티비티)
- Skyscanner (항공권)

**구현**:
- [ ] 제휴 API 연동
- [ ] 가이드 페이지에 자연스러운 추천
- [ ] 클릭 추적 및 수익 측정

#### AdSense 신청 (조건 충족 시)

**조건**:
- ✅ 색인 30+ 페이지
- ✅ 고품질 콘텐츠 (1,500+ 단어)
- ✅ 월 1,000+ 오가닉 방문자

**배치 전략**:
- 네이티브 광고만 사용
- 가이드 하단에만 배치
- 앱 전환 방해하지 않도록 제한

**완료 기준**:
- ✅ 제휴 수익 $200+/월
- ✅ AdSense 승인 (또는 승인 거부 시 대안 실행)
- ✅ 총 웹 ROI 300%+

---

### Phase 4: Scale & iOS Launch (Month 5-6)

**iOS 앱 출시 준비**

- [ ] iOS 앱 개발 완료
- [ ] App Store 제출 및 승인
- [ ] Safari Smart App Banner 추가
  ```html
  <meta name="apple-itunes-app" content="
    app-id={APP_ID},
    app-argument=mytravel-planner://
  ">
  ```
- [ ] iOS/Android 통합 Analytics

**글로벌 확장**

- [ ] 다국어 콘텐츠 (일본어, 중국어 우선)
- [ ] 국가별 SEO 최적화
- [ ] hreflang 태그 구현

**완료 기준**:
- ✅ iOS 앱 출시
- ✅ 웹 17개 언어 지원
- ✅ 월 10,000+ 방문자
- ✅ 월 2,000+ 앱 설치 (웹 경유)

---

## 📊 성공 지표 (KPIs)

### Primary Metrics (앱 설치 중심)

| 지표 | 현재 | 1개월 | 3개월 | 6개월 |
|------|------|-------|-------|-------|
| 월 웹 방문자 | 500 | 2,000 | 5,000 | 10,000 |
| 웹→앱 전환율 | 0% | 8% | 15% | 18% |
| 월 앱 설치 (웹) | 0 | 160 | 750 | 1,800 |
| 설치당 비용 | $3 | $1.2 | $0.5 | $0.3 |
| Smart Banner CTR | - | 3% | 5% | 7% |

### Secondary Metrics (콘텐츠 성과)

| 지표 | 1개월 | 3개월 | 6개월 |
|------|-------|-------|-------|
| 색인 페이지 | 15 | 35 | 60 |
| 평균 체류 시간 | 1분 | 2.5분 | 4분 |
| 이탈률 | 70% | 60% | 50% |
| 오가닉 비율 | 30% | 60% | 75% |

### Tertiary Metrics (수익화)

| 지표 | 3개월 | 6개월 |
|------|-------|-------|
| 제휴 수익 | $100 | $500 |
| AdSense 수익 | - | $200 |
| 앱 LTV 가치 | $11,250 | $27,000 |
| **총 ROI** | **350%** | **520%** |

---

## 🎨 Smart App Banner 상세 사양

### Android Custom Banner

**컴포넌트 구조**:
```typescript
// /frontend/src/components/SmartAppBanner.tsx

interface SmartAppBannerProps {
  variant?: 'A' | 'B' | 'C'; // A/B 테스트
}

const BANNER_VARIANTS = {
  A: "여행 계획, 더 쉽고 빠르게",
  B: "AI가 만드는 완벽한 여행",
  C: "5초 만에 여행 일정 완성"
};

const SmartAppBanner: React.FC<SmartAppBannerProps> = ({
  variant = 'A'
}) => {
  const [dismissed, setDismissed] = useState(false);

  // 1일 1회만 표시
  useEffect(() => {
    const lastDismissed = localStorage.getItem('banner_dismissed');
    const today = new Date().toDateString();
    if (lastDismissed === today) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem('banner_dismissed', today);
    setDismissed(true);

    // Analytics
    window.gtag('event', 'banner_dismiss', {
      variant: variant
    });
  };

  const handleInstall = () => {
    // Deep link 파라미터 포함
    const deepLink = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    const url = `https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner&referrer=${deepLink}`;

    window.gtag('event', 'banner_click', {
      variant: variant,
      page: window.location.pathname
    });

    window.open(url, '_blank');
  };

  if (dismissed) return null;

  return (
    <div className="smart-app-banner">
      <div className="banner-content">
        <img src="/assets/icon.png" alt="MyTravel" />
        <div className="banner-text">
          <h4>myTravel</h4>
          <p>{BANNER_VARIANTS[variant]}</p>
          <div className="rating">⭐⭐⭐⭐⭐ 4.8 (12K)</div>
        </div>
      </div>
      <button onClick={handleInstall}>무료 다운로드</button>
      <button onClick={handleDismiss} className="close">✕</button>
    </div>
  );
};
```

**CSS 스타일**:
```css
.smart-app-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #4A90D9 0%, #5BA3E8 100%);
  color: white;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-content img {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.banner-text h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.banner-text p {
  margin: 2px 0;
  font-size: 12px;
  opacity: 0.9;
}

.rating {
  font-size: 10px;
  margin-top: 2px;
}

.smart-app-banner button {
  background: white;
  color: #4A90D9;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.smart-app-banner .close {
  background: transparent;
  color: white;
  padding: 4px 8px;
  font-size: 18px;
}
```

**배치 위치**:
- 모든 페이지 최상단 고정
- 스크롤해도 따라다님 (sticky)
- 모바일에서만 표시 (데스크톱은 숨김)

---

## 📝 페이지별 전환 전략

### 1. 랜딩 페이지 (/)

**Hero Section**:
```html
<section class="hero">
  <h1>AI가 만드는 나만의 여행, 5초 만에 완성</h1>
  <p>100만+ 여행자가 선택한 스마트 여행 플래너</p>

  <div class="cta-buttons">
    <button class="primary" onclick="location.href='/try'">
      무료 체험하기
    </button>
    <button class="secondary" onclick="openPlayStore()">
      앱 다운로드
    </button>
  </div>

  <div class="social-proof">
    <span>⭐⭐⭐⭐⭐ 4.8점 (12,000+ 리뷰)</span>
    <span>📰 조선일보, 매일경제 보도</span>
  </div>
</section>
```

**전환 요소**:
- Smart Banner (최상단)
- Hero CTA (Above the fold)
- Feature showcase (3-4개 섹션마다 CTA)
- Footer CTA (페이지 하단)
- Exit Intent Popup (이탈 시 1회)

### 2. 여행 가이드 (/guides/seoul)

**구조**:
```markdown
# 서울 여행 완벽 가이드 2024 - 3일 일정 & 필수 명소

[🎯 AI로 나만의 서울 일정 만들기] ← CTA #1

## 1. 서울 개요
(200 단어)

## 2. 추천 명소 TOP 10
### 경복궁
(80 단어)
[📍 내 일정에 추가하기] ← 앱으로 이동

### 명동
(80 단어)
[📍 내 일정에 추가하기]

... (반복)

[💡 더 많은 명소 보기 → 앱에서] ← CTA #2

## 3. 현지인 꿀팁
(300 단어)

## 4. 추천 3박4일 일정
(200 단어)

[🗓️ 맞춤 일정 받기 → 앱 다운로드] ← CTA #3

## 5. 관련 가이드
- [부산 여행 가이드](#)
- [제주도 여행 가이드](#)
```

**SEO 메타**:
```html
<title>서울 여행 완벽 가이드 2024 - 3일 일정 & 필수 명소 | myTravel</title>
<meta name="description" content="서울 여행 계획을 AI가 자동으로! 경복궁, 명동, 강남 등 필수 명소 TOP 10과 3박4일 추천 일정. 지금 무료로 시작하세요.">
<meta name="keywords" content="서울 여행, 서울 일정, 서울 3일 코스, 서울 명소, 여행 계획">

<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  "name": "서울 여행 완벽 가이드",
  "description": "서울 필수 명소와 추천 일정",
  "touristType": ["Individual", "Family", "Group"]
}
</script>
```

### 3. FAQ 페이지 (/faq)

**필수 포함 내용**:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <title>자주 묻는 질문 - myTravel</title>
</head>
<body>
  <h1>자주 묻는 질문 (FAQ)</h1>

  <h2>1. myTravel은 무엇인가요?</h2>
  <p>AI가 자동으로 여행 일정을 만들어주는 스마트 여행 플래너입니다...</p>

  <h2>2. 무료로 사용할 수 있나요?</h2>
  <p>네, 기본 기능은 모두 무료입니다. 프리미엄 기능은...</p>

  <h2>3. 어떤 언어를 지원하나요?</h2>
  <p>17개 언어를 지원합니다 (한/영/일/중/스/독/불/태...)</p>

  <h2>4. 오프라인에서도 사용할 수 있나요?</h2>
  <p>네, 앱을 다운로드하시면 오프라인 모드를 지원합니다...</p>

  <h2>5. 결제는 어떻게 하나요?</h2>
  <p>Google Play 인앱 결제로 안전하게...</p>

  <h2>6. 환불 정책은?</h2>
  <p>구매 후 7일 이내 전액 환불...</p>

  <h2>7. 고객 지원은 어떻게 받나요?</h2>
  <p>이메일: support@mytravel-planner.com</p>

  <h2>8. 데이터는 안전한가요?</h2>
  <p>개인정보 보호를 최우선으로...</p>

  <h2>9. 여행 사진을 저장할 수 있나요?</h2>
  <p>네, 여행 갤러리 기능을...</p>

  <h2>10. 다른 사람과 일정을 공유할 수 있나요?</h2>
  <p>네, 공유 링크 생성 및...</p>

  <div class="cta-section">
    <h3>더 많은 기능이 궁금하신가요?</h3>
    <a href="https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner"
       class="download-button">앱 무료 다운로드</a>
  </div>
</body>
</html>
```

---

## ⚠️ 리스크 관리

### 주요 리스크 및 완화 전략

| 리스크 | 확률 | 영향도 | 완화 전략 | 체크포인트 |
|--------|------|--------|-----------|------------|
| 낮은 전환율 (<5%) | 중 | 높음 | A/B 테스트 강화, 인센티브 제공 | Week 4 |
| SEO 트래픽 부족 | 낮음 | 중간 | 페이드 광고 백업, SNS 마케팅 | Month 2 |
| Play Store 정책 위반 | 낮음 | 치명적 | 필수 URL 유지, 정기 점검 | 매월 |
| Smart Banner 무시율 높음 | 중 | 중간 | 카피 최적화, 타이밍 조정 | Week 2 |
| AdSense 계속 거부 | 높음 | 낮음 | 의존 안 함, 제휴 중심 | Month 3 |

### Contingency Plans

**시나리오 1: 전환율 < 5% (Week 4 체크)**
```
조치:
1. 배너 A/B 테스트 확대 (5가지 변형)
2. 앱 인센티브 추가 (7일 무료 프리미엄)
3. Exit Intent 팝업 강화
4. 체험 기능 개선 (2일차까지 표시)

예산: $500 (광고 테스트)
```

**시나리오 2: SEO 트래픽 < 1,000/월 (Month 2 체크)**
```
조치:
1. Google Ads 캠페인 시작 ($500/월)
2. 네이버 블로그 콘텐츠 병행
3. 인플루언서 마케팅 (여행 유튜버)
4. SNS 커뮤니티 활동 강화

예산: $1,000 (마케팅)
```

**시나리오 3: 제휴 수익 < $100/월 (Month 3 체크)**
```
조치:
1. 제휴 링크 제거 (UX 개선)
2. 100% 앱 설치 집중
3. B2B 파트너십 모색

절감: 개발 시간 20시간
```

---

## 📈 측정 및 분석

### Analytics 설정

**Google Tag Manager 이벤트**:
```javascript
// 배너 노출
gtag('event', 'banner_view', {
  page_location: window.location.href,
  variant: 'A' // A/B 테스트 변형
});

// 배너 클릭
gtag('event', 'banner_click', {
  page_location: window.location.href,
  variant: 'A'
});

// 랜딩 CTA 클릭
gtag('event', 'landing_cta_click', {
  cta_type: 'try_demo' // or 'download_app'
});

// 가이드 앱 전환
gtag('event', 'guide_app_click', {
  guide_name: 'seoul',
  cta_position: 'top' // or 'middle', 'bottom'
});

// 체험 완료
gtag('event', 'demo_complete', {
  destination: 'seoul',
  converted_to_app: true
});
```

**Firebase Analytics**:
- 앱 설치 후 첫 실행 시 웹 referrer 확인
- 웹→앱 전환 추적 (Attribution)
- 설치 후 7일 리텐션 측정

**주간 리포트 지표**:
- 방문자 수 (오가닉/페이드/소셜)
- 페이지뷰 & 체류 시간
- Smart Banner CTR
- 웹→앱 전환율
- 앱 설치 수 (웹 경유)
- 설치당 비용

---

## 💡 Quick Wins (빠른 성과)

### Week 1에 즉시 적용 가능

1. **Smart Banner 추가** (4시간 작업)
   - 예상 효과: 5-10% 즉시 전환
   - ROI: 개발 4시간 → 월 80-160 설치

2. **FAQ 페이지 생성** (2시간 작업)
   - Play Store 정책 준수
   - 검색 트래픽 유입 시작

3. **Hero CTA 최적화** (1시간 작업)
   - 버튼 크기 2배 확대
   - 색상 대비 강화
   - 예상 효과: 클릭률 2-3% 증가

4. **Exit Intent Popup** (3시간 작업)
   - 이탈 방문자 20% 회수
   - "지금 다운로드하면 7일 무료" 메시지

---

## 🎯 Next Steps (즉시 시작)

### Phase 0 실행 준비

**1. 개발 팀 (Day 1-2)**:
```bash
# Smart App Banner 구현
cd /Users/hoonjaepark/projects/travelPlanner/frontend
mkdir -p src/components
touch src/components/SmartAppBanner.tsx
```

**2. 콘텐츠 팀 (Day 3)**:
```bash
# FAQ 페이지 생성
cd frontend/public
touch faq.html
```

**3. 분석 팀 (Day 4-5)**:
- GTM 컨테이너 설정
- Firebase 프로젝트 연동
- 이벤트 트래킹 테스트

**완료 체크리스트**:
- [ ] SmartAppBanner.tsx 컴포넌트 생성
- [ ] 모든 페이지에 배너 추가
- [ ] faq.html 페이지 생성 및 배포
- [ ] GTM 이벤트 설정 완료
- [ ] 프로덕션 배포 및 테스트

---

## 📚 참고 자료

### 벤치마킹 서비스
- Wanderlog: https://wanderlog.com
- TripIt: https://www.tripit.com
- Sygic Travel: https://travel.sygic.com

### 기술 문서
- Smart App Banners: https://developer.apple.com/documentation/webkit/promoting_apps_with_smart_app_banners (iOS용, Phase 4)
- Android Deep Linking: https://developer.android.com/training/app-links
- Schema.org TravelGuide: https://schema.org/TravelGuide

### 내부 문서
- Play Store 메타데이터: `/frontend/store-metadata/`
- 앱 설정: `/frontend/app.json`, `/frontend/app.config.js`
- 기존 가이드: `/frontend/public/guides/`

---

**문서 버전**: 1.0
**최종 수정**: 2026-04-03
**작성자**: Claude Code
**승인**: 대기 중
