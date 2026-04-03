# versionCode 54 긴급 수정 계획

## 🚨 문제 요약
versionCode 53이 v52의 수정사항 없이 빌드된 것으로 추정됨. 3개의 P0/P1 회귀 버그 발생.

## 📋 수정 목록

### Bug #1, #2: 광고 시스템 전체 실패 (P0)
**증상**:
- "광고 보고 상세 여행 인사이트 받기" 버튼 작동 안함
- 앱 전체에서 광고 미표시

**근본 원인 분석**:
1. useRewardedAd.native.ts가 빌드에 포함되지 않았거나
2. AdMob 초기화 실패
3. 테스트 디바이스 설정 문제

**해결 방안**:
1. 광고 시스템 완전 재초기화
2. Singleton 패턴으로 변경
3. 재시도 로직 강화
4. 실시간 디버그 로깅 추가

### Bug #3: 위치 자동완성 (3번째 회귀) (P1)
**증상**:
- "Dok" 입력 → 자동완성 표시 → 선택 → "Dok"만 표시 (선택 미반영)
- 사용자: "이 증상은 계속해서 반복적으로 해결되지 않고 있어"

**근본 원인 분석**:
1. Race condition이 완전히 해결되지 않음
2. 컴포넌트 재렌더링 문제
3. 이벤트 핸들러 바인딩 문제

**해결 방안**:
1. Uncontrolled component로 완전 재설계
2. useImperativeHandle로 외부 제어
3. 디바운싱 최적화
4. 상태 동기화 제거

### Bug #4: Paddle 데이터 정리 (P2)
**해결 방안**: 백엔드 마이그레이션으로 Paddle 관련 데이터 제거

### Bug #5: 웹 플랫폼 추적 (P2)
**해결 방안**: 정상 동작 - 문서화만 추가

## 🚀 즉시 실행 계획

### Phase 1: 캐시 클리어 및 재빌드 준비 (10분)
```bash
# 1. Metro 캐시 클리어
cd frontend
rm -rf node_modules/.cache
npx expo start --clear

# 2. EAS 캐시 클리어
eas build:cancel --all
rm -rf .expo
rm -rf android/.gradle
rm -rf ios/Pods

# 3. Git 상태 확인
git status
git log --oneline -5
```

### Phase 2: 광고 시스템 수정 (1시간)

### Phase 3: 위치 자동완성 재구현 (2시간)

### Phase 4: 테스트 빌드 (30분)
```bash
# 로컬 테스트
npx expo run:android

# 테스트 후 versionCode 54로 변경
# app.json: versionCode: 54
```

### Phase 5: EAS 빌드 및 배포 (1시간)
```bash
# 프로덕션 빌드
eas build --platform android --profile production --clear-cache

# Alpha 트랙 배포
eas submit --platform android --latest
```

## 📊 성공 기준
- [ ] 광고 보상 버튼이 광고를 표시함
- [ ] 위치 선택이 안정적으로 작동함
- [ ] v52의 모든 수정사항이 포함됨
- [ ] 회귀 테스트 통과

## ⏰ 예상 시간
- 총 소요 시간: 4-5시간
- Alpha 배포까지: 5시간
- 사용자 테스트 가능: 6시간 후

## 📝 사후 조치
1. EAS 빌드 프로세스 문서화
2. 빌드 체크리스트 작성
3. 자동화된 빌드 검증 스크립트 추가
4. 회귀 테스트 자동화