# Smart App Banner 배포 요약

**배포일**: 2026-04-03  
**상태**: ✅ 통합 완료 (배포 대기)  
**다음 단계**: 프로덕션 배포 → 모바일 테스트 → GTM 이벤트 확인

---

## 📋 완료된 작업

### 1. SmartAppBanner 컴포넌트 생성 ✅
**파일**: `/frontend/src/components/SmartAppBanner.tsx`

**기능**:
- TypeScript React 컴포넌트 (미래 사용 대비)
- A/B 테스트 3가지 변형 (A, B, C)
- Props 인터페이스 정의

### 2. 영어 랜딩 페이지 통합 ✅
**파일**: `/frontend/public/landing-en.html`

**추가 내용**:
- **CSS** (lines 51-130): 배너 스타일, 애니메이션, 반응형
- **HTML** (lines 211-225): 배너 마크업 (영어)
- **JavaScript** (lines 457-548): A/B 테스트 로직, GTM 이벤트

**영어 배너 변형**:
```javascript
const BANNER_VARIANTS = {
  A: 'AI Creates Your Perfect Trip',
  B: 'Travel Planning Made Easy',
  C: 'Plan Your Trip in 5 Seconds'
};
```

### 3. 한국어 랜딩 페이지 통합 ✅
**파일**: `/frontend/public/landing.html`

**추가 내용**:
- **CSS** (lines 135-228): 동일한 스타일 (언어 무관)
- **HTML** (lines 233-247): 배너 마크업 (한국어)
- **JavaScript** (lines 521-622): 동일한 로직 (한국어 변형)

**한국어 배너 변형**:
```javascript
const BANNER_VARIANTS = {
  A: '여행 계획, 더 쉽고 빠르게',
  B: 'AI가 만드는 완벽한 여행',
  C: '5초 만에 여행 일정 완성'
};
```

### 4. 여행 가이드 페이지 일괄 통합 ✅ (신규)
**파일**: 27개 가이드 페이지 전체

**자동화 스크립트**: `/scripts/add-banner-to-guides.py`

**처리 결과**:
- ✅ 성공: 27개
- ⏭️ 건너뜀: 0개
- ❌ 오류: 0개

**통합된 페이지 목록**:
```
한국어 가이드 (15개):
- seoul.html, tokyo.html, osaka.html, paris.html, bangkok.html
- amsterdam.html, bali.html, barcelona.html, dubai.html, hawaii.html
- ho-chi-minh.html, istanbul.html, kuala-lumpur.html, kyoto.html
- london.html, new-york.html, prague.html, rome.html, singapore.html, sydney.html
- index.html

영어 가이드 (6개):
- seoul-en.html, tokyo-en.html, osaka-en.html, paris-en.html, bangkok-en.html
- index-en.html
```

**자동화 스크립트 기능**:
- CSS 스타일 자동 삽입 (`</style>` 앞)
- HTML 마크업 자동 삽입 (`<body>` 뒤)
- JavaScript 로직 자동 삽입 (`</body>` 앞)
- 언어 자동 감지 (파일명 `-en` 패턴)
- 중복 방지 (이미 배너 있으면 건너뜀)

---

## 🎯 주요 기능

### A/B 테스트
- 사용자별로 A, B, C 변형 중 하나 무작위 할당
- localStorage에 저장 (재방문 시 동일 변형 표시)
- GTM 이벤트로 각 변형별 성과 트래킹

### localStorage 관리
| 키 | 용도 | 형식 |
|---|---|---|
| `smartBanner_variant` | A/B 테스트 변형 | "A", "B", "C" |
| `smartBanner_dismissed` | 배너 닫기 날짜 | "Mon Apr 03 2026" |

### 표시 로직
```javascript
if (isMobile() && !wasDismissedToday()) {
  setTimeout(showBanner, 2000); // 2초 딜레이
}
```

1. Android 기기만 표시 (`/Android/i.test()`)
2. 당일 닫기 버튼 클릭 시 하루 숨김
3. 페이지 로드 후 2초 딜레이 (UX 개선)

### GTM 이벤트
| 이벤트명 | 트리거 | 파라미터 |
|---------|--------|---------|
| `banner_view` | 배너 노출 | variant, page |
| `banner_click` | 다운로드 버튼 클릭 | variant, page, deepLink |
| `banner_dismiss` | 닫기 버튼 클릭 | variant, page |

### Deep Link
```javascript
const deepLink = encodeURIComponent(window.location.pathname + window.location.search);
const url = CONFIG.playStoreURL + '&referrer=' + deepLink;
```

**예시**:
- 방문 URL: `https://mytravel-planner.com/guides/tokyo`
- Play Store URL: `...&referrer=%2Fguides%2Ftokyo`
- 앱 설치 후 `/guides/tokyo` 경로로 자동 이동

---

## 🎨 디자인 사양

### 데스크톱 (> 768px)
- 배너 높이: 약 70px
- 아이콘 크기: 2.5rem (40px)
- 버튼 패딩: 0.5rem × 1.25rem
- 최대 너비: 1200px (중앙 정렬)

### 모바일 (≤ 480px)
- 배너 높이: 약 60px
- 아이콘 크기: 2rem (32px)
- 버튼 패딩: 0.4rem × 1rem
- 텍스트 크기: 90%

### 색상
- 배경: `linear-gradient(135deg, #4A90D9 0%, #5BA3E8 100%)`
- 다운로드 버튼: 흰색 배경 + `#4A90D9` 텍스트
- 닫기 버튼: `rgba(255,255,255,0.2)` 배경

### 애니메이션
```css
@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
```
- 지속 시간: 0.3초
- 이징: `ease-out`

---

## 📊 예상 성과

### Phase 0 목표 (Week 2)
| 지표 | 예상값 | 산출 근거 |
|------|--------|----------|
| **Banner CTR** | 3-5% | 업계 평균 (AppsFlyer) |
| **설치 전환율** | 50% | Play Store 클릭 → 설치 |
| **웹→앱 전환율** | 5-10% | Banner CTR × 설치율 |

### 예상 퍼널 (월 2,000명 방문 기준)
```
2,000명 웹 방문
  ↓ (5% Banner CTR)
100명 배너 클릭
  ↓ (50% 설치율)
50명 앱 설치
  ↓ ($15 LTV)
$750 월 가치
```

**비용 효율**:
- 유료 광고: 설치당 $2-3
- 오가닉 배너: 설치당 $0
- **절감 효과**: $100-150/월

---

## 🚀 배포 체크리스트

### 즉시 배포 가능 ✅
- [x] SmartAppBanner.tsx 생성
- [x] landing-en.html 통합
- [x] landing.html 통합
- [x] **27개 가이드 페이지 일괄 통합** (신규)
- [x] A/B 테스트 변형 정의
- [x] GTM 이벤트 코드 추가
- [x] Deep link 파라미터 전달
- [x] 자동화 스크립트 생성 (`/scripts/add-banner-to-guides.py`)

### 배포 전 확인 사항

#### 1. Nginx 설정 확인
```bash
# 파일 경로 확인
ssh root@46.62.201.127
ls -lh /path/to/public/landing.html
ls -lh /path/to/public/landing-en.html
```

#### 2. 파일 배포
```bash
# 로컬에서 실행
cd /Users/hoonjaepark/projects/travelPlanner/frontend/public

# 랜딩 페이지
rsync -avz landing.html landing-en.html root@46.62.201.127:/path/to/public/

# 가이드 페이지 일괄 배포 (27개)
rsync -avz guides/*.html root@46.62.201.127:/path/to/public/guides/

# 확인
curl -I https://mytravel-planner.com/landing.html
curl -I https://mytravel-planner.com/landing-en.html
curl -I https://mytravel-planner.com/guides/seoul.html
curl -I https://mytravel-planner.com/guides/tokyo-en.html
```

#### 3. GTM 설정 확인
```javascript
// 이벤트가 전송되는지 확인
// Chrome DevTools > Console
gtag('event', 'test_event', { test: true });

// 예상되는 이벤트:
// - banner_view
// - banner_click
// - banner_dismiss
```

#### 4. 모바일 테스트

**Android 테스트 (필수)**:
- [ ] Galaxy S21 (Chrome, 360px)
- [ ] Pixel 5 (Chrome, 393px)
- [ ] OnePlus 9 (Chrome, 412px)

**iOS 테스트 (배너 미표시 확인)**:
- [ ] iPhone 13 (Safari, 390px)
- [ ] iPhone SE (Safari, 375px)

**확인 항목**:
- [ ] Android에서 배너 표시됨
- [ ] iOS에서 배너 표시 안 됨
- [ ] 2초 딜레이 후 slideDown 애니메이션
- [ ] "무료 다운로드" 버튼 클릭 → Play Store 이동
- [ ] "✕" 버튼 클릭 → 배너 숨김
- [ ] 페이지 새로고침 → 배너 재표시 안 됨 (24시간)

#### 5. Deep Link 테스트
```bash
# 예상 URL 형식
https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner&referrer=%2Fguides%2Ftokyo

# 확인 사항:
# 1. Play Store에서 앱 설치
# 2. 앱 실행 시 /guides/tokyo 경로로 이동
# 3. referrer 파라미터가 Analytics에 기록됨
```

#### 6. A/B 테스트 검증
```bash
# Chrome DevTools > Application > Local Storage
# smartBanner_variant: "A" | "B" | "C" 확인

# 배너 텍스트 확인:
# A: "여행 계획, 더 쉽고 빠르게"
# B: "AI가 만드는 완벽한 여행"
# C: "5초 만에 여행 일정 완성"
```

---

## 📈 다음 단계 (Phase 0 완료 후)

### Week 2: 데이터 수집
- GTM 이벤트 데이터 확인 (GA4)
- 변형별 CTR 비교
- 설치 전환율 측정

### Week 3-4: 최적화 (Phase 1)
- 승리 변형 선택 (CTR 최고)
- 배너 위치 테스트 (상단 vs 하단)
- 버튼 카피 테스트 ("무료 다운로드" vs "지금 받기")

### Week 5-6: 확장 (Phase 2)
- 여행 가이드 페이지에 배너 추가
  - `/guides/tokyo.html`
  - `/guides/paris.html`
  - `/guides/bangkok.html` 등 10개 도시
- 블로그 포스트에 배너 추가 (미래)

---

## ⚠️ 알려진 제한사항

### 1. iOS 미지원
- **현재**: Android만 지원
- **이유**: iOS 우선순위 낮음 (Phase 4, Month 5-6)
- **해결**: Safari Smart App Banner (메타 태그 1줄)

### 2. GTM 컨테이너 미설정
- **현재**: 이벤트 코드만 추가됨
- **필요**: GTM 컨테이너 ID 삽입
- **배포 전 확인**: GTM 태그 작동 여부

### 3. A/B 테스트 자동화 없음
- **현재**: 수동으로 GA4에서 데이터 확인
- **권장**: Optimizely / VWO 연동 (Phase 2)
- **대안**: GA4 Custom Reports 생성

### 4. 서버 사이드 트래킹 없음
- **현재**: 클라이언트 사이드만 (localStorage, GTM)
- **제한**: Ad Blocker 사용자 트래킹 불가
- **개선**: 서버 로그 분석 (Nginx access.log)

---

## 💡 핵심 인사이트

### 1. localStorage의 한계
- **장점**: 서버 요청 없이 빠른 판단
- **단점**: 브라우저 삭제 시 초기화
- **보완**: 서버 쿠키 (추후)

### 2. 2초 딜레이의 이유
```javascript
setTimeout(showBanner, 2000);
```
- **UX**: 즉시 표시 시 사용자 방해
- **참고**: 업계 권장 1-3초
- **A/B 테스트**: 0초 vs 2초 비교 (Phase 2)

### 3. Deep Link Attribution
- **Play Store**: `&referrer=` 파라미터 지원
- **앱 내 처리**: `/auth` 엔드포인트 사용
- **중요**: Firebase Dynamic Links 미사용 (비용 절감)

### 4. Android 우선 전략의 장점
- **집중**: 리소스 분산 없이 빠른 검증
- **데이터**: Android 성공 → iOS 확장 근거
- **비용**: iOS 앱 서명 키 설정 불필요 (현재)

---

## 📚 참고 문서

### 내부 문서
- 전략 문서: `/docs/web-acquisition-strategy.md`
- Phase 0 완료 보고서: `/docs/phase-0-completion-report.md`
- SmartAppBanner 컴포넌트: `/frontend/src/components/SmartAppBanner.tsx`

### 외부 참고
- AppsFlyer: Smart Banners Best Practices
- Branch.io: Web-to-App Conversion Guide
- Google Play: Install Referrer API

---

## ✅ 승인 및 배포

### 승인 체크리스트
- [x] SmartAppBanner 통합 완료 (EN + KO)
- [x] A/B 테스트 변형 정의
- [x] GTM 이벤트 코드 추가
- [x] Deep link 파라미터 전달
- [ ] **배포 승인 대기 중**

### 배포 명령어
```bash
# 1. SSH 접속
ssh root@46.62.201.127

# 2. 파일 배포 (로컬에서)
cd /Users/hoonjaepark/projects/travelPlanner/frontend/public
rsync -avz landing.html landing-en.html root@46.62.201.127:/path/to/public/

# 3. Nginx 재시작 (서버에서)
sudo systemctl reload nginx

# 4. 확인
curl https://mytravel-planner.com/landing.html | grep "smart-app-banner"
curl https://mytravel-planner.com/landing-en.html | grep "smart-app-banner"

# 5. 모바일 테스트 (Chrome DevTools)
# - 개발자 도구 > Toggle Device Toolbar
# - User Agent: Android 선택
# - 배너 표시 확인
```

---

**문서 버전**: 1.0  
**작성자**: Claude Code  
**최종 업데이트**: 2026-04-03  
**승인자**: 대기 중  
**배포 예정일**: 승인 즉시
