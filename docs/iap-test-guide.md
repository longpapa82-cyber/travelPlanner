# Google Play 인앱 구매(IAP) 테스트 가이드

## 결론부터: 실제 금액 차감 없이 테스트 가능합니다! ✅

## 방법 1: 라이선스 테스터 (추천) 💯

### 특징
- ✅ **완전 무료** - 실제 금액 차감 없음
- ✅ **즉시 테스트** - 대기 시간 없음
- ✅ **무제한 반복** - 구독/취소 자유롭게 테스트 가능
- ✅ **실제 플로우** - 프로덕션과 동일한 구매 흐름

### 현재 상태
CLAUDE.md Line 25에 따르면:
- ✅ **라이선스 테스터**: 이미 등록 완료
- ✅ **IAP 테스트 구매**: 성공 (테스트 카드, 라이선스 테스터)

### 설정 확인 방법

#### 1. Play Console에서 라이선스 테스터 확인
```
Play Console → 설정 → 라이선스 테스팅
```

등록된 이메일 목록:
- longpapa82@gmail.com (본인 계정 확인 필요)
- j090723@naver.com (테스트 계정)
- 기타 테스터 계정들

#### 2. 테스터 추가 방법 (필요 시)
```
Play Console → 설정 → 라이선스 테스팅
→ "라이선스 테스터 추가" 클릭
→ 이메일 주소 입력 (최대 100명)
→ 저장
```

### 테스트 실행 방법

#### Step 1: 앱 설치
```
Play Store → MyTravel 검색
→ Alpha 트랙 참여 (라이선스 테스터만 보임)
→ 설치
```

#### Step 2: 구독 구매 시도
```
앱 실행 → 프로필 → 프리미엄 구독
→ Monthly ($3.99) 또는 Yearly ($29.99) 선택
→ Google Play 결제 화면 표시
```

#### Step 3: 테스트 카드로 결제
라이선스 테스터로 등록된 계정은:
- **"테스트 카드"** 표시 확인
- **실제 카드 정보 입력 불필요**
- **금액 차감 없음** (0원)
- 즉시 구독 활성화

#### Step 4: 구독 상태 확인
```
앱 내: 프로필 → 구독 상태 "Premium" 표시
Play Store: 계정 → 결제 및 정기 결제 → "MyTravel Premium" 확인
RevenueCat: Dashboard → Customers → 구독 이벤트 확인
```

#### Step 5: 취소 및 재구독 테스트
```
Play Store → 정기 결제 → MyTravel Premium → 취소
→ 앱에서 "Free" 상태로 복귀 확인
→ 다시 구독 시도 (무제한 반복 가능)
```

---

## 방법 2: 실제 테스트 결제 (선택적)

### 특징
- ⚠️ **실제 결제** - 신용카드에서 일시 차감
- ✅ **즉시 환불** - 자동 환불되거나 수동 환불 가능
- ✅ **프로덕션 검증** - 실제 사용자 경험과 100% 동일

### 언제 사용?
1. **프로덕션 출시 직전** 최종 검증
2. **결제 오류 디버깅** 시 실제 환경 재현
3. **외부 QA 팀** 테스트 (라이선스 테스터 아닌 경우)

### 실행 방법

#### Step 1: 소액 테스트 SKU 생성 (선택적)
```
Play Console → 수익 창출 설정 → 제품 → 정기 결제
→ "테스트 프리미엄" SKU 생성
→ 가격: $0.99 (최소 금액)
→ 상태: 활성
```

#### Step 2: 실제 카드로 구매
```
앱 설치 (Alpha 또는 Production 트랙)
→ 구독 선택 ($0.99 테스트 SKU 또는 실제 상품)
→ 실제 신용카드 정보 입력
→ 결제 완료 (실제 차감됨)
```

#### Step 3: 즉시 환불
```
Play Console → 주문 관리
→ 해당 거래 찾기
→ "환불" 클릭
→ 전액 환불 (수수료 없음)
```

또는 자동 환불 설정:
```
Play Console → 설정 → 테스트 거래
→ "테스트 구매 자동 환불" 활성화
→ 구매 후 5분 내 자동 환불
```

---

## RevenueCat 통합 테스트

### 현재 상태 (CLAUDE.md Line 37-50)
- ✅ RevenueCat 연동 완료
- ✅ Google Play 서비스 계정 연결
- ✅ RTDN (실시간 알림) 설정 완료
- ✅ 테스트 알림 성공

### 테스트 시나리오

#### 1. 구독 이벤트 추적
```
RevenueCat Dashboard → Customers
→ 테스터 이메일로 검색
→ Events 탭에서 확인:
  - initial_purchase (최초 구매)
  - renewal (갱신)
  - cancellation (취소)
  - expiration (만료)
```

#### 2. Webhook 테스트
```
RevenueCat Dashboard → Integrations → Webhooks
→ Test 버튼 클릭
→ Backend 로그에서 수신 확인:
  POST /api/subscriptions/webhook
  → subscriptionService.handleWebhook() 호출
  → DB 업데이트 확인
```

#### 3. 앱 내 상태 동기화
```
앱 실행 → 프로필 화면
→ subscriptionTier 확인 (free/premium)
→ subscriptionExpiresAt 날짜 확인
→ 구독 취소 시 즉시 "free" 전환 확인
```

---

## 구독 상품 정보 (CLAUDE.md Line 33)

현재 설정된 가격:
- **Monthly**: $3.99 (KRW 5,500)
- **Yearly**: $29.99 (KRW 44,000)
- **전 국가 자동 환산 적용**

---

## 트러블슈팅

### 문제 1: "테스트 카드"가 표시되지 않음
**원인**: 라이선스 테스터 미등록
**해결**:
```
Play Console → 설정 → 라이선스 테스팅
→ 사용 중인 Google 계정 추가
→ 앱 재설치 (캐시 클리어)
```

### 문제 2: 구매 후 앱에서 Premium 표시 안 됨
**원인**: RevenueCat 동기화 지연
**해결**:
```
앱 재시작 (강제 종료 후 재실행)
→ ProfileScreen에서 "구독 상태 새로고침" 버튼 (있으면)
→ Backend 로그 확인:
  POST /api/subscriptions/webhook
```

### 문제 3: 실제 카드로 결제되어버림
**원인**: 라이선스 테스터 설정 전에 구매 시도
**해결**:
```
Play Console → 주문 관리
→ 해당 거래 전액 환불
→ 라이선스 테스터 등록 후 재시도
```

---

## 권장 테스트 시나리오

### 시나리오 1: 신규 사용자 구독
1. 라이선스 테스터로 앱 설치
2. 회원가입 (Google Sign-In)
3. 프로필 → 프리미엄 구독 선택
4. Monthly ($3.99) 선택
5. "테스트 카드"로 결제
6. 앱에서 Premium 배지 확인
7. AI 여행 생성 30회 확인

### 시나리오 2: 구독 취소
1. Play Store → 정기 결제 → 취소
2. RevenueCat Dashboard에서 cancellation 이벤트 확인
3. 앱에서 Free 상태 전환 확인
4. AI 여행 생성 3회 제한 확인

### 시나리오 3: 구독 갱신
1. 라이선스 테스터는 즉시 갱신 가능
2. Play Console → 주문 관리에서 갱신 기록 확인
3. RevenueCat → renewal 이벤트 확인
4. 앱에서 subscriptionExpiresAt 날짜 연장 확인

### 시나리오 4: 결제 실패 복구
1. RevenueCat Dashboard → Test Event 전송
   - billing_issue
2. 앱에서 "결제 수단 업데이트" 알림 확인
3. 결제 수단 재입력
4. 구독 복구 확인

---

## 체크리스트

### 테스트 전
- [ ] 라이선스 테스터 등록 확인
- [ ] RevenueCat 연동 확인
- [ ] RTDN 설정 확인
- [ ] Backend webhook 엔드포인트 작동 확인

### 테스트 중
- [ ] "테스트 카드" 표시 확인 (실제 결제 아님)
- [ ] 구매 완료 후 앱 내 Premium 표시
- [ ] AI 여행 생성 30회 확인
- [ ] RevenueCat Dashboard 이벤트 확인

### 테스트 후
- [ ] 구독 취소 테스트
- [ ] Free 티어로 복귀 확인
- [ ] AI 여행 생성 3회 제한 확인
- [ ] Backend 로그에 webhook 수신 확인

---

## 참고 문서

- **Google Play 라이선스 테스팅**: https://support.google.com/googleplay/android-developer/answer/6062777
- **RevenueCat 테스트 가이드**: https://www.revenuecat.com/docs/test-and-launch/sandbox
- **Play Console 인앱 상품 설정**: https://support.google.com/googleplay/android-developer/answer/1153481

---

**작성일**: 2026-03-27
**작성자**: SuperClaude
**상태**: 라이선스 테스터 설정 완료, 즉시 테스트 가능
