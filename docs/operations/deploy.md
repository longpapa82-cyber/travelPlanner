# 배포 절차

## 백엔드 배포

```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 소스 동기화 + 재빌드
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"

# 헬스 체크
curl https://mytravel-planner.com/api/health
```

## Android 빌드/제출

```bash
# AAB 빌드 (versionCode autoIncrement)
cd frontend
eas build --platform android --profile production --local --output ../build-vXXX.aab

# Alpha 트랙 제출
eas submit --platform android --profile alpha --path ../build-vXXX.aab

# Production 트랙 제출
eas submit --platform android --profile production --path ../build-vXXX.aab
```

## iOS 빌드/제출

```bash
# IPA 빌드 (buildNumber autoIncrement)
cd frontend
eas build --platform ios --profile production-ios

# TestFlight 제출
EXPO_APPLE_ID=longpapa82@gmail.com \
EXPO_APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx \
eas submit --platform ios --profile production-ios --latest
```

## 버전 관리
- Android: `app.json` → `android.versionCode` (autoIncrement in eas.json production profile)
- iOS: `app.json` → `ios.buildNumber` (autoIncrement in eas.json production-ios profile)
