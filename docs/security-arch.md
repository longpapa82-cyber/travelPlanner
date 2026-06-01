# 보안 아키텍처

## 7개 레이어

1. **Auth**: JWT 15m access + one-time refresh (Redis jti, eviction=reject) + bcrypt 12 + CSPRNG 2FA (backup codes SHA-256 hashed) + account lockout
2. **Access**: Rate limiting all auth endpoints + AdminGuard (server isAdmin flag) + PendingVerificationGuard
3. **Transport**: HSTS preload + CSP (no unsafe-inline, no unsafe-eval) + Referrer-Policy + CORS whitelist
4. **Data**: SELECT FOR UPDATE on password reset, SQL-level share token expiry, stripHtml DTO
5. **OAuth**: CSRF nonce (CSPRNG 16-byte, base64url JSON state, 5분 TTL, session 검증) — V220. 모바일은 custom scheme 보호로 면제.
6. **Storage**: Refresh token AsyncStorage 저장 제거 (15분 access token만 백업) — V220
7. **Monitoring**: Sentry — 네이티브 크래시, JS 에러, 느린 API (>10s), ANR
