#!/bin/bash

echo "🔍 Backend 서버 시작 중..."
echo ""

cd /Users/hoonjaepark/projects/travelPlanner/backend

# PostgreSQL 확인
echo "📊 PostgreSQL 확인 중..."
if ! psql -U hoonjaepark -d travelplanner -c '\q' 2>/dev/null; then
    echo "❌ PostgreSQL 데이터베이스에 연결할 수 없습니다"
    echo ""
    echo "해결 방법:"
    echo "1. PostgreSQL 시작: brew services start postgresql@14"
    echo "2. 데이터베이스 생성: createdb travelplanner"
    exit 1
fi
echo "✅ PostgreSQL 정상"
echo ""

# node_modules 확인
if [ ! -d "node_modules" ]; then
    echo "📦 의존성 설치 중..."
    npm install
fi

# 포트 확인
if lsof -i :3000 >/dev/null 2>&1; then
    echo "⚠️  포트 3000이 이미 사용 중입니다"
    echo "다른 프로세스를 종료하시겠습니까? (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        lsof -ti :3000 | xargs kill -9
        echo "✅ 포트 3000 정리 완료"
    fi
fi

echo ""
echo "🚀 Backend 서버 실행 중..."
echo "접속 URL: http://localhost:3000/api"
echo ""
echo "중지하려면 Ctrl+C를 누르세요"
echo ""

npm run start:dev
