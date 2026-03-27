# Release Notes - versionCode 37

## Play Console 출시 노트 (3개 언어)

### 한국어 (ko-KR)
```
보안 강화 및 안정성 개선

• 비밀번호 재설정 보안 강화
• 이메일 인증 보안 강화
• 데이터베이스 보안 향상
• 전반적인 안정성 개선

이번 업데이트로 더욱 안전하게 여행을 계획하세요!
```

### 영어 (en-US)
```
Security Enhancements and Stability Improvements

• Enhanced password reset security
• Improved email verification security
• Database security improvements
• Overall stability enhancements

Plan your trips more securely with this update!
```

### 일본어 (ja-JP)
```
セキュリティ強化と安定性の向上

• パスワードリセットのセキュリティ強化
• メール認証のセキュリティ向上
• データベースセキュリティの改善
• 全体的な安定性の向上

このアップデートでより安全に旅行を計画できます！
```

---

## 기술 변경 사항 (개발자용)

### P0 수정
- Password reset token SHA-256 hashing (plaintext → hashed storage)

### P1 수정
- Email verification token SHA-256 hashing (plaintext → hashed storage)

### 보안 영향
- Database compromise 시에도 토큰 재사용 불가
- Token theft 방지 강화
- OWASP Top 10 compliance 개선

### 파일 변경
- `backend/src/users/users.service.ts`: `generatePasswordResetToken()`, `resetPassword()`, `generateEmailVerificationToken()`, `verifyEmail()` - SHA-256 해싱 추가

### 배포 정보
- Backend: Hetzner VPS (manual deployment)
- Frontend: versionCode 37, Build ID b62f0d12-c3e1-41fa-adc9-15ab98c77de4
- AAB: https://expo.dev/artifacts/eas/ouPkMsbob8uueZjxeCT9r3.aab
