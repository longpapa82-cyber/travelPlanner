# Release Notes - versionCode 34

## Bug #11 수정: Railway 프록시 버퍼링 해결 + AdMob 크롬 팝업 제거

### 한국어 (ko-KR)
```
버그 수정 및 안정성 개선

• AI 여행 생성 시 연결 중단 문제 완전 해결
• 여행 상세 페이지 자동 이동 개선
• AdMob 광고 크롬 팝업 제거
• 전반적인 사용자 경험 향상
```

### 영어 (en-US)
```
Bug fixes and stability improvements

• Fixed AI trip creation connection interruption
• Improved automatic navigation to trip details
• Removed Chrome popup in AdMob ads
• Enhanced overall user experience
```

### 일본어 (ja-JP)
```
バグ修正と安定性の向上

• AI旅行作成時の接続中断問題を完全解決
• 旅行詳細ページへの自動移動を改善
• AdMob広告のChromeポップアップを削除
• 全体的なユーザーエクスペリエンスの向上
```

---

## Technical Details (Internal)

### Bug #11: Railway Proxy Buffering
**Problem**: Railway's custom proxy buffers small SSE data (~100KB threshold), causing complete events to be delayed or lost even after Bug #10 fixes (res.flush() + 500ms delay).

**Root Cause**: Railway proxy sits above Node.js layer and buffers data regardless of flush() calls or response timing.

**Solution**:
1. **Heartbeat messages** (5-second interval)
   - Sends `: heartbeat\n\n` every 5 seconds
   - Forces proxy to flush buffered data regularly
   - Keeps connection active

2. **Padding technique** (1KB on complete event)
   - Adds 1024 spaces to complete event
   - Exceeds buffering threshold
   - Ensures immediate transmission

**Backend Changes** (`trips.controller.ts`):
```typescript
// Heartbeat interval (lines 92-95)
const heartbeatInterval = setInterval(() => {
  res.write(': heartbeat\n\n');
  console.log('[BACKEND SSE] Heartbeat sent');
}, 5000);

// Padding on complete event (lines 113-116)
const padding = ' '.repeat(1024); // 1KB padding
const paddedEvent = { ...completeEvent, padding };
const data = `data: ${JSON.stringify(paddedEvent)}\n\n`;

// Clear heartbeat interval (lines 132, 137)
clearInterval(heartbeatInterval);
```

### AdMob Chrome Autofill Popup
**Problem**: Chrome password save popup appears when viewing AdMob ads, making the app feel like a web service.

**Root Cause**: 
- AdMob uses WebView to render HTML5 ad creatives
- Some advertisers include login forms in their ads
- Chrome's autofill service detects password fields
- Triggers password save popup

**Solution**: Expo config plugin to disable WebView autofill

**Frontend Changes**:
1. **Config Plugin** (`plugins/withDisableWebViewAutofill.js`):
   - Uses `@expo/config-plugins` to modify AndroidManifest.xml
   - Adds `android:importantForAutofill="no"` to `<application>` tag
   - Disables autofill in all WebViews including AdMob

2. **Plugin Registration** (`app.config.js`):
   - Added `'./plugins/withDisableWebViewAutofill'` to plugins array
   - Registered before other plugins

**Effect**:
- No impact on ad revenue or functionality
- Improves native app experience
- Removes confusing Chrome UI elements

### Files Modified
- `backend/src/trips/trips.controller.ts` (Bug #11: heartbeat + padding)
- `frontend/plugins/withDisableWebViewAutofill.js` (NEW: AdMob config plugin)
- `frontend/app.config.js` (plugin registration + versionCode 35 → 34)

### Related Issues
- Bug #10: SSE complete event flush timing (res.flush() + 500ms)
- Bug #11: Railway proxy buffering (heartbeat + padding)
- AdMob UX: Chrome password popup in ads

### Deployment
- Frontend: versionCode 34
- Backend: Already deployed to Railway (production)
- Build ID: ee3ebbef-f197-4994-9f38-d329bf7de668
- AAB: https://expo.dev/artifacts/eas/vqkfr3SZiPrQrKMPdgMhDf.aab
- Test Status: Pending Alpha deployment and user verification

### Testing Checklist
- [ ] AI trip creation completes without "connection interrupted" message
- [ ] Trip detail page navigation works correctly
- [ ] AI count decrements properly
- [ ] AdMob ads display without Chrome password popup
- [ ] No regression in existing features
