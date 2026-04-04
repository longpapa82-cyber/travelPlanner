# Alpha Test Device Setup for AdMob

## Problem
Test devices are not seeing test ads, resulting in "No fill" errors during Alpha testing.

## Solution
Add test device hashes to the configuration files to enable test ads.

## How to Find Your Device Hash

1. **Run the app on your test device**
2. **Try to show a rewarded ad** (Create Trip → AI 생성 button)
3. **Check the logs** for one of these messages:
   - `[useRewardedAd] 🔑 DEVICE HASH DETECTED: [32-character hash]`
   - `[AdMob] 🔑 DEVICE HASH DETECTED: [32-character hash]`
   - `[AdManager] 🔑 DEVICE HASH DETECTED: [32-character hash]`

Example device hash: `33BE2250B43518FE82E722C6EF3B8D5E`

## Where to Add Device Hashes

Add the device hash to **ALL THREE** locations:

### 1. `/frontend/src/components/ads/useRewardedAd.native.ts`
```typescript
const ALPHA_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  TestIds.DEVICE || '',
  '33BE2250B43518FE82E722C6EF3B8D5E', // Your device hash here
];
```

### 2. `/frontend/src/utils/initAds.native.ts`
```typescript
const ALPHA_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  '33BE2250B43518FE82E722C6EF3B8D5E', // Your device hash here
];
```

### 3. `/frontend/src/utils/adManager.native.ts`
```typescript
const KNOWN_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  '33BE2250B43518FE82E722C6EF3B8D5E', // Your device hash here
];
```

## After Adding Device Hashes

1. **Rebuild the app** (EAS Build for production, or local build for development)
2. **Test ads should now work** on the configured devices
3. **Verify in logs**: Look for "Using TEST ad ID" messages

## Important Notes

- Device hashes are **case-insensitive** (use uppercase for consistency)
- Each physical device has a **unique hash**
- Emulators/Simulators use special strings: 'EMULATOR' (Android) or 'SIMULATOR' (iOS)
- Test ads are **free and unlimited** - they don't count against your quota
- In production builds, only devices with registered hashes see test ads; others see real ads

## Troubleshooting

If test ads still don't appear after adding device hash:

1. **Check logs** for error messages
2. **Verify network connectivity** (no VPN/proxy blocking ads)
3. **Ensure AdMob account is active** (not suspended)
4. **Try force reload**: In CreateTripScreen, there may be a reload button
5. **Clear app data** and restart

## For Alpha Testers

Please provide your device hash to the developer so it can be added to the test device list. This ensures you see test ads instead of real ads during testing.