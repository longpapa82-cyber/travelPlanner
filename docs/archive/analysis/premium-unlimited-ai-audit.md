# 🔴 CRITICAL: 프리미엄 "무제한 AI 생성" 허위 광고 감사 보고서

## 핵심 문제

**심각도**: 🔴 CRITICAL - 허위 광고 / 법적 리스크

**문제**: 프리미엄 구독 안내에서 "무제한 AI 생성"이라고 표기하지만, 실제로는 **월 30회 제한**

**영향 범위**:
- ❌ **22개 파일** 영향
- ❌ **17개 언어** 모두 잘못된 표기
- ❌ **법적 리스크**: 허위 광고, 소비자 보호법 위반 가능
- ❌ **신뢰 문제**: 사용자가 무제한 기대 → 30회에서 차단 → 기만당했다고 느낌

---

## 감사 결과 요약

| 구분 | 파일 수 | 언어 수 | 문제 유형 | 심각도 |
|------|---------|---------|----------|---------|
| **i18n 번역 파일** | 18 | 17 | 다중 키 잘못 표기 | 🔴 CRITICAL |
| **PaywallModal 컴포넌트** | 1 | N/A | i18n 의존 (간접 영향) | 🟡 HIGH |
| **SubscriptionScreen 컴포넌트** | 1 | N/A | ∞ 기호 표기 | 🟡 HIGH |
| **Legal 문서** | 2 | 2 | 일관성 부족 | 🟡 MEDIUM |
| **전체** | **22** | **17** | **체계적 허위 표기** | **🔴 CRITICAL** |

---

## 상세 발견사항

### 1. SubscriptionScreen.tsx - 무한대 기호 (∞) 사용

**파일**: `frontend/src/screens/main/SubscriptionScreen.tsx`
**라인**: 135

```typescript
// ❌ 잘못된 표기
{ feature: t('benefits.unlimitedAi'), freeLabel: '3/mo', premiumLabel: '\u221E', freeOk: false },
//                                                                         ^^^^^^
//                                                                         ∞ 기호 = 무제한 의미
```

**문제**: `\u221E`는 무한대 기호 "∞"를 렌더링하여 명시적으로 무제한을 표시

**올바른 표기**: `'30/mo'`

---

### 2. Premium.json - 17개 언어 전체 잘못 표기

**영향받는 키**:

| 키 경로 | 현재 표기 (예: 영어) | 올바른 표기 |
|---------|---------------------|------------|
| `premium.description` | "Unlimited AI + No Ads" | "30 AI/month + No Ads" |
| `benefits.unlimitedAi` | "Unlimited AI trip planning" | "30 AI trips per month" |
| `paywall.subtitle` | "Enjoy unlimited AI trip planning..." | "Enjoy 30 AI trips per month..." |
| `promo.subtitle` | "Unlimited AI · No Ads · PRO Badge" | "30 AI/month · No Ads · PRO Badge" |
| `context.aiLimitSubtitle` | "...create unlimited AI trip plans" | "...create 30 AI trips per month" |

**영향받는 언어** (17개 전체):
1. 🇰🇷 Korean (ko) - "무제한"
2. 🇺🇸 English (en) - "Unlimited"
3. 🇯🇵 Japanese (ja) - "無制限"
4. 🇨🇳 Chinese (zh) - "无限"
5. 🇪🇸 Spanish (es) - "ilimitada"
6. 🇩🇪 German (de) - "Unbegrenzte"
7. 🇫🇷 French (fr) - "illimitée"
8. 🇹🇭 Thai (th) - "ไม่จำกัด"
9. 🇻🇳 Vietnamese (vi) - "không giới hạn"
10. 🇵🇹 Portuguese (pt) - "Ilimitado"
11. 🇸🇦 Arabic (ar) - "غير محدود"
12. 🇮🇩 Indonesian (id) - "tanpa batas"
13. 🇮🇳 Hindi (hi) - "असीमित"
14. 🇮🇹 Italian (it) - "illimitata"
15. 🇷🇺 Russian (ru) - "Безлимитный"
16. 🇹🇷 Turkish (tr) - "Sınırsız"
17. 🇲🇾 Malay (ms) - "tanpa had"

**파일 경로 예시**:
```
frontend/src/i18n/locales/ko/premium.json
frontend/src/i18n/locales/en/premium.json
frontend/src/i18n/locales/ja/premium.json
... (총 17개)
```

---

### 3. Legal.json - 혼재된 표기

**파일**: `frontend/src/i18n/locales/en/legal.json`
**라인**: 120, 132

```json
// Line 120 - ❌ 혼재
"freeService": {
  "a": "MyTravel is free to use with up to 3 AI trip generations per month. Premium subscription ($3.99/month or $29.99/year) unlocks unlimited AI generation..."
  //                                                                                                                          ^^^^^^^^^ 잘못된 표기
}

// Line 132 - ❌ 잘못된 표기
"premium": {
  "a": "Premium ($3.99/month or $29.99/year) gives you unlimited AI trip generation..."
  //                                                      ^^^^^^^^^ 잘못된 표기
}
```

**주의**: 같은 문장에서 "3 per month" (정확) → "unlimited" (부정확) 혼재

---

### 4. PaywallModal.tsx - 간접 영향

**파일**: `frontend/src/components/PaywallModal.tsx`
**라인**: 31, 244

```typescript
// Line 31 - 혜택 정의
{ icon: 'robot', key: 'unlimitedAi', free: false, premium: true }
//                    ^^^^^^^^^^^^ i18n 키 참조

// Line 244 - 혜택 렌더링
{t('benefits.unlimitedAi')}
// premium.json의 잘못된 번역 사용
```

**문제**: i18n 시스템을 통해 잘못된 "무제한" 메시지 표시

---

## 실제 제한 사항 (사실)

**출처**: `backend/src/trips/trips.service.ts` (91-164 라인)

```typescript
if (user.users_subscriptionTier === 'premium') {
  aiTripLimit = parseInt(process.env.AI_TRIPS_PREMIUM_LIMIT || '30', 10);
  //                                                             ^^^ 실제 제한 30
} else {
  aiTripLimit = parseInt(process.env.AI_TRIPS_FREE_LIMIT || '3', 10);
}

if (currentCount >= aiTripLimit) {
  throw new ForbiddenException(
    `Premium monthly AI generation limit (${aiTripLimit}) reached...`
    // 프리미엄도 30회 제한 있음
  );
}
```

**환경 변수** (`backend/.env`):
```bash
AI_TRIPS_FREE_LIMIT=3
AI_TRIPS_PREMIUM_LIMIT=30  # ← 프리미엄은 30회, 무제한 아님
```

---

## 법적 리스크 평가

### 1. 소비자 보호법 위반 가능성
- **표기**: "무제한 AI 생성"
- **실제**: 월 30회 제한
- **결과**: 허위·과장 광고로 간주될 수 있음

### 2. App Store 정책 위반
- **Google Play**: 앱 설명과 실제 기능 불일치 금지
- **Apple App Store**: 정확한 기능 설명 요구

### 3. 환불 요청 위험
- 사용자가 "무제한" 기대하고 구독
- 30회에서 차단되면 기만당했다고 느낌
- 환불 요청 및 부정적 리뷰 가능성

### 4. 신뢰 손실
- 장기적 사용자 이탈
- 브랜드 평판 하락

---

## 수정 계획

### Phase 1: i18n 번역 파일 일괄 수정 (18개 파일)

**대상 파일**:
```
frontend/src/i18n/locales/*/premium.json  (17개 언어)
frontend/src/i18n/locales/en/legal.json
frontend/src/i18n/locales/ko/legal.json
```

**변경 내용** (영어 예시):

| 키 | 변경 전 | 변경 후 |
|----|---------|---------|
| `premium.description` | "Unlimited AI + No Ads" | "30 AI/month + No Ads" |
| `benefits.unlimitedAi` | "Unlimited AI trip planning" | "30 AI trips per month" |
| `paywall.subtitle` | "Enjoy unlimited AI trip planning and..." | "Enjoy 30 AI trips per month and..." |
| `promo.subtitle` | "Unlimited AI · No Ads · PRO Badge" | "30 AI/month · No Ads · PRO Badge" |
| `context.aiLimitSubtitle` | "Upgrade to create unlimited AI trip plans" | "Upgrade to create 30 AI trips per month" |

**한국어 예시**:
```json
{
  "premium": {
    "description": "30회/월 AI + 광고 없음"  // "무제한 AI + 광고 없음" → 변경
  },
  "benefits": {
    "unlimitedAi": "월 30회 AI 여행 계획"  // "무제한 AI 여행 계획" → 변경
  }
}
```

**일본어 예시**:
```json
{
  "premium": {
    "description": "月30回 AI + 広告なし"  // "無制限 AI + 広告なし" → 変경
  },
  "benefits": {
    "unlimitedAi": "月30回のAI旅行プラン"  // "無制限AI旅行プラン" → 変更
  }
}
```

---

### Phase 2: SubscriptionScreen.tsx 수정

**파일**: `frontend/src/screens/main/SubscriptionScreen.tsx`
**라인**: 135

```typescript
// BEFORE:
{ feature: t('benefits.unlimitedAi'), freeLabel: '3/mo', premiumLabel: '\u221E', freeOk: false },

// AFTER:
{ feature: t('benefits.unlimitedAi'), freeLabel: '3/mo', premiumLabel: '30/mo', freeOk: false },
```

**변경 사유**: 무한대 기호 `∞` → 실제 제한 `30/mo`

---

### Phase 3: Legal.json 수정 (2개 언어)

**파일**:
- `frontend/src/i18n/locales/en/legal.json`
- `frontend/src/i18n/locales/ko/legal.json`

**라인 120 수정**:
```json
// BEFORE:
"a": "MyTravel is free to use with up to 3 AI trip generations per month. Premium subscription ($3.99/month or $29.99/year) unlocks unlimited AI generation, ad-free experience, and enhanced features."

// AFTER:
"a": "MyTravel is free to use with up to 3 AI trip generations per month. Premium subscription ($3.99/month or $29.99/year) unlocks 30 AI generations per month, ad-free experience, and enhanced features."
```

**라인 132 수정**:
```json
// BEFORE:
"a": "Premium ($3.99/month or $29.99/year) gives you unlimited AI trip generation, ad-free experience, and enhanced features."

// AFTER:
"a": "Premium ($3.99/month or $29.99/year) gives you 30 AI trip generations per month, ad-free experience, and enhanced features."
```

---

### Phase 4: PaywallModal.tsx 수정 (선택적)

**파일**: `frontend/src/components/PaywallModal.tsx`
**라인**: 31

**옵션 1**: i18n 키 이름 변경 (추천하지 않음 - 기존 번역 다 깨짐)
```typescript
// BEFORE:
{ icon: 'robot', key: 'unlimitedAi', free: false, premium: true }

// AFTER: (비추천)
{ icon: 'robot', key: 'limitedAi30', free: false, premium: true }
```

**옵션 2**: i18n 키는 유지, 번역만 수정 (추천)
- 키 이름: `unlimitedAi` 유지 (하위 호환성)
- 실제 번역: "30 AI trips per month"로 변경
- **장점**: 코드 변경 최소화, 번역만 업데이트

**권장**: 옵션 2 선택 (Phase 1에서 이미 해결됨)

---

## 우선순위 및 타임라인

### 긴급도: 🔴 CRITICAL

**이유**:
1. **법적 리스크** - 허위 광고 가능성
2. **사용자 신뢰** - 기대와 실제 불일치
3. **App Store 정책** - 정확한 기능 설명 필요
4. **현재 versionCode 38** 배포 전 수정 필요

### 권장 조치 순서

1. **즉시** (30분 소요):
   - Phase 1: 18개 i18n 파일 일괄 수정
   - Phase 2: SubscriptionScreen.tsx ∞ → 30/mo

2. **배포 전** (추가 10분):
   - Phase 3: Legal.json 2개 언어 수정

3. **QA 검증**:
   - 17개 언어 모두 "30/month" 표기 확인
   - 구독 화면 비교 테이블 "30/mo" 확인
   - 법적 문서 일관성 확인

### 예상 소요 시간
- **수정 작업**: 30-40분
- **QA 검증**: 15-20분
- **총 소요 시간**: ~1시간

---

## 영향 평가

### 긍정적 영향
- ✅ **법적 리스크 제거** - 허위 광고 해소
- ✅ **사용자 신뢰 회복** - 정직한 표기
- ✅ **App Store 정책 준수** - 정확한 기능 설명
- ✅ **환불 요청 감소** - 기대치 관리

### 부정적 영향
- ⚠️ **전환율 하락 가능성** - "무제한" → "30회"로 매력도 감소
- ⚠️ **마케팅 메시지 약화** - 덜 인상적인 표현

### 완화 방안
1. **가치 강조**: "30회는 대부분 사용자에게 충분합니다"
2. **비교 우위**: "무료 3회의 10배"
3. **추가 혜택 강조**: "광고 없음 + PRO 배지"

---

## 체크리스트

### 수정 전
- [ ] 현재 versionCode 38 빌드 대기 중
- [ ] 허위 광고 리스크 확인
- [ ] 22개 파일 영향 범위 확인
- [ ] 17개 언어 모두 잘못된 표기 확인

### 수정 중
- [ ] 18개 premium.json 파일 수정
- [ ] 2개 legal.json 파일 수정
- [ ] 1개 SubscriptionScreen.tsx 수정
- [ ] Git commit & push

### 수정 후
- [ ] 17개 언어 "30/month" 표기 확인
- [ ] ∞ 기호 → 30/mo 변경 확인
- [ ] 법적 문서 일관성 확인
- [ ] versionCode 39 빌드 (또는 38 취소 후 재빌드)

---

## 참고 자료

- **백엔드 제한 로직**: `backend/src/trips/trips.service.ts` (91-164 라인)
- **환경 변수**: `backend/.env` (AI_TRIPS_PREMIUM_LIMIT=30)
- **테스트 스위트**: `backend/src/trips/trips.service.ai-limits.spec.ts`
- **프로젝트 문서**: `CLAUDE.md` (Bug #14: 관리자 AI 생성 제한 해제)

---

**작성일**: 2026-03-27
**작성자**: SuperClaude (Explore agent)
**심각도**: 🔴 CRITICAL - 즉시 조치 필요
**다음 단계**: versionCode 38 배포 전 수정 필요
