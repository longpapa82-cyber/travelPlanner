#!/bin/bash

# TravelPlanner 개발 서버 실행 스크립트
# 사용법: ./start-dev.sh

set -e

echo "🚀 TravelPlanner 개발 서버 시작..."
echo ""

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PostgreSQL 확인
echo -e "${BLUE}📊 PostgreSQL 확인 중...${NC}"
if ! psql -U hoonjaepark -d travelplanner -c '\q' 2>/dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL이 실행되지 않았거나 데이터베이스가 없습니다.${NC}"
    echo "PostgreSQL을 시작합니다..."
    brew services start postgresql@14 || echo "PostgreSQL 수동 시작 필요"
    sleep 2
fi

# Backend 디렉토리 확인
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}📦 Backend 의존성 설치 중...${NC}"
    cd backend && npm install && cd ..
fi

# Frontend 디렉토리 확인
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Frontend 의존성 설치 중...${NC}"
    cd frontend && npm install && cd ..
fi

echo ""
echo -e "${GREEN}✅ 준비 완료!${NC}"
echo ""
echo -e "${BLUE}Backend 서버를 시작합니다...${NC}"
echo -e "${YELLOW}새 터미널에서 다음 명령어를 실행하세요:${NC}"
echo ""
echo -e "  cd $(pwd)/frontend && npm start"
echo ""
echo "Press Enter to continue..."
read

# Backend 서버 실행
cd backend
npm run start:dev
