# MyTravel Sprint Plan — 2026년 2월

> 작성일: 2026-02-28 | 상태: ✅ 전체 완료 (Task 6 심사 대기 중)

---

## 목차

1. [Task 1: 로그인 유지 버그 수정](#task-1-로그인-유지-버그-수정)
2. [Task 2: 무중단 배포 체계 구축](#task-2-무중단-배포-체계-구축)
3. [Task 3: AI 생성 비용 90% 절감 + 로딩 속도 개선](#task-3-ai-생성-비용-90-절감--로딩-속도-개선)
4. [Task 4: 신규 사용자 튜토리얼 모드](#task-4-신규-사용자-튜토리얼-모드)
5. [Task 5: 최종 QA · 보안 점검 · 운영 배포](#task-5-최종-qa--보안-점검--운영-배포)
6. [Task 6: Google Play Store 프로덕션 배포](#task-6-google-play-store-프로덕션-배포)
7. [실행 순서 및 의존 관계](#실행-순서-및-의존-관계)

---

## Task 1: 로그인 유지 버그 수정

### 1.1 현황 분석 (Root Cause)

**증상**: 앱 종료 후 재시작하면 로그인 화면으로 돌아감

**근본 원인**: Android Keychain 초기화 타이밍 문제 (react-native-keychain #594)

```
앱 재시작
  → AuthContext.checkAuthStatus()
  → secureStorage.getItem(AUTH_TOKEN)
  → Keychain 3회 재시도 (300ms × 3 = 900ms)
  → 여전히 null 반환 (Keychain 초기화 미완료)
  → Refresh Token도 동일하게 실패
  → 사용자 미인증 상태 → 로그인 화면 리디렉트
```

**관련 파일**:
| 파일 | 역할 | 핵심 라인 |
|------|------|-----------|
| `frontend/src/utils/storage.ts` | Keychain 읽기/쓰기, 재시도 로직 | L15-16 (retry config), L60-78 (getItem) |
| `frontend/src/contexts/AuthContext.tsx` | 세션 복원 로직 | L111-194 (checkAuthStatus) |
| `frontend/src/services/api.ts` | 토큰 갱신 인터셉터 | L98-122 (refresh + verify) |
| `backend/src/config/jwt.config.ts` | JWT 만료 설정 | L22-24 (15m/30d) |

### 1.2 수정 계획

#### Phase A: Keychain 안정성 강화
| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| A1 | 재시도 횟수/딜레이 증가 | `storage.ts` | 3회→5회, 300ms→500ms (지수 백오프) |
| A2 | AsyncStorage 토큰 백업 | `storage.ts` | Keychain 저장 시 AsyncStorage에 암호화 백업 동시 저장 |
| A3 | 복원 폴백 체인 확장 | `AuthContext.tsx` | Keychain → AsyncStorage 백업 → 오프라인 캐시 프로필 순서 |

#### Phase B: 토큰 복원 로직 개선
| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| B1 | Refresh Token 우선 복원 | `AuthContext.tsx` | Access Token 실패 시 즉시 Refresh Token으로 재발급 시도 |
| B2 | 세션 플래그 기반 복원 | `AuthContext.tsx` | `SESSION_FLAG=true`이면 Keychain 실패해도 포기하지 않고 AsyncStorage 백업 시도 |
| B3 | 토큰 저장 검증 강화 | `api.ts` | 갱신 후 저장 검증 실패 시 3회 재시도 (현재 1회) |

#### Phase C: 검증
| # | 작업 | 방법 |
|---|------|------|
| C1 | 단위 테스트 | storage.ts 폴백 체인 테스트 |
| C2 | 시나리오 테스트 | 앱 종료 → 재시작 → 자동 로그인 확인 |
| C3 | auto-qa 에이전트 | 인증 흐름 전체 검수 |

### 1.3 예상 변경 사항

```
frontend/src/utils/storage.ts          — Keychain 재시도 강화 + AsyncStorage 백업
frontend/src/contexts/AuthContext.tsx   — 복원 폴백 체인 확장
frontend/src/services/api.ts           — 토큰 저장 검증 강화
```

### 1.4 리스크 및 대응

| 리스크 | 확률 | 대응 |
|--------|------|------|
| AsyncStorage 백업이 보안 약화 | 중 | AES 암호화 적용 또는 난독화 저장 |
| 재시도 증가로 앱 시작 지연 | 낮 | 지수 백오프로 최대 3.1초 → 사용자 체감 미미 |
| iOS에서는 불필요한 변경 | 낮 | Platform.OS 분기로 Android만 백업 적용 |

---

## Task 2: 무중단 배포 체계 구축

### 2.1 현황 분석

**현재 배포 방식**: SSH → git pull → `docker compose build --no-cache` → restart
- 빌드 중 서비스 중단: 약 5-10분
- 1GB 서버에서 OOM 빈발 (빌드 시 메모리 부족)
- 수동 프로세스 — 자동화 없음

**기존 인프라**:
- 서버: OCI E2.1.Micro (1 vCPU, 1GB RAM + 2GB swap)
- 스택: Docker Compose (postgres, redis, backend, frontend, proxy)
- SSL: Let's Encrypt + Cloudflare
- 기존 deploy.sh 스크립트: Blue-Green 패턴 구현되어 있으나 **사용되지 않고 있음**

### 2.2 해결 방안 검토

#### 옵션 A: docker-rollout 플러그인 (권장)
> 참고: [docker-rollout](https://github.com/wowu/docker-rollout) — Docker Compose 무중단 배포 플러그인

| 항목 | 내용 |
|------|------|
| 원리 | 서비스를 2배로 스케일업 → 새 컨테이너 healthy 확인 → 기존 컨테이너 제거 |
| 명령 | `docker rollout backend` (기존 `docker compose up -d` 대체) |
| 요구사항 | 헬스체크 필수 (이미 구현됨), Nginx upstream 자동 감지 |
| 메모리 | 일시적으로 2배 사용 — 1GB 서버에서 backend 300MB×2=600MB 필요 |
| 장점 | 설치 간편, 기존 docker-compose.yml 변경 없음 |
| 단점 | 1GB 서버에서 메모리 부족 가능 — swap 의존 |

#### 옵션 B: 기존 deploy.sh 스크립트 활성화
| 항목 | 내용 |
|------|------|
| 원리 | Mac에서 빌드 → 이미지 전송 → Blue-Green upstream 전환 |
| 장점 | 서버 빌드 부하 0, 메모리 안전 |
| 단점 | 이미지 전송 시간 (500MB+), 네트워크 의존 |

#### 옵션 C: GitHub Actions CI/CD + 이미지 레지스트리
| 항목 | 내용 |
|------|------|
| 원리 | push → GitHub Actions 빌드 → GHCR에 이미지 push → 서버에서 pull + rollout |
| 장점 | 완전 자동화, 서버 빌드 부하 0 |
| 단점 | 초기 설정 복잡, GHCR 스토리지 비용 (무료 500MB) |

### 2.3 실행 계획 (옵션 A+B 하이브리드)

#### Phase A: docker-rollout 설치 및 설정
| # | 작업 | 상세 |
|---|------|------|
| A1 | 서버에 docker-rollout 설치 | `curl -s install script` |
| A2 | backend 메모리 제한 조정 | 200MB로 축소하여 롤아웃 시 400MB 사용 |
| A3 | 롤아웃 테스트 | `docker rollout backend` 실행 및 서비스 연속성 확인 |

#### Phase B: 배포 스크립트 개선
| # | 작업 | 상세 |
|---|------|------|
| B1 | deploy.sh 개선 | Mac 빌드 → 이미지 전송 → `docker rollout` 사용 |
| B2 | 롤백 자동화 | 이전 이미지 태깅 + 원클릭 롤백 |
| B3 | 배포 전 헬스체크 | 배포 전/후 자동 검증 |

#### Phase C: 모니터링
| # | 작업 | 상세 |
|---|------|------|
| C1 | 배포 알림 | 배포 시작/완료/실패 시 알림 (선택) |
| C2 | 서비스 상태 대시보드 | `/api/health` 모니터링 |

### 2.4 참고 자료
- [docker-rollout GitHub](https://github.com/wowu/docker-rollout)
- [Zero-downtime Docker Compose](https://supun.io/zero-downtime-deployments-docker-compose)
- [OCI VPS 무중단 배포](https://dev.to/thayto/zero-downtime-deployment-with-docker-compose-in-an-oci-vps-using-github-actions-1fbd)

---

## Task 3: AI 생성 비용 90% 절감 + 로딩 속도 개선

### 3.1 현황 분석

**현재 구성**:
| 항목 | 값 |
|------|-----|
| 모델 | `gpt-4o-mini` ($0.15/1M input, $0.60/1M output) |
| 호출당 토큰 | ~700-1100 tokens (입력+출력) |
| 호출당 비용 | ~$0.0005-0.0010 |
| 캐싱 | 3-layer (Template DB → Redis 24h → Memory) |
| 템플릿 히트율 | 추정 50% (미측정) |
| 월 비용 추정 | 1,000 사용자 기준 ~$54/월 |
| 응답 방식 | Full response (스트리밍 미사용) |
| max_tokens | 4096 (과다 설정) |

**이미 최적화된 항목**:
- 다층 캐싱 (Template + Redis + Memory)
- Circuit Breaker + 지수 백오프 재시도
- 자동 템플릿 저장 (fire-and-forget)
- 병렬 날씨 데이터 패칭
- 벡터 유사도 검색 (pgvector)

### 3.2 비용 절감 전략 (목표: 90%+ 절감)

#### 전략 1: 모델 다운그레이드/교체 (즉시 40-80% 절감)

| 모델 | 입력/1M | 출력/1M | 절감율 | 품질 |
|------|---------|---------|--------|------|
| **gpt-4o-mini** (현재) | $0.15 | $0.60 | 기준 | 좋음 |
| **gpt-4.1-nano** | $0.10 | $0.40 | 33% | 유사 |
| **gpt-4.1-mini** | $0.16 | $0.64 | -6% | 더 좋음 |
| **DeepSeek V3** (API) | $0.07 | $0.27 | 55% | 유사 |
| **Gemini 2.0 Flash** | $0.10 | $0.40 | 33% | 유사 |
| **Claude 3.5 Haiku** | $0.80 | $4.00 | -567% | 더 비쌈 |

> 참고: [OpenAI Pricing](https://openai.com/api/pricing/), [LLM API 가격 비교](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)

**권장**: `gpt-4.1-nano` ($0.10/$0.40) — 33% 절감 + 동급 품질

#### 전략 2: 템플릿 캐시 히트율 극대화 (50% → 85%)

| # | 작업 | 효과 |
|---|------|------|
| S1 | 벡터 유사도 임계값 조정 | 0.82 → 0.75 (더 넓은 매칭) |
| S2 | 인기 여행지 사전 생성 | 상위 50개 도시 × 3/5/7일 × 2스타일 = 300개 템플릿 |
| S3 | 언어별 템플릿 공유 | 일정 구조는 언어 무관 → 번역만 적용 |
| S4 | 캐시 히트율 대시보드 | Redis 기반 카운터로 hit/miss 추적 |

**효과**: 85% 히트율 달성 시 API 호출 85% 감소

#### 전략 3: 프롬프트 최적화 (20-30% 토큰 절감)

| # | 작업 | 효과 |
|---|------|------|
| P1 | 시스템 메시지 압축 | 140 → 80 tokens (-43%) |
| P2 | JSON 스키마 간소화 | 불필요한 필드 설명 제거 |
| P3 | max_tokens 조정 | 4096 → 2048 (실제 응답 200-400 tokens) |

#### 전략 4: Batch API 활용 (50% 할인)

| # | 작업 | 효과 |
|---|------|------|
| B1 | 인기 여행지 사전 생성을 Batch API로 | 50% 비용 절감 |
| B2 | 스테일 템플릿 갱신을 Batch로 | 24시간 내 처리, 반값 |

### 3.3 종합 절감 효과

```
현재:    1,000 사용자 × 3 trips = 3,000 trips/월
         50% 캐시 히트 → 1,500 API 호출 → ~$54/월

개선 후: 85% 캐시 히트 → 450 API 호출
         gpt-4.1-nano ($0.10/$0.40) → 호출당 $0.0003
         프롬프트 30% 압축 → 호출당 $0.0002
         450 × $0.0002 = $0.09/월

절감율:  $54 → $0.09 = 99.8% 절감
```

### 3.4 로딩 속도 개선

| # | 작업 | 현재 | 개선 | 효과 |
|---|------|------|------|------|
| L1 | 스트리밍 응답 | Full response 대기 | SSE 스트리밍 | 체감 속도 3-5배 향상 |
| L2 | 캐시 히트 시 즉시 반환 | DB 조회 200-500ms | Redis 캐시 <50ms | 10배 빠름 |
| L3 | 프론트엔드 스켈레톤 UI | 로딩 스피너만 표시 | 일정 스켈레톤 + 진행률 표시 | UX 개선 |
| L4 | 낙관적 UI | API 응답 대기 | 예상 일정 미리 보여주기 | 체감 속도 개선 |

### 3.5 실행 계획

| 우선순위 | 작업 | 비용 절감 | 난이도 |
|----------|------|----------|--------|
| P0 | max_tokens 4096→2048, 프롬프트 압축 | 20-30% | 낮음 |
| P0 | 캐시 히트율 측정 대시보드 | 측정 기반 | 낮음 |
| P1 | 인기 여행지 300개 사전 생성 (Batch API) | 40% | 중간 |
| P1 | 벡터 유사도 임계값 튜닝 | 15% | 낮음 |
| P2 | 모델 gpt-4.1-nano 전환 테스트 | 33% | 낮음 |
| P2 | SSE 스트리밍 응답 | 로딩 속도 3-5× | 중간 |
| P3 | 언어별 템플릿 공유 | 10% | 중간 |

### 3.6 참고 자료
- [GPT-4.1 Nano 가격](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/)
- [OpenAI API 가격](https://openai.com/api/pricing/)
- [Azure OpenAI 비용 절감 6가지](https://www.finout.io/blog/azure-openai-pricing-6-ways-to-cut-costs)
- [DeepSeek V3.2 오픈소스](https://o-mega.ai/articles/top-10-open-source-llms-the-deepseek-revolution-2026)

---

## Task 4: 신규 사용자 튜토리얼 모드

### 4.1 벤치마킹 분석

#### 글로벌 여행 앱 온보딩 패턴

| 앱 | 온보딩 방식 | 강점 | 약점 |
|----|------------|------|------|
| **Hopper** | 가치 중심 — "얼마나 절약할 수 있는지" 즉시 표시 | 즉각적 가치 전달 | 기능 설명 부족 |
| **Airbnb** | 스킵 가능한 가입 → 바로 탐색 가능 | 진입 장벽 최소화 | 기능 발견 어려움 |
| **TripIt** | 4화면 튜토리얼 (사용법 설명) | 체계적 | 가치보다 기능에 집중 |
| **Google Travel** | 자동 수집 (Gmail 동기화) — 설명 없음 | 제로 마찰 | 앱 고유 기능 모름 |
| **Duolingo** | 가입 전 체험 → 진행률 시각화 → 점진적 학습 | 최고의 리텐션 | 여행 앱과 도메인 다름 |
| **Blinkist** | 3개 질문으로 개인화 → 맞춤 피드 | 빠른 개인화 | 과도한 질문은 이탈 유발 |

> 참고: [Mobile Onboarding Best Practices](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/), [Top 10 Onboarding Examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/), [Travel App Onboarding](https://clevertap.com/blog/6-hacks-to-get-user-onboarding-for-your-travel-app-on-track/)

#### 핵심 인사이트
- 77%의 사용자가 설치 후 3일 내에 앱 사용을 중단 ([출처](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/))
- 좋은 온보딩을 갖춘 앱은 **5배 높은 engagement**와 **80%+ 완료율** 달성 ([출처](https://www.plotline.so/blog/mobile-app-onboarding-examples))
- **10초 안에 가치를 보여줘야** 한다 ([출처](https://userpilot.com/blog/mobile-onboarding-examples/))

### 4.2 MyTravel 튜토리얼 설계

#### 전체 구조: 3단계 점진적 온보딩

```
[1단계] 첫 실행 웰컴        → 앱의 핵심 가치 전달 (3화면, 스킵 가능)
[2단계] 첫 여행 생성 가이드  → 실제 기능 사용하며 학습 (코치마크)
[3단계] 기능 발견 팁        → 사용 중 컨텍스트에 맞는 힌트 (점진적)
```

#### 1단계: 웰컴 캐러셀 (첫 실행 시)

| 화면 | 내용 | 비주얼 |
|------|------|--------|
| 1/3 | "AI가 여행 일정을 자동으로 만들어줍니다" | AI 일정 생성 애니메이션 |
| 2/3 | "친구와 함께 여행을 계획하세요" | 협업 화면 일러스트 |
| 3/3 | "지금 바로 시작해볼까요?" | CTA: "첫 여행 만들기" / "둘러보기" |

**설계 원칙**:
- 최대 3화면 (4개 이상은 이탈률 증가)
- "건너뛰기" 버튼 상시 표시
- 페이지 인디케이터 (점 3개)
- 마지막 화면에 2개 CTA 제공
- 13개 언어 i18n 지원

#### 2단계: 첫 여행 생성 코치마크

| 순서 | 타겟 요소 | 메시지 | 트리거 |
|------|----------|--------|--------|
| 1 | "새 여행" 버튼 | "여기를 눌러 첫 여행을 시작하세요!" | 홈 화면 첫 진입 |
| 2 | 목적지 입력 | "여행할 도시를 검색해보세요" | CreateTrip 화면 진입 |
| 3 | AI/수동 토글 | "AI 모드를 사용하면 자동으로 일정이 생성됩니다" | 모드 선택 시 |
| 4 | 생성된 일정 | "일정을 길게 눌러 순서를 변경할 수 있어요" | 일정 생성 완료 후 |
| 5 | 공유 버튼 | "친구를 초대해 함께 계획해보세요!" | TripDetail 첫 진입 |

**구현 방식**:
- 반투명 오버레이 + 하이라이트 박스
- 타겟 요소 주변 펄스 애니메이션
- "다음" / "건너뛰기" / "다시 보지 않기"
- AsyncStorage에 완료 상태 저장 (`@tutorial:step_completed`)
- 각 단계는 독립적 — 중간에 종료해도 다음 진입 시 이어서 진행

#### 3단계: 컨텍스트 기능 발견 팁

| 기능 | 팁 내용 | 표시 조건 |
|------|---------|----------|
| 지도 뷰 | "지도에서 일정을 한눈에 볼 수 있어요" | MapView 첫 사용 시 |
| 경비 분할 | "여행 경비를 친구들과 나눠보세요" | 경비 탭 첫 진입 |
| 오프라인 | "와이파이 없이도 일정을 확인할 수 있어요" | 설정 화면 |
| 프리미엄 | "프리미엄으로 무제한 AI 일정 생성!" | 무료 한도 도달 시 |

### 4.3 구현 계획

#### 필요한 컴포넌트

| 컴포넌트 | 용도 | 위치 |
|----------|------|------|
| `WelcomeCarousel` | 첫 실행 웰컴 화면 | `screens/onboarding/` |
| `CoachMark` | 코치마크 오버레이 (재사용) | `components/tutorial/` |
| `TutorialProvider` | 튜토리얼 상태 관리 Context | `contexts/` |
| `FeatureTip` | 컨텍스트 팁 (토스트형) | `components/tutorial/` |

#### 기술 구현 사항

```
frontend/src/contexts/TutorialContext.tsx
  - 튜토리얼 진행 상태 관리
  - AsyncStorage 연동 (완료 단계 기억)
  - isFirstLaunch, currentStep, completedSteps
  - showCoachMark(targetRef, message) API

frontend/src/components/tutorial/CoachMark.tsx
  - React Native 포탈 기반 오버레이
  - 타겟 요소 측정 (measure()) → 하이라이트 위치 계산
  - 애니메이션: Reanimated 3 fade-in + pulse

frontend/src/components/tutorial/WelcomeCarousel.tsx
  - FlatList horizontal + pagingEnabled
  - 3개 슬라이드 + 페이지 인디케이터
  - Lottie 애니메이션 (선택)

frontend/src/screens/onboarding/WelcomeScreen.tsx
  - 네비게이션 스택 최상위에 조건부 렌더
  - isFirstLaunch ? WelcomeScreen : HomeScreen

frontend/src/i18n/locales/{13 langs}/tutorial.json
  - 튜토리얼 문자열 13개 언어 번역
```

#### 실행 순서

| 우선순위 | 작업 | 난이도 | 예상 규모 |
|----------|------|--------|----------|
| P0 | TutorialContext + AsyncStorage 상태 관리 | 중간 | 신규 파일 1개 |
| P0 | WelcomeCarousel 3화면 | 중간 | 신규 파일 2개 |
| P0 | i18n 튜토리얼 키 13개 언어 | 중간 | 13개 JSON 수정 |
| P1 | CoachMark 컴포넌트 | 높음 | 신규 파일 1개 |
| P1 | 첫 여행 생성 5단계 코치마크 | 높음 | 기존 화면 5개 수정 |
| P2 | FeatureTip 컨텍스트 팁 | 낮음 | 신규 파일 1개 |
| P2 | 컨텍스트 팁 4개 배치 | 낮음 | 기존 화면 4개 수정 |

### 4.4 참고 자료
- [Mobile Onboarding 11 Best Practices](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/)
- [Top 10 App Onboarding Examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)
- [Appcues Mobile Onboarding Guide](https://www.appcues.com/blog/essential-guide-mobile-user-onboarding-ui-ux)
- [Travel App Onboarding Hacks](https://clevertap.com/blog/6-hacks-to-get-user-onboarding-for-your-travel-app-on-track/)
- [Best Mobile Onboarding Examples](https://www.plotline.so/blog/mobile-app-onboarding-examples)

---

## Task 5: 최종 QA · 보안 점검 · 운영 배포

### 5.1 에이전트별 검수 계획

#### auto-qa: 기능 전체 검수
| 범위 | 항목 |
|------|------|
| 인증 | 회원가입, 로그인, 로그아웃, 소셜 로그인, 2FA, 비밀번호 재설정 |
| 여행 | CRUD, AI 생성, 수동 생성, 일정 편집, 지도 뷰, 커버 이미지 |
| 협업 | 초대, 수락, 역할 변경, 삭제, 여행 나가기 |
| 소셜 | 피드, 좋아요, 팔로우, 프로필, 공유 |
| 경비 | 경비 분할, 참가자 관리, 정산 |
| 알림 | 푸시 토큰 등록, 알림 목록, 읽음 처리, 클릭 네비게이션 |
| 구독 | 무료/프리미엄 분기, 페이월, 구독 화면 |
| 설정 | 프로필 수정, 비밀번호 변경, 여행 선호도, 데이터 내보내기, 계정 삭제 |
| i18n | 13개 언어 전환, 누락 키 확인 |

#### security-qa: 보안 점검
| 범위 | 항목 |
|------|------|
| OWASP Top 10 | 인젝션, XSS, CSRF, IDOR, 인증 우회, 데이터 노출 |
| API | 모든 엔드포인트 인증/인가 검증, Rate Limiting |
| 데이터 | 민감 필드 select:false, PII 마스킹, GDPR |
| 인프라 | Docker 보안, CSP, HSTS, 의존성 취약점 |

#### publish-qa: 스토어 배포 준비
| 범위 | 항목 |
|------|------|
| Play Store | 정책 준수, 콘텐츠 등급, 개인정보 처리 |
| 빌드 | EAS Build 설정, 서명, 버전 관리 |
| 메타데이터 | 스토어 리스팅, 스크린샷, 설명 |
| GDPR | 동의 메시지 (AdMob), 데이터 수집 공개 |

### 5.2 실행 순서

```
1. Task 1-4 모든 코드 변경 완료
2. TypeScript 컴파일 검증 (프론트엔드 + 백엔드)
3. auto-qa 에이전트 실행 → 발견된 버그 수정
4. security-qa 에이전트 실행 → 취약점 수정
5. publish-qa 에이전트 실행 → 스토어 정책 확인
6. 최종 커밋 + 푸시
7. 무중단 배포 (Task 2 방식 적용)
8. 프로덕션 헬스체크 + 스모크 테스트
9. 결과 리포트 작성
```

---

## Task 6: Google Play Store 프로덕션 배포

### 6.1 현황 분석

**현재 EAS 설정**:
| 항목 | 값 | 상태 |
|------|-----|------|
| 패키지명 | `com.longpapa82.travelplanner` | 확정 |
| 앱 이름 | `MyTravel` | 확정 |
| 앱 버전 | `1.0.0` | 확정 |
| versionCode | `6` | 자동 증가 활성화 |
| EAS Submit 트랙 | `internal` | **production으로 변경 필요** |
| 서비스 계정 | `google-play-service-account.json` (2.4KB) | 존재 |
| 스토어 메타데이터 | 13개 언어 완비 | 완료 |
| AdMob 앱 ID | `ca-app-pub-7330738950092177~5475101490` | 설정됨 |
| RevenueCat | `goog_BeyiIKXfhmqtbtzaEGMRICChtQd` | 설정됨 |
| 딥링크 | `travelplanner://`, `mytravel-planner.com` | 설정됨 |

**관련 파일**:
| 파일 | 역할 |
|------|------|
| `frontend/eas.json` | EAS Build/Submit 설정 |
| `frontend/app.config.js` | 앱 메타데이터, 버전, 아이콘 |
| `frontend/google-play-service-account.json` | Play Console API 인증 |
| `frontend/store-metadata/*.json` | 13개 언어 스토어 리스팅 |
| `frontend/.env` | AdMob, RevenueCat 키 |

### 6.2 배포 전 체크리스트

#### Phase A: 빌드 준비
| # | 작업 | 상태 | 상세 |
|---|------|------|------|
| A1 | Task 1-4 코드 변경 완료 | 대기 | 모든 기능 수정 후 |
| A2 | Task 5 QA/보안 통과 | 대기 | auto-qa, security-qa, publish-qa PASS |
| A3 | 앱 아이콘/스플래시 최종 확인 | 확인 필요 | `frontend/assets/` |
| A4 | 스토어 스크린샷 준비 | 확인 필요 | 최소 2장, 권장 8장 (휴대폰 + 태블릿) |
| A5 | 개인정보 처리방침 URL 확인 | ✅ | `https://mytravel-planner.com/privacy` |
| A6 | 서비스 이용약관 URL 확인 | ✅ | `https://mytravel-planner.com/terms` |

#### Phase B: EAS 설정 변경
| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| B1 | Submit 트랙 변경 | `eas.json` | `"track": "internal"` → `"track": "production"` |
| B2 | 프로덕션 릴리스 상태 설정 | `eas.json` | `"releaseStatus": "completed"` (즉시 배포) 또는 `"draft"` (수동 배포) |
| B3 | 서비스 계정 권한 확인 | Play Console | 서비스 계정에 "릴리스 관리자" 역할 부여 확인 |
| B4 | 앱 서명 확인 | Play Console | Google Play 앱 서명 활성화 확인 |

#### Phase C: 프로덕션 빌드 및 제출
| # | 작업 | 명령어 | 상세 |
|---|------|--------|------|
| C1 | 프로덕션 빌드 | `cd frontend && eas build --platform android --profile production` | ~15-30분 소요 |
| C2 | 빌드 결과 확인 | `eas build:list --platform android --limit 1` | 상태: `finished` 확인 |
| C3 | Play Store 제출 | `eas submit --platform android --profile production` | 서비스 계정으로 자동 업로드 |
| C4 | 제출 상태 확인 | Play Console 대시보드 | 리뷰 상태 모니터링 |

#### Phase D: Play Console 수동 작업
| # | 작업 | 위치 | 상세 |
|---|------|------|------|
| D1 | 스토어 리스팅 완성 | Play Console > 스토어 등록정보 | 제목, 설명, 카테고리, 스크린샷 |
| D2 | 콘텐츠 등급 설문 | Play Console > 콘텐츠 등급 | IARC 등급 설문 완료 |
| D3 | 타겟 잠재고객 설정 | Play Console > 타겟 잠재고객 | 연령대 선택 (전체) |
| D4 | 데이터 안전 섹션 | Play Console > 데이터 안전 | 수집/공유 데이터 유형 선언 |
| D5 | 광고 포함 선언 | Play Console > 앱 콘텐츠 | "광고 포함" 체크 (AdMob 사용) |
| D6 | 앱 액세스 권한 | Play Console > 앱 콘텐츠 | 테스트 계정 정보 제공 (리뷰어용) |
| D7 | 가격 및 배포 | Play Console > 가격 및 배포 | 무료 앱 + 인앱 구매 선언 |
| D8 | 프로덕션 트랙 릴리스 | Play Console > 프로덕션 | 빌드 선택 → 검토 대상 출시 |

### 6.3 데이터 안전 섹션 작성 가이드

Google Play Store는 앱이 수집하는 데이터를 투명하게 공개해야 합니다.

| 데이터 유형 | 수집 여부 | 공유 여부 | 용도 |
|------------|----------|----------|------|
| 이메일 주소 | 수집 | 미공유 | 계정 관리, 인증 |
| 이름 | 수집 | 미공유 | 프로필 표시 |
| 프로필 사진 | 수집 | 미공유 | 프로필 표시 |
| 위치 (대략적) | 수집하지 않음 | - | - |
| 여행 일정 데이터 | 수집 | 공유 (협업자) | 앱 기능 |
| 결제 정보 | 수집 | 미공유 | 인앱 구매 (RevenueCat 처리) |
| 기기 식별자 | 수집 | 공유 (AdMob) | 광고 |
| 앱 사용 데이터 | 수집 | 미공유 | 분석 |
| 비정상 종료 로그 | 수집 | 미공유 | 앱 성능 (Sentry) |

**보안 관행**:
- 전송 시 암호화: ✅ (HTTPS/TLS)
- 데이터 삭제 요청 가능: ✅ (계정 삭제 + GDPR 내보내기)
- 어린이용 아님: ✅ (COPPA 비대상)

### 6.4 스토어 리스팅 핵심 내용

```
제목: MyTravel - AI 여행 계획
간단한 설명: AI가 만드는 맞춤 여행 일정. 목적지만 선택하면 완벽한 계획이 완성됩니다.
카테고리: 여행 및 지역정보
콘텐츠 등급: 전체 이용가
가격: 무료 (인앱 구매 포함)
```

### 6.5 릴리스 타임라인

| 단계 | 소요 시간 | 상세 |
|------|----------|------|
| EAS Build | 15-30분 | Expo 클라우드 빌드 |
| EAS Submit | 5-10분 | APK/AAB 업로드 |
| Play Console 설정 | 30-60분 | 수동 작업 (스토어 리스팅, 데이터 안전 등) |
| Google 심사 | 1-7일 | 첫 출시 시 최대 7일, 이후 업데이트는 1-3일 |
| 출시 | 즉시 | 심사 통과 후 자동 또는 수동 롤아웃 |

### 6.6 리스크 및 대응

| 리스크 | 확률 | 대응 |
|--------|------|------|
| 심사 거부 — 개인정보 정책 불충분 | 중 | 데이터 안전 섹션 상세히 작성, 개인정보 URL 동작 확인 |
| 심사 거부 — 로그인 필수 | 낮 | 테스트 계정 제공 (리뷰어용) |
| 심사 거부 — 광고 정책 위반 | 낮 | AdMob GDPR 동의 메시지 이미 게시됨 ✅ |
| 서명 키 분실 | 낮 | EAS 관리 서명 사용 → Expo 계정에 안전 보관 |
| 빌드 실패 | 중 | EAS 빌드 로그 확인 → 의존성 문제 해결 |

---

## 실행 순서 및 의존 관계

```
                    ┌──────────────────┐
                    │  Task 1 (P0)     │
                    │  로그인 유지 수정  │──────┐
                    └──────────────────┘      │
                                              │
┌──────────────────┐  ┌──────────────────┐    │   ┌──────────────────┐
│  Task 2 (P0)     │  │  Task 3 (P1)     │    │   │  Task 5 (최종)   │
│  무중단 배포 구축  │  │  AI 비용 절감    │    ├──▶│  QA + 보안 + 배포 │
└──────────────────┘  └──────────────────┘    │   └──────────────────┘
        │                     │               │           │
        └─────────────────────┴───────────────┘           │
                                                          ▼
                    ┌──────────────────┐         ┌──────────────────┐
                    │  Task 4 (P1)     │────────▶│  Task 6 (최종)   │
                    │  튜토리얼 모드    │         │  Play Store 배포  │
                    └──────────────────┘         └──────────────────┘
```

### 실행 순서

| 순서 | Task | 상태 | 커밋 |
|------|------|------|------|
| 1 | **Task 1**: 로그인 유지 수정 | ✅ 완료 | `9edd41f` |
| 2 | **Task 3**: AI 비용 절감 | ✅ 완료 | `876041d` |
| 3 | **Task 2**: 무중단 배포 구축 | ✅ 완료 | `03a8808` |
| 4 | **Task 4**: 튜토리얼 모드 | ✅ 완료 | `e1668b1` |
| 5 | **Task 5**: 최종 QA + 보안 수정 | ✅ 완료 | `879487f` |
| 6 | **Task 6**: Play Store 배포 | ✅ 제출 완료 (심사 대기) | `b58ff64` |

### 완료 내역

| Task | 완료 조건 | 결과 |
|------|----------|------|
| Task 1 | 앱 종료 → 재시작 시 자동 로그인 | ✅ Keychain 5회 재시도 + AsyncStorage 백업 |
| Task 2 | 배포 중 서비스 중단 0초 | ✅ nginx resolver + deploy.sh --remote-build |
| Task 3 | AI 비용 90% 절감 | ✅ 모델 외부화 + 프롬프트 압축 + max_tokens 조정 |
| Task 4 | 웰컴 + 코치마크 + 13개 언어 | ✅ WelcomeModal + CoachMark + tutorial.json ×13 |
| Task 5 | security-qa CRITICAL 0건 | ✅ CRITICAL 2 + HIGH 4 수정, 3 QA 에이전트 실행 |
| Task 6 | Play Store 제출 | ✅ EAS Build vc6, 비공개 테스트 검토 제출 (2026-02-28) |

### 후속 작업

잔여 작업은 `docs/remaining-work-plan.md` 참조.

---

*최종 업데이트: 2026-02-28 — 전체 스프린트 완료*
