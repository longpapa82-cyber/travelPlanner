# TravelPlanner docs/

> **`/CLAUDE.md` = 프로젝트 SSOT (Single Source of Truth)**
> 이 디렉토리는 가이드 + 운영 결정 + 아카이브.

## 디렉토리 구조

| 디렉토리 | 목적 |
|---|---|
| `guides/` | 운영/설정 가이드 — 재현 필요 시 참조 |
| `operations/` | 현재 운영 중 아키텍처 결정 (ADR 형식) |
| `archive/` | 종결된 작업의 역사적 기록 |

## 직속 파일 (3개만 유지)

| 파일 | 용도 | 참조 위치 |
|---|---|---|
| `adsense-diagnosis.md` | AdSense 거부 진단 (재신청 시 참조) | CLAUDE.md AdSense 섹션 |
| `store-listing.md` | Play Store 등록정보 마스터 (ko/en/ja) | Play Console 갱신 시 |
| `sns-login-launch-checklist.md` | SNS 로그인 출시 체크리스트 | CLAUDE.md SNS 로그인 섹션 |

## 신규 문서 작성 결정 트리

```
신규 정보 발생
│
├── 영구 참조 (인프라/자격증명/불변식/버전 이력)
│   └── /CLAUDE.md 직접 추가
│
├── 운영 절차 (배포/OAuth/IAP)
│   └── docs/guides/{topic}.md
│
├── 아키텍처 결정 (DB 스키마/외부 API/패턴 변경)
│   └── docs/operations/{topic}.md (Status/Context/Decision/Consequences)
│
├── 버전별 RCA + Fix Plan
│   └── .plan-q/v{N}-*.md (사이클 종료 후 → docs/archive/plan-q-history/)
│
├── Alpha 테스트 결과
│   └── /testResult.md 최상단에 추가
│
└── 일회성 디버그/탐색
    └── 작성 금지. 응답으로 직접 전달.
```

## 명명 규칙

- 가이드: `kebab-case.md` (예: `backend-deployment.md`)
- 버전별 archive: `v{N}-{topic}.md` (예: `v174-admin-fix.md`)
- 날짜별 archive: `YYYY-MM-{topic}.md` (예: `bug-history-2026-04.md`)
- 금지: `UPPERCASE_SNAKE_CASE.md`, 한글 파일명
