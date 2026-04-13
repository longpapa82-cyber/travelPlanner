# V112 Alpha 출시 노트 초안

**versionCode**: 112
**빌드 ID**: 6f9fdbad-5191-4622-987d-f412a992a600
**트랙**: Alpha (비공개 테스트)
**상태**: Draft (Play Console에서 수동 출시 필요)

---

## Play Console 출시 노트 — 한국어 (Korean)

```
V112 업데이트 - Alpha 테스트용

🛠 버그 수정
• 이메일 인증 에러 메시지를 자연스럽고 이해하기 쉬운 표현으로 개선
• 서비스 이용 동의 화면의 [동의하고 시작하기] 버튼 위치를 보기 편하게 조정
• 홈 화면의 AI 여행 계획 만들기 안내 박스 위치 정확도 개선
• 광고 재생 중 표시되던 메시지가 광고에 가려지던 문제 해결
• 구독 화면에 구독 시작일, 다음 결제일, 월간/연간 플랜 정보 표시
• 구독자에게 AI 자동 생성 횟수가 정확히 표시되도록 수정 (30회 월간 한도 반영)

🔐 내부 개선
• 결제 시스템 안정화 (RevenueCat 웹훅 파이프라인 복구)
• 서버 보안 강화 (요청 인증 timing-safe 비교 적용)

알파 테스터 여러분, 피드백 감사합니다! 🙏
```

---

## Play Console 출시 노트 — English

```
V112 Update - Alpha Testing Build

🛠 Bug Fixes
• Improved email verification error messages to be clearer and more user-friendly
• Adjusted the "Agree and Start" button placement on the consent screen for easier access
• Fixed the highlight box position on the home screen's "Create AI Trip" tutorial
• Resolved the issue where in-ad messages were hidden behind interstitial ads
• Subscription screen now displays start date, next billing date, and monthly/annual plan info
• Corrected AI trip counter for subscribers to reflect the 30-trip monthly limit

🔐 Internal Improvements
• Subscription sync pipeline restored (RevenueCat webhook recovery)
• Server-side security hardening (timing-safe secret comparison)

Thank you Alpha testers for your feedback! 🙏
```

---

## Play Console 출시 노트 — 日本語 (Japanese)

```
V112 アップデート - アルファテスト版

🛠 バグ修正
• メール認証エラーメッセージをより分かりやすい表現に改善
• 利用規約同意画面の「同意して始める」ボタン位置を調整
• ホーム画面の「AI旅行プラン作成」ガイドボックスの位置精度を改善
• 広告再生中にメッセージが広告の裏に隠れる問題を修正
• 購読画面に開始日・次回請求日・月額/年額プラン情報を表示
• 購読者向けAI自動生成回数の表示を修正(月間30回上限を反映)

🔐 内部改善
• 決済システムの安定化(RevenueCat webhookパイプライン復旧)
• サーバーセキュリティ強化(タイミングセーフ比較を適用)

アルファテスターの皆様、フィードバックありがとうございます! 🙏
```

---

## Play Console에서 출시 버튼 누르기 직전 최종 체크

- [ ] EAS 빌드 완료 알림 수신
- [ ] Play Console → 앱 → 비공개 테스트 → Alpha → 새 초안 버전 112 확인
- [ ] 위 출시 노트 중 하나를 복사해 붙여넣기
- [ ] 이전 버전과의 변경 사항 검토
- [ ] "출시 검토" 버튼 클릭
- [ ] 문제가 없으면 "Alpha에 출시" 클릭
- [ ] 테스터 기기에서 업데이트 받는 데 최대 수 시간 소요될 수 있음

---

## 출시 후 모니터링 (첫 24시간)

### Backend 로그 모니터링
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner && docker compose logs --tail=200 -f backend"
```

주시할 것:
- `RevenueCat event` 처리 로그
- `5xx` 에러 급증
- `ThrottlerException` 패턴

### Play Console 모니터링
- Alpha 크래시 리포트 (Pre-launch 리포트 포함)
- ANR(Application Not Responding) 발생 여부
- 테스터 설치 수/업데이트 성공률

### RevenueCat 대시보드
- Customers 탭에서 신규 고객 등록 확인
- Webhook 탭에서 Failed 이벤트 0건 유지 확인
