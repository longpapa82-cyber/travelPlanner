#!/bin/bash

# MyTravel Frontend 실행 스크립트
# 사용법: ./start-frontend.sh

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 MyTravel Frontend 시작...${NC}"
echo ""

# 의존성 확인
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 의존성 설치 중...${NC}"
    cd frontend && npm install && cd ..
fi

echo -e "${GREEN}✅ 준비 완료!${NC}"
echo ""
echo -e "${BLUE}Expo 개발 서버 실행 중...${NC}"
echo ""
echo -e "${YELLOW}접속 방법:${NC}"
echo "  - 웹: 'w' 키 → http://localhost:19006"
echo "  - iOS: 'i' 키 → iOS 시뮬레이터"
echo "  - Android: 'a' 키 → Android 에뮬레이터"
echo "  - 모바일: QR 코드 스캔"
echo ""

cd frontend
npm start
