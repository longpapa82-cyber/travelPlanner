# Publish QA Agent Memory

## Last Review: 2026-02-28

## Key Findings Summary
- **Privacy Policy**: https://mytravel-planner.com/privacy (200 OK, comprehensive Korean)
- **Terms of Service**: https://mytravel-planner.com/terms (200 OK, includes subscription terms)
- **app-ads.txt**: https://mytravel-planner.com/app-ads.txt (200 OK)
- **assetlinks.json**: NOT configured (returns HTML SPA fallback, not JSON)
- **Icon**: 1024x1024 RGBA PNG (has alpha channel -- Google Play requires NO alpha for 512x512 hi-res icon)
- **Store Metadata**: 9 languages (ko/en/ja/zh/es/de/fr/th/vi) -- missing ar/id/hi/pt
- **Rebrand Issue**: ja.json = "TravelPlanner", zh.json = "旅行规划师" (not MyTravel)
- **Language count**: Descriptions say "9 languages" but app supports 13
- **PREMIUM_ENABLED**: false (subscription UI gated by feature flag)
- **Account Deletion**: Implemented (ProfileScreen + backend POST /users/me/delete)
- **GDPR Export**: Implemented (backend GET /users/me/export)
- **AdMob**: Production ad unit IDs in app.config.js, test IDs in __DEV__, GDPR consent via UMP SDK
- **Token Storage**: react-native-keychain on native (secure), memory+sessionStorage on web
- **Sentry**: Configured with DSN from env
- **Notifications**: Android channel set, Expo Push Token registration
- **RevenueCat**: Configured for iOS + Android, restorePurchases available
- **google-play-service-account.json**: exists, gitignored

## Critical Blockers Found
1. assetlinks.json not served (Android App Links verification will fail)
2. Store metadata rebrand incomplete (ja/zh still say old name)
3. Store metadata languages incomplete (only 9 of 13)
4. All descriptions claim "9 languages" -- should be "13 languages"

## Architecture Reference
- [See project MEMORY.md for full architecture](../../../.claude/projects/-Users-hoonjaepark-projects-travelPlanner/memory/MEMORY.md)
