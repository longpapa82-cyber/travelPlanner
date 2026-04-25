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
├── frontend/          # React Native 모바일 앱 (Expo)
├── docs/              # 가이드 + 운영 ADR + 아카이브 (docs/README.md 참조)
├── scripts/           # 유틸리티 스크립트
├── testResult.md      # Alpha 테스트 결과 (역시간순 누적)
└── CLAUDE.md          # 프로젝트 SSOT — 인프라/계정/이력/불변식
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

- 프로젝트 SSOT: [`CLAUDE.md`](./CLAUDE.md) — 인프라/자격증명/버전 이력/핵심 불변식
- 가이드: [`docs/guides/`](./docs/guides/) — 배포, OAuth 게시, IAP 테스트 등
- 운영 결정: [`docs/operations/`](./docs/operations/) — 폴링 아키텍처 등 ADR
- 아카이브: [`docs/archive/`](./docs/archive/) — V0~V112 RCA, 릴리스 노트 통합본

## 🗓️ 개발 현황

- [x] **Phase 0**: 기획 및 준비
- [x] **Phase 1**: MVP 개발 (인증, AI 여행 생성, 날씨/시차, 진행 추적, 히스토리)
- [x] **Phase 2**: Alpha 비공개 테스트 (Play Console Alpha 트랙, V124~V178 진행)
- [ ] **Phase 3**: 프로덕션 트랙 단계적 출시 (1% → 5% → 20% → 50% → 100%)

상세 진행 상황은 [`CLAUDE.md`](./CLAUDE.md)의 "현재 상태" 섹션 참조.

## 📄 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 👤 개발자

**개발 시작일**: 2025년 1월 27일
