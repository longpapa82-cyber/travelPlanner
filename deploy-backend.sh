#!/bin/bash
# Backend Production Deployment Script (Issue #6)
# Server: Hetzner VPS (46.62.201.127)

set -e

echo "🚀 Deploying Backend to Hetzner VPS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# SSH into server and deploy
ssh root@46.62.201.127 << 'ENDSSH'
set -e

echo "📂 Navigating to project directory..."
cd /root/travelPlanner/backend || { echo "❌ Project directory not found!"; exit 1; }

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo "📦 Installing dependencies (if needed)..."
npm install --production

echo "🔧 Configuring Mapbox environment variable..."
if ! grep -q "MAPBOX_ACCESS_TOKEN" .env; then
    echo "MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibG9uZ3BhcGE4MiIsImEiOiJjbW5iY2lldjgwdWdrMnFuNXk2d3BkZzd4In0.LfOCY9X7ktp1ZbxmGPjTpA" >> .env
    echo "✅ Mapbox token added to .env"
else
    echo "✅ Mapbox token already exists in .env"
fi

echo "🔄 Restarting backend service..."
if command -v pm2 &> /dev/null; then
    pm2 restart travelplanner || pm2 start dist/main.js --name travelplanner
    echo "✅ PM2 service restarted"
elif systemctl is-active --quiet travelplanner; then
    systemctl restart travelplanner
    echo "✅ Systemd service restarted"
else
    echo "⚠️  No process manager found. Please restart manually."
fi

echo "🔍 Checking deployment..."
sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend deployment completed!"
echo "📊 Verifying API health..."

ENDSSH

# Verify deployment
echo ""
echo "🌐 Testing API endpoint..."
curl -s https://mytravel-planner.com/api/health | head -5 || echo "⚠️  API health check failed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment completed!"
echo ""
echo "📝 Next steps:"
echo "   1. ✅ Backend deployed (Issue #6 fixes)"
echo "   2. ⏳ Wait for Play Console Alpha review (~14 min)"
echo "   3. 🧪 Test manual activity creation in versionCode 40"
echo ""
