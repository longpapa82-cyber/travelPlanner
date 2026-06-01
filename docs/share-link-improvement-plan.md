# 여행 공유 기능 개선 계획

**작성일**: 2026-05-19  
**대상 플랫폼**: iOS, Android, Web  
**작업 범위**: P1 (버그 수정) → P2 (웹 뷰어) → P3 (딥링크 등록)

---

## 현재 상태 진단

### 공유 흐름 (현재)

```
사용자가 앱에서 [공유 링크 복사]
         ↓
https://mytravel-planner.com/share/{32자리 hex 토큰}
         ↓
nginx SPA fallback → index.html → WebAppRedirectScreen 렌더링
         ↓
"Play 스토어에서 앱 받기" 버튼 하나만 표시
         ↙                    ↘
  iOS (iPhone)              Android
  Play 스토어 연결 ❌         Play 스토어 연결 ✅
```

### 확인된 문제

| 문제 | 원인 | 파일 |
|------|------|------|
| iOS에서 Play 스토어 연결 | `WebAppRedirectScreen.tsx`의 `Platform.OS === 'ios'` 분기가 웹 빌드에서 항상 `'web'`이므로 작동 안 함 | `frontend/src/screens/web/WebAppRedirectScreen.tsx:162` |
| 공유 링크에서 여행 내용 미표시 | `/share/*` 경로가 SPA fallback으로 가서 WebAppRedirectScreen만 보임 | `frontend/nginx.conf` |
| 앱 설치 후 공유 여행 자동 열기 불가 | `assetlinks.json` / `apple-app-site-association`에 `/share` 경로 미등록 | `.well-known/` 파일들 |

### 관련 파일 목록

```
frontend/
├── src/screens/web/WebAppRedirectScreen.tsx     ← P1 수정 대상
├── src/screens/trips/SharedTripViewScreen.tsx   ← P2 웹 뷰어 참고용
├── nginx.conf                                   ← P2, P3 수정 대상
├── public/
│   ├── .well-known/assetlinks.json             ← P3 수정 대상
│   └── share.html                              ← P2 신규 생성
proxy/
└── static-well-known/.well-known/
    └── apple-app-site-association              ← P3 수정 대상
app.json                                        ← P3 수정 대상 (intentFilters)
```

---

## P1 — iOS 스토어 분기 버그 수정

**예상 소요**: 30분  
**배포**: 서버 사이드 변경만 → docker build + deploy  
**앱 빌드**: 불필요

### 원인 분석

`WebAppRedirectScreen.tsx:162`
```typescript
// 현재 코드 — 웹 빌드에서 Platform.OS는 항상 'web'이므로 분기 안 됨
const openStore = () => {
  const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  ...
};
```

웹 빌드에서 iOS/Android 감지는 `window.navigator.userAgent`로만 가능.

### 수정 내용

**파일**: `frontend/src/screens/web/WebAppRedirectScreen.tsx`

```typescript
// 수정 후 — UA로 플랫폼 감지
function getStoreUrl(): string {
  if (typeof window === 'undefined') return PLAY_STORE_URL;
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return APP_STORE_URL;
  return PLAY_STORE_URL;
}

// 버튼 텍스트도 플랫폼별로 분기
function getStoreLabel(): string {
  if (typeof window === 'undefined') return 'Play 스토어에서 앱 받기';
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'App Store에서 앱 받기';
  return 'Play 스토어에서 앱 받기';
}
```

### App Store URL 확인 필요

현재 `APP_STORE_URL`이 placeholder(`id0000000000`)임. B58 출시 완료 시 실제 App ID로 교체 필요.
- Play Console: `https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner` ✅
- App Store: `https://apps.apple.com/app/id??????` ← **실제 ID 확인 후 입력**

---

## P2 — 웹 뷰어 (공유 링크에서 여행 내용 미리보기)

**예상 소요**: 4~6시간  
**배포**: nginx + 정적 HTML 추가 → docker build + deploy  
**앱 빌드**: 불필요

### 목표 UX (Wanderlog 방식)

```
공유 링크 접속 (iPhone Safari / Android Chrome / PC 브라우저)
         ↓
share.html 정적 페이지 로드
         ↓
JS로 /api/share/{token} 호출 → 여행 데이터 fetch
         ↓
┌──────────────────────────────────┐
│  [앱 설치 배너: iOS/Android 분기]  │  ← 상단 고정
├──────────────────────────────────┤
│  📍 도쿄                          │
│  2026.06.10 — 2026.06.15 · 5일  │
│  활동 24개                         │
├──────────────────────────────────┤
│  Day 1 — 6월 10일                 │
│  09:00 도착 · 나리타 공항           │
│  12:00 점심 · 츠키지 시장           │
│  ...                              │
├──────────────────────────────────┤
│  [App Store / Play Store 버튼]    │  ← 하단 CTA
│  "myTravel 앱에서 직접 편집하세요"  │
└──────────────────────────────────┘
```

### 구현 방식

nginx에서 `/share/:token` 경로를 `share.html`로 서빙.  
`share.html`은 순수 HTML+CSS+JS로 작성 (React 빌드 불필요, 로딩 빠름).

#### nginx 추가 (frontend/nginx.conf)

```nginx
# /share/* — 공유 여행 웹 뷰어
location ~ ^/share/([a-f0-9]{32})$ {
    root /static-content;
    try_files /share.html =404;
    add_header Cache-Control "no-cache, must-revalidate" always;
}
```

#### share.html 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- OG 메타태그 (기본값 — JS로 여행 데이터 로드 후 동적 업데이트) -->
  <meta property="og:title" content="myTravel — 여행 일정 공유">
  <meta property="og:description" content="AI로 생성된 여행 일정을 확인하세요.">
  <meta property="og:image" content="https://mytravel-planner.com/assets/og-share.png">
  <title>myTravel — 여행 공유</title>
  <style>/* 인라인 CSS */</style>
</head>
<body>
  <!-- 앱 배너 (UA 기반 iOS/Android 분기) -->
  <div id="app-banner">...</div>
  
  <!-- 여행 내용 영역 -->
  <div id="trip-content">
    <div id="loading">...</div>
    <div id="trip-data" hidden>...</div>
    <div id="error" hidden>...</div>
  </div>

  <!-- 하단 앱 설치 CTA -->
  <div id="bottom-cta">...</div>

  <script>
    // 1. URL에서 토큰 추출
    const token = location.pathname.split('/share/')[1];
    
    // 2. UA 기반 스토어 URL 결정
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const storeUrl = isIOS 
      ? 'https://apps.apple.com/app/id??????'
      : 'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner';
    
    // 3. API 호출로 여행 데이터 fetch
    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(data => renderTrip(data))
      .catch(() => showError());
    
    // 4. 여행 데이터 렌더링
    function renderTrip(trip) { ... }
  </script>
</body>
</html>
```

### OG 태그 (카카오톡/문자 공유 시 썸네일)

현재 SPA fallback의 OG 태그는 고정값. `share.html`은 JS 로드 전에 기본 OG 태그를 포함시키고,
카카오톡 등 크롤러는 JS를 실행하지 않으므로 백엔드에서 SSR OG를 제공하는 것이 이상적이나
우선 기본 이미지로 진행 후 추후 개선.

---

## P3 — 딥링크 `/share` 경로 등록

**예상 소요**: 1~2시간  
**배포**: 서버(`.well-known` 파일) + 앱 리빌드 + 스토어 제출  
**앱 빌드**: Android AAB, iOS IPA 모두 필요

### 목표

앱이 설치된 사용자가 공유 링크를 클릭하면 브라우저 대신 앱이 자동으로 열리며 `SharedTripViewScreen`으로 이동.

### 3-1. Android App Links

**파일**: `frontend/public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.longpapa82.travelplanner",
      "sha256_cert_fingerprints": [
        "E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A"
      ]
    }
  }
]
```

→ `pathPrefix: "/share"` 추가는 **`app.json`의 intentFilters**에서 처리.

**파일**: `frontend/app.json` — intentFilters에 `/share` 추가

```json
"intentFilters": [
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [
      { "scheme": "travelplanner" },
      { "scheme": "https", "host": "mytravel-planner.com", "pathPrefix": "/auth" },
      { "scheme": "https", "host": "mytravel-planner.com", "pathPrefix": "/app" },
      { "scheme": "https", "host": "mytravel-planner.com", "pathPrefix": "/share" }
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```

### 3-2. iOS Universal Links

**파일**: `proxy/static-well-known/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "VC5L9S5QPX.com.longpapa82.travelplanner",
        "paths": ["/auth/*", "/app/*", "/share/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["VC5L9S5QPX.com.longpapa82.travelplanner"]
  }
}
```

`app.json`의 `ios.associatedDomains`는 이미 `applinks:mytravel-planner.com`으로 설정되어 있으므로 추가 변경 불필요.

### 3-3. RootNavigator 링크 설정 확인

`frontend/src/navigation/RootNavigator.tsx`의 linking config에 이미 `SharedTrip: { path: 'share/:shareToken' }`가 등록되어 있으므로 추가 변경 불필요.

### P3 배포 순서

```
1. assetlinks.json 수정 → 서버 배포 (즉시 반영)
2. apple-app-site-association 수정 → 서버 배포 (즉시 반영)
3. app.json intentFilters 수정 → Android AAB 빌드 → Play Console 제출
4. iOS는 associatedDomains 변경 없으므로 app.json 변경 없음
   → 단, AASA 캐시 갱신을 위해 IPA 리빌드 권장 (B59)
```

---

## 전체 작업 순서

```
Step 1 (P1)  WebAppRedirectScreen iOS 분기 수정       30분
Step 2 (P1)  App Store 실제 ID 확인 및 URL 교체       10분
Step 3 (P1)  docker build + 서버 배포 (33차)         10분
Step 4 (P1)  iPhone Safari에서 테스트 확인            10분
             ↓ 완료
Step 5 (P2)  share.html 작성                         3시간
Step 6 (P2)  nginx /share/* 라우팅 추가              10분
Step 7 (P2)  docker build + 서버 배포 (34차)         10분
Step 8 (P2)  모바일/데스크톱 브라우저에서 테스트        30분
             ↓ 완료
Step 9  (P3)  assetlinks.json에 /share 추가          10분
Step 10 (P3)  apple-app-site-association에 /share 추가  10분
Step 11 (P3)  서버 배포 (35차)                        10분
Step 12 (P3)  app.json intentFilters에 /share 추가   10분
Step 13 (P3)  Android AAB 빌드 (versionCode 250?)    30분
Step 14 (P3)  Play Console 알파 → 프로덕션 제출        10분
Step 15 (P3)  iOS B59 빌드 (AASA 캐시 갱신용)         30분
Step 16 (P3)  딥링크 동작 검증                        30분
```

---

## 확인 필요 사항

1. **App Store 실제 ID**: B58 출시 완료 후 ASC에서 앱 ID 확인
   - 확인 위치: App Store Connect → 앱 정보 → Apple ID
   - 현재 placeholder: `id0000000000`

2. **P3 앱 빌드 타이밍**: P1, P2는 서버 배포만으로 완료. P3는 앱 리빌드 필요.
   - Android: versionCode bump 후 AAB 빌드
   - iOS: B59 빌드 (기능 변경 없이 AASA 연동 갱신)

---

## 전체 우선순위 요약

| 순서 | 작업 | 소요 | 앱 빌드 | 비고 |
|------|------|------|---------|------|
| **P1** | iOS 스토어 분기 버그 수정 | 30분 | 불필요 | 즉시 가능 |
| **P2** | 웹 뷰어 (share.html) | 4~6시간 | 불필요 | 서버 배포만 |
| **P3** | 딥링크 /share 경로 등록 | 1~2시간 | Android+iOS | 앱 리빌드 필요 |

**공유 권한**: 읽기 전용으로 고정 (별도 구현 없음)  
**진행 순서**: P1 → P2 → P3

---

## 테스트 체크리스트

### P1 완료 기준
- [ ] iPhone Safari에서 공유 링크 접속 → "App Store에서 앱 받기" 표시
- [ ] Android Chrome에서 공유 링크 접속 → "Play 스토어에서 앱 받기" 표시
- [ ] PC 브라우저에서 접속 → "Play 스토어에서 앱 받기" 표시 (Android 기본값)

### P2 완료 기준
- [ ] 공유 링크 접속 시 여행 목적지, 날짜, 일수, 활동 목록 표시
- [ ] 상단 앱 배너가 iOS/Android별로 올바른 스토어로 연결
- [ ] 잘못된 토큰 접속 시 에러 메시지 표시
- [ ] 만료된 링크 접속 시 만료 메시지 표시
- [ ] 카카오톡으로 링크 공유 시 OG 이미지/제목 표시

### P3 완료 기준
- [ ] Android 앱 설치 상태에서 공유 링크 클릭 → 앱이 자동 열리며 SharedTripViewScreen 표시
- [ ] iOS 앱 설치 상태에서 공유 링크 클릭 → 앱이 자동 열리며 SharedTripViewScreen 표시
- [ ] 앱 미설치 상태에서 공유 링크 클릭 → P2 웹 뷰어 표시 (딥링크 폴백)
