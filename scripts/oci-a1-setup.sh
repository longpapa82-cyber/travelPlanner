#!/bin/bash
# OCI A1.Flex 서버 초기 셋업 스크립트
# SSH 접속 후 실행: bash oci-a1-setup.sh

set -euo pipefail

echo "=== OCI A1.Flex 서버 셋업 ==="
echo "아키텍처: $(uname -m)"
echo ""

# 1. 시스템 업데이트
echo "[1/6] 시스템 업데이트..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Docker 설치
echo "[2/6] Docker 설치..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker ubuntu
    echo "Docker 설치 완료"
else
    echo "Docker 이미 설치됨: $(docker --version)"
fi

# 3. Docker Compose 플러그인 확인
echo "[3/6] Docker Compose 확인..."
if docker compose version &> /dev/null; then
    echo "Docker Compose: $(docker compose version)"
else
    echo "Docker Compose 플러그인 설치..."
    sudo apt-get install -y docker-compose-plugin
fi

# 4. Swap 설정 (2GB — 12GB RAM이면 작게 설정)
echo "[4/6] Swap 설정..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap 2GB 생성 완료"
else
    echo "Swap 이미 존재: $(free -h | grep Swap)"
fi

# 5. 방화벽 설정 (iptables — OCI는 기본 iptables 규칙 있음)
echo "[5/6] 방화벽 설정..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo iptables-save | sudo tee /etc/iptables/rules.v4

echo "포트 80, 443, 8080 오픈"

# 6. 프로젝트 디렉토리 생성
echo "[6/6] 프로젝트 준비..."
mkdir -p ~/travelPlanner
mkdir -p ~/backups

echo ""
echo "=== 셋업 완료 ==="
echo "메모리: $(free -h | grep Mem | awk '{print $2}')"
echo "디스크: $(df -h / | tail -1 | awk '{print $4}') 남음"
echo "Docker: $(docker --version 2>/dev/null)"
echo "아키텍처: $(uname -m)"
echo ""
echo "다음 단계:"
echo "1. 기존 서버에서 DB 덤프: pg_dump"
echo "2. 프로젝트 파일 복사: rsync"
echo "3. .env 설정 + Docker Compose 실행"
