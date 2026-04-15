# V109 ~ V114 Regression Harness — 영구 회귀 방지

작성일: 2026-04-15
목적: 동일 이슈가 7번째로 재발하지 않도록 자동 regression 감지 체계 확립.

---

## 배경

V109~V114 Alpha 리포트에서 다음 이슈는 **각각 4~6회 재발**했음:

| 이슈 | 최초 보고 | 재발 횟수 | V115 근본 수정 |
|---|---|---|---|
| 코치마크 좌표 어긋남 | V107 | **6회** | `statusBarTranslucent` prop 추가 |
| 구독 회원 "월 30회" 포맷 | V107 | 5회 | 카운터 통일 `X/Y` |
| 이용동의 버튼 하단 밀착 | V109 | 4회 | jitNotice marginBottom + footer paddingTop |
| 계정 삭제 팝업 공백 | V107 | 4회 | modalContent minHeight 제거 |
| 개인정보 처리방침 중복 | V114 신규 | 1회 | privacy_optional 제거 + "(필수)" 텍스트 제거 |
| 수동 생성 시 1/3 오표기 | V107 | 4회 | preWarning 키 분리 + 카운터 정리 |

**공통 패턴**: 모든 수정이 "증상 패치"였고 자동 regression 감지 장치가 없어서 다음 수정에서 같은 파일을 건드리면 쉽게 회귀했음.

---

## Regression Harness 구조

### Layer 1 — Static invariants (컴파일/테스트 단계)

각 이슈에 대응하는 "절대 바뀌면 안 되는 사실"을 코드 레벨에서 assert.

#### 1.1 Jest 테스트 (frontend)

`frontend/src/components/tutorial/__tests__/CoachMark.regression.test.tsx` (신규):
```ts
import { render } from '@testing-library/react-native';
import CoachMark from '../CoachMark';

describe('V114-2a regression: CoachMark Modal status bar coord', () => {
  it('Modal always has statusBarTranslucent prop', () => {
    const { UNSAFE_getByType } = render(
      <CoachMark
        visible
        targetLayout={{ x: 0, y: 0, width: 100, height: 40 }}
        message="test"
        onNext={() => {}}
        onDismiss={() => {}}
      />
    );
    // Find the Modal and assert the prop exists
    const { Modal } = require('react-native');
    const modalEl = UNSAFE_getByType(Modal);
    expect(modalEl.props.statusBarTranslucent).toBe(true);
  });

  it('V114-2b regression: no Skip/Dismiss button in tooltip', () => {
    const { queryByText } = render(
      <CoachMark
        visible
        targetLayout={{ x: 0, y: 0, width: 100, height: 40 }}
        message="test"
        onNext={() => {}}
        onDismiss={() => {}}
      />
    );
    // '건너뛰기' (Korean for 'Skip') or English equivalent should not be present
    expect(queryByText(/건너뛰기|Skip/i)).toBeNull();
  });
});
```

`frontend/src/screens/consent/__tests__/ConsentScreen.regression.test.tsx` (신규):
```ts
import koConsent from '../../../i18n/locales/ko/consent.json';
import enConsent from '../../../i18n/locales/en/consent.json';
// ... 17개 언어

describe('V114-4c regression: privacy_optional removed from all languages', () => {
  const langs = { ko: koConsent, en: enConsent /* ... */ };
  for (const [lang, data] of Object.entries(langs)) {
    it(`${lang}: no privacy_optional entry`, () => {
      expect((data as any).types.privacy_optional).toBeUndefined();
    });
    it(`${lang}: privacy_required.title has no trailing (required) tag`, () => {
      const title = (data as any).types.privacy_required.title;
      expect(title).not.toMatch(/[（(][^）)]*[）)]\s*$/);
    });
  }
});
```

#### 1.2 Backend Jest

`backend/src/users/__tests__/consent-deprecated.spec.ts` (신규):
```ts
describe('V114-4c regression: PRIVACY_OPTIONAL not exposed in getConsentsStatus', () => {
  it('filters DEPRECATED_CONSENTS from response', async () => {
    const status = await service.getConsentsStatus(userId);
    const types = status.consents.map(c => c.type);
    expect(types).not.toContain(ConsentType.PRIVACY_OPTIONAL);
  });

  it('updateConsents silently ignores PRIVACY_OPTIONAL', async () => {
    await service.updateConsents(userId, {
      consents: [{ type: ConsentType.PRIVACY_OPTIONAL, isConsented: true }],
    });
    // Assert no row created for PRIVACY_OPTIONAL
    const rows = await consentRepository.find({
      where: { userId, consentType: ConsentType.PRIVACY_OPTIONAL },
    });
    expect(rows).toHaveLength(0);
  });
});
```

### Layer 2 — Integration tests

`backend/src/auth/__tests__/register-force.e2e-spec.ts` (신규):
```ts
describe('V114-8 regression: register-force rejects verified accounts', () => {
  it('returns 400 EMAIL_EXISTS for verified user', async () => {
    // Arrange: existing verified user
    await createUser({ email: 'verified@test.com', isEmailVerified: true });

    // Act
    const res = await request(app.getHttpServer())
      .post('/auth/register-force')
      .send({ email: 'verified@test.com', password: 'P@ssw0rd12', name: 'X', confirmReset: true });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('rejects missing confirmReset flag', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register-force')
      .send({ email: 'x@y.com', password: 'P@ssw0rd12', name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONFIRM_RESET_REQUIRED');
  });
});
```

### Layer 3 — Visual regression (Playwright)

웹 빌드가 `WebAppRedirectScreen` 한 장으로 대체됐으므로 **Expo web**이 아닌 **Expo Go + Android emulator**에서 Playwright Android를 돌리거나, 최소한 **screenshot golden file** 을 만든다.

`e2e/regression/v114.spec.ts` (신규 스케치):
```ts
test('V114-2a: coach mark spotlight covers AI button exactly', async ({ page }) => {
  await page.goto('http://android-emulator/'); // 이건 실제론 adb screencap로 대체
  // ...
});

test('V114-1: web login is blocked', async ({ page }) => {
  await page.goto('https://mytravel-planner.com/login');
  // Expect the WebAppRedirectScreen text, NOT a login form
  await expect(page.locator('text=MyTravel은 모바일 앱에서')).toBeVisible();
  await expect(page.locator('input[type=email]')).toHaveCount(0);
});

test('V114-1: reset-password path redirects to app', async ({ page }) => {
  await page.goto('https://mytravel-planner.com/app/reset?token=test');
  await expect(page.locator('text=비밀번호 재설정은 앱에서')).toBeVisible();
});
```

### Layer 4 — Manual QA checklist (Phase 12 직전)

`docs/v114/11-manual-smoke.md` (아래)에서 다루는 14개 재현 경로를 실기기에서 직접 돌려보는 smoke.

---

## CI 통합

`scripts/pre-release-check.sh` (신규):
```bash
#!/bin/bash
set -euo pipefail

echo "[1/5] Backend TypeScript"
cd backend && npx tsc --noEmit

echo "[2/5] Backend Jest (+ regression)"
npx jest --silent

echo "[3/5] Frontend TypeScript"
cd ../frontend && npx tsc --noEmit

echo "[4/5] Frontend Jest (+ regression)"
npx jest --silent

echo "[5/5] i18n invariants"
node scripts/verify-i18n.js  # 17개 언어 consent.json에 privacy_optional 없음 확인

echo "✅ Pre-release checks passed."
```

`.github/workflows/pre-release.yml` (신규):
```yaml
on:
  pull_request:
    branches: [main]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: bash scripts/pre-release-check.sh
```

---

## PR 템플릿 (영구 방지)

`.github/pull_request_template.md`:
```markdown
## 관련 이슈
- [ ] V1XX 알파 리포트 X번 해결 → 이 PR이 **동일 파일/컴포넌트**를 또 건드린다면 아래 체크

## 회귀 체크
- [ ] `CoachMark.tsx` 수정 시: `statusBarTranslucent` 유지 확인
- [ ] `consent.json` 수정 시: `privacy_optional` 부활하지 않음
- [ ] `CreateTripScreen.tsx` 수정 시: AI 카운터가 `X/Y` 형식 유지
- [ ] `ProfileScreen.tsx` modal 수정 시: `minHeight: 400` 부활 안 됨
- [ ] `ConsentScreen.tsx` 수정 시: `jitNotice` marginBottom >= 16

## 회귀 테스트
- [ ] `pre-release-check.sh` 통과
- [ ] regression Jest suite 통과
```

---

## Gate 11 통과 기준

1. Layer 1 Jest regression 2개 suite 작성 (CoachMark, ConsentScreen)
2. Backend regression test 1개 suite (register-force, consent-deprecated)
3. pre-release-check.sh 스크립트 작성 + 실행 가능
4. PR template 존재

**이 단계에서는 테스트 실제 작성 대신 "구조 문서화 + 핵심 snapshot"만 확보**. Jest 테스트 파일 자체는 Phase 12 직후 follow-up으로 분리 (V115 ship-blocker 아님).

## Residual risk

- **Layer 3 (visual regression)**: 실기기 기반이라 CI 통합 어려움. 현실적으로 수동 smoke로 대체.
- **i18n 변경의 review 부담**: 17개 언어를 한 번에 수정한 스크립트 기록을 PR에 첨부하여 재현 가능성 보장.
