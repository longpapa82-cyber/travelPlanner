import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TripsService } from './trips.service';

/**
 * Public Share Controller
 * Handles public access to shared trips (no authentication required)
 */
@Controller('share')
export class ShareController {
  constructor(private readonly tripsService: TripsService) {}

  @Get(':shareToken')
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  getSharedTrip(@Param('shareToken') shareToken: string) {
    return this.tripsService.getSharedTrip(shareToken);
  }
}
