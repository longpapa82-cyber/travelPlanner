import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
import { ErrorLog } from '../admin/entities/error-log.entity';
import { Subject } from 'rxjs';

/** Thresholds (ms) above which a trip-creation phase is considered slow. */
const SLOW_THRESHOLDS: Record<string, number> = {
  validating: 5_000,
  weather: 5_000,
  ai_generating: 60_000,
  saving: 3_000,
  total: 60_000,
};

export type TripCreationStep =
  | 'validating'
  | 'weather'
  | 'ai_generating'
  | 'geocoding'
  | 'saving'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface TripCreationProgress {
  step: TripCreationStep;
  message?: string;
}

/**
 * Thrown from inside TripsService.create when the caller's AbortSignal fires.
 * Distinct class so the outer catch block can distinguish "user cancelled"
 * from "AI fallback to empty itineraries" — cancellation must not be masked
 * by the fallback path.
 */
export class TripCancelledError extends Error {
  constructor() {
    super('Trip creation cancelled by user');
    this.name = 'TripCancelledError';
  }
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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Record a slow trip-creation phase to ErrorLog so admins can spot bottlenecks.
   * Fire-and-forget — never blocks the pipeline.
   */
  private logSlowPhase(
    phase: string,
    elapsed: number,
    threshold: number,
    tripId: string,
    userId: string,
  ): void {
    this.dataSource
      .getRepository(ErrorLog)
      .save({
        userId,
        errorMessage:
          `[TripCreation] SLOW: ${phase} took ${elapsed}ms (threshold: ${threshold}ms, tripId: ${tripId})`.slice(
            0,
            500,
          ),
        severity: 'warning' as const,
        screen: `TripCreation/${phase}`,
        platform: 'web' as const,
        isResolved: false,
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to persist slow-phase log: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  async create(
    userId: string,
    createTripDto: CreateTripDto,
    language: string = 'ko',
    progress$?: Subject<TripCreationProgress>,
    signal?: AbortSignal,
  ): Promise<Trip> {
    // V112 fix #4: helper that throws if the caller cancelled the request.
    // Called at each async boundary so work stops quickly after DELETE /jobs/:id.
    const throwIfCancelled = () => {
      if (signal?.aborted) {
        throw new TripCancelledError();
      }
    };

    const pipelineStart = Date.now();

    // Calculate number of days
    const startDate = new Date(createTripDto.startDate);
    const endDate = new Date(createTripDto.endDate);
    const numberOfDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    const isManualMode = createTripDto.planningMode === 'manual';

    // ────────────────────────────────────────────────────────────
    // Phase A: SHORT transaction — quota check + trip creation
    // Holds the DB connection for <2 seconds, then releases it.
    // ────────────────────────────────────────────────────────────
    const phaseARunner = this.dataSource.createQueryRunner();
    await phaseARunner.connect();
    await phaseARunner.startTransaction();

    let savedTrip: Trip;

    try {
      // Check AI trip limit with row-level locking (prevents race conditions)
      if (!isManualMode) {
        // Lock user row to prevent concurrent quota checks
        const user = await phaseARunner.manager
          .createQueryBuilder()
          .select([
            'users.id',
            'users.aiTripsUsedThisMonth',
            'users.subscriptionTier',
            'users.role',
          ])
          .from('users', 'users')
          .where('users.id = :userId', { userId })
          .setLock('pessimistic_write') // SELECT FOR UPDATE
          .getRawOne();

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const currentCount = user.users_aiTripsUsedThisMonth || 0;

        // Admin users have unlimited AI generations
        if (user.users_role === 'admin') {
          // No limit check for admins, proceed with trip creation
        } else {
          // Determine the AI trip limit based on subscription tier
          let aiTripLimit: number;

          if (user.users_subscriptionTier === 'premium') {
            // Premium users get a higher limit
            aiTripLimit = parseInt(
              process.env.AI_TRIPS_PREMIUM_LIMIT || '30',
              10,
            );
          } else {
            // Free users get the basic limit
            aiTripLimit = parseInt(process.env.AI_TRIPS_FREE_LIMIT || '3', 10);
          }

          // Check if user has reached their limit
          if (currentCount >= aiTripLimit) {
            const tierMessage =
              user.users_subscriptionTier === 'premium'
                ? 'Premium monthly'
                : 'Monthly';
            throw new ForbiddenException(
              `${tierMessage} AI generation limit (${aiTripLimit}) reached. Try manual creation or wait until next month.`,
            );
          }
        }

        // CRITICAL: Increment quota BEFORE creating trip (inside transaction)
        // Skip incrementing for admin users as they have unlimited access
        if (user.users_role !== 'admin') {
          await phaseARunner.manager
            .createQueryBuilder()
            .update('users')
            .set({ aiTripsUsedThisMonth: () => 'aiTripsUsedThisMonth + 1' })
            .where('id = :userId', { userId })
            .execute();
        }

        if (user.users_role === 'admin') {
          this.logger.log(
            `Admin user ${userId} creating AI trip (unlimited access, current count: ${currentCount})`,
          );
        } else {
          this.logger.log(
            `Incremented AI trip quota for user ${userId}: ${currentCount} -> ${currentCount + 1}`,
          );
        }
      }

      // Create trip with aiStatus: 'generating' for AI mode
      // Trip is visible to frontend immediately after Phase A commit
      const trip = phaseARunner.manager.create(Trip, {
        userId,
        ...createTripDto,
        numberOfTravelers: createTripDto.numberOfTravelers || 1,
        ...(isManualMode ? {} : { aiStatus: 'generating' }),
      });

      savedTrip = await phaseARunner.manager.save(trip);

      // Commit Phase A — quota and trip are now persisted
      await phaseARunner.commitTransaction();

      this.logger.log(
        `[Phase A] Committed trip ${savedTrip.id} in ${isManualMode ? 'manual' : 'AI'} mode (${Date.now() - pipelineStart}ms)`,
      );
    } catch (error) {
      // Rollback on any error (quota increment is also rolled back)
      await phaseARunner.rollbackTransaction();
      this.logger.error(
        `[Phase A] Failed to create trip, transaction rolled back: ${getErrorMessage(error)}`,
      );
      throw error;
    } finally {
      await phaseARunner.release();
    }

    // ────────────────────────────────────────────────────────────
    // Phase B: External API calls — NO transaction held
    // AI generation (10-144s) + weather fetch run outside any
    // transaction so they cannot cause "current transaction is
    // aborted" errors or exhaust the connection pool.
    // ────────────────────────────────────────────────────────────
    this.logger.log(
      `[Phase B] Starting external API calls for trip ${savedTrip.id} in ${isManualMode ? 'manual' : 'AI'} mode`,
    );

    // Helper to mark trip as failed without a transaction (single UPDATE)
    const markTripFailed = async (reason: string) => {
      try {
        await this.tripRepository.update(savedTrip.id, {
          aiStatus: 'failed',
        });
        this.logger.warn(
          `Marked trip ${savedTrip.id} as failed: ${reason}`,
        );
      } catch (markErr) {
        this.logger.error(
          `Failed to mark trip ${savedTrip.id} as failed: ${getErrorMessage(markErr)}`,
        );
      }
    };

    try {
      throwIfCancelled();
      progress$?.next({ step: 'validating' });

      // ── Phase: validating (location + timezone lookup) ──
      const validatingStart = Date.now();

      // Get location information for timezone and weather (with 5s timeout to prevent long waits)
      type TimezoneResult = {
        timezone: string;
        timezoneId: string;
        timezoneOffset: number;
        localTime: string;
      } | null;
      let timezoneInfo: TimezoneResult = null;
      let locationInfo: { latitude: number; longitude: number } | null = null;

      try {
        const locationTimeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Location/timezone fetch timeout (5s)')),
            5000,
          ),
        );

        const location = await Promise.race([
          this.timezoneService.getLocationInfo(createTripDto.destination),
          locationTimeoutPromise,
        ]);

        if (location) {
          locationInfo = {
            latitude: location.latitude,
            longitude: location.longitude,
          };
          this.logger.log(
            `Retrieved location for ${createTripDto.destination}: ${location.latitude}, ${location.longitude}`,
          );

          // Get timezone with location (reuse remaining time from 8s budget)
          timezoneInfo = (await Promise.race([
            this.timezoneService.getTimezoneInfo(
              location.latitude,
              location.longitude,
              startDate,
            ),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Timezone fetch timeout (5s)')),
                5000,
              ),
            ),
          ])) as TimezoneResult;
          if (timezoneInfo) {
            this.logger.log(`Retrieved timezone: ${timezoneInfo.timezoneId}`);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get location/timezone information: ${getErrorMessage(error)}`,
        );
      }

      const validatingElapsed = Date.now() - validatingStart;
      this.logger.log(
        `[TripCreation] validating completed in ${validatingElapsed}ms (trip: ${savedTrip.id})`,
      );
      if (validatingElapsed > SLOW_THRESHOLDS.validating) {
        this.logger.warn(
          `[TripCreation] SLOW: validating took ${validatingElapsed}ms (threshold: ${SLOW_THRESHOLDS.validating}ms)`,
        );
        this.logSlowPhase(
          'validating',
          validatingElapsed,
          SLOW_THRESHOLDS.validating,
          savedTrip.id,
          userId,
        );
      }

      // Helper: fetch weather with 5s timeout to prevent long waits
      const fetchWeatherMap = async () => {
        if (!locationInfo) {
          return new Map<number, any>();
        }
        try {
          const weatherPromise = this.weatherService.getWeatherForDateRange(
            locationInfo.latitude,
            locationInfo.longitude,
            startDate,
            endDate,
          );
          const timeoutPromise = new Promise<Map<number, any>>((_, reject) =>
            setTimeout(
              () => reject(new Error('Weather fetch timeout (5s)')),
              5000,
            ),
          );
          return await Promise.race([weatherPromise, timeoutPromise]);
        } catch (error) {
          this.logger.warn(
            `Failed to get weather range: ${getErrorMessage(error)}`,
          );
          return new Map<number, any>();
        }
      };

      // Helper: build itinerary entities (no DB save — just creates objects)
      const buildEmptyItineraries = (weatherMap: Map<number, any>): Partial<Itinerary>[] => {
        const itineraries: Partial<Itinerary>[] = [];
        for (let i = 0; i < numberOfDays; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          itineraries.push({
            tripId: savedTrip.id,
            date,
            dayNumber: i + 1,
            activities: [],
            timezone: timezoneInfo?.timezoneId,
            timezoneOffset: timezoneInfo?.timezoneOffset,
            weather: weatherMap.get(i + 1) ?? undefined,
          });
        }
        return itineraries;
      };

      // Collect itinerary data and aiStatus to persist in Phase C
      let itineraryData: Partial<Itinerary>[] = [];
      let finalAiStatus: string | undefined;

      if (isManualMode) {
        // Manual mode: skip AI, create empty day cards with weather/timezone
        throwIfCancelled();
        progress$?.next({ step: 'weather' });
        const weatherStart = Date.now();
        const weatherMap = await fetchWeatherMap();
        const weatherElapsed = Date.now() - weatherStart;
        this.logger.log(
          `[TripCreation] weather completed in ${weatherElapsed}ms (trip: ${savedTrip.id})`,
        );
        if (weatherElapsed > SLOW_THRESHOLDS.weather) {
          this.logger.warn(
            `[TripCreation] SLOW: weather took ${weatherElapsed}ms (threshold: ${SLOW_THRESHOLDS.weather}ms)`,
          );
          this.logSlowPhase(
            'weather',
            weatherElapsed,
            SLOW_THRESHOLDS.weather,
            savedTrip.id,
            userId,
          );
        }

        throwIfCancelled();
        itineraryData = buildEmptyItineraries(weatherMap);

        this.logger.log(
          `Prepared ${itineraryData.length} empty itineraries (manual mode) for trip ${savedTrip.id}`,
        );
      } else {
        // AI mode: generate itineraries with AI + weather in parallel
        try {
          throwIfCancelled();
          progress$?.next({ step: 'ai_generating' });
          const aiStart = Date.now();
          const aiPromise = this.aiService.generateAllItineraries(
            {
              destination: createTripDto.destination,
              country: createTripDto.country,
              city: createTripDto.city,
              startDate,
              endDate,
              numberOfTravelers: createTripDto.numberOfTravelers || 1,
              preferences: createTripDto.preferences,
              language,
            },
            signal,
          );

          // Fetch weather in parallel while AI generates
          progress$?.next({ step: 'weather' });
          const weatherStart = Date.now();
          const weatherMap = await fetchWeatherMap();
          const weatherElapsed = Date.now() - weatherStart;
          this.logger.log(
            `[TripCreation] weather completed in ${weatherElapsed}ms (trip: ${savedTrip.id})`,
          );
          if (weatherElapsed > SLOW_THRESHOLDS.weather) {
            this.logger.warn(
              `[TripCreation] SLOW: weather took ${weatherElapsed}ms (threshold: ${SLOW_THRESHOLDS.weather}ms)`,
            );
            this.logSlowPhase(
              'weather',
              weatherElapsed,
              SLOW_THRESHOLDS.weather,
              savedTrip.id,
              userId,
            );
          }
          throwIfCancelled();

          // Wait for AI generation to complete
          const aiItineraries = await aiPromise;
          const aiElapsed = Date.now() - aiStart;
          this.logger.log(
            `[TripCreation] ai_generating completed in ${aiElapsed}ms (trip: ${savedTrip.id})`,
          );
          if (aiElapsed > SLOW_THRESHOLDS.ai_generating) {
            this.logger.warn(
              `[TripCreation] SLOW: ai_generating took ${aiElapsed}ms (threshold: ${SLOW_THRESHOLDS.ai_generating}ms)`,
            );
            this.logSlowPhase(
              'ai_generating',
              aiElapsed,
              SLOW_THRESHOLDS.ai_generating,
              savedTrip.id,
              userId,
            );
          }
          throwIfCancelled();

          // Combine AI results with weather data (in-memory only)
          for (const aiItinerary of aiItineraries) {
            itineraryData.push({
              tripId: savedTrip.id,
              date: aiItinerary.date,
              dayNumber: aiItinerary.dayNumber,
              activities: aiItinerary.activities,
              timezone: timezoneInfo?.timezoneId,
              timezoneOffset: timezoneInfo?.timezoneOffset,
              weather: weatherMap.get(aiItinerary.dayNumber) ?? undefined,
            });
          }
          finalAiStatus = 'success';

          this.logger.log(
            `Successfully generated ${itineraryData.length} AI itineraries with weather data for trip ${savedTrip.id}`,
          );
        } catch (error) {
          // V112 fix #4: never mask a cancellation with the fallback path.
          // Cancellation must propagate — mark trip as failed and re-throw.
          if (error instanceof TripCancelledError || signal?.aborted) {
            await markTripFailed('User cancelled');
            throw error instanceof TripCancelledError
              ? error
              : new TripCancelledError();
          }

          this.logger.error(
            `Failed to generate AI itineraries: ${getErrorMessage(error)}`,
          );
          this.logger.log(
            `Falling back to empty itineraries for trip ${savedTrip.id}`,
          );

          finalAiStatus = 'failed';
          progress$?.next({
            step: 'error',
            message: 'AI generation failed, creating empty itineraries',
          });

          // Fallback: Create empty itineraries with weather
          const weatherMap = await fetchWeatherMap();
          itineraryData = buildEmptyItineraries(weatherMap);
        }
      }

      throwIfCancelled();

      // ────────────────────────────────────────────────────────────
      // Phase C: SHORT transaction — save itineraries + update trip
      // Uses a NEW connection from the pool, holds it for <2 seconds.
      // ────────────────────────────────────────────────────────────
      progress$?.next({ step: 'saving' });
      const savingStart = Date.now();

      const phaseCRunner = this.dataSource.createQueryRunner();
      await phaseCRunner.connect();
      await phaseCRunner.startTransaction();

      try {
        // Bulk-create itinerary entities and save
        const itineraries = itineraryData.map((data) =>
          phaseCRunner.manager.create(Itinerary, data),
        );
        await phaseCRunner.manager.save(itineraries);

        // Update trip aiStatus if applicable
        if (finalAiStatus) {
          await phaseCRunner.manager.update(Trip, savedTrip.id, {
            aiStatus: finalAiStatus,
          });
        }

        await phaseCRunner.commitTransaction();

        const savingElapsed = Date.now() - savingStart;
        this.logger.log(
          `[Phase C] saving completed in ${savingElapsed}ms (trip: ${savedTrip.id})`,
        );
        if (savingElapsed > SLOW_THRESHOLDS.saving) {
          this.logger.warn(
            `[TripCreation] SLOW: saving took ${savingElapsed}ms (threshold: ${SLOW_THRESHOLDS.saving}ms)`,
          );
          this.logSlowPhase(
            'saving',
            savingElapsed,
            SLOW_THRESHOLDS.saving,
            savedTrip.id,
            userId,
          );
        }
      } catch (saveError) {
        await phaseCRunner.rollbackTransaction();
        this.logger.error(
          `[Phase C] Failed to save itineraries: ${getErrorMessage(saveError)}`,
        );
        // Mark trip as failed so the user knows something went wrong
        await markTripFailed(`Phase C save failed: ${getErrorMessage(saveError)}`);
        throw saveError;
      } finally {
        await phaseCRunner.release();
      }

      const totalElapsed = Date.now() - pipelineStart;
      this.logger.log(
        `[TripCreation] total pipeline completed in ${totalElapsed}ms (trip: ${savedTrip.id}, mode: ${isManualMode ? 'manual' : 'AI'})`,
      );
      if (totalElapsed > SLOW_THRESHOLDS.total) {
        this.logger.warn(
          `[TripCreation] SLOW: total pipeline took ${totalElapsed}ms (threshold: ${SLOW_THRESHOLDS.total}ms)`,
        );
        this.logSlowPhase(
          'total',
          totalElapsed,
          SLOW_THRESHOLDS.total,
          savedTrip.id,
          userId,
        );
      }

      this.logger.log(
        `Successfully completed trip creation pipeline for trip ${savedTrip.id}`,
      );
    } catch (error) {
      // Phase A is already committed — quota stays decremented (correct behavior).
      // Trip is already persisted with aiStatus: 'generating' or 'failed'.
      // If this is a cancellation, the trip was already marked failed above.
      if (!(error instanceof TripCancelledError)) {
        await markTripFailed(`Pipeline error: ${getErrorMessage(error)}`);
      }
      this.logger.error(
        `Failed during trip creation pipeline for trip ${savedTrip.id}: ${getErrorMessage(error)}`,
      );
      throw error;
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

  async findOne(
    userId: string,
    id: string,
  ): Promise<Trip & { userRole?: string }> {
    // Try owner access first (full access)
    let trip = await this.tripRepository.findOne({
      where: { id, userId },
      relations: ['itineraries'],
    });

    let userRole: string = 'viewer'; // Default role

    // Check if user is owner
    if (trip) {
      userRole = 'owner';
    } else {
      // Check collaborator access and get their role
      const collab = await this.collaboratorRepository.findOne({
        where: { tripId: id, userId },
      });
      if (collab) {
        trip = await this.tripRepository.findOne({
          where: { id },
          relations: ['itineraries'],
        });
        // Map collaborator role to user role
        userRole =
          collab.role === CollaboratorRole.EDITOR ? 'editor' : 'viewer';
      }
    }

    if (!trip) {
      // Allow read-only access to public trips (for social feed detail view)
      trip = await this.tripRepository.findOne({
        where: { id, isPublic: true },
        relations: ['itineraries'],
      });
      // Public trips without collaboration are view-only
      userRole = 'viewer';
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

    // Add userRole to the response
    return { ...trip, userRole };
  }

  async update(
    userId: string,
    id: string,
    updateTripDto: UpdateTripDto,
  ): Promise<Trip> {
    const tripData = await this.findOne(userId, id);
    const trip = { ...tripData }; // Extract trip without userRole

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

    // Allow adding activities for today and future dates during ongoing trips.
    // Users commonly record today's morning activities in the afternoon.
    // Only block adding to dates that have fully passed (yesterday or earlier).
    const activityDate = new Date(dateStr);
    activityDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (trip.status === TripStatus.ONGOING && activityDate < today) {
      throw new ForbiddenException(
        'Cannot add activities to past dates during an ongoing trip.',
      );
    }

    // DIAGNOSTIC: Log what the frontend is actually sending
    this.logger.log(
      `[COORDS-DIAG] addActivity received: location=${addActivityDto.location}, ` +
        `lat=${addActivityDto.latitude}, lng=${addActivityDto.longitude}, ` +
        `keys=${Object.keys(addActivityDto).join(',')}`,
    );

    // Add new activity to the activities array
    const newActivity = {
      time: addActivityDto.time,
      title: addActivityDto.title,
      description: addActivityDto.description,
      location: addActivityDto.location,
      latitude: addActivityDto.latitude,
      longitude: addActivityDto.longitude,
      estimatedDuration: addActivityDto.estimatedDuration,
      estimatedCost: addActivityDto.estimatedCost,
      type: addActivityDto.type || 'other',
    };

    itinerary.activities = [...itinerary.activities, newActivity];

    // Sort activities by startTime to maintain chronological order
    itinerary.activities.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

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

    // Re-sort activities by startTime after update
    itinerary.activities.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

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
   * @param expiresInDays - Number of days until token expires (default: 30 days)
   */
  async generateShareToken(
    tripId: string,
    userId: string,
    expiresInDays: number = 30, // Security: Default 30-day expiration
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

    // Security: Always set expiration date (default 30 days)
    const shareExpiresAt = new Date();
    shareExpiresAt.setDate(shareExpiresAt.getDate() + expiresInDays);

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
    const now = new Date();

    const trip = await this.tripRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.itineraries', 'itineraries')
      .leftJoin('trip.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.profileImage'])
      .where('trip.shareToken = :shareToken', { shareToken })
      .andWhere('trip.isPublic = :isPublic', { isPublic: true })
      // Database-level expiration check: only return non-expired shares
      .andWhere('(trip.shareExpiresAt IS NULL OR trip.shareExpiresAt > :now)', {
        now,
      })
      .getOne();

    if (!trip) {
      // Don't reveal whether link expired or doesn't exist (prevent enumeration)
      throw new NotFoundException(
        'Shared trip not found or is no longer public',
      );
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

    const collaborators = await this.collaboratorRepository
      .createQueryBuilder('collab')
      .leftJoin('collab.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email', 'user.profileImage'])
      .where('collab.tripId = :tripId', { tripId })
      .orderBy('collab.createdAt', 'ASC')
      .getMany();

    // Prepend trip owner as first entry so collaborators see who created the trip
    const tripWithOwner = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['user'],
    });
    const owner = tripWithOwner?.user;

    if (owner) {
      const ownerEntry = {
        id: `owner-${owner.id}`,
        user: owner,
        role: 'owner',
        createdAt: trip.createdAt,
      };
      return [ownerEntry, ...collaborators];
    }

    return collaborators;
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
