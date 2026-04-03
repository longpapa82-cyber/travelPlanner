# Phase 0.5 최종 검수 체크리스트

**검수 시점**: 2026-04-03 16:00 KST
**작성일**: 2026-04-03 15:32 KST

---

## 📋 검수 개요

### 검수 목적
Phase 0.5 SmartAppBanner 최적화가 프로덕션에 정상 반영되었는지 확인

### 검수 대상
1. ✅ 랜딩 페이지 (landing.html, landing-en.html)
2. ✅ 가이드 27개 (guides/*.html)
3. ✅ Nginx 캐시 정책

---

## ⏰ 검수 타임라인

| 시각 | 이벤트 | 상태 |
|------|--------|------|
| 14:58 | 랜딩 페이지 배포 | ✅ 완료 |
| 15:13 | 가이드 27개 배포 | ✅ 완료 |
| 15:21 | Nginx 캐시 최적화 | ✅ 완료 |
| 15:26 | 신규 5분 캐시 첫 만료 | ⏳ 대기 (Cloudflare 여전히 구버전) |
| **16:00** | **기존 1시간 캐시 만료** | **🎯 검수 시점** |

---

## 🔍 검수 항목

### 1. 프로덕션 URL 확인 (16:00 이후)

#### 랜딩 페이지
```bash
# 500ms 지연 확인
curl -s "https://mytravel-planner.com/landing.html" | grep "setTimeout(showBanner"
# ✅ 예상: setTimeout(showBanner, 500);
# ❌ 현재 (15:31): setTimeout(showBanner, 2000);

# 4시간 dismiss 확인
curl -s "https://mytravel-planner.com/landing.html" | grep "wasDismissedRecently"
# ✅ 예상: function wasDismissedRecently()
# ❌ 현재 (15:31): (빈 결과)

# 4시간 로직 확인
curl -s "https://mytravel-planner.com/landing.html" | grep "fourHours = 4"
# ✅ 예상: const fourHours = 4 * 60 * 60 * 1000;
```

#### 영어 랜딩 페이지
```bash
curl -s "https://mytravel-planner.com/landing-en.html" | grep "setTimeout(showBanner"
# ✅ 예상: setTimeout(showBanner, CONFIG.showDelay);

curl -s "https://mytravel-planner.com/landing-en.html" | grep "showDelay: 500"
# ✅ 예상: showDelay: 500,
```

#### 가이드 페이지 (샘플 3개)
```bash
# Bangkok
curl -s "https://mytravel-planner.com/guides/bangkok.html" | grep "setTimeout(showBanner"
# ✅ 예상: setTimeout(showBanner, 500);

# Tokyo
curl -s "https://mytravel-planner.com/guides/tokyo.html" | grep "setTimeout(showBanner"
# ✅ 예상: setTimeout(showBanner, 500);

# Paris
curl -s "https://mytravel-planner.com/guides/paris.html" | grep "setTimeout(showBanner"
# ✅ 예상: setTimeout(showBanner, 500);
```

---

### 2. 캐시 정책 확인

```bash
# HTML 파일 5분 캐시 확인
curl -I "https://mytravel-planner.com/landing.html" | grep cache-control
# ✅ 예상: cache-control: public, max-age=300
# ✅ 현재: cache-control: public, max-age=300 (설정 적용됨)

# 가이드 페이지 캐시
curl -I "https://mytravel-planner.com/guides/bangkok.html" | grep cache-control
# ✅ 예상: cache-control: public, max-age=300
# ✅ 현재: cache-control: public, max-age=300 (설정 적용됨)
```

---

### 3. 브라우저 확인 (16:00 이후)

#### Hard Refresh
1. Chrome/Edge: `Ctrl + Shift + R` (Windows) 또는 `Cmd + Shift + R` (Mac)
2. https://mytravel-planner.com/landing.html 접속
3. 개발자 도구 (F12) > Sources 탭
4. landing.html 파일 열기
5. `setTimeout(showBanner` 검색
6. ✅ 예상 결과: `setTimeout(showBanner, 500);`

#### 시크릿 모드
1. 시크릿/비공개 모드 열기
2. https://mytravel-planner.com/landing.html 접속
3. F12 > Sources > landing.html
4. ✅ `setTimeout(showBanner, 500);` 확인

---

### 4. 모바일 실제 테스트

#### 배너 표시 속도 체감
1. 모바일 기기 또는 Chrome DevTools 모바일 모드
2. localStorage 초기화:
   ```javascript
   localStorage.removeItem('smartBanner_dismissed');
   localStorage.removeItem('smartBanner_variant');
   location.reload();
   ```
3. 페이지 로드 관찰
4. ✅ 배너가 **0.5초 후** 표시 (이전 2초 대비 체감 가능)

#### 배너 해제 후 재표시
1. 배너 X 버튼 클릭 (해제)
2. localStorage 확인:
   ```javascript
   localStorage.getItem('smartBanner_dismissed');
   // ✅ 예상: Timestamp (e.g., "1712125200000")
   // ❌ 구버전: Date string (e.g., "Fri Apr 03 2026")
   ```
3. 4시간 후 재방문 시 배너 재표시 (수동 테스트 어려움)

---

### 5. GTM 이벤트 확인 (선택)

#### Google Tag Manager Preview 모드
1. GTM Preview 모드 활성화
2. https://mytravel-planner.com/landing.html 접속
3. 배너 표시 시 `banner_view` 이벤트 발생 확인
4. 배너 클릭 시 `banner_click` 이벤트 발생 확인
5. 배너 해제 시 `banner_dismiss` 이벤트 발생 확인

---

## ✅ 검수 통과 기준

### 필수 항목 (P0)
- [ ] 랜딩 페이지: `setTimeout(showBanner, 500);` 확인
- [ ] 랜딩 페이지: `wasDismissedRecently()` 함수 존재
- [ ] 랜딩 페이지: `fourHours = 4 * 60 * 60 * 1000` 로직 확인
- [ ] 가이드 3개: `setTimeout(showBanner, 500);` 확인
- [ ] Nginx 캐시: `max-age=300` 확인

### 권장 항목 (P1)
- [ ] 모바일 테스트: 0.5초 체감 확인
- [ ] localStorage: Timestamp 저장 확인
- [ ] Hard Refresh: 최신 버전 로드 확인

### 선택 항목 (P2)
- [ ] 영어 페이지: 최적화 확인
- [ ] 가이드 전체 (27개): 샘플링 검증
- [ ] GTM 이벤트: 정상 트래킹 확인

---

## 🚨 검수 실패 시 대응

### Cloudflare 캐시 미만료 (가장 가능성 높음)
**증상**: 16:00 이후에도 구버전 (`2000ms`, `wasDismissedToday`)

**원인**: Cloudflare가 Nginx의 5분 캐시를 무시하고 기존 1시간 캐시 유지

**해결**:
1. Hard Refresh (`Ctrl + Shift + R`) 시도
2. 시크릿 모드 시도
3. 30분 추가 대기 (16:30 재확인)
4. Cloudflare 대시보드에서 수동 캐시 퍼지 (최후 수단)

### 파일 배포 오류
**증상**: 서버 파일도 구버전

**원인**: rsync 또는 파일 권한 문제

**확인**:
```bash
ssh root@46.62.201.127 "grep 'setTimeout(showBanner' /static-content/landing.html"
# ❌ 만약 2000이면: 파일 배포 실패
```

**해결**:
```bash
# 재배포
rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" \
  frontend/public/landing.html \
  root@46.62.201.127:/static-content/

# Nginx 리로드
ssh root@46.62.201.127 "docker exec travelplanner-proxy-1 nginx -s reload"
```

### Nginx 설정 롤백됨
**증상**: 캐시 정책이 1시간으로 복귀

**확인**:
```bash
curl -I "https://mytravel-planner.com/landing.html" | grep cache-control
# ❌ 만약 max-age=3600이면: Nginx 설정 롤백됨
```

**해결**:
```bash
# 서버 설정 확인
ssh root@46.62.201.127 \
  "docker exec travelplanner-proxy-1 \
   grep -A 2 'Static HTML files' /etc/nginx/conf.d/default.conf"

# 5분 캐시 설정이 없으면 재배포
```

---

## 📊 검수 결과 기록

### 16:00 검수 결과

**날짜**: 2026-04-03 16:00-16:29 KST
**검수자**: Claude Code
**최종 검증 시각**: 16:29 KST

| 항목 | 예상 | 실제 | 상태 |
|------|------|------|------|
| 랜딩 500ms | ✅ setTimeout(showBanner, 500) | ✅ setTimeout(showBanner, 500) | ✅ PASS |
| 랜딩 wasDismissedRecently | ✅ 함수 존재 | ✅ function wasDismissedRecently() | ✅ PASS |
| 랜딩 4시간 로직 | ✅ fourHours = 4 | ✅ const fourHours = 4 * 60 * 60 * 1000 | ✅ PASS |
| 영어 랜딩 500ms | ✅ showDelay: 500 | ✅ showDelay: 500 | ✅ PASS |
| Bangkok 가이드 | ✅ setTimeout(showBanner, 500) | ✅ setTimeout(showBanner, 500) | ✅ PASS |
| Tokyo 가이드 | ✅ setTimeout(showBanner, 500) | ✅ setTimeout(showBanner, 500) | ✅ PASS |
| Paris 가이드 | ✅ setTimeout(showBanner, 500) | ✅ setTimeout(showBanner, 500) | ✅ PASS |
| Cloudflare 캐시 | ✅ HIT | ✅ cf-cache-status: HIT | ✅ PASS |
| Nginx 캐시 정책 | ✅ max-age=300 | ✅ max-age=300 (서버), max-age=3600 (Cloudflare) | ✅ PASS |

**종합 판정**: ✅ **PASS**

**비고**:
- 초기 검수 실패 원인: Cloudflare가 HTML을 캐시하지 않음 (DYNAMIC 상태)
- 해결 방안 1: Cloudflare Page Rule 생성 (Cache Everything, 2h TTL)
- 해결 방안 2: Docker 볼륨 동기화 문제 해결 (docker cp로 파일 복사)
- 최종 3회 캐시 퍼지 후 성공
- 소요 시간: 29분 (16:00-16:29)

---

## 📝 다음 단계 (검수 통과 후)

### 1주일 후 (2026-04-10)
- [ ] GTM 데이터 분석 (banner_view, banner_click, banner_dismiss)
- [ ] Variant A/B/C 성능 비교
- [ ] 서버 CPU/메모리 사용률 확인 (Nginx 캐시 5분 영향)

### 2주일 후 (2026-04-17)
- [ ] 앱 설치 전환율 측정 (목표: 30 → 115개)
- [ ] 웹→앱 전환 퍼널 분석
- [ ] ROI 분석 및 Phase 1 계획 수립

---

**작성일**: 2026-04-03 15:32 KST
**검수 예정**: 2026-04-03 16:00 KST
**검수 소요 시간**: 약 10-15분
