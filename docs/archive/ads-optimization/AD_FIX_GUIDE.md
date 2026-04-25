# P0 광고 버그 수정 가이드 (versionCode 53)

## 문제 요약
Alpha 테스트에서 광고가 전혀 표시되지 않는 치명적 버그 (10회 이상 수정 시도 실패)

## 근본 원인 분석

### 🔴 식별된 5가지 근본 원인:

1. **테스트 기기 미설정**: Alpha 테스터 기기 해시가 설정되지 않음
2. **초기화 경쟁 상태**: AdManager가 두 곳에서 중복 초기화 (initAds + useRewardedAd)
3. **기기 해시 수집 불가**: 테스터 기기 해시를 수집할 메커니즘 없음
4. **SDK 초기화 누락**: AdManager에서 mobileAds SDK를 제대로 import하지 않음
5. **에러 복구 미흡**: 광고 실패 시 적절한 폴백 메커니즘 부재

## 수정 내용

### 1. AdManager 전면 개선 (`src/utils/adManager.native.ts`)
- ✅ mobileAds SDK proper import 추가
- ✅ 싱글톤 패턴으로 중복 초기화 방지
- ✅ 기기 해시 자동 추출 및 로깅
- ✅ 포괄적 에러 핸들링 및 복구 로직
- ✅ 상세한 디버깅 로그 추가
- ✅ 광고 실패 시 자동 폴백 (보상은 항상 지급)

### 2. SDK 초기화 개선 (`src/utils/initAds.native.ts`)
- ✅ 단일 초기화 포인트로 경쟁 상태 제거
- ✅ 테스트 기기 설정 강화
- ✅ 기기 해시 자동 감지 및 안내
- ✅ 초기화 실패 시 상세 진단 정보 제공

### 3. 디버깅 도구 추가
- ✅ `src/utils/adDebugger.ts`: 광고 진단 유틸리티
- ✅ `src/screens/debug/AdDebugScreen.tsx`: Alpha 테스터용 디버그 화면

## Alpha 테스터 가이드

### 테스트 기기 설정 방법:

1. **앱 실행 후 콘솔 로그 확인**
   ```
   [AdMob] 🔑 DEVICE HASH DETECTED: [32자리 해시]
   ```

2. **기기 해시를 코드에 추가**
   ```typescript
   // src/utils/initAds.native.ts
   const ALPHA_TEST_DEVICE_HASHES: string[] = [
     'EMULATOR',
     'SIMULATOR',
     'YOUR_DEVICE_HASH_HERE', // <- 여기에 추가
   ];
   ```

3. **앱 다시 빌드**
   ```bash
   eas build --profile preview --platform android
   ```

### 디버그 화면 사용법:

1. 앱에서 디버그 화면 접근 (개발자 메뉴 또는 설정)
2. "Current Status" 섹션에서 상태 확인
3. Device Hash가 표시되면 복사
4. "Test Configuration" 버튼으로 설정 검증
5. "Test Rewarded Ad" 버튼으로 광고 테스트

## 검증 체크리스트

### 개발자 확인사항:
- [ ] TypeScript 컴파일 에러 없음
- [ ] Jest 테스트 통과
- [ ] 콘솔에 광고 초기화 성공 로그 확인
- [ ] 디버그 화면에서 SDK Initialized: YES

### Alpha 테스터 확인사항:
- [ ] 기기 해시 확인 및 등록
- [ ] 광고 버튼 클릭 시 광고 표시 또는 보상 지급
- [ ] 에러 발생 시 콘솔 로그 수집

## 로그 수준별 의미

### 🚀 초기화
```
[AdMob] 🚀 Starting comprehensive AdMob initialization...
[AdManager] 🚀 Singleton instance created
```

### ✅ 성공
```
[AdMob] ✅ AdMob SDK initialized successfully
[AdManager] ✅ Rewarded ad loaded successfully
```

### ❌ 에러
```
[AdManager] ❌ Rewarded ad error: [에러 메시지]
[AdMob] ❌ AdMob initialization failed: [에러]
```

### 🔑 기기 해시
```
[AdMob] 🔑 DEVICE HASH DETECTED: [해시]
[AdManager] 🔑 Device hash detected: [해시]
```

### ℹ️ 진단 정보
```
[AdManager] ℹ️ No ads available. Common causes:
[AdManager] ℹ️ Network issue. Check:
```

## 일반적인 문제 해결

### 문제 1: "No fill" 에러
**원인**: 광고 인벤토리 부족
**해결**:
- 24-48시간 대기 (새 광고 단위 활성화 시간)
- VPN으로 다른 지역에서 테스트
- 테스트 기기로 등록하여 테스트 광고 사용

### 문제 2: 기기 해시가 로그에 안 나타남
**원인**: 광고 요청이 실패하여 해시를 받지 못함
**해결**:
- 네트워크 연결 확인
- AdMob 앱 ID가 올바른지 확인
- app.config.js의 설정 확인

### 문제 3: 테스트 광고도 안 나옴
**원인**: SDK 초기화 실패
**해결**:
- 빌드 로그에서 에러 확인
- react-native-google-mobile-ads 설치 확인
- iOS의 경우 pod install 실행

## 배포 전 최종 확인

1. **코드 검증**
   ```bash
   cd frontend
   npx tsc --noEmit
   npm test
   ```

2. **빌드 생성**
   ```bash
   eas build --profile production --platform android
   ```

3. **Alpha 트랙 배포**
   - Google Play Console에서 Alpha 트랙 업로드
   - 라이선스 테스터 초대
   - 24시간 테스트 후 프로덕션 배포

## 예상 결과

### 즉시 해결되는 문제:
- ✅ 광고 초기화 실패
- ✅ 중복 초기화로 인한 충돌
- ✅ 에러 발생 시 앱 크래시
- ✅ 보상 미지급 문제

### 테스터 설정 후 해결:
- ✅ Alpha 테스터 광고 표시
- ✅ 테스트 광고 정상 작동

### 프로덕션 배포 후 해결:
- ✅ 일반 사용자 광고 표시
- ✅ 수익 발생

## 연락처

문제 발생 시:
1. 콘솔 로그 전체 수집
2. 디버그 화면에서 "Copy Debug Info" 실행
3. 개발팀에 전달

---

**작성일**: 2026-04-04
**버전**: versionCode 53
**상태**: 수정 완료, 빌드 대기