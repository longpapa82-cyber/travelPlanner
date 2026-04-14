# V113 Alpha 출시 노트 초안

**versionCode**: 113
**트랙**: Alpha (비공개 테스트)
**상태**: Draft (EAS 빌드 후 Play Console에서 수동 출시)
**Backend**: 배포 완료 (2026-04-14, 커밋 `a5a05a6c`)

---

## V113이 V112와 다른 점

V113은 V112에 V112 RCA 10건 전면 근본 수정 (5-Wave 작업)과 Frontend 계약
정렬이 추가된 버전입니다. V112의 UI 개선 사항은 그대로 유지되고, 다음의
사용자 체감 변경이 얹혀집니다:

1. **가입 흐름 재설계** — 가입 직후 받는 인증 코드 화면에서 코드를 입력하면
   **다시 로그인할 필요 없이** 바로 앱에 진입합니다. 기존에는 가입 후 인증
   코드를 받고, 인증하고, 다시 로그인 화면에서 이메일/비밀번호를 두 번째로
   입력해야 했습니다.
2. **미인증 계정 로그인** — 가입은 했지만 인증을 완료하지 않은 상태에서
   로그인하면 자동으로 인증 코드 화면으로 이동합니다. 앞에서 가입을 중단했던
   사람이 같은 이메일로 다시 가입해도 기존 계정을 이어서 인증할 수 있습니다.
3. **AI 여행 생성 취소 버튼** — AI 생성 중에 취소 버튼을 누르면 **서버
   작업이 실제로 중단**되고 월간 AI 생성 횟수(3/30회)가 **소모되지 않습니다**.
   기존에는 취소해도 서버는 계속 돌고 횟수가 차감됐습니다.
4. **광고 / 쿼터 / 취소 로그 정리** — 결제 보류(paywall), 월간 한도 초과,
   사용자 취소 같은 정상 비즈니스 흐름이 더 이상 에러 로그로 분류되지
   않아 관리자 대시보드의 노이즈가 제거됩니다.

---

## Play Console 출시 노트 — 한국어 (Korean)

```
V113 업데이트 - Alpha 테스트용

🎯 주요 개선 사항
• 가입 후 인증 코드 입력만으로 바로 앱 진입 (재로그인 불필요)
• 미인증 계정으로 로그인 시 자동으로 인증 화면 이동
• AI 여행 생성 중 취소 버튼이 서버 작업을 실제로 중단 (횟수 차감 없음)
• 비밀번호 변경 시 기존 세션 전부 무효화 (보안 강화)

🛠 안정성 개선
• 가입 중단 후 재시도 허용 (기존 미인증 정보 자동 교체)
• AI 생성 최대 90초 하드 타임아웃 (장시간 대기 방지)
• 관리자 에러 로그 정리 (정상 비즈니스 흐름을 에러로 오분류하던 문제 수정)

🔐 내부 개선
• 이메일 인증 흐름을 scope 제한 토큰으로 재설계 (보안 강화)
• AI 여행 생성 전체 트랜잭션화 (취소 시 쿼터 자동 롤백)

V112의 UI 개선 사항(코치마크 위치, 동의 화면 버튼, 구독 정보 표시 등)도 모두 포함되어 있습니다.

알파 테스터 여러분, 피드백 감사합니다! 🙏
```

---

## Play Console 출시 노트 — English

```
V113 Update - Alpha Testing Build

🎯 Key Improvements
• After sign-up, entering the verification code now lands you straight in the app (no re-login required)
• Logging in with an unverified account automatically navigates to the verification screen
• Cancel button during AI trip generation now actually stops the server job (your monthly quota is refunded)
• Changing your password now invalidates all existing sessions (security hardening)

🛠 Stability Improvements
• Retry-friendly sign-up: abandoned unverified registrations are automatically replaced on next attempt
• AI generation now has a hard 90-second timeout (no more hanging requests)
• Admin error log cleanup (paywall / quota / user cancel are no longer misclassified as errors)

🔐 Internal Improvements
• Email verification flow rebuilt with scope-restricted tokens (stronger isolation)
• AI trip creation wrapped in a single transaction (cancel → quota rollback is atomic)

All V112 UI improvements (coachmark positioning, consent screen button, subscription display, etc.) are also included.

Thank you Alpha testers for your feedback! 🙏
```

---

## Play Console 출시 노트 — 日本語 (Japanese)

```
V113 アップデート - アルファテスト版

🎯 主な改善
• 新規登録後、認証コード入力だけでアプリへ直接進めるように(再ログイン不要)
• 未認証アカウントでログインすると認証画面へ自動遷移
• AI旅行生成中のキャンセルボタンがサーバー処理を実際に停止(月間回数が戻ります)
• パスワード変更時に既存セッションを全て無効化(セキュリティ強化)

🛠 安定性の改善
• 登録中断後の再試行を許可(未認証の既存情報を自動で置き換え)
• AI生成に最大90秒のハードタイムアウトを追加
• 管理者エラーログの整理(正常な業務フローがエラーと誤分類される問題を修正)

🔐 内部改善
• メール認証フローをスコープ制限トークンで再構築
• AI旅行生成を単一トランザクション化(キャンセル時のクォータロールバックが原子的に)

V112のUI改善(コーチマーク位置、同意画面ボタン、購読情報表示など)もすべて含まれています。

アルファテスターの皆様、フィードバックありがとうございます! 🙏
```

---

## 빌드 명령

```bash
cd frontend
eas build --profile production --platform android --auto-submit
```

- `autoIncrement: true` + `appVersionSource: "local"`이므로 EAS가 app.json의
  versionCode(113)를 기준으로 빌드. 다음 빌드는 114로 자동 증가.
- `--auto-submit`이 `eas.json`의 `submit.production.android.track: "alpha"`를
  참조하여 Alpha 트랙에 draft 업로드 (수동으로 "Alpha에 출시" 클릭 필요).

---

## 배포 전 최종 체크리스트

- [x] Backend V112 waves 1-5 배포 완료 (commit `a5a05a6c`)
- [x] 프로덕션 smoke test 4/4 PASS (EMAIL_NOT_VERIFIED 계약 동작 확인)
- [x] Frontend TypeScript 0 errors, Jest 205/209 (V111 drift는 무관)
- [x] app.json versionCode 113으로 bump
- [x] V113 release notes 3개 언어 작성 (이 파일)
- [ ] `eas build --profile production --platform android --auto-submit` 실행
- [ ] EAS 빌드 완료 알림 수신 (15~25분)
- [ ] Play Console → Alpha → 초안 버전 113 확인 + 출시 노트 복사
- [ ] "Alpha에 출시" 버튼 클릭
- [ ] Alpha 테스터 기기에서 업데이트 수신 확인

---

## Alpha 테스터 검증 시나리오 (V113 신규)

V111 7건 회귀 검증 외에 **V113에서 추가로 검증해야 하는 시나리오**:

### A. 가입 → 인증 → 바로 앱 진입 (한 흐름)
1. 새 이메일로 가입
2. 가입 직후 인증 코드 화면 자동 노출
3. 받은 6자리 코드 입력
4. **재로그인 화면 없이** 바로 홈 화면 진입
5. 프로필 확인 → 이메일 인증됨 표시

### B. 미인증 재진입
1. 시나리오 A에서 코드를 받고 **인증하지 않고** 앱 종료
2. 같은 이메일로 **다시 가입 시도** → 에러 없이 성공해야 함 (backend가 in-place refresh)
3. 새로 받은 코드로 인증 → 앱 진입

### C. 미인증 로그인
1. 시나리오 A에서 코드를 받고 **인증하지 않고** 앱 종료
2. **로그인 화면**에서 동일 이메일/비밀번호 입력
3. **자동으로 인증 코드 화면으로 이동** (에러 메시지 없이)
4. 코드 입력 → 앱 진입

### D. AI 여행 생성 취소 + 쿼터 롤백
1. 프로필 화면에서 현재 `aiTripsUsedThisMonth` 기록
2. 새 AI 여행 생성 시작
3. AI 생성 중 **취소 버튼** 누름
4. "Trip creation cancelled" 토스트 확인
5. 프로필 화면으로 이동 → `aiTripsUsedThisMonth`가 **증가하지 않았는지** 확인 (롤백 성공)

### E. 비밀번호 변경 → 이전 세션 무효화
1. 설정 → 비밀번호 변경
2. 새 비밀번호 입력 후 저장
3. 앱이 자동으로 로그아웃되거나, 수동 로그아웃 후 재로그인 성공
4. (고급) 두 기기에서 동일 계정 로그인 상태에서 한쪽 비밀번호 변경 시
   다른 기기가 다음 refresh 시점에 로그아웃되는지 확인

---

## 출시 후 모니터링 (첫 24시간)

### Backend 로그 모니터링
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner && docker compose logs --tail=200 -f backend"
```

주시할 것:
- `cleanupUnverifiedRegistrations`: 시간당 1회, 정상적으로 0건 삭제 로그 OR 실제 삭제 건수
- `Job ... cancelled by user`: AI 생성 취소 발생 시 로그
- `EMAIL_NOT_VERIFIED` 응답 빈도: 미인증 로그인 시도 통계
- 5xx 에러 급증 여부 (새 계약이 기존 클라이언트와 충돌하지는 않는지)
- `pending_verification` scope 토큰 관련 경고 로그

### 롤백 절차 (문제 발생 시)

```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127
cd /root/travelPlanner/backend
# 배포 전 백업 디렉토리로 복원
rm -rf src
cp -r src.backup-20260414-214056 src
cd ..
docker compose build backend
docker compose up -d backend
# Frontend: Play Console에서 이전 Alpha 빌드(versionCode 112)로 promotion
```

Backend 롤백 타임스탬프: `20260414-214056`
