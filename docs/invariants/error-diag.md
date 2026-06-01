# 불변식: 에러/진단 (#35~39)

35. **Diagnostic data DTO는 permissive**: `IsObject({each:true}) + ArrayMaxSize(N)`. nested DTO + forbidNonWhitelisted 금지.
36. **진단 인프라는 자기 자신을 보호**: reportError 실패 시 AsyncStorage queue(50 FIFO) + drain. silent `.catch(() => {})` 금지.
37. **PII strip before reportError**: url query string 제거 후 전송. `url.split('?')[0]` 패턴.
38. **Production fail-fast for required env**: production에서 필수 env 미설정 시 startup throw.
39. **에러 코드는 i18n 키로만**: `throw new Error('ERROR_CODE')` 형식. `error.message` 직접 UI 노출 금지.
