# Archive

종결된 작업의 역사적 기록. 작성 후 30일+ 미수정 + 종결된 작업만 이동.

## 시간순 통합 인덱스

| 파일 | 범위 |
|---|---|
| [claude-md-history-pre-v112.md](claude-md-history-pre-v112.md) | V0 ~ V111 (CLAUDE.md 경량화 시 분리) |
| [release-notes-history.md](release-notes-history.md) | V33~V114 통합 릴리스 노트 (10개 통합) |
| [bug-history-2026-04.md](bug-history-2026-04.md) | V49~V112 버그 RCA 인덱스 |
| [saleplanner-2026-02.md](saleplanner-2026-02.md) | 2026-02 마케팅 기획 |
| [v174-admin-fix.md](v174-admin-fix.md) | V174 admin quota 수정 (백엔드 측) |

## 카테고리 인덱스

### 출시 준비
| 디렉토리 | 내용 |
|---|---|
| [qa/](qa/) | Phase 7 QA 마스터플랜 산출물 (5개) |
| [phase-0-adsense/](phase-0-adsense/) | AdSense 색인 작업 (2026-03, 5개) |
| [launch/](launch/) | Android 프로덕션 출시 계획 (2026-03, 2개) |
| [testing-guides/](testing-guides/) | Alpha 초기 테스트 가이드 (3개) |

### RCA 모음
| 디렉토리 | 내용 |
|---|---|
| [v111-rca/](v111-rca/) | V111 사이클 RCA (3개) |
| [v112-rca/](v112-rca/) | V112 사이클 RCA (6개) |
| [v114/](v114/) | V114 14 issue 인벤토리 (12개) |
| [version-rcas/](version-rcas/) | versionCode 44/53/54/56/57 RCA (6개) |
| [bug-fixes-by-version/](bug-fixes-by-version/) | versionCode별 bug fixes (V52~V63, 11개) |
| [plan-q-history/](plan-q-history/) | V169/V171/V173 RCA + Fix Plan (6개) |

### 분석 문서
| 디렉토리 | 내용 |
|---|---|
| [analysis/](analysis/) | 비용/구독/데이터 분석 (4개) |
| [web-analysis/](web-analysis/) | 웹 사용자 분석 (2026-04-03, 3개) |
| [ads-optimization/](ads-optimization/) | AdMob/AdSense 최적화 이력 (9개) |
| [security-audits/](security-audits/) | 보안 감사 (1개) |

### 운영 로그
| 디렉토리 | 내용 |
|---|---|
| [deployment-logs/](deployment-logs/) | Railway 시절 배포 로그 (2026-03, 3개) |
| [deployment-old/](deployment-old/) | Phase 0a/0b alpha deployment runbook (4개) |

### 잡문
직속 .md 파일들 — SSE/Bug3/V61 hotfix/Cloudflare 등 단일 이슈 RCA 누적

## Archive 정책

1. **언제 이동**: 작업 종결 + 30일 미수정
2. **이동 위치**: 카테고리 디렉토리 우선, 없으면 archive/ 직속
3. **명명**: 원본 이름 유지 (이력 추적 가치). 통합 시에만 `{topic}-{YYYY-MM}.md` 형식
4. **삭제 금지**: archive로 이동 후에는 삭제하지 않음 (git history는 보존되지만 검색성 손실)
