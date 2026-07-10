# blog-facts.md — 블로그 글 생성 사실 불변식 (모든 생성 에이전트 필독)

> 이 문서의 제약을 위반하면 `scripts/validate-content.py` CI 게이트에서 **배포 차단**된다.
> 생성 프롬프트에 이 전문을 주입할 것.

## 1. 제품 사실 (반드시 이대로만 서술)
- **AI 여행 생성 한도**: 무료 월 3회 / 프리미엄 **월 30회**. → "무제한 AI"·"unlimited AI"·"無制限" 절대 금지.
- **AI 생성 소요 시간**: 실제 10~30초. → "5초 만에 완성"·"in N seconds"·"instantly"·"즉시 생성" 금지.
- **통화 지원**: 환율 계산 **7종**. → "100+ 통화"·"100+ currencies" 금지.
- **소셜 기능**: **좋아요(like)만 구현**. → "댓글"·"comment"·"리뷰"·"review"를 여행/후기에 붙이는 표현 금지.
- **미구현 기능(언급 금지)**: 체크리스트(checklist), iCal 내보내기, Apple 캘린더 연동, 제휴 마케팅(affiliate), Booking.com·Klook·GetYourGuide 등 제휴 브랜드.
- **웹 결제(Paddle) 폐지**: "Paddle" 언급 금지(네이티브 IAP만).
- **지원 언어**: 앱 UI 17개 언어(ko,en,ja,zh,es,de,fr,th,vi,pt,ar,id,hi,it,ru,tr,ms).

## 2. 광고법·마케팅 표현 금지 (표시광고법 §3 절대적 표현)
- 금지: "완벽한 일정/여행계획/플래너", "perfect itinerary/trip planner", "최고의 앱/플래너", "the best travel app", "world's best".
- 금지: "enterprise-grade", "엔터프라이즈급", "blazingly fast", "100% secure".
- 금지: "모든 기능 무료", "all features are free" (프리미엄 유료 플랜 존재).
- ✅ 허용: 여행지 묘사의 일반 형용사("완벽한 노을", "perfect sunset")는 OK. 서비스/기능 광고 컨텍스트만 금지.

## 3. 구조 불변식
- **copyright**: 푸터 단일연도 `© 2026 AI Soft` (KO 표면 표기는 "에이아이소프트" 정책이나, 저작권 푸터는 로마자 `AI Soft` 유지 — 메모리 company_name_korean_rename 정책과 일치). 2026 미만 연도 금지.
- **datePublished / dateModified**: **오늘(2026-07-10) 이하**의 과거 날짜만. 미래 날짜 금지(Google이 Article 구조화데이터 무효 처리). 신규 글은 2026-07-10 사용.
- **slug**: nginx 정규식 `[a-z0-9-]+` 준수 — 소문자·숫자·하이픈만. 언어변형은 `-en`/`-ja` 접미사.
- **canonical/OG/hreflang**: 각 글 canonical = 자기 URL. KO↔EN↔JA는 hreflang alternate로 상호 링크.
- **AdSense**: 기존 슬롯 `data-ad-client="ca-pub-7330738950092177"`, 본문 중간 슬롯 `data-ad-slot="2397004834"` 재사용.

## 4. 브랜드/링크
- 서비스명 표기: **myTravel** (본문), 도메인 `https://mytravel-planner.com`.
- CTA 링크: `/trips/create` (여행 생성). 헤더 로그인: `/login`.
- 앱 다운로드: Android `https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner`, iOS `https://apps.apple.com/app/id6766147060`.
- 관련글: 같은 언어 글끼리만 링크(KO글→KO글, EN글→EN글). guides 링크는 언어 무관 허용.

## 5. 톤 & 품질
- 실용적·구체적·경험 기반. 과장 없이 정보 밀도 높게.
- 글당 H2 5~7개, 본문 1,500~2,500 단어(KO 기준), tip-box 2~3개, CTA 1개, 관련글 4~5개.
- EN/JA는 번역이 아닌 **로컬라이즈**(해당 언어권 독자 맥락·예시).
