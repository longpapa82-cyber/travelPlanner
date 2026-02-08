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
