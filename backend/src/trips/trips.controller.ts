import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { CollaboratorRole } from './entities/collaborator.entity';
import { QueryTripsDto } from './dto/query-trips.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageService } from '../common/image.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  create(@Request() req, @Body() createTripDto: CreateTripDto) {
    const language = req.headers['accept-language'] || 'ko';
    return this.tripsService.create(req.user.userId, createTripDto, language);
  }

  @Get()
  findAll(@Request() req, @Query() queryDto: QueryTripsDto) {
    return this.tripsService.findAll(req.user.userId, queryDto);
  }

  @Get('upcoming')
  getUpcomingTrips(@Request() req) {
    return this.tripsService.getUpcomingTrips(req.user.userId);
  }

  @Get('ongoing')
  getOngoingTrips(@Request() req) {
    return this.tripsService.getOngoingTrips(req.user.userId);
  }

  @Get('completed')
  getCompletedTrips(@Request() req) {
    return this.tripsService.getCompletedTrips(req.user.userId);
  }

  @Get('my-stats')
  getUserStats(@Request() req) {
    return this.tripsService.getUserStats(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.tripsService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTripDto: UpdateTripDto,
  ) {
    return this.tripsService.update(req.user.userId, id, updateTripDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.tripsService.remove(req.user.userId, id);
  }

  @Patch(':tripId/itineraries/:itineraryId')
  updateItinerary(
    @Request() req,
    @Param('tripId') tripId: string,
    @Param('itineraryId') itineraryId: string,
    @Body() updateItineraryDto: UpdateItineraryDto,
  ) {
    return this.tripsService.updateItinerary(
      req.user.userId,
      tripId,
      itineraryId,
      updateItineraryDto,
    );
  }

  @Post(':id/duplicate')
  duplicate(@Request() req, @Param('id') id: string) {
    return this.tripsService.duplicate(req.user.userId, id);
  }

  @Get(':id/export/ical')
  async exportIcal(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const trip = await this.tripsService.findOne(req.user.userId, id);
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TravelPlanner//EN',
      `X-WR-CALNAME:${trip.destination}`,
    ];

    for (const itinerary of trip.itineraries) {
      const dateStr = new Date(itinerary.date)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('T')[0];

      for (const activity of itinerary.activities) {
        const [hours, minutes] = (activity.time || '09:00').split(':');
        const startTime = `${dateStr}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
        const dur = activity.estimatedDuration || 60;
        const endHour = parseInt(hours) + Math.floor((parseInt(minutes) + dur) / 60);
        const endMin = (parseInt(minutes) + dur) % 60;
        const endTime = `${dateStr}T${String(endHour).padStart(2, '0')}${String(endMin).padStart(2, '0')}00`;

        lines.push(
          'BEGIN:VEVENT',
          `DTSTART:${startTime}`,
          `DTEND:${endTime}`,
          `SUMMARY:${activity.title}`,
          `DESCRIPTION:${(activity.description || '').replace(/\n/g, '\\n')}`,
          `LOCATION:${activity.location || ''}`,
          'END:VEVENT',
        );
      }
    }

    lines.push('END:VCALENDAR');
    const ical = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${trip.destination.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_trip.ics"`,
    );
    res.send(ical);
  }

  // ============================================
  // Activity Management Endpoints
  // ============================================

  @Post(':tripId/itineraries/:itineraryId/activities')
  addActivity(
    @Request() req,
    @Param('tripId') tripId: string,
    @Param('itineraryId') itineraryId: string,
    @Body() addActivityDto: AddActivityDto,
  ) {
    return this.tripsService.addActivity(
      req.user.userId,
      tripId,
      itineraryId,
      addActivityDto,
    );
  }

  // Static route must come BEFORE dynamic :index route
  @Patch(':tripId/itineraries/:itineraryId/activities/reorder')
  reorderActivities(
    @Request() req,
    @Param('tripId') tripId: string,
    @Param('itineraryId') itineraryId: string,
    @Body() reorderDto: ReorderActivitiesDto,
  ) {
    return this.tripsService.reorderActivities(
      req.user.userId,
      tripId,
      itineraryId,
      reorderDto,
    );
  }

  @Patch(':tripId/itineraries/:itineraryId/activities/:index')
  updateActivity(
    @Request() req,
    @Param('tripId') tripId: string,
    @Param('itineraryId') itineraryId: string,
    @Param('index') index: string,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.tripsService.updateActivity(
      req.user.userId,
      tripId,
      itineraryId,
      parseInt(index, 10),
      updateActivityDto,
    );
  }

  @Delete(':tripId/itineraries/:itineraryId/activities/:index')
  @HttpCode(HttpStatus.OK)
  deleteActivity(
    @Request() req,
    @Param('tripId') tripId: string,
    @Param('itineraryId') itineraryId: string,
    @Param('index') index: string,
  ) {
    return this.tripsService.deleteActivity(
      req.user.userId,
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
    @Request() req,
    @Param('id') id: string,
    @Body() body?: { expiresInDays?: number },
  ) {
    return this.tripsService.generateShareToken(
      id,
      req.user.userId,
      body?.expiresInDays,
    );
  }

  @Delete(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  disableSharing(@Request() req, @Param('id') id: string) {
    return this.tripsService.disableSharing(id, req.user.userId);
  }

  // Collaboration endpoints
  @Post(':id/collaborators')
  addCollaborator(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.tripsService.addCollaborator(
      id,
      req.user.userId,
      dto.email,
      dto.role,
    );
  }

  @Get(':id/collaborators')
  getCollaborators(@Request() req, @Param('id') id: string) {
    return this.tripsService.getCollaborators(id, req.user.userId);
  }

  @Patch(':id/collaborators/:collabId')
  updateCollaboratorRole(
    @Request() req,
    @Param('id') id: string,
    @Param('collabId') collabId: string,
    @Body('role') role: CollaboratorRole,
  ) {
    return this.tripsService.updateCollaboratorRole(
      id,
      req.user.userId,
      collabId,
      role,
    );
  }

  @Delete(':id/collaborators/:collabId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCollaborator(
    @Request() req,
    @Param('id') id: string,
    @Param('collabId') collabId: string,
  ) {
    return this.tripsService.removeCollaborator(id, req.user.userId, collabId);
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
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
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
    const result = await this.imageService.processUpload(file.path, {
      maxWidth: 1200,
      quality: 80,
      generateThumbnail: true,
      thumbnailSize: 300,
    });
    return { url: result.url, thumbnailUrl: result.thumbnailUrl };
  }
}
