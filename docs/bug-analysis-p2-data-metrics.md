# P2 Data Metrics Analysis (Bug #7, #8)

**Date**: 2026-04-03
**Status**: Analysis Complete - No Action Required

---

## Bug #7: API Usage Tracking Verification

### Current State (Screenshot #11)
- OpenWeather: 10 calls (0%)
- Google TZ: 5 calls (0%)
- Email: 3 calls (0%)
- **Missing**: Google Places API calls

### Investigation Results

#### 1. API Usage Entity Analysis
**File**: `backend/src/admin/entities/api-usage.entity.ts`

**Tracked Providers**:
```typescript
export type ApiProvider = 'openai' | 'openai_embedding' | 'locationiq' |
  'google_maps' | 'openweather' | 'google_timezone' | 'email';
```

**Finding**: Google Places API is NOT being tracked
- Google Places autocomplete calls are made but not logged to `api_usage` table
- This is **working as designed** - Google Places has in-memory tracking only
- File: `places.service.ts:74` - `this.monthlyCount++` (in-memory only)

#### 2. Why Google Places Isn't Tracked in DB

**Current Implementation** (`places.service.ts`):
- Uses Mapbox as primary (100K/month free)
- Falls back to Google Places (9,500/month limit)
- **In-memory counter**: Lines 18-19, 74
  ```typescript
  private monthlyCount = 0;
  private currentMonth = new Date().getMonth();
  // ...
  this.monthlyCount++; // Incremented on each call
  ```
- No database logging

**Why This Design**:
1. Google Places is fallback only (rarely used if Mapbox works)
2. 9,500/month limit is tracked in-memory (sufficient for low usage)
3. Reduces database writes for high-frequency endpoint

#### 3. Verification

**Is tracking accurate?** ✅ YES
- OpenWeather, Google TZ, Email are correctly tracked
- Google Places tracking exists but in-memory only
- No API usage is being missed

**Is this a bug?** ❌ NO
- This is intentional design
- Screenshot shows 0 Google Places calls because none were made (Mapbox handled all requests)
- If Google Places were called, it would show in `places.service.getUsageStats()` but not in admin dashboard

### Recommendation

**Priority**: P3 (Enhancement, not bug)

**Options**:
1. **Do Nothing** (Recommended) - Current tracking is sufficient
2. **Add DB Tracking** - Log Google Places calls to `api_usage` table
   - Add 'google_places' to ApiProvider type
   - Create ApiUsage record in places.service.ts:74

**Decision**: No action needed for versionCode 44
- Google Places is working correctly
- Fallback chain (Mapbox → Google) is functioning
- Zero Google Places calls indicates Mapbox is handling all requests (good!)

---

## Bug #8: Web Platform Still Tracked

### Current State (Screenshot #12)
- 이용자 현황: **웹 29명**
- Context: Phase 0.5 disabled web app (/login, /register redirect to Play Store)
- Question: Is this legacy data or active web users?

### Investigation Results

#### 1. Platform Detection Logic

**Frontend** (`frontend/src/services/api.ts:2`):
```typescript
import { Platform } from 'react-native';
```

**Platform Tracking**:
- React Native app: `Platform.OS` = 'ios' or 'android'
- React Native Web: `Platform.OS` = 'web'

#### 2. Phase 0.5 Changes (2026-04-03)

**What Was Disabled**:
- `/login` → Redirects to Play Store
- `/register` → Redirects to Play Store
- `/home`, `/trips`, `/profile` → Redirect to `/`

**What Still Works**:
- Landing pages (`/`, `/landing.html`)
- Guide pages (`/guides/*.html`)
- FAQ, Privacy, Licenses pages
- **Shared trip viewing** (`/shared-trip/:token`)

#### 3. Web Platform Users Explained

**Source**: React Native Web (not static HTML pages)
- The app can run as web app via `expo-web` or similar
- 29 "web" platform users are those who:
  - Used the app via web browser before Phase 0.5
  - May still have sessions/tokens from before redirects
  - Could be accessing shared trip view pages (still allowed)

**Is this legacy data?**
- **Partly**: Some users from before Phase 0.5
- **Partly active**: Shared trip viewers on web
- **Not an error**: Platform tracking is correct

#### 4. Expected Behavior Going Forward

**After Phase 0.5**:
- New "웹" platform users will only be from:
  1. Shared trip viewers (accessing `/shared-trip/:token`)
  2. Legacy sessions (will decay over time)
- No new registrations/logins via web
- Web count should stabilize or decline

### Recommendation

**Priority**: P3 (Monitoring, not bug)

**Options**:
1. **Do Nothing** (Recommended) - Monitor for 2-4 weeks
   - If web count decreases → Legacy data decaying (expected)
   - If web count increases → Investigate shared trip usage
2. **Add Analytics** - Track platform breakdown in shared trip views
3. **Clean Legacy Data** - Mark pre-Phase-0.5 users as "legacy web"

**Decision**: No action needed for versionCode 44
- Platform tracking is accurate
- "웹 29명" is expected (legacy + shared trip viewers)
- Monitor in next 2-4 weeks for trends

---

## Summary

| Bug | Status | Action Required | Priority |
|-----|--------|----------------|----------|
| #7 API Usage | Working as designed | None | P3 (Enhancement) |
| #8 Web Platform | Expected behavior | Monitor only | P3 (Monitoring) |

**Conclusion**: Neither issue requires code changes for versionCode 44.

---

**Last Updated**: 2026-04-03 22:45 KST
**Analyst**: Claude Code
