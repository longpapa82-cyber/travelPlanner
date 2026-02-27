# MyTravel - AI 여행 계획 플랫폼

전 세계 여행자들이 목적지만 선택하면 AI가 자동으로 최적화된 여행 계획을 수립해주는 모바일 우선 웹 서비스

## 🌟 주요 기능

- **AI 기반 자동 여행 계획 생성**: OpenAI GPT-4를 활용한 맞춤형 일정 생성
- **실시간 편의 정보**: 여행지 날씨, 시차, 현지 정보 통합 제공
- **여행 진행 상황 추적**: 여행 중 실시간 일정 관리 및 수정
- **SNS 간편 로그인**: Apple, Google, Kakao 계정으로 빠른 가입
- **여행 히스토리**: 과거 여행 기록 조회 및 관리

## 🛠️ 기술 스택

### Frontend
- React Native + Expo
- React Navigation
- React Query (TanStack Query)
- React Native Paper (UI)

### Backend
- Node.js + NestJS
- PostgreSQL (Primary DB)
- Redis (Caching)
- OpenAI GPT-4 (AI Planner)

### Cloud & DevOps
- AWS ECS Fargate
- AWS RDS PostgreSQL
- AWS ElastiCache Redis
- GitHub Actions (CI/CD)

### APIs
- OpenAI API (여행 일정 생성)
- WeatherAPI.com (날씨 & 시간대)
- Google Maps Platform (장소 정보)

## 📁 프로젝트 구조

```
travelPlanner/
├── backend/           # NestJS 백엔드 API
├── frontend/          # React Native 모바일 앱
├── docs/              # 추가 문서
├── scripts/           # 유틸리티 스크립트
├── claudedocs/        # 개발 계획 및 분석 문서
└── claude.md          # 프로젝트 요구사항
```

## 🚀 시작하기

### 사전 요구사항
- Node.js 18+
- npm 또는 yarn
- PostgreSQL 14+
- Redis 6+
- Expo CLI

### Backend 설정

```bash
cd backend
npm install
cp .env.example .env
# .env 파일 설정 (데이터베이스, API 키 등)
npm run start:dev
```

### Frontend 설정

```bash
cd frontend
npm install
cp .env.example .env
# .env 파일 설정 (API URL 등)
npm start
```

## 📚 문서

상세한 개발 계획 및 아키텍처는 [`claudedocs/comprehensive_development_plan.md`](./claudedocs/comprehensive_development_plan.md)를 참고하세요.

## 🗓️ 개발 로드맵

- [x] Phase 0: 기획 및 준비 (2주)
- [ ] Phase 1: MVP 개발 (8주)
  - [ ] Week 1-2: 인증 시스템
  - [ ] Week 3-4: AI 여행 계획 생성
  - [ ] Week 5-6: 날씨 및 시차 정보
  - [ ] Week 7-8: 여행 진행 상황 추적
  - [ ] Week 9-10: 여행 히스토리
- [ ] Phase 2: 베타 출시 (4주)
- [ ] Phase 3: 정식 출시 (2주)

## 📄 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 👤 개발자

**개발 시작일**: 2025년 1월 27일
