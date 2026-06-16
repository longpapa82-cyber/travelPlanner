# 브랜치 정리 실행 계획서 (2026-06-02)

## 목표
`main`을 **출시·배포된 현실 상태**에 정렬하고, 미검증 신규기능은 별도 브랜치로 격리.

## 현재 구조 (선형 누적)
```
main (bbd225f8, ios-build33 — 출시본보다 뒤처짐)
  └─[랜딩 11]── feat/landing-motion-enhance ──→ origin (PR #2 OPEN, 웹 배포 완료)
       └─[31일제한 1]── feat/ai-trip-max-duration (c30d398b, 서버 배포·작동 중)
            └─[정리 12]── chore/sync-worktree-state = 현재 HEAD (로컬 only)
```

## ⚠️ 핵심 제약
미출시 3커밋이 정리 커밋 **중간에 끼어** 있음 (맨 끝 아님):
```
aa2d5a86(sub) → 2d8b7fb0(native) → [9f2b319c, b8a2f2e1, 5cdc4c27 = 미출시] → 28e03631(infra) → 9f20381b(web) → dff3597f(docs)
```
→ 단순 reset 불가. **출시본 9커밋만 cherry-pick** 방식 필요.

## 커밋 분류
### A. 출시본·배포완료 → main 대상 (9커밋, 순서대로)
| 해시 | 내용 |
|------|------|
| ba40a1ac | chore: gitignore 임시파일 |
| d9441a4c | feat(auth): Apple 네이티브 로그인 + OAuth + 동의backfill |
| 4e11c816 | refactor(backend): middleware + 공지캐싱 |
| 59915963 | fix(trips): 소수 시간대 + AI 날씨주입 |
| aa2d5a86 | feat(subscription): sandbox + RC동기화 |
| 2d8b7fb0 | build(native): v1.4.2 출시본 셸 |
| 28e03631 | chore(infra): 빌드·배포 설정 |
| 9f20381b | chore(web): 정적 웹·아이콘 |
| dff3597f | docs: 프로젝트 문서·아이콘 |

### B. 미출시 신규기능 → 별도 브랜치 격리 (3커밋)
| 해시 | 내용 |
|------|------|
| 9f2b319c | feat(app): 게스트모드 + AI진행률 + 딥링크보안 + UI |
| b8a2f2e1 | fix(services): API타임아웃 + Apple네이티브로그인 + RC프리로드 |
| 5cdc4c27 | chore(app): ATT제거 + 훅/유틸 + 테스트 |

> 참고: 2d8b7fb0(native, 출시본)에 expo-store-review 의존성 추가 → 9f2b319c(미출시)가 사용.
> main에 native만 가면 "미사용 의존성"만 남으나 동작 무해. 신규 빌드 시 9f2b319c가 합쳐지면 정상.

## 실행 순서

### 1단계 — 랜딩 PR #2 GitHub 머지
```bash
gh pr merge 2 --merge   # 또는 --squash (리뷰 후 결정)
git checkout main && git pull   # main이 랜딩 11커밋 전진
```

### 2단계 — 출시본 9커밋을 main에 정렬
PR #2 머지로 main에 랜딩 포함됨. 그 위에:
```bash
git checkout main
# 31일제한 먼저 (랜딩 바로 위)
git cherry-pick c30d398b
# 출시본 9커밋 순서대로
git cherry-pick ba40a1ac d9441a4c 4e11c816 59915963 aa2d5a86 2d8b7fb0 28e03631 9f20381b dff3597f
# 충돌 시: 파일 단위 커밋이라 대체로 없으나, 발생 시 해당 파일 양쪽 확인
git push origin main
```
→ main = 출시·배포된 현실 상태 (v289/B84/서버 + 랜딩)

### 3단계 — 미출시 신규기능 격리 브랜치
```bash
git checkout main   # 2단계 완료된 main
git checkout -b feat/next-build
git cherry-pick 9f2b319c b8a2f2e1 5cdc4c27
# 이후 QA → 통과 → iOS B85+/Android v290+ 빌드
```

## 실행 전 안전장치
- chore/sync-worktree-state 브랜치는 **삭제하지 말 것** (모든 커밋의 원본 보관소, 정렬 검증용)
- 2단계 cherry-pick 후 `git diff main chore/sync-worktree-state -- backend/ frontend/src` 로 출시본 부분 일치 확인 (미출시 3커밋 제외하면 동일해야)

## 미결정
- PR #2 머지 방식 merge vs squash
- feat/next-build QA 범위·시점
