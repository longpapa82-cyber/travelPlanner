type SupportedLang = 'ko' | 'en' | 'ja' | 'zh' | 'es';

const translations: Record<string, Record<SupportedLang, string>> = {
  'password.enterBoth': {
    ko: '현재 비밀번호와 새 비밀번호를 입력해주세요.',
    en: 'Please enter both current and new passwords.',
    ja: '現在のパスワードと新しいパスワードを入力してください。',
    zh: '请输入当前密码和新密码。',
    es: 'Por favor ingresa la contraseña actual y la nueva.',
  },
  'password.minLength': {
    ko: '새 비밀번호는 8자 이상이어야 합니다.',
    en: 'New password must be at least 8 characters.',
    ja: '新しいパスワードは8文字以上である必要があります。',
    zh: '新密码至少需要8个字符。',
    es: 'La nueva contraseña debe tener al menos 8 caracteres.',
  },
  'account.deleted': {
    ko: '계정이 삭제되었습니다.',
    en: 'Account has been deleted.',
    ja: 'アカウントが削除されました。',
    zh: '账号已删除。',
    es: 'La cuenta ha sido eliminada.',
  },
  'password.socialNotAllowed': {
    ko: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
    en: 'Social login accounts cannot change password.',
    ja: 'ソーシャルログインアカウントではパスワードを変更できません。',
    zh: '社交登录账号无法修改密码。',
    es: 'Las cuentas de inicio de sesión social no pueden cambiar la contraseña.',
  },
  'password.currentInvalid': {
    ko: '현재 비밀번호가 일치하지 않습니다.',
    en: 'Current password is incorrect.',
    ja: '現在のパスワードが正しくありません。',
    zh: '当前密码不正确。',
    es: 'La contraseña actual es incorrecta.',
  },
  'password.changed': {
    ko: '비밀번호가 변경되었습니다.',
    en: 'Password has been changed.',
    ja: 'パスワードが変更されました。',
    zh: '密码已修改。',
    es: 'La contraseña ha sido cambiada.',
  },
  'timezone.noDifference': {
    ko: '시차 없음',
    en: 'No time difference',
    ja: '時差なし',
    zh: '无时差',
    es: 'Sin diferencia horaria',
  },
  'timezone.hours': {
    ko: '시간',
    en: 'h',
    ja: '時間',
    zh: '小时',
    es: 'h',
  },
  'timezone.minutes': {
    ko: '분',
    en: 'min',
    ja: '分',
    zh: '分钟',
    es: 'min',
  },
  'timezone.ahead': {
    ko: '빠름',
    en: 'ahead',
    ja: '進み',
    zh: '快',
    es: 'adelante',
  },
  'timezone.behind': {
    ko: '느림',
    en: 'behind',
    ja: '遅れ',
    zh: '慢',
    es: 'atrás',
  },
  'email.verification.sent': {
    ko: '인증 이메일이 발송되었습니다.',
    en: 'Verification email has been sent.',
    ja: '認証メールを送信しました。',
    zh: '验证邮件已发送。',
    es: 'El correo de verificación ha sido enviado.',
  },
  'email.verification.invalid': {
    ko: '유효하지 않은 인증 토큰입니다.',
    en: 'Invalid verification token.',
    ja: '無効な認証トークンです。',
    zh: '无效的验证令牌。',
    es: 'Token de verificación inválido.',
  },
  'email.verification.expired': {
    ko: '인증 토큰이 만료되었습니다.',
    en: 'Verification token has expired.',
    ja: '認証トークンの有効期限が切れています。',
    zh: '验证令牌已过期。',
    es: 'El token de verificación ha expirado.',
  },
  'email.verification.success': {
    ko: '이메일이 성공적으로 인증되었습니다.',
    en: 'Email has been verified successfully.',
    ja: 'メールアドレスが正常に認証されました。',
    zh: '邮箱验证成功。',
    es: 'El correo ha sido verificado exitosamente.',
  },
  'email.already.verified': {
    ko: '이미 인증된 이메일입니다.',
    en: 'Email is already verified.',
    ja: 'メールアドレスはすでに認証済みです。',
    zh: '邮箱已验证。',
    es: 'El correo ya está verificado.',
  },
  'password.reset.sent': {
    ko: '비밀번호 재설정 이메일이 발송되었습니다.',
    en: 'Password reset email has been sent.',
    ja: 'パスワードリセットメールを送信しました。',
    zh: '密码重置邮件已发送。',
    es: 'El correo de restablecimiento de contraseña ha sido enviado.',
  },
  'password.reset.invalid': {
    ko: '유효하지 않은 재설정 토큰입니다.',
    en: 'Invalid reset token.',
    ja: '無効なリセットトークンです。',
    zh: '无效的重置令牌。',
    es: 'Token de restablecimiento inválido.',
  },
  'password.reset.expired': {
    ko: '재설정 토큰이 만료되었습니다.',
    en: 'Reset token has expired.',
    ja: 'リセットトークンの有効期限が切れています。',
    zh: '重置令牌已过期。',
    es: 'El token de restablecimiento ha expirado.',
  },
  'password.reset.success': {
    ko: '비밀번호가 성공적으로 재설정되었습니다.',
    en: 'Password has been reset successfully.',
    ja: 'パスワードが正常にリセットされました。',
    zh: '密码已成功重置。',
    es: 'La contraseña ha sido restablecida exitosamente.',
  },
  'password.reset.socialNotAllowed': {
    ko: '소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.',
    en: 'Social login accounts cannot reset password.',
    ja: 'ソーシャルログインアカウントではパスワードをリセットできません。',
    zh: '社交登录账号无法重置密码。',
    es: 'Las cuentas de inicio de sesión social no pueden restablecer la contraseña.',
  },
  'email.verification.required': {
    ko: '이 기능을 사용하려면 이메일 인증이 필요합니다.',
    en: 'Email verification required to use this feature.',
    ja: 'この機能を利用するにはメール認証が必要です。',
    zh: '使用此功能需要验证邮箱。',
    es: 'Se requiere verificación de correo para usar esta función.',
  },
};

export function parseLang(acceptLanguage?: string): SupportedLang {
  if (!acceptLanguage) return 'ko';
  const lang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
  if (lang === 'en') return 'en';
  if (lang === 'ja') return 'ja';
  if (lang === 'zh') return 'zh';
  if (lang === 'es') return 'es';
  return 'ko';
}

export function t(key: string, lang: SupportedLang = 'ko'): string {
  return translations[key]?.[lang] ?? translations[key]?.['ko'] ?? key;
}
