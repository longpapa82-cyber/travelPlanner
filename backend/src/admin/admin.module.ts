import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AnnouncementService } from './announcement.service';
import {
  AdminController,
  AnnouncementsPublicController,
  ErrorLogController,
} from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Trip,
      ErrorLog,
      AuditLog,
      Announcement,
      AnnouncementRead,
    ]),
  ],
  controllers: [
    AdminController,
    AnnouncementsPublicController,
    ErrorLogController,
  ],
  providers: [AdminService, AuditService, AnnouncementService],
  exports: [AdminService, AuditService, AnnouncementService],
})
export class AdminModule {}
