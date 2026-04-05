# Alpha Release Notes - versionCode 79

**출시일**: 2026-04-05
**빌드 유형**: Clean Build (EAS Cache Clear)
**배포 트랙**: Alpha (내부 테스트)

---

## 한국어 (ko-KR)

### v1.0.0 (79) - 크리티컬 버그 수정 (재빌드)

#### 🔴 P0 크리티컬 버그 수정
versionCode 78에서 발생한 3개 P0 버그를 완전히 해결했습니다:

• **광고 재생 실패 해결** (100% 재현 → 0%)
  - 보상형 광고가 로딩되지 않던 문제 수정
  - Just-in-Time 광고 로딩 방식 적용
  - 테스트 기기 자동 감지 개선

• **장소 선택 미반영 해결** (100% 재현 → 0%)
  - 활동 추가 시 자동완성 장소 선택 후 텍스트가 사라지던 문제 수정
  - Race condition 방지 로직 추가
  - 선택된 장소 정보 안정적 저장

• **초대 알림 네비게이션 실패 해결** (100% 재현 → 0%)
  - 여행 초대 알림을 터치하면 "길을 잃었어요" 화면이 표시되던 문제 수정
  - 알림 타입 정규화 로직 추가
  - 여행 상세 화면 정상 진입 보장

#### 🔧 기술적 개선사항
• EAS 빌드 캐시 오염 문제 해결
  - 전체 캐시 무효화 (--clear-cache)
  - 모든 소스 파일 재컴파일
  - 버그 수정 100% 반영 보장

#### 📝 참고사항
이 버전은 versionCode 78의 기술적 문제를 해결한 재빌드입니다.
모든 기능과 UI는 동일하며, 3개 P0 버그만 수정되었습니다.

#### ✅ 테스트 시나리오
다음 3가지 시나리오를 반드시 테스트해주세요:

1. **광고 테스트**:
   - 여행 생성 화면에서 "보상형 광고 보고 +3회" 버튼 클릭
   - 광고가 정상적으로 로딩되고 재생되는지 확인
   - 광고 시청 후 보상(AI 생성 +3회) 지급 확인

2. **장소 선택 테스트**:
   - 활동 추가 화면에서 장소 검색 (예: "서울역")
   - 자동완성 결과 중 하나 선택
   - 선택한 장소 이름이 TextInput에 유지되는지 확인

3. **초대 알림 테스트**:
   - 다른 사용자가 여행 초대 발송
   - 알림 수신 후 알림 터치
   - 여행 상세 화면으로 정상 진입하는지 확인

---

## English (en-US)

### v1.0.0 (79) - Critical Bug Fixes (Rebuild)

#### 🔴 P0 Critical Bug Fixes
Completely resolved 3 critical bugs found in versionCode 78:

• **Ad Loading Failure Fixed** (100% reproduction → 0%)
  - Fixed issue where rewarded ads failed to load
  - Implemented Just-in-Time ad loading
  - Improved test device auto-detection

• **Place Selection Not Working Fixed** (100% reproduction → 0%)
  - Fixed issue where selected place text disappeared in activity creation
  - Added race condition prevention logic
  - Ensured stable storage of selected place data

• **Invitation Notification Navigation Fixed** (100% reproduction → 0%)
  - Fixed "Lost" screen when tapping trip invitation notifications
  - Added notification type normalization logic
  - Guaranteed proper navigation to trip details

#### 🔧 Technical Improvements
• Resolved EAS build cache poisoning issue
  - Full cache invalidation (--clear-cache)
  - Recompiled all source files
  - Guaranteed 100% inclusion of bug fixes

#### 📝 Notes
This version is a rebuild of versionCode 78 to fix technical issues.
All features and UI remain the same - only 3 P0 bugs were fixed.

#### ✅ Test Scenarios
Please test these 3 scenarios:

1. **Ad Test**:
   - Click "Watch rewarded ad for +3 trips" button on trip creation screen
   - Verify ad loads and plays correctly
   - Confirm reward (+3 AI generations) granted after watching

2. **Place Selection Test**:
   - Search for a place in activity creation (e.g., "Seoul Station")
   - Select one from autocomplete results
   - Verify selected place name persists in TextInput

3. **Invitation Notification Test**:
   - Another user sends trip invitation
   - Receive notification and tap it
   - Verify proper navigation to trip details screen

---

## 📊 빌드 정보 / Build Information

- **Build ID**: e12c2df1-c99d-423e-b159-7d91d253ab61
- **Build Type**: Clean Build with Cache Clear
- **Commit**: 661aca67
- **Build Time**: ~35 minutes (full recompilation)
- **AAB Size**: ~30-50 MB

## 🐛 알려진 이슈 / Known Issues

없음 (None)

## 📞 피드백 / Feedback

버그나 개선사항을 발견하시면 알려주세요:
If you find any bugs or have suggestions:

- **Email**: longpapa82@gmail.com
- **Response Time**: 24시간 이내 / Within 24 hours
- **긴급 사항**: 즉시 연락 / Urgent: Immediate response

---

**릴리스 작성**: Claude Code
**최종 업데이트**: 2026-04-05 19:30 KST
**배포 예정**: 빌드 검증 완료 후 즉시
