import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { User } from './entities/user.entity';
import { UserConsent } from './entities/user-consent.entity';
import { ConsentAuditLog } from './entities/consent-audit-log.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditService } from '../admin/audit.service';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { ImageService } from '../common/image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserConsent, ConsentAuditLog, AuditLog]),
    CacheModule.register(),
  ],
  controllers: [UsersController],
  providers: [UsersService, AuditService, ImageService],
  exports: [UsersService],
})
export class UsersModule {}
