#!/bin/bash

echo "📱 Frontend 서버 시작 중..."
echo ""

cd /Users/hoonjaepark/projects/travelPlanner/frontend

# Backend 서버 확인
echo "🔍 Backend 서버 확인 중..."
if ! curl -s http://localhost:3000/api >/dev/null 2>&1; then
    echo "❌ Backend 서버가 실행되지 않았습니다"
    echo ""
    echo "먼저 Backend 서버를 실행하세요:"
    echo "  ./start-backend-simple.sh"
    echo ""
    exit 1
fi
echo "✅ Backend 서버 연결 성공"
echo ""

# node_modules 확인
if [ ! -d "node_modules" ]; then
    echo "📦 의존성 설치 중..."
    npm install
fi

# 포트 정리
for port in 19000 19001 19006; do
    if lsof -i :$port >/dev/null 2>&1; then
        echo "⚠️  포트 $port 정리 중..."
        lsof -ti :$port | xargs kill -9 2>/dev/null
    fi
done

echo ""
echo "🚀 Frontend 서버 실행 중..."
echo ""
echo "접속 방법:"
echo "  - 웹: 터미널에서 'w' 키 입력"
echo "  - iOS: 터미널에서 'i' 키 입력"
echo "  - Android: 터미널에서 'a' 키 입력"
echo ""
echo "중지하려면 Ctrl+C를 누르세요"
echo ""

npm start
