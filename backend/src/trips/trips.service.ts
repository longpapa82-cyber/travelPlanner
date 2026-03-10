import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { Collaborator, CollaboratorRole } from './entities/collaborator.entity';
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
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { updateItinerariesCompletionStatus } from './helpers/trip-progress.helper';
import { QueryTripsDto, SortBy, SortOrder } from './dto/query-trips.dto';
import { getErrorMessage } from '../common/types/request.types';
import { Subject } from 'rxjs';

export type TripCreationStep =
  | 'validating'
  | 'weather'
  | 'ai_generating'
  | 'geocoding'
  | 'saving'
  | 'complete'
  | 'error';

export interface TripCreationProgress {
  step: TripCreationStep;
  message?: string;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Itinerary)
    private readonly itineraryRepository: Repository<Itinerary>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    private readonly aiService: AIService,
    private readonly timezoneService: TimezoneService,
    private readonly weatherService: WeatherService,
    private readonly tripStatusScheduler: TripStatusScheduler,
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async create(
    userId: string,
    createTripDto: CreateTripDto,
    language: string = 'ko',
    progress$?: Subject<TripCreationProgress>,
  ): Promise<Trip> {
    // Calculate number of days
    const startDate = new Date(createTripDto.startDate);
    const endDate = new Date(createTripDto.endDate);
    const numberOfDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    const isManualMode = createTripDto.planningMode === 'manual';

    // Check AI trip limit BEFORE creating trip to avoid orphan records
    if (!isManualMode) {
      const aiLimit = await this.subscriptionService.checkAiTripLimit(userId);
      if (!aiLimit.allowed) {
        throw new ForbiddenException(
          'Monthly AI generation limit (3) reached. Try manual creation or wait until next month.',
        );
      }
    }

    // Create trip
    const trip = this.tripRepository.create({
      userId,
      ...createTripDto,
      numberOfTravelers: createTripDto.numberOfTravelers || 1,
    });

    const savedTrip = await this.tripRepository.save(trip);

    this.logger.log(
      `Creating trip ${savedTrip.id} in ${isManualMode ? 'manual' : 'AI'} mode`,
    );

    progress$?.next({ step: 'validating' });

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
        `Failed to get location/timezone information: ${getErrorMessage(error)}`,
      );
    }

    // Helper: fetch weather for all days in a single API call
    const fetchWeatherMap = async () => {
      if (!locationInfo) {
        return new Map<number, any>();
      }
      try {
        return await this.weatherService.getWeatherForDateRange(
          locationInfo.latitude,
          locationInfo.longitude,
          startDate,
          endDate,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to get weather range: ${getErrorMessage(error)}`,
        );
        return new Map<number, any>();
      }
    };

    // Helper: create empty day-card itineraries with weather/timezone
    const createEmptyItineraries = async (weatherMap: Map<number, any>) => {
      const itineraries: Itinerary[] = [];
      for (let i = 0; i < numberOfDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        itineraries.push(
          this.itineraryRepository.create({
            tripId: savedTrip.id,
            date,
            dayNumber: i + 1,
            activities: [],
            timezone: timezoneInfo?.timezoneId,
            timezoneOffset: timezoneInfo?.timezoneOffset,
            weather: weatherMap.get(i + 1) ?? undefined,
          }),
        );
      }
      await this.itineraryRepository.save(itineraries);
      return itineraries;
    };

    if (isManualMode) {
      // Manual mode: skip AI, create empty day cards with weather/timezone
      progress$?.next({ step: 'weather' });
      const weatherMap = await fetchWeatherMap();
      const itineraries = await createEmptyItineraries(weatherMap);
      this.logger.log(
        `Created ${itineraries.length} empty itineraries (manual mode) for trip ${savedTrip.id}`,
      );
    } else {
      // Increment AI trip count before generation (limit already checked above)
      await this.subscriptionService.incrementAiTripCount(userId);

      // AI mode: generate itineraries with AI + weather in parallel
      try {
        progress$?.next({ step: 'ai_generating' });
        const aiPromise = this.aiService.generateAllItineraries({
          destination: createTripDto.destination,
          country: createTripDto.country,
          city: createTripDto.city,
          startDate,
          endDate,
          numberOfTravelers: createTripDto.numberOfTravelers || 1,
          preferences: createTripDto.preferences,
          language,
        });

        // Fetch weather in parallel while AI generates
        progress$?.next({ step: 'weather' });
        const weatherMap = await fetchWeatherMap();

        // Wait for AI generation to complete
        const aiItineraries = await aiPromise;

        // Combine AI results with weather data
        progress$?.next({ step: 'saving' });
        const itineraries: Itinerary[] = [];
        for (const aiItinerary of aiItineraries) {
          const itinerary = this.itineraryRepository.create({
            tripId: savedTrip.id,
            date: aiItinerary.date,
            dayNumber: aiItinerary.dayNumber,
            activities: aiItinerary.activities,
            timezone: timezoneInfo?.timezoneId,
            timezoneOffset: timezoneInfo?.timezoneOffset,
            weather: weatherMap.get(aiItinerary.dayNumber) ?? undefined,
          });
          itineraries.push(itinerary);
        }

        await this.itineraryRepository.save(itineraries);
        await this.tripRepository.update(savedTrip.id, { aiStatus: 'success' });
        this.logger.log(
          `Successfully generated ${itineraries.length} AI itineraries with weather data for trip ${savedTrip.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate AI itineraries: ${getErrorMessage(error)}`,
        );
        this.logger.log(
          `Falling back to empty itineraries for trip ${savedTrip.id}`,
        );

        await this.tripRepository.update(savedTrip.id, { aiStatus: 'failed' });
        progress$?.next({
          step: 'error',
          message: 'AI generation failed, creating empty itineraries',
        });

        // Fallback: Create empty itineraries with weather
        const weatherMap = await fetchWeatherMap();
        await createEmptyItineraries(weatherMap);
      }
    }

    // Return trip with itineraries
    progress$?.next({ step: 'complete' });
    return this.findOne(userId, savedTrip.id);
  }

  async findAll(
    userId: string,
    queryDto?: QueryTripsDto,
  ): Promise<{ trips: Trip[]; total: number; page: number; limit: number }> {
    const {
      search,
      status,
      country,
      startDateFrom,
      startDateTo,
      budgetMin,
      budgetMax,
      sortBy = 'startDate',
      order = 'DESC',
      page = 1,
      limit = 50,
    } = queryDto || {};

    // Build query — include trips where user is owner OR collaborator
    const queryBuilder = this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.itineraries', 'itinerary')
      .leftJoin(
        'collaborators',
        'collab',
        'collab.tripId = trip.id AND collab.userId = :collabUserId',
        { collabUserId: userId },
      )
      .where('(trip.userId = :userId OR collab.id IS NOT NULL)', { userId });

    // Search filter (destination or description)
    if (search) {
      queryBuilder.andWhere(
        '(trip.destination ILIKE :search OR trip.description ILIKE :search OR trip.country ILIKE :search OR trip.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('trip.status = :status', { status });
    }

    // Country filter
    if (country) {
      queryBuilder.andWhere('trip.country ILIKE :country', {
        country: `%${country}%`,
      });
    }

    // Date range filter
    if (startDateFrom) {
      queryBuilder.andWhere('trip.startDate >= :startDateFrom', {
        startDateFrom,
      });
    }
    if (startDateTo) {
      queryBuilder.andWhere('trip.startDate <= :startDateTo', { startDateTo });
    }

    // Budget range filter
    if (budgetMin !== undefined) {
      queryBuilder.andWhere('trip.totalBudget >= :budgetMin', { budgetMin });
    }
    if (budgetMax !== undefined) {
      queryBuilder.andWhere('trip.totalBudget <= :budgetMax', { budgetMax });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Sorting
    const orderDirection = order === SortOrder.ASC ? 'ASC' : 'DESC';
    if (sortBy === SortBy.DESTINATION) {
      queryBuilder.orderBy('trip.destination', orderDirection);
    } else if (sortBy === SortBy.CREATED_AT) {
      queryBuilder.orderBy('trip.createdAt', orderDirection);
    } else {
      queryBuilder.orderBy('trip.startDate', orderDirection);
    }

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

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

    return { trips, total, page, limit };
  }

  async findOne(userId: string, id: string): Promise<Trip> {
    // Try owner access first (full access)
    let trip = await this.tripRepository.findOne({
      where: { id, userId },
      relations: ['itineraries'],
    });

    // Fallback: allow read-only view for PUBLIC trips only (social feed detail).
    // Private trips are strictly owner-only unless the user is a collaborator.
    if (!trip) {
      // Check collaborator access
      const collab = await this.collaboratorRepository.findOne({
        where: { tripId: id, userId },
      });
      if (collab) {
        trip = await this.tripRepository.findOne({
          where: { id },
          relations: ['itineraries'],
        });
      }
    }

    if (!trip) {
      // Allow read-only access to public trips (for social feed detail view)
      trip = await this.tripRepository.findOne({
        where: { id, isPublic: true },
        relations: ['itineraries'],
      });
    }

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

    // Strict ownership check — only owner can update
    if (trip.userId !== userId) {
      // Check if user is a collaborator with editor role
      const collab = await this.collaboratorRepository.findOne({
        where: { tripId: id, userId },
      });
      if (!collab || collab.role !== CollaboratorRole.EDITOR) {
        throw new ForbiddenException(
          'Only the trip owner or editors can modify this trip',
        );
      }
    }

    // Check if trip can be modified
    this.canModifyTrip(trip);

    // Update trip
    Object.assign(trip, updateTripDto);
    await this.tripRepository.save(trip);

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const trip = await this.findOne(userId, id);

    // Strict ownership check — only owner can delete
    if (trip.userId !== userId) {
      throw new ForbiddenException('Only the trip owner can delete this trip');
    }

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
        ? `${original.description} (copy)`
        : `${original.destination} (copy)`,
      status: TripStatus.UPCOMING,
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
    // Verify trip access and write permission
    const trip = await this.findOne(userId, tripId);
    await this.canWriteTrip(trip, userId);
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
    return this.findTripsByStatus(userId, TripStatus.UPCOMING, {
      startDate: 'ASC',
    });
  }

  async getOngoingTrips(userId: string): Promise<Trip[]> {
    return this.findTripsByStatus(userId, TripStatus.ONGOING, {
      startDate: 'ASC',
    });
  }

  async getCompletedTrips(userId: string): Promise<Trip[]> {
    return this.findTripsByStatus(userId, TripStatus.COMPLETED, {
      endDate: 'DESC',
    });
  }

  private async findTripsByStatus(
    userId: string,
    status: TripStatus,
    orderBy: Record<string, 'ASC' | 'DESC'>,
  ): Promise<Trip[]> {
    const [orderColumn, orderDirection] = Object.entries(orderBy)[0];
    return this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.itineraries', 'itinerary')
      .leftJoin(
        'collaborators',
        'collab',
        'collab.tripId = trip.id AND collab.userId = :collabUserId',
        { collabUserId: userId },
      )
      .where('(trip.userId = :userId OR collab.id IS NOT NULL)', { userId })
      .andWhere('trip.status = :status', { status })
      .orderBy(`trip.${orderColumn}`, orderDirection)
      .getMany();
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
   * Check if user has write access to a trip (owner or editor collaborator)
   */
  private async canWriteTrip(trip: Trip, userId: string): Promise<void> {
    if (trip.userId === userId) return; // Owner always has write access
    const collab = await this.collaboratorRepository.findOne({
      where: { tripId: trip.id, userId },
    });
    if (!collab || collab.role !== CollaboratorRole.EDITOR) {
      throw new ForbiddenException(
        'Only the trip owner or editors can modify this trip',
      );
    }
  }

  /**
   * Check if specific activity can be modified
   */
  private canModifyActivity(trip: Trip, _activityTime: string): void {
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
    // Verify trip access and write permission
    const trip = await this.findOne(userId, tripId);
    await this.canWriteTrip(trip, userId);
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
    // Verify trip access and write permission
    const trip = await this.findOne(userId, tripId);
    await this.canWriteTrip(trip, userId);

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
      Object.entries(updateActivityDto).filter(([_k, v]) => v !== undefined),
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
    // Verify trip access and write permission
    const trip = await this.findOne(userId, tripId);
    await this.canWriteTrip(trip, userId);

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
    // Verify trip access and write permission
    const trip = await this.findOne(userId, tripId);
    await this.canWriteTrip(trip, userId);
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
    const trip = await this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.itineraries', 'itineraries')
      .leftJoin('trip.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.profileImage'])
      .where('trip.shareToken = :shareToken', { shareToken })
      .andWhere('trip.isPublic = :isPublic', { isPublic: true })
      .getOne();

    if (!trip) {
      throw new NotFoundException(
        'Shared trip not found or is no longer public',
      );
    }

    // Check if share token has expired
    if (trip.shareExpiresAt && new Date() > trip.shareExpiresAt) {
      throw new ForbiddenException('This share link has expired');
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

    await this.tripRepository.update(tripId, {
      shareToken: null as any,
      isPublic: false,
      shareExpiresAt: null as any,
    });

    this.logger.log(`Disabled sharing for trip ${tripId}`);
  }

  async getUserStats(userId: string) {
    const trips = await this.tripRepository.find({
      where: { userId },
      relations: ['itineraries'],
    });

    const completed = trips.filter((t) => t.status === TripStatus.COMPLETED);
    const ongoing = trips.filter((t) => t.status === TripStatus.ONGOING);
    const upcoming = trips.filter((t) => t.status === TripStatus.UPCOMING);

    // Total travel days
    let totalDays = 0;
    trips.forEach((t) => {
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      totalDays += Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
    });

    // Countries visited
    const countriesSet = new Set<string>();
    trips.forEach((t) => {
      if (t.country) countriesSet.add(t.country);
    });

    // Average trip duration
    const avgDuration =
      trips.length > 0 ? Math.round(totalDays / trips.length) : 0;

    // Total spending and budget
    let totalSpent = 0;
    let totalBudget = 0;
    trips.forEach((t) => {
      if (t.totalBudget) totalBudget += Number(t.totalBudget);
      (t.itineraries || []).forEach((it) => {
        (it.activities || []).forEach(
          (a: {
            actualCost?: number;
            estimatedCost?: number;
            completed?: boolean;
          }) => {
            if (a.actualCost) totalSpent += Number(a.actualCost);
            else if (a.estimatedCost) totalSpent += Number(a.estimatedCost);
          },
        );
      });
    });

    // Top destinations (by frequency)
    const destCount: Record<string, number> = {};
    trips.forEach((t) => {
      destCount[t.destination] = (destCount[t.destination] || 0) + 1;
    });
    const topDestinations = Object.entries(destCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([destination, count]) => ({ destination, count }));

    // Activities completed
    let totalActivities = 0;
    let completedActivities = 0;
    trips.forEach((t) => {
      (t.itineraries || []).forEach((it) => {
        (it.activities || []).forEach(
          (a: {
            actualCost?: number;
            estimatedCost?: number;
            completed?: boolean;
          }) => {
            totalActivities++;
            if (a.completed) completedActivities++;
          },
        );
      });
    });

    return {
      totalTrips: trips.length,
      completedTrips: completed.length,
      ongoingTrips: ongoing.length,
      upcomingTrips: upcoming.length,
      totalDays,
      avgDuration,
      countriesVisited: countriesSet.size,
      countries: Array.from(countriesSet),
      totalSpent: Math.round(totalSpent),
      totalBudget: Math.round(totalBudget),
      topDestinations,
      totalActivities,
      completedActivities,
    };
  }

  // ============ Collaboration Methods ============

  async addCollaborator(
    tripId: string,
    userId: string,
    targetEmail: string,
    role: CollaboratorRole = CollaboratorRole.VIEWER,
  ) {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.userId !== userId) {
      throw new ForbiddenException('Only trip owner can add collaborators');
    }

    // Find the target user by email
    const targetUser = (await this.tripRepository.manager
      .getRepository('User')
      .findOne({ where: { email: targetEmail } })) as { id: string } | null;
    if (!targetUser) {
      throw new NotFoundException('User not found with this email');
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot add yourself as a collaborator');
    }

    const existing = await this.collaboratorRepository.findOne({
      where: { tripId, userId: targetUser.id },
    });
    if (existing) {
      existing.role = role;
      return this.collaboratorRepository.save(existing);
    }

    const collaborator = this.collaboratorRepository.create({
      tripId,
      userId: targetUser.id,
      role,
      invitedBy: userId,
    });
    const saved = await this.collaboratorRepository.save(collaborator);

    // Send notification to the invited user
    this.notificationsService
      .create(
        targetUser.id,
        NotificationType.COLLABORATOR_INVITE,
        'Trip Invite',
        `You've been invited to ${trip.destination}`,
        { tripId, destination: trip.destination },
      )
      .catch((err) =>
        this.logger.warn('Failed to send collaborator notification', err),
      );

    return saved;
  }

  async removeCollaborator(
    tripId: string,
    userId: string,
    collaboratorId: string,
  ) {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.userId !== userId) {
      throw new ForbiddenException('Only trip owner can remove collaborators');
    }

    const collab = await this.collaboratorRepository.findOne({
      where: { id: collaboratorId, tripId },
    });
    if (!collab) throw new NotFoundException('Collaborator not found');

    await this.collaboratorRepository.remove(collab);
  }

  async getCollaborators(tripId: string, userId: string) {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    // Owner or collaborator can view full list; others get empty array
    if (trip.userId !== userId) {
      const collab = await this.collaboratorRepository.findOne({
        where: { tripId, userId },
      });
      if (!collab) return [];
    }

    return this.collaboratorRepository
      .createQueryBuilder('collab')
      .leftJoin('collab.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.profileImage'])
      .where('collab.tripId = :tripId', { tripId })
      .orderBy('collab.createdAt', 'ASC')
      .getMany();
  }

  async leaveTrip(tripId: string, userId: string): Promise<void> {
    const collab = await this.collaboratorRepository.findOne({
      where: { tripId, userId },
    });
    if (!collab) {
      throw new NotFoundException('You are not a collaborator of this trip');
    }
    await this.collaboratorRepository.remove(collab);
    this.logger.log(`User ${userId} left trip ${tripId}`);
  }

  async updateCollaboratorRole(
    tripId: string,
    userId: string,
    collaboratorId: string,
    role: CollaboratorRole,
  ) {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.userId !== userId) {
      throw new ForbiddenException('Only trip owner can update roles');
    }

    const collab = await this.collaboratorRepository.findOne({
      where: { id: collaboratorId, tripId },
    });
    if (!collab) throw new NotFoundException('Collaborator not found');

    collab.role = role;
    return this.collaboratorRepository.save(collab);
  }
}
