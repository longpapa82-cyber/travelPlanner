#!/bin/bash
# Phase 0.5 긴급 배포 스크립트
# SmartAppBanner CSS 수정 + CTA 앱 다운로드 변경 + Nginx 리다이렉트

set -e  # 에러 발생 시 즉시 중단

SERVER="root@46.62.201.127"
REMOTE_STATIC="/static-content"
REMOTE_NGINX="/etc/nginx/sites-available/default"

echo "🚀 Phase 0.5 배포 시작..."
echo "================================"

# 1. 랜딩 페이지 배포
echo ""
echo "📄 Step 1: 랜딩 페이지 배포..."
rsync -avz frontend/public/landing.html $SERVER:$REMOTE_STATIC/
rsync -avz frontend/public/landing-en.html $SERVER:$REMOTE_STATIC/

if [ $? -eq 0 ]; then
  echo "✅ 랜딩 페이지 배포 완료"
else
  echo "❌ 랜딩 페이지 배포 실패"
  exit 1
fi

# 2. FAQ 페이지 배포 (있으면)
if [ -f frontend/public/faq.html ]; then
  echo ""
  echo "📄 Step 2: FAQ 페이지 배포..."
  rsync -avz frontend/public/faq.html $SERVER:$REMOTE_STATIC/
  echo "✅ FAQ 페이지 배포 완료"
fi

# 3. Nginx 설정 백업 및 수정 안내
echo ""
echo "⚙️  Step 3: Nginx 설정 수정 필요"
echo "다음 명령어를 서버에서 실행하세요:"
echo ""
echo "# SSH 접속"
echo "ssh $SERVER"
echo ""
echo "# Nginx 설정 백업"
echo "cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup-\$(date +%Y%m%d)"
echo ""
echo "# Nginx 설정 수정"
echo "nano /etc/nginx/sites-available/default"
echo ""
echo "# /docs/nginx-phase-0.5-config.conf 내용을 추가:"
cat << 'NGINXCONF'

    # Phase 0.5: 웹 서비스 접근 차단
    location = /login {
        return 302 https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner;
    }

    location = /register {
        return 302 https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner;
    }

    location ~ ^/(home|trips|profile|settings|shared-trip) {
        return 302 /;
    }

    location = /index.html {
        return 302 /;
    }

NGINXCONF

echo ""
echo "# Nginx 설정 테스트"
echo "nginx -t"
echo ""
echo "# Nginx 재시작"
echo "systemctl reload nginx"
echo ""

# 4. 배포 검증 안내
echo "================================"
echo "✅ Phase 0.5 파일 배포 완료"
echo ""
echo "📋 다음 단계:"
echo "1. 서버에 SSH 접속하여 Nginx 설정 수정"
echo "2. 배포 검증:"
echo "   curl https://mytravel-planner.com/landing.html | grep '앱 다운로드'"
echo "   curl -I https://mytravel-planner.com/login  # 302 리다이렉트 확인"
echo "3. Android 기기에서 SmartAppBanner 레이아웃 확인"
echo ""
echo "================================"
