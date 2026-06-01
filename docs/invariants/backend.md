# 불변식: 데이터/백엔드 (#40~43)

40. **Webhook idempotency는 atomic transaction**: idempotency INSERT 실패 시 fall-through 금지. 5xx throw → RC retry.
41. **Server-side defensive coercion for numeric DB**: INSERT 직전 `Math.floor + clamp(min, max)`.
42. **expo-file-system은 legacy 경로**: `import('expo-file-system/legacy')` 사용.
43. **PII 포함 진단 데이터는 보관 기한 + purge**: error_logs/audit_logs는 Cron purge 필수 (90/30일).
