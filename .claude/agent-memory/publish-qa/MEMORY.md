# Publish QA Agent Memory

## Review Status
- Last full review: 2026-03-03
- Verdict: CONDITIONAL GO
- Google Play: Internal test submitted 2026-02-28, production pending manual actions
- Apple App Store: Not yet submitted (Apple Developer registration needed)

## Resolved in 2026-03-03 Review
- releaseNotes: removed "Premium subscription" mentions across 17 store-metadata files (PREMIUM_ENABLED=false)
- privacy.html + privacy-en.html: added announcement_reads data collection disclosure
- supportUrl: changed from /help (404) to /faq (exists) across 17 store-metadata files
- initAds.native.ts: removed ATT immediate request, now deferred via useTrackingTransparency only
- app.json: cleaned up conflicting settings (was "frontend"/"light", now minimal)
- PaywallModal: links now use canonical /terms and /privacy (no .html)
- store-metadata: 17 files (ko/en/ja/zh/es/de/fr/th/vi/pt/ar/id/hi/it/ru/tr/ms)
- All descriptions correctly say "17 languages"

## Previously Resolved
- versionCode 7 in both app.json and app.config.js
- Stripe listed in privacy policy third-party tables
- lastPlatform/lastUserAgent in privacy policy auto-collected section

## Remaining Manual Actions
1. apple-app-site-association file missing (iOS only, blocks Universal Links)
2. RevenueCat API keys empty (OK while PREMIUM_ENABLED=false)
3. Google Play reviewer test account credentials needed in Play Console
4. Data Safety section must be filled in Play Console (see mapping below)
5. assetlinks.json SHA-256 fingerprint must match Play App Signing key
6. splash-icon.png 512x512 -- recommend 1024x1024

## Data Safety Mapping (for Play Console)
| Data Type | Collected | Shared With | Purpose |
|---|---|---|---|
| Email | Yes | No | Account, App functionality |
| Name | Yes | No | App functionality |
| Profile photo | Yes | No | App functionality |
| Photos | Yes | No | App functionality |
| Approx location (city) | Yes | OpenWeather, Google Maps | App functionality |
| Purchase history | Yes | RevenueCat | App functionality |
| App activity | Yes | No | Analytics |
| App interactions (announcements) | Yes | No | App functionality |
| Diagnostics/Crash | Yes | Sentry | App performance |
| Ad ID | Yes | AdMob/Google | Advertising |
| Device info | Yes | No | App functionality, Analytics |

## Key Architecture Facts
- Expo SDK 54, React Native 0.81.5, EAS Build
- icon.png: 1024x1024 RGB PNG (no alpha) -- PASS
- adaptive-icon.png: 1024x1024 RGBA -- OK for foreground layer
- splash-icon.png: 512x512 RGBA -- small, recommend 1024+
- 17 languages in app, 17 in store-metadata
- PREMIUM_ENABLED = false (frontend/src/constants/config.ts line 17)
- Account deletion: ProfileScreen + backend POST /users/me/delete
- GDPR export: ProfileScreen handleExportData + backend
- ATT: expo-tracking-transparency + PrePermissionATTModal (deferred, session >= 3)
- GDPR UMP: useGDPRConsent hook + initAds.native.ts (UMP only, no ATT)
- AdMob: banner/interstitial/appOpen/rewarded with __DEV__ test IDs
- Deep links: travelplanner:// scheme + https://mytravel-planner.com
- assetlinks.json: frontend/public/.well-known/assetlinks.json
- google-play-service-account.json in .gitignore

## Store Metadata
- Location: frontend/store-metadata/{lang}.json (17 files)
- supportUrl: /faq (verified exists as static HTML)
- releaseNotes: no premium/subscription mentions (safe for PREMIUM_ENABLED=false)
