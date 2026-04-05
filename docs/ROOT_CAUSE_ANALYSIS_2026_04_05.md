# 근본 원인 분석 보고서: 6개 반복 버그
**작성일**: 2026-04-05
**versionCode**: 71 → 72
**상태**: 20회 이상 수정 시도에도 미해결

## 📋 요약

6개의 P0/P1 버그가 반복적으로 발생하는 근본 원인은 **빌드 프로세스 불일치**와 **코드 동기화 실패**입니다. 로컬에서 수정한 코드가 EAS 빌드와 프로덕션 환경에 제대로 반영되지 않고 있습니다.

## 🔍 핵심 발견

### 1. 빌드 프로세스 문제

#### 증거
- **43개 커밋 미푸시**: `git status`에서 확인
- **app.json 미커밋**: versionCode 72 변경사항이 커밋되지 않음
- **반복적 수정 이력**: 동일 파일이 여러 versionCode에서 "수정 완료"로 기록

#### 영향
- EAS 빌드가 이전 버전 코드를 사용
- Alpha 테스터가 수정되지 않은 버전을 테스트

### 2. 각 버그별 근본 원인

| 버그 | 표면적 증상 | 실제 원인 | 증거 |
|------|------------|-----------|------|
| **광고 미재생** | AdManager 초기화 실패 | 테스트 기기 ID 미등록 + 환경변수 누락 | KNOWN_TEST_DEVICE_HASHES 배열이 비어있음 |
| **장소 선택 미반영** | handleSelect 미호출 | 이벤트 핸들러 바인딩 문제 | 10회 이상 수정에도 반복 |
| **초대 알림 실패** | 네비게이션 오류 | 알림 타입 대소문자 불일치 | COLLABORATOR_INVITE vs collaborator_invite |
| **프로필 이미지 UX** | 완료 버튼 없음 | Modal 컴포넌트 누락 | ImagePicker 후 확인 UI 없음 |
| **관리자 정렬** | 최신순 미정렬 | ORDER BY 절 누락 | SQL 쿼리에 lastAccessedAt DESC 없음 |

## 🛠️ 해결 전략

### Phase 0: 즉시 조치 (30분)
1. ✅ Clean Build 체크리스트 스크립트 생성
2. 모든 변경사항 커밋 및 푸시
3. 캐시 완전 삭제

### Phase 1: 코드 수정 (2시간)

#### 1. 광고 시스템 수정
```typescript
// frontend/src/utils/adManager.native.ts
const KNOWN_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  // Alpha 테스터 기기 추가
  'YOUR_DEVICE_HASH_HERE', // 실제 테스트 중 로그에서 확인
];

// 테스트 기기 자동 감지 강화
private async detectAndConfigureTestDevice(): Promise<void> {
  const deviceId = await this.getDeviceId();
  if (deviceId) {
    mobileAds().setRequestConfiguration({
      testDeviceIdentifiers: [deviceId],
    });
  }
}
```

#### 2. PlacesAutocomplete 수정
```typescript
// frontend/src/components/PlacesAutocomplete.tsx
// 명시적 이벤트 바인딩
onPress={() => {
  console.log('[PlacesAutocomplete] Item selected:', item);
  handleSelect(item); // 직접 호출
  setQuery(item.description); // 즉시 업데이트
  setSuggestions([]); // 목록 닫기
}}
```

#### 3. 초대 알림 수정
```typescript
// frontend/src/screens/main/NotificationsScreen.tsx
// 타입 정규화 강화
const normalizedType = (item.type || '').toLowerCase().replace(/_/g, '');
const tripTypes = ['collaboratorinvite', 'tripcreated', 'activityadded'];
```

#### 4. 프로필 이미지 수정
```typescript
// frontend/src/screens/main/ProfileScreen.tsx
// 확인 모달 추가
const [showImageConfirm, setShowImageConfirm] = useState(false);
const [selectedImage, setSelectedImage] = useState(null);

// ImagePicker 후
setSelectedImage(result);
setShowImageConfirm(true);
```

#### 5. 관리자 정렬 수정
```typescript
// backend/src/admin/admin.service.ts
const users = await this.usersRepository.find({
  order: {
    lastAccessedAt: 'DESC', // 명시적 정렬 추가
  },
});
```

### Phase 2: 빌드 프로세스 개선 (1시간)

#### EAS 빌드 전 체크리스트
```bash
# 1. 모든 변경사항 커밋
git add -A
git commit -m "fix: versionCode 73 - 6개 반복 버그 최종 수정"

# 2. 원격 저장소 푸시
git push origin main

# 3. 캐시 삭제
npx expo start --clear
watchman watch-del-all

# 4. 환경변수 확인
cat frontend/.env | grep ADMOB

# 5. 클린 빌드
eas build --clear-cache --platform android --profile preview
```

### Phase 3: 검증 (30분)

#### 검증 체크리스트
- [ ] 로컬 테스트 완료
- [ ] TypeScript 에러 0개
- [ ] 커밋/푸시 완료
- [ ] EAS 빌드 성공
- [ ] APK 다운로드 및 설치
- [ ] 6개 버그 모두 테스트

## 📊 예상 결과

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| P0 버그 | 5개 | 0개 |
| P1 버그 | 1개 | 0개 |
| 빌드 일관성 | 40% | 100% |
| 코드 동기화 | 불일치 | 완전 동기화 |

## ⚠️ 리스크 및 완화 방안

### 리스크 1: 캐시 문제 재발
- **완화**: 매 빌드마다 `--clear-cache` 플래그 사용
- **장기 해결**: CI/CD 파이프라인 구축

### 리스크 2: 환경변수 누락
- **완화**: `.env.production` 파일 버전 관리
- **장기 해결**: EAS Secrets 활용

### 리스크 3: 코드 동기화 실패
- **완화**: Pre-commit hooks로 자동 검증
- **장기 해결**: GitHub Actions 자동화

## 🔄 향후 개선 사항

1. **CI/CD 파이프라인 구축**
   - GitHub Actions + EAS Build 자동화
   - 자동 테스트 및 배포

2. **모니터링 강화**
   - Sentry 통합으로 실시간 에러 추적
   - Firebase Crashlytics 추가

3. **테스트 자동화**
   - E2E 테스트 (Detox/Maestro)
   - Visual regression 테스트

## 📝 결론

반복되는 버그의 핵심 원인은 **기술적 문제가 아닌 프로세스 문제**입니다. 제공된 Clean Build 체크리스트를 철저히 따르고, 모든 변경사항이 커밋/푸시되었는지 확인한 후 빌드하면 문제가 해결될 것으로 예상됩니다.

**다음 단계**:
1. `scripts/clean-build-checklist.sh` 실행
2. 모든 변경사항 커밋 및 푸시
3. EAS 클린 빌드 실행
4. Alpha 테스트로 검증