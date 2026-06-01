# 불변식: 인증/로그아웃/OAuth (#17~29)

17. **Cross-context logout transaction lock**: AuthContext에 전역 `isLoggingOut` state + ref. 모든 AppState handler 첫 줄 가드. await 후 재차 가드.
18. **In-flight guard는 await 전 set**: `isXxxRef.current = true`는 반드시 `await` 전에 set.
19. **Confirm dialog는 큐 기반**: ConfirmDialogContext 단일 resolveRef 슬롯 금지. queue + sequential drain.
20. **Navigation tree는 user identity(id)에만 반응**: setUser 시 prev/next id 같으면 reference 안정화.
21. **Account termination umbrella lock**: logout/withdrawAccount 모두 동일 lock(`isLoggingOut`) 공유.
22. **Cross-context refresh API는 모두 lock gate**: silentRefresh/refreshUser entry + after-await 두 번 guard.
23. **Foreground network call에는 timeout 가드**: silentRefresh/refreshUser는 5s `Promise.race`. timeout 시 `setUser(null)` 절대 금지.
24. **OAuth re-link (same email + same provider)**: Kakao 재인증 시 새 providerId 발급 → DB의 기존 동일 email+provider 레코드의 providerId를 UPDATE. [V216]
25. **OAuth provider conflict → 409, 절대 500 금지**: 동일 email이 다른 provider로 이미 존재하면 `ConflictException("EMAIL_PROVIDER_CONFLICT:{provider}")` throw. create() 시도 금지 → duplicate key 500 발생. 프론트는 `error.response.data.message`로 파싱해 "이미 Google 계정으로 가입된 이메일" 메시지 표시. [V217]
26. **OAuth 취소는 reportError 제외**: KAKAO_SIGNIN_CANCELLED / GOOGLE_SIGNIN_CANCELLED / APPLE_SIGNIN_CANCELLED는 reportError 전송 금지. [V216]
27. **OAuth CSRF nonce 필수**: OAuth 시작 시 CSPRNG 16-byte nonce 생성 → session 저장(5분 TTL) → state = base64url({nonce, platform}). 콜백에서 nonce 검증 필수. 모바일(ios/android)은 custom scheme 보호로 nonce 검증 면제. [V220]
28. **Refresh token은 AsyncStorage 저장 금지**: 30일 TTL refresh token은 BACKUP_KEYS에서 제외. 15분 access token만 AsyncStorage 백업 허용. [V220]
29. **에러 메시지 i18n**: `throw new Error('ERROR_CODE')` + 핸들러에서 코드→i18n 매핑. `error.message` 직접 노출 금지.
