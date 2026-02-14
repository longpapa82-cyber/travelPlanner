type SupportedLang = 'ko' | 'en' | 'ja';

const translations: Record<string, Record<SupportedLang, string>> = {
  'password.enterBoth': {
    ko: '현재 비밀번호와 새 비밀번호를 입력해주세요.',
    en: 'Please enter both current and new passwords.',
    ja: '現在のパスワードと新しいパスワードを入力してください。',
  },
  'password.minLength': {
    ko: '새 비밀번호는 8자 이상이어야 합니다.',
    en: 'New password must be at least 8 characters.',
    ja: '新しいパスワードは8文字以上である必要があります。',
  },
  'account.deleted': {
    ko: '계정이 삭제되었습니다.',
    en: 'Account has been deleted.',
    ja: 'アカウントが削除されました。',
  },
  'password.socialNotAllowed': {
    ko: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
    en: 'Social login accounts cannot change password.',
    ja: 'ソーシャルログインアカウントではパスワードを変更できません。',
  },
  'password.currentInvalid': {
    ko: '현재 비밀번호가 일치하지 않습니다.',
    en: 'Current password is incorrect.',
    ja: '現在のパスワードが正しくありません。',
  },
  'password.changed': {
    ko: '비밀번호가 변경되었습니다.',
    en: 'Password has been changed.',
    ja: 'パスワードが変更されました。',
  },
  'timezone.noDifference': {
    ko: '시차 없음',
    en: 'No time difference',
    ja: '時差なし',
  },
  'timezone.hours': {
    ko: '시간',
    en: 'h',
    ja: '時間',
  },
  'timezone.minutes': {
    ko: '분',
    en: 'min',
    ja: '分',
  },
  'timezone.ahead': {
    ko: '빠름',
    en: 'ahead',
    ja: '進み',
  },
  'timezone.behind': {
    ko: '느림',
    en: 'behind',
    ja: '遅れ',
  },
  'email.verification.sent': {
    ko: '인증 이메일이 발송되었습니다.',
    en: 'Verification email has been sent.',
    ja: '認証メールを送信しました。',
  },
  'email.verification.invalid': {
    ko: '유효하지 않은 인증 토큰입니다.',
    en: 'Invalid verification token.',
    ja: '無効な認証トークンです。',
  },
  'email.verification.expired': {
    ko: '인증 토큰이 만료되었습니다.',
    en: 'Verification token has expired.',
    ja: '認証トークンの有効期限が切れています。',
  },
  'email.verification.success': {
    ko: '이메일이 성공적으로 인증되었습니다.',
    en: 'Email has been verified successfully.',
    ja: 'メールアドレスが正常に認証されました。',
  },
  'email.already.verified': {
    ko: '이미 인증된 이메일입니다.',
    en: 'Email is already verified.',
    ja: 'メールアドレスはすでに認証済みです。',
  },
  'password.reset.sent': {
    ko: '비밀번호 재설정 이메일이 발송되었습니다.',
    en: 'Password reset email has been sent.',
    ja: 'パスワードリセットメールを送信しました。',
  },
  'password.reset.invalid': {
    ko: '유효하지 않은 재설정 토큰입니다.',
    en: 'Invalid reset token.',
    ja: '無効なリセットトークンです。',
  },
  'password.reset.expired': {
    ko: '재설정 토큰이 만료되었습니다.',
    en: 'Reset token has expired.',
    ja: 'リセットトークンの有効期限が切れています。',
  },
  'password.reset.success': {
    ko: '비밀번호가 성공적으로 재설정되었습니다.',
    en: 'Password has been reset successfully.',
    ja: 'パスワードが正常にリセットされました。',
  },
  'password.reset.socialNotAllowed': {
    ko: '소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.',
    en: 'Social login accounts cannot reset password.',
    ja: 'ソーシャルログインアカウントではパスワードをリセットできません。',
  },
  'email.verification.required': {
    ko: '이 기능을 사용하려면 이메일 인증이 필요합니다.',
    en: 'Email verification required to use this feature.',
    ja: 'この機能を利用するにはメール認証が必要です。',
  },
};

export function parseLang(acceptLanguage?: string): SupportedLang {
  if (!acceptLanguage) return 'ko';
  const lang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
  if (lang === 'en') return 'en';
  if (lang === 'ja') return 'ja';
  return 'ko';
}

export function t(key: string, lang: SupportedLang = 'ko'): string {
  return translations[key]?.[lang] ?? translations[key]?.['ko'] ?? key;
}
