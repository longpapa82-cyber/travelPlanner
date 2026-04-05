# Phase 0b Deployment Checklist
**versionCode 76 - Alpha Track**

## 🎯 Pre-Deployment Checklist

### Code Quality ✅
- [x] Backend TypeScript: 0 errors
- [x] Frontend TypeScript: 0 errors
- [x] Jest tests: 597/597 passing
- [x] ESLint: No critical warnings
- [x] Git commits: 3 commits pushed
  - `27e7341a` Backend
  - `ccd08874` Frontend
  - `db832bb6` Integration

### Build Status ✅
- [x] EAS Build completed
- [x] Build ID: 63527a79-f85d-47bc-9277-e7ec3826cba3
- [x] versionCode: 76
- [x] AAB file size: Acceptable
- [x] Build logs: No errors

### Backend Deployment ✅
- [x] Database migration executed
  - `user_consents` table created
  - `consent_audit_logs` table created
- [x] API endpoints tested:
  - `GET /api/users/me/consents` ✅
  - `POST /api/users/me/consents` ✅
- [x] Production server deployed (Hetzner VPS)
- [x] Health check passed

### Frontend Integration ✅
- [x] ConsentScreen renders correctly
- [x] ConsentContext integrated
- [x] RootNavigator conditional rendering
- [x] Dark/Light mode support
- [x] i18n ko/en translations
- [x] Toast notifications working

---

## 📱 Deployment Steps

### 1. Download AAB File
```bash
curl -o travelplanner-v76.aab \
  https://expo.dev/artifacts/eas/dgmxi5FpBDcJwL4eppXeTr.aab
```
- [ ] AAB file downloaded
- [ ] File size verified (~30-50 MB)

### 2. Google Play Console Login
- [ ] Navigate to https://play.google.com/console
- [ ] Select "TravelPlanner" app
- [ ] Go to: 테스트 → 비공개 테스트 → Alpha

### 3. Create New Release
- [ ] Click "새 출시 만들기"
- [ ] Upload AAB file: `travelplanner-v76.aab`
- [ ] Set release name: `v1.0.0 (76) - Phase 0b 사용자 동의 시스템`

### 4. Add Release Notes

#### 한국어 (ko-KR)
```
v1.0.0 (76) - 사용자 동의 시스템 추가

🔐 개인정보 보호 강화
• 서비스 이용약관 및 개인정보 처리방침 동의 기능 추가
• 위치 정보, 알림, 사진 권한 등 선택적 동의 관리
• GDPR/CCPA 준수 법적 요구사항 충족

✨ 새로운 기능
• 초기 실행 시 동의 화면 표시
• 정책 업데이트 시 자동 재동의 요청
• 동의 이력 관리 및 감사 로그 기록

🌐 다국어 지원
• 한국어, 영어 지원 (13개 언어 확장 예정)

📱 개선사항
• 다크/라이트 모드 완벽 지원
• 직관적인 전체 동의 기능
```

#### 영어 (en-US)
```
v1.0.0 (76) - User Consent Management System

🔐 Enhanced Privacy Protection
• Added Terms of Service and Privacy Policy consent functionality
• Optional consent management for location, notifications, photos
• GDPR/CCPA compliance requirements met

✨ New Features
• Consent screen displayed on first launch
• Automatic re-consent request when policies are updated
• Consent history management and audit logging

🌐 Multi-language Support
• Korean and English supported (13 languages planned)

📱 Improvements
• Full dark/light mode support
• Intuitive "Agree to All" functionality
```

- [ ] Korean release notes added
- [ ] English release notes added

### 5. Review & Submit
- [ ] Click "출시 검토"
- [ ] Verify all information
- [ ] Click "출시 시작"

### 6. Notify Alpha Testers
- [ ] Send email to alpha testers
- [ ] Include test link: https://play.google.com/apps/testing/com.longpapa82.travelplanner
- [ ] Attach `alpha-tester-guide-v76.md`
- [ ] Set test deadline: 2026-04-07

---

## 📊 Post-Deployment Monitoring

### First 24 Hours
- [ ] Check Sentry for crashes (target: < 0.5%)
- [ ] Monitor backend API errors (target: < 1%)
- [ ] Review consent submission rates
- [ ] Check alpha tester feedback

### First 48 Hours
- [ ] Collect test scenario results (7 scenarios)
- [ ] Categorize bugs: P0/P1/P2
- [ ] Respond to tester questions
- [ ] Update deployment guide if needed

### First Week
- [ ] Analyze consent rates by type
- [ ] Review UX feedback
- [ ] Plan Phase 0c (if needed)
- [ ] Prepare production rollout plan

---

## 🐛 Rollback Plan

### Trigger Conditions
- [ ] P0 bug discovered (app crash, login failure)
- [ ] 30%+ testers report ConsentScreen not working
- [ ] Backend API 500 error rate > 5%

### Rollback Steps
1. **Play Console**:
   - [ ] Rollback to versionCode 72
   - [ ] Add rollback note in release notes

2. **Backend** (if needed):
   ```bash
   ssh root@46.62.201.127
   cd /root/travelPlanner/backend
   git reset --hard <previous-commit>
   docker compose down && docker compose up -d
   ```

3. **Database** (if needed):
   ```sql
   DROP TABLE IF EXISTS "user_consents" CASCADE;
   DROP TABLE IF EXISTS "consent_audit_logs" CASCADE;
   DELETE FROM "migrations" WHERE "name" = 'AddUserConsentsTable1740700000000';
   ```

4. **Communication**:
   - [ ] Notify alpha testers
   - [ ] Create GitHub issue (P0)
   - [ ] Estimate fix time (2-4 hours)

---

## 📈 Success Metrics

### Technical Metrics
- **ConsentScreen Load Time**: < 200ms ✅
- **API Response Time**:
  - GET /consents: < 200ms ✅
  - POST /consents: < 500ms ✅
- **App Crash Rate**: < 0.5%
- **API Error Rate**: < 1%

### User Metrics
- **ConsentScreen Completion Rate**: > 95%
- **"Agree to All" Usage**: 70-80%
- **Required Consent Accept Rate**: 100%
- **Optional Consent Rates**:
  - Location: > 60%
  - Notification: > 70%
  - Photo: > 50%
  - Marketing: > 30%

### Business Metrics
- **Alpha Tester Participation**: 100% (all 7 scenarios)
- **Bug Discovery Rate**: < 3 P0 bugs
- **Time to Production**: 1-2 weeks

---

## 📝 Documentation

### Created Documents ✅
- [x] `phase-0b-alpha-deployment-guide.md` (Comprehensive guide)
- [x] `alpha-tester-guide-v76.md` (Tester instructions)
- [x] `phase-0b-deployment-checklist.md` (This file)

### Existing Documents
- [x] `CLAUDE.md` updated (Phase 0b status)
- [x] `docs/qa-master-plan.md` referenced
- [x] `docs/archive/bug-history-2026-03.md` referenced

---

## 🎉 Completion Criteria

### All Green ✅
- [x] Code quality checks passed
- [x] Build successful
- [x] Backend deployed
- [x] Documentation complete
- [ ] Play Console release created
- [ ] Alpha testers notified
- [ ] Monitoring dashboards ready

### Ready for Production
- [ ] 7-day alpha test completed
- [ ] 0 P0 bugs remaining
- [ ] < 3 P1 bugs remaining
- [ ] User feedback incorporated
- [ ] Final QA passed

---

## 📞 Contact Information

**Support Email**: longpapa82@gmail.com
**Response Time**: Within 24 hours
**Escalation**: For P0 bugs, immediate response

---

**Last Updated**: 2026-04-05
**Deployment Status**: ✅ Ready for Alpha
**Next Review**: 2026-04-07 (Post-Alpha Testing)
