# 다음 세션 준비 체크리스트 - Teammate 병렬 작업

**작성일**: 2026-02-08
**목표**: 다음 세션에서 teammate를 즉시 실행할 수 있도록 모든 준비 완료

---

## ✅ 필수 준비 사항

### 1. Claude Code 환경 설정

#### 1.1 teammate 기능 활성화
```bash
# 설정 파일 경로 확인
# macOS: ~/.config/claude/config.json
# Linux: ~/.config/claude/config.json
# Windows: %APPDATA%\claude\config.json

# 파일 열기
code ~/.config/claude/config.json

# 다음 내용 추가 또는 수정
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**확인 방법**:
- [ ] config.json 파일이 존재하는가?
- [ ] `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 환경 변수가 추가되었는가?
- [ ] JSON 형식이 올바른가? (쉼표, 중괄호 등)

---

#### 1.2 분할 창 모드 설정 (권장)

**macOS 사용자**:
```bash
# iTerm2 확인 (이미 사용 중이면 스킵)
which iTerm
# 출력: /Applications/iTerm.app/Contents/MacOS/iTerm2

# 또는 tmux 설치
brew install tmux

# tmux 버전 확인
tmux -V
# 출력: tmux 3.x
```

**확인 방법**:
- [ ] iTerm2가 설치되어 있는가?
- [ ] 또는 tmux가 설치되어 있는가?
- [ ] 분할 창 모드를 사용할 수 있는가?

---

### 2. OAuth Client ID/Secret 발급

#### 2.1 Google OAuth

**등록 페이지**: https://console.cloud.google.com/

**필요한 정보**:
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

**등록 단계** (상세 가이드: `oauth-client-registration-guide.md`):
1. [ ] Google Cloud Console 프로젝트 생성
2. [ ] OAuth 동의 화면 구성
3. [ ] OAuth 클라이언트 ID 생성
4. [ ] 클라이언트 ID/Secret 복사
5. [ ] Redirect URI 등록 (http://localhost:3000/api/auth/google/callback)
6. [ ] backend/.env 파일에 추가

**상태**:
- [ ] 완료
- [ ] 진행 중
- [ ] 미진행

---

#### 2.2 Apple Sign-In (선택사항 - iOS 테스트 시 필요)

**등록 페이지**: https://developer.apple.com/account/

**필요한 정보**:
```env
APPLE_CLIENT_ID=com.yourcompany.travelplanner.signin
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456UVW
APPLE_PRIVATE_KEY_PATH=./secrets/AuthKey_DEF456UVW.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback
```

**등록 단계**:
1. [ ] Apple Developer Program 가입 ($99/year)
2. [ ] Services ID 생성
3. [ ] Sign In with Apple 구성
4. [ ] Key 생성 및 .p8 파일 다운로드
5. [ ] Team ID 확인
6. [ ] backend/secrets/ 디렉토리에 .p8 파일 저장
7. [ ] backend/.env 파일에 추가

**상태**:
- [ ] 완료
- [ ] 진행 중
- [ ] 미진행 (나중에 진행)

---

#### 2.3 Kakao OAuth

**등록 페이지**: https://developers.kakao.com/

**필요한 정보**:
```env
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback
```

**등록 단계**:
1. [ ] Kakao Developers 애플리케이션 생성
2. [ ] REST API 키 복사
3. [ ] Web 플랫폼 등록 (http://localhost:3000)
4. [ ] Kakao Login 활성화
5. [ ] Redirect URI 등록 (http://localhost:3000/api/auth/kakao/callback)
6. [ ] 동의 항목 설정 (프로필 정보, 이메일)
7. [ ] backend/.env 파일에 추가

**상태**:
- [ ] 완료
- [ ] 진행 중
- [ ] 미진행

---

### 3. 데이터베이스 설정

#### 3.1 PostgreSQL 설치 및 실행

**macOS (Homebrew)**:
```bash
# 설치
brew install postgresql@14

# 서비스 시작
brew services start postgresql@14

# 데이터베이스 생성
createdb travelplanner

# 연결 테스트
psql travelplanner
# 성공 시: travelplanner=#
# 종료: \q
```

**Docker (대안)**:
```bash
# PostgreSQL 컨테이너 실행
docker run --name travelplanner-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=travelplanner \
  -p 5432:5432 \
  -d postgres:14

# 실행 확인
docker ps | grep travelplanner-db

# 연결 테스트
docker exec -it travelplanner-db psql -U postgres -d travelplanner
```

**확인 방법**:
- [ ] PostgreSQL이 실행 중인가?
- [ ] `travelplanner` 데이터베이스가 생성되었는가?
- [ ] psql로 연결 가능한가?

---

#### 3.2 Backend 환경 변수 확인

**파일**: `backend/.env`

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=travelplanner

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# OAuth - Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# OAuth - Apple (선택사항)
APPLE_CLIENT_ID=com.yourcompany.travelplanner.signin
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456UVW
APPLE_PRIVATE_KEY_PATH=./secrets/AuthKey_DEF456UVW.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback

# OAuth - Kakao
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback

# Frontend
FRONTEND_URL=exp://localhost:8081
```

**확인 방법**:
- [ ] backend/.env 파일이 존재하는가?
- [ ] 모든 필수 환경 변수가 설정되었는가?
- [ ] OAuth Client ID/Secret이 정확한가?
- [ ] Apple .p8 파일이 backend/secrets/에 있는가?

---

#### 3.3 Backend 실행 테스트

```bash
cd backend

# 의존성 설치 (이미 완료된 경우 스킵)
npm install

# 개발 모드 실행
npm run start:dev

# 로그 확인 (성공 시 출력)
# [Nest] LOG [NestFactory] Starting Nest application...
# [Nest] LOG [InstanceLoader] AppModule dependencies initialized
# [Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
# [Nest] LOG [NestApplication] Nest application successfully started
# [Nest] LOG Application is running on: http://[::1]:3000
```

**확인 방법**:
- [ ] Backend가 오류 없이 실행되는가?
- [ ] http://localhost:3000/api 접속 가능한가?
- [ ] 데이터베이스 연결 성공했는가?
- [ ] TypeORM 엔티티가 로드되었는가?

---

### 4. Frontend 실행 테스트

```bash
cd frontend

# 의존성 설치 (이미 완료된 경우 스킵)
npm install

# Expo 앱 실행
npm start

# 로그 확인
# Starting Metro Bundler
# Expo DevTools is running at http://localhost:19002
# QR 코드 표시
```

**확인 방법**:
- [ ] Frontend가 오류 없이 실행되는가?
- [ ] Expo DevTools가 열리는가?
- [ ] iOS 시뮬레이터 또는 Android 에뮬레이터에서 앱이 실행되는가?
- [ ] 초기 화면이 표시되는가?

---

## 🚀 다음 세션 작업 순서

### 1단계: 환경 확인 (5분)

```bash
# Claude Code 설정 확인
cat ~/.config/claude/config.json | grep AGENT_TEAMS

# tmux 확인
tmux -V

# PostgreSQL 확인
psql travelplanner -c "SELECT 1"

# Backend 환경 변수 확인
cd backend && cat .env | grep -E "(GOOGLE|KAKAO)_CLIENT_ID"
```

**모든 확인이 완료되면 다음 단계로 진행**

---

### 2단계: Team Lead가 팀 생성 (5분)

**Claude Code 세션 시작 후 다음 프롬프트 입력**:

```
I need to create an agent team to work on the authentication system in parallel.
Please create 4 teammates with split-pane mode:

1. "Backend-Auth": Implement JWT and Local authentication strategies, guards, and core auth endpoints
   - Files: backend/src/auth/ (strategies/jwt.strategy.ts, strategies/local.strategy.ts, guards/, auth.controller.ts, auth.service.ts, auth.module.ts)
   - Context: Use NestJS, TypeORM, Passport, JWT. Follow existing patterns in backend/src/users/. Reference backend/src/config/oauth.config.ts for configuration.
   - Dependencies: Wait for common types to be created first.

2. "Backend-OAuth": Implement Google, Apple, Kakao OAuth strategies and callbacks
   - Files: backend/src/auth/strategies/ (google-oauth.strategy.ts, apple-oauth.strategy.ts, kakao-oauth.strategy.ts)
   - Context: Use Passport OAuth strategies. Reference backend/src/config/oauth.config.ts for credentials. Add OAuth endpoints to auth.controller.ts AFTER Backend-Auth completes it.
   - Dependencies: Backend-Auth must complete auth.controller.ts first.

3. "Frontend-UI": Create onboarding, login, signup screens with navigation
   - Files: frontend/src/screens/auth/ (OnboardingScreen.tsx, LoginScreen.tsx, SignupScreen.tsx), frontend/src/navigation/AuthNavigator.tsx, frontend/src/components/auth/
   - Context: Use React Native, Expo, React Navigation, React Native Paper. Follow design system in frontend/src/constants/theme.ts.
   - Dependencies: None, can start immediately after common setup.

4. "Frontend-OAuth": Integrate Google, Apple, Kakao SDKs and create OAuth service
   - Files: frontend/src/services/oauth.service.ts, frontend/src/hooks/useOAuth.ts, frontend/src/components/auth/ (*SignInButton.tsx)
   - Context: Use @react-native-google-signin/google-signin, @invertase/react-native-apple-authentication, @react-native-seoul/kakao-login
   - Dependencies: Frontend-UI must complete LoginScreen.tsx first to integrate OAuth buttons.

All teammates should:
- Read existing code patterns before starting (backend/src/users/, frontend/src/)
- Use TodoWrite to track progress
- Report blockers immediately
- Coordinate with team lead before editing shared files (auth.controller.ts, auth.module.ts, App.tsx)
- Follow TypeScript strict mode
- Write production-ready code (no TODOs, no placeholders)
```

---

### 3단계: Phase A - 공통 준비 작업 (30분, Team Lead)

**Team Lead가 직접 작업**:

```
Before starting parallel work, I need to create common types and utilities:

1. Create backend/src/common/types/auth.types.ts:
   - AuthProvider enum (LOCAL, GOOGLE, APPLE, KAKAO)
   - JwtPayload interface
   - OAuthProfile interface

2. Create backend/src/common/utils/password.util.ts:
   - hashPassword function (using bcrypt)
   - comparePassword function

3. Validate backend/.env file:
   - All OAuth credentials are present
   - Database connection works

4. Update frontend/src/types/index.ts:
   - Add OAuth provider types
   - Add AuthProvider enum matching backend

Once completed, notify all teammates to start Phase B.
```

---

### 4단계: Phase B - 병렬 작업 시작 (4시간, 4명 동시)

**Team Lead가 작업 할당**:

```
@Backend-Auth: Phase A is complete. Start implementing JWT and Local authentication.
@Backend-OAuth: Phase A is complete. Start implementing OAuth strategies. Wait for Backend-Auth to complete auth.controller.ts before adding OAuth endpoints.
@Frontend-UI: Phase A is complete. Start creating auth screens and navigation.
@Frontend-OAuth: Phase A is complete. Start integrating OAuth SDKs. Wait for Frontend-UI to complete LoginScreen.tsx before integrating buttons.

Team Lead will monitor progress using Shift+Up/Down to check each teammate's TodoWrite status.
```

**예상 작업 시간**:
- Backend-Auth: 2-3시간
- Backend-OAuth: 2-3시간
- Frontend-UI: 3-4시간
- Frontend-OAuth: 3-4시간

**병렬 실행으로 총 4시간 예상**

---

### 5단계: Phase C - 통합 및 테스트 (1-2시간, Team Lead + 전체)

**Team Lead가 통합 작업**:

```
All teammates have completed their work. Now I need to:

1. Merge backend changes:
   - Resolve auth.controller.ts conflicts (Backend-Auth + Backend-OAuth)
   - Verify auth.module.ts imports all strategies and guards
   - Test all endpoints: /auth/login, /auth/register, /auth/google, /auth/apple, /auth/kakao

2. Merge frontend changes:
   - Integrate OAuth buttons into LoginScreen.tsx
   - Update App.tsx with AuthNavigator
   - Test navigation flow

3. Write E2E tests:
   - backend/test/e2e/auth.e2e-spec.ts
   - Test email/password login
   - Test OAuth redirects

4. Run integration tests:
   - npm run test:e2e (backend)
   - Manual testing (frontend)

5. Update documentation:
   - claudedocs/auth-implementation-complete.md
```

---

### 6단계: Git Commit (10분)

```bash
# 변경 사항 확인
git status
git diff

# 모든 인증 파일 추가
git add backend/src/auth/
git add frontend/src/screens/auth/
git add frontend/src/services/oauth.service.ts
git add frontend/src/navigation/AuthNavigator.tsx

# 의미 있는 커밋 메시지
git commit -m "$(cat <<'EOF'
Implement complete authentication system with OAuth

Backend:
- JWT and Local authentication strategies
- Google, Apple, Kakao OAuth strategies
- Auth guards and decorators
- Auth endpoints (/auth/login, /auth/register, /auth/google, /auth/apple, /auth/kakao)

Frontend:
- Onboarding, Login, Signup screens
- OAuth SDK integration (Google, Apple, Kakao)
- Auth navigation
- SNS login buttons

Tests:
- E2E tests for all auth endpoints
- Manual testing completed

🤖 Generated with [Claude Code](https://claude.com/claude-code) using Agent Teams

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# 푸시 (선택사항)
git push origin main
```

---

## ⚠️ 예상되는 문제 및 해결책

### 문제 1: auth.controller.ts 파일 충돌

**증상**: Backend-Auth와 Backend-OAuth가 동시에 편집

**해결**:
- Backend-Auth가 먼저 완료하도록 지시
- Backend-OAuth는 완료 후 OAuth 엔드포인트만 추가

**Team Lead 메시지**:
```
@Backend-OAuth: Wait for Backend-Auth to complete auth.controller.ts first.
@Backend-Auth: Please notify when auth.controller.ts is ready.
```

---

### 문제 2: OAuth Client ID/Secret 미발급

**증상**: Backend 실행 시 환경 변수 오류

**해결**:
- Google OAuth만 먼저 발급받아 테스트
- Apple, Kakao는 나중에 추가 가능

**임시 .env 설정**:
```env
# Google만 설정
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# Apple, Kakao는 주석 처리 (나중에 활성화)
# APPLE_CLIENT_ID=
# KAKAO_CLIENT_ID=
```

---

### 문제 3: 팀원이 응답하지 않음

**증상**: 특정 팀원이 오랫동안 작업 중

**해결**:
- Shift+Up/Down으로 해당 팀원 선택
- 직접 상호작용하여 진행 상황 확인
- 필요 시 작업 재할당

**Team Lead 액션**:
```
# 팀원 선택 후
What is your current status? Are there any blockers?
```

---

### 문제 4: 세션이 너무 길어짐

**증상**: 4시간 이상 소요 예상

**해결**:
- Phase B를 여러 세션으로 분할
- 각 세션마다 git commit으로 체크포인트 생성

**분할 전략**:
```
세션 1: Phase A + Backend 작업 (Backend-Auth, Backend-OAuth)
세션 2: Frontend 작업 (Frontend-UI, Frontend-OAuth)
세션 3: Phase C (통합 및 테스트)
```

---

## 📊 성공 기준

### 완료 조건

#### Backend
- [ ] JWT Strategy 구현 완료
- [ ] Local Strategy 구현 완료
- [ ] Google OAuth Strategy 구현 완료
- [ ] Apple OAuth Strategy 구현 완료 (선택)
- [ ] Kakao OAuth Strategy 구현 완료
- [ ] Auth Guards 구현 완료
- [ ] AuthController 모든 엔드포인트 구현
- [ ] AuthService 핵심 로직 구현
- [ ] E2E 테스트 통과

#### Frontend
- [ ] OnboardingScreen 구현 완료
- [ ] LoginScreen 구현 완료
- [ ] SignupScreen 구현 완료
- [ ] AuthNavigator 구현 완료
- [ ] Google Sign-In 버튼 동작
- [ ] Apple Sign-In 버튼 동작 (iOS)
- [ ] Kakao Login 버튼 동작
- [ ] OAuth Service 구현 완료
- [ ] useOAuth 훅 구현 완료

#### 통합
- [ ] Backend + Frontend 연동 성공
- [ ] 이메일/비밀번호 로그인 동작
- [ ] Google OAuth 로그인 동작
- [ ] Kakao OAuth 로그인 동작
- [ ] 토큰 저장 및 자동 로그인 동작
- [ ] Git commit 완료
- [ ] 문서 업데이트 완료

---

## 💰 예상 비용

### 토큰 사용량
- Phase A: ~20K 토큰
- Phase B: ~320K 토큰 (80K × 4명)
- Phase C: ~50K 토큰
- **Total**: ~390K 토큰

### 개발 시간
- 순차 작업: ~16시간
- 병렬 작업: ~6시간
- **절감**: 10시간 (62.5% 단축)

---

## 🎓 Insights

```
★ Insight ─────────────────────────────────────
1. **준비 작업의 중요성**: Phase A에서 공통 타입과 유틸리티를 먼저
   생성하는 것이 중요합니다. 이것이 없으면 각 팀원이 서로 다른 타입을
   정의하여 통합 시 충돌이 발생합니다.

2. **의존성 관리**: auth.controller.ts와 같은 공유 파일은 순차적
   의존성을 명확히 해야 합니다. Backend-Auth가 먼저 생성하고,
   Backend-OAuth가 나중에 추가하는 방식으로 충돌을 방지합니다.

3. **체크포인트 전략**: teammate는 세션 재개가 불가능하므로, Phase A
   완료 후 git commit을 하면 안전합니다. 만약 Phase B에서 문제가
   발생하면 Phase A부터 다시 시작하지 않아도 됩니다.
─────────────────────────────────────────────────
```

---

## 📝 다음 세션 시작 시 확인 사항

**세션 시작 즉시 확인**:

```bash
# 1. PostgreSQL 실행 중?
psql travelplanner -c "SELECT 1"

# 2. Backend .env 파일 확인
cat backend/.env | grep -E "CLIENT_ID|CLIENT_SECRET"

# 3. Claude Code 설정 확인
cat ~/.config/claude/config.json | grep AGENT_TEAMS

# 4. tmux 또는 iTerm2 준비
tmux -V

# 모든 확인 완료 후 teammate 팀 생성 프롬프트 입력
```

---

**준비 완료 시 다음 명령어로 시작**:

```
"Create 4 teammates for parallel auth system development with split-pane mode..."
```

---

**작성자**: Claude (Team Lead)
**문서 버전**: 1.0
**예상 세션 시간**: 6-8시간
**다음 업데이트**: teammate 작업 완료 후
