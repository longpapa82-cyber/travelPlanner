import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  Query,
  Headers,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { Subject } from 'rxjs';
import { TripsService, TripCreationProgress } from './trips.service';
import { JobsService } from './jobs.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { UpdateCollaboratorRoleDto } from './dto/update-collaborator-role.dto';
import { QueryTripsDto } from './dto/query-trips.dto';
import { GenerateShareLinkDto } from './dto/generate-share-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImageService } from '../common/image.service';
import { validateImageMagicBytes } from '../common/utils/file-validation';
import { AdminExemptThrottlerGuard } from '../common/guards/admin-exempt-throttler.guard';

/** Escape a string value for safe inclusion in iCalendar output (RFC 5545 §3.3.11). */
function escapeIcalValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly jobsService: JobsService,
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @UseGuards(AdminExemptThrottlerGuard)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  create(
    @CurrentUser('userId') userId: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Body() createTripDto: CreateTripDto,
  ) {
    const language = acceptLanguage || 'ko';
    return this.tripsService.create(userId, createTripDto, language);
  }

  /**
   * 폴링 방식 비동기 여행 생성 (Railway SSE 문제 해결)
   *
   * SSE의 Railway 프록시 버퍼링 문제를 근본적으로 해결하기 위해
   * 폴링 방식으로 전환. 작업을 시작하고 jobId를 즉시 반환.
   * 클라이언트는 job-status 엔드포인트를 1초마다 폴링하여 진행 상태 확인.
   */
  @Post('create-async')
  @UseGuards(AdminExemptThrottlerGuard)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async createAsync(
    @CurrentUser('userId') userId: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Body() createTripDto: CreateTripDto,
  ) {
    const language = acceptLanguage || 'ko';
    const jobId = this.jobsService.createJob();

    // 비동기로 여행 생성 시작 (응답 반환 후 백그라운드 실행)
    // 즉시 jobId를 반환하고, 실제 생성은 백그라운드에서 진행
    setImmediate(() => {
      this.startTripCreation(jobId, userId, createTripDto, language);
    });

    return { jobId, status: 'pending' };
  }

  /**
   * 작업 상태 조회 (폴링용)
   *
   * 클라이언트가 1초마다 이 엔드포인트를 호출하여 작업 진행 상태 확인.
   * Railway 프록시와 무관하게 독립적 HTTP 요청으로 안정적 동작.
   */
  @Get('job-status/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.jobsService.getJob(jobId);
  }

  /**
   * 비동기 여행 생성 실행 (백그라운드)
   *
   * JobsService와 progress$ Subject를 사용하여
   * 진행 상태를 실시간으로 추적하고 저장.
   */
  private async startTripCreation(
    jobId: string,
    userId: string,
    createTripDto: CreateTripDto,
    language: string,
  ): Promise<void> {
    try {
      // 상태를 processing으로 업데이트
      this.jobsService.updateJob(jobId, { status: 'processing' });

      // progress$ Subject 생성 (여행 생성 진행 상태 추적)
      const progress$ = new Subject<TripCreationProgress>();

      // progress 이벤트 구독 → JobData 업데이트
      const subscription = progress$.subscribe({
        next: (progress) => {
          this.jobsService.updateJob(jobId, { progress });
        },
      });

      // 여행 생성 (기존 로직 재사용)
      const trip = await this.tripsService.create(
        userId,
        createTripDto,
        language,
        progress$,
      );

      // 완료 상태 업데이트
      this.jobsService.updateJob(jobId, {
        status: 'completed',
        tripId: trip.id,
        progress: { step: 'complete' },
      });

      // Subject 정리
      subscription.unsubscribe();
      progress$.complete();
    } catch (error) {
      // 에러 상태 업데이트
      const errorMessage = error.message || 'Trip creation failed';
      this.jobsService.updateJob(jobId, {
        status: 'error',
        error: errorMessage,
        progress: { step: 'error', message: errorMessage },
      });
    }
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() queryDto: QueryTripsDto,
  ) {
    return this.tripsService.findAll(userId, queryDto);
  }

  @Get('upcoming')
  getUpcomingTrips(@CurrentUser('userId') userId: string) {
    return this.tripsService.getUpcomingTrips(userId);
  }

  @Get('ongoing')
  getOngoingTrips(@CurrentUser('userId') userId: string) {
    return this.tripsService.getOngoingTrips(userId);
  }

  @Get('completed')
  getCompletedTrips(@CurrentUser('userId') userId: string) {
    return this.tripsService.getCompletedTrips(userId);
  }

  @Get('my-stats')
  getUserStats(@CurrentUser('userId') userId: string) {
    return this.tripsService.getUserStats(userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTripDto: UpdateTripDto,
  ) {
    return this.tripsService.update(userId, id, updateTripDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.remove(userId, id);
  }

  @Patch(':tripId/itineraries/:itineraryId')
  updateItinerary(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('itineraryId', ParseUUIDPipe) itineraryId: string,
    @Body() updateItineraryDto: UpdateItineraryDto,
  ) {
    return this.tripsService.updateItinerary(
      userId,
      tripId,
      itineraryId,
      updateItineraryDto,
    );
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.duplicate(userId, id);
  }

  @Get(':id/export/ical')
  async exportIcal(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const trip = await this.tripsService.findOne(userId, id);
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MyTravel//EN',
      `X-WR-CALNAME:${escapeIcalValue(trip.destination)}`,
    ];

    for (const itinerary of trip.itineraries || []) {
      const parsedDate = new Date(itinerary.date);
      if (isNaN(parsedDate.getTime())) continue; // skip invalid dates
      const dateStr = parsedDate
        .toISOString()
        .replace(/[-:]/g, '')
        .split('T')[0];

      for (const activity of itinerary.activities || []) {
        const [hours, minutes] = (activity.time || '09:00').split(':');
        const startTime = `${dateStr}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
        const dur = activity.estimatedDuration || 60;
        const startDt = new Date(parsedDate);
        startDt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        const endDt = new Date(startDt.getTime() + dur * 60000);
        const endTime = endDt.toISOString().replace(/[-:]/g, '').split('.')[0];

        lines.push(
          'BEGIN:VEVENT',
          `DTSTART:${startTime}`,
          `DTEND:${endTime}`,
          `SUMMARY:${escapeIcalValue(activity.title)}`,
          `DESCRIPTION:${escapeIcalValue(activity.description || '')}`,
          `LOCATION:${escapeIcalValue(activity.location || '')}`,
          'END:VEVENT',
        );
      }
    }

    lines.push('END:VCALENDAR');
    const ical = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // Use RFC 5987 encoding for non-ASCII filenames (Korean, Japanese, etc.)
    const safeFilename = trip.destination.replace(/[^a-zA-Z0-9]/g, '_');
    const encodedFilename = encodeURIComponent(`${trip.destination}_trip.ics`);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}_trip.ics"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(ical);
  }

  // ============================================
  // Activity Management Endpoints
  // ============================================

  @Post(':tripId/itineraries/:itineraryId/activities')
  addActivity(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('itineraryId', ParseUUIDPipe) itineraryId: string,
    @Body() addActivityDto: AddActivityDto,
  ) {
    return this.tripsService.addActivity(
      userId,
      tripId,
      itineraryId,
      addActivityDto,
    );
  }

  // Static route must come BEFORE dynamic :index route
  @Patch(':tripId/itineraries/:itineraryId/activities/reorder')
  reorderActivities(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('itineraryId', ParseUUIDPipe) itineraryId: string,
    @Body() reorderDto: ReorderActivitiesDto,
  ) {
    return this.tripsService.reorderActivities(
      userId,
      tripId,
      itineraryId,
      reorderDto,
    );
  }

  @Patch(':tripId/itineraries/:itineraryId/activities/:index')
  updateActivity(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('itineraryId', ParseUUIDPipe) itineraryId: string,
    @Param('index') index: string,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.tripsService.updateActivity(
      userId,
      tripId,
      itineraryId,
      parseInt(index, 10),
      updateActivityDto,
    );
  }

  @Delete(':tripId/itineraries/:itineraryId/activities/:index')
  @HttpCode(HttpStatus.OK)
  deleteActivity(
    @CurrentUser('userId') userId: string,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('itineraryId', ParseUUIDPipe) itineraryId: string,
    @Param('index') index: string,
  ) {
    return this.tripsService.deleteActivity(
      userId,
      tripId,
      itineraryId,
      parseInt(index, 10),
    );
  }

  // ============================================================================
  // SHARING ENDPOINTS
  // ============================================================================

  @Post(':id/share')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  generateShareLink(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateShareLinkDto,
  ) {
    return this.tripsService.generateShareToken(id, userId, dto?.expiresInDays);
  }

  @Delete(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  disableSharing(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.disableSharing(id, userId);
  }

  // Collaboration endpoints
  @Post(':id/collaborators')
  addCollaborator(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.tripsService.addCollaborator(id, userId, dto.email, dto.role);
  }

  @Get(':id/collaborators')
  getCollaborators(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.getCollaborators(id, userId);
  }

  @Patch(':id/collaborators/:collabId')
  updateCollaboratorRole(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('collabId', ParseUUIDPipe) collabId: string,
    @Body() dto: UpdateCollaboratorRoleDto,
  ) {
    return this.tripsService.updateCollaboratorRole(
      id,
      userId,
      collabId,
      dto.role,
    );
  }

  @Delete(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveTrip(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.leaveTrip(id, userId);
  }

  @Delete(':id/collaborators/:collabId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCollaborator(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('collabId', ParseUUIDPipe) collabId: string,
  ) {
    return this.tripsService.removeCollaborator(id, userId, collabId);
  }

  @Post('upload/photo')
  @Throttle({ short: { ttl: 60000, limit: 20 } })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads', 'photos');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    if (!validateImageMagicBytes(file.path)) {
      throw new BadRequestException(
        'Invalid image file: file signature does not match an allowed image format',
      );
    }
    const result = await this.imageService.processUpload(file.path, {
      maxWidth: 1200,
      quality: 80,
      generateThumbnail: true,
      thumbnailSize: 300,
    });

    // Convert relative URLs to absolute URLs for frontend
    const baseUrl = process.env.APP_URL || 'https://mytravel-planner.com';
    const fullUrl = result.url.startsWith('http')
      ? result.url
      : `${baseUrl}${result.url}`;
    const fullThumbnailUrl = result.thumbnailUrl
      ? (result.thumbnailUrl.startsWith('http')
          ? result.thumbnailUrl
          : `${baseUrl}${result.thumbnailUrl}`)
      : undefined;

    return { url: fullUrl, thumbnailUrl: fullThumbnailUrl };
  }
}
