# 🔧 TravelPlanner 문제 해결 가이드

## 개발 서버가 안 열릴 때

### 1단계: 기본 환경 확인

#### PostgreSQL 실행 확인
```bash
# PostgreSQL 상태 확인
brew services list | grep postgresql

# PostgreSQL 시작
brew services start postgresql@14

# 또는 수동 실행
postgres -D /usr/local/var/postgres

# 데이터베이스 연결 테스트
psql -U hoonjaepark -d travelplanner -c '\dt'
```

**예상 결과:**
```
             List of relations
 Schema |    Name     | Type  |    Owner
--------+-------------+-------+-------------
 public | itineraries | table | hoonjaepark
 public | trips       | table | hoonjaepark
 public | users       | table | hoonjaepark
```

---

#### Node.js 버전 확인
```bash
node --version
# v18.0.0 이상이어야 함

npm --version
# v9.0.0 이상이어야 함
```

---

### 2단계: Backend 서버 문제 해결

#### 의존성 재설치
```bash
cd /Users/hoonjaepark/projects/travelPlanner/backend

# node_modules 삭제
rm -rf node_modules package-lock.json

# 재설치
npm install
```

---

#### 포트 충돌 확인
```bash
# 포트 3000이 사용 중인지 확인
lsof -i :3000

# 사용 중이면 프로세스 종료
kill -9 <PID>
```

---

#### TypeScript 컴파일 확인
```bash
cd /Users/hoonjaepark/projects/travelPlanner/backend

# 빌드 테스트
npm run build

# 에러가 있으면 표시됨
```

**일반적인 컴파일 에러:**
```bash
# 에러: Cannot find module
→ npm install 재실행

# 에러: Type error in ...
→ 해당 파일 확인 및 수정
```

---

#### 직접 실행으로 에러 확인
```bash
cd /Users/hoonjaepark/projects/travelPlanner/backend

# 개발 모드 실행
npm run start:dev
```

**정상 실행 시 표시:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] INFO [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] INFO [RoutesResolver] AuthController {/api/auth}
[Nest] INFO [RoutesResolver] TripsController {/api/trips}
[Nest] INFO [NestApplication] Nest application successfully started
🚀 Application is running on: http://localhost:3000/api
```

---

### 3단계: Frontend 서버 문제 해결

#### 의존성 재설치
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# node_modules 삭제
rm -rf node_modules package-lock.json

# 재설치
npm install
```

---

#### 캐시 삭제
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# Expo 캐시 삭제
npm start -- --clear

# 또는
npx expo start --clear
```

---

#### 포트 충돌 확인
```bash
# 포트 19000, 19001, 19006 확인
lsof -i :19000
lsof -i :19001
lsof -i :19006

# 사용 중이면 종료
kill -9 <PID>
```

---

### 4단계: 일반적인 에러 해결

#### 에러: "Cannot connect to database"
```bash
# PostgreSQL 재시작
brew services restart postgresql@14

# 데이터베이스 확인
psql -U hoonjaepark -l | grep travelplanner

# 없으면 생성
createdb travelplanner
```

---

#### 에러: "Module not found"
```bash
# Backend
cd backend
rm -rf node_modules
npm install

# Frontend
cd frontend
rm -rf node_modules
npm install
```

---

#### 에러: "Port 3000 is already in use"
```bash
# 3000 포트 사용 프로세스 찾기
lsof -i :3000

# 종료
kill -9 <PID>

# 또는 .env 파일에서 포트 변경
PORT=3001
```

---

#### 에러: "OpenAI API error"
```bash
# .env 파일 확인
cd backend
cat .env | grep OPENAI_API_KEY

# API 키가 비어있으면 설정
OPENAI_API_KEY=sk-...your-key
```

---

### 5단계: 완전 초기화 (최후의 수단)

```bash
cd /Users/hoonjaepark/projects/travelPlanner

# 모든 node_modules 삭제
rm -rf backend/node_modules frontend/node_modules

# PostgreSQL 데이터베이스 재생성
psql -U hoonjaepark -c "DROP DATABASE IF EXISTS travelplanner;"
psql -U hoonjaepark -c "CREATE DATABASE travelplanner;"

# Backend 재설치
cd backend
npm install
npm run build

# Frontend 재설치
cd ../frontend
npm install

# 서버 실행
cd ../backend
npm run start:dev

# 새 터미널에서 Frontend 실행
cd ../frontend
npm start
```

---

## 디버깅 체크리스트

### Backend 서버
- [ ] PostgreSQL 실행 중
- [ ] 데이터베이스 `travelplanner` 존재
- [ ] node_modules 설치됨
- [ ] .env 파일 존재
- [ ] 포트 3000 사용 가능
- [ ] TypeScript 컴파일 성공

### Frontend 서버
- [ ] node_modules 설치됨
- [ ] Backend 서버 실행 중
- [ ] 포트 19000-19006 사용 가능
- [ ] Expo CLI 설치됨

---

## 로그 확인 방법

### Backend 로그
```bash
# 서버 실행 시 콘솔 출력 확인
cd backend
npm run start:dev

# 에러 로그
tail -f logs/error.log  # (로그 파일이 있는 경우)
```

### Frontend 로그
```bash
# Metro bundler 로그
cd frontend
npm start

# 브라우저 콘솔 (F12)
# 네트워크 탭에서 API 호출 확인
```

---

## 도움이 필요하면

1. **Backend 에러 로그 복사**
2. **Frontend 콘솔 에러 복사**
3. **실행한 명령어 기록**
4. 문제 상황 설명

---

## 빠른 테스트 명령어

```bash
# Backend 테스트
curl http://localhost:3000/api
# 예상: "Cannot GET /api" (정상)

# PostgreSQL 테스트
psql -U hoonjaepark -d travelplanner -c "SELECT COUNT(*) FROM users;"
# 예상: 숫자 (정상)

# Frontend 테스트
curl http://localhost:19006
# 예상: HTML 응답 (정상)
```
