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
  MessageEvent,
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
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  create(
    @CurrentUser('userId') userId: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Body() createTripDto: CreateTripDto,
  ) {
    const language = acceptLanguage || 'ko';
    return this.tripsService.create(userId, createTripDto, language);
  }

  @Post('create-stream')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  createWithProgress(
    @CurrentUser('userId') userId: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Body() createTripDto: CreateTripDto,
    @Res() res: Response,
  ) {
    const language = acceptLanguage || 'ko';
    const progress$ = new Subject<TripCreationProgress>();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Stream progress events to client
    const subscription = progress$.subscribe({
      next: (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        console.log('[BACKEND SSE] Sending progress event:', event.step, 'length:', data.length);
        res.write(data);
      },
    });

    // Start trip creation with progress tracking
    this.tripsService
      .create(userId, createTripDto, language, progress$)
      .then((trip) => {
        const completeEvent = { step: 'complete', tripId: trip.id };
        const data = `data: ${JSON.stringify(completeEvent)}\n\n`;
        console.log('[BACKEND SSE] Sending complete event:', completeEvent, 'length:', data.length);
        res.write(data);

        // Ensure the data is flushed before ending the response
        // Add a small delay to ensure the client receives the complete event
        setTimeout(() => {
          console.log('[BACKEND SSE] Ending response after flush delay');
          res.end();
        }, 100);
      })
      .catch((error) => {
        const message = error.message || 'Trip creation failed';
        const status = error.status || 500;
        res.write(
          `data: ${JSON.stringify({ step: 'error', message, status })}\n\n`,
        );
        res.end();
      })
      .finally(() => {
        subscription.unsubscribe();
        progress$.complete();
      });

    // Handle client disconnect
    res.on('close', () => {
      subscription.unsubscribe();
      progress$.complete();
    });
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
    return { url: result.url, thumbnailUrl: result.thumbnailUrl };
  }
}
