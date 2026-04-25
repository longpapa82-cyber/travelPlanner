# 즉시 실행 계획: 6개 반복 버그 해결
**실행 시간**: 2026-04-05
**목표**: versionCode 73으로 모든 P0 버그 해결

## 🚨 즉시 실행 (지금 바로!)

### Step 1: Clean Build 체크리스트 실행 (5분)
```bash
cd /Users/hoonjaepark/projects/travelPlanner
./scripts/clean-build-checklist.sh
```

### Step 2: 긴급 코드 수정 (30분)

#### 2.1 광고 테스트 기기 추가
```bash
# Alpha 테스터 기기 해시 수집 후 추가
# frontend/src/utils/adManager.native.ts 수정
```

#### 2.2 PlacesAutocomplete 이벤트 핸들러 수정
```typescript
// frontend/src/components/PlacesAutocomplete.tsx
// Line 89-95 부근
onPress={() => {
  console.log('[PlacesAutocomplete] Direct selection:', item);
  if (handleSelect && typeof handleSelect === 'function') {
    handleSelect(item);
    setQuery(item.description);
    setSuggestions([]);
    Keyboard.dismiss();
  }
}}
```

#### 2.3 초대 알림 타입 정규화
```typescript
// frontend/src/screens/main/NotificationsScreen.tsx
// Line 45-50 부근
const normalizedType = (item.type || '')
  .toLowerCase()
  .replace(/_/g, '')
  .trim();

const tripTypes = [
  'collaboratorinvite',
  'tripcreated',
  'activityadded'
];

if (tripTypes.includes(normalizedType) && item.data?.tripId) {
  // Navigate to trip
}
```

#### 2.4 프로필 이미지 확인 모달
```typescript
// frontend/src/screens/main/ProfileScreen.tsx
// ImagePicker 성공 후
Alert.alert(
  '프로필 사진 변경',
  '이 사진으로 프로필을 변경하시겠습니까?',
  [
    { text: '취소', style: 'cancel' },
    {
      text: '확인',
      onPress: () => uploadProfileImage(result.assets[0])
    }
  ]
);
```

#### 2.5 관리자 사용자 정렬
```typescript
// backend/src/admin/admin.service.ts
// getAllUsers 메서드
const users = await this.usersRepository.find({
  order: {
    lastAccessedAt: 'DESC',
  },
  select: [...],
});
```

### Step 3: 커밋 및 푸시 (5분)
```bash
# 모든 변경사항 확인
git status

# 변경사항 추가
git add -A

# 커밋 (중요!)
git commit -m "fix: versionCode 73 - Final fix for 6 recurring P0 bugs

- Fix AdMob test device configuration
- Fix PlacesAutocomplete event handler binding
- Normalize invitation notification types
- Add profile image confirmation modal
- Fix admin user sorting by lastAccessedAt DESC

Resolves all P0 bugs from Alpha testing"

# 푸시 (필수!)
git push origin main
```

### Step 4: EAS 클린 빌드 (10분)
```bash
cd frontend

# 캐시 완전 삭제
rm -rf node_modules
npm install

# 환경변수 확인
cat .env | grep ADMOB

# versionCode 확인
grep versionCode app.json

# EAS 클린 빌드
eas build --clear-cache --platform android --profile preview
```

### Step 5: 검증 체크리스트 (빌드 완료 후)

#### 5.1 APK 설치 및 테스트
```bash
# APK 다운로드
eas build:list --platform android
# 최신 빌드 URL에서 다운로드

# 테스트 기기에 설치
adb install app-preview.apk
```

#### 5.2 6개 버그 검증
- [ ] **광고 보기 버튼**: 클릭 시 광고 재생 확인
- [ ] **광고 표시**: 앱 실행 시 배너/전면 광고 확인
- [ ] **장소 선택**: 자동완성에서 선택 시 필드 업데이트 확인
- [ ] **초대 알림**: 알림 클릭 시 여행 상세 화면 이동 확인
- [ ] **프로필 이미지**: 선택 후 확인 모달 표시 확인
- [ ] **관리자 정렬**: 최근 접속순 정렬 확인

## 📊 예상 타임라인

| 시간 | 작업 | 상태 |
|------|------|------|
| 00:00-00:05 | Clean Build 체크리스트 | ⏳ |
| 00:05-00:35 | 코드 수정 | ⏳ |
| 00:35-00:40 | 커밋 & 푸시 | ⏳ |
| 00:40-00:50 | EAS 빌드 시작 | ⏳ |
| 01:00-01:30 | 빌드 대기 | ⏳ |
| 01:30-02:00 | APK 테스트 | ⏳ |

## ⚠️ 중요 체크포인트

### ✅ 성공 기준
- Git: 43개 커밋 모두 푸시됨
- versionCode: 73으로 증가
- Build: --clear-cache 플래그 사용
- Test: 6개 버그 모두 해결됨

### ❌ 실패 시 대응
1. 캐시 문제: `watchman watch-del-all` 추가 실행
2. 빌드 실패: `eas build:cancel` 후 재시도
3. 버그 재발: 로그 수집 후 근본 원인 재분석

## 📞 에스컬레이션

문제 지속 시:
1. EAS 빌드 로그 전체 수집
2. 테스트 기기 adb logcat 수집
3. Backend 서버 로그 확인
4. 필요시 원격 디버깅 세션

---

**다음 단계**: 위 계획을 순서대로 실행하세요. 가장 중요한 것은 **모든 변경사항을 커밋하고 푸시**하는 것입니다!