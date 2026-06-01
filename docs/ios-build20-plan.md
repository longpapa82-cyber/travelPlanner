# iOS Build 20 — 작업 이어하기

> 작성일: 2026-05-06 18:41  
> 목적: 다음 세션에서 즉시 이어할 수 있도록 현황 + 할 일 정리

---

## 현재 상태 요약

| 항목 | 상태 |
|------|------|
| 현재 빌드 | B19 (buildNumber='19') — TestFlight 등록 완료 |
| 다음 빌드 목표 | B20 (buildNumber='20') |
| 계획 문서 | `iOStest.md` (B20 전체 수정/검수 계획 포함) |
| 브랜치 | `main` |

---

## B19 테스트 결과 요약

| 이슈 | 상태 | 비고 |
|------|------|------|
| 키보드 흰색 박스 오버레이 | ✅ 해결 (B19) | `keyboardVerticalOffset=0` |
| 카카오 취소 무한 로딩 | ✅ 해결 (B19) | 5초 타임아웃 + 500ms resolve |
| 스플래시 배경색 | ⚠️ 부분 해결 | 색은 적용됐으나 아이콘 사각형 테두리 잔존 |
| 비밀번호 저장 팝업 | ❌ 미해결 | textContentType 수정 필요 |
| 카카오 앱 복귀 | 🚫 수정 불가 | SDK 레벨 제한 (공식 문서화 완료) |

---

## B20에서 해야 할 작업 (순서대로)

### Step 1. splash-icon.png 재생성

**파일**: `frontend/assets/splash-icon.png`

**문제 원인**: `icon.png` 모서리 픽셀 alpha=255, 색상 `(78,128,239)` ≠ 캔버스 배경 `(74,144,217)` → 사각형 경계 보임

**수정 방법**: Python PIL로 icon 내부 파란 배경 픽셀을 캔버스 색 `#4A90D9`로 교체 후 재합성

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend/assets
python3 << 'PYEOF'
from PIL import Image

BG_COLOR = (74, 144, 217, 255)  # #4A90D9
canvas = Image.new('RGBA', (1284, 2778), BG_COLOR)

icon = Image.open('icon.png').convert('RGBA')

# icon 내부의 파란 배경 픽셀을 캔버스 배경색으로 교체
pixels = icon.load()
for y in range(icon.height):
    for x in range(icon.width):
        r, g, b, a = pixels[x, y]
        if a > 200 and r < 120 and g < 170 and b > 180:
            pixels[x, y] = BG_COLOR

target_size = int(1284 * 0.40)  # 513px
icon_resized = icon.resize((target_size, target_size), Image.LANCZOS)

cx = (1284 - target_size) // 2
cy = (2778 - target_size) // 2
canvas.paste(icon_resized, (cx, cy), icon_resized)
canvas.save('splash-icon.png')
print(f"Done: 1284x2778, icon {target_size}x{target_size} at ({cx},{cy})")
PYEOF
```

**검증**: 생성 후 모서리 픽셀 확인
```python
from PIL import Image
img = Image.open('splash-icon.png').convert('RGBA')
print("corner:", img.getpixel((0, 0)))  # 기대값: (74, 144, 217, 255)
```

---

### Step 2. LoginScreen.tsx 비밀번호 필드 수정

**파일**: `frontend/src/screens/auth/LoginScreen.tsx`

**문제 원인**: `textContentType="password"`가 iOS 17+에서 Keychain 저장 팝업 활성화

**수정 내용**: 비밀번호 TextInput에서

```diff
- textContentType="password"
+ textContentType="oneTimeCode"
  autoComplete="off"
```

> 이메일 필드는 `textContentType="emailAddress"` 유지

---

### Step 3. app.config.js buildNumber 업데이트

**파일**: `frontend/app.config.js`

```diff
- buildNumber: '19',
+ buildNumber: '20',
```

---

### Step 4. EAS 로컬 빌드

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend
eas build --platform ios --profile production-ios --local --output ../build-ios-20.ipa
```

> ⚠️ EAS 원격 빌드 크레딧 소진 상태 → 반드시 `--local` 옵션 사용

---

### Step 5. TestFlight 업로드

```bash
xcrun altool --upload-app \
  --type ios \
  --file /Users/hoonjaepark/projects/travelPlanner/build-ios-20.ipa \
  --username longpapa82@gmail.com \
  --password zicp-yjik-qmwm-xqpy
```

> Apple ID: longpapa82@gmail.com  
> 앱 암호: zicp-yjik-qmwm-xqpy (키체인 AC_PASSWORD)

---

## 완료 후 테스트 체크리스트

- [ ] TestFlight B20 설치 (이전 앱 삭제 후 재설치)
- [ ] 스플래시: 배경 `#4A90D9`, 아이콘 사각형 테두리 없음, 흰 깜빡임 없음
- [ ] 이메일 로그인 → 비밀번호 저장 팝업 없음
- [ ] 이메일 로그인 → 홈 화면 이동 확인
- [ ] 카카오 취소 → 1초 이내 로딩 해제
- [ ] 카카오 로그인 → 수정 불가 항목 (정상으로 처리)
- [ ] 구글/애플 로그인 → 정상 확인
- [ ] 키보드 오버레이 없음 확인

---

## 참고: 수정 불가 항목 최종 정리

**카카오 로그인 후 앱 복귀 불가**
- 원인: 카카오 웹 OAuth 방식에서 카카오톡 앱이 딥링크 redirect를 내부 처리
- 해결 조건: `@react-native-kakao/user` 공식 SDK 도입 필요 (현 작업 범위 외)
- 현재 동작: 카카오톡 앱에서 확인 후 홈버튼으로 myTravel 복귀 시 로그인 완료 상태

---

## 관련 파일 경로

| 파일 | 경로 |
|------|------|
| 전체 B20 수정/검수 계획 | `/Users/hoonjaepark/projects/travelPlanner/iOStest.md` |
| 앱 설정 | `frontend/app.config.js` |
| 로그인 화면 | `frontend/src/screens/auth/LoginScreen.tsx` |
| OAuth 서비스 | `frontend/src/services/oauth.service.ts` |
| 스플래시 이미지 | `frontend/assets/splash-icon.png` |
| EAS 설정 | `frontend/eas.json` |
