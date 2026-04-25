# Bug History — 2026-04 (V49 ~ V112)

> CLAUDE.md "버그 수정 이력 요약" 표가 V112 이후 SSOT.
> 이 파일은 V49~V112의 상세 RCA 문서들에 대한 인덱스.

## 인덱스

### versionCode별 RCA
- [versionCode 53 RCA](version-rcas/versionCode-53-root-cause-analysis.md)
- [versionCode 54 Emergency Fix Plan](version-rcas/versionCode-54-emergency-fix-plan.md)
- [versionCode 56 Comprehensive Bug Analysis](version-rcas/versionCode-56-comprehensive-bug-analysis.md)
- [versionCode 56 Emergency Deployment](version-rcas/versionCode-56-emergency-deployment.md)
- [versionCode 57 Comprehensive Bug Fixes](version-rcas/versionCode-57-comprehensive-bug-fixes.md)
- [versionCode 44 Bug Fixes Summary](version-rcas/versionCode-44-bug-fixes-summary.md)
- [versionCode별 Bug Fixes (V52~V63)](bug-fixes-by-version/) — 디렉토리 인덱스

### V79~V80 통합 분석
- [VC79 광고 시스템 버그](AD_SYSTEM_BUG_ANALYSIS_VC79.md)
- [VC80 종합 분석](BUG_ANALYSIS_VC80_FINAL_REPORT.md)

### V52 회원가입 에러
- [Bug #5 회원가입 에러](BUG_FIX_5_REGISTRATION_ERROR.md)

### 즉시 액션 (2026-04-05)
- [Root Cause Analysis 2026-04-05](ROOT_CAUSE_ANALYSIS_2026_04_05.md)
- [Immediate Action Plan](IMMEDIATE_ACTION_PLAN.md)

### SSE → Polling 전환 (V33~V36)
- [Bug #10 SSE Definitive Fix](bug-10-sse-definitive-fix.md)
- [Bug #11 Railway SSE Buffering](bug-11-railway-sse-buffering.md)
- [Bug #12 SSE Railway Proxy](bug-12-sse-railway-proxy.md)
- [Why All SSE Fixes Failed](root-cause-analysis-why-all-sse-fixes-failed.md)
- [SSE Persistent Issue RCA](root-cause-analysis-sse-persistent-issue.md)
- **결론**: SSE 폐기 → 폴링 아키텍처로 전환 ([operations/polling-architecture.md](../operations/polling-architecture.md))

### Bug #3 (활동 생성)
- [Bug3 Root Cause Analysis](bug3-root-cause-analysis.md)
- [Bug3 Final Fix Verification](bug3-final-fix-verification.md)
- [Activity Creation Fix Test Plan](activity-creation-fix-test-plan.md)

### V44 패치
- [Bug Fix Patches V44](bug-fix-patches-v44.md)
- [Bug Fix Duplicate Trip Creation](bug-fix-duplicate-trip-creation.md)
- [Bug Fix Verification Autocomplete](bug-fix-verification-autocomplete.md)

### V61 핫픽스
- [Hotfix V61 Plan](hotfix-v61-plan.md)

### 기타
- [Cloudflare Email Obfuscation Fix](cloudflare-email-obfuscation-fix.md)
- [Bug Fixes History (legacy combined)](bug-fixes-history.md)

### 관련 카테고리 디렉토리
- [analysis/](analysis/) — 비용/구독/데이터 분석
- [ads-optimization/](ads-optimization/) — AdMob/AdSense 최적화 이력
- [v111-rca/](v111-rca/) — V111 사이클 RCA
- [v112-rca/](v112-rca/) — V112 사이클 RCA
- [v114/](v114/) — V114 14 issue 인벤토리
- [security-audits/](security-audits/) — 보안 감사
- [plan-q-history/](plan-q-history/) — V169/V171/V173 RCA + Fix Plan
