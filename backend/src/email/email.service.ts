import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

type SupportedLang = 'ko' | 'en' | 'ja';

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
      ko: '[TravelPlanner] 이메일 인증을 완료해주세요',
      en: '[TravelPlanner] Please verify your email',
      ja: '[TravelPlanner] メールアドレスを認証してください',
    };

    try {
      const result = await this.mailerService.sendMail({
        to: email,
        subject: subjects[lang],
        template: `verify-email-${lang}`,
        context: { name, verificationUrl },
      });

      if (this.isDev && result?.message) {
        this.logger.debug(
          `[DEV] Verification email for ${email}:\n` +
            `  URL: ${verificationUrl}`,
        );
      }

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${error.message}`,
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
      ko: '[TravelPlanner] 비밀번호 재설정',
      en: '[TravelPlanner] Reset your password',
      ja: '[TravelPlanner] パスワードのリセット',
    };

    try {
      const result = await this.mailerService.sendMail({
        to: email,
        subject: subjects[lang],
        template: `reset-password-${lang}`,
        context: { name, resetUrl },
      });

      if (this.isDev && result?.message) {
        this.logger.debug(
          `[DEV] Password reset email for ${email}:\n` + `  URL: ${resetUrl}`,
        );
      }

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${error.message}`,
      );
      if (!this.isDev) throw error;
      this.logger.warn(`[DEV] Email send failed but reset URL: ${resetUrl}`);
    }
  }
}
