import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { detectPlatform } from '../common/utils/platform-detector';

// Admin-only endpoints
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users/stats')
  getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('provider') provider?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
      provider,
    );
  }

  @Get('error-logs/stats')
  getErrorLogStats() {
    return this.adminService.getErrorLogStats();
  }

  @Get('error-logs')
  getErrorLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
    @Query('platform') platform?: string,
  ) {
    return this.adminService.getErrorLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      severity,
      resolved !== undefined ? resolved === 'true' : undefined,
      platform,
    );
  }

  @Patch('error-logs/:id/resolve')
  resolveErrorLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.resolveErrorLog(id);
  }

  @Get('revenue/subscription-stats')
  getSubscriptionStats() {
    return this.adminService.getSubscriptionStats();
  }

  @Get('audit-logs')
  getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.getAuditLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      userId,
      action as AuditAction | undefined,
    );
  }
}

// Public error reporting endpoint (JWT only, no admin check)
@Controller('error-logs')
@UseGuards(JwtAuthGuard)
export class ErrorLogController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  createErrorLog(
    @Req() req: any,
    @Body() dto: CreateErrorLogDto,
  ) {
    const ua = req.headers['user-agent'] as string | undefined;
    return this.adminService.createErrorLog({
      errorMessage: dto.errorMessage,
      stackTrace: dto.stackTrace,
      screen: dto.screen,
      severity: dto.severity,
      deviceOS: dto.deviceOS,
      appVersion: dto.appVersion,
      userId: req.user?.id,
      userEmail: req.user?.email,
      platform: detectPlatform(ua),
      userAgent: ua?.slice(0, 1000),
    });
  }
}
