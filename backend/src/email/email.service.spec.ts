import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: jest.Mocked<Partial<MailerService>>;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    mailerService = {
      sendMail: jest.fn().mockResolvedValue({ message: 'sent' }),
    };
    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: string) => {
          const values: Record<string, string> = {
            'email.frontendUrl': 'http://localhost:8081',
            NODE_ENV: 'development',
          };
          return values[key] ?? defaultValue;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mailerService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('constructor', () => {
    it('should set frontend URL from config', () => {
      expect((service as any).frontendUrl).toBe('http://localhost:8081');
    });

    it('should detect development mode', () => {
      expect((service as any).isDev).toBe(true);
    });

    it('should detect production mode', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'email.frontendUrl') return 'https://travelplanner.com';
          return defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const prodService = module.get<EmailService>(EmailService);
      expect((prodService as any).isDev).toBe(false);
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send email with correct Korean subject', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'User',
        'token123',
        'ko',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: '[MyTravel] 이메일 인증을 완료해주세요',
        template: 'verify-email-ko',
        context: {
          name: 'User',
          verificationUrl: 'http://localhost:8081/verify-email?token=token123',
        },
      });
    });

    it('should send email with correct English subject', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'User',
        'token123',
        'en',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[MyTravel] Please verify your email',
          template: 'verify-email-en',
        }),
      );
    });

    it('should send email with correct Japanese subject', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'User',
        'token123',
        'ja',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[MyTravel] メールアドレスを認証してください',
          template: 'verify-email-ja',
        }),
      );
    });

    it('should default to Korean when no language specified', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'User',
        'token123',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[MyTravel] 이메일 인증을 완료해주세요',
          template: 'verify-email-ko',
        }),
      );
    });

    it('should construct verification URL correctly', async () => {
      await service.sendVerificationEmail(
        'user@example.com',
        'User',
        'abc-token',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            verificationUrl:
              'http://localhost:8081/verify-email?token=abc-token',
          }),
        }),
      );
    });

    it('should not throw in dev mode when mailer fails', async () => {
      (mailerService.sendMail as jest.Mock).mockRejectedValue(
        new Error('SMTP connection refused'),
      );

      // In dev mode, should not throw
      await expect(
        service.sendVerificationEmail('user@example.com', 'User', 'token123'),
      ).resolves.not.toThrow();
    });

    it('should throw in production mode when mailer fails', async () => {
      // Create production service
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'email.frontendUrl') return 'https://app.example.com';
          return defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const prodService = module.get<EmailService>(EmailService);
      (mailerService.sendMail as jest.Mock).mockRejectedValue(new Error('SMTP Error'));

      await expect(
        prodService.sendVerificationEmail(
          'user@example.com',
          'User',
          'token123',
        ),
      ).rejects.toThrow('SMTP Error');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send reset email with correct Korean subject', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'User',
        'reset-token',
        'ko',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: '[MyTravel] 비밀번호 재설정',
        template: 'reset-password-ko',
        context: {
          name: 'User',
          resetUrl: 'http://localhost:8081/reset-password?token=reset-token',
        },
      });
    });

    it('should send reset email with English subject', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'User',
        'token',
        'en',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[MyTravel] Reset your password',
          template: 'reset-password-en',
        }),
      );
    });

    it('should send reset email with Japanese subject', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'User',
        'token',
        'ja',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[MyTravel] パスワードのリセット',
          template: 'reset-password-ja',
        }),
      );
    });

    it('should construct reset URL correctly', async () => {
      await service.sendPasswordResetEmail(
        'user@example.com',
        'User',
        'xyz-token',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            resetUrl: 'http://localhost:8081/reset-password?token=xyz-token',
          }),
        }),
      );
    });

    it('should not throw in dev mode when mailer fails', async () => {
      (mailerService.sendMail as jest.Mock).mockRejectedValue(new Error('SMTP Error'));

      await expect(
        service.sendPasswordResetEmail('user@example.com', 'User', 'token'),
      ).resolves.not.toThrow();
    });

    it('should throw in production mode when mailer fails', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'email.frontendUrl') return 'https://app.example.com';
          return defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const prodService = module.get<EmailService>(EmailService);
      (mailerService.sendMail as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(
        prodService.sendPasswordResetEmail('user@example.com', 'User', 'token'),
      ).rejects.toThrow('Connection timeout');
    });
  });
});
