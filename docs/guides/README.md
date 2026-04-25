# 운영 가이드

운영/설정 절차 모음. 재현 필요 시 참조.

| 가이드 | 용도 |
|---|---|
| [backend-deployment.md](backend-deployment.md) | Hetzner VPS 배포 절차 (rsync + docker compose) |
| [backend-i18n.md](backend-i18n.md) | 17개 언어 i18n 구조 |
| [google-oauth-publish.md](google-oauth-publish.md) | Google OAuth 게시 (verification 절차) |
| [google-places-setup.md](google-places-setup.md) | Places API 설정 + Mapbox fallback chain |
| [google-search-console.md](google-search-console.md) | Search Console + sitemap 등록 |
| [kakao-oauth.md](kakao-oauth.md) | Kakao OAuth 검수 절차 |
| [iap-test.md](iap-test.md) | Google Play IAP 테스트 가이드 |
| [nginx-cache.md](nginx-cache.md) | nginx 캐시 최적화 |

## 추가 가이드 작성 시

- 명령어는 코드블록 + 주석
- 외부 API 변경 시 갱신 책임 명시 (예: "2026-04 검증, 1년에 1회 검증 필요")
- 실패 케이스 + 롤백 절차 포함
