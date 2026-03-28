# Release Notes - versionCode 39

**배포일**: 2026-03-28
**빌드 ID**: 33f93e90-a981-43ff-8867-1bbb1d55dadc
**AAB**: https://expo.dev/artifacts/eas/7qeTNxm2fubQfXYJuehU23.aab

---

## 한국어 (Korean)

**구독 정보 정확성 개선 및 안정성 향상**

• 프리미엄 구독 혜택 정보 명확화
  - 프리미엄: 월 30회 AI 여행 생성 (기존 "무제한" 표기 수정)
  - 무료: 월 3회 AI 여행 생성 (기존과 동일)
  - 17개 언어 모두 정확한 정보로 업데이트

• AI 여행 생성 안정성 개선
  - 생성 실패 시 AI 횟수 차감 버그 수정
  - 트랜잭션 처리 개선으로 데이터 일관성 보장

• 지도 기능 사용성 개선
  - Google Maps/Apple Maps 앱 직접 연동
  - 브라우저 이탈 없이 앱 내에서 지도 앱 선택 가능

• 법적 문서 정확성 개선
  - 이용약관 및 개인정보처리방침 업데이트
  - 구독 혜택 설명 명확화

---

## English

**Subscription Information Accuracy & Stability Improvements**

• Clarified Premium subscription benefits
  - Premium: 30 AI trip generations per month (corrected from "unlimited")
  - Free: 3 AI trip generations per month (unchanged)
  - Updated accurate information across all 17 languages

• Enhanced AI trip generation stability
  - Fixed bug where AI quota was deducted on failed generations
  - Improved transaction handling for data consistency

• Improved map functionality usability
  - Direct integration with Google Maps/Apple Maps apps
  - In-app map app selection without browser navigation

• Legal documentation accuracy improvements
  - Updated Terms of Service and Privacy Policy
  - Clarified subscription benefit descriptions

---

## 日本語 (Japanese)

**サブスクリプション情報の正確性と安定性の向上**

• プレミアムサブスクリプション特典の明確化
  - プレミアム：月30回のAI旅行プラン生成（「無制限」表記を修正）
  - 無料：月3回のAI旅行プラン生成（変更なし）
  - 全17言語で正確な情報に更新

• AI旅行生成の安定性向上
  - 生成失敗時にAI回数が消費されるバグを修正
  - トランザクション処理の改善によるデータ整合性の保証

• 地図機能の使いやすさ向上
  - Google Maps/Apple Mapsアプリと直接連携
  - ブラウザ遷移なしにアプリ内で地図アプリを選択可能

• 法的文書の正確性向上
  - 利用規約とプライバシーポリシーを更新
  - サブスクリプション特典の説明を明確化

---

## Technical Details

### Issue #4: Premium Subscription Information Accuracy (P0 - CRITICAL)
**Severity**: 🔴 CRITICAL - Legal compliance / Consumer protection

**Problem**:
- Subscription screens claimed "unlimited AI generation" but actual limit was 30/month
- Affected 22 files across 17 languages
- Legal risk: False advertising, consumer protection law violations

**Files Modified** (20 files):
- 17 x `premium.json`: 5 keys updated per language
  - `premium.description`: "Unlimited AI" → "30 AI/month"
  - `benefits.unlimitedAi`: "Unlimited AI trip planning" → "30 AI trips per month"
  - `paywall.subtitle`: "unlimited AI..." → "30 AI trips per month..."
  - `promo.subtitle`: "Unlimited AI..." → "30 AI/month..."
  - `context.aiLimitSubtitle`: "unlimited AI trip plans" → "30 AI trips per month"
- 1 x `SubscriptionScreen.tsx`: Infinity symbol (∞) → "30/mo"
- 2 x `legal.json` (en, ko): "unlimited AI generation" → "30 AI generations per month"

**Backend Verification**:
- `backend/src/trips/trips.service.ts`: `AI_TRIPS_PREMIUM_LIMIT=30` (lines 91-164)
- `backend/.env`: `AI_TRIPS_PREMIUM_LIMIT=30`

**Git Commits**:
- `6fc16476`: Fix false advertising across all 22 files
- `6b47bbe8`: Update CLAUDE.md documentation

**Impact**:
- ✅ Legal risk eliminated
- ✅ App Store policy compliance
- ✅ User trust restored (honest messaging)

### Previous Issues (Included)

**Issue #3**: AI quota bug fixed (transaction scope expanded)
**Issue #1**: Map deep linking added (Google Maps/Apple Maps)

---

**Build Time**: ~73 minutes
**Languages**: 17 (ko, en, ja, zh, es, de, fr, th, vi, pt, ar, id, hi, it, ru, tr, ms)
**Files Changed**: 20 files (i18n) + 1 component + 1 documentation
