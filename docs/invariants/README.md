# 핵심 불변식 (45개)

이 규칙들은 과거 버그의 근본 원인을 기반으로 도출된 것입니다.
**절대 위반 금지** — 위반 시 phantom 구독, 보안 취약점, 또는 결제 버그 재발.

## 파일 구조

| 파일 | 범위 | 불변식 |
|------|------|--------|
| [payment.md](payment.md) | 구독/결제 | #1~16 |
| [auth.md](auth.md) | 인증/로그아웃/OAuth | #17~29 |
| [android-ui.md](android-ui.md) | Android/UI | #30~34 |
| [error-diag.md](error-diag.md) | 에러/진단 | #35~39 |
| [backend.md](backend.md) | 데이터/백엔드 | #40~43 |
| [legal.md](legal.md) | 법적/콘텐츠 | #44~45 |

## 상세 RCA

- `docs/archive/version-rcas/v174-v210-rca.md` — V174~V210 버전별 근본 원인 분석
- `docs/archive/bug-history-2026-04.md` — V49~V112 버그 RCA 인덱스
