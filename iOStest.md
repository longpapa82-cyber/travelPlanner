# iOS 1.0.0 (18) 버전 — 수정 계획 및 전체 검수 계획

> **원칙**: 모든 수정 작업은 iOS 전용 코드(`Platform.OS === 'ios'` 분기)에 한정.  
> 웹(`www.mytravel-planner.com`) 및 Android(Google Play versionCode 220)에 영향을 주는 공유 로직 변경 금지.  
> 수정 완료 후 한 번에 빌드 → TestFlight 등록 (buildNumber 19).

---

## 1부. B18 버그 원인 분석 및 수정 계획

### B18-01 · 스플래시 화면 배경색 불일치

**현상**: 흰색 배경(#FAFAF9) 위에 아이콘만 표기되어 어색함.  
**근본 원인**: `app.config.js`의 `splash.backgroundColor: '#FAFAF9'`가 앱 아이콘 배경색(#4A90D9 계열 파랑)과 불일치.  
**영향 범위**: iOS 전용 (`splash` 설정). Android는 `adaptive-icon` 별도 사용.

**수정 계획**:
```
파일: frontend/app.config.js
변경: splash.backgroundColor → '#4A90D9' (아이콘 배경과 동일한 색상)
      splash.resizeMode → 'contain' 유지 (전체 화면 커버)
주의: android 섹션의 adaptiveIcon.backgroundColor('#4A90D9')는 그대로 — 영향 없음
```

**검증 방법**: TestFlight 설치 후 앱 실행 시 배경색이 아이콘과 자연스럽게 연결되는지 육안 확인.

---

### B18-02 · 이메일 로그인 키보드 오프셋 (흰색 박스 영역)

**현상**: 비밀번호 입력 시 키보드 위에 흰색 박스가 표기되어 일부 UI 가려짐.  
**근본 원인**: `KeyboardAvoidingView`의 `keyboardVerticalOffset={insets.top}`이 iOS Safe Area 값을 과대 계산하여 빈 공간 생성.  
**영향 범위**: iOS LoginScreen 전용. Android는 `behavior={undefined}`로 분기되어 영향 없음.

**수정 계획**:
```
파일: frontend/src/screens/auth/LoginScreen.tsx
변경: keyboardVerticalOffset 값을 조정
     현재: insets.top
     수정: Platform.OS === 'ios' ? 0 : 0  
     (behavior="padding" 자체가 키보드 높이를 계산하므로 offset 추가 불필요)
추가: KeyboardAvoidingView에 style={{ flex: 1 }} 명시
```

**검증 방법**: 비밀번호 필드 터치 시 흰색 빈 영역 미발생, 비밀번호 입력란이 키보드 위에 정상 표기.

---

### B18-03 · 이메일 로그인 후 iOS 암호 저장 팝업

**현상**: 네이티브 앱임에도 이메일 로그인 완료 시 iCloud 키체인 암호 저장 팝업 표기.  
**근본 원인**: iOS 17+에서 `textContentType="oneTimeCode"` + `secureTextEntry` 조합이 여전히 iCloud Keychain 자동 인식 대상. iOS가 `TextInput`을 WebView와 동일한 로그인 폼으로 식별.  
**영향 범위**: iOS LoginScreen 전용. Android는 `autoComplete="off"` + `importantForAutofill="no"` 이미 적용.

**수정 계획**:
```
파일: frontend/src/screens/auth/LoginScreen.tsx

이메일 TextInput에 추가:
  textContentType="username"  (이미 username임을 명시)

비밀번호 TextInput 변경:
  현재: textContentType="oneTimeCode"
  수정: textContentType="password"  + autoFill="no"
  추가: importantForAutofill="no"

대안 (위 방법 미해결 시):
  - 커스텀 TextInput wrapper 생성으로 iOS 키체인 인식 차단
  - 혹은 password 필드 autoComplete="new-password" 적용
```

> **참고**: iOS 시스템의 암호 저장 기능은 Apple 정책상 100% 차단이 어려울 수 있음.  
> 차단 불가 시 최종 리포트에 "iOS 시스템 정책상 완전 비활성화 불가, 사용자 경험에 실질적 영향 없음"으로 기재.

**검증 방법**: 이메일 로그인 완료 후 암호 저장 팝업 미표기 or 표기 빈도 최소화 확인.

---

### B18-04 · 카카오 로그인 후 myTravel 앱 미복귀

**현상**: 카카오 인증 완료 후 myTravel 앱으로 돌아오지 않고 카카오 앱에 머무름.  
**근본 원인**: `oauth.service.ts`에서 카카오 네이티브 앱 처리 시 흐름:
1. `WebBrowser.openAuthSessionAsync` → 카카오 네이티브 앱 실행 → 즉시 `type: 'dismiss'` 반환
2. `deeplinkPromise`가 `travelplanner://auth/callback` URL을 기다리는 30초 타임아웃 동안 로딩 지속
3. 카카오 SDK가 redirect URI로 `travelplanner://` 스킴 대신 카카오 자체 스킴을 사용하는 경우 딥링크 미수신

**영향 범위**: iOS + Android 공통 코드이나, iOS 카카오 앱 전환 동작이 다름.

**수정 가능성 판단**:
- ✅ **취소 시 무한 로딩 수정**: 가능 → 아래 B18-05 참조
- ⚠️ **인증 완료 후 앱 복귀**: 카카오 SDK의 universal link / custom scheme 동작은 카카오 측 구현에 의존. 
  - 카카오 iOS SDK가 `kakaokompassauth://` 스킴으로 먼저 복귀 → myTravel 앱 딥링크로 재전달 흐름 확인 필요
  - `RootNavigator.tsx`의 Linking 설정에 `travelplanner://auth/callback` 경로 등록 여부 재확인

**수정 계획**:
```
파일: frontend/src/services/oauth.service.ts

카카오 전용 분기 추가:
  browserPromise 결과가 type === 'dismiss' 또는 type === 'cancel'인 경우
  → deeplinkPromise를 계속 대기 (현재 동작)
  → 단, 5초 추가 대기 후에도 딥링크 미수신 시 즉시 null 반환 (30초 → 5초로 단축)

파일: frontend/src/navigation/RootNavigator.tsx
확인: Linking 설정에 auth/callback 경로가 등록되어 있는지 검토
```

> **최종 판단**: 카카오 앱 → myTravel 앱 자동 복귀는 카카오 iOS SDK 동작 방식에 의존하므로  
> SDK 레벨에서 해결 불가능할 경우 "카카오 SDK 정책상 iOS에서 네이티브 앱 복귀 미지원 — 사용자가 수동으로 앱 전환 필요"로 최종 리포트에 기재.

---

### B18-05 · 카카오 취소 시 로딩 무한 지속

**현상**: [카카오로 시작하기] 팝업에서 취소 시 로그인 버튼에 장시간 로딩 발생.  
**근본 원인**: 카카오 취소 시 `WebBrowser`가 `type: 'dismiss'` 반환 → `deeplinkPromise`의 30초 타임아웃 만료까지 `signInWithOAuth`가 반환 안 됨 → `handleKakaoLogin`의 `finally`에서 `setIsLoading(false)` 미호출.  
**영향 범위**: iOS (카카오 취소 경로). Google/Apple 취소는 B17에서 해결됨.

**수정 계획**:
```
파일: frontend/src/services/oauth.service.ts

변경 1: deeplinkPromise 타임아웃 30초 → 5초로 단축
변경 2: browserPromise 결과가 type === 'cancel' 또는 type === 'dismiss'이면
        deeplinkPromise를 즉시 resolve(null) 처리하는 신호 추가
        
구현:
  let deeplinkResolve: ((v: string | null) => void) | undefined;
  
  const deeplinkPromise = new Promise<string | null>((resolve) => {
    deeplinkResolve = resolve;
    const timer = setTimeout(() => resolve(null), 5_000);  // 30s → 5s
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('/auth/callback')) {
        clearTimeout(timer);
        resolve(url);
      }
    });
    cleanups.push(() => { sub.remove(); clearTimeout(timer); });
  });
  
  // browserPromise 완료 후 카카오 취소 감지 시 deeplinkPromise 즉시 종료
  browserPromise.then((result) => {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      // 잠깐 대기 (딥링크 경쟁 허용) 후 즉시 null 반환
      setTimeout(() => deeplinkResolve?.(null), 500);
    }
  });

파일: frontend/src/contexts/AuthContext.tsx (또는 oauth.service.ts)
확인: 반환값 null 시 KAKAO_SIGNIN_CANCELLED 에러 throw → LoginScreen의 
      CANCELLED_CODES Set이 처리 → setIsLoading(false) 호출 흐름 검증
```

**검증 방법**: 카카오 팝업에서 취소 후 1초 이내에 로딩 해제 및 로그인 화면 정상 표기.

---

### B18-06 · 오류 로그 점검

**점검 항목**: 금일(빌드 18 테스트 날짜) 추가된 오류 로그 확인 및 수정/개선 여부 판단.

**점검 방법**:
```bash
# 프로덕션 서버 ErrorLog DB 조회
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && \
   docker compose exec postgres psql -U postgres -d travelplanner \
   -c \"SELECT created_at, method, url, status_code, message FROM error_log \
        WHERE created_at > NOW() - INTERVAL '24 hours' \
        ORDER BY created_at DESC LIMIT 50;\""
```

**판단 기준**:
| 상태 코드 | 처리 방침 |
|-----------|-----------|
| 5xx 서버 오류 | 즉시 원인 분석 및 수정 |
| 4xx 클라이언트 오류 | 반복 패턴 시 UI 안내 개선 |
| 카카오 관련 오류 | B18-04/05와 연계 분석 |

---

## 2부. 수정 완료 항목 검수 계획

> 빌드 13~17에서 해결된 항목이 빌드 18에서 유지되는지 회귀 검증.

### 검수 체크리스트

| # | 항목 | 이전 해결 버전 | B18 상태 | 검수 방법 |
|---|------|--------------|---------|---------|
| C1 | 구글 로그인 — 앱 강제종료 없이 홈으로 이동 | B13 | ✅ 유지 필요 | 구글 계정 선택 → 홈 탐색 화면 도달 확인 |
| C2 | 애플 로그인 — 정상 동작 | B13 | ✅ 유지 필요 | Apple ID 로그인 → 홈 화면 도달 확인 |
| C3 | 애플 취소 시 로딩 미발생 | B17 | ✅ 유지 필요 | 애플 팝업 취소 → 즉시 로딩 해제 |
| C4 | 구글 취소 시 로딩 미발생 | B16 | ✅ 유지 필요 | 구글 팝업 취소 → 즉시 로딩 해제 |
| C5 | DatePicker (출발일/종료일) 정상 표기 | B15 | ✅ 유지 필요 | 새 여행 만들기 → 날짜 선택 UI 가시 확인 |
| C6 | 상단 헤더 높이 일정 | B16 | ✅ 유지 필요 | 탭 전환 시 헤더 위치 흔들림 없음 |
| C7 | 이전 버튼 중복 미표기 | B15 | ✅ 유지 필요 | 새 여행 만들기 화면 — 이전 버튼 1개만 |
| C8 | 키보드 활성화 시 비밀번호 필드 접근 가능 | B15 | ✅ 유지 필요 | 이메일 → 비밀번호 필드 탭 → 가려짐 없음 |
| C9 | [광고 보고 인사이트] 버튼 표기 | B14 | ✅ 유지 필요 | 목적지 입력 화면에서 버튼 가시 확인 |
| C10 | 출발일 > 종료일 시 정확한 오류 메시지 | B14 | ✅ 유지 필요 | "종료일을 확인해주세요" 메시지 출력 |
| C11 | 스플래시 깜빡임 없음 | B13 | ✅ 유지 필요 | 앱 실행 → 이전 앱 이미지 미표기 |
| C12 | 로그인 완료 후 홈(탐색) 화면 이동 | B17 | ✅ 유지 필요 | 이메일 로그인 → 탐색 화면 도달 (암호 팝업과 관계없이) |

---

## 3부. iOS 전체 기능 상세 검수 계획

### 검수 환경

| 항목 | 사양 |
|------|------|
| 기기 | iPhone (TestFlight 설치) |
| iOS 버전 | 최신 iOS 지원 버전 |
| 계정 | 테스트 계정 (hoonjae723@gmail.com) |
| 네트워크 | WiFi + LTE 각각 테스트 |
| 프리미엄 상태 | 비프리미엄(광고 노출) + 프리미엄 각각 테스트 |

---

### F1. 앱 실행 및 스플래시

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F1-01 | 앱 아이콘 터치 후 실행 | 배경색 일치, 중앙 아이콘 표기, 깜빡임 없음 | P0 |
| F1-02 | 앱 강제 종료 후 재실행 | F1-01과 동일 | P0 |
| F1-03 | 백그라운드 → 포그라운드 전환 | 스플래시 미표기, 기존 화면 유지 | P1 |

---

### F2. 인증 — 이메일/비밀번호

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F2-01 | 이메일 필드 터치 | 키보드 활성화, 화면 가려짐 없음 | P0 |
| F2-02 | 비밀번호 필드 터치 | 비밀번호 필드 가시, 흰색 박스 미표기 | P0 |
| F2-03 | 올바른 이메일/비밀번호 로그인 | 홈 화면 이동, 암호 저장 팝업 최소화 | P0 |
| F2-04 | 잘못된 이메일 형식 입력 | 이메일 형식 오류 메시지 표기 | P1 |
| F2-05 | 잘못된 비밀번호 입력 | 로그인 오류 메시지 표기 | P1 |
| F2-06 | 비밀번호 눈 아이콘 토글 | 비밀번호 표시/숨김 전환 | P2 |
| F2-07 | 이메일 미입력 로그인 시도 | "이메일을 입력해주세요" 표기 | P1 |
| F2-08 | 비밀번호 미입력 로그인 시도 | "비밀번호를 입력해주세요" 표기 | P1 |

---

### F3. 인증 — SNS 로그인

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F3-01 | [구글로 시작하기] 터치 | 구글 계정 선택 화면 표기 | P0 |
| F3-02 | 구글 계정 선택 후 로그인 | 홈 화면 이동 (탐색 화면) | P0 |
| F3-03 | 구글 로그인 취소 | 즉시 로딩 해제, 로그인 화면 복귀 | P0 |
| F3-04 | [애플로 시작하기] 터치 | Face ID / Touch ID 팝업 표기 | P0 |
| F3-05 | 애플 로그인 성공 | 홈 화면 이동 | P0 |
| F3-06 | 애플 로그인 취소 | 즉시 로딩 해제, 로그인 화면 복귀 | P0 |
| F3-07 | [카카오로 시작하기] 터치 | 카카오 인증 화면 표기 | P0 |
| F3-08 | 카카오 로그인 완료 | myTravel 앱 복귀 또는 수동 전환 후 홈 이동 | P0 |
| F3-09 | 카카오 로그인 취소 | 5초 이내 로딩 해제, 로그인 화면 복귀 | P0 |
| F3-10 | 중복 이메일 (다른 프로바이더) 로그인 시도 | 프로바이더 충돌 안내 메시지 표기 | P1 |

---

### F4. 로그아웃 및 세션

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F4-01 | 프로필 → 로그아웃 | 로그인 화면으로 이동, 광고 깜빡임 없음 | P0 |
| F4-02 | 로그아웃 후 앱 재실행 | 로그인 화면 표기 (자동 로그인 없음) | P0 |
| F4-03 | 장시간 비사용 후 앱 재진입 | 세션 만료 시 로그인 화면 이동 | P1 |

---

### F5. 홈 화면

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F5-01 | 홈 탭 진입 | 헤더 정상, 콘텐츠 정상 표기 | P0 |
| F5-02 | 탐색 → 홈 → 탐색 탭 전환 | 헤더 높이 일정, 흔들림 없음 | P0 |
| F5-03 | 홈에서 여행 카드 터치 | 여행 상세 화면 이동 | P1 |

---

### F6. 새 여행 만들기

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F6-01 | [새 여행 만들기] 버튼 터치 | 새 여행 입력 화면 표기, 이전 버튼 1개 | P0 |
| F6-02 | 목적지 입력 | 장소 자동완성 정상 동작 | P0 |
| F6-03 | [광고 보고 상세 여행 인사이트 받기] 버튼 | 버튼 가시 및 터치 동작 | P0 |
| F6-04 | 출발일 선택 | DatePicker 정상 표기, 날짜 선택 가능 | P0 |
| F6-05 | 종료일 선택 | DatePicker 정상 표기, 날짜 선택 가능 | P0 |
| F6-06 | 출발일 > 종료일 입력 | "종료일을 확인해주세요" 안내 메시지 | P1 |
| F6-07 | 여행 이름 입력 | 텍스트 입력 정상, 키보드 가려짐 없음 | P0 |
| F6-08 | 여행 생성 완료 | 여행 목록 또는 상세 화면 이동 | P0 |
| F6-09 | 이전 버튼 터치 | 이전 화면 복귀 | P1 |

---

### F7. 여행 목록 및 상세

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F7-01 | [내 여행] 탭 진입 | 여행 목록 정상 표기 | P0 |
| F7-02 | 여행 카드 터치 | 여행 상세 화면 이동, 이전 버튼(<) 표기 | P0 |
| F7-03 | 여행 상세 → 이전 버튼 터치 | 이전 화면 복귀 및 버튼 동작 | P0 |
| F7-04 | 여행 수정 | 날짜/이름 수정 후 저장 | P1 |
| F7-05 | 여행 삭제 | 확인 후 목록에서 제거 | P1 |

---

### F8. 탐색 화면

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F8-01 | [탐색] 탭 진입 | 탐색 콘텐츠 정상 표기 | P0 |
| F8-02 | 장소 검색 | 자동완성 결과 표기 및 선택 | P1 |

---

### F9. 알림 화면

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F9-01 | [알림] 탭 진입 | 헤더 정상, 알림 목록 표기 | P1 |
| F9-02 | 알림 터치 | 관련 화면 이동 | P2 |

---

### F10. 프로필 화면

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F10-01 | [프로필] 탭 진입 | 사용자 정보 정상 표기, 헤더 높이 일정 | P0 |
| F10-02 | 프로필 이미지 변경 | 사진 라이브러리 접근, 이미지 업로드 | P1 |
| F10-03 | 이름 수정 | 입력 → 저장 → 반영 | P1 |
| F10-04 | 구독 관리 | 구독 상태 표기, 구독 화면 이동 | P1 |
| F10-05 | 계정 탈퇴 | 확인 팝업 → 탈퇴 → 로그인 화면 | P1 |

---

### F11. 광고 (비프리미엄 사용자)

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F11-01 | 비프리미엄 계정으로 앱 이용 | 배너 광고 표기 | P1 |
| F11-02 | 리워드 광고 시청 | 광고 완료 후 인사이트 제공 | P1 |
| F11-03 | 프리미엄 계정으로 로그인 | 광고 미표기 | P1 |
| F11-04 | 로그아웃 시 광고 처리 | 광고 깜빡임 없이 로그인 화면 이동 | P0 |

---

### F12. 구독/결제 (iOS In-App Purchase)

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F12-01 | 구독 화면 진입 | 월간/연간 패키지 가격 표기 | P1 |
| F12-02 | 구독 시도 (테스트 계정) | App Store 결제 팝업 표기 | P1 |
| F12-03 | 구독 완료 후 프리미엄 활성화 | 광고 제거, 기능 잠금 해제 | P1 |
| F12-04 | 구독 복원 | 이전 구독 상태 복원 | P2 |

---

### F13. 하단 탭 네비게이션

| 테스트 ID | 시나리오 | 기대 결과 | 우선순위 |
|-----------|---------|---------|---------|
| F13-01 | 5개 탭 순차 터치 | 각 화면 이동, 헤더 높이 일정 | P0 |
| F13-02 | 빠른 탭 전환 (더블 탭) | 크래시 없음, 정상 동작 | P1 |
| F13-03 | Safe Area 여백 | 하단 홈 인디케이터 영역 침범 없음 | P1 |

---

## 4부. iOS 앱 보안 점검 계획

> **원칙**: 점검 항목은 iOS 앱 레이어에 한정. 서버/웹/Android 공유 인프라 변경 금지.

---

### S1. 인증 및 토큰 보안

| 점검 ID | 항목 | 점검 방법 | 기준 |
|---------|------|---------|------|
| S1-01 | Access Token 저장 위치 | `secureStorage` (expo-secure-store) 사용 확인 | AsyncStorage 저장 금지 |
| S1-02 | Refresh Token 저장 위치 | `secureStorage` 사용 확인 (Invariant: AsyncStorage 금지) | SecureStore 저장 필수 |
| S1-03 | OAuth state(nonce) CSRF 검증 | `parseOAuthCallback`에서 state 비교 로직 확인 | state 불일치 시 null 반환 |
| S1-04 | 토큰 로그 노출 | 서버 오류 로그에 토큰 값 미포함 확인 | 토큰 마스킹 필수 |
| S1-05 | 앱 백그라운드 시 인증 상태 | 30분 이상 비사용 후 재진입 시 토큰 갱신 동작 | 401 → 자동 재인증 또는 로그인 화면 |

---

### S2. 개인정보 접근 권한

| 점검 ID | 항목 | 점검 방법 | 기준 |
|---------|------|---------|------|
| S2-01 | 사진 라이브러리 접근 | `NSPhotoLibraryUsageDescription` 설명 표기 | 명확한 사용 목적 안내 |
| S2-02 | 광고 추적 권한 | `NSUserTrackingUsageDescription` ATT 팝업 | iOS 14+ ATT 동의 흐름 |
| S2-03 | 카메라 접근 (미사용 시) | `Info.plist`에 카메라 권한 미선언 확인 | 불필요한 권한 없음 |
| S2-04 | 위치 정보 (미사용 시) | 위치 권한 미요청 확인 | 미선언 |
| S2-05 | 마이크 접근 (미사용 시) | 마이크 권한 미요청 확인 | 미선언 |

---

### S3. 네트워크 통신 보안

| 점검 ID | 항목 | 점검 방법 | 기준 |
|---------|------|---------|------|
| S3-01 | HTTPS 강제 | 모든 API 호출이 `https://` 사용 | HTTP 호출 없음 |
| S3-02 | App Transport Security | `NSAllowsArbitraryLoads` 미설정 확인 | ATS 활성화 |
| S3-03 | API URL 하드코딩 | 소스코드에 프로덕션 자격증명 미노출 | 환경변수 사용 |
| S3-04 | 인증서 피닝 (선택) | 현재 미적용 — 향후 도입 검토 | P2 (즉시 필수 아님) |

---

### S4. 데이터 저장 보안

| 점검 ID | 항목 | 점검 방법 | 기준 |
|---------|------|---------|------|
| S4-01 | 민감 데이터 AsyncStorage 저장 | 코드 검색: `AsyncStorage.setItem`에서 토큰/비밀번호 미저장 | 토큰류 전부 SecureStore |
| S4-02 | 캐시 데이터 민감정보 | `offlineCache` 저장 데이터 항목 확인 | PII 미포함 |
| S4-03 | 네비게이션 상태 민감 파라미터 | `sanitizeNavState`에서 토큰/OAuth 파라미터 제거 확인 | SAFE_PARAM_KEYS만 저장 |
| S4-04 | 로그 파일 PII 노출 | 클라이언트 로그에 이메일/이름 미노출 확인 | PII 마스킹 |

---

### S5. 입력값 검증 및 주입 방지

| 점검 ID | 항목 | 점검 방법 | 기준 |
|---------|------|---------|------|
| S5-01 | 이메일 형식 검증 | 클라이언트 정규식 + 서버 DTO 검증 이중 확인 | 양측 검증 필수 |
| S5-02 | 여행 이름/설명 특수문자 | XSS 방지: `stripHtml` DTO 적용 확인 (서버) | HTML 태그 제거 |
| S5-03 | 날짜 입력 범위 | 출발일 > 종료일 방어 로직 확인 | 클라이언트 + 서버 검증 |

---

### S6. Apple 앱 심사 정책 준수

| 점검 ID | 항목 | 기준 |
|---------|------|------|
| S6-01 | Apple 로그인 필수 제공 | 타 SNS 로그인 제공 시 Apple 로그인도 반드시 제공 ✅ |
| S6-02 | Privacy Nutrition Labels | App Store Connect 개인정보 수집 선언 정확성 확인 |
| S6-03 | 암호화 사용 선언 | `ITSAppUsesNonExemptEncryption: false` — 표준 HTTPS만 사용 시 적절 |
| S6-04 | 광고 추적 투명성 | ATT 동의 없이 IDFA 미사용 확인 |
| S6-05 | 결제 정책 준수 | 디지털 상품 IAP 필수 사용 (Paddle은 웹 전용 허용 범위 확인) |

---

## 5부. 빌드 및 제출 계획

### 수정 우선순위 및 순서

| 순서 | 항목 | 예상 소요 | 필수 여부 |
|------|------|---------|---------|
| 1 | B18-05 카카오 취소 로딩 (5초 타임아웃) | 30분 | 필수 |
| 2 | B18-01 스플래시 배경색 | 10분 | 필수 |
| 3 | B18-02 키보드 오프셋 | 30분 | 필수 |
| 4 | B18-03 암호 저장 팝업 | 30분 | 권장 |
| 5 | B18-04 카카오 복귀 딥링크 분석 | 60분 | 조건부 |
| 6 | B18-06 오류 로그 점검 | 30분 | 권장 |

### 빌드 명령

```bash
# buildNumber를 19로 설정 (app.config.js)
# iOS 전용 변경 사항만 반영 후 빌드
cd frontend
eas build --platform ios --profile production-ios
```

### TestFlight 검증 순서

1. F1 (스플래시) → F2/F3 (로그인) → F6 (여행 생성) 순서로 P0 항목 우선 검증
2. P0 전체 통과 후 P1 항목 검증
3. S1~S4 보안 항목 코드 리뷰 (기기 테스트 불필요한 정적 분석 포함)
4. 최종 Go/No-Go 판정 후 App Store Connect 제출

---

## 6부. 웹/Android 영향 없음 확인 체크리스트

> 모든 수정 작업 완료 후 아래 항목 확인.

- [ ] `Platform.OS === 'ios'` 분기 외 공통 코드 변경 없음
- [ ] `oauth.service.ts` 변경 사항이 Android deeplinkPromise 동작에 영향 없음  
  (Android는 coolDown 후 browserPromise 결과만 사용하는 흐름 유지)
- [ ] `app.config.js`의 `splash` 변경이 `android.adaptiveIcon` 섹션에 영향 없음
- [ ] 서버 API 변경 없음 (iOS 클라이언트 레이어만 수정)
- [ ] `LoginScreen.tsx` TextInput 속성 변경이 Android `autoComplete` 동작에 영향 없음  
  (Android는 `importantForAutofill="no"`로 이미 별도 처리됨)
- [ ] 웹 서비스 (`www.mytravel-planner.com`) 빌드/배포 없음
- [ ] Android versionCode 220 Play Console 제출 내용 변경 없음

---

*작성일: 2026-05-06 | 기준 버전: iOS 1.0.0 (18) | 다음 빌드 목표: buildNumber 19*
