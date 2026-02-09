import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { AIService } from './services/ai.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { TripStatusScheduler } from './trip-status.scheduler';
import {
  calculateTripStatus,
  updateItinerariesCompletionStatus,
} from './helpers/trip-progress.helper';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Itinerary)
    private readonly itineraryRepository: Repository<Itinerary>,
    private readonly aiService: AIService,
    private readonly timezoneService: TimezoneService,
    private readonly weatherService: WeatherService,
    private readonly tripStatusScheduler: TripStatusScheduler,
  ) {}

  async create(userId: string, createTripDto: CreateTripDto, language: string = 'ko'): Promise<Trip> {
    // Calculate number of days
    const startDate = new Date(createTripDto.startDate);
    const endDate = new Date(createTripDto.endDate);
    const numberOfDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // Create trip
    const trip = this.tripRepository.create({
      userId,
      ...createTripDto,
      numberOfTravelers: createTripDto.numberOfTravelers || 1,
    });

    const savedTrip = await this.tripRepository.save(trip);

    this.logger.log(
      `Creating trip ${savedTrip.id} with AI-generated itineraries`,
    );

    // Get location information for timezone and weather
    let timezoneInfo: {
      timezone: string;
      timezoneId: string;
      timezoneOffset: number;
      localTime: string;
    } | null = null;
    let locationInfo: { latitude: number; longitude: number } | null = null;

    try {
      const location = await this.timezoneService.getLocationInfo(
        createTripDto.destination,
      );
      if (location) {
        locationInfo = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        this.logger.log(
          `Retrieved location for ${createTripDto.destination}: ${location.latitude}, ${location.longitude}`,
        );

        // Get timezone with location
        timezoneInfo = await this.timezoneService.getTimezoneInfo(
          location.latitude,
          location.longitude,
          startDate,
        );
        if (timezoneInfo) {
          this.logger.log(`Retrieved timezone: ${timezoneInfo.timezoneId}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to get location/timezone information: ${error.message}`,
      );
    }

    try {
      // Generate AI-powered itineraries
      const aiItineraries = await this.aiService.generateAllItineraries({
        destination: createTripDto.destination,
        country: createTripDto.country,
        city: createTripDto.city,
        startDate,
        endDate,
        numberOfTravelers: createTripDto.numberOfTravelers || 1,
        preferences: createTripDto.preferences,
        language,
      });

      // Create itineraries with AI-generated activities, timezone, and weather info
      const itineraries: Itinerary[] = [];
      for (const aiItinerary of aiItineraries) {
        // Get weather forecast for this specific date
        let weather: any = null;
        if (locationInfo) {
          try {
            weather = await this.weatherService.getWeatherForecast(
              locationInfo.latitude,
              locationInfo.longitude,
              aiItinerary.date,
            );
            if (weather) {
              this.logger.log(
                `Retrieved weather for day ${aiItinerary.dayNumber}: ${weather.temperature}°C, ${weather.condition}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to get weather for day ${aiItinerary.dayNumber}: ${error.message}`,
            );
          }
        }

        const itinerary = this.itineraryRepository.create({
          tripId: savedTrip.id,
          date: aiItinerary.date,
          dayNumber: aiItinerary.dayNumber,
          activities: aiItinerary.activities,
          timezone: timezoneInfo?.timezoneId,
          timezoneOffset: timezoneInfo?.timezoneOffset,
          weather: weather,
        });
        itineraries.push(itinerary);
      }

      await this.itineraryRepository.save(itineraries);
      this.logger.log(
        `Successfully generated ${itineraries.length} AI itineraries with weather data for trip ${savedTrip.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to generate AI itineraries: ${error.message}`);
      this.logger.log(
        `Falling back to empty itineraries for trip ${savedTrip.id}`,
      );

      // Fallback: Create empty itineraries if AI generation fails
      const itineraries: Itinerary[] = [];
      for (let i = 0; i < numberOfDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        // Get weather forecast for this date
        let weather: any = null;
        if (locationInfo) {
          try {
            weather = await this.weatherService.getWeatherForecast(
              locationInfo.latitude,
              locationInfo.longitude,
              date,
            );
          } catch (error) {
            this.logger.warn(
              `Failed to get weather for day ${i + 1}: ${error.message}`,
            );
          }
        }

        const itinerary = this.itineraryRepository.create({
          tripId: savedTrip.id,
          date,
          dayNumber: i + 1,
          activities: [],
          timezone: timezoneInfo?.timezoneId,
          timezoneOffset: timezoneInfo?.timezoneOffset,
          weather: weather,
        });
        itineraries.push(itinerary);
      }

      await this.itineraryRepository.save(itineraries);
    }

    // Return trip with itineraries
    return this.findOne(userId, savedTrip.id);
  }

  async findAll(userId: string, queryDto?: any): Promise<Trip[]> {
    const {
      search,
      status,
      sortBy = 'startDate',
      order = 'DESC',
    } = queryDto || {};

    // Build query
    const queryBuilder = this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.itineraries', 'itinerary')
      .where('trip.userId = :userId', { userId });

    // Search filter (destination or description)
    if (search) {
      queryBuilder.andWhere(
        '(trip.destination LIKE :search OR trip.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('trip.status = :status', { status });
    }

    // Sorting
    const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';
    if (sortBy === 'destination') {
      queryBuilder.orderBy('trip.destination', orderDirection);
    } else if (sortBy === 'createdAt') {
      queryBuilder.orderBy('trip.createdAt', orderDirection);
    } else {
      // Default: sortBy startDate
      queryBuilder.orderBy('trip.startDate', orderDirection);
    }

    const trips = await queryBuilder.getMany();

    // Validate and update trip statuses
    for (const trip of trips) {
      await this.tripStatusScheduler.validateAndUpdateTripStatus(trip);
    }

    // Sort itineraries
    trips.forEach((trip) => {
      if (trip.itineraries) {
        trip.itineraries.sort((a, b) => a.dayNumber - b.dayNumber);
      }
    });

    return trips;
  }

  async findOne(userId: string, id: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { id, userId },
      relations: ['itineraries'],
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Validate and update trip status
    await this.tripStatusScheduler.validateAndUpdateTripStatus(trip);

    // Update completion status for all itineraries and activities
    if (trip.itineraries && trip.itineraries.length > 0) {
      // Get timezone offset for accurate completion detection
      const firstItinerary = trip.itineraries[0];
      const timezoneOffset = firstItinerary.timezoneOffset;

      // Update completion status
      trip.itineraries = updateItinerariesCompletionStatus(
        trip.itineraries,
        timezoneOffset,
      );

      // Sort itineraries by day number
      trip.itineraries.sort((a, b) => a.dayNumber - b.dayNumber);
    }

    return trip;
  }

  async update(
    userId: string,
    id: string,
    updateTripDto: UpdateTripDto,
  ): Promise<Trip> {
    const trip = await this.findOne(userId, id);

    // Check if trip can be modified
    this.canModifyTrip(trip);

    // Update trip
    Object.assign(trip, updateTripDto);
    await this.tripRepository.save(trip);

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const trip = await this.findOne(userId, id);
    await this.tripRepository.remove(trip);
  }

  async duplicate(userId: string, id: string): Promise<Trip> {
    const original = await this.findOne(userId, id);

    // Calculate date offset from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const originalStart = new Date(original.startDate);
    const originalEnd = new Date(original.endDate);
    const duration = originalEnd.getTime() - originalStart.getTime();

    // New trip starts tomorrow
    const newStart = new Date(today);
    newStart.setDate(newStart.getDate() + 1);
    const newEnd = new Date(newStart.getTime() + duration);

    // Create duplicated trip
    const newTrip = this.tripRepository.create({
      userId,
      destination: original.destination,
      country: original.country,
      city: original.city,
      startDate: newStart,
      endDate: newEnd,
      numberOfTravelers: original.numberOfTravelers,
      description: original.description
        ? `${original.description} (복제)`
        : `${original.destination} 여행 (복제)`,
      status: 'upcoming' as any,
    });

    const savedTrip = await this.tripRepository.save(newTrip);

    // Duplicate itineraries with shifted dates
    if (original.itineraries && original.itineraries.length > 0) {
      for (const itinerary of original.itineraries) {
        const dayOffset = itinerary.dayNumber - 1;
        const newDate = new Date(newStart);
        newDate.setDate(newDate.getDate() + dayOffset);

        // Clone activities (reset completion status)
        const clonedActivities = itinerary.activities.map((activity) => ({
          ...activity,
          completed: false,
        }));

        const newItinerary = this.itineraryRepository.create({
          tripId: savedTrip.id,
          dayNumber: itinerary.dayNumber,
          date: newDate,
          activities: clonedActivities,
          notes: itinerary.notes,
          timezone: itinerary.timezone,
          timezoneOffset: itinerary.timezoneOffset,
        });

        await this.itineraryRepository.save(newItinerary);
      }
    }

    return this.findOne(userId, savedTrip.id);
  }

  async updateItinerary(
    userId: string,
    tripId: string,
    itineraryId: string,
    updateItineraryDto: UpdateItineraryDto,
  ): Promise<Itinerary> {
    // Verify trip belongs to user and check modification permission
    const trip = await this.findOne(userId, tripId);
    this.canModifyTrip(trip);

    const itinerary = await this.itineraryRepository.findOne({
      where: { id: itineraryId, tripId },
    });

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    Object.assign(itinerary, updateItineraryDto);
    return this.itineraryRepository.save(itinerary);
  }

  async updateTripStatus(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update upcoming trips that have started
    await this.tripRepository
      .createQueryBuilder()
      .update(Trip)
      .set({ status: TripStatus.ONGOING })
      .where('status = :status', { status: TripStatus.UPCOMING })
      .andWhere('startDate <= :today', { today })
      .andWhere('endDate >= :today', { today })
      .execute();

    // Update ongoing trips that have ended
    await this.tripRepository
      .createQueryBuilder()
      .update(Trip)
      .set({ status: TripStatus.COMPLETED })
      .where('status = :status', { status: TripStatus.ONGOING })
      .andWhere('endDate < :today', { today })
      .execute();
  }

  async getUpcomingTrips(userId: string): Promise<Trip[]> {
    return this.tripRepository.find({
      where: {
        userId,
        status: TripStatus.UPCOMING,
      },
      relations: ['itineraries'],
      order: { startDate: 'ASC' },
    });
  }

  async getOngoingTrips(userId: string): Promise<Trip[]> {
    return this.tripRepository.find({
      where: {
        userId,
        status: TripStatus.ONGOING,
      },
      relations: ['itineraries'],
      order: { startDate: 'ASC' },
    });
  }

  async getCompletedTrips(userId: string): Promise<Trip[]> {
    return this.tripRepository.find({
      where: {
        userId,
        status: TripStatus.COMPLETED,
      },
      relations: ['itineraries'],
      order: { endDate: 'DESC' },
    });
  }

  // ============================================
  // Activity Management Methods
  // ============================================

  /**
   * Check if trip can be modified based on status
   */
  private canModifyTrip(trip: Trip): void {
    if (trip.status === TripStatus.COMPLETED) {
      throw new ForbiddenException(
        'Cannot modify completed trips. Completed trips are read-only.',
      );
    }
  }

  /**
   * Check if specific activity can be modified
   */
  private canModifyActivity(trip: Trip, activityTime: string): void {
    this.canModifyTrip(trip);

    // Note: For ongoing trips with past activities, the check is done in updateActivity
    // to allow marking as completed while preventing other modifications
  }

  /**
   * Check if activity is in the past
   */
  private isActivityInPast(activityTime: string): boolean {
    const now = new Date();
    const activityDateTime = new Date(activityTime);
    return activityDateTime < now;
  }

  /**
   * Add a new activity to an itinerary
   */
  async addActivity(
    userId: string,
    tripId: string,
    itineraryId: string,
    addActivityDto: AddActivityDto,
  ): Promise<Itinerary> {
    // Verify trip belongs to user and get trip details
    const trip = await this.findOne(userId, tripId);
    this.canModifyTrip(trip);

    const itinerary = await this.itineraryRepository.findOne({
      where: { id: itineraryId, tripId },
    });

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    // Create activity timestamp for validation
    const dateStr =
      typeof itinerary.date === 'string'
        ? itinerary.date
        : new Date(itinerary.date).toISOString().split('T')[0];
    const activityDateTime = `${dateStr}T${addActivityDto.time}`;
    this.canModifyActivity(trip, activityDateTime);

    // For ongoing trips, cannot add past activities
    if (
      trip.status === TripStatus.ONGOING &&
      this.isActivityInPast(activityDateTime)
    ) {
      throw new ForbiddenException(
        'Cannot add activities in the past during an ongoing trip.',
      );
    }

    // Add new activity to the activities array
    const newActivity = {
      time: addActivityDto.time,
      title: addActivityDto.title,
      description: addActivityDto.description,
      location: addActivityDto.location,
      estimatedDuration: addActivityDto.estimatedDuration,
      estimatedCost: addActivityDto.estimatedCost,
      type: addActivityDto.type || 'other',
    };

    itinerary.activities = [...itinerary.activities, newActivity];

    this.logger.log(
      `Added activity "${newActivity.title}" to itinerary ${itineraryId}`,
    );

    return this.itineraryRepository.save(itinerary);
  }

  /**
   * Update an existing activity
   */
  async updateActivity(
    userId: string,
    tripId: string,
    itineraryId: string,
    activityIndex: number,
    updateActivityDto: UpdateActivityDto,
  ): Promise<Itinerary> {
    // Verify trip belongs to user and get trip details
    const trip = await this.findOne(userId, tripId);

    const itinerary = await this.itineraryRepository.findOne({
      where: { id: itineraryId, tripId },
    });

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    if (activityIndex < 0 || activityIndex >= itinerary.activities.length) {
      throw new NotFoundException('Activity not found at the specified index');
    }

    const existingActivity = itinerary.activities[activityIndex];

    // Check modification permission using existing activity time
    const updDateStr =
      typeof itinerary.date === 'string'
        ? itinerary.date
        : new Date(itinerary.date).toISOString().split('T')[0];
    const activityDateTime = `${updDateStr}T${existingActivity.time}`;
    this.canModifyActivity(trip, activityDateTime);

    // For ongoing trips with past activities, only allow marking as completed
    if (
      trip.status === TripStatus.ONGOING &&
      this.isActivityInPast(activityDateTime)
    ) {
      // Check if trying to modify fields other than 'completed'
      const updateKeys = Object.keys(updateActivityDto);
      const hasNonCompletedUpdate = updateKeys.some(
        (key) => key !== 'completed' && updateActivityDto[key] !== undefined,
      );

      if (hasNonCompletedUpdate) {
        throw new ForbiddenException(
          'Cannot modify past activities during an ongoing trip. You can only mark them as completed.',
        );
      }
    }

    // Update activity fields (filter out undefined to prevent overwriting existing values)
    const definedUpdates = Object.fromEntries(
      Object.entries(updateActivityDto).filter(([_, v]) => v !== undefined),
    );
    const updatedActivity = {
      ...existingActivity,
      ...definedUpdates,
    };

    itinerary.activities[activityIndex] = updatedActivity;

    this.logger.log(
      `Updated activity at index ${activityIndex} in itinerary ${itineraryId}`,
    );

    return this.itineraryRepository.save(itinerary);
  }

  /**
   * Delete an activity from an itinerary
   */
  async deleteActivity(
    userId: string,
    tripId: string,
    itineraryId: string,
    activityIndex: number,
  ): Promise<Itinerary> {
    // Verify trip belongs to user and get trip details
    const trip = await this.findOne(userId, tripId);

    const itinerary = await this.itineraryRepository.findOne({
      where: { id: itineraryId, tripId },
    });

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    if (activityIndex < 0 || activityIndex >= itinerary.activities.length) {
      throw new NotFoundException('Activity not found at the specified index');
    }

    const activityToDelete = itinerary.activities[activityIndex];

    // Check modification permission
    const delDateStr =
      typeof itinerary.date === 'string'
        ? itinerary.date
        : new Date(itinerary.date).toISOString().split('T')[0];
    const activityDateTime = `${delDateStr}T${activityToDelete.time}`;
    this.canModifyActivity(trip, activityDateTime);

    // For ongoing trips, cannot delete past activities
    if (
      trip.status === TripStatus.ONGOING &&
      this.isActivityInPast(activityDateTime)
    ) {
      throw new ForbiddenException(
        'Cannot delete activities that have already occurred during an ongoing trip.',
      );
    }

    // Remove activity from array
    itinerary.activities = itinerary.activities.filter(
      (_, index) => index !== activityIndex,
    );

    this.logger.log(
      `Deleted activity "${activityToDelete.title}" from itinerary ${itineraryId}`,
    );

    return this.itineraryRepository.save(itinerary);
  }

  /**
   * Reorder activities within an itinerary
   */
  async reorderActivities(
    userId: string,
    tripId: string,
    itineraryId: string,
    reorderDto: ReorderActivitiesDto,
  ): Promise<Itinerary> {
    // Verify trip belongs to user
    const trip = await this.findOne(userId, tripId);
    this.canModifyTrip(trip);

    const itinerary = await this.itineraryRepository.findOne({
      where: { id: itineraryId, tripId },
    });

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }

    // Validate that the order array matches the activities count
    if (reorderDto.order.length !== itinerary.activities.length) {
      throw new ForbiddenException(
        'Order array length must match the number of activities',
      );
    }

    // Validate that all indices are valid and unique
    const validIndices = new Set(reorderDto.order);
    if (validIndices.size !== itinerary.activities.length) {
      throw new ForbiddenException('Order array must contain unique indices');
    }

    for (let i = 0; i < itinerary.activities.length; i++) {
      if (!validIndices.has(i)) {
        throw new ForbiddenException(
          `Order array must contain all indices from 0 to ${itinerary.activities.length - 1}`,
        );
      }
    }

    // Reorder activities based on the provided order
    const reorderedActivities = reorderDto.order.map(
      (index) => itinerary.activities[index],
    );

    itinerary.activities = reorderedActivities;

    this.logger.log(`Reordered activities in itinerary ${itineraryId}`);

    return this.itineraryRepository.save(itinerary);
  }

  // ============================================================================
  // SHARING METHODS
  // ============================================================================

  /**
   * Generate or update share token for a trip
   */
  async generateShareToken(
    tripId: string,
    userId: string,
    expiresInDays?: number,
  ): Promise<{ shareToken: string; shareUrl: string }> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to share this trip',
      );
    }

    // Generate a secure random token
    const shareToken = randomBytes(16).toString('hex');

    // Calculate expiration date if provided
    let shareExpiresAt: Date | undefined;
    if (expiresInDays && expiresInDays > 0) {
      shareExpiresAt = new Date();
      shareExpiresAt.setDate(shareExpiresAt.getDate() + expiresInDays);
    }

    // Update trip with share token
    trip.shareToken = shareToken;
    trip.isPublic = true;
    trip.shareExpiresAt = shareExpiresAt;

    await this.tripRepository.save(trip);

    this.logger.log(`Generated share token for trip ${tripId}`);

    // Return share URL (frontend will construct full URL)
    const shareUrl = `/share/${shareToken}`;

    return { shareToken, shareUrl };
  }

  /**
   * Get trip by share token (public access)
   */
  async getSharedTrip(shareToken: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { shareToken, isPublic: true },
      relations: ['itineraries', 'user'],
    });

    if (!trip) {
      throw new NotFoundException(
        'Shared trip not found or is no longer public',
      );
    }

    // Check if share token has expired
    if (trip.shareExpiresAt && new Date() > trip.shareExpiresAt) {
      throw new ForbiddenException('This share link has expired');
    }

    // Remove sensitive user information
    if (trip.user) {
      trip.user = {
        ...trip.user,
        email: undefined,
        password: undefined,
      } as any;
    }

    this.logger.log(`Shared trip ${trip.id} accessed via token`);

    return trip;
  }

  /**
   * Disable sharing for a trip
   */
  async disableSharing(tripId: string, userId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this trip',
      );
    }

    trip.shareToken = undefined;
    trip.isPublic = false;
    trip.shareExpiresAt = undefined;

    await this.tripRepository.save(trip);

    this.logger.log(`Disabled sharing for trip ${tripId}`);
  }
}
