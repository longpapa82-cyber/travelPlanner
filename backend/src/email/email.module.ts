import { Module, Logger } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
const { HandlebarsAdapter } = require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter');
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EmailService } from './email.service';
import { ApiUsageModule } from '../admin/api-usage.module';

const logger = new Logger('EmailModule');

@Module({
  imports: [
    ApiUsageModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const smtpUser = configService.get<string>('email.user');
        const isDev = configService.get<string>('NODE_ENV') !== 'production';

        if (!smtpUser && isDev) {
          logger.warn(
            'SMTP not configured — emails will be logged to console in development',
          );
          // Use JSON transport for development (logs to console)
          return {
            transport: {
              jsonTransport: true,
            },
            defaults: {
              from: `"MyTravel" <${configService.get<string>('email.from')}>`,
            },
            template: {
              dir: join(__dirname, '..', '..', 'templates', 'email'),
              adapter: new HandlebarsAdapter(),
              options: { strict: true },
            },
          };
        }

        return {
          transport: {
            host: configService.get<string>('email.host'),
            port: configService.get<number>('email.port'),
            secure: configService.get<boolean>('email.secure'),
            auth: {
              user: smtpUser,
              pass: configService.get<string>('email.pass'),
            },
          },
          defaults: {
            from: `"MyTravel" <${configService.get<string>('email.from')}>`,
          },
          template: {
            dir: join(__dirname, '..', '..', 'templates', 'email'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
