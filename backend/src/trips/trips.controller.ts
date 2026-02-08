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
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { QueryTripsDto } from './dto/query-trips.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@Request() req, @Body() createTripDto: CreateTripDto) {
    return this.tripsService.create(req.user.userId, createTripDto);
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

  // ============================================================================
  // SHARING ENDPOINTS
  // ============================================================================

  @Post(':id/share')
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
}
