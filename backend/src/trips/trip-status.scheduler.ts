import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, Between } from 'typeorm';
import { Trip, TripStatus } from './entities/trip.entity';

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
      }

      this.logger.log(
        `Trip status update completed: ${upcomingToOngoing} upcoming→ongoing, ${ongoingToCompleted} ongoing→completed`,
      );
    } catch (error) {
      this.logger.error('Failed to update trip statuses', error.stack);
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
   * Validate and update a single trip's status if needed
   * Returns true if status was updated, false otherwise
   */
  async validateAndUpdateTripStatus(trip: Trip): Promise<boolean> {
    const correctStatus = this.calculateTripStatus(trip.startDate, trip.endDate);

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
}
