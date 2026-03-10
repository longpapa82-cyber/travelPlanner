import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';
import { AIService } from './services/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

/**
 * TripStatusScheduler
 *
 * Automatically updates trip status based on current date:
 * - upcoming → ongoing: When current date >= startDate
 * - ongoing → completed: When current date > endDate
 *
 * Runs daily at midnight (00:00)
 */
@Injectable()
export class TripStatusScheduler {
  private readonly logger = new Logger(TripStatusScheduler.name);

  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,
    private aiService: AIService,
    @Optional()
    @Inject(NotificationsService)
    private notificationsService?: NotificationsService,
  ) {}

  /**
   * Cron job: Update trip statuses daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTripStatusUpdate() {
    this.logger.log('Starting daily trip status update...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day

      // Count updates for logging
      let upcomingToOngoing = 0;
      let ongoingToCompleted = 0;

      // Update upcoming → ongoing
      // Trips where today >= startDate AND status is still 'upcoming'
      const upcomingTrips = await this.tripRepository.find({
        where: {
          status: TripStatus.UPCOMING,
          startDate: LessThan(today),
        },
      });

      for (const trip of upcomingTrips) {
        trip.status = TripStatus.ONGOING;
        await this.tripRepository.save(trip);
        upcomingToOngoing++;

        // Notify user that their trip has started
        if (this.notificationsService) {
          this.notificationsService
            .create(
              trip.userId,
              NotificationType.TRIP_STARTED,
              '🌍 여행 시작!',
              `${trip.destination} 여행이 시작되었습니다. 즐거운 여행 되세요!`,
              { tripId: trip.id },
            )
            .catch((err) =>
              this.logger.warn('Failed to send trip start notification', err),
            );
        }
      }

      // Update ongoing → completed
      // Trips where today > endDate AND status is still 'ongoing'
      const ongoingTrips = await this.tripRepository.find({
        where: {
          status: TripStatus.ONGOING,
          endDate: LessThan(today),
        },
      });

      for (const trip of ongoingTrips) {
        trip.status = TripStatus.COMPLETED;
        await this.tripRepository.save(trip);
        ongoingToCompleted++;

        // Notify user that their trip is complete
        if (this.notificationsService) {
          this.notificationsService
            .create(
              trip.userId,
              NotificationType.TRIP_COMPLETED,
              '✅ 여행 완료!',
              `${trip.destination} 여행이 완료되었습니다. 추억을 확인해보세요!`,
              { tripId: trip.id },
            )
            .catch((err) =>
              this.logger.warn(
                'Failed to send trip complete notification',
                err,
              ),
            );
        }
      }

      this.logger.log(
        `Trip status update completed: ${upcomingToOngoing} upcoming→ongoing, ${ongoingToCompleted} ongoing→completed`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to update trip statuses',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Manually trigger status update (for testing or immediate sync)
   */
  async updateTripStatusNow() {
    this.logger.log('Manual trip status update triggered');
    await this.handleTripStatusUpdate();
  }

  /**
   * Calculate and return correct status for a trip based on dates
   * (Does not update database, just returns what status should be)
   */
  calculateTripStatus(startDate: Date, endDate: Date): TripStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // Check if trip is completed (end date is in the past)
    if (today > end) {
      return TripStatus.COMPLETED;
    }

    // Check if trip is ongoing (today is between start and end)
    if (today >= start && today <= end) {
      return TripStatus.ONGOING;
    }

    // Otherwise, trip is upcoming
    return TripStatus.UPCOMING;
  }

  /**
   * Cron job: Send departure reminders at 9 AM daily
   * Notifies users whose trips start tomorrow
   */
  @Cron('0 9 * * *')
  async handleDepartureReminders() {
    if (!this.notificationsService) return;

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const departingTrips = await this.tripRepository.find({
        where: {
          status: TripStatus.UPCOMING,
          startDate: Between(tomorrow, dayAfter),
        },
      });

      for (const trip of departingTrips) {
        await this.notificationsService.create(
          trip.userId,
          NotificationType.TRIP_DEPARTURE,
          'Departing Tomorrow!',
          `Your trip to ${trip.destination} starts tomorrow. Are you ready?`,
          { tripId: trip.id, destination: trip.destination },
        );
      }

      if (departingTrips.length > 0) {
        this.logger.log(`Sent ${departingTrips.length} departure reminders`);
      }
    } catch (error) {
      this.logger.error('Failed to send departure reminders', error);
    }
  }

  /**
   * Validate and update a single trip's status if needed
   * Returns true if status was updated, false otherwise
   */
  async validateAndUpdateTripStatus(trip: Trip): Promise<boolean> {
    const correctStatus = this.calculateTripStatus(
      trip.startDate,
      trip.endDate,
    );

    if (trip.status !== correctStatus) {
      this.logger.log(
        `Updating trip ${trip.id} status from ${trip.status} to ${correctStatus}`,
      );
      trip.status = correctStatus;
      await this.tripRepository.save(trip);
      return true;
    }

    return false;
  }

  /**
   * Cron: Refresh stale itinerary templates daily at 3 AM.
   * Re-generates popular templates older than 30 days via AI.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTemplateRefresh() {
    try {
      const refreshed = await this.aiService.refreshStaleTemplates();
      if (refreshed > 0) {
        this.logger.log(
          `Template refresh completed: ${refreshed} templates updated`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Template refresh failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
