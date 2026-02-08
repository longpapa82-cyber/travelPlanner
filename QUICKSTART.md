# 🚀 TravelPlanner 빠른 시작 가이드

## 필수 요구사항

- Node.js 18+
- PostgreSQL 14+
- Expo CLI (자동 설치됨)

## 1분 실행 가이드

### 방법 1: 자동 스크립트 사용 (권장)

**터미널 1 - Backend:**
```bash
./start-dev.sh
```

**터미널 2 - Frontend:**
```bash
./start-frontend.sh
```

### 방법 2: 수동 실행

**터미널 1 - Backend:**
```bash
cd backend
npm install
npm run start:dev
```

**터미널 2 - Frontend:**
```bash
cd frontend
npm install
npm start
```

## 접속 경로

### 웹 브라우저 (가장 빠름)
1. Frontend 터미널에서 `w` 키 입력
2. 자동으로 http://localhost:19006 열림

### iOS 시뮬레이터 (Mac 전용)
1. Frontend 터미널에서 `i` 키 입력
2. iOS 시뮬레이터 자동 실행

### Android 에뮬레이터
1. Android Studio에서 AVD 실행
2. Frontend 터미널에서 `a` 키 입력

### 실제 모바일 기기
1. Expo Go 앱 설치
2. QR 코드 스캔

## 테스트 시나리오

### 1. 회원가입 & 로그인
```
LoginScreen → "회원가입" → RegisterScreen
→ 정보 입력 → "계정 만들기" → 자동 로그인
```

**테스트 계정:**
- 이메일: test@example.com
- 비밀번호: password123

### 2. AI 여행 계획 생성
```
메인 화면 → "+ 새 여행 계획" → 목적지 입력
→ "도쿄, 일본" → 날짜 선택 → "여행 계획 생성"
→ AI 생성 (5-10초) → 여행 상세 화면
```

### 3. 진행 현황 추적
```
TripDetailScreen → Day 탭 선택
→ Timeline Dot (체크박스) 클릭
→ 완료/미완료 토글 → 진행률 자동 업데이트
```

### 4. 활동 수정 & 드래그앤드롭
```
활동 카드 → ✏️ 아이콘 클릭 → 정보 수정
또는
활동 카드 길게 누르기 → 드래그 → 순서 변경
```

## API 엔드포인트

**Backend**: http://localhost:3000/api

### 인증
- POST `/auth/register` - 회원가입
- POST `/auth/login` - 로그인
- GET `/auth/me` - 내 정보

### 여행 계획
- POST `/trips` - AI 여행 생성
- GET `/trips` - 여행 목록
- GET `/trips/:id` - 여행 상세
- PATCH `/trips/:id/itineraries/:iid/activities/:index` - 활동 수정
- PATCH `/trips/:id/itineraries/:iid/activities/reorder` - 순서 변경

## 문제 해결

### PostgreSQL 연결 오류
```bash
# PostgreSQL 시작
brew services start postgresql@14

# 데이터베이스 확인
psql -U hoonjaepark -d travelplanner
```

### Frontend 연결 오류
```bash
# Backend 서버 확인
curl http://localhost:3000/api

# 캐시 삭제 후 재시작
cd frontend
npm start -- --clear
```

### 의존성 설치 오류
```bash
# Node modules 재설치
rm -rf backend/node_modules frontend/node_modules
cd backend && npm install
cd ../frontend && npm install
```

## 기능 완료 현황

### P0 (필수) - 100% ✅
- ✅ 인증 (회원가입/로그인/SNS)
- ✅ AI 여행 계획 생성
- ✅ 여행 목록/상세 화면

### P1 (편의) - 100% ✅
- ✅ 활동 수정/추가 (드래그앤드롭)
- ✅ 날씨 & 시차 정보
- ✅ 진행 현황 추적

### P2 (고급) - 0%
- ⏳ 지도 통합
- ⏳ 비용 추적
- ⏳ 여행 공유

## 다음 단계

1. **실제 테스트**: 위 시나리오대로 기능 테스트
2. **버그 수정**: 발견된 문제 해결
3. **P2 기능 구현**: 고급 기능 추가
4. **배포 준비**: Production 환경 설정

## 지원

문제가 발생하면:
1. Backend/Frontend 터미널 로그 확인
2. 브라우저 Console 확인 (F12)
3. QUICKSTART.md 문제 해결 섹션 참조
