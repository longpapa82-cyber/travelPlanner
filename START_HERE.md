# 🚀 서버가 안 열릴 때 - 빠른 해결 가이드

## 가장 간단한 실행 방법 (3단계)

### 1단계: PostgreSQL 시작
```bash
brew services start postgresql@14
```

---

### 2단계: Backend 서버 실행 (터미널 1)
```bash
cd /Users/hoonjaepark/projects/travelPlanner
./start-backend-simple.sh
```

**성공 시 표시:**
```
🚀 Application is running on: http://localhost:3000/api
```

---

### 3단계: Frontend 서버 실행 (새 터미널)
```bash
cd /Users/hoonjaepark/projects/travelPlanner
./start-frontend-simple.sh
```

**그 다음:**
- 터미널에서 **`w`** 키 입력
- 브라우저 자동 실행

---

## 문제별 해결 방법

### ❌ "PostgreSQL 데이터베이스에 연결할 수 없습니다"

**해결:**
```bash
# PostgreSQL 시작
brew services start postgresql@14

# 잠시 대기 (5초)
sleep 5

# 데이터베이스 생성
createdb travelplanner

# 다시 실행
./start-backend-simple.sh
```

---

### ❌ "포트 3000이 이미 사용 중입니다"

**해결:**
```bash
# 사용 중인 프로세스 찾기
lsof -i :3000

# 종료
kill -9 <PID>

# 또는 자동으로 y 입력
echo "y" | ./start-backend-simple.sh
```

---

### ❌ "Module not found" 에러

**해결:**
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

---

### ❌ "Backend 서버가 실행되지 않았습니다"

**해결:**
1. 먼저 Backend 서버 실행 (터미널 1)
2. Backend가 완전히 시작될 때까지 대기 (10-20초)
3. 새 터미널에서 Frontend 실행

---

## 수동 실행 (스크립트 없이)

### Backend (터미널 1)
```bash
cd /Users/hoonjaepark/projects/travelPlanner/backend
npm install  # 처음 한 번만
npm run start:dev
```

### Frontend (터미널 2)
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend
npm install  # 처음 한 번만
npm start
```

---

## 완전 초기화 (모든 방법이 실패했을 때)

```bash
cd /Users/hoonjaepark/projects/travelPlanner

# 1. 모든 것 삭제
rm -rf backend/node_modules backend/dist
rm -rf frontend/node_modules frontend/.expo

# 2. PostgreSQL 재설정
psql -U hoonjaepark -c "DROP DATABASE IF EXISTS travelplanner;"
createdb travelplanner

# 3. Backend 재설치
cd backend
npm install
npm run build

# 4. Frontend 재설치
cd ../frontend
npm install

# 5. Backend 실행
cd ../backend
npm run start:dev

# 6. 새 터미널에서 Frontend 실행
cd ../frontend
npm start
```

---

## 빠른 상태 확인

```bash
# PostgreSQL 확인
psql -U hoonjaepark -d travelplanner -c '\dt'

# Backend 확인
curl http://localhost:3000/api
# 예상: "Cannot GET /api" → 정상

# Frontend 확인
curl http://localhost:19006
# 예상: HTML 응답 → 정상
```

---

## 여전히 안 되면?

다음 정보를 확인하세요:

1. **에러 메시지 복사**
   - Backend 터미널의 에러
   - Frontend 터미널의 에러

2. **실행한 명령어**
   - 어떤 순서로 실행했는지

3. **환경 정보**
   ```bash
   node --version
   npm --version
   psql --version
   ```

그리고 **TROUBLESHOOTING.md** 파일을 참조하세요!
