# TravelPlanner Teammate 병렬 작업 계획

**작성일**: 2026-02-08
**목표**: Agent Teams 기능을 활용한 인증 시스템 병렬 개발

---

## 🎯 전체 목표

Phase 1 Week 1-2의 인증 시스템을 5개 팀원이 병렬로 작업하여 개발 속도를 3-4배 향상시킵니다.

**예상 작업 시간**:
- 순차 작업: ~12-16시간
- 병렬 작업: ~4-6시간

---

## ⚙️ 1단계: 환경 설정

### 1.1 Claude Code 설정 파일 수정

`~/.config/claude/config.json` (또는 해당 경로)에 환경 변수 추가:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 1.2 터미널 환경 확인

**분할 창 모드 사용 시** (권장):
- macOS: iTerm2 또는 tmux 설치 필요
- 확인 명령어:
  ```bash
  # iTerm2 확인
  which iTerm

  # tmux 확인 (없으면 설치)
  brew install tmux
  ```

**In-process 모드**:
- 모든 팀원이 메인 터미널에서 실행 (분할 창 없음)
- 세션 재개 불가능 제한 있음

---

## 👥 2단계: 팀원 구성 및 역할 정의

### Team 구성 (총 5명)

| 팀원 | 역할 | 담당 작업 | 작업 파일 범위 |
|------|------|-----------|---------------|
| **Team Lead** | 조율 및 통합 | 전체 조율, 충돌 해결, 최종 통합 | - |
| **Backend-Auth** | Backend 인증 핵심 | JWT Strategy, Local Strategy, Guards | `backend/src/auth/` (strategies, guards) |
| **Backend-OAuth** | Backend OAuth | Google/Apple/Kakao OAuth Strategies | `backend/src/auth/strategies/` (oauth-*.strategy.ts) |
| **Frontend-UI** | Frontend 화면 | 로그인/회원가입 UI, Navigation | `frontend/src/screens/auth/`, `frontend/src/navigation/` |
| **Frontend-OAuth** | Frontend SNS 로그인 | OAuth SDK 통합, 토큰 처리 | `frontend/src/services/oauth.service.ts`, `frontend/src/hooks/` |

---

## 📋 3단계: 작업 분할 및 순서

### Phase A: 준비 단계 (Team Lead)

**작업**:
1. ✅ 공통 타입 정의 (`backend/src/common/types/auth.types.ts`)
2. ✅ 환경 변수 검증 (`backend/src/config/validation.ts`)
3. ✅ 공통 유틸리티 (`backend/src/common/utils/password.util.ts`)

**소요 시간**: ~30분

**파일**:
- `backend/src/common/types/auth.types.ts`
- `backend/src/config/validation.ts`
- `backend/src/common/utils/password.util.ts`

---

### Phase B: 병렬 작업 단계 (4명 동시)

#### **Backend-Auth** (독립 작업)

**작업 목록**:
1. JWT Strategy 구현
2. Local Strategy (이메일/비밀번호) 구현
3. JwtAuthGuard 생성
4. LocalAuthGuard 생성
5. AuthController 기본 엔드포인트 (`/auth/login`, `/auth/register`, `/auth/refresh`)
6. AuthService 핵심 로직

**파일**:
```
backend/src/auth/
├── strategies/
│   ├── jwt.strategy.ts
│   └── local.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── local-auth.guard.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.module.ts
└── dto/
    ├── login.dto.ts
    └── register.dto.ts
```

**소요 시간**: ~2-3시간

**의존성**: Phase A 완료 후 시작

---

#### **Backend-OAuth** (독립 작업)

**작업 목록**:
1. Google OAuth Strategy
2. Apple OAuth Strategy
3. Kakao OAuth Strategy
4. OAuth 콜백 처리 로직
5. AuthController OAuth 엔드포인트 추가 (`/auth/google`, `/auth/apple`, `/auth/kakao`)

**파일**:
```
backend/src/auth/strategies/
├── google-oauth.strategy.ts
├── apple-oauth.strategy.ts
└── kakao-oauth.strategy.ts

backend/src/auth/dto/
└── oauth-user.dto.ts
```

**소요 시간**: ~2-3시간

**의존성**: Phase A 완료 후 시작

**주의**: `auth.controller.ts` 파일 충돌 가능 → Backend-Auth 완료 후 병합 또는 별도 파일로 분리

---

#### **Frontend-UI** (독립 작업)

**작업 목록**:
1. 온보딩 화면 (`OnboardingScreen.tsx`)
2. 로그인 화면 (`LoginScreen.tsx`)
3. 회원가입 화면 (`SignupScreen.tsx`)
4. Auth Navigation Stack
5. 공통 인풋 컴포넌트 (`AuthInput.tsx`)
6. 공통 버튼 컴포넌트 (`AuthButton.tsx`)

**파일**:
```
frontend/src/screens/auth/
├── OnboardingScreen.tsx
├── LoginScreen.tsx
└── SignupScreen.tsx

frontend/src/navigation/
└── AuthNavigator.tsx

frontend/src/components/auth/
├── AuthInput.tsx
└── AuthButton.tsx
```

**소요 시간**: ~3-4시간

**의존성**: Phase A 완료 후 시작

---

#### **Frontend-OAuth** (독립 작업)

**작업 목록**:
1. Google Sign-In SDK 통합
2. Apple Sign-In SDK 통합
3. Kakao Login SDK 통합
4. OAuth Service (`oauth.service.ts`)
5. useOAuth 커스텀 훅
6. SNS 로그인 버튼 컴포넌트

**파일**:
```
frontend/src/services/
└── oauth.service.ts

frontend/src/hooks/
└── useOAuth.ts

frontend/src/components/auth/
├── GoogleSignInButton.tsx
├── AppleSignInButton.tsx
└── KakaoSignInButton.tsx
```

**소요 시간**: ~3-4시간

**의존성**:
- Phase A 완료 후 시작
- OAuth Client ID/Secret 필요 (사전 준비)

**주의**: React Native 네이티브 모듈 설치 필요 → 충돌 가능성 낮음

---

### Phase C: 통합 및 테스트 단계 (Team Lead + 전체)

**작업**:
1. Backend 병합 (auth.controller.ts 충돌 해결)
2. Frontend 병합 (App.tsx, Navigation 통합)
3. E2E 테스트 작성
4. 통합 테스트 실행
5. 문서화 업데이트

**소요 시간**: ~1-2시간

**파일**:
```
backend/test/e2e/auth.e2e-spec.ts
frontend/test-results/auth-flow.test.ts
claudedocs/auth-implementation-complete.md
```

---

## 🚀 4단계: Teammate 실행 명령어

### 4.1 Team Lead가 팀 생성

```
I need to create an agent team to work on authentication system in parallel.
Please create 4 teammates:

1. "Backend-Auth": Implement JWT and Local authentication strategies, guards, and core auth endpoints
   - Files: backend/src/auth/ (strategies/jwt.strategy.ts, strategies/local.strategy.ts, guards/, auth.controller.ts, auth.service.ts)
   - Context: Use NestJS, TypeORM, Passport, JWT. Follow existing patterns in backend/src/users/

2. "Backend-OAuth": Implement Google, Apple, Kakao OAuth strategies and callbacks
   - Files: backend/src/auth/strategies/ (oauth-*.strategy.ts)
   - Context: Use Passport OAuth strategies. Reference backend/src/config/oauth.config.ts for credentials

3. "Frontend-UI": Create onboarding, login, signup screens with navigation
   - Files: frontend/src/screens/auth/, frontend/src/navigation/AuthNavigator.tsx, frontend/src/components/auth/
   - Context: Use React Native, Expo, React Navigation. Follow design in frontend/src/constants/theme.ts

4. "Frontend-OAuth": Integrate Google, Apple, Kakao SDKs and create OAuth service
   - Files: frontend/src/services/oauth.service.ts, frontend/src/hooks/useOAuth.ts, frontend/src/components/auth/*SignInButton.tsx
   - Context: Use @react-native-google-signin, @invertase/react-native-apple-authentication, @react-native-seoul/kakao-login

Use split-pane mode if available (iTerm2/tmux).
```

### 4.2 작업 할당 및 시작

Team Lead가 각 팀원에게 작업 할당:

```
@Backend-Auth: Start implementing JWT and Local authentication
@Backend-OAuth: Start implementing OAuth strategies
@Frontend-UI: Start creating auth screens
@Frontend-OAuth: Start integrating OAuth SDKs

All teammates:
- Check existing code patterns before starting
- Use TodoWrite to track your progress
- Report any blockers immediately
- Coordinate with team lead before editing shared files
```

### 4.3 진행 상황 모니터링

Team Lead는 주기적으로 확인:
- Shift+Up/Down: 팀원 선택 및 직접 상호작용
- 작업 상태 확인: 각 팀원의 TodoWrite 상태 확인
- 충돌 방지: `auth.controller.ts` 등 공유 파일 조율

---

## ⚠️ 5단계: 충돌 방지 및 해결 전략

### 5.1 파일 충돌 가능 영역

| 파일 | 충돌 가능성 | 해결 방법 |
|------|------------|-----------|
| `backend/src/auth/auth.controller.ts` | **높음** | Backend-Auth가 먼저 생성 → Backend-OAuth가 나중에 엔드포인트 추가 |
| `backend/src/auth/auth.module.ts` | **높음** | Backend-Auth가 먼저 생성 → Backend-OAuth가 imports만 추가 |
| `frontend/App.tsx` | **중간** | Frontend-UI가 Navigation 통합 → Frontend-OAuth는 Provider만 추가 |
| `frontend/package.json` | **낮음** | 각자 의존성 추가 → 최종 병합 시 중복 제거 |

### 5.2 충돌 해결 순서

1. **Backend-Auth 먼저 완료** → auth.controller.ts, auth.module.ts 생성
2. **Backend-OAuth 이후 추가** → OAuth 엔드포인트 및 Strategy imports 추가
3. **Frontend-UI 먼저 완료** → Navigation 및 화면 생성
4. **Frontend-OAuth 이후 추가** → OAuth 버튼을 LoginScreen에 통합

### 5.3 팀원 간 메시징 활용

```
# Backend-Auth → Backend-OAuth
"I've completed auth.controller.ts with /login, /register, /refresh endpoints.
You can now add OAuth endpoints (/auth/google, /auth/apple, /auth/kakao) to the same file."

# Frontend-UI → Frontend-OAuth
"LoginScreen.tsx is ready at frontend/src/screens/auth/LoginScreen.tsx.
Please add your SNS login buttons below the email/password form."
```

---

## 📊 6단계: 예상 타임라인

### 순차 작업 시 (기존 방식)
```
Phase A: 준비 (0.5h)
Backend-Auth (3h) → Backend-OAuth (3h) → Frontend-UI (4h) → Frontend-OAuth (4h)
Phase C: 통합 (1.5h)
-------------------------
Total: ~16 hours
```

### 병렬 작업 시 (Teammate 사용)
```
Phase A: 준비 (0.5h, Team Lead)
Phase B: 병렬 작업 (4h, 4명 동시)
  - Backend-Auth (3h)
  - Backend-OAuth (3h)
  - Frontend-UI (4h)
  - Frontend-OAuth (4h)
Phase C: 통합 (1.5h, Team Lead + 전체)
-------------------------
Total: ~6 hours (266% 효율 향상)
```

---

## 💰 7단계: 토큰 비용 고려

### 예상 토큰 사용량

| 작업 | 순차 작업 | 병렬 작업 (5명) | 증가율 |
|------|-----------|----------------|-------|
| Phase A | ~20K | ~20K | - |
| Phase B | ~80K | ~320K (80K × 4) | 4배 |
| Phase C | ~30K | ~50K | 1.6배 |
| **Total** | **~130K** | **~390K** | **3배** |

**비용 대비 효과**:
- 토큰 비용: 3배 증가
- 개발 시간: 2.6배 단축
- **결론**: 시간이 중요한 경우 효과적, 비용 절감이 우선이면 순차 작업 권장

---

## ✅ 8단계: 성공 기준

### 완료 조건
- [ ] Backend: JWT + OAuth 인증 완전 동작
- [ ] Frontend: 로그인/회원가입 UI 완성
- [ ] Frontend: SNS 로그인 버튼 동작
- [ ] E2E 테스트 통과
- [ ] 모든 파일 충돌 해결
- [ ] Git commit 완료

### 검증 명령어
```bash
# Backend 테스트
cd backend
npm run test:e2e

# Frontend 실행
cd frontend
npm start

# 통합 확인
curl http://localhost:3000/api/auth/login
```

---

## 🎓 Insights

```
★ Insight ─────────────────────────────────────
1. **병렬 작업의 핵심**: 파일 충돌이 없도록 명확한 경계를 설정하는 것이
   가장 중요합니다. Backend-Auth와 Backend-OAuth가 auth.controller.ts를
   동시에 편집하면 충돌이 발생하므로, 순차적 의존성을 설정했습니다.

2. **팀원 간 컨텍스트 공유**: 각 팀원은 독립적인 컨텍스트를 가지므로,
   생성 프롬프트에 충분한 정보(파일 경로, 패턴, 의존성)를 제공해야
   일관성 있는 코드를 생성합니다.

3. **비용 vs 시간 트레이드오프**: 토큰 비용은 3배 증가하지만, 개발
   시간은 2.6배 단축됩니다. MVP 개발처럼 속도가 중요한 경우 teammate가
   매우 효과적입니다.
─────────────────────────────────────────────────
```

---

## 📝 다음 단계

1. **환경 설정 확인**:
   ```bash
   # iTerm2 또는 tmux 설치 확인
   brew install tmux

   # Claude Code 설정 파일 수정
   code ~/.config/claude/config.json
   ```

2. **OAuth Client ID/Secret 준비**:
   - Google Cloud Console
   - Apple Developer Portal
   - Kakao Developers

3. **Team Lead가 팀 생성**:
   ```
   "Create 4 teammates for parallel auth system development..."
   ```

4. **작업 시작 및 모니터링**

---

**작성자**: Claude (Team Lead)
**문서 버전**: 1.0
**다음 업데이트**: 작업 완료 후
