# Google Places API Setup Guide

## Problem
The location autocomplete feature in the activity creation modal is not working because the Google Maps API keys configured in the environment files are invalid or not properly set up.

## Current Issue
- API keys in `.env` and `.env.production` return `REQUEST_DENIED` status
- Error message: "You must use an API key to authenticate each request to Google Maps Platform APIs"
- Users cannot see location suggestions when typing

## Solution Steps

### 1. Create/Configure Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Make note of your Project ID

### 2. Enable Required APIs

Enable the following APIs for your project:
1. **Places API** - Required for autocomplete functionality
2. **Maps JavaScript API** (optional - for future map features)
3. **Geocoding API** (optional - already using LocationIQ as primary)

To enable:
1. Go to "APIs & Services" → "Library"
2. Search for "Places API"
3. Click on it and press "ENABLE"

### 3. Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "API key"
3. The API key will be created and displayed

### 4. Secure Your API Key (Important!)

1. Click on the API key you just created
2. Under "Application restrictions":
   - For development: Choose "None" temporarily
   - For production: Choose "HTTP referrers" and add:
     - `https://mytravel-planner.com/*`
     - `http://localhost:3000/*` (for development)
3. Under "API restrictions":
   - Choose "Restrict key"
   - Select only: Places API, Maps JavaScript API, Geocoding API
4. Click "SAVE"

### 5. Update Environment Files

Update the following files with your new API key:

**Backend Development** (`backend/.env`):
```env
GOOGLE_MAPS_API_KEY=your-new-api-key-here
```

**Backend Production** (`backend/.env.production`):
```env
GOOGLE_MAPS_API_KEY=your-new-api-key-here
```

### 6. Verify Setup

Test the API key directly:
```bash
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Seoul&key=YOUR_API_KEY&types=establishment|geocode"
```

You should see predictions in the response if successful.

### 7. Restart Services

After updating the environment files:
```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

## Billing Considerations

- Google provides $200 free credit per month
- Places API Autocomplete costs:
  - Autocomplete (per session): $2.83 per 1000 requests
  - Autocomplete (per request): $0.00283 per request
- The app limits to 9,500 requests/month to stay well under free tier
- Monitor usage in Google Cloud Console → "APIs & Services" → "Metrics"

## Fallback Behavior

If the API is unavailable or limit is reached:
- Users can still manually type location names
- The app will show a message: "위치 자동완성을 사용할 수 없습니다. 직접 입력해주세요."
- Manual text input works perfectly fine for location storage

## Troubleshooting

### "REQUEST_DENIED" Error
- Verify API key is correct
- Check if Places API is enabled
- Verify API key restrictions aren't too strict

### No Predictions Returned
- Check if you're hitting the monthly limit (9,500 requests)
- Verify the input has at least 2 characters
- Check backend logs for specific error messages

### API Available but Slow
- Google API might have temporary latency
- Consider increasing the debounce timer in `PlacesAutocomplete.tsx` (currently 350ms)

## Alternative Solutions

If Google Maps API setup is not feasible:
1. Continue using manual text input (current fallback)
2. Use OpenStreetMap Nominatim API (free, no key required)
3. Increase LocationIQ limits (primary geocoding service)
4. Implement a local database of common locations

## Code References

- Backend service: `backend/src/places/places.service.ts`
- Frontend component: `frontend/src/components/PlacesAutocomplete.tsx`
- API endpoint: `backend/src/places/places.controller.ts`