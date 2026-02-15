import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ErrorLog } from './entities/error-log.entity';
import { AdminService } from './admin.service';
import { AdminController, ErrorLogController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, ErrorLog])],
  controllers: [AdminController, ErrorLogController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
