# Apple Sign-In 사용자 이름 표시 버그 수정 Planning Document

> **Summary**: Apple Sign-In 시 실제 이름 대신 `xxx@privaterelay.appleid.com` 형태의 Private Relay 이메일이 표시되는 버그를 3개 레이어에서 근본 수정한다.
>
> **Project**: travelPlanner (myTravel)
> **Version**: 1.2.0 (B57 / V246 이후)
> **Author**: PM Agent
> **Date**: 2026-05-18
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

iOS Apple로 로그인한 사용자의 이름이 프로필 화면, 관리자 이용자 현황 등 앱 전체에서
`6z8c4pwvf9@privaterelay.appleid.com` 형태의 Apple Private Relay 이메일로 표시되는 버그를 수정한다.

사용자는 자신의 실제 이름(또는 적절한 대체 이름)이 표시되어야 한다.

### 1.2 Background

Apple Sign-In에는 플랫폼 제약이 있다:
1. `fullName`(givenName + familyName)은 **최초 로그인 시에만** 제공된다. 이후 로그인에서는 `null`.
2. 사용자가 "이메일 숨기기"를 선택하면 `xxx@privaterelay.appleid.com` 형태의 익명 이메일이 제공된다.
3. Apple ID 계정 설정에서 앱 제거 후 재로그인 시 `fullName`이 다시 제공된다.

현재 버그의 근본 원인은 3개 레이어에 걸쳐 있다:

- **Layer 1 (핵심)**: `auth.service.ts:619` — `fullName`이 null이면 `payload.email`(이메일 주소)을 name으로 저장
- **Layer 2 (데이터 누락)**: 최초 로그인 이후 재로그인 시 기존 사용자의 name을 업데이트하지 않아 잘못 저장된 값이 영속
- **Layer 3 (표시)**: 프론트엔드에서 이메일 형태의 name을 필터링 없이 그대로 표시

### 1.3 Related Documents

- 불변식: `docs/invariants/README.md`
- 배포 절차: `docs/operations/deploy.md`

---

## 2. Scope

### 2.1 In Scope

- [x] `backend/src/auth/auth.service.ts` — displayName 폴백 로직 수정 (Layer 1)
- [x] `backend/src/auth/auth.service.ts` — 기존 사용자 재로그인 시 name 갱신 로직 추가 (Layer 2)
- [x] `backend/src/auth/auth.controller.ts` — Apple token DTO fullName 수신 검증
- [x] `frontend/src/services/oauth.service.ts` — Apple SDK fullName 추출 로직 견고성 강화
- [x] `frontend/src/screens/main/ProfileScreen.tsx` — 이메일 형태 name 표시 방어 로직
- [x] `frontend/src/screens/main/UserManagementScreen.tsx` — 동일 방어 로직
- [x] DB 데이터 정정 — 기존에 이메일이 name으로 저장된 사용자 일괄 수정 (SQL 마이그레이션)
- [x] 헬퍼 유틸 — `isRelayEmail()` / `sanitizeDisplayName()` 공통 함수 추출

### 2.2 Out of Scope

- Apple Sign-In 최초 로그인 이후 fullName 재요청 (Apple 플랫폼 제약 — 변경 불가)
- 사용자가 직접 이름을 입력하는 프로필 수정 UI 개선 (별도 태스크)
- 프로필 화면 자체 리디자인
- Kakao / Google 로그인 name 처리 변경 (현재 정상 동작)
- 웹 서버(백엔드 REST API 외부) 변경

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | Apple 로그인 시 fullName이 있으면 반드시 name으로 저장한다 | Must | Pending |
| FR-02 | fullName이 null이고 이메일이 Private Relay 형태(`@privaterelay.appleid.com`)이면 `'Apple User'`를 name으로 저장한다 | Must | Pending |
| FR-03 | fullName이 null이고 이메일이 일반 이메일이면 이메일 아이디 부분(`@` 앞)을 name으로 저장한다 | Should | Pending |
| FR-04 | 기존 사용자가 Apple로 재로그인 시, DB name이 이메일 형태이면 올바른 name으로 덮어쓴다 | Must | Pending |
| FR-05 | 기존 DB에 이메일 형태로 저장된 Apple 사용자 name을 일괄 정정한다 | Must | Pending |
| FR-06 | 프로필 화면 및 관리자 이용자 현황에서 이메일 형태 name이 raw로 노출되지 않도록 방어 표시를 적용한다 | Should | Pending |
| FR-07 | `isRelayEmail()` 유틸 함수를 백엔드에 추출하여 중복 없이 재사용한다 | Should | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|---------|------|---------|
| 안전성 | 기존 사용자 데이터 변경 시 롤백 가능해야 함 | SQL 트랜잭션 + 백업 |
| 성능 | DB 마이그레이션 실행 시간 < 5초 (Apple 사용자 수 소규모) | 실행 로그 확인 |
| 호환성 | 기존 Apple 로그인 정상 동작 사용자에게 영향 없어야 함 | 회귀 테스트 |
| 보안 | Private Relay 이메일을 로그에 출력하지 않음 | 코드 리뷰 |

---

## 4. 수정 계획 — 파일별 상세 명세

### 4.1 Layer 1 + 2: `backend/src/auth/auth.service.ts`

#### 4.1.1 displayName 폴백 로직 수정 (L619)

**현재 코드:**
```typescript
const displayName = fullName?.trim() || payload.email || 'Apple User';
```

**문제**: `payload.email`이 `xxx@privaterelay.appleid.com`이면 이메일 주소가 name으로 저장됨.

**수정 후:**
```typescript
function sanitizeAppleDisplayName(fullName: string | undefined, email: string | undefined): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;

  if (!email || isRelayEmail(email)) return 'Apple User';

  // 일반 이메일이면 @ 앞 아이디 부분을 이름으로 사용 (예: john.doe@gmail.com → john.doe)
  const localPart = email.split('@')[0];
  return localPart || 'Apple User';
}
```

`isRelayEmail` 헬퍼:
```typescript
function isRelayEmail(email: string): boolean {
  return email.endsWith('@privaterelay.appleid.com');
}
```

#### 4.1.2 기존 사용자 재로그인 시 name 갱신 (oauthLogin 내부)

**현재 코드 (L499-542, 기존 사용자 찾은 경우):**
```typescript
let user = await this.usersService.findByProviderAndId(provider, oauthUser.providerId);
if (!user) {
  // 신규 생성 분기
  user = await this.usersService.create({ ... name: oauthUser.name ... });
}
// 기존 사용자의 경우 name을 갱신하는 코드가 없음
```

**수정 내용**: 기존 사용자(`user` 존재)이고 DB name이 이메일 형태인 경우, 새로 전달된 name이 올바르면 업데이트.

```typescript
if (user) {
  // name이 이메일 형태로 오염된 경우 + 새로운 올바른 name이 있으면 갱신
  const nameIsContaminated = isRelayEmail(user.name) || user.name.includes('@');
  const newNameIsValid = oauthUser.name && !oauthUser.name.includes('@');
  if (nameIsContaminated && newNameIsValid) {
    await this.usersService.update(user.id, { name: oauthUser.name });
    user.name = oauthUser.name;
  }
}
```

**위치**: `oauthLogin()` 메서드 내 `findByProviderAndId` 이후, `if (!user)` 블록 앞에 삽입.

---

### 4.2 Layer 2: `backend/src/auth/auth.service.ts` — Apple ID 계정 재연결 분기

**현재 코드 (L511-518):**
```typescript
await this.usersService.update(existing.id, {
  providerId: oauthUser.providerId,
  ...(oauthUser.name && { name: oauthUser.name }),
  ...
});
```

이 분기(same provider, email match, providerId 재발급)에서는 이미 `oauthUser.name`이 있으면 업데이트한다.
추가 수정: `oauthUser.name`이 없더라도 기존 name이 이메일 형태이면 `'Apple User'`로 정정.

```typescript
await this.usersService.update(existing.id, {
  providerId: oauthUser.providerId,
  name: (() => {
    if (oauthUser.name && !oauthUser.name.includes('@')) return oauthUser.name;
    if (!existing.name.includes('@')) return existing.name; // 기존 name이 정상이면 유지
    return 'Apple User'; // 기존 name도 오염, 새 name도 없음
  })(),
  ...(oauthUser.profileImage && { profileImage: oauthUser.profileImage }),
});
```

---

### 4.3 Layer 1 유틸 추출: `backend/src/auth/auth.service.ts` 또는 공통 위치

`isRelayEmail`과 `sanitizeAppleDisplayName`을 파일 상단(클래스 외부) 또는
`backend/src/common/utils/display-name.util.ts`에 추출.

현재 코드베이스 규모상 `auth.service.ts` 내 private helper로 추출하는 것이 YAGNI 원칙에 부합.
단, 재사용 필요 시 `common/utils`로 이동.

---

### 4.4 Layer 3: `frontend/src/screens/main/ProfileScreen.tsx`

**현재 코드 (L505):**
```tsx
<Text style={styles.name} testID="profile-name">{user?.name}</Text>
```

**수정 후:**
```tsx
<Text style={styles.name} testID="profile-name">
  {formatDisplayName(user?.name)}
</Text>
```

`formatDisplayName` 헬퍼 (파일 상단 또는 `src/utils/user.utils.ts`):
```typescript
export function formatDisplayName(name: string | undefined | null): string {
  if (!name) return '';
  if (name.includes('@privaterelay.appleid.com')) return 'Apple User';
  if (name.includes('@') && name.length > 50) return 'Apple User'; // 일반 이메일이 name인 경우
  return name;
}
```

**목적**: 이미 DB에 오염된 데이터가 있어도 UI에서 방어적으로 표시.
DB 마이그레이션 후에는 이 분기가 실행될 일이 없으나, 안전망으로 유지.

---

### 4.5 Layer 3: `frontend/src/screens/main/UserManagementScreen.tsx`

**현재 코드 (L164):**
```tsx
{item.name}
```

**수정 후:**
```tsx
{formatDisplayName(item.name)}
```

동일한 `formatDisplayName` 유틸 사용.

---

### 4.6 DB 데이터 정정 (Must)

#### 4.6.1 현황 파악 쿼리 (실행 전 확인용)

```sql
-- Apple 사용자 중 name이 이메일 형태인 사용자 수 확인
SELECT COUNT(*) as contaminated_count
FROM users
WHERE provider = 'apple'
  AND (name LIKE '%@privaterelay.appleid.com' OR name LIKE '%@%' AND name NOT LIKE '% %');

-- 실제 데이터 확인
SELECT id, email, name, "createdAt"
FROM users
WHERE provider = 'apple'
  AND (name LIKE '%@privaterelay.appleid.com' OR (name LIKE '%@%' AND name NOT LIKE '% %'))
ORDER BY "createdAt" DESC;
```

#### 4.6.2 데이터 정정 SQL (트랜잭션 내 실행)

```sql
BEGIN;

-- Private Relay 이메일이 name으로 저장된 사용자 → 'Apple User'로 정정
UPDATE users
SET name = 'Apple User',
    "updatedAt" = NOW()
WHERE provider = 'apple'
  AND name LIKE '%@privaterelay.appleid.com';

-- 일반 이메일이 name으로 저장된 사용자 → 이메일 로컬 파트로 정정
-- (예: john.doe@gmail.com → john.doe)
UPDATE users
SET name = SPLIT_PART(name, '@', 1),
    "updatedAt" = NOW()
WHERE provider = 'apple'
  AND name LIKE '%@%'
  AND name NOT LIKE '% %'  -- 공백 없음 = 이메일 형태 (실제 이름에 공백이 있는 경우 제외)
  AND name NOT LIKE '%@privaterelay.appleid.com';  -- 위에서 이미 처리

-- 변경된 행 수 확인
SELECT COUNT(*) as updated_count FROM users WHERE provider = 'apple' AND name = 'Apple User';

COMMIT;
-- 문제 발생 시: ROLLBACK;
```

#### 4.6.3 실행 방법

```bash
# 서버 SSH 접속 후 PostgreSQL 컨테이너에서 실행
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127
docker exec -it travelplanner-db-1 psql -U postgres -d travelplanner

# 또는 로컬에서 직접
psql $DATABASE_URL -f scripts/fix-apple-display-names.sql
```

정정 SQL을 `backend/src/migrations/` 또는 `scripts/fix-apple-display-names.sql`로 저장.

---

## 5. Success Criteria

### 5.1 Definition of Done

- [ ] `auth.service.ts` displayName 폴백: Private Relay 이메일이 name으로 저장되지 않음
- [ ] `auth.service.ts` 재로그인 시: 기존 오염된 name이 있으면 갱신됨
- [ ] DB 마이그레이션: 기존 오염 데이터 정정 완료
- [ ] `ProfileScreen.tsx`: `formatDisplayName` 적용, 이메일 형태 노출 없음
- [ ] `UserManagementScreen.tsx`: 동일 적용
- [ ] 유닛 테스트: `sanitizeAppleDisplayName`, `isRelayEmail`, `formatDisplayName` 각 케이스 커버
- [ ] 회귀 테스트: 기존 Apple 정상 로그인 사용자 데이터 영향 없음 확인

### 5.2 Quality Criteria

- [ ] `isRelayEmail`, `sanitizeAppleDisplayName` 함수 단위 테스트 80% 이상
- [ ] TypeScript 컴파일 오류 없음
- [ ] 기존 `auth.service.ts` 테스트 통과
- [ ] DB 마이그레이션 롤백 가능 (트랜잭션 처리)

---

## 6. Risks and Mitigation

| 리스크 | 영향 | 발생 가능성 | 완화 방법 |
|-------|------|-----------|---------|
| DB 마이그레이션 실행 중 서비스 중단 | Medium | Low | 트랜잭션 처리 + 영향 행 수 소규모 (Apple 사용자 일부) + 피크 타임 외 실행 |
| `oauthLogin` name 갱신 로직이 정상 name을 덮어쓰는 경우 | High | Low | `nameIsContaminated` 조건 엄격히 검증 + `includes('@')` 체크로 정상 이름 보호 |
| Apple 이외 provider 사용자에 영향 | Medium | Low | APPLE provider 조건으로 스코프 제한 |
| 최초 로그인에서 fullName이 null인 경우 (Apple SDK 타이밍 이슈) | Medium | Medium | `sanitizeAppleDisplayName` 폴백이 처리. 사용자가 프로필에서 직접 이름 수정 가능. |
| `@` 포함한 실제 이름 (예: 닉네임 `cool@dev`) | Low | Very Low | `privaterelay` 정확 매칭 + `NOT LIKE '% %'` 조건으로 방어 |

---

## 7. 수정 우선순위 및 실행 순서

### Phase 1 — 백엔드 수정 (신규 로그인 버그 차단) [최우선]

1. `auth.service.ts`: `isRelayEmail` + `sanitizeAppleDisplayName` 헬퍼 추가
2. `auth.service.ts` L619: `displayName` 계산 로직을 헬퍼로 교체
3. `auth.service.ts`: `oauthLogin` 내 기존 사용자 재로그인 시 name 갱신 로직 추가
4. `auth.service.ts`: 재연결 분기(L511-518) name 정정 로직 추가
5. 백엔드 배포

### Phase 2 — DB 마이그레이션 (기존 데이터 정정) [백엔드 배포 직후]

1. 현황 파악 쿼리 실행 (영향 범위 확인)
2. 트랜잭션 내 UPDATE 실행
3. 결과 확인 쿼리 실행

### Phase 3 — 프론트엔드 방어 표시 [Phase 1과 병행 가능]

1. `formatDisplayName` 유틸 함수 작성
2. `ProfileScreen.tsx` 적용
3. `UserManagementScreen.tsx` 적용
4. 프론트엔드 빌드 및 TestFlight/Play Store 제출

---

## 8. Edge Case 처리

| 케이스 | 처리 방법 |
|-------|---------|
| fullName이 빈 문자열 `""` | `trim()` 후 falsy → 폴백 로직 진행 |
| fullName이 공백만 `"   "` | `trim()` 후 `""` → falsy → 폴백 |
| email도 null (Apple이 둘 다 안 보내는 경우) | `'Apple User'` 폴백 |
| Private Relay 이메일인데 fullName 있음 | fullName 사용 (정상) |
| 일반 이메일의 로컬 파트가 빈 문자열 (`@domain.com`) | `'Apple User'` 폴백 |
| 재로그인 시 새 fullName이 없고 기존 name이 정상 | 기존 name 유지 (갱신 조건 불충족) |
| 이름 직접 수정한 사용자가 재로그인 | 사용자 설정 이름 유지 (`nameIsContaminated = false`) |
| 관리자 계정이 Apple 로그인인 경우 | 동일 로직 적용 (관리자 여부와 무관) |
| Apple ID 앱 제거 후 재로그인 (fullName 재제공) | FR-04 로직이 정상 name으로 갱신 |

---

## 9. Architecture Considerations

### 9.1 Project Level

기존 Enterprise 레벨 프로젝트 (NestJS 백엔드 + React Native 프론트엔드).
이번 수정은 기존 구조 내 소규모 버그 픽스이므로 구조 변경 없음.

### 9.2 Key Decisions

| 결정 | 선택 | 이유 |
|-----|------|------|
| 헬퍼 함수 위치 | `auth.service.ts` 파일 상단 private function | YAGNI — 현재 auth.service.ts 내에서만 사용 |
| 프론트 유틸 위치 | `src/utils/user.utils.ts` 신규 파일 (또는 인라인) | ProfileScreen + UserManagementScreen 2곳 재사용 |
| DB 정정 방법 | 직접 SQL (TypeORM Migration 파일 불필요) | 일회성 데이터 픽스, 스키마 변경 없음 |
| 기존 사용자 name 갱신 트리거 | 재로그인 시 자동 갱신 | 별도 배치 작업 없이 자연스럽게 수정됨 |

---

## 10. Next Steps

1. [ ] Design 문서 작성 (`apple-signin-displayname-fix.design.md`) — 불필요 (단순 버그픽스, Plan으로 충분)
2. [ ] Phase 1 백엔드 수정 구현
3. [ ] Phase 2 DB 마이그레이션 실행 (백엔드 배포 직후)
4. [ ] Phase 3 프론트엔드 수정 + 빌드 제출
5. [ ] 팀 리뷰 및 승인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-18 | Initial draft | PM Agent |
