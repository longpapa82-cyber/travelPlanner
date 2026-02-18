import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ErrorLog } from './entities/error-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AdminController, ErrorLogController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, ErrorLog, AuditLog])],
  controllers: [AdminController, ErrorLogController],
  providers: [AdminService, AuditService],
  exports: [AdminService, AuditService],
})
export class AdminModule {}
