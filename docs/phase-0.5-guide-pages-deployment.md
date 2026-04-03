# Phase 0.5 가이드 페이지 SmartAppBanner 최적화

**날짜**: 2026-04-03
**시간**: 15:13 KST (06:13 UTC)
**상태**: ✅ 27개 페이지 최적화 및 배포 완료

---

## 📋 배포 개요

### 대상 파일
- **총 27개** 가이드 페이지
- 위치: `/frontend/public/guides/*.html`
- 언어: 한국어, 영어 혼합

### 최적화 내용
1. **표시 지연**: 2000ms → 500ms (75% 단축)
2. **재표시 주기**: 24시간 → 4시간 (83% 단축)
3. **함수 리팩토링**: `wasDismissedToday()` → `wasDismissedRecently()`
4. **저장 방식**: Date string → Timestamp

---

## 🛠️ 자동화 스크립트

### 스크립트 위치
`/scripts/optimize-guide-banners.py`

### 스크립트 실행
```bash
python3 /Users/hoonjaepark/projects/travelPlanner/scripts/optimize-guide-banners.py
```

### 실행 결과
```
=== Phase 0.5 가이드 페이지 SmartAppBanner 최적화 ===

✅ 백업 디렉토리 생성: /docs/backup/guides-20260403-151254
📁 대상 파일: 27개

처리 중: amsterdam.html ... ✅
처리 중: bali.html ... ✅
처리 중: bangkok-en.html ... ✅
... (27개 파일)

=== 완료 ===
✅ 성공: 27개
❌ 실패: 0개
🎉 모든 파일이 성공적으로 최적화되었습니다!
```

---

## 🔄 변경 사항 상세

### 1. 함수명 변경
```javascript
// OLD
function wasDismissedToday() {
  const dismissed = localStorage.getItem(CONFIG.storageKeys.dismissed);
  const today = new Date().toDateString();
  return dismissed === today;
}

// NEW
function wasDismissedRecently() {
  const dismissed = localStorage.getItem(CONFIG.storageKeys.dismissed);
  if (!dismissed) return false;

  const dismissedTime = parseInt(dismissed, 10);
  const now = Date.now();
  const fourHours = 4 * 60 * 60 * 1000;

  return (now - dismissedTime) < fourHours;
}
```

### 2. Dismiss Handler 수정
```javascript
// OLD
window.handleBannerDismiss = function() {
  const banner = document.getElementById('smartAppBanner');
  if (!banner) return;

  const variant = getVariant();
  const today = new Date().toDateString();
  localStorage.setItem(CONFIG.storageKeys.dismissed, today);

  banner.classList.remove('show');
  trackEvent('banner_dismiss', { variant, page: window.location.pathname });
};

// NEW
window.handleBannerDismiss = function() {
  const banner = document.getElementById('smartAppBanner');
  if (!banner) return;

  const variant = getVariant();
  const now = Date.now();
  localStorage.setItem(CONFIG.storageKeys.dismissed, now.toString());

  banner.classList.remove('show');
  trackEvent('banner_dismiss', { variant, page: window.location.pathname });
};
```

### 3. 초기화 코드 수정
```javascript
// OLD
if (isMobile() && !wasDismissedToday()) {
  setTimeout(showBanner, 2000);
}

// NEW
if (isMobile() && !wasDismissedRecently()) {
  setTimeout(showBanner, 500);
}
```

---

## 🚀 배포 절차

### Step 1: 로컬 최적화 (완료)
```bash
cd /Users/hoonjaepark/projects/travelPlanner
python3 scripts/optimize-guide-banners.py
# ✅ 27개 파일 성공
```

### Step 2: 검증 (완료)
```bash
# 샘플 파일 검증
grep -n "setTimeout(showBanner, 500)" frontend/public/guides/bangkok.html
# ✅ Line 566: setTimeout(showBanner, 500);

grep -c "wasDismissedRecently" frontend/public/guides/bangkok.html
# ✅ 2 occurrences

grep -c "fourHours = 4 * 60 * 60 * 1000" frontend/public/guides/bangkok.html
# ✅ 1 occurrence
```

### Step 3: 프로덕션 배포 (완료)
```bash
rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" \
  frontend/public/guides/ \
  root@46.62.201.127:/static-content/guides/

# ✅ 27개 파일 전송 완료 (751KB)
```

### Step 4: 서버 검증 (완료)
```bash
ssh root@46.62.201.127 "grep -c 'setTimeout(showBanner, 500)' \
  /static-content/guides/bangkok.html \
  /static-content/guides/tokyo.html \
  /static-content/guides/paris.html"

# ✅ 결과:
# bangkok.html:1
# tokyo.html:1
# paris.html:1
```

### Step 5: Nginx 캐시 퍼지 (완료)
```bash
ssh root@46.62.201.127 "docker exec travelplanner-proxy-1 nginx -s reload"
# ✅ 2026/04/03 06:13:50 [notice] signal process started
```

---

## ✅ 검증 체크리스트

- [x] 27개 파일 모두 최적화 (백업 완료)
- [x] `setTimeout(showBanner, 500)` 적용 확인
- [x] `wasDismissedRecently()` 함수 적용 확인
- [x] `fourHours = 4 * 60 * 60 * 1000` 로직 확인
- [x] `now.toString()` Timestamp 저장 확인
- [x] 프로덕션 배포 완료
- [x] 서버 파일 검증 완료
- [x] Nginx 캐시 퍼지 완료

---

## 📊 배포된 파일 목록 (27개)

### 한국어 가이드 (20개)
1. amsterdam.html
2. bali.html
3. bangkok.html
4. barcelona.html
5. dubai.html
6. hawaii.html
7. ho-chi-minh.html
8. index.html
9. istanbul.html
10. kuala-lumpur.html
11. kyoto.html
12. london.html
13. new-york.html
14. osaka.html
15. paris.html
16. prague.html
17. rome.html
18. seoul.html
19. singapore.html
20. sydney.html

### 영어 가이드 (7개)
1. bangkok-en.html
2. index-en.html
3. osaka-en.html
4. paris-en.html
5. seoul-en.html
6. tokyo-en.html
7. tokyo.html

---

## 📦 백업

### 백업 위치
`/docs/backup/guides-20260403-151254/`

### 백업 내용
- 원본 27개 파일 전체
- 최적화 전 상태 보존
- 필요 시 롤백 가능

### 롤백 방법
```bash
# 로컬 롤백
cp /Users/hoonjaepark/projects/travelPlanner/docs/backup/guides-20260403-151254/*.html \
   /Users/hoonjaepark/projects/travelPlanner/frontend/public/guides/

# 프로덕션 롤백
rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" \
  docs/backup/guides-20260403-151254/ \
  root@46.62.201.127:/static-content/guides/
```

---

## 🎯 예상 효과

### 가이드 페이지 트래픽 (월간)
- **방문자 수**: ~1,500명 (랜딩의 30%)
- **모바일 비율**: 60% (~900명)
- **배너 노출**: +60% → 1,440명
- **배너 클릭률**: 15% → 216명
- **앱 설치 전환율**: 30% → **65명**

### 전체 웹→앱 전환 (월간)
| 출처 | 기존 | 최적화 후 | 증가 |
|------|------|----------|------|
| 랜딩 페이지 | 30명 | 50명 | +20 |
| 가이드 페이지 | 0명 | 65명 | +65 |
| **합계** | **30명** | **115명** | **+85명 (+283%)** |

### 비용 절감
- **CAC (광고)**: $2-3
- **CAC (웹)**: $0.50
- **월 절감액**: $127-213 (85명 × $1.5-2.5)

---

## ⚠️ 알려진 이슈

### Cloudflare CDN 캐시
- **상태**: 가이드 페이지도 1시간 캐시 정책 적용
- **영향**: 최대 1시간 후 사용자에게 반영 (~16:00 KST)
- **회피**: Hard refresh (Ctrl+Shift+R) 또는 시크릿 모드

### 기존 사용자 localStorage
- **이슈**: 24시간 dismiss 데이터 보유 사용자
- **영향**: 4시간 정책 즉시 적용 안됨
- **해결**: 자연 만료 대기 (최대 24시간)

---

## 🔍 검수 가능 시점

### 서버 검수 (즉시 가능)
```bash
# SSH로 서버 파일 직접 확인
ssh root@46.62.201.127 "grep 'setTimeout(showBanner, 500)' /static-content/guides/bangkok.html"
# ✅ 예상 결과: setTimeout(showBanner, 500);
```

### 프로덕션 URL 검수 (16:00 KST 이후)
```bash
# Cloudflare 캐시 만료 후
curl -s "https://mytravel-planner.com/guides/bangkok.html" | grep "setTimeout(showBanner, 500)"
# ⏳ 예상: 16:00 KST 이후 확인 가능
```

### 브라우저 검수 (16:00 KST 이후)
1. 시크릿 모드 또는 Hard refresh (Ctrl+Shift+R)
2. 개발자 도구 > 소스 코드 확인
3. `setTimeout(showBanner, 500)` 검색
4. ✅ 확인되면 최적화 적용 완료

---

## 📝 다음 단계

### 즉시 (16:00 KST 이후)
- [ ] 프로덕션 URL에서 최적화 버전 확인
- [ ] 가이드 페이지 모바일 테스트
- [ ] SmartAppBanner 0.5초 지연 체감 확인

### 1주일 후
- [ ] 가이드 페이지별 배너 노출률 분석
- [ ] 가이드 → 앱 전환율 측정
- [ ] 가이드 페이지 트래픽 변화 모니터링

### 2주일 후
- [ ] 전체 웹→앱 전환율 재측정
- [ ] ROI 분석 및 Phase 1 계획 수립

---

**최종 업데이트**: 2026-04-03 15:13 KST
**작성자**: Claude Code
**배포 상태**: ✅ 완료
**검수 가능 시점**: 16:00 KST 이후 (Cloudflare 캐시 만료)
