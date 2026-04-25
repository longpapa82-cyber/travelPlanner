# Google Search Console 빠른 시작 체크리스트

## ⏱️ 소요 시간: 15-30분

---

## ✅ 즉시 실행 (오늘)

### 1단계: Search Console 접속 (2분)
```
URL: https://search.google.com/search-console
- Google 계정 로그인 (AdSense와 동일 계정 권장)
- "속성 추가" 버튼 클릭
```

**선택**:
- [ ] **도메인 속성** (권장): `mytravel-planner.com`
- [ ] **URL 접두어**: `https://mytravel-planner.com`

---

### 2단계: 소유권 확인 (10-20분)

**가장 빠른 방법: HTML 파일 업로드**

1. Search Console에서 HTML 파일 다운로드 (예: `google1234567890abcdef.html`)

2. 서버에 업로드:
   ```bash
   scp -i ~/.ssh/travelplanner-oci google*.html root@46.62.201.127:/root/travelPlanner/frontend/public/
   ```

3. 브라우저에서 접근 테스트:
   ```
   https://mytravel-planner.com/google1234567890abcdef.html
   ```
   → 빈 페이지가 뜨면 성공

4. Search Console에서 "확인" 버튼 클릭

**대안: DNS TXT 레코드** (도메인 속성용)
- DNS 설정에 Google 제공 TXT 레코드 추가
- 전파 대기 (5-30분)

---

### 3단계: Sitemap 제출 (1분)

1. Search Console → 좌측 메뉴 "Sitemaps" 클릭

2. 입력란에 입력:
   ```
   https://mytravel-planner.com/sitemap.xml
   ```

3. "제출" 버튼 클릭

4. 상태 확인:
   - [ ] 상태: "성공"
   - [ ] 발견된 URL: 49개

---

### 4단계: 주요 페이지 색인 요청 (5-10분)

**우선 순위 10개**:
```
https://mytravel-planner.com/
https://mytravel-planner.com/guides
https://mytravel-planner.com/guides/tokyo
https://mytravel-planner.com/guides/paris
https://mytravel-planner.com/guides/bangkok
https://mytravel-planner.com/blog
https://mytravel-planner.com/blog/ai-travel-planning-tips
https://mytravel-planner.com/blog/packing-checklist
https://mytravel-planner.com/faq
https://mytravel-planner.com/about
```

**실행 방법**:
1. Search Console 상단 검색창에 URL 입력
2. "색인 생성 요청" 버튼 클릭
3. 다음 URL로 반복 (하루 10-15개 제한)

---

## 📊 1주 후 확인 사항

### 색인 상태 확인
- [ ] Search Console → "커버리지" 메뉴
- [ ] "유효" 그래프에서 색인 페이지 수 확인
- [ ] 목표: 최소 5-10개 색인됨

### 오류 확인
- [ ] "오류" 탭 확인
- [ ] 404, 500 오류 발견 시 수정

---

## 🎯 3주 후 AdSense 재신청 조건

- [ ] Search Console 색인 페이지 ≥ 30개
- [ ] 커버리지 오류 0건
- [ ] 자연 검색 트래픽 ≥ 100회/일
- [ ] 사이트 운영 기간 ≥ 3주

---

## 🆘 문제 발생 시

### HTML 파일 404 오류
```bash
# Nginx 설정 확인
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127
cat /etc/nginx/sites-available/mytravel-planner.com
```

### Sitemap "가져올 수 없음"
```bash
# Sitemap 접근 확인
curl -I https://mytravel-planner.com/sitemap.xml
# 200 OK 응답 확인
```

### DNS TXT 레코드 확인
```bash
dig TXT mytravel-planner.com @8.8.8.8
# 또는
nslookup -type=TXT mytravel-planner.com
```

---

## 📚 상세 가이드

전체 가이드는 `docs/google-search-console-setup.md` 참고

---

## 📅 예상 타임라인

```
오늘:      Search Console 설정 완료 ✅
1주 후:    5-10개 페이지 색인 확인
2주 후:    20-30개 페이지 색인 확인
3주 후:    40-49개 페이지 색인 완료
4-5주 후:  AdSense 재신청
6-7주 후:  AdSense 승인 🎉
```

---

## 💡 핵심 요약

1. **지금 당장**: Search Console 설정 + Sitemap 제출 (30분)
2. **1주 후**: 색인 상태 확인 (5분)
3. **3주 후**: AdSense 재신청 (10분)

**총 투자 시간**: 약 45분 (3주에 걸쳐)
**예상 결과**: AdSense "주의 필요" → "승인" 🎉
