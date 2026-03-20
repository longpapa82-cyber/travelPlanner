# Publish QA Agent Memory

## Review Date: 2026-03-02 (Latest -- Comprehensive Audit)

## App Configuration Summary
- **Expo SDK**: 54 (React Native 0.81.5) -> targets API 35 (Android 15)
- **Package**: com.longpapa82.travelplanner
- **Bundle ID**: com.travelplanner.app (iOS)
- **Version**: 1.0.0
- **versionCode**: 7 (both app.json and app.config.js)
- **EAS Project ID**: 6834aeb3-58dd-4d9d-a3a3-19824beb9e62
- **EAS submit track**: production (draft)
- **EAS build profiles**: 4 (development, preview, staging, production)

## Fixes Applied in 2026-03-02 Audit Session
- nginx: added /privacy-en and /terms-en routes (were 404)
- Store metadata: "13 languages" -> "17 languages" in all files
- Store metadata: created 4 missing files (it, ru, tr, ms) -- now 17 total
- Store metadata: non-Korean privacyUrl/termsUrl -> English versions
- Privacy KO/EN: added Stripe + LocationIQ to international data transfer table
- Privacy KO + Terms KO: footer language badges updated to 17
- Privacy/Terms dateModified updated to 2026-03-02
- SMTP_FROM rebranded: "TravelPlanner" -> "MyTravel" in backend/.env
- LocationIQ was already in both privacy policies' third-party table

## Remaining Blockers (P0) -- Manual Action Required
- Screenshots 720x1600 -- below Play Store minimum (1080x1920 required)
- Feature graphic dimensions: Banner_1024_500.png is 1344x768, banner_b is 2816x1536
  - Must be exactly 1024x500 PNG for Google Play
- adaptive-icon.png is RGBA (has alpha channel)

## Remaining P1 Issues
- `banner_myTravel_Planner.png` + `ico_travelplanner.png`: old branding assets
- All icon files in icon_banners/ are RGBA mode -- Play Store icon needs no-alpha
- PaywallModal legal links hardcoded to Korean URLs for all users
- PREMIUM_ENABLED=false in config.ts -- needs enabling for store launch

## Data Safety Mapping (for Google Play Console form)
See comprehensive audit report for full mapping table.

## Files Reference
- app.config.js: frontend/app.config.js
- app.json: frontend/app.json
- eas.json: frontend/eas.json
- store-metadata: frontend/store-metadata/ (17 language files)
- Privacy KO: frontend/public/privacy.html
- Privacy EN: frontend/public/privacy-en.html
- Terms KO: frontend/public/terms.html
- Terms EN: frontend/public/terms-en.html
- nginx (frontend): frontend/nginx.conf
- nginx (proxy): proxy/nginx.conf
- assetlinks.json: frontend/public/.well-known/assetlinks.json
