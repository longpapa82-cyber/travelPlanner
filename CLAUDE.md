# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태

- **Android**: versionCode 220 — 프로덕션 검토 중 (177개 국가)
- **iOS**: 1.0.0 (2) — TestFlight 처리 중
- **서버**: https://mytravel-planner.com — 배포 완료
- **브랜치**: `main`

## 🎯 다음 작업

1. iOS TestFlight 빌드 2 확인 → 내부 테스트 (Apple/Google/Kakao 로그인)
2. Android V220 프로덕션 검토 통과 확인 → Git commit

> 상세 현황: `docs/status.md`

---

## 🔗 빠른 참조

| 목적 | 파일 |
|------|------|
| 전체 버전 이력 + 다음 할 일 | `docs/status.md` |
| 불변식 45개 (결제/인증/UI/에러/백엔드/법적) | `docs/invariants/README.md` |
| 배포 절차 (backend/Android/iOS) | `docs/operations/deploy.md` |
| 인프라/자격증명/비용 | `docs/operations/infra.md` |
| 보안 아키텍처 7개 레이어 | `docs/security-arch.md` |
| V174~V210 버그 RCA | `docs/archive/version-rcas/v174-v210-rca.md` |

---

## ⚡ 자주 쓰는 명령어

```bash
# 백엔드 배포
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/ && \
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"

# Android AAB 빌드
eas build --platform android --profile production --local --output ../build-vXXX.aab

# iOS 빌드
eas build --platform ios --profile production-ios

# 정적 검증
npm run validate:static
```

---

## 🔐 핵심 불변식 요약

> 전체 45개: `docs/invariants/` — 위반 시 phantom 구독, 보안 취약점, 결제 버그 재발

- **결제**: RC logOut on logout 필수 | server tier authoritative | preflight dual-source | fail-close
- **인증**: isLoggingOut lock | OAuth CSRF nonce (V220) | refresh token AsyncStorage 금지 (V220)
- **UI**: KAV behavior="height" 금지 | Animated cleanup 필수
- **에러**: PII strip before reportError | production fail-fast for required env
