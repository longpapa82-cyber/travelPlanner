import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../common/types/request.types';

type SupportedLang = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' | 'it' | 'ru' | 'tr' | 'ms';
type EmailTemplateLang = 'ko' | 'en' | 'ja';

const EMAIL_TEMPLATE_FALLBACK: Record<SupportedLang, EmailTemplateLang> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  zh: 'en',
  es: 'en',
  de: 'en',
  fr: 'en',
  th: 'en',
  vi: 'en',
  pt: 'en',
  ar: 'en',
  id: 'en',
  hi: 'en',
  it: 'en',
  ru: 'en',
  tr: 'en',
  ms: 'en',
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;
  private readonly isDev: boolean;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      'email.frontendUrl',
      'http://localhost:8081',
    );
    this.isDev = this.configService.get<string>('NODE_ENV') !== 'production';
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
    lang: SupportedLang = 'ko',
  ): Promise<void> {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    const subjects: Record<SupportedLang, string> = {
      ko: '[MyTravel] 이메일 인증을 완료해주세요',
      en: '[MyTravel] Please verify your email',
      ja: '[MyTravel] メールアドレスを認証してください',
      zh: '[MyTravel] 请验证您的邮箱',
      es: '[MyTravel] Por favor verifica tu correo',
      de: '[MyTravel] Bitte verifizieren Sie Ihre E-Mail',
      fr: '[MyTravel] Veuillez vérifier votre e-mail',
      th: '[MyTravel] กรุณายืนยันอีเมลของคุณ',
      vi: '[MyTravel] Vui lòng xác minh email của bạn',
      pt: '[MyTravel] Por favor, verifique seu e-mail',
      ar: '[MyTravel] يرجى تأكيد بريدك الإلكتروني',
      id: '[MyTravel] Silakan verifikasi email Anda',
      hi: '[MyTravel] कृपया अपना ईमेल सत्यापित करें',
      it: '[MyTravel] Verifica la tua email',
      ru: '[MyTravel] Подтвердите вашу электронную почту',
      tr: '[MyTravel] Lütfen e-postanızı doğrulayın',
      ms: '[MyTravel] Sila sahkan e-mel anda',
    };
    const templateLang = EMAIL_TEMPLATE_FALLBACK[lang];

    try {
      const result = (await this.mailerService.sendMail({
        to: email,
        subject: subjects[lang],
        template: `verify-email-${templateLang}`,
        context: { name, verificationUrl },
      })) as { message?: string } | undefined;

      if (this.isDev && result?.message) {
        this.logger.debug(
          `[DEV] Verification email for ${email}:\n` +
            `  URL: ${verificationUrl}`,
        );
      }

      this.logger.log(`Verification email sent to ${maskEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${maskEmail(email)}: ${getErrorMessage(error)}`,
      );
      if (!this.isDev) throw error;
      // In dev, log the URL so the developer can still verify
      this.logger.warn(
        `[DEV] Email send failed but verification URL: ${verificationUrl}`,
      );
    }
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
    lang: SupportedLang = 'ko',
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subjects: Record<SupportedLang, string> = {
      ko: '[MyTravel] 비밀번호 재설정',
      en: '[MyTravel] Reset your password',
      ja: '[MyTravel] パスワードのリセット',
      zh: '[MyTravel] 重置密码',
      es: '[MyTravel] Restablece tu contraseña',
      de: '[MyTravel] Passwort zurücksetzen',
      fr: '[MyTravel] Réinitialisez votre mot de passe',
      th: '[MyTravel] รีเซ็ตรหัสผ่านของคุณ',
      vi: '[MyTravel] Đặt lại mật khẩu của bạn',
      pt: '[MyTravel] Redefina sua senha',
      ar: '[MyTravel] إعادة تعيين كلمة المرور',
      id: '[MyTravel] Atur ulang kata sandi Anda',
      hi: '[MyTravel] अपना पासवर्ड रीसेट करें',
      it: '[MyTravel] Reimposta la tua password',
      ru: '[MyTravel] Сброс пароля',
      tr: '[MyTravel] Şifrenizi sıfırlayın',
      ms: '[MyTravel] Tetapkan semula kata laluan anda',
    };
    const templateLang = EMAIL_TEMPLATE_FALLBACK[lang];

    try {
      const result = (await this.mailerService.sendMail({
        to: email,
        subject: subjects[lang],
        template: `reset-password-${templateLang}`,
        context: { name, resetUrl },
      })) as { message?: string } | undefined;

      if (this.isDev && result?.message) {
        this.logger.debug(
          `[DEV] Password reset email for ${email}:\n` + `  URL: ${resetUrl}`,
        );
      }

      this.logger.log(`Password reset email sent to ${maskEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${maskEmail(email)}: ${getErrorMessage(error)}`,
      );
      if (!this.isDev) throw error;
      this.logger.warn(`[DEV] Email send failed but reset URL: ${resetUrl}`);
    }
  }
}
