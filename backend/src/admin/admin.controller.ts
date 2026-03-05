import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { AnnouncementService } from './announcement.service';
import { AuditAction } from './entities/audit-log.entity';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { detectPlatform } from '../common/utils/platform-detector';
import { parseLang } from '../common/i18n';

// Admin-only endpoints
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly announcementService: AnnouncementService,
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
      Math.max(1, parseInt(page || '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20)),
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
      Math.max(1, parseInt(page || '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20)),
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

  @Get('ai-metrics')
  getAiMetrics() {
    return this.adminService.getAiMetrics();
  }

  @Get('audit-logs')
  getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.getAuditLogs(
      Math.max(1, parseInt(page || '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50)),
      userId,
      action as AuditAction | undefined,
    );
  }

  // ─── Announcements Admin CRUD ──────────────────

  @Post('announcements')
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.announcementService.create(dto);
  }

  @Get('announcements')
  getAnnouncements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.announcementService.findAll(
      Math.max(1, parseInt(page || '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20)),
    );
  }

  @Get('announcements/:id')
  getAnnouncement(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementService.findOne(id);
  }

  @Patch('announcements/:id')
  updateAnnouncement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementService.update(id, dto);
  }

  @Delete('announcements/:id')
  removeAnnouncement(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementService.remove(id);
  }

  @Patch('announcements/:id/publish')
  publishAnnouncement(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementService.publish(id);
  }

  @Patch('announcements/:id/unpublish')
  unpublishAnnouncement(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementService.unpublish(id);
  }
}

// Public announcement endpoints (JWT only, no admin check)
@Controller('announcements')
@UseGuards(JwtAuthGuard)
@Throttle({ short: { ttl: 60000, limit: 30 } })
export class AnnouncementsPublicController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  getActiveAnnouncements(
    @CurrentUser('userId') userId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.announcementService.getActiveForUser(
      userId,
      parseLang(acceptLanguage),
    );
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('userId') userId: string) {
    return this.announcementService
      .getUnreadCount(userId)
      .then((count) => ({ count }));
  }

  @Get(':id')
  getAnnouncementDetail(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.announcementService.getOneForUser(
      userId,
      id,
      parseLang(acceptLanguage),
    );
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementService.markAsRead(userId, id);
  }

  @Patch(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementService.dismiss(userId, id);
  }
}

// Public error reporting endpoint (JWT only, no admin check)
@Controller('error-logs')
@UseGuards(JwtAuthGuard)
export class ErrorLogController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  createErrorLog(@Req() req: any, @Body() dto: CreateErrorLogDto) {
    const ua = req.headers['user-agent'] as string | undefined;
    return this.adminService.createErrorLog({
      errorMessage: dto.errorMessage,
      stackTrace: dto.stackTrace,
      screen: dto.screen,
      severity: dto.severity,
      deviceOS: dto.deviceOS,
      appVersion: dto.appVersion,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      platform: detectPlatform(ua),
      userAgent: ua?.slice(0, 1000),
    });
  }
}
