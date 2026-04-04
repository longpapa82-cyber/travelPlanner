# versionCode 61 최종 검수 계획

## 1. 자동화 테스트 (Auto-QA)

### TypeScript & Linting
```bash
# Frontend
cd frontend
npm run typecheck
npm run lint

# Backend
cd ../backend
npm run typecheck
npm run lint
```

### 단위 테스트
```bash
# Frontend (Jest)
cd frontend
npm test -- --coverage --watchAll=false

# Backend (Jest)
cd ../backend
npm test -- --coverage
```

### E2E 테스트 (Playwright)
```bash
# 새로운 E2E 테스트 추가
cd frontend
npm run test:e2e -- --project=mobile --grep="@critical"
```

## 2. Playwright E2E 테스트 시나리오

### Critical Path Testing
```typescript
// tests/e2e/critical-paths.spec.ts

test.describe('광고 시스템', () => {
  test('보상형 광고 표시 및 보상 지급', async ({ page }) => {
    await page.goto('/trip/123');
    await page.click('[data-testid="reward-ad-button"]');
    await page.waitForSelector('[data-testid="ad-container"]');
    // 테스트 광고 표시 확인
    await expect(page.locator('[data-testid="test-ad-label"]')).toBeVisible();
  });
});

test.describe('위치 선택', () => {
  test('자동완성 선택이 입력 필드에 반영', async ({ page }) => {
    await page.goto('/activity/edit');
    const input = page.locator('[data-testid="location-input"]');

    await input.type('서울');
    await page.waitForSelector('[data-testid="places-dropdown"]');

    await page.click('[data-testid="place-option-0"]');

    // 선택한 값이 입력 필드에 반영되었는지 확인
    await expect(input).toHaveValue(/서울/);

    // 저장 후 재로드 시에도 유지되는지 확인
    await page.click('[data-testid="save-button"]');
    await page.reload();
    await expect(input).toHaveValue(/서울/);
  });
});

test.describe('권한 관리', () => {
  test('Viewer 권한 사용자는 수정/삭제 불가', async ({ page }) => {
    // Viewer 계정으로 로그인
    await loginAsViewer(page);

    await page.goto('/trip/shared-123');

    // 수정/삭제 버튼이 표시되지 않아야 함
    await expect(page.locator('[data-testid="edit-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="delete-button"]')).not.toBeVisible();
  });
});
```

## 3. 수동 테스트 체크리스트

### P0 - Critical (반드시 통과)
- [ ] **광고 표시**
  - [ ] "광고 보고 상세 여행 인사이트 받기" 버튼 클릭
  - [ ] 테스트 광고 표시 확인 (Google Test Ad 라벨)
  - [ ] 광고 완료 후 인사이트 표시 확인

- [ ] **위치 선택**
  - [ ] 활동 편집 화면에서 위치 입력
  - [ ] 자동완성 목록에서 선택
  - [ ] 선택한 위치가 입력란에 표시됨
  - [ ] 저장 후 재진입 시 위치 유지됨

- [ ] **권한 표시**
  - [ ] Owner: 모든 기능 사용 가능
  - [ ] Editor: 수정 가능, 삭제 불가
  - [ ] Viewer: 보기만 가능 (수정/삭제 버튼 없음)

### P1 - High (주요 기능)
- [ ] **스크롤**
  - [ ] 여행 상세 화면 상하 스크롤 정상 동작
  - [ ] 긴 목록에서도 부드럽게 스크롤

- [ ] **초대 UI**
  - [ ] 이메일 입력 시 키보드가 입력란 가리지 않음
  - [ ] 자동완성 선택 시 키보드 자동 닫힘
  - [ ] 초대 성공 시 모달 자동 닫힘

### P2 - Medium (부가 기능)
- [ ] **프로필 이미지**
  - [ ] 갤러리에서 이미지 선택
  - [ ] 선택한 이미지 미리보기
  - [ ] 저장 및 표시

## 4. 성능 모니터링

### 메모리 사용량
```bash
# Android Studio Profiler 또는 React DevTools
# 목표: 메모리 누수 없음, 300MB 이하 유지
```

### 네트워크 요청
```bash
# Chrome DevTools Network 탭
# 확인 사항:
# - API 중복 호출 없음
# - 실패한 요청 재시도 로직 동작
# - 광고 SDK 초기화 성공
```

## 5. 회귀 테스트

### 이전 버전 주요 기능
- [ ] 로그인/로그아웃
- [ ] 여행 생성/수정/삭제
- [ ] 활동 추가/편집
- [ ] AI 일정 생성
- [ ] 공유 링크 생성 및 접근
- [ ] 구독 결제 (테스트 카드)

## 6. 롤백 계획

### 심각한 문제 발생 시
```bash
# 1. 이전 버전 APK 준비 (versionCode 60)
ls -la ~/Downloads/travelplanner-v60.apk

# 2. Play Console에서 롤백
# - Production 트랙 → Release Dashboard
# - "Create new release" → Upload v60 APK
# - Staged rollout 1% → Monitor → Increase

# 3. 핫픽스 브랜치 생성
git checkout -b hotfix/v61-critical
git cherry-pick <fix-commits>
```

## 7. 모니터링 지표

### Play Console Vitals
- **ANR Rate**: < 0.5%
- **Crash Rate**: < 1%
- **Excessive Wakeups**: < 10/hour
- **Stuck Wake Locks**: 0

### 사용자 피드백
- Alpha 테스터 Slack 채널 모니터링
- Play Store 리뷰 실시간 확인
- 앱 내 피드백 수집

## 8. Sign-off Criteria

### Go/No-Go 체크리스트
- [ ] P0 버그 0건
- [ ] P1 버그 2건 이하
- [ ] 자동 테스트 95% 이상 통과
- [ ] 수동 테스트 Critical 항목 100% 통과
- [ ] 메모리 누수 없음
- [ ] API 응답 시간 < 2초

### 승인자
- [ ] 개발 리드 검토
- [ ] QA 팀 승인
- [ ] 프로덕트 오너 최종 승인

## 9. 배포 후 모니터링 (24시간)

### 실시간 모니터링
```bash
# Backend 로그 모니터링
ssh root@46.62.201.127
docker logs -f travelplanner-backend-1 | grep ERROR

# 광고 성공률 모니터링
curl https://mytravel-planner.com/api/analytics/ad-metrics
```

### 알림 설정
- Crash rate > 2% → 즉시 알림
- Ad fill rate < 50% → 경고
- API error rate > 5% → 조사 시작

## 📅 타임라인

| 시간 | 활동 | 담당 |
|------|------|------|
| D-0 13:00 | 코드 수정 완료 | Dev |
| D-0 15:00 | 자동 테스트 완료 | QA |
| D-0 16:00 | 수동 테스트 완료 | QA |
| D-0 17:00 | EAS 빌드 시작 | Dev |
| D-0 18:00 | Alpha 배포 | Dev |
| D-0 19:00 | Alpha 테스터 검증 | Users |
| D+1 09:00 | 모니터링 리뷰 | Team |
| D+1 10:00 | Go/No-Go 결정 | PM |
| D+1 11:00 | Production 배포 | Dev |