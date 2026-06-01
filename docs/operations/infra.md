# 인프라/자격증명

## 서버
- **IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com` | DNS: Cloudflare (Proxied)
- **SSH 키**: `~/.ssh/travelplanner-oci`

## 앱 식별자
- **패키지명**: `com.longpapa82.travelplanner` (Android + iOS 동일)
- **Play 앱 ID**: 4975949156119360543
- **App Store App ID (ascAppId)**: `6766147060`
- **Apple Team ID**: `VC5L9S5QPX`

## 서명 키
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`

## SNS 로그인 클라이언트 ID
| Provider | Client ID | 비고 |
|----------|-----------|------|
| Google (Web) | `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3` | webClientId |
| Google (iOS) | `48805541090-9gh3sp9asspe3d1et4er2pqpihm2bg47` | iosClientId |

## RevenueCat
- **Android SDK 키**: `goog_BeyiIKXfhmqtbtzaEGMRICChtQd`
- **iOS SDK 키**: `appl_DtHjfizXdnNUxlHKhZKHuoZKYLe`
- **RTDN**: `projects/tripplanner-486511/topics/play-billing`

## IAP 가격
| 플랜 | 가격 |
|------|------|
| Monthly | $3.99 |
| Yearly | $29.99 |

## 광고
- **AdMob Android App ID**: `ca-app-pub-7330738950092177~5475101490`

## 모니터링
- **Sentry DSN**: `de.sentry.io` (Germany region) — 전체 DSN은 eas.json 참조
- **Service Account**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`

## API 비용 (10,000건 기준)
| API | 비용 |
|-----|------|
| OpenAI GPT-4o-mini (Prompt Caching) | ~$110 |
| Google Geocoding | $15 |
| OpenWeather/LocationIQ | $0 |
| **합계** | **~$125** (~17원/건) |
